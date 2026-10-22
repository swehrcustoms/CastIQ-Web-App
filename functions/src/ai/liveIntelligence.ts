import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db } from '../utils/adminInit';
import { getAnthropicClient, anthropicApiKey, MODEL } from '../utils/anthropicClient';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { LiveIntelligenceRequestSchema } from '../utils/validators';

const CACHE_TTL_HOURS = 4;

export const liveIntelligenceService = onCall(
  {
    region: 'us-central1',
    maxInstances: 5,
    timeoutSeconds: 120,
    secrets: [anthropicApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const parsed = LiveIntelligenceRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }

    const { lakeId, forceRefresh } = parsed.data;

    if (!forceRefresh) {
      const cacheSnap = await db
        .collection('live_intelligence_cache')
        .where('lakeId', '==', lakeId)
        .orderBy('generatedAt', 'desc')
        .limit(1)
        .get();

      if (!cacheSnap.empty) {
        const cached = cacheSnap.docs[0].data();
        const ttl = (cached.ttl as Timestamp).toDate();
        if (ttl > new Date()) {
          logger.info('Live intelligence cache hit', { lakeId });
          return { ...cached, cached: true };
        }
      }
    }

    const lakeDoc = await db.collection('lakes').doc(lakeId).get();
    if (!lakeDoc.exists) {
      throw new HttpsError('not-found', `Lake ${lakeId} not found`);
    }
    const lake = lakeDoc.data()!;

    // TODO: Phase 3 — scrape live reports from 12+ sources
    const scrapedReports: string[] = [];

    const prompt = `
You are CastIQ's live intelligence engine. Synthesize these freshly scraped fishing reports for ${lake.name as string}.
Never name a specific place on the lake. Do not mention named bays, points, reefs, resorts, landings, dams, islands, narrows, or other spots. Describe structure and depth only.

Raw reports (${scrapedReports.length} sources):
${scrapedReports.length > 0 ? scrapedReports.join('\n\n---\n\n') : 'No live reports available at this time.'}

Generate:
1. A confidence-scored intelligence brief (what's happening right now)
2. Top species active
3. Top lures/presentations working
4. Confidence score 0-100 based on report recency and agreement

Return JSON:
{
  "brief": "",
  "topSpecies": [],
  "topLures": [],
  "conditions": "",
  "confidenceScore": 0,
  "lastReportAge": "unknown",
  "sourceCount": 0
}`.trim();

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let aiResult: Record<string, unknown>;
    try {
      aiResult = JSON.parse(text) as Record<string, unknown>;
    } catch {
      aiResult = { brief: text, topSpecies: [], topLures: [], confidenceScore: 0 };
    }

    const now = new Date();
    const cacheDoc = {
      lakeId,
      fetchedAt: FieldValue.serverTimestamp(),
      generatedAt: FieldValue.serverTimestamp(),
      sources: [],
      rawReports: scrapedReports,
      ...aiResult,
      ttl: new Date(now.getTime() + CACHE_TTL_HOURS * 3600 * 1000),
    };

    const cacheRef = db.collection('live_intelligence_cache').doc();
    await cacheRef.set(cacheDoc);

    logger.info('Live intelligence generated', { lakeId, cacheId: cacheRef.id });
    return { ...cacheDoc, cached: false };
  }
);

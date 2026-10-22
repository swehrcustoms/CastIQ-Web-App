import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getAnthropicClient, anthropicApiKey, MODEL } from '../utils/anthropicClient';
import { AITaskSchema } from '../utils/validators';

const SPOT_RULE = 'Never name a specific place on the lake. Do not mention named bays, points, reefs, resorts, landings, dams, islands, narrows, or other spots. Describe structure and depth only.';

const PROMPTS = {
  lure_recommendation: (p: Record<string, unknown>) => `
You are a professional fishing guide for Minnesota lakes with 20+ years of experience.

Lake context:
- Species target: ${p.species}
- Season: ${p.season}
- Water temp: ${p.waterTempF}°F
- Barometric pressure: ${p.pressureInHg} inHg
- Wind: ${p.windSpeedMph} mph
- Recent survey CPUE: ${p.nettingSurveyCPUE} fish/net-night
- Last stocking: ${p.lastStockDate ?? 'unknown'}

Recent angler reports (last 5):
${(p.latestReports as string[]).join('\n')}

${SPOT_RULE}

Based on this data, provide:
1. Top 3 lure recommendations (name, color, depth, technique)
2. Confidence score 0-100 for each
3. One-sentence reasoning per recommendation
4. Overall confidence in this recommendation (0-100)

Respond in JSON format only:
{
  "recommendations": [
    { "lure": "", "color": "", "depthFt": 0, "technique": "", "confidence": 0, "reasoning": "" }
  ],
  "overallConfidence": 0,
  "summaryNote": ""
}`.trim(),

  weekly_summary: (p: Record<string, unknown>) => `
You are writing a weekly fishing conditions summary for ${p.lakeName} for the week of ${p.week}.

Weather: ${p.weatherSummary}
Survey context: ${p.surveyHighlights ?? 'No recent survey data'}

Angler reports this week (${(p.reports as string[]).length} total):
${(p.reports as string[]).join('\n')}

Write a 2-3 paragraph digest in plain English that a Minnesota angler would find useful.
Cover: what species are active, what's working, depth/structure patterns, and anything notable.
${SPOT_RULE}
Tone: knowledgeable, practical, like a trusted fishing buddy who's been watching the lake.
Max 200 words.`.trim(),

  border_advisor: (p: Record<string, unknown>) => `
You are a fishing regulation compliance advisor for border waters between Minnesota and ${p.partnerJurisdiction}.

Water: ${p.waterName}
Target species: ${p.targetSpecies}

Minnesota regulations:
${p.mnRegText}

${p.partnerJurisdiction} regulations:
${p.partnerRegText}

Provide:
1. A plain-English summary of each jurisdiction's regulations for this species
2. Any conflicts or differences between the two jurisdictions
3. Which license(s) are required and where they apply
4. Practical advice for anglers fishing this border water

Respond in JSON:
{
  "mnSummary": "",
  "partnerSummary": "",
  "conflicts": [],
  "licensesRequired": [],
  "practicalAdvice": "",
  "conflictLevel": "none"
}`.trim(),

  fisheries_trend: (p: Record<string, unknown>) => `
You are a fisheries biologist interpreting DNR survey data for ${p.lakeName}.
Species: ${p.species}

Netting survey CPUE trend (fish per net-night):
${JSON.stringify(p.nettingData)}

Stocking history:
${JSON.stringify(p.stockingHistory)}

Provide a 2-3 sentence plain-English interpretation of:
1. Whether the population is growing, stable, or declining
2. What the size structure tells us about the fishery
3. What anglers can expect based on recent stocking

Be specific and data-driven. Avoid jargon. Max 100 words.`.trim(),

  winterkill_risk: (p: Record<string, unknown>) => `
Assess winterkill risk for ${p.lakeName} based on the following data:

Lake avg depth: ${p.avgDepthFt} ft
Current ice cover: ${p.iceCoverIn} inches
Current snow depth: ${p.snowDepthIn} inches
Aeration active: ${p.aerationActive}

Dissolved oxygen readings (most recent first):
${JSON.stringify(p.dissolvedO2Readings)}

Critical threshold: <2.0 mg/L = high risk; 2-4 mg/L = moderate; >4 mg/L = low risk

Return JSON:
{
  "riskLevel": "low",
  "riskScore": 0,
  "primaryRiskFactor": "",
  "recommendation": "",
  "estimatedDaysToThreshold": null
}`.trim(),

  regulation_conflict: (p: Record<string, unknown>) => `
Review this Minnesota fishing regulation record for potential conflicts, ambiguities, or angler alerts.

Lake: ${p.lakeName}
Species: ${p.species}
Regulation data: ${p.regulationJson}

Flag any of the following:
- Tribal overlap restrictions that limit harvest
- Experimental regulations that differ from statewide default
- Slot limits that are commonly misunderstood
- Border water license conflicts
- Emergency closures or temporary changes

Return JSON:
{
  "alerts": [
    { "type": "warning", "title": "", "body": "" }
  ],
  "conflictLevel": "none",
  "summary": ""
}`.trim(),
};

export const aiSummarizationService = onCall(
  {
    region: 'us-central1',
    maxInstances: 5,
    secrets: [anthropicApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const parsed = AITaskSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }

    const { task, payload } = parsed.data;
    const promptFn = PROMPTS[task];
    const prompt = promptFn(payload as Record<string, unknown>);

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    logger.info('AI task completed', { task, inputTokens: response.usage.input_tokens });
    return { result: text, task };
  }
);

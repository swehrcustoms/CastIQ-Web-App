import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { functions, db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { reportNote } from '../utils/reportIdentity';
import { useReportAccess } from '../hooks/useReportAccess';
import type { Lake } from '../types/lake';
import type { GuidePortalUser, AnglerReport } from '../types/user';
import type { WithId } from '../types/common';

interface DashboardResponse {
  lakes: (Lake & { id: string })[];
  guide?: GuidePortalUser;
  recentReports?: AnglerReport[];
}

const guidePortalFn = httpsCallable<
  | { action: 'get_dashboard'; lakeIds: string[] }
  | { action: 'generate_api_key' }
  | { action: 'revoke_api_key' },
  DashboardResponse & { apiKey?: string; success?: boolean }
>(functions, 'guidePortalService');

export function GuidePortal() {
  const { user, profile } = useAuth();
  const canSeeReports = useReportAccess();
  const [guide, setGuide] = useState<WithId<GuidePortalUser> | null>(null);
  const [lakes, setLakes] = useState<(Lake & { id: string })[]>([]);
  const [reports, setReports] = useState<AnglerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);

  const hasAccess =
    profile?.guidePortalAccess === true ||
    profile?.role === 'guide' ||
    profile?.role === 'admin';

  const load = useCallback(async () => {
    if (!user || !hasAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Prefer doc id = uid (createGuideUser script); fall back to query
      let guideData: WithId<GuidePortalUser> | null = null;
      const byId = await getDoc(doc(db, 'guide_portal_users', user.uid));
      if (byId.exists()) {
        guideData = { id: byId.id, ...byId.data() } as WithId<GuidePortalUser>;
      } else {
        const q = query(
          collection(db, 'guide_portal_users'),
          where('userId', '==', user.uid),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          guideData = { id: d.id, ...d.data() } as WithId<GuidePortalUser>;
        }
      }

      if (!guideData) {
        setError(
          'Guide profile not found. Ask an admin to run create:guide for your account.'
        );
        setLoading(false);
        return;
      }

      setGuide(guideData);
      setApiKey(guideData.apiKey);

      const lakeIds = guideData.primaryLakeIds?.length
        ? guideData.primaryLakeIds
        : [];

      const result = await guidePortalFn({
        action: 'get_dashboard',
        lakeIds: lakeIds.length ? lakeIds : ['48-0259-00'],
      });

      setLakes(result.data.lakes ?? []);
      if (result.data.recentReports) {
        setReports(result.data.recentReports);
      } else if (lakeIds.length) {
        const reportSnaps = await Promise.all(
          lakeIds.slice(0, 3).map((lakeId) =>
            getDocs(
              query(
                collection(db, 'angler_reports'),
                where('lakeId', '==', lakeId),
                where('isPublic', '==', true),
                orderBy('reportDate', 'desc'),
                limit(3)
              )
            )
          )
        );
        const merged = reportSnaps
          .flatMap((s) => s.docs.map((d) => d.data() as AnglerReport))
          .slice(0, 8);
        setReports(merged);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load guide portal';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, hasAccess]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onGenerateKey() {
    setKeyBusy(true);
    try {
      const result = await guidePortalFn({ action: 'generate_api_key' });
      setApiKey(result.data.apiKey ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate API key');
    } finally {
      setKeyBusy(false);
    }
  }

  async function onRevokeKey() {
    setKeyBusy(true);
    try {
      await guidePortalFn({ action: 'revoke_api_key' });
      setApiKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke API key');
    } finally {
      setKeyBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-castiq-blue bg-castiq-blue p-8">
          <p className="text-4xl">🎣</p>
          <h1 className="mt-4 text-xl font-bold text-castiq-white">Guide Portal</h1>
          <p className="mt-3 text-sm text-castiq-muted leading-relaxed">
            Your account does not have guide access yet. Contact CastIQ admin to be
            provisioned, or have them run:
          </p>
          <code className="mt-4 block rounded-lg bg-castiq-blue-dark px-3 py-2 text-left text-xs text-castiq-teal">
            npm run create:guide -- --email you@email.com
          </code>
          <Link
            to="/"
            className="mt-6 inline-block text-sm text-castiq-teal hover:underline"
          >
            ← Back to map
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-28">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-castiq-white">Guide Portal</h1>
          <p className="text-sm text-castiq-muted">
            {guide?.businessName ?? profile?.displayName ?? user?.email}
          </p>
        </div>
        <span className="rounded-full bg-castiq-teal/20 px-3 py-1 text-xs font-medium capitalize text-castiq-teal">
          {guide?.subscriptionTier ?? 'basic'} · {profile?.role}
        </span>
      </div>

      {error && (
        <p className="rounded-lg bg-red-900/25 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {/* Assigned lakes */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-castiq-muted">
          Your lakes
        </h2>
        {lakes.length === 0 ? (
          <p className="text-sm text-castiq-muted">No lakes assigned yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {lakes.map((lake) => (
              <div
                key={lake.id}
                className="rounded-xl border border-castiq-blue bg-castiq-blue p-4"
              >
                <h3 className="font-semibold text-castiq-white">{lake.name}</h3>
                <p className="text-xs text-castiq-muted">
                  {lake.county} County · {lake.acreage?.toLocaleString()} ac
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/lake/${lake.id}`}
                    className="rounded-lg bg-castiq-blue-dark px-3 py-1.5 text-xs text-castiq-white hover:text-castiq-teal"
                  >
                    Lake detail
                  </Link>
                  <Link
                    to={`/lake/${lake.id}/live`}
                    className="rounded-lg bg-castiq-teal/20 px-3 py-1.5 text-xs font-medium text-castiq-teal hover:bg-castiq-teal/30"
                  >
                    Live Intel
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent reports */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-castiq-muted">
          Recent reports
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-castiq-muted">
            No recent reports. Seed demo data with{' '}
            <code className="text-castiq-teal">npm run seed:reports</code>.
          </p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r, i) => (
              <li
                key={r.reportId ?? i}
                className="rounded-lg bg-castiq-blue px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-castiq-white">
                    {r.lakeName || r.lakeId}
                  </span>
                  <span className="text-xs capitalize text-castiq-muted">
                    {(r.species ?? []).join(', ')}
                  </span>
                </div>
                {canSeeReports && reportNote(r) && (
                  <p className="mt-1 text-xs text-castiq-muted">
                    {reportNote(r)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* API key */}
      <section className="rounded-xl border border-castiq-blue bg-castiq-blue p-4 space-y-3">
        <h2 className="text-sm font-semibold text-castiq-white">Partner API key</h2>
        <p className="text-xs text-castiq-muted">
          Optional key for guide integrations. Keep it private.
        </p>
        {apiKey ? (
          <code className="block break-all rounded-lg bg-castiq-blue-dark px-3 py-2 text-xs text-castiq-teal">
            {apiKey}
          </code>
        ) : (
          <p className="text-xs text-castiq-muted">No active API key.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={keyBusy}
            onClick={() => void onGenerateKey()}
            className="rounded-lg bg-castiq-teal px-4 py-2 text-xs font-semibold text-castiq-blue-dark disabled:opacity-50"
          >
            {apiKey ? 'Rotate key' : 'Generate key'}
          </button>
          {apiKey && (
            <button
              type="button"
              disabled={keyBusy}
              onClick={() => void onRevokeKey()}
              className="rounded-lg bg-castiq-blue-dark px-4 py-2 text-xs text-castiq-muted hover:text-castiq-white disabled:opacity-50"
            >
              Revoke
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { PageContainer, PageHeader, SourceFooter } from '../components/ui/Chrome';
import { AppCard, DataFreshnessBadge, FilterChip } from '../components/ui/Data';
import { AlertBanner, EmptyState, ErrorState, SkeletonGrid } from '../components/ui/States';
import { useAuth } from '../hooks/useAuth';
import { useIceIntel } from '../hooks/useIceIntel';
import { useLakeSearch } from '../hooks/useLakeSearch';
import { usePageTitle } from '../hooks/usePageTitle';
import { Collections } from '../services/firestore';
import { lakePlaceLabel } from '../services/dnrLakeSearch';
import { formatTimestamp, hoursSince, toDate } from '../utils/dates';
import type { IceReport } from '../types/events';
import type { WithId } from '../types/common';

type Freshness = 'any' | '48h' | '7d' | '30d';
type Thickness = 'any' | 'under6' | 'mid' | 'over12';

function caution(report: IceReport, date: Date | null): { label: string; className: string } {
  const hours = hoursSince(date);
  if (hours == null) return { label: 'Very limited data', className: 'text-castiq-muted' };
  if (hours > 24 * 7) return { label: 'Stale report', className: 'text-castiq-yellow' };
  if (report.iceTotalIn < 4 || report.safetyRating === 'unsafe' || report.safetyRating === 'open water') {
    return { label: 'Use extreme caution', className: 'text-castiq-red' };
  }
  if (hours <= 48) return { label: 'Recent report available', className: 'text-castiq-green' };
  return { label: 'Conditions vary', className: 'text-castiq-yellow' };
}

function iceSeasonNow(date = new Date()): boolean {
  const month = date.getMonth() + 1;
  return month >= 11 || month <= 3;
}

function sourceLabel(submittedBy: string): string {
  if (!submittedBy) return 'Source not listed';
  if (submittedBy.length > 24 && !submittedBy.includes(' ')) return 'Angler report';
  return submittedBy;
}

export function IceFishing() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useIceIntel();
  const [search, setSearch] = useState('');
  const [county, setCounty] = useState('all');
  const [freshness, setFreshness] = useState<Freshness>('any');
  const [thickness, setThickness] = useState<Thickness>('any');
  usePageTitle('Ice fishing');

  const lakesById = useMemo(() => new Map(data.lakes.map((lake) => [lake.id, lake])), [data.lakes]);
  const counties = useMemo(
    () => [...new Set(data.reports.map((report) => report.county).filter(Boolean))].sort(),
    [data.reports],
  );

  const reports = data.reports.filter((report) => {
    const lake = lakesById.get(report.lakeId);
    const name = `${lake?.name ?? ''} ${report.county}`.toLowerCase();
    if (search.trim() && !name.includes(search.trim().toLowerCase())) return false;
    if (county !== 'all' && report.county !== county) return false;
    const date = toDate(report.reportDate);
    const hours = hoursSince(date);
    if (freshness === '48h' && (hours == null || hours > 48)) return false;
    if (freshness === '7d' && (hours == null || hours > 24 * 7)) return false;
    if (freshness === '30d' && (hours == null || hours > 24 * 30)) return false;
    if (thickness === 'under6' && report.iceTotalIn >= 6) return false;
    if (thickness === 'mid' && (report.iceTotalIn < 6 || report.iceTotalIn > 12)) return false;
    if (thickness === 'over12' && report.iceTotalIn <= 12) return false;
    return true;
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Winter"
        title="Ice"
        subtitle="Recent thickness reports. A measurement describes one place at one time."
      />

      <div className="mb-5">
        <AlertBanner tone="warning">
          Reported ice thickness is informational only. Ice conditions vary across a lake and can change rapidly. No report guarantees safe ice. Verify conditions locally before travel.
        </AlertBanner>
      </div>

      <IceReportForm signedIn={Boolean(user)} userId={user?.uid ?? ''} />

      {loading && <SkeletonGrid count={3} />}
      {error && <ErrorState title="We couldn't load ice reports." onRetry={reload} />}

      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs text-castiq-muted">Lake or county</span>
              <input className="ciq-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" />
            </label>
            <label>
              <span className="mb-1 block text-xs text-castiq-muted">County</span>
              <select className="ciq-input" value={county} onChange={(event) => setCounty(event.target.value)}>
                <option value="all">All counties</option>
                {counties.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-castiq-muted">Freshness</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {([
                ['any', 'Any age'],
                ['48h', 'Last 48 hours'],
                ['7d', 'Last 7 days'],
                ['30d', 'Last 30 days'],
              ] as const).map(([id, label]) => (
                <FilterChip key={id} selected={freshness === id} onClick={() => setFreshness(id)}>{label}</FilterChip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-castiq-muted">Reported thickness</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {([
                ['any', 'Any'],
                ['under6', 'Under 6 in'],
                ['mid', '6–12 in'],
                ['over12', 'Over 12 in'],
              ] as const).map(([id, label]) => (
                <FilterChip key={id} selected={thickness === id} onClick={() => setThickness(id)}>{label}</FilterChip>
              ))}
            </div>
          </div>

          {reports.length === 0 ? (
            <EmptyState
              title="No ice reports match."
              message={data.reports.length === 0
                ? iceSeasonNow()
                  ? 'No ice thickness reports have been published yet. A report appears here as soon as it is saved.'
                  : 'There is no ice thickness to report in open-water season. A saved report shows up here once someone files one.'
                : 'Try a wider freshness window or clear the filters.'}
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {reports.map((report) => (
                <IceCard key={report.id} report={report} lakeName={lakesById.get(report.lakeId)?.name} />
              ))}
            </ul>
          )}

          <SourceFooter>
            Ice reports are crowd-sourced or agency notes stored in CastIQ. A reporter rating is that person’s assessment, not a CastIQ travel approval.
          </SourceFooter>
        </div>
      )}
    </PageContainer>
  );
}

function IceReportForm({ signedIn, userId }: { signedIn: boolean; userId: string }) {
  const [query, setQuery] = useState('');
  const [lakeId, setLakeId] = useState('');
  const [lakeName, setLakeName] = useState('');
  const [county, setCounty] = useState('');
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { results, loading } = useLakeSearch(query, {}, 6);
  const inches = Number(total);
  const ready = signedIn && lakeId && Number.isFinite(inches) && inches >= 0 && inches <= 60;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setMessage(null);
    try {
      await addDoc(Collections.iceReports, {
        reportId: '',
        lakeId,
        county,
        reportDate: serverTimestamp(),
        iceTotalIn: inches,
        iceBlackIn: 0,
        iceWhiteIn: 0,
        snowDepthIn: 0,
        safetyRating: 'caution',
        accessPoints: [],
        fishingConditions: notes.trim(),
        submittedBy: userId,
        userId,
        verified: false,
      });
      setTotal('');
      setNotes('');
      setMessage(`Saved the ${inches} in report for ${lakeName}. It is one measurement, not a lake-wide condition.`);
    } catch (err) {
      console.error(err);
      setMessage('That ice report could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mb-6 space-y-3 rounded-xl bg-castiq-blue p-4">
      <h2 className="text-sm font-semibold text-castiq-white">Add a thickness report</h2>
      <p className="text-xs text-castiq-muted">
        Enter a measurement you made. It shows on this page as soon as it is saved, marked unverified.
      </p>
      {!signedIn && <p className="text-sm text-castiq-muted">Sign in from Profile to add an ice report.</p>}
      {signedIn && (
        <>
          <input
            className="ciq-input"
            value={lakeName || query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLakeId('');
              setLakeName('');
              setCounty('');
            }}
            placeholder="Search the lake you measured"
            aria-label="Lake for this ice report"
          />
          {query && !lakeId && (
            <ul className="max-h-40 overflow-y-auto rounded-lg bg-castiq-blue-dark">
              {loading && <li className="px-3 py-2 text-sm text-castiq-muted">Searching…</li>}
              {!loading && results.length === 0 && <li className="px-3 py-2 text-sm text-castiq-muted">No lakes match that name.</li>}
              {results.map((lake) => (
                <li key={lake.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-castiq-white hover:bg-castiq-blue"
                    onClick={() => {
                      setLakeId(lake.id);
                      setLakeName(lake.name);
                      setCounty(lake.county ?? '');
                      setQuery('');
                    }}
                  >
                    {lake.name}
                    <span className="ml-2 text-xs text-castiq-muted">{lakePlaceLabel(lake)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="block text-sm text-castiq-muted">
            Total ice thickness (inches)
            <input
              className="ciq-input mt-1"
              inputMode="decimal"
              value={total}
              onChange={(event) => setTotal(event.target.value)}
              placeholder="0"
            />
          </label>
          <label className="block text-sm text-castiq-muted">
            Where you measured it
            <input className="ciq-input mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Access or bay" />
          </label>
          <button type="submit" className="ciq-btn-primary" disabled={!ready || busy}>
            {busy ? 'Saving…' : 'Save ice report'}
          </button>
        </>
      )}
      {message && <p className="text-sm text-castiq-muted">{message}</p>}
    </form>
  );
}

function IceCard({ report, lakeName }: { report: WithId<IceReport>; lakeName?: string }) {
  const date = toDate(report.reportDate);
  const status = caution(report, date);
  return (
    <li>
      <AppCard className="h-full">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-castiq-white">
            {lakeName ? <Link to={`/lake/${report.lakeId}`} className="hover:text-castiq-teal">{lakeName}</Link> : 'Lake'}
          </h3>
          <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
        </div>
        <p className="mt-2 text-2xl font-semibold text-castiq-white">{report.iceTotalIn} in</p>
        {(report.iceBlackIn > 0 || report.iceWhiteIn > 0 || report.snowDepthIn > 0) && (
          <p className="text-xs text-castiq-muted">
            {[
              report.iceBlackIn > 0 ? `Black ${report.iceBlackIn} in` : null,
              report.iceWhiteIn > 0 ? `White ${report.iceWhiteIn} in` : null,
              report.snowDepthIn > 0 ? `Snow ${report.snowDepthIn} in` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="mt-2 text-sm text-castiq-muted">{formatTimestamp(date)}</p>
        {report.accessPoints?.length > 0 && (
          <p className="mt-2 text-sm text-castiq-white">Access · {report.accessPoints.join(', ')}</p>
        )}
        {report.fishingConditions && <p className="mt-2 text-sm text-castiq-muted">{report.fishingConditions}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-castiq-muted">
          <span>Reporter rating · {report.safetyRating}</span>
          <span>· {report.verified ? 'Verified' : 'Unverified'}</span>
          <span>· {sourceLabel(report.submittedBy)}</span>
          <DataFreshnessBadge date={date} prefix="Reported" />
        </div>
      </AppCard>
    </li>
  );
}

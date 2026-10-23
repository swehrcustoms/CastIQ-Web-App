import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfidenceScore } from '../components/shared/ConfidenceScore';
import { SourceAttribution } from '../components/shared/SourceAttribution';
import { SPECIES_OPTIONS } from '../components/shared/SpeciesChips';
import { PageContainer, PageHeader } from '../components/ui/Chrome';
import { AppCard, DataFreshnessBadge, FilterChip } from '../components/ui/Data';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/ui/States';
import { usePageTitle } from '../hooks/usePageTitle';
import { usePublicReports } from '../hooks/usePublicReports';
import { formatTimestamp, hoursSince, toDate } from '../utils/dates';
import { redactNamedSpots } from '../utils/reportCopy';
import { reportNote } from '../utils/reportIdentity';
import { UpgradeCard } from '../components/subscription/UpgradeCard';
import { useReportAccess } from '../hooks/useReportAccess';
import { speciesLabel, speciesMatches } from '../utils/species';
import type { AnglerReport } from '../types/user';
import type { WithId } from '../types/common';

type WindowFilter = 'any' | '7d' | '30d';

export function Social() {
  const allowed = useReportAccess();
  const { reports, loading, loadingMore, hasMore, error, loadMore, reload } = usePublicReports();
  const [lake, setLake] = useState('');
  const [species, setSpecies] = useState('all');
  const [windowFilter, setWindowFilter] = useState<WindowFilter>('any');
  const [photosOnly, setPhotosOnly] = useState(false);
  usePageTitle('Community');

  const visible = useMemo(() => reports.filter((report) => {
    if (lake.trim() && !report.lakeName.toLowerCase().includes(lake.trim().toLowerCase())) return false;
    if (species !== 'all' && !(report.species ?? []).some((item) => speciesMatches(item, species))) return false;
    const hours = hoursSince(toDate(report.reportDate));
    if (windowFilter === '7d' && (hours == null || hours > 24 * 7)) return false;
    if (windowFilter === '30d' && (hours == null || hours > 24 * 30)) return false;
    if (photosOnly && !report.photoUrl) return false;
    return true;
  }), [lake, photosOnly, reports, species, windowFilter]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Community"
        title="What anglers are seeing"
        subtitle="Public report dates and species. Lure, depth, and structure open with Standard or Premium."
        actions={
          <Link to="/submit-report" className="ciq-btn-primary">
            Share Fishing Report
          </Link>
        }
      />

      <div className="mb-5 space-y-3">
        <label>
          <span className="sr-only">Filter by lake</span>
          <input className="ciq-input" value={lake} onChange={(event) => setLake(event.target.value)} placeholder="Filter by lake" />
        </label>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {SPECIES_OPTIONS.map((option) => (
            <FilterChip key={option.id} selected={species === option.id} onClick={() => setSpecies(option.id)}>
              {option.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <FilterChip selected={windowFilter === 'any'} onClick={() => setWindowFilter('any')}>All recent</FilterChip>
          <FilterChip selected={windowFilter === '7d'} onClick={() => setWindowFilter('7d')}>Last 7 days</FilterChip>
          <FilterChip selected={windowFilter === '30d'} onClick={() => setWindowFilter('30d')}>Last 30 days</FilterChip>
          <FilterChip selected={photosOnly} onClick={() => setPhotosOnly((value) => !value)}>Photo reports</FilterChip>
        </div>
      </div>

      {loading && <SkeletonGrid count={3} />}
      {error && <ErrorState title="We couldn't load current reports." onRetry={reload} />}
      {!loading && !error && visible.length === 0 && (
        <EmptyState
          title={reports.length === 0 ? 'No public reports yet.' : 'No reports match these filters.'}
          message={reports.length === 0
            ? 'When anglers share a public report, the useful details will show up here.'
            : 'Clear a filter or load another page of reports.'}
          action={<Link to="/submit-report" className="ciq-btn-primary">Share Fishing Report</Link>}
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((report) => (
            <ReportCard key={report.id} report={report} allowed={allowed} />
          ))}
        </ul>
      )}

      {!loading && !error && hasMore && (
        <div className="mt-4">
          <button type="button" className="ciq-btn-secondary" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? 'Loading…' : 'Load more reports'}
          </button>
        </div>
      )}
    </PageContainer>
  );
}

function ReportCard({ report, allowed }: { report: WithId<AnglerReport>; allowed: boolean }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const date = toDate(report.reportDate);
  const note = reportNote(report);
  const structure = redactNamedSpots(report.structureType ?? '');
  return (
    <li>
      <AppCard>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link to={`/lake/${report.lakeId}`} className="text-base font-semibold text-castiq-white hover:text-castiq-teal">
              {report.lakeName}
            </Link>
            <p className="text-xs text-castiq-muted">{formatTimestamp(date)}</p>
          </div>
          <DataFreshnessBadge date={date} prefix="Reported" />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(report.species ?? []).map((item) => (
            <span key={item} className="rounded-full bg-castiq-teal/15 px-2.5 py-0.5 text-xs font-medium text-castiq-teal">
              {speciesLabel(item)}
            </span>
          ))}
        </div>

        {allowed ? (
          <>
            {note && (
              <p className="mt-3 text-sm leading-relaxed text-castiq-white">{note}</p>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              {report.lures?.length > 0 && <Detail label="Lure" value={report.lures.join(', ')} />}
              {report.colors?.length > 0 && <Detail label="Color" value={report.colors.join(', ')} />}
              {report.depthFt != null && <Detail label="Depth" value={`${report.depthFt} ft`} />}
              {report.technique && <Detail label="Technique" value={report.technique} />}
              {structure && <Detail label="Structure" value={structure} />}
              {report.timeOfDay && <Detail label="Time" value={report.timeOfDay} />}
            </dl>
          </>
        ) : (
          <UpgradeCard
            title="Full report detail is included with Standard"
            detail="The date and species stay visible. Lure, depth, and structure open with Standard or Premium."
          />
        )}

        {report.photoUrl && !photoFailed && (
          <img
            src={report.photoUrl}
            alt={`Fishing report photo from ${report.lakeName}`}
            className="mt-3 max-h-72 w-full rounded-lg object-cover"
            onError={() => setPhotoFailed(true)}
          />
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <SourceAttribution
            sourceName={report.userSubmitted ? 'Angler report' : report.sourceId || 'Report'}
            type={report.userSubmitted ? 'user' : 'RSS'}
          />
          {typeof report.confidenceScore === 'number' && (
            <div className="w-36">
              <ConfidenceScore score={report.confidenceScore} size="sm" />
            </div>
          )}
        </div>
        {report.upvotes > 0 && (
          <p className="mt-2 text-xs text-castiq-muted">{report.upvotes} upvote{report.upvotes === 1 ? '' : 's'}</p>
        )}
      </AppCard>
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-castiq-muted">{label}</dt>
      <dd className="text-castiq-white">{value}</dd>
    </div>
  );
}

import { useState } from 'react';
import { SourceAttribution } from '../shared/SourceAttribution';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { formatReportAge } from '../../utils/reportRecencyColor';
import { redactNamedSpots } from '../../utils/reportCopy';
import { reportIdentity, reportNote } from '../../utils/reportIdentity';
import { UpgradeCard } from '../subscription/UpgradeCard';
import { useReportAccess } from '../../hooks/useReportAccess';
import type { AnglerReport } from '../../types/user';

interface Props {
  reports: AnglerReport[];
  loading: boolean;
  error: Error | null;
  mode?: 'list' | 'latest';
}

const PAGE = 10;

function ReportCard({ report, allowed }: { report: AnglerReport; allowed: boolean }) {
  const reportDate = report.reportDate
    ? (report.reportDate as unknown as { toDate?: () => Date }).toDate?.() ?? new Date()
    : new Date();

  return (
    <div className="rounded-lg bg-castiq-blue p-4 space-y-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(report.species ?? []).map((s) => (
            <span
              key={s}
              className="rounded-full bg-castiq-teal/20 px-2 py-0.5 text-xs font-medium text-castiq-teal capitalize"
            >
              {s.replace('_', ' ')}
            </span>
          ))}
        </div>
        <span className="shrink-0 text-xs text-castiq-muted">{formatReportAge(reportDate)}</span>
      </div>

      {/* Summary */}
      {allowed ? (
        <>
          {reportNote(report) && (
            <p className="text-sm text-castiq-white">{reportNote(report)}</p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-castiq-muted sm:grid-cols-3">
            {(report.lures ?? []).length > 0 && (
              <span>🎣 {report.lures.join(', ')}</span>
            )}
            {(report.colors ?? []).length > 0 && (
              <span>🎨 {report.colors.join(', ')}</span>
            )}
            {report.depthFt && <span>📏 {report.depthFt} ft</span>}
            {report.waterTempF && <span>🌡 {report.waterTempF}°F</span>}
            {report.technique && <span>⚡ {report.technique}</span>}
            {report.timeOfDay && <span>🕐 {report.timeOfDay}</span>}
          </div>
          {report.structureType && redactNamedSpots(report.structureType) && (
            <p className="text-xs text-castiq-muted italic">{redactNamedSpots(report.structureType)}</p>
          )}
        </>
      ) : (
        <UpgradeCard
          title="Full report detail is included with Standard"
          detail="The date and species stay visible. Lure, depth, and structure open with Standard or Premium."
        />
      )}

      {/* Source */}
      <SourceAttribution
        sourceName={report.sourceId ?? (report.userSubmitted ? 'Angler Report' : 'Unknown')}
        type={report.userSubmitted ? 'user' : 'RSS'}
      />
    </div>
  );
}

export function ReportFeed({ reports, loading, error, mode = 'list' }: Props) {
  const allowed = useReportAccess();
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const visible = mode === 'latest' ? reports.slice(0, 1) : reports.slice(0, visibleCount);
  const hasMore = visibleCount < reports.length;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-900/20 p-4 text-sm text-red-300">
        Failed to load reports. Reports will appear once data ingestion is active.
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-lg bg-castiq-blue p-6 text-center text-sm text-castiq-muted">
        No recent reports
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((r) => (
        <ReportCard key={reportIdentity(r)} report={r} allowed={allowed} />
      ))}
      {mode === 'list' && hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE)}
          className="w-full rounded-lg bg-castiq-blue py-3 text-sm font-medium text-castiq-teal hover:bg-castiq-blue/80"
        >
          Load more reports
        </button>
      )}
    </div>
  );
}

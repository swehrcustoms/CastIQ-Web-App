import { guideSeason, plansForSpecies, seasonLabel } from '../../data/baitSuggestions';
import { formatRelative, formatTimestamp, toDate } from '../../utils/dates';
import { comprehensiveWriteup, redactNamedSpots } from '../../utils/reportCopy';
import { consolidatedReports, reportNote } from '../../utils/reportIdentity';
import { speciesLabel } from '../../utils/species';
import { SourceAttribution } from '../shared/SourceAttribution';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { UpgradeCard } from '../subscription/UpgradeCard';
import { canSeeReportDetail } from '../../subscriptions/entitlements';
import { currentAccessTier } from '../../subscriptions/membership';
import type { AnglerReport } from '../../types/user';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-castiq-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-castiq-white">{value}</dd>
    </div>
  );
}

function noteAlreadyIncludes(note: string, value: string): boolean {
  const text = note.toLowerCase();
  const wanted = value.toLowerCase().trim();
  if (wanted.length < 4) return false;
  if (text.includes(wanted)) return true;
  const stem = wanted.replace(/ing\b/g, '').trim();
  return stem.length >= 4 && text.includes(stem);
}

function recordedFields(report: AnglerReport, note: string | null): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  if (report.waterTempF != null) fields.push({ label: 'Water temperature', value: `${report.waterTempF}°F` });
  const structure = redactNamedSpots(report.structureType?.trim() ?? '');
  if (structure) fields.push({ label: 'Structure', value: structure });
  if (report.depthFt != null) fields.push({ label: 'Target depth', value: `${report.depthFt} ft` });
  if (report.timeOfDay?.trim()) fields.push({ label: 'Time of day', value: report.timeOfDay });
  const technique = report.technique?.trim();
  if (technique && !(note && noteAlreadyIncludes(note, technique))) {
    fields.push({ label: 'Tactic', value: technique });
  }
  if (report.lures?.length) fields.push({ label: 'Lures', value: report.lures.join(', ') });
  if (report.colors?.length) fields.push({ label: 'Colors', value: report.colors.join(', ') });
  return fields;
}

function SpeciesReport({ species, report }: { species: string[]; report: AnglerReport }) {
  const reportDate = toDate(report.reportDate);
  const note = reportNote(report);
  const fields = recordedFields(report, note);
  const allowed = canSeeReportDetail(currentAccessTier(null));
  const title = species
    .filter((name) => name !== 'unspecified')
    .map((name) => speciesLabel(name))
    .join(', ') || 'Species not listed';

  return (
    <article className="rounded-lg bg-castiq-blue p-4">
      <h2 className="text-sm font-semibold text-castiq-white">{title}</h2>
      <p className="mt-1 text-xs text-castiq-muted">
        Latest report {formatRelative(reportDate)} · {formatTimestamp(reportDate)}
      </p>
      {allowed ? (
        <>
          {note && <p className="mt-3 text-sm text-castiq-white">{note}</p>}
          {fields.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fields.map((field) => (
                <Field key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
          )}
        </>
      ) : (
        <UpgradeCard
          title="Full report detail is included with Standard"
          detail="The date and species stay visible. Lure, depth, structure, and the written report open with Standard or Premium."
        />
      )}
      <div className="mt-3">
        <SourceAttribution
          sourceName={report.sourceId ?? (report.userSubmitted ? 'Angler report' : 'Unknown')}
          type={report.userSubmitted ? 'user' : 'RSS'}
        />
      </div>
    </article>
  );
}

export function LakeOverview({
  species,
  speciesPresent,
  reports,
  loading,
  error,
}: {
  species: string;
  speciesPresent: string[];
  reports: AnglerReport[];
  loading: boolean;
  error: Error | null;
}) {
  const latest = consolidatedReports(reports);
  const season = guideSeason();
  const plans = plansForSpecies(speciesPresent, season, species);
  const allowed = canSeeReportDetail(currentAccessTier(null));
  const writeups = allowed
    ? latest
        .map((item) => comprehensiveWriteup(item.report, item.species, reportNote(item.report)))
        .filter((paragraph): paragraph is string => Boolean(paragraph))
    : [];

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex justify-center rounded-lg bg-castiq-blue py-6">
          <LoadingSpinner />
        </div>
      )}
      {!loading && error && (
        <p className="rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-muted">
          Reports could not be loaded. Refresh the page to try again.
        </p>
      )}
      {!loading && !error && latest.length === 0 && (
        <p className="rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-muted">
          {species === 'all'
            ? 'No public report has been logged for this lake yet.'
            : `No public report has been logged for ${speciesLabel(species).toLowerCase()} on this lake yet.`}
        </p>
      )}
      {!loading && !error && latest.map((item) => (
        <SpeciesReport key={`${item.species.join('-')}-${item.report.reportId}`} species={item.species} report={item.report} />
      ))}
      {!loading && !error && writeups.length > 0 && (
        <section className="rounded-lg bg-castiq-blue p-4">
          <h2 className="text-sm font-semibold text-castiq-white">Comprehensive report</h2>
          <div className="mt-2 space-y-3">
            {writeups.map((paragraph, index) => (
              <p key={index} className="text-sm leading-relaxed text-castiq-white">{paragraph}</p>
            ))}
          </div>
        </section>
      )}
      {!loading && plans.length > 0 && (
        <section className="rounded-lg bg-castiq-blue p-4">
          <h2 className="text-sm font-semibold text-castiq-white">Tactics</h2>
          {allowed ? (
            <>
          <p className="mt-1 text-xs text-castiq-muted">
            {seasonLabel(season)} top 3 for {species === 'all' ? 'the species on this lake' : speciesLabel(species).toLowerCase()}. Same list as the Tactics page.
          </p>
          <div className="mt-4 space-y-4">
            {plans.map((plan) => (
              <div key={plan.id}>
                <h3 className="text-sm font-semibold text-castiq-teal">{plan.label}</h3>
                {plan.note && <p className="mt-1 text-xs text-castiq-muted">{plan.note}</p>}
                <ol className="mt-2 space-y-1.5">
                  {plan.baits.map((bait, index) => (
                    <li key={bait.lure} className="text-sm text-castiq-white">
                      <span className="mr-2 text-xs text-castiq-muted">{index + 1}</span>
                      {bait.lure}
                      <span className="mt-0.5 block pl-5 text-xs text-castiq-muted">{bait.detail}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
            </>
          ) : (
            <UpgradeCard
              title="Seasonal tactics are included with Standard"
              detail="The species list stays visible. The top presentations for this lake open with Standard or Premium."
            />
          )}
        </section>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer, PageHeader } from '../components/ui/Chrome';
import { AppCard, FilterChip } from '../components/ui/Data';
import { EmptyState } from '../components/ui/States';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { SpeciesChips } from '../components/shared/SpeciesChips';
import { useLakeSearch } from '../hooks/useLakeSearch';
import { usePageTitle } from '../hooks/usePageTitle';
import { lakePlaceLabel } from '../services/dnrLakeSearch';
import { guideSeason, plansForSpecies, seasonLabel, speciesMatchesBait } from '../data/baitSuggestions';
import { UpgradeCard } from '../components/subscription/UpgradeCard';
import { useReportAccess } from '../hooks/useReportAccess';
import type { Lake } from '../types/lake';
import type { WithId } from '../types/common';

type AreaId = 'all' | 'north' | 'central' | 'metro' | 'south';

const AREAS: { id: AreaId; label: string }[] = [
  { id: 'all', label: 'All areas' },
  { id: 'north', label: 'North' },
  { id: 'central', label: 'Central' },
  { id: 'metro', label: 'Metro' },
  { id: 'south', label: 'South' },
];

function areaOf(lat: number): AreaId {
  if (!Number.isFinite(lat) || lat === 0) return 'all';
  if (lat >= 47.2) return 'north';
  if (lat >= 45.6) return 'central';
  if (lat >= 44.6) return 'metro';
  return 'south';
}

function lakeMatchesQuery(lake: WithId<Lake>, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const species = (lake.speciesPresent ?? []).join(' ');
  const haystack = `${lake.name} ${lake.county ?? ''} ${lake.nearestTown ?? ''} ${species}`.toLowerCase();
  return haystack.includes(needle);
}

function GuideLakeCard({ lake, species, season, allowed }: { lake: WithId<Lake>; species: string; season: ReturnType<typeof guideSeason>; allowed: boolean }) {
  const plans = plansForSpecies(lake.speciesPresent ?? [], season, species);
  return (
    <li>
      <AppCard className="h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-castiq-white">{lake.name}</h2>
            <p className="mt-1 text-xs text-castiq-muted">
              {lakePlaceLabel(lake)}
              {lake.acreage ? ` · ${Math.round(lake.acreage).toLocaleString()} ac` : ''}
            </p>
          </div>
          <Link to={`/lake/${lake.id}`} className="shrink-0 text-xs text-castiq-teal hover:underline">
            Open lake
          </Link>
        </div>

        {plans.length === 0 ? (
          <p className="mt-3 text-sm text-castiq-muted">
            No species list is on file for this water yet, so there isn’t a bait list to show.
          </p>
        ) : !allowed ? (
          <UpgradeCard
            title="Seasonal tactics are included with Standard"
            detail="Lake names stay visible. The lure list for this water opens with Standard or Premium."
          />
        ) : (
          <div className="mt-4 space-y-4">
            {plans.map((plan) => (
              <section key={plan.id}>
                <h3 className="text-sm font-semibold text-castiq-teal">{plan.label}</h3>
                {plan.note && <p className="mt-1 text-xs text-castiq-muted">{plan.note}</p>}
                {plan.baits.length > 0 && (
                  <ol className="mt-2 space-y-1.5">
                    {plan.baits.map((bait, index) => (
                      <li key={bait.lure} className="text-sm text-castiq-white">
                        <span className="mr-2 text-xs text-castiq-muted">{index + 1}</span>
                        {bait.lure}
                        <span className="mt-0.5 block pl-5 text-xs text-castiq-muted">{bait.detail}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        )}
      </AppCard>
    </li>
  );
}

export function Guides() {
  const allowed = useReportAccess();
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('all');
  const [area, setArea] = useState<AreaId>('all');
  const season = guideSeason();
  usePageTitle('Tactics');

  const featured = useLakeSearch('', {}, 20);
  const searched = useLakeSearch(query, {}, 12);

  const lakes = useMemo(() => {
    const trimmed = query.trim();
    const pool = trimmed
      ? [...searched.results, ...featured.results.filter((lake) => lakeMatchesQuery(lake, trimmed))]
      : featured.results;
    const seen = new Set<string>();
    return pool.filter((lake) => {
      if (seen.has(lake.id)) return false;
      seen.add(lake.id);
      if (area !== 'all' && areaOf(lake.lat) !== area) return false;
      if (species !== 'all' && !(lake.speciesPresent ?? []).some((item) => speciesMatchesBait(item, species))) return false;
      return true;
    });
  }, [query, searched.results, featured.results, area, species]);

  const loading = query.trim() ? searched.loading || featured.loading : featured.loading;

  return (
    <>
      <PageContainer>
        <PageHeader
          eyebrow="Tactics"
          title="Bait suggestions for Minnesota lakes"
          subtitle={`Seasonal tackle notes, not a guide booking service. The top lakes are listed first. Each one includes a ${seasonLabel(season).toLowerCase()} bait list for the species on that water.`}
        />

        <label>
          <span className="sr-only">Search lakes</span>
          <input
            className="ciq-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a lake, county, or town"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {AREAS.map((option) => (
            <FilterChip key={option.id} selected={area === option.id} onClick={() => setArea(option.id)}>
              {option.label}
            </FilterChip>
          ))}
        </div>

        <div className="mt-3">
          <SpeciesChips selected={species} onChange={setSpecies} />
        </div>

        <p className="mt-4 text-xs text-castiq-muted">
          {loading
            ? 'Finding lakes…'
            : query.trim()
              ? `${lakes.length} lake${lakes.length === 1 ? '' : 's'} with ${seasonLabel(season).toLowerCase()} bait lists`
              : lakes.length > 0
                ? `Top Minnesota lakes · ${seasonLabel(season)} bait lists`
                : 'No lakes loaded yet'}
        </p>

        <div className="mt-4">
          {loading && lakes.length === 0 ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : lakes.length === 0 ? (
            <EmptyState
              title="No lakes match that search."
              message="Try a lake name, a county, or another area. Bait lists appear for each species on the lakes that match."
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {lakes.map((lake) => (
                <GuideLakeCard key={lake.id} lake={lake} species={species} season={season} allowed={allowed} />
              ))}
            </ul>
          )}
        </div>
      </PageContainer>
    </>
  );
}

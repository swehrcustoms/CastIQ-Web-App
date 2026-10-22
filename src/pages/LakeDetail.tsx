import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { fetchDnrLake } from '../services/dnrLakeSearch';
import { db } from '../services/firebase';
import { FavoriteButton } from '../components/lake/FavoriteButton';
import { LakeHeader } from '../components/lake/LakeHeader';
import { LakeOverview } from '../components/lake/LakeOverview';
import { LakeTabNav, isLakeTab, type LakeTab } from '../components/lake/LakeTabNav';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { SpeciesChips } from '../components/shared/SpeciesChips';
import { SurveysStockingPanel } from '../components/lake/SurveysStockingPanel';
import { useLakeReports } from '../hooks/useLakeReports';
import { chipsForLake, speciesMatches } from '../utils/species';
import type { Lake } from '../types/lake';
import type { WithId } from '../types/common';

export function LakeDetail() {
  const { lakeId } = useParams<{ lakeId: string }>();
  const navigate = useNavigate();
  const [lake, setLake] = useState<WithId<Lake> | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: LakeTab = isLakeTab(tabParam) ? tabParam : 'overview';
  const [selectedSpecies, setSelectedSpecies] = useState('all');
  const [dnrSpecies, setDnrSpecies] = useState<string[] | null>(null);
  const speciesForPage = dnrSpecies ?? lake?.speciesPresent;
  const lakeChips = chipsForLake(speciesForPage);
  const { reports, loading: reportsLoading, error: reportsError } = useLakeReports(lakeId);
  const visibleReports = selectedSpecies === 'all'
    ? reports
    : reports.filter((report) => (report.species ?? []).some((species) => speciesMatches(species, selectedSpecies)));

  useEffect(() => {
    if (!lakeId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getDoc(doc(db, 'lakes', lakeId))
      .then(async (snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          setLake({ id: snap.id, ...snap.data() } as WithId<Lake>);
          return;
        }
        const fromCatalog = await fetchDnrLake(lakeId);
        if (!cancelled) setLake(fromCatalog);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lakeId]);

  useEffect(() => {
    if (!lakeId) return;
    let cancelled = false;
    setDnrSpecies(null);
    fetchDnrLake(lakeId)
      .then((fromDnr) => {
        if (cancelled || !fromDnr || fromDnr.dnrLakeNumber !== lakeId) return;
        if (fromDnr.speciesPresent.length > 0) setDnrSpecies(fromDnr.speciesPresent);
      })
      .catch(() => {
        /* The saved lake list stays in place when DNR species cannot be loaded. */
      });
    return () => {
      cancelled = true;
    };
  }, [lakeId]);

  useEffect(() => {
    if (!lakeChips.some((chip) => chip.id === selectedSpecies)) setSelectedSpecies('all');
  }, [lakeChips, selectedSpecies]);

  function selectTab(tab: LakeTab) {
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-castiq-white">We couldn't load this lake.</p>
        <button type="button" onClick={() => window.location.reload()} className="ciq-btn-primary">
          Try again
        </button>
      </div>
    );
  }

  if (!lake) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-castiq-white">Lake not found</p>
        <button type="button" onClick={() => navigate('/search')} className="text-sm text-castiq-teal">
          ← Back to search
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Back nav */}
      <div className="flex items-center gap-3 border-b border-castiq-blue px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-castiq-muted hover:text-castiq-white"
        >
          ← Back
        </button>
        <span className="text-castiq-muted">/</span>
        <span className="text-sm text-castiq-muted truncate">{lake.name}</span>
      </div>

      <div>
        <div className="flex items-start justify-between gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <LakeHeader lake={{ ...lake, speciesPresent: speciesForPage ?? [] }} />
          </div>
          <FavoriteButton lakeId={lake.id} />
        </div>

        <div className="px-4">
          <LakeTabNav active={activeTab} onSelect={selectTab} />
        </div>

        <div className="px-4 py-4">
          {activeTab === 'overview' && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <SpeciesChips selected={selectedSpecies} onChange={setSelectedSpecies} options={lakeChips} />
                <LakeOverview
                  species={selectedSpecies}
                  speciesPresent={speciesForPage ?? []}
                  reports={visibleReports}
                  loading={reportsLoading}
                  error={reportsError}
                />
              </div>
            </div>
          )}

          {activeTab === 'surveys' && (
            <div className="space-y-3">
              <p className="text-xs text-castiq-muted">
                Agency survey and stocking records are historical. They are not a current bite report.
              </p>
              <SurveysStockingPanel lakeId={lake.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

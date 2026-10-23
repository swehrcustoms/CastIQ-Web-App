import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer, PageHeader, SectionHeader } from '../components/ui/Chrome';
import { AppCard, FilterChip } from '../components/ui/Data';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/States';
import { useAuth } from '../hooks/useAuth';
import { useFavoriteLakes } from '../hooks/useFavoriteLakes';
import { usePageTitle } from '../hooks/usePageTitle';
import { useUserReports } from '../hooks/useUserReports';
import { saveAlertPreferences, saveDisplayName, setFavoriteLake } from '../services/userProfile';
import { signOutUser } from '../services/auth';
import { formatRelative, toDate } from '../utils/dates';
import { speciesLabel } from '../utils/species';
import { planName, tierForViewer } from '../subscriptions/staffAccess';
import { SPECIES_OPTIONS } from '../components/shared/SpeciesChips';
import type { CastIQUser } from '../types/user';

export function Profile() {
  const { user, profile, loading } = useAuth();
  usePageTitle('Profile');

  if (loading) {
    return (
      <PageContainer>
        <SkeletonCard lines={5} />
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow="Account"
          title="Profile"
          subtitle="Sign in to update your name, saved lakes, and notification choices."
        />
        <Link to="/login" state={{ from: '/profile' }} className="ciq-btn-primary">
          Sign in
        </Link>
      </PageContainer>
    );
  }

  const name = profile?.displayName || user.displayName || 'Angler';
  const initial = name.charAt(0).toUpperCase();
  const tier = tierForViewer(user.email);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Account"
        title={name}
        subtitle={profile?.role ? `${profile.role} account` : 'Angler account'}
      />

      <div className="space-y-8">
        <section className="ciq-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-castiq-teal/40" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-castiq-blue-dark text-xl font-bold text-castiq-teal">
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <NameEditor current={name} />
            <p className="mt-2 text-sm text-castiq-muted">{user.email}</p>
            <p className="mt-1 text-sm text-castiq-white">Current plan: {planName(tier)}</p>
            <p className="text-xs text-castiq-muted">
              {tier === 'premium'
                ? 'Every finished report, tactic, and lake detail is open on this account.'
                : tier === 'standard'
                  ? 'Fishing reports, lures, depth, structure, and seasonal tactics are open on this account.'
                  : 'Lure, depth, structure, the written report, and seasonal tactics are Standard and Premium.'}
            </p>
          </div>
        </section>

        <Favorites ids={profile?.favoriteLakeIds ?? []} uid={user.uid} />
        <Alerts prefs={profile?.alertPreferences} uid={user.uid} />
        <Reports uid={user.uid} />

        {(profile?.guidePortalAccess || profile?.role === 'guide' || profile?.role === 'admin') && (
          <section>
            <SectionHeader title="Guide access" />
            <AppCard>
              <p className="text-sm text-castiq-muted">This account can open the guide tools for assigned waters.</p>
              <Link to="/guide" className="ciq-btn-primary mt-3">Open Guide Portal</Link>
            </AppCard>
          </section>
        )}

        <section className="border-t border-white/10 pt-6">
          <button type="button" onClick={() => void signOutUser()} className="text-sm text-castiq-muted hover:text-castiq-white">
            Sign out
          </button>
        </section>
      </div>
    </PageContainer>
  );
}

function NameEditor({ current }: { current: string }) {
  const { user } = useAuth();
  const [name, setName] = useState(current);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!user || name.trim() === current) return;
    setBusy(true);
    setStatus(null);
    try {
      await saveDisplayName(user, name);
      setStatus('Name saved.');
    } catch (err) {
      console.error(err);
      setStatus('We couldn’t save your name.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">Display name</span>
        <input className="ciq-input" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <button type="submit" className="ciq-btn-secondary" disabled={busy || name.trim() === current}>
        Save name
      </button>
      {status && <p className="text-xs text-castiq-muted sm:self-center">{status}</p>}
    </form>
  );
}

function Favorites({ ids, uid }: { ids: string[]; uid: string }) {
  const { data, loading, error, reload } = useFavoriteLakes(ids);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(lakeId: string) {
    setBusyId(lakeId);
    try {
      await setFavoriteLake(uid, lakeId, false);
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <SectionHeader title="Favorite lakes" />
      {loading && <SkeletonCard />}
      {error && <ErrorState title="We couldn't load your saved lakes." onRetry={reload} />}
      {!loading && !error && ids.length === 0 && (
        <EmptyState
          title="No favorite lakes yet."
          message="Open a lake from Search and choose Favorite. It will stay here."
          action={<Link to="/search" className="ciq-btn-primary">Search lakes</Link>}
        />
      )}
      {!loading && !error && ids.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ids.map((id) => {
            const lake = data.find((item) => item.id === id);
            return (
              <li key={id} className="ciq-card flex items-center justify-between gap-3 p-4">
                <div>
                  <Link to={`/lake/${id}`} className="font-medium text-castiq-white hover:text-castiq-teal">
                    {lake?.name ?? 'Saved lake'}
                  </Link>
                  {lake?.county && <p className="text-xs text-castiq-muted">{lake.county} County</p>}
                </div>
                <button
                  type="button"
                  className="text-sm text-castiq-muted hover:text-castiq-white"
                  disabled={busyId === id}
                  onClick={() => void remove(id)}
                >
                  Unfavorite
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Alerts({ prefs, uid }: { prefs: CastIQUser['alertPreferences'] | undefined; uid: string }) {
  const current = prefs ?? { species: [], reportRecency: true, winterkillAlerts: true, iceReports: true };
  const [status, setStatus] = useState<string | null>(null);

  async function update(next: CastIQUser['alertPreferences']) {
    setStatus(null);
    try {
      await saveAlertPreferences(uid, next);
      setStatus('Preferences saved.');
    } catch (err) {
      console.error(err);
      setStatus('We couldn’t save those preferences.');
    }
  }

  function toggleSpecies(id: string) {
    const species = current.species.includes(id)
      ? current.species.filter((item) => item !== id)
      : [...current.species, id];
    void update({ ...current, species });
  }

  return (
    <section>
      <SectionHeader title="Alert preferences" />
      <AppCard className="space-y-4">
        <div>
          <p className="text-sm text-castiq-white">Species</p>
          <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {SPECIES_OPTIONS.filter((option) => option.id !== 'all').map((option) => (
              <FilterChip
                key={option.id}
                selected={current.species.includes(option.id)}
                onClick={() => toggleSpecies(option.id)}
              >
                {option.label}
              </FilterChip>
            ))}
          </div>
        </div>
        <p className="text-xs text-castiq-muted">
          A report-freshness alert would be sent only for a lake you saved, and only when a new public fishing report is saved for that lake. CastIQ does not send alerts yet. These choices are saved for that later step.
        </p>
        <Toggle
          label="Report freshness"
          checked={current.reportRecency}
          onChange={(checked) => void update({ ...current, reportRecency: checked })}
        />
        <Toggle
          label="Winterkill alerts"
          checked={current.winterkillAlerts}
          onChange={(checked) => void update({ ...current, winterkillAlerts: checked })}
        />
        <Toggle
          label="Ice reports"
          checked={current.iceReports}
          onChange={(checked) => void update({ ...current, iceReports: checked })}
        />
        {status && <p className="text-xs text-castiq-muted">{status}</p>}
      </AppCard>
    </section>
  );
}

function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm text-castiq-white">
      {label}
      <input
        type="checkbox"
        className="h-4 w-4 accent-castiq-teal"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function Reports({ uid }: { uid: string }) {
  const { data, loading, error, reload } = useUserReports(uid);
  return (
    <section>
      <SectionHeader title="My reports" action={<Link to="/submit-report" className="text-sm text-castiq-teal">Share a report</Link>} />
      {loading && <SkeletonCard />}
      {error && <ErrorState title="We couldn't load your reports." onRetry={reload} />}
      {!loading && !error && data.length === 0 && (
        <EmptyState title="You haven't shared a fishing report yet." message="A report you submit stays tied to your account, including private ones." />
      )}
      {!loading && !error && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((report) => (
            <li key={report.id} className="ciq-card px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/lake/${report.lakeId}`} className="font-medium text-castiq-white hover:text-castiq-teal">
                  {report.lakeName}
                </Link>
                <span className="text-xs text-castiq-muted">{formatRelative(toDate(report.reportDate))}</span>
              </div>
              <p className="mt-1 text-sm text-castiq-muted">
                {(report.species ?? []).map(speciesLabel).join(', ') || 'Species not listed'}
                {report.isPublic ? '' : ' · Private'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

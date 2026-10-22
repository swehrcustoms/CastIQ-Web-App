import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { storage } from '../services/firebase';
import { Collections } from '../services/firestore';
import { useAuth } from '../hooks/useAuth';
import { useLakeSearch } from '../hooks/useLakeSearch';
import { lakePlaceLabel } from '../services/dnrLakeSearch';
import { redactNamedSpots } from '../utils/reportCopy';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { SPECIES_OPTIONS } from '../components/shared/SpeciesChips';
import type { Lake } from '../types/lake';
import type { WithId } from '../types/common';

type TimeOfDay =
  | 'early morning'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'all day';

const TIME_OPTIONS: TimeOfDay[] = [
  'early morning',
  'morning',
  'afternoon',
  'evening',
  'night',
  'all day',
];

const SPECIES_SUBMIT = SPECIES_OPTIONS.filter((s) => s.id !== 'all');

export function SubmitReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselectLakeId = params.get('lakeId');

  const [lakeQuery, setLakeQuery] = useState('');
  const [selectedLake, setSelectedLake] = useState<WithId<Lake> | null>(null);
  const [tierLakes, setTierLakes] = useState<WithId<Lake>[]>([]);
  const { results: searchResults, loading: searchLoading } = useLakeSearch(
    lakeQuery,
    {},
    8
  );

  const [species, setSpecies] = useState<string[]>(['walleye']);
  const [lures, setLures] = useState('');
  const [colors, setColors] = useState('');
  const [depthFt, setDepthFt] = useState('');
  const [waterTempF, setWaterTempF] = useState('');
  const [conditions, setConditions] = useState('');
  const [technique, setTechnique] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');
  const [structureType, setStructureType] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDocs(query(Collections.lakes, orderBy('name'), limit(12)))
      .then((snap) => {
        const lakes = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as WithId<Lake>)
        );
        setTierLakes(lakes);
        if (preselectLakeId) {
          const found = lakes.find((l) => l.id === preselectLakeId);
          if (found) setSelectedLake(found);
        }
      })
      .catch(() => undefined);
  }, [preselectLakeId]);

  useEffect(() => {
    if (!preselectLakeId || selectedLake) return;
    // If preselected lake wasn't in the first page, try search list once available
    const found = searchResults.find((l) => l.id === preselectLakeId);
    if (found) setSelectedLake(found);
  }, [preselectLakeId, searchResults, selectedLake]);

  const lakeChoices = useMemo(() => {
    if (lakeQuery.trim().length > 0) return searchResults;
    return tierLakes;
  }, [lakeQuery, searchResults, tierLakes]);

  function toggleSpecies(id: string) {
    setSpecies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be signed in to submit a report.');
      return;
    }
    if (!selectedLake) {
      setError('Select a lake for this report.');
      return;
    }
    if (species.length === 0) {
      setError('Select at least one species.');
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        const ext = photo.name.split('.').pop() || 'jpg';
        const path = `users/${user.uid}/reports/${Date.now()}.${ext}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, photo, { contentType: photo.type });
        photoUrl = await getDownloadURL(storageRef);
      }

      const reportRef = doc(Collections.anglerReports);
      const now = serverTimestamp();
      await setDoc(reportRef, {
        reportId: reportRef.id,
        lakeId: selectedLake.id,
        lakeName: selectedLake.name,
        sourceId: null,
        userId: user.uid,
        reportDate: now,
        species,
        lures: lures
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        colors: colors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        depthFt: depthFt ? Number(depthFt) : null,
        waterTempF: waterTempF ? Number(waterTempF) : null,
        conditions: redactNamedSpots(conditions.trim()),
        technique: technique.trim(),
        timeOfDay,
        aiSummary: '',
        userSubmitted: true,
        isPublic,
        verified: false,
        upvotes: 0,
        photoUrl,
        rawText: redactNamedSpots(conditions.trim()),
        confidenceScore: 0,
        structureType: redactNamedSpots(structureType.trim()) || null,
        createdAt: now,
        updatedAt: now,
      });

      navigate(`/lake/${selectedLake.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-28">
      <h1 className="text-xl font-bold text-castiq-white">Submit fishing report</h1>
      <p className="mt-1 text-sm text-castiq-muted">
        Share what worked — helps Live Intel and other anglers.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        {/* Lake picker */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-castiq-muted">Lake</legend>
          <input
            type="search"
            value={lakeQuery}
            onChange={(e) => setLakeQuery(e.target.value)}
            placeholder="Search lakes…"
            className="w-full rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-white outline-none ring-1 ring-castiq-blue focus:ring-castiq-teal"
          />
          {selectedLake && (
            <p className="text-sm text-castiq-teal">
              Selected: <strong>{selectedLake.name}</strong>
              <button
                type="button"
                className="ml-2 text-castiq-muted hover:text-castiq-white"
                onClick={() => setSelectedLake(null)}
              >
                Clear
              </button>
            </p>
          )}
          <div className="max-h-40 overflow-y-auto rounded-lg border border-castiq-blue divide-y divide-castiq-blue">
            {searchLoading && lakeQuery && (
              <div className="flex justify-center py-3">
                <LoadingSpinner size="sm" />
              </div>
            )}
            {lakeChoices.map((lake) => (
              <button
                key={lake.id}
                type="button"
                onClick={() => {
                  setSelectedLake(lake);
                  setLakeQuery('');
                }}
                className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-castiq-blue ${
                  selectedLake?.id === lake.id
                    ? 'bg-castiq-teal/10 text-castiq-teal'
                    : 'text-castiq-white'
                }`}
              >
                {lake.name}
                <span className="ml-2 text-xs text-castiq-muted">{lakePlaceLabel(lake)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Species */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-castiq-muted">Species</legend>
          <div className="flex flex-wrap gap-2">
            {SPECIES_SUBMIT.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSpecies(s.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  species.includes(s.id)
                    ? 'bg-castiq-teal text-castiq-blue-dark'
                    : 'bg-castiq-blue text-castiq-muted'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-castiq-muted">
            Lures / bait (comma-separated)
          </span>
          <input
            value={lures}
            onChange={(e) => setLures(e.target.value)}
            placeholder="Jig, crawler harness"
            className="w-full rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-white outline-none ring-1 ring-castiq-blue focus:ring-castiq-teal"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-castiq-muted">
            Colors (comma-separated)
          </span>
          <input
            value={colors}
            onChange={(e) => setColors(e.target.value)}
            placeholder="Chartreuse, gold"
            className="w-full rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-white outline-none ring-1 ring-castiq-blue focus:ring-castiq-teal"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-castiq-muted">Depth (ft)</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={depthFt}
              onChange={(e) => setDepthFt(e.target.value)}
              className="w-full rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-white outline-none ring-1 ring-castiq-blue focus:ring-castiq-teal"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-castiq-muted">Water temp (°F)</span>
            <input
              type="number"
              value={waterTempF}
              onChange={(e) => setWaterTempF(e.target.value)}
              className="w-full rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-white outline-none ring-1 ring-castiq-blue focus:ring-castiq-teal"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-castiq-muted">Conditions</span>
          <textarea
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Wind, cloud cover, bite timing, structure, and depth"
            className="w-full rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-white outline-none ring-1 ring-castiq-blue focus:ring-castiq-teal"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-castiq-muted">Technique</span>
          <input
            value={technique}
            onChange={(e) => setTechnique(e.target.value)}
            placeholder="Slow troll, slip bobber…"
            className="w-full rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-white outline-none ring-1 ring-castiq-blue focus:ring-castiq-teal"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-castiq-muted">Time of day</span>
          <select
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay)}
            className="w-full rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-white outline-none ring-1 ring-castiq-blue focus:ring-castiq-teal"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-castiq-muted">
            Structure (optional)
          </span>
          <input
            value={structureType}
            onChange={(e) => setStructureType(e.target.value)}
            placeholder="Weedline, hump, break…"
            className="w-full rounded-lg bg-castiq-blue px-4 py-3 text-sm text-castiq-white outline-none ring-1 ring-castiq-blue focus:ring-castiq-teal"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-castiq-muted">Photo (optional)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-castiq-muted file:mr-3 file:rounded-lg file:border-0 file:bg-castiq-teal file:px-3 file:py-2 file:text-xs file:font-semibold file:text-castiq-blue-dark"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-castiq-muted">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded border-castiq-blue"
          />
          Make this report public
        </label>

        {error && (
          <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-castiq-teal py-3 text-sm font-semibold text-castiq-blue-dark disabled:opacity-50"
        >
          {submitting ? <LoadingSpinner size="sm" /> : null}
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </div>
  );
}

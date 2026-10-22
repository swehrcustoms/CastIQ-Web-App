import assert from 'node:assert/strict';
import test from 'node:test';
import { chipsForLake, speciesShownForLake } from '../src/utils/species';
import { pickRegulationHit } from '../src/services/dnrLakeSearch';
import { compareLakesByLatestReport, compareSearchLakes, recencyFromReports } from '../src/utils/lakeSort';
import { comprehensiveWriteup, redactNamedSpots } from '../src/utils/reportCopy';
import { consolidatedReports, latestReportsBySpecies, reportNote, uniqueReports } from '../src/utils/reportIdentity';
import {
  annualPricePerMonth,
  monthlyYearTotal,
  PLAN_PRICES,
  PLANS,
  PREMIUM_BULLETS,
  PRICING_DISCLAIMER,
  PRICING_HERO,
  STANDARD_BULLETS,
  priceFor,
  tierHasEntitlement,
} from '../src/data/pricing';
import type { AnglerReport } from '../src/types/user';
import type { Lake } from '../src/types/lake';

function lake(partial: Pick<Lake, 'name' | 'lastReportDate'> & { id: string }): Pick<Lake, 'name' | 'lastReportDate'> & { id: string } {
  return partial;
}

test('search sort uses newest report date and puts lakes without reports last', () => {
  const older = lake({ id: 'a', name: 'Cedar', lastReportDate: { seconds: 100, toDate: () => new Date(100_000) } });
  const newer = lake({ id: 'b', name: 'Leech', lastReportDate: { seconds: 500, toDate: () => new Date(500_000) } });
  const none = lake({ id: 'c', name: 'Ada', lastReportDate: null });
  const ranked = [older, none, newer].sort(compareLakesByLatestReport);
  assert.deepEqual(ranked.map((item) => item.name), ['Leech', 'Cedar', 'Ada']);
});

test('search results put the newest report first and keep a closer name when dates match', () => {
  const now = Date.UTC(2026, 9, 14);
  const older = { seconds: Math.floor(Date.UTC(2026, 7, 1) / 1000), toDate: () => new Date(Date.UTC(2026, 7, 1)) };
  const newer = { seconds: Math.floor(Date.UTC(2026, 9, 13) / 1000), toDate: () => new Date(Date.UTC(2026, 9, 13)) };
  const ranked = [
    { id: 'old', name: 'Mille Lacs', lastReportDate: older, matchScore: 0 },
    { id: 'new', name: 'Minnetonka', lastReportDate: newer, matchScore: 2 },
    { id: 'none', name: 'Ada', lastReportDate: null, matchScore: 0 },
  ].sort(compareSearchLakes);
  assert.deepEqual(ranked.map((item) => item.name), ['Minnetonka', 'Mille Lacs', 'Ada']);

  const sameDay = [
    { id: 'weak', name: 'Lake Minnie', lastReportDate: newer, matchScore: 4 },
    { id: 'exact', name: 'Minnetonka', lastReportDate: newer, matchScore: 0 },
  ].sort(compareSearchLakes);
  assert.equal(sameDay[0].name, 'Minnetonka');

  const live = recencyFromReports(
    [{ reportDate: newer }, { reportDate: older }],
    now,
  );
  assert.equal(live.reportCount7d, 1);
  assert.equal(live.lastReportDate, newer);
});

test('equal report dates tie-break by lake name', () => {
  const stamp = { seconds: 10, toDate: () => new Date(10_000) };
  const ranked = [
    lake({ id: '2', name: 'Zebra', lastReportDate: stamp }),
    lake({ id: '1', name: 'Alpha', lastReportDate: stamp }),
  ].sort(compareLakesByLatestReport);
  assert.equal(ranked[0].name, 'Alpha');
});

test('identical report content is shown once', () => {
  const shared = {
    lakeId: 'low',
    lakeName: 'Lake of the Woods',
    sourceId: 'seed_demo',
    userId: null,
    reportDate: { seconds: 20, toDate: () => new Date(20_000) },
    species: ['walleye'],
    lures: ['jig'],
    colors: ['chartreuse'],
    depthFt: 12,
    waterTempF: 55,
    conditions: 'clear',
    technique: 'jigging',
    timeOfDay: 'morning' as const,
    aiSummary: 'Walleye on the jig',
    userSubmitted: false,
    isPublic: true,
    verified: false,
    upvotes: 0,
    photoUrl: null,
    rawText: 'same',
    confidenceScore: 0,
    structureType: 'reef',
    createdAt: { seconds: 1, toDate: () => new Date(1000) },
    updatedAt: { seconds: 1, toDate: () => new Date(1000) },
  };
  const reports = uniqueReports([
    { ...shared, reportId: 'doc-a' },
    { ...shared, reportId: 'doc-b' },
  ] as AnglerReport[]);
  assert.equal(reports.length, 1);
});

test('different reports stay separate', () => {
  const base = {
    lakeId: 'low',
    lakeName: 'Lake of the Woods',
    sourceId: 'rss',
    userId: null,
    species: ['walleye'],
    lures: ['jig'],
    colors: [],
    depthFt: 10,
    waterTempF: null,
    conditions: '',
    technique: '',
    timeOfDay: 'morning' as const,
    userSubmitted: false,
    isPublic: true,
    verified: false,
    upvotes: 0,
    photoUrl: null,
    rawText: '',
    confidenceScore: 0,
    structureType: null,
    createdAt: { seconds: 1, toDate: () => new Date(1000) },
    updatedAt: { seconds: 1, toDate: () => new Date(1000) },
  };
  const reports = uniqueReports([
    { ...base, reportId: '1', aiSummary: 'Morning', reportDate: { seconds: 10, toDate: () => new Date(10_000) } },
    { ...base, reportId: '2', aiSummary: 'Evening', reportDate: { seconds: 20, toDate: () => new Date(20_000) } },
  ] as AnglerReport[]);
  assert.equal(reports.length, 2);
});

test('each species keeps its newest report', () => {
  const older = { seconds: 10, toDate: () => new Date(10_000) };
  const newer = { seconds: 30, toDate: () => new Date(30_000) };
  const base = {
    lakeId: '27-0133-00',
    lakeName: 'Lake Minnetonka',
    sourceId: null,
    userId: 'angler',
    lures: ['jig'],
    colors: ['chartreuse'],
    depthFt: 12,
    waterTempF: 55,
    conditions: '',
    technique: 'Drag',
    timeOfDay: 'morning' as const,
    aiSummary: '',
    userSubmitted: true,
    isPublic: true,
    verified: false,
    upvotes: 0,
    photoUrl: null,
    rawText: '',
    confidenceScore: 0,
    structureType: 'point',
    createdAt: newer,
    updatedAt: newer,
  };
  const latest = latestReportsBySpecies([
    { ...base, reportId: 'old-walleye', species: ['walleye'], reportDate: older, technique: 'Old' },
    { ...base, reportId: 'new-walleye', species: ['walleye'], reportDate: newer, technique: 'New' },
    { ...base, reportId: 'pike', species: ['northern_pike'], reportDate: older, technique: 'Pike' },
  ] as AnglerReport[]);
  const walleye = latest.find((item) => item.species === 'walleye');
  const pike = latest.find((item) => item.species === 'northern_pike');
  assert.equal(walleye?.report.reportId, 'new-walleye');
  assert.equal(pike?.report.reportId, 'pike');
  assert.equal(latest[0].species, 'walleye');
});

test('one report that names two species is shown once', () => {
  const stamp = { seconds: 20, toDate: () => new Date(20_000) };
  const report = {
    reportId: 'lotw',
    lakeId: 'LOTW-MN',
    lakeName: 'Lake of the Woods',
    sourceId: 'seed_demo',
    userId: null,
    reportDate: stamp,
    species: ['walleye', 'sauger'],
    lures: ['jig', 'minnow'],
    colors: ['glow', 'orange'],
    depthFt: 28,
    waterTempF: 52,
    conditions: 'South shore mud. Vertical jigging producing limits of eaters.',
    technique: 'Vertical jig',
    timeOfDay: 'all day' as const,
    aiSummary: 'South shore mud. Vertical jigging producing limits of eaters.',
    userSubmitted: false,
    isPublic: true,
    verified: false,
    upvotes: 0,
    photoUrl: null,
    rawText: '',
    confidenceScore: 0,
    structureType: 'mud',
    createdAt: stamp,
    updatedAt: stamp,
  } as AnglerReport;
  const cards = consolidatedReports([report]);
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].species.sort(), ['sauger', 'walleye']);
  assert.equal(reportNote(report), report.conditions);
});

test('report notes drop named spots and keep structure', () => {
  assert.equal(
    redactNamedSpots('Walleye on Frazer Bay in 18 ft. Rocky points were quiet.'),
    'Walleye in 18 ft. Rocky points were quiet.',
  );
  assert.equal(
    redactNamedSpots('Fish at the Narrows. South shore mud was better.'),
    'Fish. South shore mud was better.',
  );
  assert.equal(redactNamedSpots('Deep breaks adjacent to cabbage. Slow presentation.'), 'Deep breaks adjacent to cabbage. Slow presentation.');
  assert.equal(
    reportNote({
      conditions: 'Limits on Frazer Point and at Black Bay.',
      aiSummary: 'Limits on Frazer Point and at Black Bay.',
    }),
    'Limits on the point.',
  );
});

test('a comprehensive report summarizes the saved fields without a spot name', () => {
  const paragraph = comprehensiveWriteup(
    {
      structureType: 'breakline',
      depthFt: 22,
      waterTempF: 56,
      timeOfDay: 'early morning',
      technique: 'Slip bobber',
      lures: ['leech', 'jig'],
      colors: ['black'],
    },
    ['walleye'],
    'Deep breaks adjacent to cabbage. Slow presentation. Best bite was in Frazer Bay.',
  );
  assert.ok(paragraph);
  assert.match(paragraph ?? '', /Deep breaks adjacent to cabbage/);
  assert.match(paragraph ?? '', /breakline/i);
  assert.match(paragraph ?? '', /22 ft/);
  assert.match(paragraph ?? '', /56°F/);
  assert.match(paragraph ?? '', /early morning/);
  assert.match(paragraph ?? '', /slip bobber/i);
  assert.match(paragraph ?? '', /leech and jig/);
  assert.doesNotMatch(paragraph ?? '', /Frazer|Bay/i);
});

test('a lake keeps the standard species order and drops species it does not have', () => {
  const labels = chipsForLake(['largemouth bass', 'northern pike', 'walleye', 'muskie', 'crappie'])
    .map((chip) => chip.label);
  assert.deepEqual(labels, ['All', 'Walleye', 'Bass', 'Pike', 'Muskie', 'Crappie']);
  assert.deepEqual(
    chipsForLake(['smallmouth bass', 'lake trout']).map((chip) => chip.label),
    ['All', 'Bass', 'Trout'],
  );
});

test('lake species pills and filter chips follow the same DNR species', () => {
  const dnr = [
    'black bullhead',
    'black crappie',
    'bluegill',
    'bowfin (dogfish)',
    'common carp',
    'green sunfish',
    'largemouth bass',
    'muskellunge',
    'northern pike',
    'rock bass',
    'smallmouth bass',
    'walleye',
    'white sucker',
    'yellow perch',
  ];
  assert.deepEqual(chipsForLake(dnr).map((chip) => chip.label), [
    'All',
    'Walleye',
    'Bass',
    'Pike',
    'Panfish',
    'Muskie',
    'Crappie',
    'Perch',
  ]);
  assert.deepEqual(speciesShownForLake(dnr), [
    'walleye',
    'largemouth bass',
    'smallmouth bass',
    'northern pike',
    'bluegill',
    'green sunfish',
    'rock bass',
    'muskellunge',
    'black crappie',
    'yellow perch',
  ]);
});

test('a lake regulation lookup stays on the water that was named', () => {
  const match = pickRegulationHit(
    [
      { id: '48025900', name: 'Other Lake', county: 'Aitkin', pca_id: '48-0259-00' },
      { id: '48000200', name: 'Mille Lacs', county: 'Mille Lacs', pca_id: '48-0002-00' },
    ],
    { id: '48-0259-00', name: 'Mille Lacs', county: 'Mille Lacs' },
  );
  assert.equal(match?.id, '48000200');
  const exact = pickRegulationHit(
    [{ id: '27013300', name: 'Minnetonka', county: 'Hennepin', pca_id: null }],
    { id: '27-0133-00', name: 'Minnetonka', county: 'Hennepin' },
  );
  assert.equal(exact?.id, '27013300');
});

test('four approved prices and premium inheritance', () => {
  assert.deepEqual(PLAN_PRICES.map((price) => price.cents), [499, 3999, 899, 6999]);
  assert.equal(priceFor('standard', 'monthly').display, '$4.99/month');
  assert.equal(priceFor('standard', 'annual').display, '$39.99/year');
  assert.equal(priceFor('premium', 'monthly').display, '$8.99/month');
  assert.deepEqual(annualPricePerMonth('standard'), { cents: 333, display: '$3.33/month' });
  assert.deepEqual(annualPricePerMonth('premium'), { cents: 583, display: '$5.83/month' });
  assert.deepEqual(monthlyYearTotal('standard'), { cents: 5988, display: '$59.88' });
  assert.deepEqual(monthlyYearTotal('premium'), { cents: 10788, display: '$107.88' });
  assert.equal(PRICING_HERO.title, "Find out what's biting.");
  assert.match(PRICING_HERO.description, /spend less time searching for information and more time fishing/);
  assert.equal(PLANS[0].subtitle, 'Everything you need to plan your next fishing trip.');
  assert.equal(PLANS[1].subtitle, 'Get more insights before you hit the water.');
  assert.equal(PLANS[1].inherits, 'Everything in Standard, plus:');
  assert.deepEqual([...STANDARD_BULLETS], [
    'Lake-specific and species-specific fishing reports',
    'Reported depths, lures, and techniques',
    'Water conditions and bottom structure, where available',
    'Seasonal ice reports, where available',
    'Easy lake and species search',
  ]);
  assert.deepEqual([...PREMIUM_BULLETS], [
    'Alerts for new reports on your favorite lakes',
    'Extended fishing report history',
    'Advanced lake and species filters',
    'Compare conditions across lakes',
    'Personalized saved-lake dashboard',
    'Historical fishing trends where data is available',
  ]);
  assert.match(PRICING_DISCLAIMER, /especially when ice fishing/);
  assert.equal(tierHasEntitlement('standard', 'fishing_reports'), true);
  assert.equal(tierHasEntitlement('standard', 'saved_lake_dashboard'), false);
  assert.equal(tierHasEntitlement('premium', 'saved_lake_dashboard'), true);
  assert.equal(tierHasEntitlement('premium', 'fishing_reports'), true);
});

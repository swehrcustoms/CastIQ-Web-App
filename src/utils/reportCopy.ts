import type { AnglerReport } from '../types/user';
import { speciesLabel } from './species';

const GENERIC = new Set([
  'a', 'an', 'the', 'and', 'of', 'or',
  'rocky', 'rock', 'rocks', 'gravel', 'gravelly', 'sand', 'sandy', 'mud', 'muddy',
  'weed', 'weeds', 'weedy', 'cabbage', 'timber', 'wood', 'woody', 'boulder', 'boulders',
  'deep', 'shallow', 'main', 'mid', 'inside', 'outside', 'inner', 'outer',
  'wind', 'windblown', 'windward', 'leeward', 'shoreline', 'shore', 'shores',
  'long', 'short', 'steep', 'soft', 'hard', 'sunken', 'submerged',
  'offshore', 'nearshore', 'first', 'second', 'primary', 'secondary',
  'stony', 'stone', 'transition', 'saddle', 'finger', 'basin', 'edge', 'edges',
  'break', 'breaks', 'breakline', 'weedline', 'flat', 'flats', 'hump', 'humps',
  'point', 'points', 'reef', 'reefs', 'bar', 'bars', 'shoal', 'shoals', 'channel', 'channels',
  'lake', 'lakes', 'open', 'water', 'remaining', 'adjacent', 'slow', 'vertical',
  'top', 'bottom', 'upper', 'lower', 'big', 'little', 'small', 'large',
  'north', 'south', 'east', 'west', 'northern', 'southern', 'eastern', 'western',
  'northeast', 'northwest', 'southeast', 'southwest',
  'mid-lake', 'main-lake', 'midlake', 'mainlake',
  'canadian', 'american', 'side',
]);

const STRUCTURE_SUFFIX = new Set([
  'point', 'points', 'reef', 'reefs', 'bar', 'bars', 'hump', 'humps',
  'flat', 'flats', 'shoal', 'shoals', 'channel', 'channels', 'shore', 'shores',
]);

const PLACE_WORDS = [
  'Bay', 'Bays', 'Point', 'Points', 'Reef', 'Reefs', 'Narrows', 'Arm', 'Arms',
  'Cove', 'Coves', 'Island', 'Islands', 'Landing', 'Landings', 'Resort', 'Resorts',
  'Dam', 'Dams', 'Gap', 'Shoal', 'Shoals', 'Hump', 'Humps', 'Bar', 'Bars', 'Flats',
  'Channel', 'Channels', 'Inlet', 'Inlets', 'Outlet', 'Outlets', 'Harbor', 'Harbour',
  'Harbors', 'Creek', 'Creeks', 'River', 'Beach', 'Beaches', 'Marina', 'Camp', 'Camps',
  'Access', 'Shore', 'Shores',
];

const PLACE_SUFFIX = PLACE_WORDS.flatMap((word) => [word, word.toLowerCase()]).join('|');

const NAMED_SPOT = new RegExp(
  `\\b(?:(?:at|near|off|around|by|beside|along|from|toward|towards|on|in)\\s+)?(?:the\\s+)?([A-Z][A-Za-z'’\\-]*(?:\\s+[A-Z][A-Za-z'’\\-]*){0,3})\\s+(${PLACE_SUFFIX})\\b`,
  'g',
);

const STANDALONE_SPOT = /\b(?:at|near|off|around|by|beside|along|from|toward|towards|on|in|the)\s+(?:narrows|dam|landing|resort|marina|campground|boat landing|public access)\b/gi;

function nameWords(value: string): string[] {
  return value
    .split(/\s+/)
    .map((word) => word.toLowerCase().replace(/[^a-z-]/g, ''))
    .filter((word) => word && word !== 'a' && word !== 'an' && word !== 'the');
}

function tidy(text: string): string {
  const cleaned = text
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\b(?:at|near|off|around|by|beside|along|from|toward|towards|on|in|to|the)\s*(?=[,.;!?]|$)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/([.!?])\1+/g, '$1')
    .replace(/\s+\b(?:and|or)\s*(?=[,.;!?]|$)/gi, '')
    .replace(/^[,\s.;!?]+/, '')
    .trim();

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /[a-z0-9]/i.test(sentence));
  if (sentences.length === 1 && !/[.!?]/.test(sentences[0])) return sentences[0];
  return sentences
    .map((sentence) => sentence.charAt(0).toUpperCase() + sentence.slice(1))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop named bays, resorts, and other spots. Keep structure words such as reef, point, and break. */
export function redactNamedSpots(text: string): string {
  if (!text.trim()) return '';
  const withoutNames = text.replace(NAMED_SPOT, (full, name: string, suffix: string) => {
    const words = nameWords(name);
    if (words.length === 0 || words.every((word) => GENERIC.has(word))) return full;
    if (!STRUCTURE_SUFFIX.has(suffix.toLowerCase())) return '';
    const prep = full.match(/^(at|near|off|around|by|beside|along|from|toward|towards|on|in)\s+/i)?.[0] ?? '';
    return `${prep}the ${suffix.toLowerCase()}`;
  });
  return tidy(withoutNames.replace(STANDALONE_SPOT, ''));
}

function joinList(items: string[]): string {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

function withArticle(value: string): string {
  const trimmed = value.trim();
  if (/^(a|an|the)\s/i.test(trimmed)) return trimmed;
  return `${/^[aeiou]/i.test(trimmed) ? 'an' : 'a'} ${trimmed}`;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function finish(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function mentioned(note: string, value: string): boolean {
  const wanted = value.toLowerCase().trim();
  return wanted.length > 0 && note.toLowerCase().includes(wanted);
}

/** A short paragraph that restates one saved report without adding a named spot. */
export function comprehensiveWriteup(
  report: Pick<AnglerReport, 'structureType' | 'depthFt' | 'waterTempF' | 'timeOfDay' | 'technique' | 'lures' | 'colors'>,
  speciesIds: string[],
  note: string | null,
): string | null {
  const names = speciesIds.filter((name) => name && name !== 'unspecified').map((name) => speciesLabel(name));
  const subject = names.length > 0 ? joinList(names) : 'Fish';
  const lead = redactNamedSpots(note ?? '').replace(/\s+/g, ' ').trim();
  const structure = redactNamedSpots(report.structureType?.trim() ?? '').replace(/\s+/g, ' ').trim();
  const depth = report.depthFt != null ? `${report.depthFt} ft` : '';
  const temp = report.waterTempF != null ? `${report.waterTempF}°F` : '';
  const time = report.timeOfDay && report.timeOfDay !== 'all day' ? report.timeOfDay : '';
  const technique = report.technique?.trim() ?? '';
  const lures = joinList(report.lures ?? []);
  const colors = joinList(report.colors ?? []);
  const known = lead.toLowerCase();

  const sentences: string[] = [];
  if (lead) sentences.push(finish(lead));

  const structureFresh = Boolean(structure) && !mentioned(known, structure);
  const depthFresh = report.depthFt != null && !mentioned(known, String(report.depthFt));
  if (structureFresh && depthFresh) {
    sentences.push(`${subject} were reported on ${withArticle(structure)} in ${depth} of water.`);
  } else if (structureFresh) {
    sentences.push(`${subject} were reported on ${withArticle(structure)}.`);
  } else if (depthFresh) {
    sentences.push(`${subject} were reported in ${depth} of water.`);
  }

  const tempFresh = Boolean(temp) && !mentioned(known, String(report.waterTempF));
  const timeFresh = Boolean(time) && !mentioned(known, time);
  if (tempFresh && timeFresh) {
    sentences.push(`The water was ${temp}, and this was ${withArticle(time)} report.`);
  } else if (tempFresh) {
    sentences.push(`The water was ${temp}.`);
  } else if (timeFresh) {
    sentences.push(`This was ${withArticle(time)} report.`);
  }

  const presentation: string[] = [];
  if (technique && !mentioned(known, technique)) presentation.push(withArticle(lowerFirst(technique)));
  if (lures && !mentioned(known, lures)) {
    const colored = colors && !mentioned(known, colors) ? `${colors} ${lures}` : lures;
    presentation.push(withArticle(colored));
  }
  if (presentation.length === 2) {
    sentences.push(`The presentation was ${presentation[0]} with ${presentation[1]}.`);
  } else if (presentation.length === 1) {
    sentences.push(`The presentation was ${presentation[0]}.`);
  }

  const paragraph = sentences.join(' ').replace(/\s+/g, ' ').trim();
  if (!paragraph || paragraph === `${subject} were reported.`) return null;
  return paragraph;
}

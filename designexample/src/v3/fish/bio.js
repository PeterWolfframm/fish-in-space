// Fish bios: a short, funny, Tinder-profile-style blurb for each fish, deterministic from its
// looks (same idea as names.js, one level up: full lines instead of single words). A "pattern"
// picks which beats show up (opener, trait, personality, rumor, closer), in what order and how
// many (2-4 lines) -- then each beat picks a line from bio-data.js, leaning on a trait-tagged pool
// when the fish earns that tag (reusing names.js's tagsOf, plus a few bio-only tags for mood and
// life stage), falling back to the generic pool otherwise.

import { roller } from '../../pixel/rng.js';
import { phenotype } from './phenotype.js';
import { tagsOf } from './names.js';
import { GENERIC, TAGGED } from './bio-data.js';

const EXTRA_MOODS = ['happy', 'sleepy', 'smug', 'derpy', 'content'];

/** Tags a fish earns for its bio: names.js's looks tags, plus mood, life stage and a few quirks. */
export function bioTagsOf(ph) {
  const tags = new Set(tagsOf(ph));
  const set = ph.set;
  if (EXTRA_MOODS.includes(set.mood)) tags.add(set.mood);
  if (ph.stage === 'fry') tags.add('fry');
  if (ph.stage === 'elder') tags.add('elder');
  if (set.quirk === 'wonky') tags.add('wonky');
  if (set.damage && set.damage !== 'none') tags.add('scarred');
  return [...tags];
}

/** Sentence patterns: which beats a bio draws on, in order. Shorter ones are more common. */
const PATTERNS = [
  ['opener', 'trait', 'closer'],
  ['opener', 'personality', 'closer'],
  ['trait', 'rumor', 'closer'],
  ['opener', 'rumor'],
  ['personality', 'closer'],
  ['opener', 'trait', 'personality'],
  ['rumor', 'closer'],
  ['opener', 'trait', 'rumor', 'closer'],
];

/** `{body}` / `{Body}` -> the fish's own body (or hybrid) name, lower and capitalised. */
function sub(line, ph) {
  const body = String(ph.body).replace(/[^a-z]/gi, '').toLowerCase();
  const Body = body.charAt(0).toUpperCase() + body.slice(1);
  return line.replace(/\{body\}/g, body).replace(/\{Body\}/g, Body);
}

/** One line for a beat: a tagged pool most of the time if the fish earns one, else the generic pool. */
function lineFor(category, tags, pick, chance, salt) {
  const pools = tags.map((t) => TAGGED[category]?.[t]).filter(Boolean);
  if (pools.length && chance(0.6, salt)) return pick(pick(pools, salt + 1), salt + 2);
  return pick(GENERIC[category], salt + 3);
}

/** The fish's bio: 2-4 lines, stable for the same genome, joined with newlines. */
export function bioOf(genome) {
  const ph = phenotype(genome);
  const { pick, chance } = roller(ph.seed, 9400);
  const tags = bioTagsOf(ph);
  const pattern = pick(PATTERNS, 1);
  const lines = pattern.map((category, i) => sub(lineFor(category, tags, pick, chance, 10 + i * 10), ph));
  return [...new Set(lines)].join('\n');
}

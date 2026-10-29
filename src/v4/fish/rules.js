// The condition language fish4 shares everywhere: feature gates, stat rules, rarity bonuses and
// text matching all say "when" the same way, so a condition written once works in all of them.
//
// A condition is plain JSON:
//   { all: [c, …] }  { any: [c, …] }  { not: c }
//   { field: 'body', is: 'koi' }        { field: 'pattern', in: ['bars', 'tiger'] }
//   { feature: 'helmet', is: 'bubble' } { feature: 'helmet', not: 'none' }
//   { fact: 'diet', is: 'piscivore' }   (ecology facts: diet, feeding, level, temperament, …)
//   { stat: 'boldness', gt: 0.6 }       { locus: 'aggression', between: [0.2, 0.5] }
//   { tier: '>=epic' }                  { taxon: 'family', is: 'Serrasalmidae' }
//   { size: '>=huge' }                  { chance: 0.25, salt: 'pacifist' }
// Comparisons: is, in, not, gt, gte, lt, lte, between. `chance` is decided by the fish's own look
// (its jitter key) and the salt, so an exception always lands on the same fish.
//
// A rule is `{ id, when, then: [{ stat, add | mul | set }], note }`; see stats.js.

import { hash01 } from '../../pixel/rng.js';

/** Rarity tiers, lowest first. `myth` keeps fish3's id for Mythic. */
export const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'myth'];
export const TIER_LABELS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', myth: 'Mythic' };
export const tierRank = (id) => Math.max(0, TIERS.indexOf(id));
export const SIZE_ORDER = ['tiny', 'small', 'medium', 'large', 'huge', 'giant'];

/** `'>=epic'` → test on a rank. Plain `'epic'` means exactly. */
function ordered(spec, value, order) {
  const m = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(String(spec));
  const op = m?.[1] ?? '=';
  const want = order.indexOf(m?.[2]);
  const have = order.indexOf(value);
  if (want < 0 || have < 0) return false;
  return op === '>=' ? have >= want : op === '<=' ? have <= want : op === '>' ? have > want : op === '<' ? have < want : have === want;
}

/** One comparison on a value. */
function compare(c, v) {
  if ('is' in c) return v === c.is;
  if ('in' in c) return c.in.includes(v);
  if ('not' in c) return Array.isArray(c.not) ? !c.not.includes(v) : v !== c.not;
  if ('between' in c) return v >= c.between[0] && v <= c.between[1];
  if ('gte' in c) return v >= c.gte;
  if ('gt' in c) return v > c.gt;
  if ('lte' in c) return v <= c.lte;
  if ('lt' in c) return v < c.lt;
  return v != null && v !== false && v !== 'none';
}

/**
 * Whether condition `c` holds. `look(kind, id)` answers lookups: kind is field, fact, stat,
 * locus, taxon, tier or size; `key` is the fish's own key for `chance`.
 */
export function test(c, look, key = '') {
  if (c == null || c === true) return true;
  if (c === false) return false;
  if (Array.isArray(c)) return c.every((x) => test(x, look, key));
  if (c.all) return c.all.every((x) => test(x, look, key));
  if (c.any) return c.any.some((x) => test(x, look, key));
  if (c.not && Object.keys(c).length === 1) return !test(c.not, look, key);
  if ('chance' in c) return hash01(`${key}:${c.salt ?? 'chance'}`, 4099) < c.chance;
  if ('tier' in c) return ordered(c.tier, look('tier'), TIERS);
  if ('size' in c) return ordered(c.size, look('size'), SIZE_ORDER);
  for (const kind of ['field', 'feature', 'fact', 'stat', 'locus', 'taxon']) {
    if (kind in c) return compare(c, look(kind === 'feature' ? 'field' : kind, c[kind]));
  }
  throw new Error(`unknown condition ${JSON.stringify(c)}`);
}

/** How specific a condition is: the number of leaf tests in it (text matching prefers more). */
export function specificity(c) {
  if (c == null || c === true) return 0;
  if (Array.isArray(c)) return c.reduce((n, x) => n + specificity(x), 0);
  if (c.all) return c.all.reduce((n, x) => n + specificity(x), 0);
  if (c.any) return Math.min(...c.any.map(specificity));
  if (c.not && Object.keys(c).length === 1) return specificity(c.not);
  return 1;
}

/** A lookup over a bare genome: fields, tier and size only (enough for gates). */
export const setLook = (set) => (kind, id) => (kind === 'field' ? set[id] : kind === 'tier' ? set.rarity : kind === 'size' ? set.size : undefined);

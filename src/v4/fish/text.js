// fish4's text: lines from data/text-library.js matched against everything the fish is (stats,
// loci, facts, fields, features, tier, size, and its character), the most specific entry first,
// the line within it picked by the fish's own key, tokens filled from its character. When nothing
// in a pool matches, fish3's lore fills in.
//
//   textFor(set, pool, opts?) → { text, id, pool } | null
//   textOf(set, opts?) → { tagline, origin, codex, care, quote }
//
// opts: { params?, library? (replaces the default), character? (when already computed) }.

import { hash01 } from '../../pixel/rng.js';
import { test, specificity } from './rules.js';
import { characterOf } from './character.js';
import { loreOf } from '../../v3/fish/lore.js';
import { toFish3 } from './genome.js';
import { extOf } from './bodies/index.js';
import LIBRARY from './data/text-library.js';

export const POOLS = ['tagline', 'origin', 'codex', 'care', 'quote'];
export { LIBRARY };

/** Tokens a line may use, from the character. */
function tokensOf(c) {
  const t = c.traits.map((x) => x.word);
  return {
    name: c.names.full,
    common: c.names.common,
    binomial: c.story.species,
    archetype: c.archetype.label.toLowerCase(),
    role: c.social.label.toLowerCase(),
    trait: t[0] ?? 'curious',
    trait2: t[1] ?? t[0] ?? 'gentle',
    quirk: c.quirks[0]?.text ?? c.archetype.line,
    region: c.story.region.label.replace(/^The /, 'the '),
    niche: c.story.niche.label.toLowerCase(),
    nicheNote: c.story.niche.note ?? 'it keeps its own ways',
    terrain: c.story.terrain.label.toLowerCase(),
    medium: c.care.medium,
    tempC: String(Math.round(c.care.tempC)),
    school: String(Math.max(2, c.social.schoolSize)),
    lifespan: c.story.lifespan,
    likes: c.likes.slice(0, 2).join(' and ') || 'a quiet tank',
    fear: c.fears[0] ?? 'sudden shadows',
    diet: c.care.diet,
  };
}

const fill = (s, t) => s.replace(/\{(\w+)\}/g, (m, k) => (k in t ? t[k] : m));
const capFirst = (s) => s.replace(/^(\W*)(\w)/, (m, a, b) => a + b.toUpperCase());

/** The best line in one pool, or fish3's lore when nothing matches. */
export function textFor(set, pool, opts = {}) {
  const c = opts.character ?? characterOf(set, opts);
  const lib = opts.library ?? LIBRARY;
  const key = c.key;
  const hits = lib
    .filter((e) => e.pool === pool && test(e.when, c.look, key))
    .map((e) => ({ e, pri: e.priority ?? 0, spec: specificity(e.when) }))
    .sort((a, b) => b.pri - a.pri || b.spec - a.spec);
  if (hits.length) {
    // Among the equally best entries, the fish's key picks one; then a line within it.
    const best = hits.filter((h) => h.pri === hits[0].pri && h.spec === hits[0].spec);
    const e = best[Math.floor(hash01(`${key}:${pool}`, 8201) * best.length)].e;
    const line = e.lines[Math.floor(hash01(`${key}:${e.id}`, 8202) * e.lines.length)];
    return { text: capFirst(fill(line, c.tokens ?? tokensOf(c))), id: e.id, pool };
  }
  return fallback(set, pool);
}

function fallback(set, pool) {
  const lore = loreOf(toFish3(set), extOf(set));
  if (pool === 'quote' && lore.quote) return { text: `“${lore.quote.text}”${lore.quote.by ? ` — ${lore.quote.by}` : ''}`, id: `lore:${lore.quote.key}`, pool };
  if (pool === 'codex') return { text: lore.codex[0].text, id: `lore:${lore.codex[0].key}`, pool };
  if (pool === 'care') return { text: lore.edict.text, id: `lore:${lore.edict.key}`, pool };
  if (pool === 'tagline' || pool === 'origin') return { text: lore.designation, id: 'lore:designation', pool };
  return null;
}

/** One line per pool. */
export function textOf(set, opts = {}) {
  const character = opts.character ?? characterOf(set, opts);
  return Object.fromEntries(POOLS.map((p) => [p, textFor(set, p, { ...opts, character })]));
}

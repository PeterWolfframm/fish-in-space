// Trait linkage (data/links.js): after a fish's first roll, the links it triggers re-roll the
// linked fields with their odds multiplied in, so looks that belong together turn up together.
//
//   linkMuls(set, P) → { field: { choice: × } }   (every active link's multipliers, combined)
//   applyLinks(set, P, reroll, keep?) → { set, links[] }
//   inheritKits(child, A, B, P, chance) → kit ids taken whole from one parent
//
// `reroll(fieldId, mul, salt)` is the caller's roller (ecotype's odds for this place); `keep` names
// fields not to touch (the ones a fish kept from its species). Deterministic.

import { test, setLook } from './rules.js';
import { LINKS, KITS } from './data/links.js';

export { LINKS, KITS };

const linksOf = (P) => {
  const L = P.links ?? {};
  const off = new Set(L.off ?? []);
  return (Array.isArray(L.list) ? L.list : LINKS).filter((l) => !off.has(l.id));
};

/** The combined multipliers of every link this fish triggers, raised to `links.strength`. */
export function linkMuls(set, P) {
  const k = P.links?.strength ?? 1;
  const out = {};
  const fired = [];
  if (k === 0) return { muls: out, fired };
  const look = setLook(set);
  for (const l of linksOf(P)) {
    if (!test(l.when, look, '')) continue;
    fired.push(l.id);
    for (const [f, m] of Object.entries(l.mul)) {
      out[f] ??= {};
      for (const [c, x] of Object.entries(m)) out[f][c] = (out[f][c] ?? 1) * x ** k;
    }
  }
  return { muls: out, fired };
}

/** Re-roll the linked fields. The links are read off the first roll, so the order is fixed. */
export function applyLinks(set, P, reroll, keep = new Set()) {
  const { muls, fired } = linkMuls(set, P);
  const out = { ...set };
  for (const [fid, m] of Object.entries(muls)) {
    if (keep.has(fid) || !(fid in out)) continue;
    out[fid] = reroll(fid, m, 7);
  }
  return { set: out, links: fired };
}

/** Breeding: each kit comes whole from one parent with `links.kitChance`. Mutates `child`. */
export function inheritKits(child, A, B, P, chance) {
  const p = P.links?.kitChance ?? 0.5;
  const taken = [];
  KITS.forEach((kit, i) => {
    if (!chance(p, 140 + i * 2)) return;
    const from = chance(0.5, 141 + i * 2) ? A : B;
    for (const f of kit.fields) child[f] = from[f];
    taken.push(kit.id);
  });
  return taken;
}

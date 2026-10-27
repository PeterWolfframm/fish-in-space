// Vendored from the pixel kit — do not edit here.
// Source: kit/web/pixel/rng.js in the Burn-Through repo.
// Run `node scripts/vendor-pixel.mjs` to update, and edit it there.
// Deterministic rolls from a seed. No state: every roll is a pure hash of (seed, salt), so a
// trait can be added, removed or reordered without reshuffling any other trait — which matters
// whenever a seed is a stable identity rather than a one-shot shuffle.

/** Stable 0..1 from a key (and a salt for independent rolls). */
export function hash01(key, salt = 0) {
  let h = (2166136261 ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Rolls for one seed. `band` offsets every salt, so two callers that share a seed but pass
 * different bands never correlate.
 *
 * - `r(salt)` → 0..1
 * - `pick(list, salt)` → one item
 * - `weighted([[item, weight] …], salt)` → one item, weight-proportional
 * - `chance(p, salt)` → true with probability p
 * - `range(min, max, salt)` → a number in [min, max)
 * - `int(min, max, salt)` → a whole number in [min, max]
 */
export function roller(seed, band = 0) {
  const key = String(seed ?? '');
  const r = (salt) => hash01(key, salt + band);
  const pick = (list, salt) => list[Math.floor(r(salt) * list.length) % list.length];
  const weighted = (pairs, salt) => {
    const total = pairs.reduce((a, [, w]) => a + w, 0);
    if (total <= 0) return pairs[pairs.length - 1]?.[0];
    let x = r(salt) * total;
    for (const [item, w] of pairs) {
      if ((x -= w) < 0) return item;
    }
    return pairs[pairs.length - 1][0];
  };
  const chance = (p, salt) => r(salt) < p;
  const range = (min, max, salt) => min + r(salt) * (max - min);
  const int = (min, max, salt) => min + Math.floor(r(salt) * (max - min + 1));
  return { r, pick, weighted, chance, range, int };
}

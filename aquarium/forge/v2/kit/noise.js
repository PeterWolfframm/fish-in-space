// Seeded value noise for organic texture: mottling, bark, moss, sand. Pure and repeatable.

import { hash01 } from '../../pixel/rng.js';

const smooth = (t) => t * t * (3 - 2 * t);

/** A 2D value-noise function in 0..1 with feature size `scale` px. */
export function noise2(seed, scale = 4) {
  const cache = new Map();
  const at = (ix, iy) => {
    const k = ix * 7919 + iy * 104729;
    let v = cache.get(k);
    if (v === undefined) {
      v = hash01(`${seed}:${ix},${iy}`);
      cache.set(k, v);
    }
    return v;
  };
  return (x, y) => {
    const fx = x / scale;
    const fy = y / scale;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = smooth(fx - ix);
    const ty = smooth(fy - iy);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
    return a + (b - a) * ty;
  };
}

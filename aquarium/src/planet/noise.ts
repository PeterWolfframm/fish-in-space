// 3D value noise sampled on the unit sphere, so the equirect map has no seam and no pole pinch.

import { hash } from '../game/rng';

export function valueNoise3(seed: string) {
  const base = hash(seed);
  const lattice = (x: number, y: number, z: number) => {
    let h = base ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, z: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const fx = s(x - x0);
    const fy = s(y - y0);
    const fz = s(z - z0);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const c = (dx: number, dy: number, dz: number) => lattice(x0 + dx, y0 + dy, z0 + dz);
    return l(
      l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
      l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy),
      fz,
    );
  };
}

/** Fractal sum of octaves, normalised to about 0..1. */
export function fbm(noise: (x: number, y: number, z: number) => number, octaves: number) {
  return (x: number, y: number, z: number) => {
    let v = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      v += noise(x * f + o * 17.1, y * f + o * 31.7, z * f + o * 7.3) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return v / norm;
  };
}

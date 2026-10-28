// Colours for the planet map: a rust-and-slate world that greens around living regions.
// Pure: writes an equirectangular RGBA image the globe and surface map both sample.

import { LAND, OCEAN, LAKE, RIVER, DELTA, REEF, TRENCH, type PlanetMap } from './gen';
import type { BiomeId } from '../game/types';

export interface PaintPrep {
  near: Int16Array; // nearest region index for land cells (-1 if none within reach)
  dist: Uint8Array; // distance in cells to it
}

const REACH = 14;

/** Multi-source BFS from region cells across land: which region greens each land cell, and how far. */
export function prepare(map: PlanetMap): PaintPrep {
  const N = map.w * map.h;
  const near = new Int16Array(N).fill(-1);
  const dist = new Uint8Array(N).fill(255);
  const q = new Int32Array(N);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < N; i++) {
    if (map.region[i] >= 0) {
      near[i] = map.region[i];
      dist[i] = 0;
      q[tail++] = i;
    }
  }
  while (head < tail) {
    const i = q[head++];
    const d = dist[i];
    if (d >= REACH) continue;
    const x = i % map.w;
    const y = (i / map.w) | 0;
    const ns = [y * map.w + ((x + 1) % map.w), y * map.w + ((x - 1 + map.w) % map.w)];
    if (y > 0) ns.push(i - map.w);
    if (y < map.h - 1) ns.push(i + map.w);
    for (const j of ns) {
      if (dist[j] !== 255 || map.cls[j] !== LAND) continue;
      dist[j] = d + 1;
      near[j] = near[i];
      q[tail++] = j;
    }
  }
  return { near, dist };
}

const BIOME_WATER: Record<BiomeId, [number, number, number]> = {
  melt: [150, 214, 232],
  river: [74, 170, 204],
  delta: [92, 160, 150],
  reef: [63, 198, 201],
  trench: [28, 52, 120],
};
const LOCKED: [number, number, number] = [70, 86, 104];
const GREEN: [number, number, number] = [110, 190, 92];
const GREEN_HI: [number, number, number] = [155, 227, 122];

const mix = (a: readonly number[], b: readonly number[], k: number, o: Uint8ClampedArray, at: number) => {
  o[at] = a[0] + (b[0] - a[0]) * k;
  o[at + 1] = a[1] + (b[1] - a[1]) * k;
  o[at + 2] = a[2] + (b[2] - a[2]) * k;
  o[at + 3] = 255;
};

/**
 * Paint the map. `life[i]` is region i's Life 0..100 and `open[i]` whether it's surveyed; `highlight`
 * brightens one region (the focused one) so it reads on the globe.
 */
export function paint(map: PlanetMap, prep: PaintPrep, life: ArrayLike<number>, open: ArrayLike<number>, out: Uint8ClampedArray, highlight = -1) {
  const N = map.w * map.h;
  const tmp: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    const h = map.height[i];
    const c = map.cls[i];
    const y = (i / map.w) | 0;
    const polar = Math.abs(y / map.h - 0.5) * 2;
    const r = map.region[i];
    if (c === LAND) {
      // Barren rust lowlands, slate highlands, frost at the poles.
      const k = Math.min(1, Math.max(0, (h - map.sea) / (1 - map.sea)));
      tmp[0] = 150 - k * 60 + map.moist[i] * 10;
      tmp[1] = 104 - k * 34 + map.moist[i] * 8;
      tmp[2] = 84 - k * 8;
      if (polar > 0.82 || map.temp[i] < 0.12) (tmp[0] = 214), (tmp[1] = 222), (tmp[2] = 230);
      const n = prep.near[i];
      const g = n >= 0 ? (life[n] / 100) * Math.max(0, 1 - prep.dist[i] / (4 + (life[n] / 100) * 10)) : 0;
      if (g > 0) mix(tmp, (i * 7919) % 5 === 0 ? GREEN_HI : GREEN, Math.min(1, g * 1.4), out, o);
      else mix(tmp, tmp, 0, out, o);
      // Contour shading on hills.
      if (k > 0.5 && ((i * 2654435761) >>> 0) % 7 === 0) out[o] *= 0.92;
      continue;
    }
    if (c === OCEAN) {
      const d = Math.max(0, map.sea - h) / map.sea;
      mix([46, 92, 140], [16, 34, 78], Math.min(1, d * 1.6), out, o);
      if (polar > 0.9) mix([46, 92, 140], [200, 220, 235], 0.75, out, o);
      continue;
    }
    // A water region (lake, river, delta, reef, trench), or a stray water cell with no region.
    const biome: BiomeId = c === LAKE ? 'melt' : c === RIVER ? 'river' : c === DELTA ? 'delta' : c === REEF ? 'reef' : c === TRENCH ? 'trench' : 'river';
    const base = r >= 0 && open[r] ? BIOME_WATER[biome] : LOCKED;
    const l = r >= 0 ? life[r] / 100 : 0;
    mix(base, [130, 220, 120], l * 0.35, out, o);
    if (r >= 0 && r === highlight) {
      out[o] = Math.min(255, out[o] + 50);
      out[o + 1] = Math.min(255, out[o + 1] + 40);
      out[o + 2] = Math.min(255, out[o + 2] + 20);
    }
  }
}

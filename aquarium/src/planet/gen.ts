// Procedural planet: heightmap, climate, water bodies and regions, from a seed. Pure and
// deterministic: the same seed gives the same planet, in a worker or under a test.

import { rng, hash } from '../game/rng';
import { valueNoise3, fbm } from './noise';
import type { BiomeId } from '../game/types';

export const MAP_W = 256;
export const MAP_H = 128;

/** Cell classes. */
export const LAND = 0;
export const OCEAN = 1;
export const LAKE = 2;
export const RIVER = 3;
export const DELTA = 4;
export const REEF = 5;
export const TRENCH = 6;

const CLASS_BIOME: Record<number, BiomeId> = { [LAKE]: 'melt', [RIVER]: 'river', [DELTA]: 'delta', [REEF]: 'reef', [TRENCH]: 'trench' };
// Sea has no cell class of its own (it never reclasses a cell); it only ever owns plain OCEAN cells
// that no other region reached. BIOME_CLASS.sea is a sentinel no seed can ever carry.
const BIOME_CLASS: Record<BiomeId, number> = { melt: LAKE, river: RIVER, delta: DELTA, reef: REEF, trench: TRENCH, sea: OCEAN };
const BIOME_OPENS: Record<BiomeId, number> = { melt: 0, river: 1, delta: 2, reef: 3, trench: 4, sea: 1 };
const KIND: Record<BiomeId, string> = { melt: 'Lake', river: 'River', delta: 'Delta', reef: 'Reef', trench: 'Deep', sea: 'Sea' };

export interface RegionSeed {
  index: number;
  id: string;
  biome: BiomeId;
  opensAt: number;
  lon: number; // 0..1
  lat: number; // -1..1 (sin of latitude would bias; this is latitude / 90°)
  cx: number; // centroid cell, for labels
  cy: number;
  area: number;
  survey: string;
}

export interface PlanetMap {
  seed: string;
  w: number;
  h: number;
  height: Float32Array; // 0..1
  temp: Float32Array; // 0..1, base climate
  moist: Float32Array; // 0..1
  cls: Uint8Array;
  region: Int16Array; // region index per cell, -1 for none
  sea: number;
  regions: RegionSeed[];
}

const idx = (x: number, y: number) => y * MAP_W + (((x % MAP_W) + MAP_W) % MAP_W);
const latOf = (y: number) => Math.PI / 2 - ((y + 0.5) / MAP_H) * Math.PI;
const lonOf = (x: number) => ((x + 0.5) / MAP_W) * Math.PI * 2;

function neighbours4(i: number): number[] {
  const x = i % MAP_W;
  const y = (i / MAP_W) | 0;
  const out = [idx(x - 1, y), idx(x + 1, y)];
  if (y > 0) out.push(idx(x, y - 1));
  if (y < MAP_H - 1) out.push(idx(x, y + 1));
  return out;
}
function neighbours8(i: number): number[] {
  const x = i % MAP_W;
  const y = (i / MAP_W) | 0;
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    const yy = y + dy;
    if (yy < 0 || yy >= MAP_H) continue;
    for (let dx = -1; dx <= 1; dx++) if (dx || dy) out.push(idx(x + dx, yy));
  }
  return out;
}

/** Distance between two cells on the sphere, in cells along the equator. */
function cellDist(a: number, b: number): number {
  const la = latOf((a / MAP_W) | 0);
  const lb = latOf((b / MAP_W) | 0);
  const dl = lonOf(a % MAP_W) - lonOf(b % MAP_W);
  const c = Math.sin(la) * Math.sin(lb) + Math.cos(la) * Math.cos(lb) * Math.cos(dl);
  return (Math.acos(Math.max(-1, Math.min(1, c))) / (Math.PI * 2)) * MAP_W;
}

/** A small binary heap of [cost, cell]. */
class Heap {
  private a: [number, number][] = [];
  get size() {
    return this.a.length;
  }
  push(v: [number, number]) {
    const a = this.a;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function generatePlanet(seed: string): PlanetMap {
  const N = MAP_W * MAP_H;
  const height = new Float32Array(N);
  const ridge = new Float32Array(N);
  const temp = new Float32Array(N);
  const moist = new Float32Array(N);
  const cls = new Uint8Array(N);
  const region = new Int16Array(N).fill(-1);
  const r = rng(`${seed}:planet`);

  // 1. Heightmap: detail fBm plus a low-frequency continent mask; a ridged term for the trench.
  const detail = fbm(valueNoise3(`${seed}:h`), 5);
  const continent = fbm(valueNoise3(`${seed}:c`), 2);
  const ridged = fbm(valueNoise3(`${seed}:r`), 3);
  const wet = fbm(valueNoise3(`${seed}:m`), 3);
  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < MAP_H; y++) {
    const lat = latOf(y);
    for (let x = 0; x < MAP_W; x++) {
      const lon = lonOf(x);
      const px = Math.cos(lat) * Math.cos(lon);
      const py = Math.sin(lat);
      const pz = Math.cos(lat) * Math.sin(lon);
      const i = y * MAP_W + x;
      const c = continent(px * 1.1 + 5, py * 1.1 + 5, pz * 1.1 + 5);
      const v = 0.5 * detail(px * 2.2 + 9, py * 2.2 + 9, pz * 2.2 + 9) + 0.5 * c;
      height[i] = v;
      ridge[i] = 1 - Math.abs(2 * ridged(px * 1.7 + 3, py * 1.7 + 3, pz * 1.7 + 3) - 1);
      moist[i] = wet(px * 2 + 1, py * 2 + 1, pz * 2 + 1);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }
  for (let i = 0; i < N; i++) height[i] = (height[i] - lo) / (hi - lo || 1);
  const sorted = Float32Array.from(height).sort();
  const sea = sorted[Math.floor(N * 0.56)];

  // 2. Climate: latitude, minus height, plus noise. (The terraform phase offsets it at paint time.)
  for (let y = 0; y < MAP_H; y++) {
    const lat = Math.abs(latOf(y)) / (Math.PI / 2);
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      const above = Math.max(0, height[i] - sea);
      temp[i] = Math.max(0, Math.min(1, 1 - lat * 1.05 - above * 0.9 + (moist[i] - 0.5) * 0.15));
    }
  }

  // 3. Water bodies. Below sea level: big connected bodies are ocean, small ones are lakes.
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (seen[i] || height[i] >= sea) continue;
    const comp: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      comp.push(c);
      for (const n of neighbours4(c)) if (!seen[n] && height[n] < sea) (seen[n] = 1), stack.push(n);
    }
    const kind = comp.length > 260 ? OCEAN : LAKE;
    for (const c of comp) cls[c] = kind;
  }
  // Meltwater lakes in northern land basins: local minima, flooded a little.
  const lakeSeeds: number[] = [];
  const northLand: number[] = [];
  for (let y = 4; y < MAP_H * 0.36; y++) for (let x = 0; x < MAP_W; x++) if (cls[idx(x, y)] === LAND) northLand.push(idx(x, y));
  northLand.sort((a, b) => height[a] - height[b] || a - b);
  for (const c of northLand) {
    if (lakeSeeds.length >= 7) break;
    if (lakeSeeds.some((s) => cellDist(s, c) < 16)) continue;
    if (neighbours8(c).some((n) => cls[n] !== LAND)) continue;
    lakeSeeds.push(c);
  }
  for (const s of lakeSeeds) {
    const h0 = height[s];
    const q = [s];
    const lake = new Set([s]);
    while (q.length && lake.size < 70) {
      const c = q.shift()!;
      for (const n of neighbours4(c)) {
        if (lake.has(n) || cls[n] !== LAND || height[n] > h0 + 0.035) continue;
        lake.add(n);
        q.push(n);
      }
    }
    if (lake.size < 8) for (const n of neighbours8(s)) lake.add(n);
    for (const c of lake) cls[c] = LAKE;
  }

  // Rivers: downhill from each lake's rim and from high wet ground, to the sea.
  const mouths: number[] = [];
  const trace = (start: number) => {
    const path: number[] = [start];
    const visited = new Set<number>([start]);
    let c = start;
    for (let step = 0; step < 400; step++) {
      let best = -1;
      for (const n of neighbours8(c)) {
        if (visited.has(n)) continue;
        // Leave the lake it drains first: water only ends the river once it has some length.
        if (cls[n] !== LAND && cls[n] !== OCEAN && path.length < 6) continue;
        if (best < 0 || height[n] < height[best]) best = n;
      }
      if (best < 0) return;
      visited.add(best);
      if (cls[best] !== LAND) {
        if (path.length < 6) return;
        for (const p of path) if (cls[p] === LAND) cls[p] = RIVER;
        if (cls[best] === OCEAN) mouths.push(best);
        return;
      }
      path.push(best);
      c = best;
    }
  };
  for (const s of lakeSeeds) {
    let rim = -1;
    for (let i = 0; i < N; i++) {
      if (cls[i] !== LAND || cellDist(i, s) > 12) continue;
      if (!neighbours4(i).some((n) => cls[n] === LAKE)) continue;
      if (rim < 0 || height[i] < height[rim]) rim = i;
    }
    if (rim >= 0) trace(rim);
  }
  const highs: number[] = [];
  for (let i = 0; i < N; i++) if (cls[i] === LAND && height[i] > sea + 0.08 && moist[i] > 0.45) highs.push(i);
  highs.sort((a, b) => (hash(`${seed}:src${a}`) % 1000) - (hash(`${seed}:src${b}`) % 1000));
  const sources: number[] = [];
  for (const c of highs) {
    if (sources.length >= 12) break;
    if (sources.some((s) => cellDist(s, c) < 20)) continue;
    sources.push(c);
    trace(c);
  }

  // Deltas where rivers meet the sea.
  for (const m of mouths) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy > 16) continue;
        const y = ((m / MAP_W) | 0) + dy;
        if (y < 0 || y >= MAP_H) continue;
        const c = idx((m % MAP_W) + dx, y);
        if (cls[c] === OCEAN) cls[c] = DELTA;
      }
    }
  }

  // Ocean: warm shallows are reef, the deepest ridge cells are the trench.
  const ocean: number[] = [];
  for (let i = 0; i < N; i++) {
    if (cls[i] !== OCEAN) continue;
    ocean.push(i);
    const lat = Math.abs(latOf((i / MAP_W) | 0)) / (Math.PI / 2);
    if (lat < 0.36 && sea - height[i] < 0.075) cls[i] = REEF;
  }
  const deep = ocean.filter((i) => cls[i] === OCEAN).sort((a, b) => ridge[b] * (sea - height[b]) - ridge[a] * (sea - height[a]) || a - b);
  for (const c of deep.slice(0, Math.max(40, Math.round(deep.length * 0.05)))) cls[c] = TRENCH;

  // 4. Regions: Poisson-disc seeds per kind of water, grown over water by priority flood.
  const quota: Record<number, number> = {
    [LAKE]: 2 + Math.floor(r() * 3),
    [RIVER]: 2 + Math.floor(r() * 2),
    [DELTA]: 1 + Math.floor(r() * 2),
    [REEF]: 4 + Math.floor(r() * 3),
    [TRENCH]: 2 + Math.floor(r() * 2),
  };
  const seeds: { cell: number; cls: number }[] = [];
  // A river seed sits mid-river, away from lakes and the sea, so it owns a stretch of its own.
  const inlandRiver = (i: number) => {
    const x0 = i % MAP_W;
    const y0 = (i / MAP_W) | 0;
    for (let dy = -2; dy <= 2; dy++) {
      const y = y0 + dy;
      if (y < 0 || y >= MAP_H) continue;
      for (let dx = -2; dx <= 2; dx++) {
        const c = cls[idx(x0 + dx, y)];
        if (c !== LAND && c !== RIVER) return false;
      }
    }
    return true;
  };
  for (const k of [LAKE, RIVER, DELTA, REEF, TRENCH]) {
    const cells: number[] = [];
    for (let i = 0; i < N; i++) if (cls[i] === k && (k !== RIVER || inlandRiver(i))) cells.push(i);
    if (k === RIVER && !cells.length) for (let i = 0; i < N; i++) if (cls[i] === RIVER) cells.push(i);
    cells.sort((a, b) => hash(`${seed}:p${k}:${a}`) - hash(`${seed}:p${k}:${b}`));
    let minD = k === TRENCH || k === REEF ? 26 : 18;
    let got: number[] = [];
    while (minD >= 3) {
      got = [];
      for (const c of cells) {
        if (got.length >= quota[k]) break;
        if (seeds.some((s) => cellDist(s.cell, c) < minD * 0.6) || got.some((g) => cellDist(g, c) < minD)) continue;
        got.push(c);
      }
      if (got.length >= Math.min(quota[k], 1) && (got.length >= quota[k] || minD < 6)) break;
      minD = Math.floor(minD / 1.5);
    }
    if (!got.length && cells.length) got = [cells[0]];
    for (const c of got) seeds.push({ cell: c, cls: k });
  }
  // Lake seeds keep to their lake and river seeds to their river; the sea is shared by sea seeds.
  const SEA = new Set([OCEAN, REEF, TRENCH, DELTA]);
  const reaches = (own: number, c: number) => (own === LAKE || own === RIVER ? c === own : SEA.has(c));
  const cost = new Float32Array(N).fill(Infinity);
  const heap = new Heap();
  seeds.forEach((s, k) => {
    cost[s.cell] = 0;
    region[s.cell] = k;
    heap.push([0, s.cell]);
  });
  while (heap.size) {
    const [d, c] = heap.pop();
    if (d > cost[c]) continue;
    const own = seeds[region[c]].cls;
    for (const n of own === RIVER ? neighbours8(c) : neighbours4(c)) {
      if (cls[n] === LAND || !reaches(own, cls[n])) continue;
      const nd = d + 1 + (cls[n] === own ? 0 : 3);
      if (nd < cost[n]) {
        cost[n] = nd;
        region[n] = region[c];
        heap.push([nd, n]);
      }
    }
  }

  const regions: RegionSeed[] = [];
  const counts = seeds.map(() => new Map<number, number>());
  const sums = seeds.map(() => ({ x: 0, y: 0, z: 0, n: 0 }));
  for (let i = 0; i < N; i++) {
    const k = region[i];
    if (k < 0) continue;
    const m = counts[k];
    m.set(cls[i], (m.get(cls[i]) ?? 0) + 1);
    const lat = latOf((i / MAP_W) | 0);
    const lon = lonOf(i % MAP_W);
    const s = sums[k];
    s.x += Math.cos(lat) * Math.cos(lon);
    s.y += Math.sin(lat);
    s.z += Math.cos(lat) * Math.sin(lon);
    s.n++;
  }
  seeds.forEach((s, k) => {
    let best = s.cls;
    let bestN = -1;
    for (const [c, n] of counts[k]) {
      if (!CLASS_BIOME[c]) continue;
      if (n > bestN || (n === bestN && c === s.cls)) (best = c), (bestN = n);
    }
    // Lakes and rivers are small: a region seeded on one keeps that biome even when it spills into the sea.
    if (s.cls === LAKE || s.cls === RIVER || s.cls === DELTA) best = s.cls;
    const biome = CLASS_BIOME[best];
    const sum = sums[k];
    const len = Math.hypot(sum.x, sum.y, sum.z) || 1;
    const lat = Math.asin(sum.y / len);
    const lon = (((Math.atan2(sum.z, sum.x) / (Math.PI * 2)) % 1) + 1) % 1;
    regions.push({
      index: k,
      id: '',
      biome,
      opensAt: 0,
      lon,
      lat: lat / (Math.PI / 2),
      cx: Math.round(lon * MAP_W - 0.5),
      cy: Math.round((0.5 - lat / Math.PI) * MAP_H - 0.5),
      area: sum.n,
      survey: '',
    });
  });
  // Every biome is present (the quotas guarantee a seed per kind; this keeps it true after reclassing).
  for (const b of Object.keys(BIOME_CLASS) as BiomeId[]) {
    if (regions.some((x) => x.biome === b)) continue;
    const donor = regions.find((x, k) => seeds[k].cls === BIOME_CLASS[b]);
    if (donor) donor.biome = b;
  }
  // Slivers (two seeds landing on one thin river) are dropped; their cells belong to no region.
  const kept = regions.filter((x) => x.area >= 10 || regions.filter((y) => y.biome === x.biome).every((y) => y === x || y.area < x.area || (y.area === x.area && y.index > x.index)));
  const remap = new Int16Array(seeds.length).fill(-1);
  kept.forEach((x, k) => (remap[x.index] = k));
  for (let i = 0; i < N; i++) if (region[i] >= 0) region[i] = remap[region[i]];
  regions.length = 0;
  const seq: Record<string, number> = {};
  kept.forEach((x, k) => {
    const n = (seq[x.biome] = (seq[x.biome] ?? 0) + 1);
    regions.push({ ...x, index: k, id: `${seed}-${x.biome}-${n}`, survey: `Survey ${KIND[x.biome]} ${KIND[x.biome][0]}-${n}` });
  });
  // The first region of each biome opens with the biome; the rest open a phase apart after it.
  for (const b of Object.keys(BIOME_CLASS) as BiomeId[]) {
    const list = regions.filter((x) => x.biome === b).sort((p, q) => (b === 'melt' ? q.lat - p.lat : q.area - p.area) || p.index - q.index);
    list.forEach((x, k) => (x.opensAt = Math.min(5, BIOME_OPENS[b] + k)));
  }

  // 5. Open Sea: whatever plain ocean no region above reached (far from any reef, trench or delta)
  // is carved into a handful of its own regions by straight Voronoi, nearest seed wins. Existing
  // regions are untouched and keep their ids and indices; sea regions are appended after them.
  const openOcean: number[] = [];
  for (let i = 0; i < N; i++) if (cls[i] === OCEAN && region[i] < 0) openOcean.push(i);
  if (openOcean.length >= 15) {
    const nSea = Math.max(3, Math.min(6, Math.round(openOcean.length / 150)));
    const seaSeeds: number[] = [openOcean[Math.floor(r() * openOcean.length)]];
    // Farthest-point sampling: each new seed is the leftover cell farthest from every seed so far.
    while (seaSeeds.length < nSea) {
      let best = -1;
      let bestD = -1;
      for (const c of openOcean) {
        let d = Infinity;
        for (const s of seaSeeds) d = Math.min(d, cellDist(s, c));
        if (d > bestD) {
          bestD = d;
          best = c;
        }
      }
      seaSeeds.push(best);
    }
    const sums = seaSeeds.map(() => ({ x: 0, y: 0, z: 0, n: 0 }));
    const base = regions.length;
    for (const c of openOcean) {
      let own = 0;
      let bestD = Infinity;
      seaSeeds.forEach((s, k) => {
        const d = cellDist(s, c);
        if (d < bestD) {
          bestD = d;
          own = k;
        }
      });
      region[c] = base + own;
      const lat = latOf((c / MAP_W) | 0);
      const lon = lonOf(c % MAP_W);
      const s = sums[own];
      s.x += Math.cos(lat) * Math.cos(lon);
      s.y += Math.sin(lat);
      s.z += Math.cos(lat) * Math.sin(lon);
      s.n++;
    }
    seaSeeds.forEach((_, k) => {
      const s = sums[k];
      const len = Math.hypot(s.x, s.y, s.z) || 1;
      const lat = Math.asin(s.y / len);
      const lon = (((Math.atan2(s.z, s.x) / (Math.PI * 2)) % 1) + 1) % 1;
      regions.push({
        index: base + k,
        id: `${seed}-sea-${k + 1}`,
        biome: 'sea',
        opensAt: Math.min(5, BIOME_OPENS.sea + k),
        lon,
        lat: lat / (Math.PI / 2),
        cx: Math.round(lon * MAP_W - 0.5),
        cy: Math.round((0.5 - lat / Math.PI) * MAP_H - 0.5),
        area: s.n,
        survey: `Survey ${KIND.sea} ${KIND.sea[0]}-${k + 1}`,
      });
    });
  }

  return { seed, w: MAP_W, h: MAP_H, height, temp, moist, cls, region, sea, regions };
}

const cache = new Map<string, RegionSeed[]>();
/** Just the regions, cached: what the rules need. */
export function planetRegions(seed: string): RegionSeed[] {
  const hit = cache.get(seed);
  if (hit) return hit;
  const list = generatePlanet(seed).regions;
  cache.set(seed, list);
  return list;
}

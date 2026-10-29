// Balanced batches: a shop's stock, a wild catch, a tank's starting shoal. One terrain per batch
// (they cannot share a tank), a trophic pyramid (many grazers, fewer omnivores, a few hunters),
// species diversity, and schooling species in school-sized groups.
//
//   batch(seed, n, P, weightOf, { terrain?, region? }) → { place, fish[], pyramid[], species }
//     fish[i] = { set, species, level, school }   level 0 base, 1 middle, 2 top
//
// params.batch: { pyramid: [base, middle, top] shares, diversity 0..1 (how hard a species already
// in the batch is pushed back), maxSchool }. Deterministic: band 7700.

import { roller } from '../../pixel/rng.js';
import { ecotypeFromSeed, placeOf, protoOf, speciesKey } from './ecotype.js';
import { ecology4Of } from './ecology4.js';
import { statsOf } from './stats.js';
import { REGIONS } from './data/terrains.js';

/** Trophic level by diet: 0 eats plants, plankton or detritus; 2 eats fish. */
export const LEVEL_OF_DIET = { herbivore: 0, planktivore: 0, detritivore: 0, omnivore: 1, durophage: 1, carnivore: 2, piscivore: 2 };

const regionsIn = (terrain) => Object.keys(REGIONS).filter((id) => id !== 'unmapped' && REGIONS[id].terrain === terrain);

/** Every species a batch can draw from, with its odds, level and school size. */
function speciesPool(regions, P, weightOf) {
  const n = Math.max(1, Math.min(8, Math.round(P.clusters?.speciesPerNiche ?? 4)));
  const zipf = P.clusters?.zipf ?? 1.1;
  const out = [];
  for (const region of regions) {
    for (const niche of Object.keys(REGIONS[region].niches ?? {})) {
      const w0 = (P.regions?.[region] ?? 1) * (P.niches?.[niche] ?? 1);
      if (w0 <= 0) continue;
      for (let k = 0; k < n; k++) {
        const place = { terrain: REGIONS[region].terrain, region, niche, clade: `k${k}` };
        const { set } = protoOf(place, P, weightOf);
        const level = LEVEL_OF_DIET[ecology4Of(set).diet.value] ?? 1;
        const school = level === 2 ? 1 : statsOf(set).schooling.groupSize;
        out.push({ place, key: speciesKey(place), weight: w0 / (k + 1) ** zipf, level, school });
      }
    }
  }
  return out;
}

/** How many of `n` go to each level; a level with no species hands its share down a level. */
function quotas(n, shares, has) {
  const sum = shares.reduce((a, b) => a + b, 0) || 1;
  const q = shares.map((s) => Math.floor((n * s) / sum));
  q[0] += n - q.reduce((a, b) => a + b, 0);
  for (let l = 2; l >= 0; l--) {
    if (has[l] || !q[l]) continue;
    const to = [l - 1, l - 2, l + 1, l + 2].find((x) => x >= 0 && x <= 2 && has[x]);
    if (to != null) q[to] += q[l];
    q[l] = 0;
  }
  return q;
}

export function batch(seed, n, P, weightOf, pin = {}) {
  const B = P.batch ?? {};
  const { weighted } = roller(`${seed}:batch`, 7700);
  const where = placeOf(`${seed}:batch`, P, pin);
  const regions = pin.region && REGIONS[pin.region] ? [pin.region] : regionsIn(where.terrain);
  const pool = speciesPool(regions.length ? regions : [where.region], P, weightOf);
  const has = [0, 1, 2].map((l) => pool.some((s) => s.level === l));
  const q = quotas(n, B.pyramid ?? [0.6, 0.3, 0.1], has);
  const diversity = Math.min(0.95, B.diversity ?? 0.6);
  const maxSchool = B.maxSchool ?? 6;

  const fish = [];
  const used = new Map();
  let school = 0;
  // Top first: the few hunters are placed before the shoals fill the rest.
  for (const level of [2, 1, 0]) {
    let left = q[level];
    const at = pool.filter((s) => s.level === level);
    for (let pickNo = 0; left > 0 && at.length; pickNo++) {
      const s = at[weighted(at.map((x, i) => [i, x.weight * (1 - diversity) ** (used.get(x.key) ?? 0)]), level * 1000 + pickNo)];
      used.set(s.key, (used.get(s.key) ?? 0) + 1);
      const size = Math.max(1, Math.min(left, s.school, maxSchool));
      for (let j = 0; j < size; j++) {
        const set = ecotypeFromSeed(`${seed}:${fish.length}`, P, weightOf, s.place);
        fish.push({ set, species: s.key, level, school });
      }
      school++;
      left -= size;
    }
  }
  const pyramid = [0, 1, 2].map((l) => fish.filter((f) => f.level === l).length);
  return { place: { terrain: where.terrain, regions }, fish, pyramid, species: used.size };
}

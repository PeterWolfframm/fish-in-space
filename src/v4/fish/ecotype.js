// The ecotype roll: fish4's default way a seed becomes a fish, and where its clustering comes
// from. A seed picks a place and a species before it picks a look:
//
//   terrain → region → niche → clade (species) → individual
//
// Each (region, niche, clade) has a prototype, rolled once from its own seed under the region's
// and niche's leanings: the prototype is the species. An individual keeps each of the
// prototype's fields with chance `cohesion × stickiness[group]` and otherwise rolls its own under
// the same leanings (proportions drift a step, colours move to a near swatch). So fish of one
// clade share a body, a binomial and most of a look; fish of one niche share a guild's shape;
// fish of one region share a palette.
//
// Then mutation pressure: the region scales the chaos odds and may hand out one of its sports
// (a neon morph in the cooling lake, a ghost under the ice). Loci roll last, around bell centres
// the niche has shifted. Deterministic: only the seed and params decide.

import { roller } from '../../pixel/rng.js';
import { oklab } from '../../v3/fish/colors.js';
import { BODIES } from '../../v3/fish/bodies.js';
import { fish4Traits, jitterKey, IDENTITY_IDS } from './genome.js';
import { latentLoci } from './loci.js';
import { TERRAINS, TERRAIN_IDS, NICHES, REGIONS, regionsOf } from './data/terrains.js';
import { BODY_RECORDS, bodyFields } from './bodies/index.js';
import { PIGMENTS } from './data/pigments.js';

const T = fish4Traits;

/** How a field travels with its species. Fields not listed are `other`. */
const GROUPS = {
  fixed: ['body', 'form', 'hybrid'],
  bell: ['length', 'depth', 'head', 'hump', 'stalk', 'eyePos', 'size'],
  colour: ['skin', 'markColor', 'eyeColor', 'pigment', 'markPigment'],
  pattern: ['pattern', 'density', 'markings', 'finPattern', 'scales', 'belly', 'finTint', 'glow', 'sheen', 'iridescence'],
  shape: ['snout', 'dorsal', 'tail', 'pectoral', 'anal', 'pelvic', 'jaw', 'extras', 'forehead', 'gait', 'swim', 'chonk'],
  face: ['eye', 'eyeStyle', 'eyeMount', 'eyeColor2', 'blush', 'quirk'],
  free: ['rarity', 'mood', 'sex', 'stage', 'damage', 'morph', 'geneA', 'geneB', 'chaos', 'generation', 'lineA', 'lineB', 'purity', 'signature', 'relic', 'chroma', 'detail'],
};
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, ids]) => ids.map((id) => [id, g])));
const groupOf = (f) => (f.feature ? 'free' : GROUP_OF[f.id] ?? 'other');

/** Default stickiness per group (params `clusters.stick` overrides). */
export const STICK = { fixed: 1, bell: 0.75, colour: 0.85, pattern: 0.95, shape: 0.95, face: 0.5, other: 0.6, free: 0 };

// Identity fields the place sets (or that stay at their default); `form` and the pigments roll.
const PLACED = new Set(IDENTITY_IDS.filter((id) => !['form', 'pigment', 'markPigment'].includes(id)));
const PALETTE_FIELDS = new Set(['skin', 'markColor', 'pigment', 'markPigment']);
const PIGMENT_FIELDS = new Set(['pigment', 'markPigment']);

// ---------- leanings -------------------------------------------------------------------------

/** Multiply `{ field: { choice: × } }` maps together. */
function stack(into, w, pow = 1) {
  for (const [f, m] of Object.entries(w ?? {})) {
    into[f] ??= {};
    for (const [c, x] of Object.entries(m)) into[f][c] = (into[f][c] ?? 1) * x ** pow;
  }
  return into;
}

/**
 * The leanings of a place: terrain → region → niche, palette (raised to `palette.strength`) and
 * mutation pressure on the chaos odds.
 */
function leaningsOf(regionId, nicheId, P) {
  const region = REGIONS[regionId];
  const niche = NICHES[nicheId] ?? NICHES.unmapped;
  const out = {};
  stack(out, niche.weights);
  stack(out, region.weights);
  stack(out, region.niches?.[nicheId]?.weights);
  const { native, ...pal } = region.palette ?? {};
  stack(out, Object.fromEntries(Object.entries(pal).filter(([f]) => !PIGMENT_FIELDS.has(f))), P.palette?.strength ?? 1);
  const m = mutationOf(regionId, P);
  if (m !== 1) stack(out, { chaos: { stable: 1 / m, chaotic: m * m } });
  return out;
}

/** The region's mutation pressure under params. */
export const mutationOf = (regionId, P) => (REGIONS[regionId]?.mutation ?? 1) ** (P.mutation?.strength ?? 1);

/**
 * Pigment odds for a place and body: the region's palette for its own pigments, the body's own
 * pigments a little more, and `fish3` (no pigment) for the rest of `native`.
 */
function pigmentWeights(fieldId, regionId, rec, P) {
  const region = REGIONS[regionId];
  const native = region.palette?.native ?? 0;
  const pal = region.palette?.[fieldId] ?? {};
  const own = new Set(rec?.pigments?.[fieldId === 'pigment' ? 'skin' : 'mark'] ?? []);
  const strength = P.palette?.strength ?? 1;
  const terrain = region.terrain;
  const w = PIGMENTS.map((p) => {
    if (!p.hex) return 0;
    let x = pal[p.id] != null ? pal[p.id] ** strength : p.terrain === terrain ? 0.4 : 0;
    if (own.has(p.id)) x = Math.max(x, 1) * 1.6;
    return x;
  });
  const sum = w.reduce((a, b) => a + b, 0);
  if (!sum) return PIGMENTS.map((_, i) => (i === 0 ? 1 : 0));
  return w.map((x, i) => (i === 0 ? (1 - native) * sum : native * x));
}

// ---------- rolling --------------------------------------------------------------------------

/** One field's weights: params odds × place leanings (pigments by palette). */
function weightsFor(f, ctx, set) {
  if (PIGMENT_FIELDS.has(f.id)) return pigmentWeights(f.id, ctx.region, ctx.rec, ctx.P);
  const lean = ctx.lean[f.id];
  const w = f.choices.map((c, ci) => ctx.weightOf(f, ci, ctx.P, set) * (lean?.[c.id] ?? 1));
  // A leaning can never make a field unrollable: fall back to the plain odds.
  return w.some((x) => x > 0) ? w : f.choices.map((_, ci) => ctx.weightOf(f, ci, ctx.P, set));
}

const pick = (weighted, f, w, salt) => weighted(f.choices.map((c, ci) => [c.id, w[ci]]), salt);

const labCache = new Map();
const lab = (hex) => {
  let v = labCache.get(hex);
  if (!v) labCache.set(hex, (v = oklab(hex)));
  return v;
};
const dist = (a, b) => {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

/** A colour near the prototype's: the field's odds × closeness in OKLab. */
function nearSwatch(f, w, protoId, weighted, salt) {
  const proto = f.choices.find((c) => c.id === protoId);
  if (!proto?.hex) return protoId;
  const near = f.choices.map((c, ci) => (c.hex ? w[ci] * Math.exp(-dist(proto.hex, c.hex) / 0.07) : 0));
  if (!near.some((x) => x > 0)) return protoId;
  return pick(weighted, f, near, salt);
}

/** One step (sometimes two) along a bell or the size ladder, away from the prototype. */
function drift(f, w, protoId, r, salt, P) {
  const i = f.choices.findIndex((c) => c.id === protoId);
  const steps = r(salt + 1) < 0.2 * (P.clusters?.drift ?? 1) ? 2 : 1;
  const dir = r(salt) < 0.5 ? -1 : 1;
  for (const d of [dir * steps, -dir * steps, dir, -dir]) {
    const j = i + d;
    if (j >= 0 && j < f.choices.length && w[j] > 0) return f.choices[j].id;
  }
  return protoId;
}

// ---------- places and species ---------------------------------------------------------------

const weightedKey = (weighted, entries, salt) => (entries.some(([, w]) => w > 0) ? weighted(entries, salt) : entries[0]?.[0]);

/** Terrain odds: params over the terrain defaults; locked ones only when unlocked. */
export function terrainWeights(P) {
  const unlocked = new Set(P.unlocked ?? []);
  return TERRAIN_IDS.map((id) => {
    const t = TERRAINS[id];
    if (t.locked && !unlocked.has(id)) return [id, 0];
    return [id, P.terrains?.[id] ?? (t.locked ? 1 : t.weight)];
  });
}

/**
 * Where a seed lives: `{ terrain, region, niche, clade }`. `pin` fixes any of them; the levels
 * below a pinned one roll inside it (a pinned region implies its terrain).
 */
export function placeOf(seed, P, pin = {}) {
  const { weighted } = roller(seed, 5000);
  const region0 = pin.region && REGIONS[pin.region] ? pin.region : null;
  const terrain = region0 ? REGIONS[region0].terrain : pin.terrain && TERRAINS[pin.terrain] ? pin.terrain : weightedKey(weighted, terrainWeights(P), 1);
  const region = region0 ?? weightedKey(weighted, regionsOf(terrain).map((id) => [id, P.regions?.[id] ?? 1]), 2) ?? 'unmapped';
  const niches = Object.keys(REGIONS[region].niches);
  const niche = pin.niche && niches.includes(pin.niche) ? pin.niche : weightedKey(weighted, niches.map((id) => [id, P.niches?.[id] ?? 1]), 3) ?? 'unmapped';
  const n = Math.max(1, Math.min(8, Math.round(P.clusters?.speciesPerNiche ?? 4)));
  const zipf = P.clusters?.zipf ?? 1.1;
  const clade = pin.clade ?? weighted(Array.from({ length: n }, (_, k) => [`k${k}`, 1 / (k + 1) ** zipf]), 4);
  return { terrain, region, niche, clade };
}

const protoCache = new WeakMap();

/**
 * A species: the prototype every fish of `(region, niche, clade)` is varied from. Rolled from
 * its own seed, so it does not depend on which fish asked; cached per params object.
 */
export function protoOf(place, P, weightOf) {
  let byParams = protoCache.get(P);
  if (!byParams) protoCache.set(P, (byParams = new Map()));
  const key = `${place.region}/${place.niche}/${place.clade}`;
  const hit = byParams.get(key);
  if (hit) return hit;

  const { weighted, chance } = roller(`proto:${key}`, 5100);
  const pool = REGIONS[place.region].niches?.[place.niche]?.bodies ?? { torpedo: 1 };
  // The niche's clades share its body pool between them: a golden-ratio sequence over the
  // cumulative odds, so four clades of a 4:1 pool are three of one body and one of the other, not
  // whatever four independent rolls happen to give.
  const entries = Object.entries(pool).map(([id, w]) => [id, w * (P.bodies?.[id] ?? 1) * (BODY_RECORDS[id]?.weight ?? 1)]);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  const k = Number(place.clade.slice(1)) || 0;
  let x = ((roller(`proto:${place.region}/${place.niche}`, 5100).r(1) + k * 0.6180339887) % 1) * total;
  let bodyId = entries[entries.length - 1][0];
  for (const [id, w] of entries) {
    if (w > 0 && x < w) {
      bodyId = id;
      break;
    }
    x -= w;
  }
  const rec = BODY_RECORDS[bodyId];
  const ctx = { P, region: place.region, rec, lean: leaningsOf(place.region, place.niche, P), weightOf };

  const out = { ...place, ...bodyFields(bodyId), hybrid: 'none' };
  for (const f of T.fields) {
    if (f.locus || PLACED.has(f.id) || GROUP_OF[f.id] === 'fixed') continue;
    out[f.id] = pick(weighted, f, weightsFor(f, ctx, out), f.salt);
  }
  // The body's own looks, as fish3 leans them.
  const prefer = rec?.arch?.prefer ?? BODIES[bodyId]?.prefer;
  if (prefer) {
    Object.entries(prefer).forEach(([f, v], i) => {
      if (chance(P.bodyPrefer ?? 0.6, 3300 + i)) out[f] = v;
    });
  }
  const proto = { set: T.normalize(out), ctx };
  if (byParams.size > 2000) byParams.clear();
  byParams.set(key, proto);
  return proto;
}

/** Niche-shifted locus odds: the bell's centre moves `loci[locus]` allele steps. */
function lociWeights(nicheId, P, weightOf) {
  const shifts = NICHES[nicheId]?.loci ?? {};
  const k = P.clusters?.lociStrength ?? 1;
  return (f, ci) => {
    const shift = Math.round((shifts[f.locus] ?? 0) * k);
    const j = Math.max(0, Math.min(f.choices.length - 1, ci - shift));
    return weightOf(f, j, P);
  };
}

/**
 * One fish under the ecotype algorithm. `weightOf` is index.js's (params odds per choice);
 * `place` may be forced (studio, batches) — anything missing is rolled.
 */
export function ecotypeFromSeed(seed, P, weightOf, place) {
  const where = placeOf(seed, P, place ?? {});
  const proto = protoOf(where, P, weightOf);
  const { ctx } = proto;
  const { weighted, r } = roller(seed, 5200);
  const cohesion = P.clusters?.cohesion ?? 0.9;
  const stick = { ...STICK, ...(P.clusters?.stick ?? {}) };

  const out = { ...where };
  for (const f of T.fields) {
    if (f.locus || PLACED.has(f.id)) continue;
    const g = groupOf(f);
    const pv = proto.set[f.id];
    if (g === 'fixed') {
      out[f.id] = pv;
      continue;
    }
    if (g !== 'free' && r(f.salt) < cohesion * (stick[g] ?? 0.6)) {
      out[f.id] = pv;
      continue;
    }
    const w = weightsFor(f, ctx, out);
    if (g === 'bell') out[f.id] = drift(f, w, pv, r, f.salt + 11, P);
    else if (g === 'colour') out[f.id] = PIGMENT_FIELDS.has(f.id) && pv === 'fish3' ? pv : nearSwatch(f, w, pv, weighted, f.salt + 13);
    else out[f.id] = pick(weighted, f, w, f.salt + 17);
  }

  // Mutation pressure: a region's own sports.
  const sports = REGIONS[where.region]?.sports;
  if (sports && r(9001) < (P.mutation?.sport ?? 0.03) * mutationOf(where.region, P)) {
    const field = weighted(Object.entries(sports).map(([fid, m]) => [fid, Object.values(m).reduce((a, b) => a + b, 0)]), 9002);
    out[field] = weighted(Object.entries(sports[field]), 9003);
  }

  let set = T.normalize(out);
  Object.assign(set, latentLoci(jitterKey(set), lociWeights(where.niche, P, weightOf)));
  set = T.normalize(set);
  return set;
}

/** A species' identity, for atlases and tests: `region/niche/clade`. */
export const speciesKey = (set) => `${set.region}/${set.niche}/${set.clade}`;


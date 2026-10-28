// Every generator pixelforge knows. Each one has the same shape, so the app and the CLI are
// written once against it:
//
//   { id, label, game, size: {w, h}, bg, traits,      traits: a kit defineTraits() system
//     fromSeed(seed, opts) → genome,                   a trait set (plus `seed` where it matters)
//     anims: [{ id, frames, fps, continuous? }],
//     frame(genome, animId, i) → IndexedImage,         {w, h, data, palette}
//     at?(genome, t) → IndexedImage,                   continuous anims: any t in 0..1
//     breed?(a, b, seed), normalize?(g), options? }
//
// v2 generators (src/v2/) add: version: 2, family, sizes: [{id, w, h}], sizeField, anchor,
// sizeOf(genome) → {w, h} (a genome's own canvas: size classes at constant pixel density, so
// sprites may be wider than tall), fromCode(code) (also takes the family's v1 codes).
//
// v1 IS FROZEN. src/gen/** holds the historic algorithms and must keep drawing exactly what it
// draws today (test/parity.test.mjs, test/v1-frozen.test.mjs). New work goes in src/v2/.
//
// generation: 'old' marks those painters. fish3 and plant3 grow the same creatures and stay on that line.

import pilot from './pilot.js';
import fish from './fish.js';
import waterplant from './waterplant.js';
import plant, { plant32 } from './plant.js';
import pilot2 from '../v2/pilot/index.js';
import fish2 from '../v2/fish/index.js';
import fish3 from '../v3/fish/index.js';
import plant3 from '../v3/plant/index.js';
import waterplant2 from '../v2/waterplant/index.js';
import plant2 from '../v2/plant/index.js';

// Historic v1 stays frozen in src/gen. `generation` is stamped here so those files are not edited.
const v1 = (gen, family) => ({ ...gen, version: 1, family, generation: 'old' });
const v2old = (gen) => ({ ...gen, generation: 'old' });

export const GENERATORS = [
  v1(pilot, 'pilot'),
  v1(fish, 'fish'),
  v1(waterplant, 'waterplant'),
  v1(plant, 'plant'),
  v1(plant32, 'plant'),
  v2old(pilot2),
  v2old(fish2),
  fish3,
  plant3,
  v2old(waterplant2),
  v2old(plant2),
];

/** A genome's canvas: its own size class for v2, the generator's one size for v1. */
export const sizeOf = (gen, genome) => (gen.sizeOf ? gen.sizeOf(genome) : gen.size);

export const generator = (id) => GENERATORS.find((g) => g.id === id) ?? null;

/** Two genomes into one: the generator's own breeding if it has one, else combine + drift. */
export function breedWith(gen, a, b, seed, rate = 0.08) {
  if (gen.breed) return gen.breed(a, b, seed);
  const child = gen.traits.vary(gen.traits.combine(a, b, seed), rate, `${seed}:mut`);
  return gen.normalize ? gen.normalize({ ...child, seed: `${seed}` }) : child;
}

/** The genome a shareable code describes, or null if it is not one of this generator's codes. */
export function fromCode(gen, code) {
  const decoded = gen.fromCode ? gen.fromCode(code) : gen.traits.decode(code);
  if (!decoded) return null;
  return gen.normalize ? gen.normalize({ ...decoded, seed: String(code).trim().toLowerCase() }) : decoded;
}

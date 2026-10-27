// Every generator pixelforge knows. Each one has the same shape, so the app and the CLI are
// written once against it:
//
//   { id, label, game, size: {w, h}, bg, traits,      traits: a kit defineTraits() system
//     fromSeed(seed, opts) → genome,                   a trait set (plus `seed` where it matters)
//     anims: [{ id, frames, fps, continuous? }],
//     frame(genome, animId, i) → IndexedImage,         {w, h, data, palette}
//     at?(genome, t) → IndexedImage,                   continuous anims: any t in 0..1
//     breed?(a, b, seed), normalize?(g), options? }

import pilot from './pilot.js';
import fish from './fish.js';
import waterplant from './waterplant.js';
import plant, { plant32 } from './plant.js';

export const GENERATORS = [pilot, fish, waterplant, plant, plant32];

export const generator = (id) => GENERATORS.find((g) => g.id === id) ?? null;

/** Two genomes into one: the generator's own breeding if it has one, else combine + drift. */
export function breedWith(gen, a, b, seed, rate = 0.08) {
  if (gen.breed) return gen.breed(a, b, seed);
  const child = gen.traits.vary(gen.traits.combine(a, b, seed), rate, `${seed}:mut`);
  return gen.normalize ? gen.normalize({ ...child, seed: `${seed}` }) : child;
}

/** The genome a shareable code describes, or null if it is not one of this generator's codes. */
export function fromCode(gen, code) {
  const decoded = gen.traits.decode(code);
  if (!decoded) return null;
  return gen.normalize ? gen.normalize({ ...decoded, seed: String(code).trim().toLowerCase() }) : decoded;
}

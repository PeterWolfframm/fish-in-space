/**
 * What a fish is: one declarative field list that drives rolling, breeding, the shareable code,
 * the renderer and the editor UI, so those five can never disagree.
 *
 * Every field owns a fixed salt, so a trait can be added or retuned without reshuffling the
 * others — which matters here more than anywhere, because a fish's code is its identity and a
 * mutation in fin shape must not quietly repaint its body.
 *
 * Append new fields at the end only: old codes have to keep decoding.
 */

import { defineTraits } from '../../pixel/traits.js';

import { BODY_COLORS, MARK_COLORS, EYE_COLORS } from './palettes.js';

/** A fish genome. Field ids map to choice ids; read colours etc. through `choiceOf`. */

const swatches = (list) =>
  list.map((s) => ({ id: s.id, hex: s.hex, label: s.label }));

const opts = (...pairs) =>
  pairs.map(([id, label]) => ({ id, label }));

/**
 * Rarity gates the showy traits. It is deliberately the first field: `when` predicates read it,
 * and a trait nothing gates is a trait nobody chases.
 */
const RARITY = opts(['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['myth', 'Mythic']);

const isRare = (set) => set.rarity === 'rare' || set.rarity === 'myth';

export const fishTraits = defineTraits({
  prefix: 'f',
  fields: [
    // --- identity -------------------------------------------------------------------------
    {
      id: 'rarity',
      label: 'Rarity',
      group: 'identity',
      choices: RARITY,
      weights: [70, 22, 7, 1],
      salt: 16,
      // Rarity is the one trait that should not drift: a common fish's offspring staying common
      // is what makes a rare one worth breeding for.
      volatility: 0.25,
      dominance: 0.5,
    },

    // --- shape ----------------------------------------------------------------------------
    {
      id: 'body',
      label: 'Body',
      group: 'shape',
      salt: 32,
      dominance: 0.5,
      choices: opts(
        ['torpedo', 'Torpedo'],
        ['round', 'Round'],
        ['disc', 'Disc'],
        ['eel', 'Eel'],
        ['arrow', 'Arrow'],
        ['pufferish', 'Puffer'],
        // Appended after the first six so older codes keep decoding to the same body.
        ['shark', 'Shark'],
        ['hatchet', 'Hatchet']
      ),
      weights: [26, 20, 12, 8, 14, 4, 10, 6],
    },
    {
      id: 'size',
      label: 'Size',
      group: 'shape',
      salt: 48,
      volatility: 1.4,
      choices: opts(['tiny', 'Tiny'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['huge', 'Huge']),
      weights: [10, 26, 34, 22, 8],
      default: 'medium',
    },
    {
      id: 'snout',
      label: 'Snout',
      group: 'shape',
      salt: 64,
      choices: opts(['blunt', 'Blunt'], ['pointed', 'Pointed'], ['long', 'Long'], ['under', 'Underbite']),
      weights: [40, 32, 18, 10],
    },

    // --- colour ---------------------------------------------------------------------------
    {
      id: 'skin',
      label: 'Body colour',
      group: 'colour',
      colors: true,
      salt: 80,
      choices: swatches(BODY_COLORS),
      dominance: 0.5,
    },
    {
      id: 'belly',
      label: 'Belly',
      group: 'colour',
      salt: 96,
      choices: opts(['none', 'None'], ['soft', 'Soft'], ['pale', 'Pale'], ['white', 'White']),
      weights: [14, 34, 34, 18],
      default: 'soft',
    },
    {
      id: 'pattern',
      label: 'Pattern',
      group: 'colour',
      salt: 112,
      volatility: 1.3,
      choices: opts(
        ['plain', 'Plain'],
        ['bars', 'Bars'],
        ['stripe', 'Side stripe'],
        ['spots', 'Spots'],
        ['mottle', 'Mottled'],
        ['saddle', 'Saddles'],
        ['tiger', 'Tiger']
      ),
      weights: [22, 18, 16, 16, 12, 10, 6],
    },
    {
      id: 'markColor',
      label: 'Pattern colour',
      group: 'colour',
      colors: true,
      salt: 128,
      choices: swatches(MARK_COLORS),
      when: (set) => set.pattern !== 'plain',
      gateHint: 'needs a pattern',
    },
    {
      id: 'density',
      label: 'Pattern density',
      group: 'colour',
      salt: 144,
      volatility: 1.5,
      choices: opts(['sparse', 'Sparse'], ['even', 'Even'], ['dense', 'Dense']),
      weights: [30, 45, 25],
      default: 'even',
      when: (set) => set.pattern !== 'plain',
      gateHint: 'needs a pattern',
    },

    // --- fins -----------------------------------------------------------------------------
    {
      id: 'dorsal',
      label: 'Dorsal fin',
      group: 'fins',
      salt: 160,
      choices: opts(['low', 'Low'], ['tall', 'Tall'], ['spiny', 'Spiny'], ['sail', 'Sail'], ['none', 'None']),
      weights: [34, 26, 18, 14, 8],
    },
    {
      id: 'tail',
      label: 'Tail',
      group: 'fins',
      salt: 176,
      choices: opts(['fan', 'Fan'], ['fork', 'Forked'], ['round', 'Round'], ['lyre', 'Lyre'], ['veil', 'Veil']),
      weights: [30, 26, 20, 14, 10],
    },
    {
      id: 'pectoral',
      label: 'Side fin',
      group: 'fins',
      salt: 192,
      choices: opts(['small', 'Small'], ['round', 'Round'], ['long', 'Long'], ['wing', 'Wing']),
      weights: [36, 30, 22, 12],
    },
    {
      id: 'finTint',
      label: 'Fin colour',
      group: 'fins',
      salt: 208,
      choices: opts(['match', 'Matching'], ['light', 'Lighter'], ['dark', 'Darker'], ['accent', 'Accent'], ['clear', 'Translucent']),
      weights: [30, 22, 16, 18, 14],
    },

    // --- face -----------------------------------------------------------------------------
    {
      id: 'eye',
      label: 'Eye size',
      group: 'face',
      salt: 224,
      choices: opts(['small', 'Small'], ['normal', 'Normal'], ['big', 'Big']),
      weights: [24, 52, 24],
      default: 'normal',
    },
    {
      id: 'eyeColor',
      label: 'Eye colour',
      group: 'face',
      colors: true,
      salt: 240,
      choices: swatches(EYE_COLORS),
    },

    // --- the chase ------------------------------------------------------------------------
    {
      id: 'glow',
      label: 'Bioluminescence',
      group: 'rare',
      salt: 256,
      choices: opts(['none', 'None'], ['spots', 'Glow spots'], ['edge', 'Glowing fins'], ['full', 'Luminous']),
      weights: [40, 30, 20, 10],
      // Only rare fish can glow at all, and the trait is recessive, so it takes work to fix in a
      // line even once it appears.
      when: isRare,
      gateHint: 'needs a rare fish',
      dominance: 0.25,
      volatility: 0.6,
    },
    {
      id: 'sheen',
      label: 'Sheen',
      group: 'rare',
      salt: 272,
      choices: opts(['none', 'None'], ['pearl', 'Pearl'], ['metal', 'Metallic']),
      weights: [50, 30, 20],
      when: isRare,
      gateHint: 'needs a rare fish',
      dominance: 0.3,
    },
  ],
});

/** The hex a colour field holds. */
export const hexOf = (genome, fieldId) =>
  (fishTraits.choiceOf(genome, fieldId)?.hex) ?? '#888888';

/** The human label a field's value carries. */
export const labelOf = (genome, fieldId) =>
  (fishTraits.choiceOf(genome, fieldId)?.label) ?? '';

/** A fish from a seed — a name, an id, anything stable. */
export const fishFromSeed = (seed) => fishTraits.fromSeed(seed);

/** A fish's short, shareable code. */
export const encodeFish = (genome) => fishTraits.encode(genome);

/** The fish a code describes, or null if it is not a fish code. */
export const decodeFish = (code) => fishTraits.decode(code);

/**
 * Breed two fish. Each trait comes from one parent, biased by that trait's dominance, then a
 * few traits drift. `seed` makes a given pairing repeatable — pass the egg's id.
 */
export function breed(a, b, seed, mutationRate = 0.08) {
  return fishTraits.vary(fishTraits.combine(a, b, seed), mutationRate, `${seed}:mut`);
}

/** How unusual a fish is, 0..1. Drives rarity badges and breeding odds, not the art. */
export function rarityScore(genome) {
  const tier = ['common', 'uncommon', 'rare', 'myth'].indexOf(genome.rarity ?? 'common');
  const base = tier < 0 ? 0 : tier / 3;
  const extras = (genome.glow && genome.glow !== 'none' ? 0.1 : 0) + (genome.sheen && genome.sheen !== 'none' ? 0.1 : 0);
  return Math.min(1, base + extras);
}

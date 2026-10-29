// fish4 genome: every fish3 field in fish3 order with fish3 salts (so the same seed rolls the same
// fish3 underneath, and an f3. or v1 code opens as the same fish), then fish4's own fields:
//
//   chroma        heritable vividness (v1's colourful look, as a gene), salt 2048
//   loci          fifteen diploid quantitative loci (loci.js), salts 2064..
//   features      visual feature modules (features/registry.js), salts 3072..
//
// Rarity gains Epic and Legendary, appended so fish3's digits stay valid; tier order lives in
// rules.js TIERS. Append only, salts fixed: a code is a fish's identity.

import { defineTraits } from '../../pixel/traits.js';
import { fish3Traits, fromV1Code, jitterKey as jitterKey3 } from '../../v3/fish/genome.js';
import { LOCUS_FIELDS, latentLoci } from './loci.js';
import { FEATURE_FIELDS } from './features/registry.js';
import { tierRank } from './rules.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));

/** At least Rare (fish3's `isRare`, widened to the new tiers). */
const rareUp = (set) => tierRank(set.rarity) >= tierRank('rare');
/** Rare to Legendary: Mythic keeps fish3's rule of no signature. */
const signatureTier = (set) => ['rare', 'epic', 'legendary'].includes(set.rarity);

const OVERRIDE = {
  rarity: (f) => ({
    ...f,
    choices: [...f.choices, ...opts(['epic', 'Epic'], ['legendary', 'Legendary'])],
    weights: [...f.weights, 0, 0],
  }),
  iridescence: (f) => ({ ...f, when: rareUp }),
  signature: (f) => ({ ...f, when: signatureTier }),
};

export const FISH3_IDS = fish3Traits.fields.map((f) => f.id);

/** Chroma steps: c0 is fish3's own colour, each step a stronger OKLab chroma push. */
export const CHROMA = opts(['c0', 'As painted'], ['c1', 'Bright'], ['c2', 'Brighter'], ['c3', 'Vivid'], ['c4', 'Very vivid'], ['c5', 'Electric'], ['c6', 'Neon-saturated']);

export const fish4Traits = defineTraits({
  prefix: 'f4.',
  fields: [
    ...fish3Traits.fields.map((f, i) => {
      // Pin the position-derived salt, so it survives any reshuffle of this list.
      const pinned = { ...f, salt: f.salt ?? (i + 1) * 16 };
      return OVERRIDE[f.id] ? OVERRIDE[f.id](pinned) : pinned;
    }),
    { id: 'chroma', label: 'Vividness', group: 'colour', choices: CHROMA, weights: [1, 0, 0, 0, 0, 0, 0], default: 'c0', salt: 2048, volatility: 0.8 },
    ...LOCUS_FIELDS,
    ...FEATURE_FIELDS,
  ],
});

export const V4_IDS = fish4Traits.fields.slice(FISH3_IDS.length).map((f) => f.id);
export const FEATURE_IDS = FEATURE_FIELDS.map((f) => f.id);

/** The fish3 genome the painter, names and ecology read: new tiers drawn as their fish3 kin. */
export function toFish3(set) {
  const out = {};
  for (const id of FISH3_IDS) out[id] = set[id];
  out.rarity = set.rarity === 'epic' || set.rarity === 'legendary' ? 'rare' : set.rarity;
  return fish3Traits.normalize(out);
}

/** The per-fish look key (fish3's), shared by both generators so imported fish keep every pixel. */
export const jitterKey = (set) => jitterKey3(toFish3(set));

/** A fish3 genome as fish4: same fish, latent loci rolled from its look, no new features. */
export function fromFish3(f3, weightOf) {
  const base = fish4Traits.defaults();
  const set = { ...base, ...fish3Traits.normalize(f3) };
  Object.assign(set, latentLoci(jitterKey3(fish3Traits.normalize(f3)), weightOf));
  return fish4Traits.normalize(set);
}

/** Any fish code: f4., f3. or v1 `f…`. Null if it is none of them. */
export function decodeAny(code) {
  const text = String(code ?? '').trim().toLowerCase();
  if (text.startsWith('f4.')) return fish4Traits.decode(text);
  const f3 = fish3Traits.decode(text) ?? fromV1Code(text);
  return f3 ? fromFish3(f3) : null;
}

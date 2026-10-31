// fish4 genome: every fish3 field in fish3 order with fish3 salts (so the same seed rolls the same
// fish3 underneath, and an f3. or v1 code opens as the same fish), then fish4's own fields:
//
//   chroma        heritable vividness (v1's colourful look, as a gene), salt 2048
//   loci          fifteen diploid quantitative loci (loci.js), salts 2064..
//   features      visual feature modules (features/registry.js), salts 3072..
//   identity      where a fish comes from and what it is, salts 2560..: terrain, region, niche,
//                 clade (its species within the niche), form (fish4's own bodies), pigment and
//                 markPigment (fish4's swatches) and detail (how giants are drawn). All default
//                 to fish3's meaning, so an f3. or v1 code, or an f4. code written before these
//                 fields, is a water fish of fish3's body and colour drawn as fish3 drew it.
//   fin dress     edge, heights, rake, rear dorsal, keel (fins.js), salts 2688..; their first
//                 choice / centre step paints nothing new
//
// Rarity gains Epic and Legendary, appended so fish3's digits stay valid; tier order lives in
// rules.js TIERS. Append only, salts fixed: a code is a fish's identity.

import { defineTraits } from '../../pixel/traits.js';
import { fish3Traits, fromV1Code, jitterKey as jitterKey3 } from '../../v3/fish/genome.js';
import { LOCUS_FIELDS, latentLoci } from './loci.js';
import { FEATURE_FIELDS } from './features/registry.js';
import { FIN_FIELDS } from './fins.js';
import { tierRank } from './rules.js';
import { TERRAIN_IDS, REGION_IDS, NICHE_IDS, REGIONS } from './data/terrains.js';
import { FORM_IDS, BODY_RECORDS, isNewForm } from './bodies/index.js';
import { PIGMENTS } from './data/pigments.js';

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

/** Clades: the species within a niche (k0..k7), or `wild` for a fish of no known species. */
export const CLADES = ['wild', ...Array.from({ length: 8 }, (_, i) => `k${i}`)];

const first = (n) => Array.from({ length: n }, (_, i) => (i === 0 ? 1 : 0));
const label = (id) => id.replace(/^./, (c) => c.toUpperCase());

/**
 * Identity fields. Their base weights put every fish on the defaults (fish3's meaning), so the
 * `classic` roll is fish3's; the ecotype roll (ecotype.js) sets them outright. Gates keep a
 * stored fish consistent: a region of its terrain, a niche of its region, a form of its terrain.
 */
const IDENTITY_FIELDS = [
  { id: 'terrain', label: 'Terrain', group: 'origin', choices: TERRAIN_IDS.map((id) => ({ id, label: label(id) })), salt: 2560 },
  { id: 'region', label: 'Region', group: 'origin', choices: REGION_IDS.map((id) => ({ id, label: REGIONS[id].label })), salt: 2576, when: (s) => s.region === 'unmapped' || REGIONS[s.region]?.terrain === s.terrain },
  { id: 'niche', label: 'Niche', group: 'origin', choices: NICHE_IDS.map((id) => ({ id, label: label(id) })), salt: 2592, when: (s) => s.niche === 'unmapped' || Boolean(REGIONS[s.region]?.niches?.[s.niche]) },
  { id: 'clade', label: 'Clade', group: 'origin', choices: CLADES.map((id) => ({ id, label: id === 'wild' ? 'Wild' : `Clade ${id.slice(1)}` })), salt: 2608, when: (s) => s.clade === 'wild' || s.niche !== 'unmapped' },
  { id: 'form', label: 'Form', group: 'shape', choices: FORM_IDS.map((id) => ({ id, label: id === 'fish3' ? 'Fish3 body' : BODY_RECORDS[id].label })), salt: 2624, when: (s) => s.form === 'fish3' || BODY_RECORDS[s.form]?.terrain === s.terrain },
  { id: 'pigment', label: 'Pigment', group: 'colour', choices: PIGMENTS.map((p) => ({ id: p.id, label: p.label, hex: p.hex })), salt: 2640 },
  { id: 'markPigment', label: 'Mark pigment', group: 'colour', choices: PIGMENTS.map((p) => ({ id: p.id, label: p.label, hex: p.hex })), salt: 2656 },
  { id: 'detail', label: 'Detail', group: 'shape', choices: [{ id: 'v3', label: 'Fish3 detail' }, { id: 'v4', label: 'Scaled detail' }, { id: 'v4e', label: 'Scaled detail, big eyes' }], salt: 2672 },
].map((f) => ({ ...f, weights: first(f.choices.length), default: f.choices[0].id, volatility: 0, dominance: 0.5 }));

export const IDENTITY_IDS = IDENTITY_FIELDS.map((f) => f.id);
/** How many feature modules existed before the identity fields (the helmet). */
const EARLY_FEATURES = 1;

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
    // Codes are positional: the features written before the identity block stay before it, any
    // later feature goes after it.
    ...FEATURE_FIELDS.slice(0, EARLY_FEATURES),
    ...IDENTITY_FIELDS,
    ...FIN_FIELDS,
    // Every feature module after the helmet: new modules append here, at the end of the code.
    ...FEATURE_FIELDS.slice(EARLY_FEATURES),
  ],
});

export const V4_IDS = fish4Traits.fields.slice(FISH3_IDS.length).map((f) => f.id);
export const FEATURE_IDS = FEATURE_FIELDS.map((f) => f.id);

/**
 * The fish3 genome the painter, names and ecology read: new tiers drawn as their fish3 kin, and a
 * fish4 form as its kin body (its own archetype goes in through `extOf`, bodies/index.js).
 */
export function toFish3(set) {
  const out = {};
  for (const id of FISH3_IDS) out[id] = set[id];
  out.rarity = set.rarity === 'epic' || set.rarity === 'legendary' ? 'rare' : set.rarity;
  if (isNewForm(set.form)) {
    out.body = BODY_RECORDS[set.form].kin;
    out.hybrid = 'none';
  }
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

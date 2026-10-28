// Fish v3 genome: every v1 field, in v1 order with v1 salts, so the same seed rolls the same fish
// where the fields overlap and a v1 code opens here as the same fish, upgraded. New choices are
// appended to v1's fields; new fields are appended to the list (salts from 1024 up). The `f3.`
// prefix can never be read as a v1 `f…` or a v2 `f.…` code.
//
// Special genes are diploid: two allele fields (geneA, geneB). What a fish shows is worked out
// from both in phenotype.js, so a fish can carry albino without being albino.

import { defineTraits } from '../../pixel/traits.js';
import { fishTraits } from '../../gen/fish/genome.js';
import { EYE_COLORS } from '../../gen/fish/palettes.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));
const isRare = (set) => set.rarity === 'rare' || set.rarity === 'myth';
const notCommon = (set) => set.rarity !== 'common';

/** Seven steps around a centre, for the heritable proportions. */
const STEPS = opts(['n3', '−3'], ['n2', '−2'], ['n1', '−1'], ['0', '·'], ['p1', '+1'], ['p2', '+2'], ['p3', '+3']);
const BELL = [3, 8, 18, 42, 18, 8, 3];
export const STEP_IDS = STEPS.map((s) => s.id);
/** A proportion step as a number, −3..3. */
export const stepOf = (id) => Math.max(0, STEP_IDS.indexOf(id ?? '0')) - 3;

/** Bodies appended to v1's eight. */
export const NEW_BODIES = [
  ['piranha', 'Piranha', 7], ['boxfish', 'Boxfish', 4], ['cowfish', 'Cowfish', 3], ['trigger', 'Triggerfish', 5],
  ['mola', 'Sunfish (mola)', 2], ['lionfish', 'Lionfish', 3], ['betta', 'Betta', 5], ['koi', 'Koi', 6],
  ['catfish', 'Catfish', 6], ['angler', 'Anglerfish', 2], ['barracuda', 'Barracuda', 4], ['needle', 'Needlefish', 3],
  ['swordfish', 'Swordfish', 3], ['discus', 'Discus', 4], ['butterfly', 'Butterflyfish', 4], ['clown', 'Clownfish', 5],
  ['tetra', 'Tetra', 6], ['guppy', 'Guppy', 6], ['oarfish', 'Oarfish', 1], ['sturgeon', 'Sturgeon', 2],
  ['coelacanth', 'Coelacanth', 1], ['blobfish', 'Blobfish', 1], ['flyingfish', 'Flying fish', 2], ['knifefish', 'Knifefish', 2],
];

/** Hybrid bodies: never rolled, only bred (see bodies.js HYBRIDS for the parents). */
export const HYBRID_IDS = [
  ['chompball', 'Chompball'], ['noodleshark', 'Noodleshark'], ['kitefish', 'Kitefish'], ['whiskerkoi', 'Whiskerkoi'],
  ['moonblob', 'Moonblob'], ['lancefish', 'Lancefish'], ['pincushion', 'Pincushion'], ['silkkoi', 'Silk koi'],
  ['lanternbite', 'Lanternbite'], ['jesterbox', 'Jesterbox'], ['sawdisc', 'Sawdisc'], ['dragonling', 'Dragonling'],
  ['gliderhatch', 'Gliderhatch'], ['neonfan', 'Neonfan'], ['plumpike', 'Plumpike'], ['fossilcat', 'Fossilcat'],
];

/** Alleles a gene slot can hold. Recessive ones need two copies to show. */
export const ALLELES = opts(
  ['wild', 'Wild type'],
  ['albino', 'Albino (recessive)'],
  ['leucistic', 'Leucistic (recessive)'],
  ['melanistic', 'Melanistic (recessive)'],
  ['axanthic', 'Axanthic (recessive)'],
  ['ghost', 'Glass / ghost (recessive)'],
  ['bubble', 'Bubble eye (recessive)'],
  ['xanthic', 'Golden (dominant)'],
  ['longfin', 'Long fin (dominant)'],
  ['koi', 'Koi white (codominant)']
);
const ALLELE_WEIGHTS = [70, 4, 3, 4, 3, 2, 3, 3, 4, 4];

const APPEND = {
  body: [opts(...NEW_BODIES.map(([id, label]) => [id, label])), NEW_BODIES.map(([, , w]) => w)],
  size: [opts(['giant', 'Giant']), [4]],
  pattern: [opts(['leopard', 'Leopard bars'], ['dashdot', 'Dash-dot'], ['patches', 'Koi patches'], ['reticulate', 'Net'], ['chevron', 'Chevrons']), [4, 3, 6, 4, 4]],
  dorsal: [opts(['double', 'Double'], ['streamer', 'Streamer'], ['crest', 'Crest'], ['venom', 'Venom spines'], ['finlets', 'Finlets'], ['adipose', 'With adipose']), [8, 4, 5, 3, 3, 6]],
  tail: [opts(['lunate', 'Lunate'], ['truncate', 'Square'], ['double', 'Double'], ['sword', 'Sword'], ['hetero', 'Shark lobe'], ['paddle', 'Paddle'], ['streamer', 'Streamers'], ['lobed', 'Three-lobed'], ['pin', 'Pin']), [8, 6, 3, 4, 4, 5, 3, 2, 2]],
  pectoral: [opts(['fan', 'Fan'], ['glider', 'Glider wing'], ['lobed', 'Lobed'], ['frilly', 'Frilly']), [5, 3, 3, 5]],
};

const v1Fields = fishTraits.fields.map((f) => {
  const extra = APPEND[f.id];
  if (!extra) return f;
  const weights = f.weights ?? f.choices.map(() => 1);
  return { ...f, choices: [...f.choices, ...extra[0]], weights: [...weights, ...extra[1]] };
});

let salt = 1024;
const field = (spec) => ({ salt: (salt += 16), ...spec });
const step = (id, label, extra = {}) => field({ id, label, group: 'proportions', choices: STEPS, weights: BELL, default: '0', volatility: 1.3, ...extra });

export const fish3Traits = defineTraits({
  prefix: 'f3.',
  fields: [
    ...v1Fields,
    // --- proportions: heritable, blended when bred --------------------------------------------
    step('length', 'Length'),
    step('depth', 'Depth'),
    step('head', 'Head'),
    step('hump', 'Hump'),
    step('stalk', 'Tail stalk'),
    step('eyePos', 'Eye position'),
    field({ id: 'quirk', label: 'Quirkiness', group: 'proportions', choices: opts(['neat', 'Neat'], ['natural', 'Natural'], ['wonky', 'Wonky']), weights: [28, 57, 15], default: 'natural' }),
    field({ id: 'chonk', label: 'Chonk', group: 'proportions', choices: opts(['lean', 'Lean'], ['fit', 'Fit'], ['plump', 'Plump'], ['round', 'Round']), weights: [15, 50, 25, 10], default: 'fit' }),
    // --- face ---------------------------------------------------------------------------------
    field({ id: 'jaw', label: 'Jaw', group: 'face', choices: opts(['auto', 'As the body'], ['plain', 'Plain'], ['piranha', 'Piranha teeth'], ['fangs', 'Fangs'], ['underbite', 'Underbite'], ['beak', 'Beak'], ['sucker', 'Sucker'], ['tube', 'Tube'], ['bill', 'Bill'], ['gape', 'Gape'], ['lips', 'Lips'], ['grin', 'Grin']), weights: [60, 8, 5, 3, 4, 3, 2, 2, 1, 4, 3, 5] }),
    field({ id: 'mood', label: 'Mood', group: 'face', choices: opts(['content', 'Content'], ['happy', 'Happy'], ['grumpy', 'Grumpy'], ['derpy', 'Derpy'], ['smug', 'Smug'], ['sleepy', 'Sleepy']), weights: [44, 18, 12, 9, 9, 8] }),
    field({ id: 'eyeStyle', label: 'Eye style', group: 'face', choices: opts(['round', 'Round'], ['dot', 'Dot'], ['sparkle', 'Sparkle'], ['googly', 'Googly']), weights: [56, 14, 22, 8] }),
    field({ id: 'eyeMount', label: 'Eye mount', group: 'face', choices: opts(['normal', 'Normal'], ['telescope', 'Telescope'], ['tubular', 'Tubular']), weights: [90, 6, 4] }),
    field({ id: 'eyeColor2', label: 'Second eye', group: 'face', choices: opts(['same', 'Same'], ...EYE_COLORS.map((c) => [c.id, c.label])), weights: [97, 1, 1, 1, 1, 1, 1] }),
    field({ id: 'blush', label: 'Blush', group: 'face', choices: opts(['no', 'No'], ['yes', 'Yes']), weights: [78, 22] }),
    field({ id: 'forehead', label: 'Forehead', group: 'face', choices: opts(['flat', 'Flat'], ['domed', 'Domed'], ['wen', 'Wen cap'], ['crested', 'Crested']), weights: [80, 9, 6, 5] }),
    field({ id: 'extras', label: 'Extras', group: 'face', choices: opts(['auto', 'As the body'], ['none', 'None'], ['barbels', 'Barbels'], ['horns', 'Horns'], ['nosehorn', 'Nose horn'], ['lure', 'Lure'], ['cheekspines', 'Cheek spines'], ['scutes', 'Scutes']), weights: [62, 18, 7, 3, 2, 2, 3, 3] }),
    // --- belly fins and fin dress -------------------------------------------------------------
    field({ id: 'anal', label: 'Anal fin', group: 'fins', choices: opts(['auto', 'As the body'], ['none', 'None'], ['small', 'Small'], ['ribbon', 'Ribbon'], ['mirror', 'Mirrors dorsal'], ['spike', 'Spike'], ['sail', 'Sail']), weights: [55, 5, 12, 4, 12, 4, 8] }),
    field({ id: 'pelvic', label: 'Pelvic fins', group: 'fins', choices: opts(['auto', 'As the body'], ['none', 'None'], ['small', 'Small'], ['long', 'Long'], ['feelers', 'Feelers'], ['spine', 'Spine'], ['sucker', 'Sucker disc']), weights: [50, 6, 20, 10, 6, 5, 3] }),
    field({ id: 'finPattern', label: 'Fin pattern', group: 'fins', choices: opts(['plain', 'Plain'], ['spotted', 'Spotted'], ['banded', 'Banded'], ['tipped', 'Tipped'], ['gilded', 'Gilded edge']), weights: [50, 14, 12, 14, 10] }),
    // --- skin -----------------------------------------------------------------------------------
    field({ id: 'scales', label: 'Scales', group: 'skin', choices: opts(['smooth', 'Smooth'], ['fine', 'Fine'], ['scallops', 'Big scallops'], ['plates', 'Armour plates'], ['sandpaper', 'Sandpaper']), weights: [36, 30, 18, 8, 8] }),
    field({ id: 'markings', label: 'Markings', group: 'skin', choices: opts(['none', 'None'], ['mask', 'Eye mask'], ['ocellus', 'False eye'], ['tailspot', 'Tail spot'], ['cheek', 'Cheek patch'], ['lipstick', 'Lipstick'], ['cleaner', 'Cleaner stripe'], ['photophores', 'Photophores']), weights: [46, 10, 8, 9, 9, 6, 6, 6] }),
    field({ id: 'damage', label: 'Wear', group: 'skin', choices: opts(['none', 'None'], ['warts', 'Warts'], ['scar', 'Scar'], ['notched', 'Notched fin']), weights: [88, 4, 4, 4] }),
    // --- colour morphs: sports (bred or rare), else the genes decide ---------------------------
    field({ id: 'morph', label: 'Morph', group: 'rare', choices: opts(['auto', 'From genes'], ['galaxy', 'Galaxy'], ['neon', 'Neon'], ['chrome', 'Chrome'], ['ombre', 'Ombré'], ['split', 'Split']), weights: [80, 4, 5, 4, 5, 2], when: notCommon, gateHint: 'needs an uncommon fish' }),
    field({ id: 'iridescence', label: 'Iridescence', group: 'rare', choices: opts(['none', 'None'], ['shimmer', 'Shimmer'], ['rainbow', 'Rainbow']), weights: [60, 28, 12], when: isRare, gateHint: 'needs a rare fish' }),
    // --- life -----------------------------------------------------------------------------------
    field({ id: 'stage', label: 'Life stage', group: 'life', choices: opts(['fry', 'Fry'], ['juvenile', 'Juvenile'], ['adult', 'Adult'], ['elder', 'Elder']), weights: [5, 13, 72, 10], default: 'adult', volatility: 0 }),
    field({ id: 'sex', label: 'Sex', group: 'life', choices: opts(['f', 'Female'], ['m', 'Male']), weights: [1, 1] }),
    // --- motion ---------------------------------------------------------------------------------
    field({ id: 'swim', label: 'Swim look', group: 'motion', choices: opts(['raised', 'Physical, raised camera'], ['side', 'Physical, pure side'], ['cartoon', 'Cartoon wag']), weights: [1, 0, 0], default: 'raised', volatility: 0 }),
    field({ id: 'gait', label: 'Gait', group: 'motion', choices: opts(['auto', 'As the body'], ['anguilliform', 'Eel wave'], ['subcarangiform', 'Trout wave'], ['carangiform', 'Jack wave'], ['thunniform', 'Tuna flick'], ['ostraciiform', 'Boxfish wag'], ['labriform', 'Fin rowing'], ['balistiform', 'Trigger fins'], ['amiiform', 'Ribbon fin']), weights: [1, 0, 0, 0, 0, 0, 0, 0, 0], default: 'auto', volatility: 0 }),
    // --- genes (inherited, partly hidden) -------------------------------------------------------
    field({ id: 'geneA', label: 'Gene, allele 1', group: 'genes', choices: ALLELES, weights: ALLELE_WEIGHTS, default: 'wild', volatility: 0 }),
    field({ id: 'geneB', label: 'Gene, allele 2', group: 'genes', choices: ALLELES, weights: ALLELE_WEIGHTS, default: 'wild', volatility: 0 }),
    field({ id: 'hybrid', label: 'Hybrid', group: 'genes', choices: opts(['none', 'None'], ...HYBRID_IDS), weights: [1, ...HYBRID_IDS.map(() => 0)], volatility: 0 }),
    field({ id: 'chaos', label: 'Mutability', group: 'genes', choices: opts(['stable', 'Stable'], ['normal', 'Normal'], ['chaotic', 'Chaotic']), weights: [20, 65, 15], default: 'normal' }),
    field({ id: 'generation', label: 'Generation', group: 'genes', choices: opts(...Array.from({ length: 36 }, (_, i) => [`g${i}`, i === 35 ? '35+' : String(i)])), weights: [1, ...Array(35).fill(0)], volatility: 0 }),
    field({ id: 'lineA', label: 'Lineage', group: 'genes', choices: opts(...Array.from({ length: 36 }, (_, i) => [`l${i}`, i.toString(36)])), volatility: 0 }),
    field({ id: 'lineB', label: 'Lineage ·', group: 'genes', choices: opts(...Array.from({ length: 36 }, (_, i) => [`l${i}`, i.toString(36)])), volatility: 0 }),
    field({ id: 'purity', label: 'Line purity', group: 'genes', choices: opts(...Array.from({ length: 10 }, (_, i) => [`p${i}`, String(i)])), weights: [1, ...Array(9).fill(0)], volatility: 0 }),
  ],
});

/** A v1 fish code as a v3 genome: same fish, new fields at their defaults. */
export function fromV1Code(code) {
  const v1 = fishTraits.decode(code);
  return v1 ? fish3Traits.normalize(v1) : null;
}

/** Fields that are bookkeeping or camera, not the animal: left out of the drawing's jitter key. */
export const NOT_LOOKS = ['stage', 'swim', 'gait', 'generation', 'lineA', 'lineB', 'purity', 'chaos', 'geneA', 'geneB', 'sex'];

/** The key a drawing seeds its per-fish randomness from, stable across growth and breeding bookkeeping. */
export function jitterKey(set) {
  const plain = { ...set };
  for (const id of NOT_LOOKS) plain[id] = fish3Traits.fieldById(id).default ?? fish3Traits.fieldById(id).choices[0].id;
  return fish3Traits.encode(plain);
}

export const hexOf = (genome, fieldId) => fish3Traits.choiceOf(genome, fieldId)?.hex ?? '#888888';
export const labelOf = (genome, fieldId) => fish3Traits.choiceOf(genome, fieldId)?.label ?? '';

// Plant v4 genome (`p4.`): where a plant comes from (realm → region), what it is (its form, out
// of three per-realm lists so no list outgrows a code digit), how big it is, how the shape genes
// bend that form, which organs it swaps in, every colour role, and the quiet genes the farm
// reads (growth, yield, hardiness, …). Positions and salts are frozen: append only.

import { defineTraits } from '../../pixel/traits.js';
import { FORMS } from './forms.js';
import { ROLES, BEDS, BED_IDS } from './palettes.js';
import { LEAF } from './engine/organs.js';
import { REGIONS, REGION_IDS } from './data/places.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));

/** Forms by realm. Farm: crops and cut flowers. Wild: trees, shrubs, desert, forest floor. */
export const FARM_FORMS = ['lettuce', 'cabbage', 'kale', 'carrot', 'radish', 'onion', 'wheat', 'corn', 'tomato', 'bean', 'pumpkin', 'pepper', 'strawberry', 'sunflower', 'tulip', 'daisy', 'lavender', 'rose'];
export const WILD_FORMS = ['bush', 'hydrangea', 'oak', 'maple', 'fruittree', 'spruce', 'cypress', 'birch', 'willow', 'palm', 'acacia', 'fern', 'saguaro', 'prickly', 'succulent', 'mushroom', 'grass', 'bamboo'];
export const WATER_FORMS = ['kelp', 'vallis', 'sword', 'stemplant', 'cabomba', 'hairgrass', 'mossball', 'seafan', 'staghorn', 'caulerpa', 'anubias', 'aponogeton', 'sealettuce', 'glowstalk'];
export const FORM_FIELD = { farm: 'farmForm', wild: 'wildForm', water: 'waterForm' };
export const REALM_OF = Object.fromEntries([
  ...FARM_FORMS.map((f) => [f, 'farm']),
  ...WILD_FORMS.map((f) => [f, 'wild']),
  ...WATER_FORMS.map((f) => [f, 'water']),
]);

export const SIZE_IDS = ['herb', 'shrub', 'tall', 'tree', 'giant'];

/** Seven steps around a centre, bell-weighted: the heritable proportions and the quiet genes. */
const STEPS = opts(['m3', '−3'], ['m2', '−2'], ['m1', '−1'], ['z0', '·'], ['p1', '+1'], ['p2', '+2'], ['p3', '+3']);
const BELL = [3, 8, 18, 42, 18, 8, 3];
export const STEP_IDS = STEPS.map((s) => s.id);
export const SHAPE_GENES = ['height', 'spread', 'branching', 'leafSize', 'density', 'thickness', 'droop', 'asym'];
export const QUIET_GENES = ['growth', 'yield', 'hardiness', 'thirst', 'flavour', 'longevity'];

export const LEAF_KINDS = Object.keys(LEAF);
export const BLOOM_KINDS = ['cup', 'bell', 'spike', 'umbel', 'puff', 'daisy', 'star', 'rose', 'blossom', 'composite'];
export const FRUIT_KINDS = ['pome', 'citrus', 'tomato', 'berry', 'pod', 'pepper', 'strawberry'];
export const VARIEGATION = ['none', 'edge', 'stripe', 'spots', 'veins', 'tipTint', 'blush'];
export const COLOR_ROLES = { leafColor: 'leaf', tipColor: 'tip', barkColor: 'bark', petalColor: 'petal', eyeColor: 'eye', fruitColor: 'fruit', rootColor: 'root', coralColor: 'coral', autumnColor: 'autumn', glowColor: 'glow' };

const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
const formChoices = (ids) => ids.map((id) => ({ id, label: FORMS[id].label }));

let salt = 0;
const field = (spec) => ({ salt: (salt += 16), ...spec });
const step = (id, label, group) => field({ id, label, group, choices: STEPS, weights: BELL, default: 'z0', volatility: 1.3 });
const color = (id, role, label, when) => field({ id, label, group: 'colour', choices: ROLES[role].map((c) => ({ ...c })), volatility: 0.8, when });

export const plant4Traits = defineTraits({
  prefix: 'p4.',
  fields: [
    field({ id: 'realm', label: 'Realm', group: 'place', choices: opts(['farm', 'Farm'], ['wild', 'Wild'], ['water', 'Water']), weights: [38, 34, 28], default: 'farm', volatility: 0, dominance: 0.5 }),
    field({ id: 'region', label: 'Region', group: 'place', choices: REGION_IDS.map((id) => ({ id, label: REGIONS[id].label })), default: 'kitchen', volatility: 0.2, when: (s) => REGIONS[s.region]?.realm === s.realm }),
    field({ id: 'farmForm', label: 'Crop', group: 'form', choices: formChoices(FARM_FORMS), default: 'lettuce', volatility: 0.05, when: (s) => s.realm === 'farm' }),
    field({ id: 'wildForm', label: 'Wild plant', group: 'form', choices: formChoices(WILD_FORMS), default: 'oak', volatility: 0.05, when: (s) => s.realm === 'wild' }),
    field({ id: 'waterForm', label: 'Water plant', group: 'form', choices: formChoices(WATER_FORMS), default: 'vallis', volatility: 0.05, when: (s) => s.realm === 'water' }),
    field({ id: 'size', label: 'Size', group: 'form', choices: opts(...SIZE_IDS.map((id) => [id, cap(id)])), default: 'shrub', weights: [22, 32, 22, 16, 8], volatility: 0.4 }),
    field({ id: 'look', label: 'Look', group: 'look', choices: opts(['clean', 'Clean'], ['bold', 'Bold ink'], ['soft', 'Soft']), weights: [60, 25, 15], default: 'clean' }),
    ...SHAPE_GENES.map((id) => step(id, { height: 'Height', spread: 'Spread', branching: 'Branching', leafSize: 'Leaf size', density: 'Density', thickness: 'Thickness', droop: 'Droop', asym: 'Lean' }[id], 'shape')),
    field({ id: 'leaf', label: 'Leaf', group: 'organs', choices: [{ id: 'auto', label: 'As grown' }, ...LEAF_KINDS.map((id) => ({ id, label: cap(id) }))], weights: [85, ...LEAF_KINDS.map(() => 1)], default: 'auto' }),
    field({ id: 'bloom', label: 'Flower', group: 'organs', choices: [{ id: 'auto', label: 'As grown' }, { id: 'none', label: 'None' }, ...BLOOM_KINDS.map((id) => ({ id, label: cap(id) }))], weights: [85, 3, ...BLOOM_KINDS.map(() => 1.2)], default: 'auto' }),
    field({ id: 'fruit', label: 'Fruit', group: 'organs', choices: [{ id: 'auto', label: 'As grown' }, { id: 'none', label: 'None' }, ...FRUIT_KINDS.map((id) => ({ id, label: cap(id) }))], weights: [88, 3, ...FRUIT_KINDS.map(() => 1.2)], default: 'auto' }),
    color('leafColor', 'leaf', 'Leaf colour'),
    color('tipColor', 'tip', 'Tip colour'),
    color('barkColor', 'bark', 'Bark colour'),
    color('petalColor', 'petal', 'Petal colour'),
    color('eyeColor', 'eye', 'Flower eye'),
    color('fruitColor', 'fruit', 'Fruit colour'),
    color('rootColor', 'root', 'Root colour'),
    color('coralColor', 'coral', 'Coral colour', (s) => s.realm === 'water'),
    color('autumnColor', 'autumn', 'Autumn colour', (s) => s.realm !== 'water'),
    color('glowColor', 'glow', 'Glow colour'),
    field({ id: 'variegation', label: 'Variegation', group: 'colour', choices: VARIEGATION.map((id) => ({ id, label: { none: 'None', tipTint: 'Tinted tips', blush: 'Blushed' }[id] ?? cap(id) })), weights: [88, 3, 3, 2, 2, 1.5, 1.5], default: 'none', volatility: 0.6 }),
    field({ id: 'glow', label: 'Glow', group: 'colour', choices: opts(['off', 'Off'], ['on', 'Glowing']), weights: [96, 4], default: 'off', volatility: 0.4 }),
    field({ id: 'bed', label: 'Bed', group: 'look', choices: [{ id: 'auto', label: 'As grown' }, ...BED_IDS.map((id) => ({ id, label: BEDS[id].label }))], weights: [90, ...BED_IDS.map(() => 1.2)], default: 'auto', volatility: 0.2 }),
    // the topology seed: which branch goes where. Two digits, 1296 individuals per genome.
    field({ id: 'sprout', label: 'Sprout', group: 'form', choices: Array.from({ length: 36 }, (_, i) => ({ id: `s${i}`, label: `${i}` })), default: 's0', volatility: 3 }),
    field({ id: 'twist', label: 'Twist', group: 'form', choices: Array.from({ length: 36 }, (_, i) => ({ id: `t${i}`, label: `${i}` })), default: 't0', volatility: 3 }),
    ...QUIET_GENES.map((id) => step(id, cap(id), 'genes')),
  ],
});

/** The form a set grows as. */
export const formOf = (set) => set[FORM_FIELD[set.realm]] ?? 'lettuce';

/** A valid set, with `form` filled in (the painter's and the farm's handle on it). */
export function normalizePlant(raw) {
  const src = { ...(raw ?? {}) };
  // a bare `form` (from a caller, or a test) chooses its realm and form field
  if (src.form && REALM_OF[src.form]) {
    src.realm = REALM_OF[src.form];
    src[FORM_FIELD[src.realm]] = src.form;
  }
  if (src.region && REGIONS[src.region] && src.realm && REGIONS[src.region].realm !== src.realm) delete src.region;
  if (!src.region && src.realm) src.region = REGION_IDS.find((id) => REGIONS[id].realm === src.realm);
  const set = plant4Traits.normalize(src);
  if (REGIONS[set.region]?.realm !== set.realm) set.region = REGION_IDS.find((id) => REGIONS[id].realm === set.realm);
  set.form = formOf(set);
  return set;
}

/** Without the derived `form`, for encoding. */
export const encodePlant = (set) => plant4Traits.encode(normalizePlant(set));

// Plant v3 genome: every v1 garden-plant field, in v1 order with v1 salts, so a `g…` code
// opens here as the same plant. New fields are appended (salts from 1024). The `g3.` prefix
// cannot be read as a v1 `g…` or a v2 `g.…` code.
//
// Pigment is diploid. What the leaves show is worked out in phenotype.js, so a plant can
// carry purple without growing purple.

import { defineTraits } from '../../pixel/traits.js';
import { plantTraits } from '../../gen/plant.js';
import { SPECIES, SPECIES_IDS, CROSSES, resolveSpec } from './habits.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));

/** Seven steps around a centre, for the heritable proportions. */
const STEPS = opts(['n3', '−3'], ['n2', '−2'], ['n1', '−1'], ['0', '·'], ['p1', '+1'], ['p2', '+2'], ['p3', '+3']);
const BELL = [3, 8, 18, 42, 18, 8, 3];
export const STEP_IDS = STEPS.map((s) => s.id);
/** A proportion step as a number, −3..3. */
export const stepOf = (id) => Math.max(0, STEP_IDS.indexOf(id ?? '0')) - 3;

/** Alleles a pigment slot can hold. Anything but green shows only when both copies match. */
export const ALLELES = opts(
  ['green', 'Green'],
  ['variegated', 'Variegated'],
  ['silver', 'Silver'],
  ['gold', 'Gold-edge'],
  ['purple', 'Purple'],
);
const ALLELE_WEIGHTS = [78, 7, 6, 5, 4];

const SPECIES_CHOICES = SPECIES_IDS.map((id) => [id, SPECIES[id].label]);
const SPECIES_WEIGHTS = [10, 8, 12, 8, 8, 6, 6, 5, 4, 5, 6, 5, 4, 4, 5, 4];

let salt = 1024;
const field = (spec) => ({ salt: (salt += 16), ...spec });
const step = (id, label) => field({
  id, label, group: 'proportions', choices: STEPS, weights: BELL, default: '0', volatility: 1.3,
});

export const plant3Traits = defineTraits({
  prefix: 'g3.',
  fields: [
    ...plantTraits.fields,
    field({
      id: 'species', label: 'Species', group: 'identity', default: 'flower',
      choices: opts(...SPECIES_CHOICES), weights: SPECIES_WEIGHTS,
    }),
    field({
      id: 'size', label: 'Size', group: 'identity', default: 'shrub',
      choices: opts(['herb', 'Herb'], ['shrub', 'Shrub'], ['tall', 'Tall'], ['tree', 'Tree'], ['giant', 'Giant']),
      weights: [12, 28, 28, 22, 10],
    }),
    field({
      id: 'look', label: 'Look', group: 'look', default: 'garden',
      choices: opts(['garden', 'Garden'], ['breeze', 'Breeze'], ['cartoon', 'Cartoon']),
      weights: [50, 35, 15],
    }),
    step('stemH', 'Stem length'),
    step('spread', 'Spread'),
    step('leafSize', 'Leaf size'),
    step('thick', 'Stem thickness'),
    field({ id: 'geneA', label: 'Pigment', group: 'genes', choices: ALLELES, weights: ALLELE_WEIGHTS, default: 'green' }),
    field({ id: 'geneB', label: 'Pigment ·', group: 'genes', choices: ALLELES, weights: ALLELE_WEIGHTS, default: 'green' }),
    field({
      id: 'cross', label: 'Cross', group: 'genes', default: 'none', volatility: 0,
      choices: opts(['none', 'None'], ...Object.values(CROSSES).map((c) => [c.id, c.label])),
      weights: [1, 0, 0, 0],
    }),
  ],
});

/** Camera and genes: left out of the drawing's jitter key so they don't reshuffle the plant. */
export const NOT_LOOKS = ['look', 'geneA', 'geneB'];

/**
 * A genome the painter can trust. A v1 plant has a form and no species: the species becomes
 * that form. After that, the species (or a cross) owns the form.
 */
export function normalizePlant(raw) {
  const set = plant3Traits.normalize(raw);
  const had = raw && SPECIES[raw.species];
  if (!had) set.species = SPECIES[set.form] ? set.form : set.species;
  set.form = resolveSpec(set).form;
  return set;
}

/** A v1 garden code as a v3 genome: the same plant, new fields at their defaults. */
export function fromV1Code(code) {
  const v1 = plantTraits.decode(code);
  return v1 ? normalizePlant(v1) : null;
}

/** The key a drawing seeds its placement from. Stable across look and hidden genes. */
export function jitterKey(set) {
  const plain = { ...set };
  for (const id of NOT_LOOKS) {
    const f = plant3Traits.fieldById(id);
    plain[id] = f.default ?? f.choices[0].id;
  }
  return plant3Traits.encode(normalizePlant(plain));
}

export const hexOf = (genome, fieldId) => plant3Traits.choiceOf(genome, fieldId)?.hex ?? '#888888';
export const labelOf = (genome, fieldId) => plant3Traits.choiceOf(genome, fieldId)?.label ?? '';

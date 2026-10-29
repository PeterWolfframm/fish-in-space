// Tank plant v2 genome: v1's fields in v1 order with v1 salts, new choices and fields appended
// (variegation, algae, a tank-mate and the shared style genome from kit/style.js).
// `w.` codes never collide with v1 `w` codes, and a v1 code still decodes (`fromV1Code`).

import { defineTraits } from '../../pixel/traits.js';
import { waterplantTraits } from '../../gen/waterplant.js';
import { STYLE_FIELDS } from '../kit/style.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));

const APPEND = {
  form: [opts(['carpet', 'Carpet'], ['lily', 'Water lily'], ['stem', 'Stem plant']), [10, 8, 12]],
  base: [opts(['sand', 'Sand'], ['gravel', 'Gravel']), [22, 22]],
};

const v1Fields = waterplantTraits.fields.map((f) => {
  const extra = APPEND[f.id];
  if (!extra) return f;
  const weights = f.weights ?? f.choices.map(() => 1);
  return { ...f, choices: [...f.choices, ...extra[0]], weights: [...weights, ...extra[1]] };
});

export const waterplant2Traits = defineTraits({
  prefix: 'w.',
  fields: [
    ...v1Fields,
    { id: 'size', label: 'Size', group: 'shape', salt: 512, choices: opts(['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['huge', 'Huge']), weights: [24, 40, 26, 10], default: 'medium', volatility: 1.2 },
    { id: 'flower', label: 'Flower', group: 'rare', salt: 528, choices: opts(['none', 'None'], ['white', 'White'], ['pink', 'Pink'], ['gold', 'Gold']), weights: [55, 15, 18, 12], when: (s) => s.form === 'lily' || s.form === 'stem' || s.form === 'sword', gateHint: 'lilies, stems and swords' },
    { id: 'variegation', label: 'Variegation', group: 'colour', salt: 544, choices: opts(['none', 'None'], ['edge', 'Pale edges'], ['stripe', 'Stripes']), weights: [80, 11, 9] },
    { id: 'algae', label: 'Algae', group: 'scene', salt: 560, choices: opts(['none', 'Clean'], ['specks', 'Specks'], ['fuzz', 'Fuzzy']), weights: [76, 16, 8] },
    { id: 'critter', label: 'Tank-mate', group: 'scene', salt: 576, choices: opts(['none', 'None'], ['snail', 'Snail'], ['shrimp', 'Shrimp']), weights: [76, 14, 10] },
    ...STYLE_FIELDS,
  ],
});

export function fromV1Code(code) {
  const v1 = waterplantTraits.decode(code);
  return v1 ? waterplant2Traits.normalize(v1) : null;
}

/**
 * The code a drawing seeds its randomness from: the fields this kind had before options were
 * appended, so a new field only changes what it draws and never reshuffles the rest.
 */
export const identityCode = (set) => waterplant2Traits.encode(set).slice(0, 15);

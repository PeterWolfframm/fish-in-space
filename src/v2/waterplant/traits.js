// Tank plant v2 genome: v1's fields in v1 order with v1 salts, new choices and fields appended.
// `w.` codes never collide with v1 `w` codes, and a v1 code still decodes (`fromV1Code`).

import { defineTraits } from '../../pixel/traits.js';
import { waterplantTraits } from '../../gen/waterplant.js';

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
  ],
});

export function fromV1Code(code) {
  const v1 = waterplantTraits.decode(code);
  return v1 ? waterplant2Traits.normalize(v1) : null;
}

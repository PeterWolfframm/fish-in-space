// Garden plant v2 genome: v1's fields in v1 order with v1 salts, a new form and a size class
// appended. `g.` codes never collide with v1 `g` codes; v1 codes still decode (`fromV1Code`).

import { defineTraits } from '../../pixel/traits.js';
import { plantTraits } from '../../gen/plant.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));

const APPEND = {
  form: [opts(['conifer', 'Conifer']), [9]],
};

const v1Fields = plantTraits.fields.map((f) => {
  const extra = APPEND[f.id];
  if (!extra) return f;
  const weights = f.weights ?? f.choices.map(() => 1);
  return { ...f, choices: [...f.choices, ...extra[0]], weights: [...weights, ...extra[1]] };
});

export const plant2Traits = defineTraits({
  prefix: 'g.',
  fields: [
    ...v1Fields,
    { id: 'size', label: 'Size', group: 'shape', salt: 512, choices: opts(['herb', 'Herb'], ['shrub', 'Shrub'], ['tall', 'Tall'], ['tree', 'Tree'], ['giant', 'Giant']), weights: [22, 32, 24, 15, 7], default: 'shrub', volatility: 1.2 },
  ],
});

export function fromV1Code(code) {
  const v1 = plantTraits.decode(code);
  return v1 ? plant2Traits.normalize(v1) : null;
}

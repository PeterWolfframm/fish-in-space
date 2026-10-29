// Garden plant v2 genome: v1's fields in v1 order with v1 salts, a new form, a size class, pots,
// variegation, seasons and the shared style genome (kit/style.js) appended. `g.` codes never
// collide with v1 `g` codes; v1 codes still decode (`fromV1Code`).

import { defineTraits } from '../../pixel/traits.js';
import { plantTraits } from '../../gen/plant.js';
import { STYLE_FIELDS } from '../kit/style.js';

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
    { id: 'pot', label: 'Pot', group: 'scene', salt: 528, choices: opts(['none', 'In the ground'], ['clay', 'Clay pot'], ['glazed', 'Glazed pot'], ['stone', 'Stone pot']), weights: [64, 16, 10, 10] },
    { id: 'variegation', label: 'Variegation', group: 'colour', salt: 544, choices: opts(['none', 'None'], ['edge', 'Pale edges'], ['stripe', 'Stripes']), weights: [78, 12, 10] },
    { id: 'season', label: 'Season', group: 'colour', salt: 560, choices: opts(['none', 'As is'], ['warm', 'Autumn gold'], ['red', 'Autumn red']), weights: [76, 14, 10] },
    ...STYLE_FIELDS,
  ],
});

export function fromV1Code(code) {
  const v1 = plantTraits.decode(code);
  return v1 ? plant2Traits.normalize(v1) : null;
}

/**
 * The code a drawing seeds its randomness from: the fields this kind had before options were
 * appended, so a new field only changes what it draws and never reshuffles the rest.
 */
export const identityCode = (set) => plant2Traits.encode(set).slice(0, 15);

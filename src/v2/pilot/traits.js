// Pilot v2 genome: v1's fields in v1 order (so a callsign rolls the same person), plus a helmet
// style, scars, freckles, a framing, beard, scarf, backdrop and the shared style genome (kit/style.js)
// appended. `c.` codes never collide with v1 `c` codes; v1
// codes still decode (`fromV1Code`), filling the new fields with defaults.

import { defineTraits } from '../../pixel/traits.js';
import { pilotTraits } from '../../gen/pilot.js';
import { STYLE_FIELDS } from '../kit/style.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));

export const pilot2Traits = defineTraits({
  prefix: 'c.',
  fields: [
    ...pilotTraits.fields,
    { id: 'helmetStyle', label: 'Helmet style', group: 'helmet', salt: 512, choices: opts(['classic', 'Classic'], ['sleek', 'Sleek'], ['retro', 'Leather']), weights: [60, 30, 10], default: 'classic' },
    { id: 'scar', label: 'Scar', group: 'face', salt: 528, choices: opts(['none', 'None'], ['cheek', 'Cheek'], ['brow', 'Brow'], ['chin', 'Chin']), weights: [82, 7, 7, 4], default: 'none' },
    { id: 'freckles', label: 'Freckles', group: 'face', salt: 544, choices: opts(['no', 'No'], ['yes', 'Yes']), weights: [80, 20], default: 'no' },
    { id: 'size', label: 'Framing', group: 'role', salt: 560, choices: opts(['icon', 'Icon'], ['portrait', 'Portrait'], ['bust', 'Bust'], ['cockpit', 'Cockpit']), weights: [10, 50, 25, 15], default: 'portrait' },
    { id: 'beard', label: 'Beard', group: 'face', salt: 576, choices: opts(['none', 'None'], ['stubble', 'Stubble'], ['chin', 'Chin tuft'], ['full', 'Full']), weights: [70, 14, 6, 10] },
    { id: 'scarf', label: 'Scarf', group: 'suit', salt: 592, choices: opts(['none', 'None'], ['white', 'White silk'], ['red', 'Red silk'], ['blue', 'Blue silk']), weights: [70, 12, 10, 8] },
    { id: 'backdrop', label: 'Backdrop', group: 'role', salt: 608, choices: opts(['plain', 'Plain'], ['sky', 'Sky'], ['dusk', 'Dusk'], ['night', 'Night']), weights: [70, 12, 10, 8] },
    ...STYLE_FIELDS,
  ],
});

export function fromV1Code(code) {
  const v1 = pilotTraits.decode(code);
  return v1 ? pilot2Traits.normalize(v1) : null;
}

/**
 * The code a drawing seeds its randomness from: the fields this kind had before options were
 * appended, so a new field only changes what it draws and never reshuffles the rest.
 */
export const identityCode = (set) => pilot2Traits.encode(set).slice(0, 20);

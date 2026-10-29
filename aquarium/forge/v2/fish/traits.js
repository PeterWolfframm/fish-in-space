// Fish v2 genome: every v1 field, in v1 order with v1 salts, so the same seed rolls the same fish
// where the fields overlap. New bodies, sizes and patterns are appended to their fields; new
// fields are appended to the list. The `f.` prefix can never be mistaken for a v1 `f` code, and
// a v1 code still decodes here (`fromV1Code`) as a remaster of that fish.

import { defineTraits } from '../../pixel/traits.js';
import { fishTraits } from '../../gen/fish/genome.js';
import { STYLE_FIELDS } from '../kit/style.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));
const isRare = (set) => set.rarity === 'rare' || set.rarity === 'myth';

const APPEND = {
  body: [opts(['catfish', 'Catfish'], ['betta', 'Betta'], ['koi', 'Koi'], ['angler', 'Angler']), [9, 6, 9, 3]],
  size: [opts(['giant', 'Giant']), [3]],
  pattern: [opts(['patches', 'Koi patches']), [9]],
};

const v1Fields = fishTraits.fields.map((f) => {
  const extra = APPEND[f.id];
  if (!extra) return f;
  const weights = f.weights ?? f.choices.map(() => 1);
  return { ...f, choices: [...f.choices, ...extra[0]], weights: [...weights, ...extra[1]] };
});

export const fish2Traits = defineTraits({
  prefix: 'f.',
  fields: [
    ...v1Fields,
    { id: 'scales', label: 'Scales', group: 'skin', salt: 512, choices: opts(['none', 'Smooth'], ['fine', 'Fine'], ['plate', 'Plates'], ['armor', 'Armoured']), weights: [30, 36, 24, 10], default: 'fine' },
    { id: 'lateral', label: 'Lateral line', group: 'skin', salt: 528, choices: opts(['no', 'None'], ['yes', 'Visible']), weights: [55, 45] },
    { id: 'finLength', label: 'Fin length', group: 'fins', salt: 544, choices: opts(['short', 'Short'], ['normal', 'Normal'], ['long', 'Long'], ['flowing', 'Flowing']), weights: [20, 50, 22, 8], default: 'normal', volatility: 1.2 },
    { id: 'barbels', label: 'Barbels', group: 'face', salt: 560, choices: opts(['none', 'None'], ['short', 'Short'], ['long', 'Long']), weights: [88, 8, 4] },
    { id: 'lure', label: 'Lure', group: 'rare', salt: 576, choices: opts(['none', 'None'], ['lure', 'Glowing lure']), weights: [70, 30], when: isRare, gateHint: 'needs a rare fish' },
    { id: 'eyeStyle', label: 'Eye style', group: 'face', salt: 592, choices: opts(['round', 'Round'], ['cute', 'Cute'], ['slit', 'Slit pupil']), weights: [64, 22, 14] },
    { id: 'gradient', label: 'Body tone', group: 'skin', salt: 608, choices: opts(['none', 'Even'], ['fade', 'Tail fade'], ['counter', 'Countershaded']), weights: [56, 20, 24] },
    { id: 'finEdge', label: 'Fin edges', group: 'fins', salt: 624, choices: opts(['none', 'Plain'], ['light', 'Pale rim'], ['dark', 'Dark rim']), weights: [62, 22, 16] },
    ...STYLE_FIELDS,
  ],
});

/** A v1 fish code as a v2 genome: same fish, new fields at their defaults. */
export function fromV1Code(code) {
  const v1 = fishTraits.decode(code);
  return v1 ? fish2Traits.normalize(v1) : null;
}

/**
 * The code a drawing seeds its randomness from: the fields this kind had before options were
 * appended, so a new field only changes what it draws and never reshuffles the rest.
 */
export const identityCode = (set) => fish2Traits.encode(set).slice(0, 24);

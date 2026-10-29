// Tank plants v2 (waterplant2): lit, layered tank plants in four size classes at constant pixel
// density, three new forms, a shaded bed. Reads v1 codes too, as remasters.

import { waterplant2Traits, fromV1Code } from './traits.js';
import { drawWaterplant2, plantCanvas, CLASS_H } from './draw.js';
import { anim, poseAt } from '../anim/rig.js';
import { sway, gust, flutter, bubbles, pulse } from '../anim/motions.js';

export { waterplant2Traits, fromV1Code, drawWaterplant2, plantCanvas, CLASS_H };

const SIZES = Object.keys(CLASS_H).map((id) => ({ id, ...plantCanvas({ form: 'kelp', size: id }) }));

const ANIMS = [
  anim('sway', 8, 6, [sway({ cycles: 1 }), flutter({ cycles: 2 }), bubbles(), pulse()]),
  anim('gust', 12, 10, [gust({ cycles: 2, lean: 1 }), flutter({ cycles: 4 }), bubbles()]),
];

export default {
  id: 'waterplant2',
  version: 2,
  family: 'waterplant',
  label: 'Tank plants v2',
  game: 'fish.',
  size: SIZES.find((s) => s.id === 'medium'),
  sizes: SIZES,
  sizeField: 'size',
  anchor: 'bottom',
  sizeOf: (genome) => plantCanvas(genome),
  bg: '#1e3c5a',
  traits: waterplant2Traits,
  fromSeed: (seed) => waterplant2Traits.fromSeed(seed),
  fromCode: (code) => waterplant2Traits.decode(code) ?? fromV1Code(code),
  breed: (a, b, seed, rate = 0.08) => waterplant2Traits.vary(waterplant2Traits.combine(a, b, seed), rate, `${seed}:mut`),
  anims: ANIMS,
  frame(genome, animId, i = 0) {
    const a = ANIMS.find((x) => x.id === animId) ?? ANIMS[0];
    return drawWaterplant2(genome, poseAt('plant', a, i, genome));
  },
};

// Garden plants v2 (plant2): growing plants in five size classes at constant pixel density, from
// a herb to a giant tree, lit and branching, swaying in the wind. Same growth model as v1, so
// `stages`, `grow` and `at(t)` still show one plant growing, never four drawings.

import { plant2Traits, fromV1Code } from './traits.js';
import { drawPlant2, plantCanvas, CLASS_H, STAGE_T } from './draw.js';
import { anim, poseAt } from '../anim/rig.js';
import { stages, grow, sway, flutter, pulse } from '../anim/motions.js';

export { plant2Traits, fromV1Code, drawPlant2, plantCanvas, CLASS_H };

const SIZES = Object.keys(CLASS_H).map((id) => ({ id, ...plantCanvas({ form: 'tree', size: id }) }));

const ANIMS = [
  anim('stages', STAGE_T.length, 1.5, [stages(STAGE_T)], { loop: false }),
  anim('grow', 16, 8, [grow()], { loop: false, continuous: true }),
  anim('wind', 8, 6, [sway({ cycles: 1 }), flutter({ cycles: 2 }), pulse()]),
];

export default {
  id: 'plant2',
  version: 2,
  family: 'plant',
  label: 'Garden plants v2',
  game: 'plantasia',
  size: SIZES.find((s) => s.id === 'shrub'),
  sizes: SIZES,
  sizeField: 'size',
  anchor: 'bottom',
  sizeOf: (genome) => plantCanvas(genome),
  bg: '#2b3a2a',
  traits: plant2Traits,
  fromSeed: (seed) => plant2Traits.fromSeed(seed),
  fromCode: (code) => plant2Traits.decode(code) ?? fromV1Code(code),
  breed: (a, b, seed, rate = 0.08) => plant2Traits.vary(plant2Traits.combine(a, b, seed), rate, `${seed}:mut`),
  anims: ANIMS,
  frame(genome, animId, i = 0) {
    const a = ANIMS.find((x) => x.id === animId) ?? ANIMS[0];
    const pose = poseAt('plant', a, i, genome);
    // Growth anims stand still; the wind anim shows the grown plant.
    return drawPlant2(genome, pose.growth, pose);
  },
  at: (genome, t) => drawPlant2(genome, t),
};

// Fish v2 (fish2): lit, rounded fish at constant pixel density in six size classes, with a pose
// rig so animations are lists of motions. Reads v1 fish codes too, as remasters.

import { fish2Traits, fromV1Code } from './traits.js';
import { drawFish2, fishCanvas, CLASS_LEN } from './draw.js';
import { anim, poseAt } from '../anim/rig.js';
import { swim, hover, dart, turnRound, blink, pulse, sheen, eat } from '../anim/motions.js';
import { rarityScore } from '../../gen/fish/genome.js';

export { fish2Traits, fromV1Code, drawFish2, fishCanvas, CLASS_LEN };

const fromSeed = (seed) => fish2Traits.fromSeed(seed);

const breed = (a, b, seed, rate = 0.08) => fish2Traits.vary(fish2Traits.combine(a, b, seed), rate, `${seed}:mut`);

/** One representative canvas per class (a torpedo); real canvases follow the body. */
const SIZES = Object.keys(CLASS_LEN).map((id) => ({ id, ...pick(fishCanvas({ ...fish2Traits.normalize({}), body: 'torpedo', size: id })) }));
function pick({ w, h }) {
  return { w, h };
}

const ANIMS = [
  anim('swim', 6, 8, [swim({ beats: 1 }), sheen(), pulse()]),
  anim('idle', 8, 6, [hover(), blink({ at: 0.62, len: 0.13 }), pulse()]),
  anim('dart', 6, 12, [dart({ beats: 2 })]),
  anim('turn', 12, 10, [swim({ beats: 2, amp: 0.6 }), turnRound()]),
  anim('eat', 8, 8, [hover({ bob: 0 }), eat({ bites: 2 }), pulse()]),
];

export default {
  id: 'fish2',
  version: 2,
  family: 'fish',
  label: 'Fish v2',
  game: 'fish.',
  size: SIZES.find((s) => s.id === 'medium'),
  sizes: SIZES,
  sizeField: 'size',
  sizeOf: (genome) => pick(fishCanvas(genome)),
  bg: '#1e3c5a',
  traits: fish2Traits,
  fromSeed,
  fromCode: (code) => fish2Traits.decode(code) ?? fromV1Code(code),
  breed,
  rarity: rarityScore,
  anims: ANIMS,
  frame(genome, animId, i = 0) {
    const a = ANIMS.find((x) => x.id === animId) ?? ANIMS[0];
    return drawFish2(genome, poseAt('fish', a, i, genome));
  },
};

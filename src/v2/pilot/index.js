// Pilots v2 (pilot2): the Burn-Through crew drawn lit, in four framings at one pixel density:
// icon, portrait, bust and cockpit. A callsign rolls the same person as v1 (same fields, same
// rolls); the appended fields (helmet style, scar, freckles, framing) roll from it too.

import { pilot2Traits, fromV1Code } from './traits.js';
import { drawPilot2, pilotCanvas, FRAMINGS, SCENE } from './draw.js';
import { pilotFromSeed } from '../../gen/pilot.js';
import { anim, poseAt } from '../anim/rig.js';
import { expression, talk, shake, glance, scopeSweep, blinkAt } from '../anim/motions.js';

export { pilot2Traits, fromV1Code, drawPilot2, pilotCanvas, FRAMINGS, SCENE };

const SIZES = Object.entries(FRAMINGS).map(([id, f]) => ({ id, w: f.w, h: f.h }));

const ANIMS = [
  anim('idle', 8, 4, [expression('idle'), blinkAt({ at: 0.75, len: 0.125 })]),
  anim('talk', 6, 6, [talk()]),
  anim('blink', 1, 1, [expression('blink')]),
  anim('strain', 4, 6, [expression('strain')]),
  anim('alarm', 4, 6, [expression('alarm')]),
  anim('grin', 2, 3, [expression('grin')]),
  anim('calm', 1, 1, [expression('calm')]),
  anim('eject', 4, 8, [expression('eject')]),
  anim('scope', 12, 10, [expression('idle'), scopeSweep()], { label: 'sweep' }),
  anim('glance', 8, 4, [expression('idle'), glance()]),
  anim('shake', 8, 12, [expression('strain'), shake({ px: 1, cycles: 1 })]),
];

/** A crew member from a callsign: v1's face, plus the new fields rolled from the same seed. */
function fromSeed(seed, opts = {}) {
  const extra = pilot2Traits.fromSeed(seed);
  const v1 = pilotFromSeed(seed, opts);
  return { ...pilot2Traits.normalize({ ...extra, ...v1, helmetStyle: extra.helmetStyle, scar: extra.scar, freckles: extra.freckles, size: extra.size }), seed: v1.seed };
}

export default {
  id: 'pilot2',
  version: 2,
  family: 'pilot',
  label: 'Pilots v2',
  game: 'Burn-Through',
  size: SIZES.find((s) => s.id === 'portrait'),
  sizes: SIZES,
  framings: FRAMINGS,
  sizeField: 'size',
  anchor: 'bottom',
  sizeOf: (genome) => pilotCanvas(genome),
  bg: '#1d2430',
  traits: pilot2Traits,
  options: [{ id: 'avatar', label: 'Crew-room avatar', kind: 'toggle' }],
  fromSeed,
  fromCode: (code) => pilot2Traits.decode(code) ?? fromV1Code(code),
  normalize: (g) => ({ ...pilot2Traits.normalize(g), seed: g?.seed }),
  breed: (a, b, seed, rate = 0.08) => pilot2Traits.vary(pilot2Traits.combine(a, b, seed), rate, `${seed}:mut`),
  anims: ANIMS,
  frame(genome, animId = 'idle', i = 0) {
    const a = ANIMS.find((x) => x.id === animId) ?? ANIMS[0];
    return drawPilot2(genome, poseAt('pilot', a, i, genome));
  },
};

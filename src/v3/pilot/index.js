// Pilots v3 (pilot3): people. Pilots v1's flat 32×32 radio portrait opened up to anyone — kids
// and elders, every skin, sixteen hairstyles, hats, glasses, beards, lab coats, hoodies and
// spacesuits — with v1's crew still in there as one flight suit and helmet among many.
//
//   traits.js   the genome (`c3.` codes), a seed roll with a little sense, v1 codes as remasters
//   draw.js     the painter: v1's face and expressions, measured from the head

import { pilot3Traits, fromSeed, fromV1Code, fromV1 } from './traits.js';
import { drawPilot3, geometry, PORTRAIT, EXPRESSIONS } from './draw.js';

export { pilot3Traits, fromSeed, fromV1Code, fromV1, drawPilot3, geometry, PORTRAIT, EXPRESSIONS };

const IDLE = ['idle', 'idle', 'idle', 'idle', 'idle', 'idle', 'blink', 'idle'];
const GLANCE = [null, 0, 0, 0, null, 1, 1, 1];

const ANIMS = [
  { id: 'idle', frames: 8, fps: 4, at: (i) => [IDLE[i]] },
  { id: 'talk', frames: 6, fps: 6, at: () => ['talk'] },
  { id: 'blink', frames: 1, fps: 1, at: () => ['blink'] },
  { id: 'glance', frames: 8, fps: 4, at: (i) => ['idle', { glance: GLANCE[i] }] },
  { id: 'grin', frames: 2, fps: 3, at: () => ['grin'] },
  { id: 'calm', frames: 1, fps: 1, at: () => ['calm'] },
  { id: 'strain', frames: 4, fps: 6, at: () => ['strain'] },
  { id: 'alarm', frames: 4, fps: 6, at: () => ['alarm'] },
];

export default {
  id: 'pilot3',
  version: 3,
  family: 'pilot',
  label: 'Pilots v3 — people',
  game: 'Burn-Through',
  size: { w: PORTRAIT, h: PORTRAIT },
  bg: '#1d2430',
  traits: pilot3Traits,
  fromSeed: (seed) => ({ ...fromSeed(seed), seed: String(seed) }),
  fromCode: (code) => pilot3Traits.decode(code) ?? fromV1Code(code),
  normalize: (g) => ({ ...pilot3Traits.normalize(g), seed: g?.seed }),
  breed: (a, b, seed, rate = 0.08) => pilot3Traits.vary(pilot3Traits.combine(a, b, seed), rate, `${seed}:mut`),
  anims: ANIMS.map(({ at, ...a }) => a),
  frame(genome, animId = 'idle', i = 0) {
    const a = ANIMS.find((x) => x.id === animId) ?? ANIMS[0];
    const [expr, opts] = a.at(i % a.frames);
    return drawPilot3(pilot3Traits.normalize(genome), expr, i, opts);
  },
};

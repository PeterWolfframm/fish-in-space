// Spice eyes: blue within blue. A sand fish that has lived on the spice long enough has eyes with
// no white left: the sclera goes deep blue and the iris a deeper one. The glint stays.

import { defineFeature } from './define.js';
import { recolourEye } from './paint.js';

export default defineFeature({
  id: 'spiceEyes',
  label: 'Spice eyes',
  group: 'head',
  field: {
    choices: [['none', 'None'], ['blue', 'Blue within blue']],
    weights: [65, 35],
    salt: 3120,
    dominance: 0.4,
    volatility: 0.4,
    tierBoost: { rare: 1.2, epic: 1.5, legendary: 2, myth: 3 },
  },
  when: { field: 'terrain', is: 'sand' },
  layer: 'after:eye',
  points: 2,
  influences: {
    stats: { curiosity: { '*': 0.04 } },
    keys: { '*': ['spiceEyes'] },
  },
  draw(ctx) {
    recolourEye(ctx, { sclera: '#3f6fe8', pupil: '#0f2a8a' });
  },
});

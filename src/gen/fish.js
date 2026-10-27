// Fish (fish.): the 48×32 swimmers as a pixelforge generator. The genome, palettes and renderer
// in fish/ are byte-identical ports of the game's src/fish/, so fish codes decode to the same fish.

import { fishTraits, fishFromSeed, breed, rarityScore } from './fish/genome.js';
import { drawFish, drawFishFrames, FISH_W, FISH_H, FISH_FRAMES } from './fish/draw.js';

export { fishTraits, fishFromSeed, breed, rarityScore, drawFish, drawFishFrames, FISH_W, FISH_H, FISH_FRAMES };

export default {
  id: 'fish',
  label: 'Fish',
  game: 'fish.',
  size: { w: FISH_W, h: FISH_H },
  bg: '#1e3c5a',
  traits: fishTraits,
  fromSeed: (seed) => fishFromSeed(seed),
  breed: (a, b, seed) => breed(a, b, seed),
  rarity: rarityScore,
  anims: [{ id: 'swim', frames: FISH_FRAMES, fps: 8 }],
  frame: (genome, _anim, i = 0) => drawFish(genome, i, FISH_FRAMES),
};

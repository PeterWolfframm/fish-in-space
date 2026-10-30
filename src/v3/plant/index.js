// Garden plants v3 (plant3): v1's plants, grown up the way fish3 grew the fish.
// 16 species on nine bend habits, five sizes at constant density, three looks, Mendelian
// pigment, and a name. A v1 `g…` code opens as the same plant.
//
// The painter reads a pose. Motions set the pose. The habit decides the shape of the bend.

import { plant3Traits, normalizePlant, fromV1Code, jitterKey } from './genome.js';
import { SPECIES, SPECIES_IDS } from './habits.js';
import { phenotype, CLASS_H, describePlant } from './phenotype.js';
import { drawPlant3 } from './draw.js';
import { breed, breedDetailed } from './breeding.js';
import { nameOf } from './names.js';
import { keyed } from './keys.js';
import { anim, poseAt, rest } from '../../v2/anim/rig.js';
import { breeze, gust, rustle, flutter, bloomBreath, openBloom, glowBreath, sheenSweep, grow, stageMarks, year } from './motions.js';
import { roundUp, crop } from '../../v2/kit/sizes.js';
import { roller } from '../../pixel/rng.js';

export { plant3Traits, normalizePlant, fromV1Code, phenotype, CLASS_H, drawPlant3, breedDetailed, nameOf, describePlant, jitterKey, SPECIES_IDS };

const T = plant3Traits;

/** A fresh plant. Species lean toward their own leaves and flowers, the way a body prefers a face. */
function fromSeed(seed) {
  const set = T.fromSeed(seed);
  const prefer = SPECIES[set.species]?.prefer;
  if (prefer) {
    const { chance } = roller(seed, 3300);
    Object.entries(prefer).forEach(([f, v], i) => {
      if (chance(0.6, i)) set[f] = v;
    });
  }
  return normalizePlant(set);
}

export const ANIMS = [
  anim('idle', 12, 6, [breeze({ cycles: 1, amp: 0.35 }), flutter({ cycles: 2 }), bloomBreath(), glowBreath(), sheenSweep()]),
  anim('wind', 8, 8, [breeze({ cycles: 1, amp: 1 }), flutter({ cycles: 2 }), sheenSweep()]),
  anim('gust', 12, 8, [gust({ cycles: 1, lean: 1 }), flutter({ cycles: 2 })]),
  anim('rustle', 8, 12, [rustle()]),
  anim('bloom', 8, 6, [openBloom(), flutter({ cycles: 1 })], { loop: false, label: 'bloom (open)' }),
  anim('glow', 8, 6, [breeze({ cycles: 1, amp: 0.3 }), glowBreath(), flutter({ cycles: 2 })]),
  anim('grow', 16, 8, [grow(), breeze({ cycles: 1, amp: 0.25 }), flutter({ cycles: 1 })], { loop: false, continuous: true }),
  anim('stages', 4, 1.5, [stageMarks()], { loop: false }),
  anim('seasons', 4, 2, [year()], { loop: false, label: 'seasons (spring → winter)' }),
];

/** Taller plants sway more slowly (a cantilever's period grows with its length). */
const fpsOf = (genome, a) => {
  if (a.loop === false) return a.fps;
  const H = CLASS_H[normalizePlant(genome).size] ?? 32;
  return Math.max(3, Math.min(16, Math.round(a.fps * Math.sqrt(32 / H))));
};

const poseOf = (set, a, i) => keyed(
  poseAt('plant3', a, i, set),
  set.cross && set.cross !== 'none' ? set.cross : set.species,
  a.id,
  i,
);

// Probing a window paints every frame of every anim, so a cached box is worth far more than the
// memory it costs: evict the least recently used one rather than dropping all of them at once.
const BOX_MAX = 2000;
const boxCache = new Map();
const boxPut = (code, box) => {
  if (boxCache.size >= BOX_MAX) boxCache.delete(boxCache.keys().next().value);
  boxCache.set(code, box);
  return box;
};

/**
 * Seed a window the caller already knows — from a persisted cache, say — so the next frame() for
 * this genome skips the probe entirely. The box must have come from windowOf on the same genome
 * and the same generator version, or the art re-frames.
 */
export const primeWindow = (set, box) => boxPut(T.encode(set), box);

/** Every frame shares one window. The stem base stays centred and the soil stays at the bottom. */
export function windowOf(set) {
  const code = T.encode(set);
  const hit = boxCache.get(code);
  if (hit) {
    boxCache.delete(code);
    boxCache.set(code, hit);
    return hit;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let anchorX = 0;
  let groundY = 0;
  let W = 1;
  let H = 1;
  for (const a of ANIMS) {
    for (let i = 0; i < a.frames; i++) {
      const { img, anchorX: ax, groundY: gy } = drawPlant3(set, poseOf(set, a, i));
      anchorX = ax;
      groundY = gy;
      W = img.w;
      H = img.h;
      const { data, w } = img;
      for (let y = 0; y < img.h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          if (!data[row + x]) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  const pad = 2;
  if (!Number.isFinite(minX)) {
    minX = Math.floor(anchorX) - 4;
    maxX = Math.ceil(anchorX) + 4;
    minY = Math.floor(groundY) - 8;
    maxY = Math.ceil(groundY);
  }
  const reach = Math.max(anchorX - minX, maxX - anchorX, 2);
  let w = roundUp(Math.ceil(reach) * 2 + pad * 2);
  let x = Math.round(anchorX - w / 2);
  const bot = Math.max(maxY, Math.min(groundY, H - 1));
  const top = Math.min(minY, bot);
  let h = roundUp(Math.ceil(bot - top) + pad * 2 + 1);
  const slack = h - (Math.ceil(bot - top) + pad * 2);
  let y = Math.floor(top - pad - Math.max(0, slack));
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > W) x = Math.max(0, W - w);
  if (y + h > H) y = Math.max(0, H - h);
  if (x + w > W) w = W - x;
  if (y + h > H) h = H - y;
  const box = { x, y, w: Math.max(1, w), h: Math.max(1, h) };
  return boxPut(code, box);
}

let SIZES_MEMO = null;
const sizesOf = () => (SIZES_MEMO ??= Object.keys(CLASS_H).map((id) => {
  const { w, h } = windowOf(normalizePlant({ species: 'flower', form: 'flower', size: id, bloom: 'daisy' }));
  return { id, w, h };
}));

function frameOf(set, pose) {
  const box = windowOf(set);
  const { img } = drawPlant3(set, pose);
  return crop(img, box.x, box.y, box.w, box.h);
}

export default {
  id: 'plant3',
  version: 3,
  family: 'plant',
  generation: 'old',
  label: 'Garden plants v3',
  game: 'plantasia',
  get size() {
    return sizesOf().find((s) => s.id === 'shrub');
  },
  get sizes() {
    return sizesOf();
  },
  sizeField: 'size',
  sizeOf: (genome) => {
    const { w, h } = windowOf(normalizePlant(genome));
    return { w, h };
  },
  anchor: 'bottom',
  bg: '#2b3a2a',
  traits: T,
  fromSeed,
  fromCode: (code) => {
    const own = T.decode(code);
    return own ? normalizePlant(own) : fromV1Code(code);
  },
  normalize: normalizePlant,
  breed,
  breedDetailed,
  name: (genome) => nameOf(genome),
  describe: (genome) => describePlant(genome),
  fpsOf,
  anims: ANIMS,
  frame(genome, animId, i = 0) {
    const set = normalizePlant(genome);
    const a = ANIMS.find((x) => x.id === animId) ?? ANIMS[0];
    return frameOf(set, poseOf(set, a, i));
  },
  at(genome, t) {
    const set = normalizePlant(genome);
    return frameOf(set, { ...rest('plant3'), growth: Math.max(0, Math.min(1, t)) });
  },
};

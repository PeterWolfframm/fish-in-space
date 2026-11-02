// Plants v4 (plant4): one architecture engine for every plant, from a 16 px radish to a 96 px
// oak, a kelp forest or a sea fan. A form is data (axes, branching orders, phyllotaxis, organs);
// the genome bends it; a pose walks a sway wave up every axis; a G-buffer painter lights it.
//
//   forms.js         50 forms: farm crops and flowers, wild trees and shrubs, water plants
//   engine/arch.js   form + seed → topology (axes and organs, each with its birth time)
//   engine/pose.js   topology + pose (wind, lean, growth, …) → points in pixels
//   engine/draw.js   posed plant → material/tone buffer → outlined, lit indexed image
//   resolve.js       genome → bent form, scale, canvas, materials (cached per code)
//   genome.js, ecotype.js, params.js, data/places.js   the roll: realm → region → form → looks
//   farm.js, names.js, breeding.js, batch.js          what the plant is to a farmer

import { plant4Traits as T, normalizePlant, encodePlant, FARM_FORMS, WILD_FORMS, WATER_FORMS } from './genome.js';
import { FORMS } from './forms.js';
import { resolve, CLASS_H } from './resolve.js';
import { render } from './engine/draw.js';
import { fromSeed } from './ecotype.js';
import { breed, breedDetailed } from './breeding.js';
import { batch } from './batch.js';
import { namesOf, nameOf, describePlant } from './names.js';
import { statsOf, rarityOf, TIERS } from './farm.js';
import { PRESETS, PARAM_SCHEMA, PARAM_GROUPS, validateParams, setParam, resolveParams, paramsHash } from './params.js';
import { anim, poseAt, rest } from '../../v2/anim/rig.js';
import { breeze, gust, rustle, flutter, bloomBreath, openBloom, glowBreath, grow, stageMarks } from '../../v3/plant/motions.js';
import { roundUp, crop } from '../../v2/kit/sizes.js';

export { T as plant4Traits, normalizePlant, FORMS, CLASS_H, statsOf, rarityOf, namesOf, describePlant, breedDetailed, TIERS };

/**
 * One-shot spring → winter. Deciduous plants blossom, colour and drop their leaves (the painter
 * reads `season`); evergreens and water plants only shift their flowers.
 */
const year = () => (p, ctx) => {
  const stage = Math.min(3, ctx.i ?? 0);
  const form = FORMS[normalizePlant(ctx.genome ?? {}).form];
  const deciduous = !!form?.deciduous;
  let bloom = 1;
  if (stage === 0) bloom = 0.5;
  else if (stage === 2) bloom = 0.2;
  else if (stage === 3) bloom = 0;
  return { season: stage, bloom, droop: deciduous && stage === 2 ? 0.2 : 0, growth: 1, sway: 0.28, wind: 0 };
};

/** A resting sway: water plants never sit still in a current, land plants barely stir. */
const calm = () => (p, ctx) => {
  const form = FORMS[normalizePlant(ctx.genome ?? {}).form];
  return { wind: p, sway: form?.medium === 'water' ? 0.8 : 0.45 };
};

export const ANIMS = [
  anim('idle', 12, 6, [calm(), flutter({ cycles: 2 }), bloomBreath(), glowBreath()]),
  anim('wind', 8, 8, [breeze({ cycles: 1, amp: 1 }), flutter({ cycles: 2 })]),
  anim('gust', 12, 8, [gust({ cycles: 1, lean: 1 }), flutter({ cycles: 2 })]),
  anim('rustle', 8, 12, [rustle()]),
  anim('bloom', 8, 6, [openBloom(), flutter({ cycles: 1 })], { loop: false, label: 'bloom (open)' }),
  anim('glow', 8, 6, [breeze({ cycles: 1, amp: 0.3 }), glowBreath(), flutter({ cycles: 2 })]),
  anim('grow', 16, 8, [grow(), breeze({ cycles: 1, amp: 0.25 }), flutter({ cycles: 1 })], { loop: false, continuous: true }),
  anim('stages', 4, 1.5, [stageMarks()], { loop: false }),
  anim('seasons', 4, 2, [year()], { loop: false, label: 'seasons (spring → winter)' }),
];

/** Taller plants sway more slowly (a cantilever's period grows with its length); kelp slower still. */
const fpsOf = (genome, a) => {
  if (a.loop === false) return a.fps;
  const set = normalizePlant(genome);
  const H = CLASS_H[set.size] ?? 32;
  const water = FORMS[set.form]?.medium === 'water' ? 0.75 : 1;
  return Math.max(3, Math.min(16, Math.round(a.fps * Math.sqrt(32 / H) * water)));
};

const poseOf = (set, a, i) => poseAt('plant4', a, i, set);

/** The full, uncropped frame. */
function paint(set, pose) {
  const code = T.encode(set);
  const R = resolve(set, code);
  return render(R.topo, pose, R);
}

// Probing a window paints every frame of every anim: cache boxes, least recently used out first.
const BOX_MAX = 2000;
const boxCache = new Map();
const boxPut = (code, box) => {
  if (boxCache.size >= BOX_MAX) boxCache.delete(boxCache.keys().next().value);
  boxCache.set(code, box);
  return box;
};

/** Seed a window the caller already knows (from windowOf on this genome and this version). */
export const primeWindow = (genome, box) => boxPut(T.encode(normalizePlant(genome)), box);

/** Every frame of a plant shares one window: the stem base centred, the bed at the bottom. */
export function windowOf(genome) {
  const set = normalizePlant(genome);
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
      const { img, anchorX: ax, groundY: gy } = paint(set, poseOf(set, a, i));
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
    minX = anchorX - 4;
    maxX = anchorX + 4;
    minY = groundY - 8;
    maxY = groundY;
  }
  const reach = Math.max(anchorX - minX, maxX - anchorX, 2);
  let w = roundUp(Math.ceil(reach) * 2 + pad * 2);
  let x = Math.round(anchorX - w / 2);
  const bot = maxY;
  const top = Math.min(minY, bot);
  let h = roundUp(Math.ceil(bot - top) + pad * 2 + 1);
  let y = Math.floor(bot + pad + 1 - h);
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > W) x = Math.max(0, W - w);
  if (y + h > H) y = Math.max(0, H - h);
  if (x + w > W) w = W - x;
  if (y + h > H) h = H - y;
  return boxPut(code, { x, y, w: Math.max(1, w), h: Math.max(1, h) });
}

function frameOf(set, pose) {
  const box = windowOf(set);
  const { img } = paint(set, pose);
  return crop(img, box.x, box.y, box.w, box.h);
}

let SIZES_MEMO = null;
/** Reference windows per size class: a daisy for the small ones, an oak for the big ones. */
const sizesOf = () => (SIZES_MEMO ??= Object.keys(CLASS_H).map((id) => {
  const form = id === 'herb' || id === 'shrub' ? 'daisy' : 'oak';
  const { w, h } = windowOf({ form, size: id });
  return { id, w, h };
}));

const fromSeedOpts = (seed, opts, pin) => {
  const params = opts && typeof opts === 'object' && !('avatar' in opts) ? opts.params ?? opts : typeof opts === 'string' ? opts : null;
  return fromSeed(seed, params, pin ?? {});
};

export default {
  id: 'plant4',
  version: 4,
  family: 'plant',
  label: 'Plants v4',
  game: 'plantasia',
  get size() {
    return sizesOf().find((s) => s.id === 'shrub');
  },
  get sizes() {
    return sizesOf();
  },
  sizeField: 'size',
  sizeOf: (genome) => {
    const { w, h } = windowOf(genome);
    return { w, h };
  },
  anchor: 'bottom',
  bg: '#22302c',
  traits: T,
  fromSeed: fromSeedOpts,
  fromCode: (code) => {
    const own = T.decode(code);
    return own ? normalizePlant(own) : null;
  },
  normalize: normalizePlant,
  encode: encodePlant,
  /** Fields that pin where a seed's plant comes from (fromSeed's third argument). */
  placeFields: ['realm', 'region', 'farmForm', 'wildForm', 'waterForm'],
  params: { presets: PRESETS, schema: PARAM_SCHEMA, groups: PARAM_GROUPS, validate: validateParams, set: setParam, resolve: resolveParams, hash: paramsHash },
  batch: (seed, n, params, pin) => batch(seed, n, params, pin),
  breed: (a, b, seed, params) => breed(a, b, seed, params),
  breedDetailed: (a, b, seed, params) => breedDetailed(a, b, seed, params),
  name: (genome) => nameOf(genome),
  names: (genome) => namesOf(genome),
  describe: (genome) => describePlant(genome),
  blurb: (genome) => describePlant(genome),
  stats: (genome) => statsOf(genome),
  rarity: (genome) => Math.min(1, rarityOf(genome).points / TIERS.at(-1).min),
  rarityOf: (genome) => rarityOf(genome),
  forms: { farm: FARM_FORMS, wild: WILD_FORMS, water: WATER_FORMS },
  fpsOf,
  anims: ANIMS,
  frame(genome, animId, i = 0) {
    const set = normalizePlant(genome);
    const a = ANIMS.find((x) => x.id === animId) ?? ANIMS[0];
    return frameOf(set, poseOf(set, a, i));
  },
  at(genome, t) {
    const set = normalizePlant(genome);
    return frameOf(set, { ...rest('plant4'), growth: Math.max(0, Math.min(1, t)) });
  },
};

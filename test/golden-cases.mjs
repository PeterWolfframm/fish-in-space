// The cases the parity goldens cover, and how one image becomes a fingerprint.
//
// scripts/make-goldens.mjs renders these with the ORIGINAL game code (yeswar, fish.) once and
// writes test/fixtures/*.json; test/parity.test.mjs renders them with the ports here and compares.

import { createHash } from 'node:crypto';

/** sha1 of the image's RGBA bytes: equal pictures match even if palette order differs. */
export function fingerprint(img) {
  const rgba = Buffer.alloc(img.w * img.h * 4);
  for (let i = 0; i < img.w * img.h; i++) {
    const e = img.palette[img.data[i]] ?? [0, 0, 0, 0];
    rgba.set(e[3] ? e : [0, 0, 0, 0], i * 4);
  }
  return `${img.w}x${img.h}:${createHash('sha1').update(rgba).digest('hex').slice(0, 16)}`;
}

export const PILOT_SEEDS = ['MAGIC 1', 'VIPER 2', 'EAGLE 1', 'TOWER', 'RWR', 'Guest', 'ROOK 3', 'DEMO', 'SHIP', 'HAWK 4'];
export const PILOT_CASES = [];
for (const seed of PILOT_SEEDS) {
  for (const side of ['blue', 'red']) {
    for (const figure of ['pilot', 'boss', 'tutor', 'scope']) {
      for (const expr of ['idle', 'blink', 'talk', 'strain', 'alarm', 'grin', 'calm', 'eject']) {
        for (const frame of [0, 1, 2, 3]) PILOT_CASES.push({ seed, side, figure, expr, frame });
      }
    }
  }
}
export const pilotKey = (c) => `${c.seed}|${c.side}|${c.figure}|${c.expr}|${c.frame}`;

/** Avatar codes go through avatarFromSeed → pixelTraits, so the whole chain is covered. */
export const AVATAR_SEEDS = ['pilot:MAGIC', 'pilot:VIPER', 'pilot:GUEST', 'a', 'b', 'c', 'd', 'e'];

export const FISH_SEEDS = Array.from({ length: 80 }, (_, i) => `fish-${i}`);

// ---------- v1 freeze ----------
//
// The fish-in-space-native v1 generators (tank plants, garden plants) have no game to be held to, so
// they are held to themselves: fingerprints rendered once from the v1 code before v2 existed.
// `npm run goldens:v1` writes test/fixtures/{waterplant,plant}.json; test/v1-frozen.test.mjs
// compares. A diff there means a v1 algorithm changed — which it must not.

export const V1_SEEDS = Array.from({ length: 40 }, (_, i) => `v1-${i}`);

/** Every frame of every case, keyed `seed|frame` (tank plants) or `seed|size|t` (garden plants). */
export function waterplantGoldens({ waterplantTraits, drawWaterplant, SWAY_FRAMES }) {
  const out = {};
  const forms = waterplantTraits.fieldById('form').choices.map((c) => c.id);
  const genomes = [
    ...V1_SEEDS.map((s) => [s, waterplantTraits.fromSeed(s)]),
    ...forms.map((form) => [`form:${form}`, { ...waterplantTraits.fromSeed(form), form, rarity: 'myth', glow: 'tips', bubbles: 'yes' }]),
  ];
  for (const [key, g] of genomes) for (let f = 0; f < SWAY_FRAMES; f++) out[`${key}|${f}`] = fingerprint(drawWaterplant(g, f));
  return out;
}

export function plantGoldens({ plantTraits, drawPlant }) {
  const out = {};
  const forms = plantTraits.fieldById('form').choices.map((c) => c.id);
  const genomes = [
    ...V1_SEEDS.map((s) => [s, plantTraits.fromSeed(s)]),
    ...forms.map((form) => [`form:${form}`, { ...plantTraits.fromSeed(form), form, rarity: 'myth', glow: 'crystal' }]),
  ];
  for (const [key, g] of genomes) {
    for (const size of [16, 32]) {
      for (let i = 0; i < 16; i++) {
        const t = i / 15;
        out[`${key}|${size}|${i}`] = fingerprint(drawPlant(g, t, size));
      }
    }
  }
  return out;
}

// ---------- v2 compatibility ----------
//
// v2 grows by appending options whose first choice is the look it had before. A code written
// before an append decodes with the new fields at their defaults, so it must keep drawing the
// same pixels. `npm run goldens:v2` captured these codes once; test/v2-compat.test.mjs compares.

export const V2_SEEDS = Array.from({ length: 10 }, (_, i) => `v2c-${i}`);

/** `code` → { `anim|frame`: fingerprint } for every v2 generator, size class and anim. */
export function v2Goldens({ GENERATORS, fromCode }) {
  const out = {};
  for (const gen of GENERATORS.filter((g) => g.version === 2)) {
    for (const seed of V2_SEEDS) {
      for (const size of gen.sizes) {
        const code = gen.traits.encode({ ...gen.fromSeed(seed), [gen.sizeField]: size.id });
        const g = fromCode(gen, code);
        const prints = {};
        for (const a of gen.anims) for (const i of new Set([0, a.frames >> 1])) prints[`${a.id}|${i}`] = fingerprint(gen.frame(g, a.id, i));
        out[`${gen.id}|${code}`] = prints;
      }
    }
  }
  return out;
}

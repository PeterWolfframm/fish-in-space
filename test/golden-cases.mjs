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

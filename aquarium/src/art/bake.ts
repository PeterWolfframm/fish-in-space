// One generator animation as a horizontal RGBA strip. Generic over the fish-in-space families the game
// uses. Runs in the bake worker (and on the main thread as a fallback).

import fishV1, { fishTraits } from '@forge/gen/fish.js';
import fish2 from '@forge/v2/fish/index.js';
import fish4 from '@forge/v4/fish/index.js';
import waterplant2 from '@forge/v2/waterplant/index.js';
import plant3 from '@forge/v3/plant/index.js';
import pilot2 from '@forge/v2/pilot/index.js';

export type Family = 'fish4' | 'fish' | 'fish2' | 'waterplant2' | 'plant3' | 'pilot2';

interface Frame {
  w: number;
  h: number;
  data: ArrayLike<number>;
  palette: number[][];
}
interface Gen {
  anims: { id: string; frames: number; fps: number }[];
  fromCode(c: string): unknown;
  fromSeed(s: string, o?: unknown): unknown;
  normalize?(g: unknown): unknown;
  fpsOf?(g: unknown, a: unknown): number;
  frame(g: unknown, anim: string, i: number): Frame;
}
/** v1's generator has no fromCode; the trait code is the genome. */
const fish: Gen = {
  anims: fishV1.anims,
  fromCode: (c) => fishTraits.decode(c) ?? fishTraits.defaults(),
  normalize: (g) => fishTraits.normalize(g),
  fromSeed: (s) => fishV1.fromSeed(s),
  frame: (g, anim, i) => fishV1.frame(g, anim, i),
};

const GENS: Record<Family, Gen> = { fish4, fish, fish2, waterplant2, plant3, pilot2 };

/** A character code is `seed|figure`; the portrait framing is always used. */
function genomeOf(family: Family, code: string): unknown {
  const gen = GENS[family];
  if (family === 'pilot2') {
    const [seed, figure = 'pilot'] = code.split('|');
    const g = gen.fromSeed(seed, { figure }) as Record<string, unknown>;
    return gen.normalize ? gen.normalize({ ...g, size: 'portrait' }) : { ...g, size: 'portrait' };
  }
  const g = gen.fromCode(code);
  if (!g) throw new Error(`not a ${family} code`);
  return gen.normalize ? gen.normalize(g) : g;
}

export interface Strip {
  w: number;
  h: number;
  n: number;
  fps: number;
  rgba: Uint8ClampedArray;
}

export function bake(family: Family, code: string, animId: string): Strip {
  const gen = GENS[family];
  const genome = genomeOf(family, code);
  const anim = gen.anims.find((a) => a.id === animId) ?? gen.anims[0];
  const n = Math.max(1, anim.frames);
  const frames = Array.from({ length: n }, (_, i) => gen.frame(genome, anim.id, i));
  // Frames can differ in size; pad to the largest, centred and bottom-aligned.
  const w = Math.max(...frames.map((f) => f.w));
  const h = Math.max(...frames.map((f) => f.h));
  const W = w * n;
  const rgba = new Uint8ClampedArray(W * h * 4);
  frames.forEach((img, f) => {
    const ox = f * w + ((w - img.w) >> 1);
    const oy = h - img.h;
    for (let y = 0; y < img.h; y++) {
      for (let x = 0; x < img.w; x++) {
        const p = img.palette[img.data[y * img.w + x]];
        if (!p || !p[3]) continue;
        const o = ((y + oy) * W + ox + x) * 4;
        rgba[o] = p[0];
        rgba[o + 1] = p[1];
        rgba[o + 2] = p[2];
        rgba[o + 3] = p[3];
      }
    }
  });
  const fps = gen.fpsOf ? gen.fpsOf(genome, anim) : anim.fps;
  return { w, h, n, fps: fps || anim.fps || 6, rgba };
}

export const animsOf = (family: Family) => GENS[family].anims.map((a) => a.id);

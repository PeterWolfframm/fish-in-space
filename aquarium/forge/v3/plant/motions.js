// Plant3 motions. A motion is (options) → (p, ctx, pose) → channels. Looping motions are
// periodic in p. One-shots may key off the frame index.

import { normalizePlant } from './genome.js';
import { resolveSpec } from './habits.js';
import { STAGE_T } from '../../gen/plant.js';

const TAU = Math.PI * 2;
/** 0 at the ends, 1 in the middle. Loops, because sin(0) = sin(π) = 0. */
const bump = (p) => Math.sin(Math.PI * p) ** 2;

/** A breeze: `cycles` whole sways per loop, at amplitude `amp`. */
export const breeze = ({ cycles = 1, amp = 1 } = {}) => (p) => ({ wind: p * cycles, sway: amp });

/** A gust that rises and settles. `bump` is 0 at both ends, so the loop closes. */
export const gust = ({ cycles = 1, lean = 1 } = {}) => (p) => ({
  wind: p * cycles,
  sway: 1 + 1.2 * bump(p),
  lean: lean * bump(p),
});

/** Leaves and petals, with the stems held quiet. */
export const rustle = ({ cycles = 3, amp = 0.22 } = {}) => (p) => ({
  wind: p,
  sway: amp,
  flutter: p * cycles,
});

/** Leaf-tip flutter, `cycles` whole beats per loop. */
export const flutter = ({ cycles = 2 } = {}) => (p) => ({ flutter: p * cycles });

/** Flowers breathe between `low` and fully open. */
export const bloomBreath = ({ low = 0.62 } = {}) => (p) => ({
  bloom: low + (1 - low) * (0.5 + 0.5 * Math.cos(TAU * p)),
});

/** A one-shot: flowers open from shut. */
export const openBloom = () => (p) => ({ bloom: p, growth: 1, sway: 0.35, wind: p });

/** Glow breathes around the rest value. */
export const glowBreath = ({ cycles = 1 } = {}) => (p) => ({
  glow: 0.5 + 0.5 * Math.sin(TAU * p * cycles),
});

/** A highlight walks the leaves once per loop. */
export const sheenSweep = () => (p) => ({ sheen: p });

/** A one-shot from `from` to `to` growth. */
export const grow = ({ from = 0, to = 1 } = {}) => (p) => ({ growth: from + (to - from) * p });

/** Fixed growth points, one per frame (plantasia's stages). */
export const stages = (ts) => (p, { i }) => ({ growth: ts[Math.min(i, ts.length - 1)] });

export const stageMarks = () => stages(STAGE_T);

/**
 * One-shot spring → winter. Deciduous plants lean and drop their flowers. Evergreens only dull,
 * which the painter reads from `season`.
 */
export const year = () => (p, ctx) => {
  const stage = Math.min(3, ctx.i ?? 0);
  const spec = resolveSpec(normalizePlant(ctx.genome ?? {}));
  const deciduous = !spec.evergreen;
  const droop = !deciduous ? 0 : stage === 2 ? 0.45 : stage === 3 ? 0.95 : 0;
  const lean = deciduous && stage >= 2 ? 0.35 : 0;
  let bloom = 1;
  if (stage === 0) bloom = 0.4;
  else if (stage === 2) bloom = 0.15;
  else if (stage === 3) bloom = deciduous ? 0 : 0.85;
  return { season: stage, droop, lean, bloom, growth: 1, sway: 0.28, wind: 0 };
};

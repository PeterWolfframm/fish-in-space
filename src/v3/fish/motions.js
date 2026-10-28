// Motions for fish3 (channels: CHANNELS.fish3 in src/v2/anim/rig.js). Same contract as the v2
// library: `(options) → (p, ctx, pose) → channels`, periodic in p for looping anims.
//
// The body wave itself is physics (kinematics.js); these only drive its phase and strength, plus
// the things a fish does with its face and fins while it swims.

import { bump } from '../../v2/anim/motions.js';

const TAU = Math.PI * 2;
const during = (p, at, len) => (p - at + 1) % 1 < len;

/** Cruise: `beats` tail beats per loop, fins and gills in step. */
export const cruise = ({ beats = 1, amp = 1 } = {}) => (p) => ({
  wave: p * beats,
  amp,
  fin: Math.sin(TAU * p * beats + 1.2),
  ripple: p * beats * 2,
  pelvic: Math.sin(TAU * p * beats + 2.4),
  gill: 0.5 + 0.5 * Math.sin(TAU * p),
});

/** Flat out: bigger, faster beats, fins tucked flat, gills working hard. */
export const sprint = ({ beats = 2 } = {}) => (p) => ({
  wave: p * beats,
  amp: 1.35,
  fin: -1,
  pelvic: -1,
  ripple: p * beats * 2,
  gill: 0.5 + 0.5 * Math.sin(TAU * p * beats),
  lean: -0.12,
});

/**
 * Burst and coast: one strong beat over the first `burst` of the loop, then a long glide with the
 * body straightening and the fins spread. The wave lands on a whole turn, so it loops.
 */
export const burstCoast = ({ burst = 0.4 } = {}) => (p) => {
  const inBurst = p < burst;
  const q = inBurst ? p / burst : 1;
  const ease = q < 1 ? q - Math.sin(TAU * q) / (TAU * 1.6) : 1;
  return {
    wave: ease,
    amp: 0.3 + (inBurst ? 0.95 * Math.sin(Math.PI * q) : 0),
    coast: inBurst ? 0 : bump((p - burst) / (1 - burst)) ** 0.5,
    fin: inBurst ? -0.8 : 0.7,
    pelvic: inBurst ? -0.8 : 0.4,
    ripple: p * 2,
    gill: 0.5 + 0.5 * Math.sin(TAU * p),
  };
};

/** Hanging in the water: a slow, small wave, pectorals sculling, a gentle bob and breathing. */
export const loiter = ({ bob = 1 } = {}) => (p) => ({
  wave: p,
  amp: 0.25,
  fin: 0.8 * Math.sin(TAU * p * 2),
  pelvic: 0.6 * Math.sin(TAU * p * 2 + 1),
  ripple: p * 2,
  gill: 0.5 + 0.5 * Math.sin(TAU * p * 2),
  bob: Math.round(Math.sin(TAU * p) * bob),
});

/** A U-turn: the body C-bends into the turn while the sprite swings round. */
export const uTurn = () => (p) => ({ turn: p, bend: 0.8 * Math.sin(TAU * p), lean: 0.15 * Math.sin(TAU * p * 2) });

/** Feeding: `bites` snaps per loop, nose down, fins braking, gills flaring after each bite. */
export const feed = ({ bites = 2, open = 0.45 } = {}) => (p) => {
  const q = (p * bites) % 1;
  const snap = q < open ? bump(q / open) : 0;
  return { mouth: snap, lean: -0.3 * snap, fin: -0.6 * snap + 0.3 * Math.sin(TAU * p * bites), gill: bump(q) };
};

/** A blink, shut for `len` of the loop from `at`. */
export const blinkOnce = ({ at = 0.6, len = 0.12 } = {}) => (p) => ({ lid: during(p, at, len) ? 1 : 0 });

/** A look back over the shoulder in the middle of the loop. */
export const lookBack = ({ at = 0.25, len = 0.3 } = {}) => (p) => ({ glance: during(p, at, len) ? -1 : 0 });

export const glowBreath = ({ cycles = 1 } = {}) => (p) => ({ glow: 0.5 + 0.5 * Math.sin(TAU * p * cycles) });
export const sheenSweep = () => (p) => ({ sheen: p });

/** Life stages, one per frame: fry, juvenile, adult, elder. */
export const lifeStages = () => (p, { i }) => ({ stage: Math.min(3, i), amp: 0.3 });

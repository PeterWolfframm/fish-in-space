// fish4's extra motions: the face channel (`expr`) and the moods that go with it. Same contract
// as v3/fish/motions.js: `(options) → (p, ctx, pose) → channels`, periodic in p when looping.

const TAU = Math.PI * 2;

/** Hold an expression for the whole anim: neutral, happy, tired or dead (frame.js EXPRESSIONS). */
export const expression = (expr) => () => ({ expr });

/** A happy wiggle: a quick, lively beat with a little hop. */
export const wiggle = () => (p) => ({ bob: Math.round(-Math.max(0, Math.sin(TAU * p * 2))), fin: Math.sin(TAU * p * 4), lid: p > 0.4 && p < 0.6 ? 1 : 0 });

/** Exhausted: barely moving, sunk a pixel, eyes half shut, fins hanging. */
export const droop = () => (p) => ({ wave: p, amp: 0.15, fin: 0.3 + 0.2 * Math.sin(TAU * p), pelvic: 0.5, gill: 0.5 + 0.5 * Math.sin(TAU * p), bob: 1, lean: -0.12, lid: 0.55 });

/** Dead: still, belly up (frame.js flips it), rising and falling a pixel on the swell. */
export const floatDead = () => (p, { i }) => ({ wave: 0, amp: 0, coast: 1, fin: 0.6, pelvic: 0.6, gill: 0, mouth: 0.25, bob: i % 2, glow: 0, lid: 0 });

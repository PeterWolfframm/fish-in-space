// The motion library. A motion is `(options) → (p, ctx, pose) → channels`: p is the anim phase
// (0..1), ctx has { i, frames, genome }, pose is what earlier motions set. Motions are pure.
//
// Loop rule: in a looping anim p never reaches 1, and the frame after the last is p = 0 again. A
// looping motion must therefore be periodic in p — sin/cos of 2πp·n with whole n, `bump`, or a
// phase channel advanced by whole cycles (wave: p * 2). test/v2.test.mjs checks every loop closes.

const TAU = Math.PI * 2;
/** 0 at the ends, 1 in the middle, smooth: loops. */
export const bump = (p) => Math.sin(Math.PI * p) ** 2;
/** A blip that is 1 for `len` of the cycle starting at `at`. */
const during = (p, at, len) => ((p - at + 1) % 1) < len;

// ---------- fish ----------

/** The cruise: `beats` tail beats per loop. */
export const swim = ({ beats = 1, amp = 1 } = {}) => (p) => ({ wave: p * beats, amp, fin: Math.sin(TAU * p * beats + 1.2) });

/** Hanging in the water: a slow, small wave, fins sculling, a gentle bob. */
export const hover = ({ bob = 1 } = {}) => (p) => ({ wave: p, amp: 0.3, fin: Math.sin(TAU * p * 2), bob: Math.round(Math.sin(TAU * p) * bob) });

/** A burst: big fast beats that ease off, nose a little down. */
export const dart = ({ beats = 2 } = {}) => (p) => ({ wave: p * beats, amp: 1.2 + 0.9 * bump(p), tail: 0.6 * Math.sin(TAU * p * beats), fin: -0.8, lean: -0.25 * bump(p) });

/** Turn all the way round over the loop. */
export const turnRound = () => (p) => ({ turn: p });

/** A blink: shut for `len` of the loop, from `at`. Works for fish and pilots. */
export const blink = ({ at = 0.6, len = 0.12 } = {}) => (p) => ({ lid: during(p, at, len) ? 1 : 0 });

/** The glow breathes. */
export const pulse = ({ cycles = 1 } = {}) => (p) => ({ glow: 0.5 + 0.5 * Math.sin(TAU * p * cycles) });

/** The sheen sweeps along once per loop. */
export const sheen = () => (p) => ({ sheen: p });

/** Feeding: `bites` snaps per loop, each a quick nose-down dip with the mouth open and fins braking. */
export const eat = ({ bites = 2, open = 0.45 } = {}) => (p) => {
  const q = (p * bites) % 1;
  const snap = q < open ? bump(q / open) : 0;
  return { mouth: snap, lean: -0.3 * snap, fin: -0.6 * snap + 0.3 * Math.sin(TAU * p * bites) };
};

/** Bob up and down by `px`. */
export const bob = ({ px = 1, cycles = 1 } = {}) => (p) => ({ bob: Math.round(Math.sin(TAU * p * cycles) * px) });

// ---------- plants ----------

/** The current: `cycles` sways per loop. */
export const sway = ({ cycles = 1, amp = 1 } = {}) => (p) => ({ wind: p * cycles, sway: amp });

/** A gust: the plant leans and thrashes, then settles. */
export const gust = ({ cycles = 2, lean = 1 } = {}) => (p) => ({ wind: p * cycles, sway: 1 + 1.4 * bump(p), lean: lean * bump(p) });

/** Leaf tips flutter, `cycles` times per loop. */
export const flutter = ({ cycles = 3 } = {}) => (p) => ({ flutter: p * cycles });

/** Bubbles rise through the loop. */
export const bubbles = ({ cycles = 1 } = {}) => (p) => ({ bubbles: p * cycles });

/** Flowers close and open over the loop. */
export const bloomBreath = ({ low = 0.55 } = {}) => (p) => ({ bloom: low + (1 - low) * (0.5 + 0.5 * Math.cos(TAU * p)) });

/** A one-shot from `from` to `to` growth (use with loop: false). */
export const grow = ({ from = 0, to = 1 } = {}) => (p) => ({ growth: from + (to - from) * p });

/** Fixed growth points, one per frame (plantasia's stages). */
export const stages = (ts) => (p, { i }) => ({ growth: ts[Math.min(i, ts.length - 1)] });

// ---------- pilots ----------

/** An expression from v1's set, its frame counter running with the anim. */
export const expression = (expr) => (p, { i }) => ({ expr, beat: i, phase: p });

/** Talk: the mouth flaps in an uneven rhythm, so it reads as speech, not chewing. */
export const talk = () => (p, { i }) => ({ expr: 'talk', beat: i, phase: p, mouth: [0.2, 1, 0.5, 0.9, 0.1, 0.7][i % 6] });

/** Shake: g-force jitter of `px`. */
export const shake = ({ px = 1, cycles = 2 } = {}) => (p) => ({ shake: Math.round(Math.sin(TAU * p * cycles * 2) * px) });

/** Eyelids shut for `len` of the loop from `at` (any family with a `lid` channel). */
export const blinkAt = ({ at = 0.75, len = 0.125 } = {}) => (p) => ({ lid: during(p, at, len) ? 1 : 0 });

/** Glance left, back, right, back. */
export const glance = () => (p) => ({ glance: Math.round(Math.sin(TAU * p)) });

/** The radar scope's sweep. */
export const scopeSweep = () => (p) => ({ sweep: p });

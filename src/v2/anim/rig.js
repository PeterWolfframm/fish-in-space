// Poses: what an animation is allowed to move. Each family has a fixed set of channels with rest
// values; a renderer reads only the pose, never the frame number, so an animation is nothing more
// than a list of motions that set channels over a phase. Adding an animation to an asset is then:
// pick (or write) motions, list them in the generator's `anims`. See .claude/skills/add-animation.

/** Every channel, its rest value, and what it means to the renderer. */
export const CHANNELS = {
  fish: {
    wave: [0, 'swim-wave phase, 0..1 per beat (integers loop)'],
    amp: [1, 'body-wave amplitude, 1 = a cruising swim'],
    tail: [0, 'extra tail swing, -1..1'],
    fin: [0, 'pectoral-fin beat, -1..1'],
    mouth: [0, 'mouth open, 0..1'],
    lid: [0, 'eyelid, 0 open .. 1 shut'],
    turn: [0, 'turn round, 0..1 a full turn (0.5 = facing left)'],
    bob: [0, 'vertical offset, px'],
    lean: [0, 'nose up (+) or down (−), -1..1'],
    glow: [0.5, 'glow strength, 0..1'],
    sheen: [0, 'sheen sweep phase, 0..1'],
  },
  plant: {
    wind: [0, 'sway phase, 0..1 per cycle (integers loop)'],
    sway: [1, 'sway amplitude, 1 = a gentle current'],
    lean: [0, 'steady push to one side, -1..1 (a gust)'],
    flutter: [0, 'leaf-tip flutter phase, 0..1'],
    bloom: [1, 'flowers open, 0..1'],
    growth: [1, 'growth t, 0 seed .. 1 grown'],
    glow: [0.5, 'glow strength, 0..1'],
    bubbles: [0, 'bubble rise phase, 0..1 (integers loop)'],
  },
  pilot: {
    expr: ['idle', 'expression: idle blink talk strain alarm grin calm eject'],
    beat: [0, 'expression frame counter (whole numbers)'],
    lid: [0, 'eyelids, 0 open .. 1 shut'],
    mouth: [0, 'mouth open, 0..1'],
    tilt: [0, 'head tilt, px (−left, +right)'],
    shake: [0, 'whole-figure jitter, px'],
    glance: [0, 'eyes look −1 left .. 1 right'],
    sweep: [0, 'scope sweep phase, 0..1'],
    phase: [0, 'anim phase, 0..1 (loop-safe clock for glints and blinks)'],
  },
};

/** The rest pose of a family. */
export const rest = (family) => Object.fromEntries(Object.entries(CHANNELS[family]).map(([k, [v]]) => [k, v]));

/**
 * The phase of frame `i`: a looping anim spreads frames over [0, 1) so frame `frames` would be
 * frame 0 again; a one-shot runs 0..1 inclusive so its last frame is the end state.
 */
export const phaseOf = (anim, i) => (anim.loop === false ? i / Math.max(1, anim.frames - 1) : (i % anim.frames) / anim.frames);

/** The pose at frame `i` of `anim`: rest, then each motion's channels in order (later wins). */
export function poseAt(family, anim, i, genome) {
  const p = phaseOf(anim, i);
  const pose = rest(family);
  const ctx = { i, frames: anim.frames, genome, anim: anim.id };
  for (const m of anim.motions ?? []) Object.assign(pose, m(p, ctx, pose));
  return pose;
}

/** An anim entry, with defaults: `{ id, frames, fps, loop, motions, label? }`. */
export const anim = (id, frames, fps, motions, extra = {}) => ({ id, frames, fps, loop: true, motions, ...extra });

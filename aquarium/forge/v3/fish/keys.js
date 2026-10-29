// Hand-keyed pose overrides for fish3, applied after the motions. When the modelled swim gets a
// frame wrong for some body, fix that frame here instead of bending the physics for every fish.
// See .claude/skills/fish-keys/SKILL.md for the workflow.
//
// Shape: KEYS[body or hybrid or '*'][animId][frameIndex] = { channel: value, … }
// Body-specific keys win over '*'. Values replace the channel outright. Frames are 0-based.
//
// Example:
//   export const KEYS = {
//     mola: { swim: { 3: { fin: 1 }, 7: { fin: -1 } } },
//   };

export const KEYS = {};

/** The pose with any hand keys for (body, anim, frame) laid over it. */
export function keyed(pose, body, animId, i, keys = KEYS) {
  const all = keys['*']?.[animId]?.[i];
  const own = keys[body]?.[animId]?.[i];
  if (!all && !own) return pose;
  return { ...pose, ...all, ...own };
}

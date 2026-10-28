// Hand-keyed pose overrides for plant3, applied after the motions. When the bend model gets
// one frame of one species wrong, fix that frame here instead of bending the gait for every plant.
//
// Shape: KEYS[species or cross or '*'][animId][frameIndex] = { channel: value, … }
// Species keys win over '*'. Values replace the channel. Frames are 0-based.

export const KEYS = {};

/** The pose with any hand keys for (species, anim, frame) laid over it. */
export function keyed(pose, species, animId, i, keys = KEYS) {
  const all = keys['*']?.[animId]?.[i];
  const own = keys[species]?.[animId]?.[i];
  if (!all && !own) return pose;
  return { ...pose, ...all, ...own };
}

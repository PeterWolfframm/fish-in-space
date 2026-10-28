// One fish animation as a strip of frames, left to right, in RGBA. Shared by the worker and the
// main-thread fallback.

import fish from '../../../src/v3/fish/index.js';

export function bake(code, animId) {
  const genome = fish.normalize(fish.fromCode(code));
  const anim = fish.anims.find((a) => a.id === animId) ?? fish.anims[0];
  const n = anim.frames;
  const frames = Array.from({ length: n }, (_, i) => fish.frame(genome, anim.id, i));
  const { w, h } = frames[0];
  const W = w * n;
  const rgba = new Uint8ClampedArray(W * h * 4);
  frames.forEach((img, f) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = img.palette[img.data[y * w + x]];
        if (!p || !p[3]) continue;
        const o = (y * W + f * w + x) * 4;
        rgba[o] = p[0];
        rgba[o + 1] = p[1];
        rgba[o + 2] = p[2];
        rgba[o + 3] = p[3];
      }
    }
  });
  return { w, h, n, fps: fish.fpsOf(genome, anim), buf: rgba.buffer };
}

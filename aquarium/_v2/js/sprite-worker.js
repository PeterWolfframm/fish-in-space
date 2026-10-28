// Bakes fish3 animations off the main thread: one horizontal RGBA strip per (fish, anim), sent back
// as a transferable buffer. A fish's first frame is the slow one (fish3 measures its window).

import { bake } from './bake.js';

self.onmessage = ({ data }) => {
  try {
    const out = bake(data.code, data.anim);
    self.postMessage({ id: data.id, ...out }, [out.buf]);
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e?.message ?? e) });
  }
};

// Bakes strips off the main thread and sends each back as an ImageBitmap (or a raw buffer where
// workers can't make bitmaps).

import { bake, type Family } from './bake';

interface Job {
  id: number;
  family: Family;
  code: string;
  anim: string;
}

self.onmessage = async ({ data }: MessageEvent<Job>) => {
  try {
    const s = bake(data.family, data.code, data.anim);
    const meta = { id: data.id, w: s.w, h: s.h, n: s.n, fps: s.fps };
    if (typeof createImageBitmap === 'function' && typeof ImageData !== 'undefined') {
      const bmp = await createImageBitmap(new ImageData(s.rgba as Uint8ClampedArray<ArrayBuffer>, s.w * s.n, s.h));
      (self as unknown as Worker).postMessage({ ...meta, bmp }, [bmp]);
    } else {
      (self as unknown as Worker).postMessage({ ...meta, buf: s.rgba.buffer }, [s.rgba.buffer]);
    }
  } catch (e) {
    (self as unknown as Worker).postMessage({ id: data.id, error: String((e as Error)?.message ?? e) });
  }
};

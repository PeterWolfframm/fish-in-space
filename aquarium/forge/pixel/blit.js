// Vendored from the pixel kit — do not edit here.
// Source: kit/web/pixel/blit.js in the Burn-Through repo.
// Run `node scripts/vendor-pixel.mjs` to update, and edit it there.
// Getting a {w, h, data, palette} image onto a canvas, into a sheet, or out as a file.
//
// The only module here that touches the DOM.

/** The image as RGBA bytes, row-major. Pass an existing array to fill it in place. */
export function toRGBA(img, out = new Uint8ClampedArray(img.w * img.h * 4)) {
  for (let i = 0; i < img.w * img.h; i++) {
    const entry = img.palette[img.data[i]];
    const o = i * 4;
    if (!entry) {
      out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      continue;
    }
    out[o] = entry[0];
    out[o + 1] = entry[1];
    out[o + 2] = entry[2];
    out[o + 3] = entry[3];
  }
  return out;
}

/** The image as ImageData, at 1:1. Browser only. */
export function toImageData(img) {
  return new ImageData(toRGBA(img), img.w, img.h);
}

/**
 * The image on its own canvas, scaled by an integer factor with smoothing off.
 *
 * Writing ImageData once and scaling with drawImage beats one fillRect per pixel by a wide
 * margin, and keeps edges hard.
 */
export function toCanvas(img, scale = 1) {
  const src = document.createElement('canvas');
  src.width = img.w;
  src.height = img.h;
  src.getContext('2d').putImageData(toImageData(img), 0, 0);
  if (scale === 1) return src;

  const out = document.createElement('canvas');
  out.width = img.w * scale;
  out.height = img.h * scale;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** Draw the image into an existing 2D context at integer `scale`. */
export function paint(ctx, img, scale = 1, x0 = 0, y0 = 0) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(toCanvas(img, 1), 0, 0, img.w, img.h, x0, y0, img.w * scale, img.h * scale);
}

/** Several same-sized frames laid out in one horizontal strip. */
export function toSheet(frames, { columns = frames.length } = {}) {
  if (!frames.length) throw new Error('toSheet needs at least one frame');
  const { w, h } = frames[0];
  const cols = Math.max(1, Math.min(columns, frames.length));
  const rows = Math.ceil(frames.length / cols);

  const palette = [[0, 0, 0, 0]];
  const index = new Map([['0,0,0,0', 0]]);
  const data = new Uint16Array(w * cols * h * rows);

  frames.forEach((frame, i) => {
    if (frame.w !== w || frame.h !== h) throw new Error('toSheet needs frames of one size');
    // Frames are generated independently, so their palettes do not line up — remap as we copy.
    const remap = frame.palette.map((entry, pi) => {
      if (pi === 0) return 0;
      const key = entry.join(',');
      let at = index.get(key);
      if (at == null) {
        at = palette.length;
        palette.push(entry);
        index.set(key, at);
      }
      return at;
    });
    const ox = (i % cols) * w;
    const oy = Math.floor(i / cols) * h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        data[(oy + y) * w * cols + ox + x] = remap[frame.data[y * w + x]] ?? 0;
      }
    }
  });

  return { w: w * cols, h: h * rows, data, palette, frameWidth: w, frameHeight: h, columns: cols };
}

/** The image as a PNG blob, at integer `scale`. Browser only. */
export function toPNG(img, scale = 1) {
  return new Promise((resolve, reject) => {
    toCanvas(img, scale).toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

/** The image as a PNG data URL, at integer `scale`. Browser only. */
export const toDataURL = (img, scale = 1) => toCanvas(img, scale).toDataURL('image/png');

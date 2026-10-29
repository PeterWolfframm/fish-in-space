// Size classes at constant pixel density: a bigger class is a bigger canvas with more real pixels
// of the same scale, never an upscale. Helpers to place mixed sizes side by side.

/** Round up to a multiple of `m`. */
export const roundUp = (v, m = 4) => Math.ceil(v / m) * m;

/** The class a genome's size field picks, from a generator's `sizes` list. */
export const sizeClass = (sizes, id) => sizes.find((s) => s.id === id) ?? sizes[0];

/**
 * An image placed on a bigger transparent canvas. `anchor`: 'bottom' (plants stand on the floor),
 * 'center' (fish float), or 'top'.
 */
export function pad(img, w, h, anchor = 'center') {
  if (img.w === w && img.h === h) return img;
  const data = new Uint16Array(w * h);
  const ox = Math.floor((w - img.w) / 2);
  const oy = anchor === 'bottom' ? h - img.h : anchor === 'top' ? 0 : Math.floor((h - img.h) / 2);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const tx = x + ox;
      const ty = y + oy;
      if (tx >= 0 && ty >= 0 && tx < w && ty < h) data[ty * w + tx] = img.data[y * img.w + x];
    }
  }
  return { w, h, data, palette: img.palette };
}

/** Pad a list of images to the biggest of them, so a sheet can hold mixed sizes. */
export function padAll(imgs, anchor = 'center') {
  const w = Math.max(...imgs.map((i) => i.w));
  const h = Math.max(...imgs.map((i) => i.h));
  return imgs.map((i) => pad(i, w, h, anchor));
}

/** The `w`×`h` window of an image at x, y (a framing of a bigger scene). */
export function crop(img, x, y, w, h) {
  const data = new Uint16Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      const sy = y + j;
      if (sx >= 0 && sy >= 0 && sx < img.w && sy < img.h) data[j * w + i] = img.data[sy * img.w + sx];
    }
  }
  return { w, h, data, palette: img.palette };
}

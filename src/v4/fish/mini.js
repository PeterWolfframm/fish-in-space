// The miniscule artwork: a fish as a tiny icon (at most MINI_W × MINI_H) for notes and lists. Always
// the grown fish, whatever stage this one is at, so a fry's note shows what it will become.
//
// Painted from the full frame, not drawn on its own: the frame is boxed down by area (the most
// common colour per block, thin wisps dropped), the palette is merged to a few colours, the
// underside shaded and the eye stamped back in, so the icon reads as that fish.

import { INK } from '../../v3/fish/colors.js';
import { toLab } from './frame.js';

export const MINI_W = 24;
export const MINI_H = 14;
/** Colours kept besides the ink. */
const KEEP = 6;
/** A block shows as fish when at least this share of it is painted. */
const FILL = 0.42;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const INK_RGBA = hex(INK);
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** Bounding box of the painted pixels. */
function boundsOf(img) {
  let x0 = img.w;
  let y0 = img.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!img.data[y * img.w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * The eye in the full frame: the darkest near-black pixel well inside the head end (the fish faces
 * right), i.e. with all eight neighbours painted; the furthest forward wins a tie. Null when none.
 */
function eyeOf(img, b) {
  let best = null;
  let bestL = 80;
  const from = b.x0 + Math.floor(b.w * 0.55);
  for (let x = b.x0 + b.w - 2; x >= Math.max(from, 1); x--) {
    for (let y = b.y0 + 1; y < b.y0 + b.h - 1; y++) {
      const i = img.data[y * img.w + x];
      if (!i) continue;
      const l = lum(img.palette[i]);
      if (l >= bestL) continue;
      let inside = true;
      for (let dy = -1; dy <= 1 && inside; dy++) for (let dx = -1; dx <= 1; dx++) if (!img.data[(y + dy) * img.w + x + dx]) inside = false;
      if (inside) [best, bestL] = [{ x, y }, l];
    }
  }
  return best;
}

/**
 * The icon from a full frame (`frame(adult, 'swim', 0)` or any cropped fish frame): a standard
 * `{ w, h, data, palette }` image no bigger than MINI_W × MINI_H.
 */
export function miniOf(img) {
  const b = boundsOf(img);
  if (!b) return { w: 1, h: 1, data: new Uint16Array(1), palette: [[0, 0, 0, 0]] };
  const k = Math.min(1, MINI_W / b.w, MINI_H / b.h);
  const w = Math.max(1, Math.min(MINI_W, Math.round(b.w * k)));
  const h = Math.max(1, Math.min(MINI_H, Math.round(b.h * k)));
  // Outlines and pupils: near-black, so they only win a block where there is nothing else.
  const dark = img.palette.map((c, i) => i > 0 && c[3] > 0 && lum(c) < 45);

  // 1. Box down: the most common colour in each block (the ink's outlines count for less, so the
  //    body colours win wherever there are any), or nothing when the block is mostly water.
  const cells = new Int32Array(w * h);
  const counts = new Map();
  for (let j = 0; j < h; j++) {
    const sy0 = b.y0 + Math.floor((j * b.h) / h);
    const sy1 = b.y0 + Math.max(Math.floor(((j + 1) * b.h) / h), Math.floor((j * b.h) / h) + 1);
    for (let i = 0; i < w; i++) {
      const sx0 = b.x0 + Math.floor((i * b.w) / w);
      const sx1 = b.x0 + Math.max(Math.floor(((i + 1) * b.w) / w), Math.floor((i * b.w) / w) + 1);
      counts.clear();
      let painted = 0;
      for (let y = sy0; y < sy1; y++) {
        for (let x = sx0; x < sx1; x++) {
          const c = img.data[y * img.w + x];
          if (!c || !img.palette[c]?.[3]) continue;
          painted++;
          counts.set(c, (counts.get(c) ?? 0) + (dark[c] ? 0.15 : 1));
        }
      }
      if (painted < FILL * (sy1 - sy0) * (sx1 - sx0)) continue;
      let top = 0;
      let topN = -1;
      for (const [c, n] of counts) if (n > topN) [top, topN] = [c, n];
      cells[j * w + i] = top;
    }
  }

  // 2. Merge the palette: keep the commonest colours, map the rest to the nearest kept one (OKLab).
  const use = new Map();
  for (const c of cells) if (c && !dark[c]) use.set(c, (use.get(c) ?? 0) + 1);
  const kept = [...use.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, KEEP).map(([c]) => c);
  const labs = new Map([...use.keys()].map((c) => [c, toLab(img.palette[c])]));
  const near = (c) => {
    const l = labs.get(c);
    let best = kept[0];
    let bd = Infinity;
    for (const q of kept) {
      const m = labs.get(q);
      const d = (l[0] - m[0]) ** 2 + (l[1] - m[1]) ** 2 + (l[2] - m[2]) ** 2;
      if (d < bd) [best, bd] = [q, d];
    }
    return best;
  };
  const palette = [[0, 0, 0, 0], ...kept.map((c) => img.palette[c]), INK_RGBA];
  const INK_OUT = palette.length - 1;
  const slot = new Map(kept.map((c, i) => [c, i + 1]));
  const data = new Uint16Array(w * h);
  for (let p = 0; p < cells.length; p++) {
    const c = cells[p];
    if (!c) continue;
    data[p] = dark[c] || !kept.length ? INK_OUT : slot.get(slot.has(c) ? c : near(c));
  }

  // 3. Shade the underside: a painted cell with water below takes the darker of its colour and
  //    the ink's neighbourhood, so the silhouette keeps a floor without a hard outline.
  const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] !== 0;
  const shade = new Map();
  const shadeOf = (i) => {
    if (!shade.has(i)) {
      const [r, g, bl, a] = palette[i];
      palette.push([Math.round(r * 0.72), Math.round(g * 0.72), Math.round(bl * 0.72), a]);
      shade.set(i, palette.length - 1);
    }
    return shade.get(i);
  };
  const under = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (filled(x, y) && filled(x, y - 1) && !filled(x, y + 1) && data[y * w + x] !== INK_OUT) under.push(y * w + x);
  for (const p of under) data[p] = shadeOf(data[p]);

  // 4. The eye, stamped back in where the full frame had it, if it lands inside the outline.
  const eye = eyeOf(img, b);
  if (eye) {
    const ex = Math.min(w - 1, Math.floor(((eye.x - b.x0) * w) / b.w));
    const ey = Math.min(h - 1, Math.floor(((eye.y - b.y0) * h) / b.h));
    if (filled(ex, ey)) data[ey * w + ex] = INK_OUT;
  }
  return { w, h, data, palette };
}

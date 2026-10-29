// fish4's painter: fish3's parts with the feature modules and the anatomy parts spliced in, a face channel for
// expressions (`pose.expr`), and palette passes for the chroma gene and for tired / dead fish.
//
// A fish4 set is drawn as its fish3 kin (toFish3) so every fish3 pixel is kept; the parts see the
// fish4 set as `ctx.v4`. With chroma c0, no features and no expression, the frame is fish3's.

import { PARTS, paintFish } from '../../v3/fish/draw.js';
import { INK } from '../../v3/fish/colors.js';
import { partsWith } from './features/registry.js';
import { toFish3 } from './genome.js';
import { extOf } from './bodies/index.js';
import { withAnatomy } from './parts/anatomy.js';

/** Face per expression: the fish3 mood its eye and mouth are drawn with. */
export const EXPRESSIONS = {
  neutral: { mood: null, label: 'Neutral (its own face)' },
  happy: { mood: 'happy', label: 'Happy' },
  tired: { mood: 'sleepy', label: 'Exhausted' },
  dead: { mood: 'content', label: 'Dead' },
};

/** The eye and mouth parts, drawn with the expression's mood (and X eyes when dead). */
const face = (part) => ({
  ...part,
  paint(ctx) {
    const expr = EXPRESSIONS[ctx.pose.expr];
    if (!expr?.mood) return part.paint(ctx);
    const own = ctx.set;
    ctx.set = { ...own, mood: expr.mood };
    part.paint(ctx);
    ctx.set = own;
    if (part.id === 'eye' && ctx.pose.expr === 'dead' && ctx.eyeBox) {
      const { g, pal, rampOf } = ctx;
      const { left, top, size } = ctx.eyeBox;
      const skin = rampOf(pal.skin).base;
      const ink = g.color(INK);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (g.get(left + x, top + y)) g.px(left + x, top + y, skin);
      for (let k = 0; k < size; k++) {
        g.px(left + k, top + k, ink);
        g.px(left + size - 1 - k, top + k, ink);
      }
    }
  },
});

const partCache = new Map();
/** The part list for some studio options (cached per options key). */
export function partsFor(opts = {}) {
  const key = opts.key ?? '';
  let parts = partCache.get(key);
  if (!parts) {
    parts = withAnatomy(partsWith(PARTS, opts), opts).map((p) => (p.id === 'eye' || p.id === 'mouth' ? face(p) : p));
    if (partCache.size > 50) partCache.clear();
    partCache.set(key, parts);
  }
  return parts;
}

/** One frame on the scratch canvas: `{ img, origin }`. */
export function drawFish4(set, pose, look, opts) {
  return paintFish(toFish3(set), pose, look, partsFor(opts), {
    ext: extOf(set),
    prepare(ctx) {
      ctx.v4 = set;
      // Scaled detail: past a large adult, texture pitch and ray spacing grow with the fish.
      if (set.detail === 'v4') ctx.detailScale = Math.max(1, ctx.s / 1.5);
    },
  });
}

// ---------- palette passes (after the crop, so geometry never moves) -------------------------

const lin = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const unlin = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toLab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(lin);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** Linear RGB from OKLab (may be out of gamut). */
function fromLabLinear([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

/**
 * A colour with its chroma scaled by `k` and lightness moved by `dL`, kept in gamut by easing
 * the chroma back (so a push never turns a hue).
 */
function recolour(rgb, k, dL = 0) {
  const [L, A, B] = toLab(rgb);
  const L2 = Math.max(0, Math.min(1, L + dL));
  for (let kk = k; ; kk = 1 + (kk - 1) * 0.7) {
    const out = fromLabLinear([L2, A * kk, B * kk]);
    if (out.every((v) => v >= -0.0005 && v <= 1.0005) || Math.abs(kk - 1) < 0.02 || kk < 1) {
      return out.map((v) => Math.round(Math.max(0, Math.min(255, unlin(Math.max(0, Math.min(1, v)))))));
    }
  }
}

/** Chroma gene step → chroma multiplier. */
export const chromaMul = (id) => 1 + 0.13 * (Number(String(id ?? 'c0').slice(1)) || 0);

/**
 * An image with every palette colour re-coloured: `chroma` × saturation, `dL` lightness. Index 0
 * (nothing) and the ink stay as they are.
 */
export function repaint(img, chroma = 1, dL = 0) {
  if (chroma === 1 && dL === 0) return img;
  const palette = img.palette.map((c, i) => {
    if (i === 0 || c[3] === 0) return c;
    const [r, g, b, a] = c;
    if (r + g + b < 60) return c;
    return [...recolour([r, g, b], chroma, dL), a];
  });
  return { ...img, palette };
}

/** Upside down: rows reversed (a dead fish floats belly up). */
export function flipV(img) {
  const data = new Uint16Array(img.w * img.h);
  for (let y = 0; y < img.h; y++) data.set(img.data.subarray((img.h - 1 - y) * img.w, (img.h - y) * img.w), y * img.w);
  return { ...img, data };
}

/** The palette and flip passes for a fish and pose, on a cropped frame. */
export function finishFrame(img, set, pose) {
  let k = chromaMul(set.chroma);
  let dL = 0;
  if (pose.expr === 'tired') k *= 0.82;
  if (pose.expr === 'dead') {
    k *= 0.22;
    dL = -0.04;
  }
  let out = repaint(img, k, dL);
  if (pose.expr === 'dead') out = flipV(out);
  return out;
}

// Small painting helpers the terrain kits share (desert kit, forge kit, nuclear mutations). They
// work on the v3 painter ctx: `g` the grid, `bodyCols` the body columns (x, t tail→head, mid,
// back, belly), `colT(t)` the column nearest t, `eyeBox` once the eye has been painted.

import { hash01 } from '../../../pixel/rng.js';
import { mix, hexFrom } from '../../../pixel/color.js';
import { INK, HIGHLIGHT } from '../../../v3/fish/colors.js';

export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const frac = (v) => v - Math.floor(v);
export { hash01, mix, INK, HIGHLIGHT };

/** The colour already painted at (x, y), or null. */
export function painted(g, x, y) {
  const i = g.get(x, y);
  if (!i) return null;
  const [r, gg, b, a] = g.palette[i];
  return { hex: hexFrom([r, gg, b]), a, lum: (0.299 * r + 0.587 * gg + 0.114 * b) / 255 };
}

/** Tint what is painted at (x, y) toward `hex` by `k` (nothing painted: nothing happens). */
export function tint(g, x, y, hex, k) {
  const u = painted(g, x, y);
  if (u) g.px(x, y, g.color(mix(u.hex, hex, clamp(k, 0, 1)), u.a));
}

/** Body pixels with body on all four sides: never on the outline. */
export const interior = (ctx, x, y) => ctx.onBody(x, y) && ctx.onBody(x - 1, y) && ctx.onBody(x + 1, y) && ctx.onBody(x, y - 1) && ctx.onBody(x, y + 1);

/** Every body column between two t values. */
export const colsBetween = (ctx, t0, t1) => ctx.bodyCols.filter((c) => c.t >= t0 && c.t <= t1);

export const glowOf = (ctx) => clamp(ctx.pose.glow ?? 0.5, 0, 1);
export const waveOf = (ctx) => ctx.pose.wave ?? 0;

/** Top and bottom body pixel of a column. */
export const topOf = (c) => Math.round(c.mid - c.back);
export const botOf = (c) => Math.round(c.mid + c.belly);

/** A filled disc; `under` paints only on empty pixels. */
export function disc(g, cx, cy, r, col, under = false) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r || !g.inside(x, y)) continue;
      if (under) g.under(x, y, col);
      else g.px(x, y, col);
    }
  }
}

/** An eye: sclera disc, ink rim, a pupil looking forward, a glint. `r` ≥ 1. */
export function eyeball(g, cx, cy, r, { sclera = '#f4f1e6', iris = null, pupil = INK } = {}) {
  disc(g, cx, cy, r + 0.6, g.color(INK));
  disc(g, cx, cy, r, g.color(sclera));
  if (iris && r >= 2) disc(g, cx + r * 0.3, cy, r * 0.62, g.color(iris));
  disc(g, cx + r * 0.35, cy, Math.max(0.6, r * 0.35), g.color(pupil));
  if (r >= 1.5) g.px(Math.floor(cx - r * 0.2), Math.floor(cy - r * 0.45), g.color(HIGHLIGHT));
}

/** A thin polyline through points. */
export function poly(g, pts, col) {
  for (let i = 1; i < pts.length; i++) g.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], col);
}

/** A filled triangle (pixel centres inside a, b, c). */
export function tri(g, a, b, c, col, under = false) {
  const x0 = Math.floor(Math.min(a[0], b[0], c[0]));
  const x1 = Math.ceil(Math.max(a[0], b[0], c[0]));
  const y0 = Math.floor(Math.min(a[1], b[1], c[1]));
  const y1 = Math.ceil(Math.max(a[1], b[1], c[1]));
  const side = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d1 = side(a, b, px, py);
      const d2 = side(b, c, px, py);
      const d3 = side(c, a, px, py);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (neg && pos) continue;
      if (!g.inside(x, y)) continue;
      if (under) g.under(x, y, col);
      else g.px(x, y, col);
    }
  }
}

/** The eye's centre, from the stamp the eye part left behind (or the eye column). */
export function eyeCentre(ctx) {
  const { eyeBox, colT, ph } = ctx;
  if (eyeBox) return { x: eyeBox.left + eyeBox.size / 2, y: eyeBox.top + eyeBox.size / 2, r: eyeBox.size / 2 };
  const c = colT(ph.eyeT);
  return c ? { x: c.x, y: c.mid - c.back * 0.3, r: 1.5 } : null;
}

/**
 * Recolour the painted eye: its sclera and pupil pixels (exactly, by palette entry) to new
 * colours; the glint and the skin round the eye stay.
 */
export function recolourEye(ctx, { sclera, pupil }) {
  const { g, eyeBox: e } = ctx;
  if (!e) return;
  const to = new Map();
  if (sclera && e.sclera !== e.pupil) to.set(e.sclera, g.color(sclera));
  if (pupil) to.set(e.pupil, g.color(pupil));
  for (let y = e.top; y < e.top + e.size; y++) {
    for (let x = e.left; x < e.left + e.size; x++) {
      const c = to.get(g.get(x, y));
      if (c) g.px(x, y, c);
    }
  }
}

// The v2 renderer. Where v1 paints palette indices straight into a Grid, v2 paints *surfaces*:
// every pixel remembers its material, how much light it catches (0..1), which part it belongs to
// and a tone offset. Colour is decided once at the end, so:
//
//   - shapes get real form: a filled mask becomes a dome (distance-to-edge height), a stroke a
//     cylinder or a folded leaf, and one top-left light shades all of them the same way;
//   - markings, scales and tints recolour or re-tone pixels without losing that shading;
//   - the finish is one pass: hue-shifted ramps, dither only in the thin band where two tones
//     meet, speckle cleanup, a darker seam where a part overlaps another, and a selective outline
//     (darker shades of whatever it borders, never flat black).
//
// Coordinates are pixels. Pure: returns a kit IndexedImage.

import { Grid } from '../../pixel/grid.js';
import { shade } from '../../pixel/color.js';
import { hueRamp, toHsl } from './ramp.js';
import { styleHex, inkOf } from './style.js';

const norm = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

/** The one light: up and to the left, a little in front. */
export const LIGHT = norm(-0.55, -0.75, 0.62);
const FLAT = LIGHT[2];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Light for a normal: 0.5 for a face looking straight out, 1 lit, 0 in shadow. */
export function lightOf(nx, ny, nz) {
  const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  let v = 0.5 + (d - FLAT) * 1.05;
  if (d > 0.96) v += 0.12;
  return Math.max(0, Math.min(1, v));
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class Surface {
  /** `style`: a resolved style (kit/style.js `styleOf`), or null for v2's default look. */
  constructor(w, h, style = null) {
    this.w = w;
    this.h = h;
    this.style = style;
    this.anchorHue = null;
    const n = w * h;
    this.mat = new Int16Array(n).fill(-1);
    this.v = new Float32Array(n);
    this.dt = new Int8Array(n);
    this.part = new Int16Array(n).fill(-1);
    this.fixed = new Int16Array(n).fill(-1);
    this.mats = [];
    this.parts = [];
    this.colors = [];
  }

  /**
   * A material: a hue-shifted ramp around `hex`. `alpha` < 255 for membranes. `outline`: the
   * colour its outline takes (default: a deep shade of its darkest step). `keepHue` keeps a
   * natural colour (soil, skin, sky) out of a style's palette harmony.
   */
  material(hex, { steps = 5, alpha = 255, outline = null, keepHue = false, ...ramp } = {}) {
    const st = this.style;
    if (st) {
      // The first colourful material anchors the harmony; the rest snap to its hue family.
      const [h, sat] = toHsl(hex);
      if (!keepHue && this.anchorHue == null && sat >= 0.08) this.anchorHue = h;
      hex = styleHex(hex, st, keepHue ? null : this.anchorHue);
      ramp.shift = (ramp.shift ?? 24) * st.shift;
      if (st.steps && steps > st.steps) {
        if (ramp.base != null) ramp.base = Math.round((ramp.base * (st.steps - 1)) / (steps - 1));
        steps = st.steps;
      }
      if (st.outline === 'ink') outline = inkOf(hex);
    }
    const colors = hueRamp(hex, { steps, ...ramp });
    this.mats.push({ hex, ramp: colors, alpha, outline: outline ?? shade(colors[0], 0.62) });
    return this.mats.length - 1;
  }

  /** A part: a group of pixels that gets a seam where it overlaps an earlier part. */
  newPart({ seam = true } = {}) {
    this.parts.push({ seam });
    return this.parts.length - 1;
  }

  /** A fixed colour (eyes, glints, glow) that ignores light. */
  color(hex, alpha = 255) {
    const key = `${hex}:${alpha}`;
    let i = this.colors.findIndex((c) => c.key === key);
    if (i < 0) {
      this.colors.push({ key, hex, alpha });
      i = this.colors.length - 1;
    }
    return i;
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  idx(x, y) {
    return y * this.w + x;
  }

  filled(x, y) {
    return this.inside(x, y) && (this.mat[this.idx(x, y)] >= 0 || this.fixed[this.idx(x, y)] >= 0);
  }

  /** Light for a normal under this surface's style (the module `lightOf` when unstyled). */
  lightAt(nx, ny, nz) {
    const st = this.style;
    if (!st) return lightOf(nx, ny, nz);
    const L = st.light ?? LIGHT;
    const d = nx * L[0] + ny * L[1] + nz * L[2];
    let v = 0.5 + (d - L[2]) * 1.05;
    if (d > 0.96) v += 0.12;
    return clamp01(0.5 + (v - 0.5) * st.gain);
  }

  /** Paint one shaded pixel. */
  set(x, y, mat, v, part = -1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = this.idx(x, y);
    this.mat[i] = mat;
    this.v[i] = v;
    this.part[i] = part;
    this.dt[i] = 0;
    this.fixed[i] = -1;
  }

  /** Paint one fixed-colour pixel (see `color`). */
  pin(x, y, color, part = -1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = this.idx(x, y);
    this.fixed[i] = color;
    this.part[i] = part;
  }

  /**
   * Fill a shape given as a test `inShape(x, y)` over a box (default the whole surface), shaded as
   * a dome. Options:
   *   mat, part (default: a new one), seam
   *   dome    the dome radius in px (default: its own deepest point — fully round)
   *   flat    0..1, how much the normal is flattened toward facing out (fins, leaves)
   *   bias    added to the light
   *   light(x, y, v, d) → v   override per pixel (d: distance to the edge)
   *   under   only paint where nothing is yet
   * Returns the part id.
   */
  fill(inShape, { box = null, mat, part = null, seam = true, dome = null, flat = 0, bias = 0, light = null, under = false } = {}) {
    const x0 = Math.max(0, Math.floor(box ? box[0] : 0));
    const y0 = Math.max(0, Math.floor(box ? box[1] : 0));
    const x1 = Math.min(this.w - 1, Math.ceil(box ? box[2] : this.w - 1));
    const y1 = Math.min(this.h - 1, Math.ceil(box ? box[3] : this.h - 1));
    if (x1 < x0 || y1 < y0) return part ?? -1;
    const bw = x1 - x0 + 3;
    const bh = y1 - y0 + 3;
    // Distance to the nearest outside pixel, chamfer 1 / √2, with a 1-px empty frame round the box.
    const d = new Float32Array(bw * bh);
    let any = false;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const sx = x + x0 - 1;
        const sy = y + y0 - 1;
        const inn = x > 0 && y > 0 && x < bw - 1 && y < bh - 1 && inShape(sx, sy);
        d[y * bw + x] = inn ? 1e6 : 0;
        if (inn) any = true;
      }
    }
    if (!any) return part ?? -1;
    const R2 = Math.SQRT2;
    for (let y = 1; y < bh; y++) {
      for (let x = 1; x < bw; x++) {
        const i = y * bw + x;
        if (!d[i]) continue;
        d[i] = Math.min(d[i], d[i - 1] + 1, d[i - bw] + 1, d[i - bw - 1] + R2, x < bw - 1 ? d[i - bw + 1] + R2 : 1e6);
      }
    }
    for (let y = bh - 2; y >= 0; y--) {
      for (let x = bw - 2; x >= 0; x--) {
        const i = y * bw + x;
        if (!d[i]) continue;
        d[i] = Math.min(d[i], d[i + 1] + 1, d[i + bw] + 1, d[i + bw + 1] + R2, x > 0 ? d[i + bw - 1] + R2 : 1e6);
      }
    }
    let deepest = 0;
    for (let i = 0; i < d.length; i++) deepest = Math.max(deepest, d[i]);
    const R = Math.max(1, dome ?? deepest);
    const hgt = (x, y) => {
      if (x < 0 || y < 0 || x >= bw || y >= bh) return 0;
      const dd = d[y * bw + x];
      if (!dd) return 0;
      const t = Math.min(1, (dd - 0.5) / R);
      return R * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
    };
    const id = part ?? this.newPart({ seam });
    for (let y = 1; y < bh - 1; y++) {
      for (let x = 1; x < bw - 1; x++) {
        const dd = d[y * bw + x];
        if (!dd) continue;
        const sx = x + x0 - 1;
        const sy = y + y0 - 1;
        if (under && this.filled(sx, sy)) continue;
        const gx = (hgt(x + 1, y) - hgt(x - 1, y)) / 2;
        const gy = (hgt(x, y + 1) - hgt(x, y - 1)) / 2;
        let [nx, ny, nz] = norm(-gx, -gy, 1);
        if (flat) [nx, ny, nz] = norm(nx * (1 - flat), ny * (1 - flat), nz + flat * 2);
        let v = this.lightAt(nx, ny, nz) + bias;
        if (light) v = light(sx, sy, v, dd);
        this.set(sx, sy, mat, clamp01(v), id);
      }
    }
    return id;
  }

  /**
   * Paint a stroke (see `walk`) with a profile across it:
   *   'round' a cylinder (stems, blades seen edge-on), 'fold' a leaf creased at its midrib,
   *   'flat' facing out with a lit edge. `mat` may be a function (u, a) → material.
   *   light(u, a, v) → v overrides; `a` runs -1..1 across the stroke, left to right of travel.
   */
  stroke(st, { mat, part = null, seam = true, profile = 'round', bias = 0, light = null } = {}) {
    const id = part ?? this.newPart({ seam });
    walk(st, (x, y, u, a, nx, ny) => {
      let n;
      if (profile === 'fold') {
        // Two planes meeting at the rib, each tipped a little, with a curl at the edges.
        const side = a < 0 ? -1 : 1;
        const tip = 0.38 * side + 0.45 * a * Math.abs(a);
        n = norm(nx * tip, ny * tip, 1);
      } else if (profile === 'flat') {
        n = norm(nx * a * 0.35, ny * a * 0.35, 1);
      } else {
        const z = Math.sqrt(Math.max(0, 1 - a * a));
        n = norm(nx * a, ny * a, z + 0.15);
      }
      let v = this.lightAt(...n) + bias;
      if (light) v = light(u, a, v);
      const m = typeof mat === 'function' ? mat(u, a) : mat;
      if (m == null || m < 0) return;
      this.set(x, y, m, clamp01(v), id);
    });
    return id;
  }

  /** Recolour shaded pixels where `test` passes, keeping their light. */
  recolor(test, mat, { box = null } = {}) {
    this.each(box, (x, y, i) => {
      if (this.mat[i] >= 0 && test(x, y, i)) this.mat[i] = mat;
    });
  }

  /** Shift tone by `steps` (±) where `test` passes. */
  tone(test, steps, { box = null } = {}) {
    this.each(box, (x, y, i) => {
      if (this.mat[i] >= 0 && test(x, y, i)) this.dt[i] = Math.max(-4, Math.min(4, this.dt[i] + steps));
    });
  }

  /** Add to the light where `test` passes (soft: before quantising, so it may dither). */
  lift(test, dv, { box = null } = {}) {
    this.each(box, (x, y, i) => {
      if (this.mat[i] >= 0 && test(x, y, i)) this.v[i] = clamp01(this.v[i] + (typeof dv === 'function' ? dv(x, y, i) : dv));
    });
  }

  each(box, fn) {
    const x0 = Math.max(0, Math.floor(box ? box[0] : 0));
    const y0 = Math.max(0, Math.floor(box ? box[1] : 0));
    const x1 = Math.min(this.w - 1, Math.ceil(box ? box[2] : this.w - 1));
    const y1 = Math.min(this.h - 1, Math.ceil(box ? box[3] : this.h - 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y, this.idx(x, y));
  }

  partAt(x, y) {
    return this.inside(x, y) ? this.part[this.idx(x, y)] : -1;
  }

  /**
   * Squeeze (|k| < 1) or mirror (k < 0) the picture about column `cx` — a fish turning round.
   * Light is already baked in, so a mirrored sprite keeps its highlights where they were painted.
   */
  scaleX(cx, k) {
    if (k === 1) return;
    const keys = ['mat', 'v', 'dt', 'part', 'fixed'];
    const src = Object.fromEntries(keys.map((key) => [key, this[key].slice()]));
    this.mat.fill(-1);
    this.part.fill(-1);
    this.fixed.fill(-1);
    if (Math.abs(k) < 0.08) k = Math.sign(k || 1) * 0.08;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const sx = Math.floor(cx + (x + 0.5 - cx) / k);
        if (sx < 0 || sx >= this.w) continue;
        const i = this.idx(x, y);
        const j = this.idx(sx, y);
        for (const key of keys) this[key][i] = src[key][j];
      }
    }
  }

  /** Move everything by whole pixels. */
  shift(dx, dy) {
    dx = Math.round(dx);
    dy = Math.round(dy);
    if (!dx && !dy) return;
    const keys = ['mat', 'v', 'dt', 'part', 'fixed'];
    const src = Object.fromEntries(keys.map((key) => [key, this[key].slice()]));
    this.mat.fill(-1);
    this.part.fill(-1);
    this.fixed.fill(-1);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const sx = x - dx;
        const sy = y - dy;
        if (sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) continue;
        const i = this.idx(x, y);
        const j = this.idx(sx, sy);
        for (const key of keys) this[key][i] = src[key][j];
      }
    }
  }

  /**
   * Colour it in. Options:
   *   dither   half-width of the tone band that dithers (0 off; 0.1 a thin band)
   *   outline  true for the selective outline; false for none
   *   seams    darken a part's pixels where they cover an earlier part
   *   after(g) paint extra fixed pixels into the Grid after the outline (glows, sparkles)
   */
  render({ dither = 0.1, outline = true, seams = true, despeckle = true } = {}) {
    const { w, h } = this;
    const n = w * h;
    const st = this.style;
    let ink = false;
    let bold = false;
    if (st) {
      if (st.dither != null) dither = st.dither;
      if (st.outline === 'none') outline = false;
      else if (st.outline === 'ink') outline = ink = true;
      else if (st.outline === 'bold') bold = outline;
      if (st.rim) this.rimLight();
      if (st.steps) for (let i = 0; i < n; i++) this.dt[i] = Math.max(-1, Math.min(1, this.dt[i]));
    }
    const tone = new Int8Array(n).fill(-1);
    const dithered = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const m = this.mat[i];
      if (m < 0) continue;
      const steps = this.mats[m].ramp.length;
      const q = this.v[i] * (steps - 1);
      const base = Math.floor(q);
      const f = q - base;
      let t = base;
      if (f >= 0.5 + dither) t = base + 1;
      else if (f > 0.5 - dither && dither > 0) {
        const x = i % w;
        const y = (i / w) | 0;
        const th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        t = (f - (0.5 - dither)) / (2 * dither) > th ? base + 1 : base;
        dithered[i] = 1;
      }
      tone[i] = Math.max(0, Math.min(steps - 1, t));
    }

    // Speckle: a lone pixel whose four same-material neighbours agree on another tone takes theirs.
    if (despeckle) {
      const src = tone.slice();
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (src[i] < 0 || dithered[i]) continue;
          const m = this.mat[i];
          const nb = [i - 1, i + 1, i - w, i + w];
          if (nb.some((j) => this.mat[j] !== m || this.dt[j] !== this.dt[i])) continue;
          const t0 = src[nb[0]];
          if (t0 !== src[i] && nb.every((j) => src[j] === t0)) tone[i] = t0;
        }
      }
    }

    // Tone offsets, then seams: a part's edge pixels darken where they lie over an earlier part.
    for (let i = 0; i < n; i++) {
      const m = this.mat[i];
      if (m < 0) continue;
      let t = tone[i] + this.dt[i];
      if (seams) {
        const p = this.part[i];
        if (p >= 0 && this.parts[p]?.seam) {
          const x = i % w;
          const y = (i / w) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const q = this.partAt(x + dx, y + dy);
            if (q >= 0 && q < p && this.mat[this.idx(x + dx, y + dy)] >= 0 && this.mat[this.idx(x + dx, y + dy)] !== m) {
              t -= 1;
              break;
            }
          }
        }
      }
      tone[i] = Math.max(0, Math.min(this.mats[m].ramp.length - 1, t));
    }

    const g = new Grid(w, h);
    const cache = new Map();
    const col = (hex, a) => {
      const k = `${hex}:${a}`;
      if (!cache.has(k)) cache.set(k, g.color(hex, a));
      return cache.get(k);
    };
    for (let i = 0; i < n; i++) {
      const x = i % w;
      const y = (i / w) | 0;
      if (this.fixed[i] >= 0) {
        const c = this.colors[this.fixed[i]];
        g.px(x, y, col(c.hex, c.alpha));
      } else if (this.mat[i] >= 0) {
        const m = this.mats[this.mat[i]];
        g.px(x, y, col(m.ramp[tone[i]], m.alpha));
      }
    }

    if (outline) {
      // Selective outline: each empty pixel touching the sprite takes the outline of a neighbour,
      // the lowest one first (the shadow side reads as the edge), a step lighter on the lit side.
      const out = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (this.mat[i] >= 0 || this.fixed[i] >= 0) continue;
          let pick = -1;
          let lit = false;
          for (const [dx, dy, l] of bold ? BOLD_NB : OUTLINE_NB) {
            const xx = x + dx;
            const yy = y + dy;
            if (!this.inside(xx, yy)) continue;
            const m = this.mat[this.idx(xx, yy)];
            if (m >= 0 && !(this.mats[m].noOutline)) {
              pick = m;
              lit = l;
              break;
            }
          }
          if (pick >= 0) out.push([x, y, pick, lit]);
        }
      }
      for (const [x, y, m, lit] of out) {
        const mm = this.mats[m];
        const hex = ink ? mm.outline : bold ? shade(mm.outline, 0.72) : lit ? shade(mm.outline, 1.25) : mm.outline;
        g.px(x, y, col(hex, 255));
      }
    }
    return g.out();
  }

  /** A bright rim on the silhouette's edges that face the light (it wraps round from behind). */
  rimLight() {
    const L = this.style?.light ?? LIGHT;
    const toward = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => dx * L[0] + dy * L[1] > 0.2);
    const open = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && !this.filled(x, y);
    const lit = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = this.idx(x, y);
        if (this.mat[i] < 0 || this.mats[this.mat[i]].alpha < 255) continue;
        if (toward.some(([dx, dy]) => open(x + dx, y + dy))) lit.push(i);
      }
    }
    for (const i of lit) this.v[i] = Math.max(this.v[i], 0.86);
  }
}

const OUTLINE_NB = [[0, -1, false], [1, 0, false], [-1, 0, true], [0, 1, true]];
const BOLD_NB = [...OUTLINE_NB, [1, -1, false], [-1, -1, false], [1, 1, true], [-1, 1, true]];

/**
 * Walk a stroke, calling `plot(x, y, u, a, nx, ny)` for each covered pixel sample: `u` 0..1 along,
 * `a` -1..1 across (left to right of travel), (nx, ny) the across direction. Same stroke fields as
 * v1's plants/stroke.js walk (x, y, angle from straight up, len, bend, width(u), sway(u), droop,
 * upto), so v2 skeletons can describe strokes the way v1 did.
 */
export function walk({ x, y, angle = 0, len, bend = 0, width = () => 1, sway = () => 0, droop = 0, upto = 1 }, plot) {
  if (len <= 0 || upto <= 0) return;
  const step = 0.25;
  let px = x;
  let py = y;
  for (let s = 0; s <= len * upto; s += step) {
    const u = s / len;
    const ang = angle + bend * u;
    const cx = px + sway(u);
    const cy = py + droop * u * u;
    const hw = Math.max(0, width(u) / 2);
    const nx = Math.cos(ang);
    const ny = Math.sin(ang);
    if (hw < 0.5) plot(Math.floor(cx), Math.floor(cy), u, 0, nx, ny);
    else for (let k = -hw; k <= hw; k += 0.5) plot(Math.floor(cx + nx * k), Math.floor(cy + ny * k), u, k / hw, nx, ny);
    px += Math.sin(ang) * step;
    py -= Math.cos(ang) * step;
  }
}

/** Where a stroke is at `u`, with its sway, and its heading. */
export function pointAt({ x, y, angle = 0, len, bend = 0, droop = 0, sway = () => 0 }, u) {
  const step = 0.25;
  let px = x;
  let py = y;
  const end = len * u;
  for (let s = 0; s < end; s += step) {
    const a = angle + bend * (s / len);
    px += Math.sin(a) * step;
    py -= Math.cos(a) * step;
  }
  return { x: px + sway(u), y: py + droop * u * u, angle: angle + bend * u };
}

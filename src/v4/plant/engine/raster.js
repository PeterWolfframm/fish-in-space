// plant4's painter, deferred: every primitive writes a material, a tone (0 dark .. 1 lit) and a
// group into a G-buffer, and only the last pass turns tone into ramp colours. So lighting, cast
// shadows, the outline and the clean-up act on the whole plant at once, the same way for a
// lettuce, an oak or a kelp frond.
//
//   const c = new Canvas(w, h);
//   c.chain(points, mat, opts)  a tapered stem through {x, y, r} points (cylinder-lit)
//   c.sweep(points, mat, opts)  a flat strip through {x, y, w} points (leaves, ribbons, fronds)
//   c.blob(cx, cy, rx, ry, mat, opts)  a lumpy, sphere-lit foliage clump
//   c.disc / c.dot              small round organs and single pixels
//   c.finish(materials, look) → IndexedImage
//
// Light comes from the upper left. Everything is deterministic: no Math.random.

import { Grid } from '../../../pixel/grid.js';
import { hash01 } from '../../../pixel/rng.js';

const L = (() => {
  const v = [-0.55, -0.62, 0.56];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Lambert term of a normal against the light, remapped so the unlit side keeps some fill. */
export const lit = (nx, ny, nz) => clamp01(0.22 + 0.78 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]));

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.mat = new Uint8Array(w * h);
    this.tone = new Float32Array(w * h);
    this.grp = new Uint16Array(w * h);
    this.group = 0;
    this.touched = [];
    /** Rows below this are not painted: the soil line, while the plant above it is drawn. */
    this.floor = Infinity;
  }

  begin() {
    this.group = (this.group + 1) & 0xffff || 1;
    this.touched = [];
    return this.group;
  }

  set(x, y, mat, tone) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || y > this.floor) return;
    const i = y * this.w + x;
    if (this.grp[i] !== this.group) this.touched.push(i);
    this.mat[i] = mat;
    this.tone[i] = tone;
    this.grp[i] = this.group;
  }

  /**
   * Darken whatever an earlier primitive left just below-right of this one: a contact shadow, the
   * cheapest way to make overlapping leaves and clumps read as separate.
   */
  shadow(k = 0.16, dx = 1, dy = 1) {
    const { w, h, grp, tone, mat } = this;
    const g = this.group;
    const done = new Set();
    for (const i of this.touched) {
      const x = (i % w) + dx;
      const y = ((i / w) | 0) + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const j = y * w + x;
      if (!mat[j] || grp[j] === g || done.has(j)) continue;
      tone[j] = Math.max(0, tone[j] - k);
      done.add(j);
    }
  }

  /** A tapered, round-capped stem through `pts` ({x, y, r}). `tone(s, u)`: s across −1..1, u along 0..1. */
  chain(pts, mat, { dark = 0, tex = null, z = 0, min = 0.5 } = {}) {
    if (!pts.length) return;
    this.begin();
    const total = pts.length - 1 || 1;
    if (pts.length === 1) {
      const p = pts[0];
      this.disc(p.x, p.y, Math.max(min, p.r), mat, { dark, own: false });
      return;
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1e-6;
      const ux = dx / len;
      const uy = dy / len;
      const ra = Math.max(min, a.r);
      const rb = Math.max(min, b.r);
      const R = Math.max(ra, rb);
      const x0 = Math.floor(Math.min(a.x, b.x) - R - 1);
      const x1 = Math.ceil(Math.max(a.x, b.x) + R + 1);
      const y0 = Math.floor(Math.min(a.y, b.y) - R - 1);
      const y1 = Math.ceil(Math.max(a.y, b.y) + R + 1);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5 - a.x;
          const py = y + 0.5 - a.y;
          let t = (px * ux + py * uy) / len;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const r = ra + (rb - ra) * t;
          const cx = px - ux * t * len;
          const cy = py - uy * t * len;
          const d = Math.hypot(cx, cy);
          if (d > r) continue;
          // across: signed offset on the stem's normal (−uy, ux)
          const s = Math.max(-1, Math.min(1, (cx * -uy + cy * ux) / Math.max(r, 0.5)));
          const nz = Math.sqrt(Math.max(0, 1 - s * s));
          let tone = lit(-uy * s, ux * s, nz) - dark;
          const u = (k + t) / total;
          if (tex) tone += tex(s, u, x, y, r);
          this.set(x, y, mat, clamp01(tone));
        }
      }
    }
    if (z !== null) this.shadow(0.12);
  }

  /**
   * A flat strip through `pts` ({x, y, w}): the half facing the light is lit, the other is in
   * shade, and a midrib shows once the strip is long enough. Leaves, grass blades, kelp.
   */
  sweep(pts, mat, { dark = 0, rib = false, fold = 0.2, tip = 0.08, shadow = 0.16, curlLight = 0, paint = null, ribMat = 0 } = {}) {
    if (pts.length < 2) return;
    this.begin();
    const n = pts.length;
    // light side: which normal of the overall direction faces the light
    const dx0 = pts[n - 1].x - pts[0].x;
    const dy0 = pts[n - 1].y - pts[0].y;
    const nl = -dy0 * L[0] + dx0 * L[1] >= 0 ? 1 : -1;
    for (let k = 0; k < n - 1; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1e-6;
      const ux = dx / len;
      const uy = dy / len;
      const W = Math.max(a.w, b.w);
      const x0 = Math.floor(Math.min(a.x, b.x) - W - 1);
      const x1 = Math.ceil(Math.max(a.x, b.x) + W + 1);
      const y0 = Math.floor(Math.min(a.y, b.y) - W - 1);
      const y1 = Math.ceil(Math.max(a.y, b.y) + W + 1);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5 - a.x;
          const py = y + 0.5 - a.y;
          const along = px * ux + py * uy;
          if (along < -0.5 || along > len + 0.5) continue;
          let t = along / len;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const hw = a.w + (b.w - a.w) * t;
          const across = px * -uy + py * ux;
          if (Math.abs(across) > Math.max(hw, 0.5)) continue;
          if (along < 0 && k > 0) continue;
          const u = (k + t) / (n - 1);
          const side = Math.sign(across) * nl;
          let tone = 0.52 + (side > 0 ? fold : -fold * 0.9) + tip * (u - 0.5) * 2 - dark;
          if (curlLight) tone += curlLight * Math.sin(u * Math.PI);
          let m = mat;
          if (rib && Math.abs(across) < 0.5 && u > 0.04 && u < 0.86) {
            tone = 0.3 - dark * 0.5;
            if (ribMat) {
              m = ribMat;
              tone = 0.62 - dark;
            }
          } else if (paint) {
            // variegation and tip colour: (u along, a across −1..1) → a material, or 0 to keep
            const pm = paint(u, across / Math.max(hw, 0.5), x, y);
            if (pm) m = pm;
          }
          this.set(x, y, m, clamp01(tone));
        }
      }
    }
    if (shadow) this.shadow(shadow);
  }

  /**
   * A foliage clump: a lumpy ellipse lit as a sphere, mixed with the light of the whole crown
   * (`crown`: {cx, cy, rx, ry}) so the canopy reads as one mass with a lit upper left. `lumps`
   * scallops the edge; the inner ridge darkens where lumps meet.
   */
  blob(cx, cy, rx, ry, mat, { dark = 0, seed = 0, lumps = 0.16, crown = null, mixK = 0.45, shadow = 0.18, flat = 1 } = {}) {
    this.begin();
    const harm = [0, 1, 2].map((i) => ({
      f: 3 + Math.floor(hash01(seed, 11 + i) * 4) + i * 2,
      p: hash01(seed, 21 + i) * Math.PI * 2,
      a: lumps * (0.55 + 0.45 * hash01(seed, 31 + i)) / (i + 1),
    }));
    const R = Math.max(rx, ry) * (1 + lumps * 1.6) + 1;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        let edge = 1;
        for (const h of harm) edge += h.a * Math.sin(h.f * a + h.p);
        if (rx < 2.2) edge = 1;
        if (d > edge) continue;
        const q = Math.min(1, d / edge);
        const nx = dx / Math.max(d, 1e-6) * q;
        const ny = dy / Math.max(d, 1e-6) * q;
        const nz = Math.sqrt(Math.max(0, 1 - q * q)) * flat;
        let tone = lit(nx, ny, nz);
        if (crown) {
          const gx = (x + 0.5 - crown.cx) / crown.rx;
          const gy = (y + 0.5 - crown.cy) / crown.ry;
          const g = Math.min(1, Math.hypot(gx, gy));
          const gn = g > 0 ? 1 / Math.hypot(gx, gy) : 0;
          const gt = lit(gx * gn * g, gy * gn * g, Math.sqrt(1 - g * g));
          tone = tone * (1 - mixK) + gt * mixK;
        }
        this.set(x, y, mat, clamp01(tone - dark));
      }
    }
    if (shadow) this.shadow(shadow);
  }

  /** A small lit sphere (fruit, a bud, a float). `spec` adds a one-pixel highlight. */
  disc(cx, cy, r, mat, { dark = 0, spec = false, own = true, shadow = 0.14 } = {}) {
    if (own) this.begin();
    const R = Math.max(0.5, r);
    for (let y = Math.floor(cy - R - 1); y <= Math.ceil(cy + R); y++) {
      for (let x = Math.floor(cx - R - 1); x <= Math.ceil(cx + R); x++) {
        const dx = (x + 0.5 - cx) / R;
        const dy = (y + 0.5 - cy) / R;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        this.set(x, y, mat, clamp01(lit(dx, dy, Math.sqrt(1 - d2)) - dark));
      }
    }
    if (spec && R >= 1.4) this.set(Math.floor(cx - R * 0.42), Math.floor(cy - R * 0.45), mat, 1);
    if (own && shadow) this.shadow(shadow);
  }

  /** One pixel, outside any group. */
  dot(x, y, mat, tone = 0.6) {
    this.set(Math.floor(x), Math.floor(y), mat, tone);
  }

  /** Lift a material's tone toward 1 on pixels that have open sky above them (snow, rim light). */
  capTop(match, k, toMat = null) {
    const { w, h, mat, tone } = this;
    for (let y = 1; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!mat[i] || !match(mat[i]) || mat[i - w]) continue;
        if (toMat != null) mat[i] = toMat;
        tone[i] = Math.min(1, tone[i] + k);
        if (y + 1 < h && mat[i + w] && match(mat[i + w]) && toMat != null && (x * 7 + y * 3) % 5 < 3) {
          mat[i + w] = toMat;
          tone[i + w] = Math.min(1, tone[i + w] + k * 0.6);
        }
      }
    }
  }

  /**
   * Tone → ramp colour, then the clean-up a pixel artist does by hand: lone pixels are merged
   * into their neighbours, and the silhouette gets a selective outline (each edge pixel in the
   * darkest shade of the material it borders, a touch lighter on the lit upper left).
   *
   * `materials[m] = { ramp: [hex darkest … lightest], glow?: bool, alpha?: 0..255 }`.
   * `look`: { outline: 'sel'|'dark'|'none', dither: 0..1, despeckle: bool, halo: hex|null }
   */
  finish(materials, look = {}) {
    const { w, h, mat, tone } = this;
    const idx = new Int8Array(w * h);
    const dither = look.dither ?? 0;
    for (let i = 0; i < w * h; i++) {
      const m = mat[i];
      if (!m) continue;
      const n = materials[m].ramp.length;
      const b = dither ? BAYER[((i / w) & 3) * 4 + ((i % w) & 3)] * dither : 0;
      idx[i] = Math.max(0, Math.min(n - 1, Math.floor(tone[i] * n + b)));
    }
    if (look.despeckle !== false) {
      const out = idx.slice();
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!mat[i]) continue;
          const nb = [i - 1, i + 1, i - w, i + w];
          if (nb.some((j) => mat[j] !== mat[i])) continue;
          const v = idx[nb[0]];
          if (idx[i] !== v && nb.every((j) => idx[j] === v)) out[i] = v;
        }
      }
      idx.set(out);
    }
    const g = new Grid(w, h);
    const colOf = materials.map((m) => (m ? m.ramp.map((hex) => g.color(hex, m.alpha ?? 255)) : []));
    for (let i = 0; i < w * h; i++) {
      if (!mat[i]) continue;
      g.data[i] = colOf[mat[i]][idx[i]];
    }
    const mode = look.outline ?? 'sel';
    if (mode !== 'none') {
      const ink = look.ink ? g.color(look.ink) : 0;
      const add = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (mat[i]) continue;
          let best = 0;
          let litSide = false;
          for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const m = mat[yy * w + xx];
            if (!m || materials[m].noOutline) continue;
            if (!best || materials[m].weight > materials[best].weight) best = m;
            if (dx > 0 || dy > 0) litSide = true;
          }
          if (!best) continue;
          if (mode === 'dark') add.push([i, ink]);
          else {
            const ramp = materials[best].outline ?? materials[best].ramp;
            add.push([i, g.color(litSide && ramp.length > 2 ? ramp[1] : ramp[0])]);
          }
        }
      }
      for (const [i, c] of add) g.data[i] = c;
    }
    if (look.halo) {
      const halo = g.color(look.halo, look.haloAlpha ?? 70);
      const glowAt = (i) => mat[i] && materials[mat[i]].glow;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (g.data[i]) continue;
          for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            if (glowAt(yy * w + xx)) {
              g.data[i] = halo;
              break;
            }
          }
        }
      }
    }
    return g.out();
  }
}

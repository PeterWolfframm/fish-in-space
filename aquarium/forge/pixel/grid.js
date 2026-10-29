// Vendored from the pixel kit — do not edit here.
// Source: kit/web/pixel/grid.js in the Burn-Through repo.
// Run `node scripts/vendor-pixel.mjs` to update, and edit it there.
// An indexed-colour pixel buffer with the drawing primitives sprite art actually needs.
//
// Pure: no DOM, no canvas. `out()` hands back a plain {w, h, data, palette} image that a 2D
// context, a WebGL texture or a mesher can each consume — see blit.js.

import { rgbOf } from './color.js';

/** Index 0 is reserved for "nothing drawn here", which is also fully transparent. */
const EMPTY = 0;

export class Grid {
  /** A `w` x `h` buffer. Square grids can pass one number. */
  constructor(w, h = w) {
    this.w = w;
    this.h = h;
    // Uint16 rather than Uint8: a 256th colour silently wrapping to index 0 is a very confusing
    // bug to chase, and the extra byte per pixel is irrelevant at sprite sizes.
    this.data = new Uint16Array(w * h);
    this.palette = [[0, 0, 0, 0]];
    this.index = new Map([['0,0,0,0', EMPTY]]);
  }

  /** The palette index for a colour, adding it if new. Accepts `#rrggbb` or [r, g, b]. */
  color(color, a = 255) {
    const rgb = typeof color === 'string' ? rgbOf(color) : color;
    const key = `${rgb[0]},${rgb[1]},${rgb[2]},${a}`;
    let i = this.index.get(key);
    if (i == null) {
      i = this.palette.length;
      this.palette.push([rgb[0], rgb[1], rgb[2], a]);
      this.index.set(key, i);
    }
    return i;
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  px(x, y, c) {
    if (!this.inside(x, y)) return;
    this.data[y * this.w + x] = c;
  }

  get(x, y) {
    return this.inside(x, y) ? this.data[y * this.w + x] : EMPTY;
  }

  /** Paint only where nothing has been drawn yet — handy for filling behind a shape. */
  under(x, y, c) {
    if (this.get(x, y) === EMPTY) this.px(x, y, c);
  }

  rect(x0, y0, w, h, c) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.px(x, y, c);
  }

  /**
   * A filled ellipse. Samples pixel centres with fractional radii, which is how a small grid
   * gets curves that read as smooth without any anti-aliasing.
   *
   * `test(x, y)` carves the shape: return false to leave a pixel alone.
   */
  ellipse(cx, cy, rx, ry, c, test = null) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!test || test(x, y))) this.px(x, y, c);
      }
    }
  }

  /** A Bresenham line. */
  line(x0, y0, x1, y1, c) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x, y, c);
      if (x === ex && y === ey) return;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** A filled polygon, by scanline. `points` is [[x, y], …]. */
  polygon(points, c) {
    if (points.length < 3) return;
    const ys = points.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > sy !== yj > sy) xs.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, c);
      }
    }
  }

  /**
   * One row per y from `y0` to `y1`, each centred on `cx` and as wide as `width(t)` says, where
   * `t` runs 0..1 down the band. A tapered body is one call rather than a shape.
   */
  band(cx, y0, y1, width, color) {
    const span = Math.max(1, y1 - y0);
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / span;
      const half = width(t) / 2;
      if (half <= 0) continue;
      const c = typeof color === 'function' ? color(t, y) : color;
      if (c === EMPTY) continue;
      const left = Math.round(cx - half);
      this.rect(left, y, Math.max(1, Math.round(cx + half) - left), 1, c);
    }
  }

  /** Mirror the left half onto the right (or top onto bottom with axis 'y'). */
  mirror(axis = 'x') {
    if (axis === 'x') {
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < Math.floor(this.w / 2); x++) {
          this.px(this.w - 1 - x, y, this.get(x, y));
        }
      }
    } else {
      for (let y = 0; y < Math.floor(this.h / 2); y++) {
        for (let x = 0; x < this.w; x++) this.px(x, this.h - 1 - y, this.get(x, y));
      }
    }
  }

  /** Replace every pixel of one colour index with another. */
  replace(from, to) {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === from) this.data[i] = to;
  }

  /**
   * A 4x4 ordered (Bayer) dither of `c` over the region, at `level` 0..1 coverage. This is what
   * gives scales and mottling their texture without adding palette entries.
   *
   * `test(x, y)` limits it to part of the sprite; by default it only touches drawn pixels.
   */
  dither(x0, y0, w, h, c, level = 0.5, test = null) {
    const BAYER = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (test ? !test(x, y) : this.get(x, y) === EMPTY) continue;
        if ((BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5) / 16 < level) this.px(x, y, c);
      }
    }
  }

  /**
   * A one-pixel edge around everything drawn.
   *
   * `inward` keeps the silhouette the same size by recolouring the sprite's own edge pixels;
   * the default grows it outward by one, so parts must sit one pixel clear of the border.
   */
  outline(c, { inward = false, diagonal = false } = {}) {
    const copy = this.data.slice();
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    if (diagonal) near.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    const at = (x, y) => (this.inside(x, y) ? copy[y * this.w + x] : EMPTY);

    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const self = copy[y * this.w + x];
        if (inward) {
          // An edge pixel is a drawn pixel with empty space (or the border) beside it.
          if (self === EMPTY) continue;
          const exposed = near.some(([dx, dy]) => !this.inside(x + dx, y + dy) || at(x + dx, y + dy) === EMPTY);
          if (exposed) this.px(x, y, c);
        } else {
          if (self !== EMPTY) continue;
          if (near.some(([dx, dy]) => at(x + dx, y + dy) !== EMPTY)) this.px(x, y, c);
        }
      }
    }
  }

  /** The tight bounds of everything drawn, or null for an empty grid. */
  bounds() {
    let minX = this.w;
    let minY = this.h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.data[y * this.w + x] === EMPTY) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  /** The finished image: a palette index per pixel, 0 meaning nothing. */
  out() {
    return { w: this.w, h: this.h, data: this.data, palette: this.palette };
  }
}

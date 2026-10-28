// A small spinning planet, projected on the CPU from the equirectangular paint through a per-pixel
// lat/lon lookup table. Used by the Bridge (large) and the hatchery porthole (small).

import { Texture } from 'pixi.js';
import type { Planet } from '../planet/load';
import { paint } from '../planet/paint';

export class Globe {
  readonly size: number;
  readonly canvas: HTMLCanvasElement;
  readonly texture: Texture;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private lutU: Float32Array; // longitude 0..1 before rotation
  private lutX: Float32Array; // surface normal, for lighting
  private lutZ: Float32Array;
  private lutY: Float32Array;
  private inside: Uint8Array;
  private tex: Uint8ClampedArray;
  private planet: Planet | null = null;

  constructor(radius: number) {
    this.size = radius * 2 + 1;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(this.size, this.size);
    const n = this.size * this.size;
    this.lutU = new Float32Array(n);
    this.lutX = new Float32Array(n);
    this.lutY = new Float32Array(n);
    this.lutZ = new Float32Array(n);
    this.inside = new Uint8Array(n);
    this.tex = new Uint8ClampedArray(0);
    const tilt = 0.32; // axial tilt toward the viewer, so the poles read
    for (let py = 0; py < this.size; py++) {
      for (let px = 0; px < this.size; px++) {
        const x = (px - radius) / (radius + 0.5);
        const y = (py - radius) / (radius + 0.5);
        const d = x * x + y * y;
        const i = py * this.size + px;
        if (d > 1) continue;
        this.inside[i] = d > 0.94 ? 2 : 1;
        const z = Math.sqrt(1 - d);
        // Rotate the view about the x axis by the tilt.
        const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
        const lon = Math.atan2(x, z2);
        this.lutU[i] = lon / (Math.PI * 2) + 0.5;
        this.lutX[i] = x;
        this.lutY[i] = y;
        this.lutZ[i] = z;
      }
    }
    this.texture = Texture.from({ resource: this.canvas, scaleMode: 'nearest' });
  }

  private rows: Int16Array | null = null;

  setPlanet(p: Planet) {
    this.planet = p;
    this.tex = new Uint8ClampedArray(p.map.w * p.map.h * 4);
    // Latitude → map row, per pixel.
    this.rows = new Int16Array(this.size * this.size);
    const r = (this.size - 1) / 2;
    const tilt = 0.32;
    for (let py = 0; py < this.size; py++) {
      for (let px = 0; px < this.size; px++) {
        const i = py * this.size + px;
        if (!this.inside[i]) continue;
        const x = (px - r) / (r + 0.5);
        const y = (py - r) / (r + 0.5);
        const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
        const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
        const lat = Math.asin(Math.max(-1, Math.min(1, -y2)));
        this.rows[i] = Math.min(p.map.h - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * p.map.h)));
      }
    }
  }

  /** Repaint the surface colours (when Life changes). */
  repaint(life: ArrayLike<number>, open: ArrayLike<number>, highlight = -1) {
    if (!this.planet) return;
    paint(this.planet.map, this.planet.prep, life, open, this.tex, highlight);
  }

  /**
   * Draw the sphere. `spin` is the longitude under the viewer (0..1), `sun` the longitude of the
   * sub-solar point relative to the viewer (0 = facing us, 0.5 = behind), so the terminator drifts.
   */
  render(spin: number, sun: number, night = 0) {
    if (!this.planet || !this.rows) return;
    const { w } = this.planet.map;
    const d = this.img.data;
    const sx = Math.sin(sun * Math.PI * 2);
    const sz = Math.cos(sun * Math.PI * 2);
    const n = this.size * this.size;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const ins = this.inside[i];
      if (!ins) {
        d[o + 3] = 0;
        continue;
      }
      let u = this.lutU[i] + spin;
      u -= Math.floor(u);
      const t = (this.rows[i] * w + ((u * w) | 0)) * 4;
      // Lambert from the sun, banded into 4 steps for a pixel look; a cool rim on the dark side.
      const lam = this.lutX[i] * sx + this.lutZ[i] * sz - this.lutY[i] * 0.15;
      const band = lam > 0.45 ? 1 : lam > 0.15 ? 0.82 : lam > -0.05 ? 0.55 : 0.22 + night * 0.06;
      let r = this.tex[t] * band;
      let g = this.tex[t + 1] * band;
      let b = this.tex[t + 2] * (band + (1 - band) * 0.35);
      // City-glow of living colonies on the night side: faint warm specks.
      if (band < 0.3 && this.tex[t + 1] > 150 && this.tex[t] < 140 && (i * 2654435761) % 11 === 0) (r = 255), (g = 184), (b = 107);
      if (ins === 2) (r = r * 0.7 + 40), (g = g * 0.7 + 60), (b = b * 0.7 + 90); // atmosphere rim
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.texture.source.update();
  }

  /** Which map cell is under a pixel of the sphere, or null off the disc. */
  cellAt(px: number, py: number, spin: number): number | null {
    if (!this.planet || !this.rows) return null;
    px = Math.round(px);
    py = Math.round(py);
    if (px < 0 || py < 0 || px >= this.size || py >= this.size) return null;
    const i = py * this.size + px;
    if (!this.inside[i]) return null;
    let u = this.lutU[i] + spin;
    u -= Math.floor(u);
    return this.rows[i] * this.planet.map.w + ((u * this.planet.map.w) | 0);
  }

  /** Where a longitude/latitude appears on the sphere (pixels), and whether it faces us. */
  project(lon: number, lat: number, spin: number): { x: number; y: number; front: boolean } {
    const r = (this.size - 1) / 2;
    const tilt = 0.32;
    const L = (lon - spin - 0.5) * Math.PI * 2;
    const la = lat * (Math.PI / 2);
    const x = Math.cos(la) * Math.sin(L);
    const z2 = Math.cos(la) * Math.cos(L);
    const y2 = -Math.sin(la);
    // Undo the tilt.
    const y = y2 * Math.cos(tilt) + z2 * Math.sin(tilt);
    const z = -y2 * Math.sin(tilt) + z2 * Math.cos(tilt);
    return { x: r + x * (r + 0.5), y: r + y * (r + 0.5), front: z > 0 };
  }

  destroy() {
    this.texture.destroy(true);
  }
}

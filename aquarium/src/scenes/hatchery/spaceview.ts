// The view behind the tank: deep space through the lab's viewport. A dithered nebula, three depths
// of drifting stars, the planet we are seeding hanging large and low with its atmosphere, sunglare
// on the day side, the odd shuttle crossing, and pods streaking down to the surface.

import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { canvas, texOf, lcg, glowTexture } from '../paint';
import { Globe } from '../globe';
import type { Planet } from '../../planet/load';
import type { HatcheryLayout } from './layout';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function starTexture(seed: number, n: number, bright: number, size = 128) {
  const { c, g } = canvas(size, size);
  const r = lcg(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * size);
    const y = Math.floor(r() * size);
    const v = 120 + Math.floor(r() * 135 * bright);
    const tint = r();
    g.fillStyle = tint < 0.15 ? `rgb(${v},${v * 0.86},${v * 0.7})` : tint < 0.3 ? `rgb(${v * 0.75},${v * 0.85},${v})` : `rgb(${v * 0.9},${v * 0.93},${v})`;
    g.fillRect(x, y, 1, 1);
    if (bright > 0.9 && r() < 0.18) {
      g.fillStyle = 'rgba(190,210,255,0.35)';
      g.fillRect(x - 1, y, 1, 1);
      g.fillRect(x + 1, y, 1, 1);
      g.fillRect(x, y - 1, 1, 1);
      g.fillRect(x, y + 1, 1, 1);
    }
  }
  return texOf(c);
}

/** Smooth value noise on a lattice, enough for a nebula. */
function noise2(seed: number) {
  const h = (x: number, y: number) => {
    let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  const v = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = s(x - xi);
    const fy = s(y - yi);
    const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * fx;
    const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
  return (x: number, y: number) => v(x, y) * 0.55 + v(x * 2.1, y * 2.1) * 0.3 + v(x * 4.3, y * 4.3) * 0.15;
}

/** The void with a nebula band across it, dithered in a few flat colours. */
function paintDeep(W: number, H: number) {
  const { c, g } = canvas(W, H);
  const img = g.createImageData(W, H);
  const d = img.data;
  const n1 = noise2(3);
  const n2 = noise2(17);
  const top = [2, 3, 9];
  const bot = [6, 9, 24];
  // Palette steps: void → indigo haze → violet → a teal fringe.
  const violet = [[14, 12, 38], [28, 18, 62], [52, 30, 92]];
  const teal = [[8, 26, 40], [14, 46, 62]];
  for (let y = 0; y < H; y++) {
    const k = Math.floor((y / H) * 10) / 9;
    const base = top.map((v, j) => v + (bot[j] - v) * k);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const th = BAYER[(y & 3) * 4 + (x & 3)];
      // A band running down-right across the upper half.
      const by = H * 0.16 + x * 0.34;
      const band = Math.exp(-(((y - by) / (H * 0.2)) ** 2));
      const v = n1(x / 70, y / 48) * band * 1.25;
      const tv = n2(x / 40 + 9, y / 30) * band;
      let col = base;
      if (tv > 0.5 + th * 0.12) col = teal[tv > 0.6 + th * 0.1 ? 1 : 0];
      else if (v > 0.42 + th * 0.18) col = violet[v > 0.78 + th * 0.12 ? 2 : v > 0.6 + th * 0.14 ? 1 : 0];
      d[o] = col[0];
      d[o + 1] = col[1];
      d[o + 2] = col[2];
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // A few distant galaxies: tiny tilted smudges.
  const r = lcg(41);
  for (let i = 0; i < Math.max(2, Math.round((W * H) / 40000)); i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(r() * H * 0.6);
    g.fillStyle = 'rgba(200,190,255,0.25)';
    g.fillRect(x, y, 3, 1);
    g.fillRect(x + 1, y - 1, 2, 1);
    g.fillStyle = 'rgba(255,240,255,0.6)';
    g.fillRect(x + 1, y, 1, 1);
  }
  return c;
}

interface Trail {
  t: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class SpaceView {
  root = new Container();
  private deep = new Sprite();
  private stars: TilingSprite[];
  private glare = new Sprite(glowTexture(96, 7));
  private halo = new Graphics();
  private globe: Globe | null = null;
  private planetSprite = new Sprite();
  private traffic = new Graphics();
  private trail = new Graphics();
  private L!: HatcheryLayout;
  private planet: Planet | null = null;
  private lastRender = -1;
  private lifeKey = '';
  private trails: Trail[] = [];
  private shuttle = { t: -1, next: 14, y: 0, dir: 1, speed: 10 };

  constructor() {
    const texs = [starTexture(11, 70, 0.45), starTexture(23, 30, 0.75), starTexture(37, 9, 1)];
    this.stars = texs.map((texture) => new TilingSprite({ texture, width: 10, height: 10 }));
    this.glare.anchor.set(0.5);
    this.glare.blendMode = 'add';
    this.glare.tint = 0xfff4dc;
    this.halo.blendMode = 'add';
    this.trail.blendMode = 'add';
    this.root.addChild(this.deep, ...this.stars, this.glare, this.halo, this.planetSprite, this.traffic, this.trail);
  }

  setPlanet(p: Planet) {
    this.planet = p;
    if (this.L) this.resize(this.L);
  }

  resize(L: HatcheryLayout) {
    const sized = this.L && this.L.viewW === L.viewW && this.L.viewH === L.viewH && this.L.planet.r === L.planet.r;
    this.L = L;
    if (!sized) {
      this.deep.texture?.destroy(true);
      this.deep.texture = texOf(paintDeep(L.viewW, L.viewH));
    }
    for (const s of this.stars) (s.width = L.viewW), (s.height = L.viewH);
    const { cx, cy, r } = L.planet;
    this.glare.position.set(Math.round(L.viewW * 0.12), Math.round(L.viewH * 0.1));
    this.glare.width = this.glare.height = Math.round(Math.max(L.viewW, L.viewH) * 0.7);
    // The atmosphere: thin bright limb, then a soft falloff in hard steps.
    this.halo.clear();
    for (let i = 5; i >= 1; i--) this.halo.circle(cx, cy, r + i * 2).fill({ color: 0x5fb8ff, alpha: 0.05 });
    this.halo.circle(cx, cy, r + 1).fill({ color: 0x9fe0ff, alpha: 0.18 });
    if (this.planet && (!sized || !this.globe)) {
      this.globe?.destroy();
      this.globe = new Globe(r);
      this.globe.setPlanet(this.planet);
      this.lifeKey = '';
      this.planetSprite.texture = this.globe.texture;
    }
    if (this.globe) this.planetSprite.position.set(cx - (this.globe.size - 1) / 2, cy - (this.globe.size - 1) / 2);
  }

  /** A pod falling away from the station toward the surface. */
  launch() {
    const L = this.L;
    if (!L) return;
    const { cx, cy, r } = L.planet;
    this.trails.push({ t: 0, x0: L.viewW / 2, y0: L.viewH - 8, x1: cx + (Math.random() - 0.5) * r * 0.9, y1: cy - r * (0.35 + Math.random() * 0.35) });
  }

  update(dt: number, t: number, o: { f: number; light: number }, life: number[], open: number[], calm: boolean) {
    const L = this.L;
    if (!L) return;
    const night = 1 - o.light;
    // Stars drift with the station's orbit; the near layer faster.
    const speeds = [0.6, 1.4, 3];
    this.stars.forEach((s, i) => {
      if (!calm) s.tilePosition.x = -t * speeds[i];
      s.alpha = 0.55 + night * 0.45 - (i === 0 ? o.light * 0.25 : 0);
    });
    this.glare.alpha = o.light > 0.35 ? (o.light - 0.35) * 0.55 : 0;
    this.halo.alpha = 0.6 + o.light * 0.4;
    if (this.globe) {
      const key = life.join(',') + '|' + open.join('');
      if (key !== this.lifeKey) {
        this.lifeKey = key;
        this.globe.repaint(life, open);
        this.lastRender = -1;
      }
      if (this.lastRender < 0 || t - this.lastRender > 0.25) {
        this.lastRender = t;
        this.globe.render(calm ? 0.2 : t / 300, (o.f + 0.5) % 1, night);
      }
    }
    this.drawTraffic(dt, t, calm);
    this.drawTrails(dt);
  }

  /** Now and then a shuttle glides across the far sky, nav lights blinking. */
  private drawTraffic(dt: number, t: number, calm: boolean) {
    const g = this.traffic.clear();
    const L = this.L;
    const s = this.shuttle;
    if (calm) return;
    if (s.t < 0) {
      s.next -= dt;
      if (s.next > 0) return;
      s.t = 0;
      s.dir = Math.random() < 0.5 ? 1 : -1;
      s.y = Math.round(L.viewH * (0.08 + Math.random() * 0.3));
      s.speed = 7 + Math.random() * 6;
    }
    s.t += dt;
    const x = Math.round(s.dir > 0 ? -8 + s.t * s.speed : L.viewW + 8 - s.t * s.speed);
    const y = s.y + Math.round(s.t * 0.6);
    if (x < -10 || x > L.viewW + 10) {
      s.t = -1;
      s.next = 45 + Math.random() * 60;
      return;
    }
    const nose = s.dir;
    g.rect(x - 2, y, 5, 1).fill(0x8a93b0);
    g.rect(x - 1, y - 1, 3, 1).fill(0xb9c2dc);
    g.rect(x - nose, y + 1, 1, 1).fill(0x5a6380);
    if (Math.floor(t * 2) % 2) g.rect(x + 3 * nose, y, 1, 1).fill(0xffffff);
    g.rect(x - 3 * nose, y, 1, 1).fill({ color: 0x7fd8ff, alpha: 0.9 }); // engine
  }

  private drawTrails(dt: number) {
    const g = this.trail.clear();
    for (const tr of this.trails) {
      tr.t += dt;
      const k = Math.min(1, tr.t / 1.6);
      // Ease out: fast off the station, slowing as it shrinks toward the planet.
      const e = (q: number) => 1 - (1 - q) ** 2.2;
      for (let i = 0; i < 14; i++) {
        const kk = k - i * 0.025;
        if (kk < 0) break;
        const q = e(kk);
        const x = tr.x0 + (tr.x1 - tr.x0) * q + Math.sin(q * 3) * 10;
        const y = tr.y0 + (tr.y1 - tr.y0) * q;
        const size = i === 0 && q < 0.5 ? 2 : 1;
        g.rect(Math.round(x), Math.round(y), size, size).fill({ color: i === 0 ? 0xffffff : 0x7fd8ff, alpha: 1 - i / 14 });
      }
      // Touchdown: a brief ring on the surface.
      if (tr.t > 1.6 && tr.t < 2.3) {
        const a = 1 - (tr.t - 1.6) / 0.7;
        const rr = 1 + (tr.t - 1.6) * 8;
        g.circle(Math.round(tr.x1), Math.round(tr.y1), rr).stroke({ color: 0xc8f5ff, width: 1, alpha: a * 0.8 });
      }
    }
    this.trails = this.trails.filter((x) => x.t < 2.3);
  }

  destroy() {
    this.globe?.destroy();
    this.root.destroy({ children: true });
  }
}

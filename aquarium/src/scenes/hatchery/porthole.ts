// The window behind the tank: a three-depth parallax starfield with Mirelle turning below.
// Daylight floods in on the day side; stars brighten at night.

import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { canvas, texOf, lcg } from '../paint';
import { Globe } from '../globe';
import type { Planet } from '../../planet/load';
import type { HatcheryLayout } from './layout';

function starTexture(seed: number, n: number, bright: number, size = 96) {
  const { c, g } = canvas(size, size);
  const r = lcg(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * size);
    const y = Math.floor(r() * size);
    const v = 150 + Math.floor(r() * 105 * bright);
    const warm = r() < 0.2;
    g.fillStyle = warm ? `rgb(${v},${v * 0.85},${v * 0.6})` : `rgb(${v * 0.85},${v * 0.9},${v})`;
    g.fillRect(x, y, 1, 1);
    if (bright > 0.9 && r() < 0.15) {
      g.fillStyle = 'rgba(200,210,255,0.4)';
      g.fillRect(x - 1, y, 1, 1);
      g.fillRect(x + 1, y, 1, 1);
      g.fillRect(x, y - 1, 1, 1);
      g.fillRect(x, y + 1, 1, 1);
    }
  }
  return texOf(c);
}

export class Porthole {
  root = new Container();
  private mask = new Graphics();
  private space = new Graphics();
  private stars: TilingSprite[] = [];
  private globe: Globe | null = null;
  private planetSprite = new Sprite();
  private sun = new Graphics();
  private trail = new Graphics();
  private L!: HatcheryLayout;
  private lastRender = -1;
  private lifeKey = '';
  private trails: { t: number; to: number }[] = [];
  private planet: Planet | null = null;

  constructor() {
    const texs = [starTexture(11, 40, 0.5), starTexture(23, 22, 0.8), starTexture(37, 10, 1)];
    this.stars = texs.map((texture) => new TilingSprite({ texture, width: 10, height: 10 }));
    this.root.addChild(this.space, ...this.stars, this.planetSprite, this.sun, this.trail, this.mask);
    this.root.mask = this.mask;
    this.sun.blendMode = 'add';
  }

  setPlanet(p: Planet) {
    this.planet = p;
    if (this.L) this.resize(this.L);
  }

  resize(L: HatcheryLayout) {
    this.L = L;
    const { cx, cy, r } = L.porthole;
    this.mask.clear().circle(cx, cy, r + 0.5).fill(0xffffff);
    this.space.clear().rect(cx - r, cy - r, r * 2, r * 2).fill(0x0b0e1f);
    for (const s of this.stars) {
      s.position.set(cx - r, cy - r);
      s.width = s.height = r * 2;
    }
    if (this.planet) {
      this.globe?.destroy();
      this.globe = new Globe(Math.round(r * 1.25));
      this.globe.setPlanet(this.planet);
      this.lifeKey = '';
      this.planetSprite.texture = this.globe.texture;
      this.planetSprite.position.set(cx - this.globe.size / 2 + r * 0.25, cy + r * 0.35);
    }
  }

  /** A pod's trail streaking toward the planet. */
  launch() {
    this.trails.push({ t: 0, to: Math.random() });
  }

  update(dt: number, t: number, o: { f: number; light: number }, life: number[], open: number[], calm: boolean) {
    if (!this.L) return;
    const { cx, cy, r } = this.L.porthole;
    const night = 1 - o.light;
    const speeds = [1.5, 3.5, 7];
    this.stars.forEach((s, i) => {
      if (!calm) s.tilePosition.x = -t * speeds[i];
      s.alpha = 0.35 + night * 0.65 - (i === 0 ? o.light * 0.2 : 0);
    });
    if (this.globe) {
      const key = life.join(',') + '|' + open.join('');
      if (key !== this.lifeKey) {
        this.lifeKey = key;
        this.globe.repaint(life, open);
        this.lastRender = -1;
      }
      // Re-render a few times a second: the spin is slow.
      if (this.lastRender < 0 || t - this.lastRender > 0.25) {
        this.lastRender = t;
        this.globe.render(calm ? 0.2 : t / 240, (o.f + 0.5) % 1, night);
      }
    }
    // Daylight through the glass.
    this.sun.clear();
    if (o.light > 0.3) {
      const a = (o.light - 0.3) * 0.22;
      this.sun.circle(cx + r * 0.6, cy - r * 0.6, r * 0.5).fill({ color: 0xfff1c9, alpha: a });
      this.sun.circle(cx + r * 0.6, cy - r * 0.6, r * 0.25).fill({ color: 0xffffff, alpha: a });
    }
    // Pod trails: a bright head with a fading tail, from the top-left edge down to the planet.
    this.trail.clear();
    for (const tr of this.trails) {
      tr.t += dt;
      const k = Math.min(1, tr.t / 0.9);
      const x0 = cx - r;
      const y0 = cy - r * (0.2 + tr.to * 0.4);
      const x1 = cx + r * 0.3;
      const y1 = cy + r * 0.75;
      for (let i = 0; i < 10; i++) {
        const kk = k - i * 0.035;
        if (kk < 0) break;
        const x = x0 + (x1 - x0) * kk;
        const y = y0 + (y1 - y0) * kk * kk;
        this.trail.rect(Math.round(x), Math.round(y), 1, 1).fill({ color: i === 0 ? 0xffffff : 0xffb86b, alpha: 1 - i / 10 });
      }
    }
    this.trails = this.trails.filter((x) => x.t < 1.1);
  }
}

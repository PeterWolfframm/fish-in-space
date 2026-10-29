// Fish-der's backdrop: a dim lab wall with bubbles and the odd pixel heart drifting up behind the
// cards. The deck itself is HTML over this.

import { Container, Graphics, Sprite } from 'pixi.js';
import type { Scene } from '../stage';
import { calm } from '../stage';
import { hullWall } from '../room';
import { texOf, lcg } from '../paint';

interface Mote {
  g: Graphics;
  x: number;
  y: number;
  v: number;
  wob: number;
}

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

function heart(color: number) {
  const g = new Graphics();
  HEART.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && g.rect(x, y, 1, 1)));
  return g.fill(color);
}

export class TinderScene implements Scene {
  root = new Container();
  private wall = new Sprite();
  private motes: Mote[] = [];
  private W = 360;
  private H = 200;
  private rnd = lcg(14);

  constructor() {
    this.root.addChild(this.wall);
    for (let i = 0; i < 26; i++) {
      const isHeart = i % 6 === 0;
      const g = isHeart ? heart(i % 12 === 0 ? 0xff8a76 : 0xffa8c4) : new Graphics().circle(0, 0, 1 + (i % 3) * 0.5).stroke({ color: 0x6fe0ee, width: 1, alpha: 0.5 });
      g.alpha = isHeart ? 0.5 : 0.35;
      this.root.addChild(g);
      this.motes.push({ g, x: this.rnd() * 360, y: this.rnd() * 200, v: 6 + this.rnd() * 10, wob: this.rnd() * 6 });
    }
  }

  fps = () => (calm() ? 10 : 30);

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
    this.wall.texture?.destroy(true);
    this.wall.texture = texOf(hullWall(W, H, 9).c);
    for (const m of this.motes) (m.x = this.rnd() * W), (m.y = this.rnd() * H);
  }

  update(dt: number, t: number) {
    if (calm()) return;
    for (const m of this.motes) {
      m.y -= m.v * dt;
      if (m.y < -8) (m.y = this.H + 4), (m.x = this.rnd() * this.W);
      m.g.position.set(Math.round(m.x + Math.sin(t * 0.8 + m.wob) * 3), Math.round(m.y));
    }
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

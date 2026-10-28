// The Roe Counter: Sel behind a frosted cryo counter, drawers of roe glowing blue, cuttings hanging
// from a rail. The panel below does the buying; tapping a drawer here scrolls to it.

import { Container, Graphics, Sprite } from 'pixi.js';
import { game, now } from '../../store/signals';
import * as W from '../../game';
import { calm, fx, type Scene } from '../stage';
import { Backdrop, Figure, hullWall } from '../room';
import { glowTexture } from '../paint';

export class CounterScene implements Scene {
  root = new Container();
  private back = new Backdrop();
  private sel = new Figure('sel');
  private counter = new Graphics();
  private drawers = new Graphics();
  private frost = new Graphics();
  private glow = new Sprite(glowTexture(32, 5));
  private W = 360;
  private H = 150;
  private t = 0;
  private slots: { x: number; y: number; w: number; h: number; i: number }[] = [];

  fps = () => 30;

  constructor() {
    this.glow.tint = 0x3fc6c9;
    this.glow.blendMode = 'add';
    this.sel.scale = 2;
    this.root.addChild(this.back.root, this.sel.root, this.counter, this.glow, this.drawers, this.frost);
  }

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
    const { c, g } = hullWall(W, H, 17);
    // A shelf of jars and a "ROE" sign on the back wall.
    g.fillStyle = '#2c3563';
    g.fillRect(8, 22, 70, 2);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = ['#3fc6c9', '#9be37a', '#ffb86b'][i % 3];
      g.globalAlpha = 0.55;
      g.fillRect(12 + i * 11, 13, 7, 9);
      g.globalAlpha = 1;
      g.fillStyle = '#f3ead8';
      g.fillRect(12 + i * 11, 12, 7, 1);
    }
    g.fillStyle = '#ff7aa8';
    g.fillRect(W - 58, 10, 46, 13);
    g.fillStyle = '#1b2140';
    g.fillRect(W - 57, 11, 44, 11);
    g.fillStyle = '#ff7aa8';
    g.font = '8px monospace';
    g.fillText('ROE · CRYO', W - 55, 19);
    this.back.set(c, W / 2, Math.min(90, W * 0.3));
  }

  tap(x: number, y: number) {
    const d = this.slots.find((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
    if (!d) return;
    document.getElementById(`drawer-${d.i}`)?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
    document.getElementById(`drawer-${d.i}`)?.focus({ preventScroll: true });
  }

  update(dt: number) {
    this.t += dt;
    const quiet = calm();
    const w = this.W;
    const h = this.H;
    const s = game.peek();
    const t = now.peek();
    const stock = W.stock(s, t);
    this.back.update(this.t, quiet);

    // Sel stands behind the counter, to the right.
    const cy = h - 14 - Math.round(h * 0.3);
    this.sel.root.position.set(Math.round(w * 0.68 - this.sel.w / 2), Math.round(cy - this.sel.h + 18));
    this.sel.update(dt, this.t, false, quiet);

    const c = this.counter.clear();
    c.rect(0, cy, w, h - 14 - cy).fill(0x2a2f4f);
    c.rect(0, cy, w, 2).fill(0xc9cfe6);
    c.rect(0, cy + 2, w, 1).fill(0x7d8aa0);

    // Drawers: one per stock item, along the counter front.
    const n = Math.max(stock.length, 1);
    const dw = Math.min(46, Math.floor((w - 16) / Math.max(n, 4)) - 4);
    const dh = Math.max(14, Math.floor((h - 14 - cy) * 0.6));
    const d = this.drawers.clear();
    this.slots = [];
    const sold = s.shop.orbit === W.currentOrbit(s, t) ? s.shop.sold : [];
    const all = W.drawers(s, W.currentOrbit(s, t));
    all.forEach((dr, k) => {
      const x = 8 + k * (dw + 4);
      const y = cy + 6;
      const gone = sold.includes(dr.index);
      d.rect(x, y, dw, dh).fill(gone ? 0x1b2140 : 0x3a4370);
      d.rect(x, y, dw, 1).fill(0x9aa6d6);
      d.rect(x + dw / 2 - 4, y + dh - 4, 8, 2).fill(0xc9cfe6);
      if (!gone) {
        const col = dr.kind === 'heritage' ? 0xffb86b : dr.kind === 'wild' ? 0xff7aa8 : 0x3fc6c9;
        const tw = quiet ? 1 : 0.7 + 0.3 * Math.sin(this.t * 2 + k);
        d.rect(x + 3, y + 3, dw - 6, dh - 9).fill({ color: col, alpha: 0.25 * tw });
        for (let e = 0; e < 5; e++) d.rect(x + 5 + ((e * 7) % (dw - 10)), y + 5 + ((e * 3) % Math.max(1, dh - 12)), 2, 2).fill({ color: col, alpha: 0.9 });
      }
      this.slots.push({ x, y, w: dw, h: dh, i: dr.index });
    });

    // Frost: slow drifting specks over the counter.
    const f = this.frost.clear();
    if (fx() && !quiet) {
      for (let i = 0; i < 14; i++) {
        const x = (i * 53 + this.t * (4 + (i % 3))) % w;
        const y = cy - 4 + ((i * 17 + this.t * 3) % 22);
        f.rect(Math.floor(x), Math.floor(y), 1, 1).fill({ color: 0xe8f6ff, alpha: 0.5 });
      }
    }
    this.glow.width = w * 0.7;
    this.glow.height = 40;
    this.glow.position.set(w * 0.05, cy - 10);
    this.glow.alpha = 0.25;
  }

  destroy() {
    this.sel.destroy();
    this.root.destroy({ children: true });
  }
}

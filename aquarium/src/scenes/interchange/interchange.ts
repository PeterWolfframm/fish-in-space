// The Interchange: the Ark Genetic Interchange's cryo rack. Each of this orbit's samples is a glass
// cassette glowing in its water's colour (gold for heritage stock, rose for wild), roe drifting inside.
// Tap one and it slides out of the rack while the panel scrolls to it. Sel minds the counter, and the
// mystery crate sits on the deck with its seam lit when it's ready. Cold mist pools along the bottom.

import { Container, Graphics, Sprite } from 'pixi.js';
import { game, now } from '../../store/signals';
import * as W from '../../game';
import { calm, fx, type Scene } from '../stage';
import { Backdrop, Figure, hullWall } from '../room';
import { glowTexture } from '../paint';

const BIOME_COL: Record<string, number> = { melt: 0xbfe8ff, river: 0x6ff28a, delta: 0xd9c27a, reef: 0xff8fb8, trench: 0x6aa8ff, sea: 0x3ee6f5 };
const colOf = (d: W.Drawer) => (d.kind === 'heritage' ? 0xffd84a : d.kind === 'wild' ? 0xff7aa8 : (BIOME_COL[d.biome ?? ''] ?? 0x3ee6f5));

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
  i: number;
}

export class InterchangeScene implements Scene {
  root = new Container();
  private back = new Backdrop();
  private rackBack = new Graphics();
  private glows: Sprite[] = [];
  private cassettes = new Graphics();
  private sel = new Figure('sel');
  private counter = new Graphics();
  private mist = new Graphics();
  private W = 360;
  private H = 150;
  private t = 0;
  private cy = 100;
  private rack = { x: 0, y: 0, w: 0, h: 0 };
  private slots: Slot[] = [];
  private pulled = new Map<number, number>(); // drawer index → seconds since tapped
  private crate = { x: 0, y: 0, w: 0, h: 0 };

  fps = () => 30;

  constructor() {
    this.sel.scale = 2;
    const glowLayer = new Container();
    for (let i = 0; i < 10; i++) {
      const g = new Sprite(glowTexture(32, 5));
      g.blendMode = 'add';
      g.visible = false;
      this.glows.push(g);
      glowLayer.addChild(g);
    }
    this.root.addChild(this.back.root, this.rackBack, glowLayer, this.cassettes, this.sel.root, this.counter, this.mist);
  }

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
    this.cy = H - 14 - Math.round(H * 0.2);
    const { c, g } = hullWall(W, H, 17);
    // A strip of console lights over the rack, and a frosted vent grille.
    const R = (x: number, y: number, w: number, h: number, col: string) => ((g.fillStyle = col), g.fillRect(x, y, w, h));
    for (let x = 8; x < W * 0.62; x += 22) {
      R(x, 6, 14, 3, ['#3ee6f5', '#b48cff', '#ffa53d', '#6aa8ff'][(x / 22) % 4 | 0]);
    }
    R(W - 46, 14, 34, 18, '#0b101d');
    for (let y = 16; y < 31; y += 3) R(W - 44, y, 30, 1, '#1d2a44');
    this.back.set(c, W * 0.34, Math.min(120, W * 0.36));

    // The rack: a steel frame over most of the left of the wall.
    const rx = 8;
    const rw = Math.max(120, Math.round(W * 0.62) - rx);
    const ry = 14;
    const rh = this.cy - ry - 6;
    this.rack = { x: rx, y: ry, w: rw, h: rh };
    const b = this.rackBack.clear();
    b.roundRect(rx, ry, rw, rh, 4).fill(0x0a0f1d);
    b.roundRect(rx, ry, rw, rh, 4).stroke({ color: 0x3a4568, width: 1 });
    b.rect(rx + 2, ry + 2, rw - 4, 1).fill({ color: 0xaef4ff, alpha: 0.25 });
    // Frost creeping in from the frame corners.
    for (let i = 0; i < 40; i++) {
      const fx0 = (i * 37) % rw;
      const up = (i * 13) % 6;
      b.rect(rx + fx0, ry + rh - 2 - up, 2, 1).fill({ color: 0xe8f6ff, alpha: 0.18 });
    }
    // Crate on the deck in front of the counter's left end.
    const cw = Math.max(26, Math.round(W * 0.09));
    this.crate = { x: rx + 4, y: this.cy - Math.round(cw * 0.8) + 2, w: cw, h: Math.round(cw * 0.8) };
  }

  tap(x: number, y: number) {
    const d = this.slots.find((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h + 6);
    if (d) {
      this.pulled.set(d.i, 0);
      const el = document.getElementById(`drawer-${d.i}`);
      el?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
      return;
    }
    const k = this.crate;
    if (x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h) {
      const el = document.getElementById('crate');
      el?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }
  }

  update(dt: number) {
    this.t += dt;
    const quiet = calm();
    const w = this.W;
    const h = this.H;
    const s = game.peek();
    const t = now.peek();
    this.back.update(this.t, quiet);
    const n0 = W.currentOrbit(s, t);
    const all = W.drawers(s, n0);
    const sold = s.shop.orbit === n0 ? s.shop.sold : [];

    // Cassettes: one row if they fit, otherwise two.
    const { x: rx, y: ry, w: rw, h: rh } = this.rack;
    const n = Math.max(1, all.length);
    const rows = n > 5 && rh > 90 ? 2 : 1;
    const per = Math.ceil(n / rows);
    const cw = Math.max(14, Math.min(30, Math.floor((rw - 12) / per) - 6));
    const ch = Math.max(26, Math.min(70, Math.floor((rh - 10) / rows) - 10));
    const span = per * (cw + 6) - 6;
    const ox = rx + Math.round((rw - span) / 2);
    const g = this.cassettes.clear();
    this.slots = [];
    this.glows.forEach((x) => (x.visible = false));
    all.forEach((dr, k) => {
      const row = Math.floor(k / per);
      const col = k % per;
      const gone = sold.includes(dr.index);
      const since = this.pulled.get(dr.index);
      // Pull-out: slides down and forward a few pixels, then back after a moment.
      let pull = 0;
      if (since !== undefined) {
        const u = since + dt;
        this.pulled.set(dr.index, u);
        pull = quiet ? 4 : Math.round(Math.min(1, u * 6) * 6 * (u < 2.4 ? 1 : Math.max(0, 1 - (u - 2.4) * 3)));
        if (u > 3) this.pulled.delete(dr.index);
      }
      const x = ox + col * (cw + 6);
      const y = ry + 6 + row * (ch + 10) + pull;
      const c = colOf(dr);
      // Slot shadow in the rack.
      g.rect(x - 1, ry + 5 + row * (ch + 10), cw + 2, ch + 2).fill({ color: 0x04050b, alpha: 0.7 });
      // Caps.
      g.roundRect(x, y, cw, 5, 2).fill(0x5a6690);
      g.rect(x + 1, y, cw - 2, 1).fill(0xc3cde6);
      g.roundRect(x, y + ch - 5, cw, 5, 2).fill(0x5a6690);
      // Glass and fluid.
      const gy = y + 5;
      const gh = ch - 10;
      g.rect(x + 1, gy, cw - 2, gh).fill({ color: gone ? 0x0d1220 : 0x0a1424, alpha: 1 });
      if (!gone) {
        const breathe = quiet ? 1 : 0.8 + 0.2 * Math.sin(this.t * 1.6 + k);
        const level = Math.round(gh * 0.82);
        g.rect(x + 1, gy + gh - level, cw - 2, level).fill({ color: c, alpha: 0.32 * breathe });
        g.rect(x + 1, gy + gh - level, cw - 2, 1).fill({ color: 0xffffff, alpha: 0.5 });
        // Roe: little pearls drifting on slow sines.
        for (let e = 0; e < Math.max(3, Math.floor(gh / 9)); e++) {
          const px = x + 3 + ((e * 5 + Math.floor(quiet ? 0 : Math.sin(this.t * 0.7 + e) * 2)) % Math.max(1, cw - 6));
          const py = gy + gh - level + 3 + ((e * 11 + (quiet ? 0 : this.t * 2)) % Math.max(1, level - 5));
          g.rect(Math.round(px), Math.round(py), 2, 2).fill({ color: c, alpha: 0.95 });
          g.rect(Math.round(px), Math.round(py), 1, 1).fill({ color: 0xffffff, alpha: 0.7 });
        }
        // Rising bubble.
        if (!quiet && fx()) g.rect(x + cw - 4, Math.round(gy + gh - ((this.t * 8 + k * 13) % level)), 1, 1).fill({ color: 0xffffff, alpha: 0.7 });
        // Heritage stock gets a gold band; wild a rose one.
        if (dr.kind !== 'biome') g.rect(x + 1, gy + 2, cw - 2, 2).fill(c);
        const glow = this.glows[k];
        if (glow && fx()) {
          glow.visible = true;
          glow.tint = c;
          glow.width = cw * 2.4;
          glow.height = ch * 1.3;
          glow.position.set(x + cw / 2 - glow.width / 2, y + ch / 2 - glow.height / 2);
          glow.alpha = (since !== undefined ? 0.6 : 0.3) * breathe;
        }
      } else {
        // Empty: frosted glass and a dim red lamp.
        for (let e = 0; e < 4; e++) g.rect(x + 2 + ((e * 7) % (cw - 4)), gy + 3 + e * 4, 2, 1).fill({ color: 0xe8f6ff, alpha: 0.18 });
      }
      // Glass glint and status lamp on the lower cap.
      g.rect(x + 2, gy + 2, 1, Math.round(gh * 0.5)).fill({ color: 0xffffff, alpha: 0.2 });
      g.rect(x + Math.floor(cw / 2) - 1, y + ch - 3, 3, 1).fill(gone ? 0xff6b8b : 0x6ff28a);
      this.slots.push({ x, y, w: cw, h: ch, i: dr.index });
    });

    // Sel behind the counter, on the right.
    const cy = this.cy;
    this.sel.root.position.set(Math.round(Math.max(rx + rw + 4, w * 0.82 - this.sel.w / 2)), Math.round(cy - this.sel.h + 18));
    this.sel.update(dt, this.t, false, quiet);

    // Counter, crate and a tablet.
    const ct = this.counter.clear();
    ct.rect(0, cy, w, h - 14 - cy).fill(0x1d2540);
    ct.rect(0, cy, w, 2).fill(0xc3cde6);
    ct.rect(0, cy + 2, w, 1).fill(0x3a4568);
    for (let x = 12; x < w; x += 52) ct.rect(x, cy + 6, 16, 2).fill({ color: [0x3ee6f5, 0xb48cff, 0xffa53d][(x / 52) % 3 | 0], alpha: 0.75 });
    const k = this.crate;
    const ready = W.crateReady(s, t);
    ct.rect(k.x, k.y, k.w, k.h).fill(0x5a4a3a);
    ct.rect(k.x, k.y, k.w, 2).fill(0x8a7458);
    ct.rect(k.x, k.y + Math.floor(k.h / 2), k.w, 1).fill({ color: ready ? 0xffd84a : 0x3a2f24, alpha: ready ? (quiet ? 1 : 0.6 + 0.4 * Math.sin(this.t * 3)) : 1 });
    ct.rect(k.x + 2, k.y + 2, 1, k.h - 2).fill(0x3a2f24);
    ct.rect(k.x + k.w - 3, k.y + 2, 1, k.h - 2).fill(0x3a2f24);
    // A stencilled "?" in pixels.
    const qx = k.x + Math.floor(k.w / 2) - 2;
    const qy = k.y + 4;
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [3, 1], [2, 2], [1, 3], [1, 5]]) ct.rect(qx + dx, qy + dy, 1, 1).fill({ color: ready ? 0xffd84a : 0x8a7458 });
    const tx = Math.round(w * 0.66);
    ct.rect(tx, cy - 3, 14, 3).fill(0x2a3456);
    ct.rect(tx + 1, cy - 3, 12, 1).fill({ color: 0x3ee6f5, alpha: 0.8 });

    // Cold mist along the bottom of the rack and the counter top.
    const m = this.mist.clear();
    if (fx() && !quiet) {
      for (let i = 0; i < 22; i++) {
        const x = rx + ((i * 41 + this.t * (3 + (i % 4))) % rw);
        const y = ry + rh - 6 + Math.sin(this.t * 0.8 + i) * 3;
        m.rect(Math.floor(x), Math.floor(y), 3, 1).fill({ color: 0xe8f6ff, alpha: 0.22 });
      }
      for (let i = 0; i < 10; i++) {
        const x = (i * 53 + this.t * (4 + (i % 3))) % w;
        const y = cy - 3 + ((i * 17 + this.t * 2) % 6);
        m.rect(Math.floor(x), Math.floor(y), 2, 1).fill({ color: 0xe8f6ff, alpha: 0.3 });
      }
    }
  }

  destroy() {
    this.sel.destroy();
    this.root.destroy({ children: true });
  }
}

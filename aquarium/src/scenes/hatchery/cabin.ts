// The cabin around the tank: hull panels, warm lamp light, the dry ledge, a mug with a steam curl,
// a blinking console LED and a pinned photo of Earth that changes once per chapter.

import { Container, Graphics, Sprite } from 'pixi.js';
import { canvas, texOf, lcg, glowTexture } from '../paint';
import type { HatcheryLayout } from './layout';

export class Cabin {
  back = new Container(); // wall, behind the porthole frame
  frame = new Container(); // tank rim, cabinet, ledge: in front of the water
  private details = new Graphics();
  private lampGlow: Sprite;
  private wall?: Sprite;
  private rim?: Sprite;
  private L!: HatcheryLayout;
  private chapter = -1;

  constructor() {
    this.lampGlow = new Sprite(glowTexture(64, 6));
    this.lampGlow.anchor.set(0.5);
    this.lampGlow.tint = 0xffb86b;
    this.lampGlow.blendMode = 'add';
    this.frame.addChild(this.details);
  }

  resize(L: HatcheryLayout, chapter: number) {
    this.L = L;
    this.chapter = chapter;
    this.wall?.destroy({ texture: true });
    this.rim?.destroy({ texture: true });
    this.wall = new Sprite(texOf(paintWall(L)));
    this.rim = new Sprite(texOf(paintRim(L, chapter)));
    this.back.removeChildren();
    this.back.addChild(this.wall);
    this.frame.removeChildren();
    this.frame.addChild(this.rim, this.details, this.lampGlow);
    this.lampGlow.position.set(L.W - 26, 12);
    this.lampGlow.width = this.lampGlow.height = Math.min(110, L.wallH * 1.6);
  }

  setChapter(chapter: number) {
    if (chapter !== this.chapter && this.L) this.resize(this.L, chapter);
  }

  update(t: number, night: number, calm: boolean) {
    const L = this.L;
    const g = this.details;
    g.clear();
    // Console LED, bottom-left of the cabinet.
    const blink = Math.floor(t * 1.3) % 3 !== 0;
    g.rect(L.tank.x + 6, L.cabinetY + 3, 2, 2).fill(blink ? 0x9be37a : 0x2c3563);
    g.rect(L.tank.x + 10, L.cabinetY + 3, 2, 2).fill(Math.floor(t * 0.7) % 2 ? 0xff7aa8 : 0x2c3563);
    // Steam from the mug on the ledge.
    const mx = L.ledge.x1 - 10;
    const my = L.ledge.y - 7;
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.6 + i / 6) % 1 + 1) % 1;
      const sx = mx + 3 + Math.round(Math.sin(k * 6 + t * (calm ? 0.3 : 1.2)) * 2);
      const sy = my - 2 - Math.round(k * 12);
      g.rect(sx, sy, 1, 1).fill({ color: 0xf3ead8, alpha: 0.35 * (1 - k) });
    }
    // Lamps warm up at night.
    this.lampGlow.alpha = 0.25 + night * 0.55;
  }
}

function paintWall(L: HatcheryLayout) {
  const { c, g } = canvas(L.W, L.H);
  // Hull panels with bevels.
  g.fillStyle = '#1b2140';
  g.fillRect(0, 0, L.W, L.H);
  const panel = 44;
  for (let x = 0; x < L.W; x += panel) {
    g.fillStyle = '#222a4f';
    g.fillRect(x + 1, 1, panel - 2, L.wallH - 2);
    g.fillStyle = '#2c3563';
    g.fillRect(x + 1, 1, panel - 2, 1);
    g.fillStyle = '#141934';
    g.fillRect(x, 0, 1, L.wallH);
    // rivets
    g.fillStyle = '#3a4478';
    g.fillRect(x + 3, 3, 1, 1);
    g.fillRect(x + panel - 4, 3, 1, 1);
  }
  // Warm light pooling down from a ceiling lamp on the right.
  for (let i = 0; i < 5; i++) {
    g.fillStyle = `rgba(255,184,107,${0.05 + i * 0.015})`;
    g.beginPath();
    g.ellipse(L.W - 26, 0, 60 - i * 10, L.wallH * (1.1 - i * 0.18), 0, 0, Math.PI);
    g.fill();
  }
  // The lamp itself.
  g.fillStyle = '#2c3563';
  g.fillRect(L.W - 34, 0, 16, 3);
  g.fillStyle = '#ffb86b';
  g.fillRect(L.W - 32, 3, 12, 2);
  g.fillStyle = '#ffe2b8';
  g.fillRect(L.W - 29, 3, 6, 1);
  // Porthole frame (the glass is drawn by the porthole layer, behind this hole).
  const { cx, cy, r } = L.porthole;
  for (let y = -r - 4; y <= r + 4; y++) {
    for (let x = -r - 4; x <= r + 4; x++) {
      const d = Math.hypot(x, y);
      if (d <= r) g.clearRect(cx + x, cy + y, 1, 1);
      else if (d <= r + 1.5) (g.fillStyle = '#5a648f'), g.fillRect(cx + x, cy + y, 1, 1);
      else if (d <= r + 4) (g.fillStyle = y < -x * 0.3 ? '#3a4478' : '#262e57'), g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  g.fillStyle = '#8a94c0';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * (r + 2.8)), Math.round(cy + Math.sin(a) * (r + 2.8)), 1, 1);
  }
  // Below the wall: the floor behind the cabinet, out of sight.
  g.fillStyle = '#141934';
  g.fillRect(0, L.wallH, L.W, L.H - L.wallH);
  return c;
}

const PHOTOS = [
  ['#3a6fd8', '#59b85a', '#f3ead8'], // blue marble
  ['#2b4fa8', '#8fd06a', '#ffffff'],
  ['#ff9e6e', '#3a6fd8', '#f3ead8'], // a sunrise
  ['#1b2140', '#ffb86b', '#f3ead8'], // city lights
  ['#59b85a', '#9be37a', '#3fc6c9'], // a garden
  ['#3fc6c9', '#9be37a', '#ffb86b'], // Mirelle, green at last
];

function paintRim(L: HatcheryLayout, chapter: number) {
  const { c, g } = canvas(L.W, L.H);
  const t = L.tank;
  // Lamp hood across the top of the tank.
  g.fillStyle = '#2c3563';
  g.fillRect(t.x - 2, t.y - 2, t.w + 4, 5);
  g.fillStyle = '#3a4478';
  g.fillRect(t.x - 2, t.y - 2, t.w + 4, 1);
  g.fillStyle = '#ffb86b';
  g.fillRect(t.x + 4, t.y + 3, t.w - 8, 1);
  // Glass edges.
  g.fillStyle = 'rgba(200,245,255,0.35)';
  g.fillRect(t.x, t.y + 3, 1, t.h - 3);
  g.fillRect(t.x + t.w - 1, t.y + 3, 1, t.h - 3);
  g.fillStyle = 'rgba(255,184,107,0.4)';
  g.fillRect(t.x - 1, t.y + 3, 1, t.h - 3);
  g.fillRect(t.x + t.w, t.y + 3, 1, t.h - 3);
  // Cabinet under the tank: warm wood.
  g.fillStyle = '#5a3a2a';
  g.fillRect(0, L.cabinetY, L.W, L.H - L.cabinetY);
  g.fillStyle = '#7a5038';
  g.fillRect(0, L.cabinetY, L.W, 1);
  g.fillStyle = '#4a2e22';
  const r = lcg(3);
  for (let i = 0; i < L.W / 6; i++) g.fillRect(Math.floor(r() * L.W), L.cabinetY + 2 + Math.floor(r() * Math.max(1, L.H - L.cabinetY - 2)), 3, 1);
  // Airlock hatch in the cabinet, under the tank floor.
  const hx = Math.round(t.x + t.w * 0.5) - 6;
  g.fillStyle = '#2c3563';
  g.fillRect(hx, L.cabinetY + 1, 12, 3);
  g.fillStyle = '#ffb86b';
  g.fillRect(hx + 1, L.cabinetY + 2, 2, 1);
  g.fillRect(hx + 9, L.cabinetY + 2, 2, 1);
  // Dry ledge on the wall, behind the glass.
  const ly = L.ledge.y;
  g.fillStyle = '#7a5038';
  g.fillRect(L.ledge.x0, ly, L.ledge.x1 - L.ledge.x0, 2);
  g.fillStyle = '#a06a48';
  g.fillRect(L.ledge.x0, ly, L.ledge.x1 - L.ledge.x0, 1);
  g.fillStyle = '#4a2e22';
  g.fillRect(L.ledge.x0 + 2, ly + 2, 2, 3);
  g.fillRect(L.ledge.x1 - 4, ly + 2, 2, 3);
  // A mug.
  const mx = L.ledge.x1 - 10;
  g.fillStyle = '#ff7aa8';
  g.fillRect(mx, ly - 6, 6, 6);
  g.fillRect(mx + 6, ly - 5, 2, 1);
  g.fillRect(mx + 7, ly - 5, 1, 3);
  g.fillRect(mx + 6, ly - 3, 2, 1);
  g.fillStyle = '#ffd0e0';
  g.fillRect(mx + 1, ly - 6, 4, 1);
  // A pinned photo of Earth, between the porthole and the ledge.
  const px = Math.round((L.porthole.cx + L.porthole.r + L.ledge.x0) / 2) - 6;
  const py = Math.max(6, Math.round(L.wallH * 0.2));
  if (px > L.porthole.cx + L.porthole.r + 6 && px + 14 < L.ledge.x0 + 16) {
    const [a, b, w] = PHOTOS[Math.min(PHOTOS.length - 1, Math.max(0, chapter))];
    g.fillStyle = w;
    g.fillRect(px, py, 13, 11);
    g.fillStyle = a;
    g.fillRect(px + 1, py + 1, 11, 8);
    g.fillStyle = b;
    g.fillRect(px + 4, py + 3, 4, 3);
    g.fillRect(px + 3, py + 4, 2, 2);
    g.fillStyle = '#ff7aa8';
    g.fillRect(px + 6, py - 1, 1, 2);
  }
  return c;
}

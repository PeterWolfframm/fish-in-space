// The lab hardware around the tank: a brushed lid with its light strip and a hydroponic tray on top,
// slim glass edges with steel corner brackets, and the plinth on the deck with its launch hatch and
// status lights. Everything else is the viewport: no wall.

import { Container, Graphics, Sprite } from 'pixi.js';
import { canvas, texOf, glowTexture } from '../paint';
import type { HatcheryLayout } from './layout';

export class LabFrame {
  back = new Container(); // behind the water: the tank's back edge and floor
  frame = new Container(); // in front of the water
  private art = new Sprite();
  private backArt = new Sprite();
  private lights = new Graphics();
  private grow: Sprite;
  private L!: HatcheryLayout;

  constructor() {
    this.grow = new Sprite(glowTexture(64, 6));
    this.grow.anchor.set(0.5, 0.5);
    this.grow.tint = 0xc59bff;
    this.grow.blendMode = 'add';
    this.back.addChild(this.backArt);
    this.frame.addChild(this.grow, this.art, this.lights);
  }

  resize(L: HatcheryLayout) {
    this.L = L;
    this.art.texture?.destroy(true);
    this.backArt.texture?.destroy(true);
    this.art.texture = texOf(paintFront(L));
    this.backArt.texture = texOf(paintBack(L));
    this.grow.position.set(Math.round((L.tray.x0 + L.tray.x1) / 2), L.lidY - 6);
    this.grow.width = L.tray.x1 - L.tray.x0 + 30;
    this.grow.height = 30;
  }

  update(t: number, night: number, calm: boolean) {
    const L = this.L;
    if (!L) return;
    const g = this.lights.clear();
    // Status lights on the plinth: one steady, one slow pulse, one that ticks.
    const px = L.tank.x + 8;
    const py = L.plinthY + Math.round((L.H - L.plinthY) / 2) - 1;
    g.rect(px, py, 2, 2).fill(0x7be3a0);
    g.rect(px + 4, py, 2, 2).fill({ color: 0x7fd8ff, alpha: calm ? 0.8 : 0.45 + 0.45 * Math.sin(t * 1.6) });
    g.rect(px + 8, py, 2, 2).fill(Math.floor(t * 0.8) % 4 === 0 ? 0xffc46b : 0x283044);
    // The lid's light strip breathes a little at night.
    const a = 0.55 + night * 0.35 + (calm ? 0 : 0.05 * Math.sin(t * 0.9));
    g.rect(L.tank.x + 4, L.tank.y + 7, L.tank.w - 8, 1).fill({ color: 0xaef4ff, alpha: a });
    this.grow.alpha = 0.22 + night * 0.25;
  }
}

/** Behind the water: the far glass edge and a hint of the tank floor. */
function paintBack(L: HatcheryLayout) {
  const { c, g } = canvas(L.W, L.H);
  const t = L.tank;
  g.fillStyle = 'rgba(160,220,255,0.10)';
  g.fillRect(t.x + 3, t.y + 8, t.w - 6, 1);
  return c;
}

function paintFront(L: HatcheryLayout) {
  const { c, g } = canvas(L.W, L.H);
  const t = L.tank;
  const R = (x: number, y: number, w: number, h: number, col: string) => ((g.fillStyle = col), g.fillRect(x, y, w, h));

  // Deck: the lab floor running out to both sides, catching a faint cool reflection.
  const deckY = L.plinthY + Math.round((L.H - L.plinthY) * 0.55);
  R(0, deckY, L.W, L.H - deckY, '#07090f');
  R(0, deckY, L.W, 1, '#1a2133');
  for (let x = (L.W >> 1) % 24; x < L.W; x += 24) R(x, deckY + 1, 1, L.H - deckY, '#0c0f18');

  // Plinth: wider than the tank, dark steel with a lit seam.
  const px0 = t.x - 4;
  const pw = t.w + 8;
  const ph = L.H - L.plinthY;
  R(px0, L.plinthY, pw, ph, '#121725');
  R(px0, L.plinthY, pw, 1, '#4a556e');
  R(px0 + 1, L.plinthY + 1, pw - 2, 1, '#252c40');
  R(px0, L.plinthY + ph - 1, pw, 1, '#0a0d16');
  R(px0 + 1, L.plinthY + 1, 1, ph - 2, '#1e2436');
  R(px0 + pw - 2, L.plinthY + 1, 1, ph - 2, '#0b0e18');
  // Seams.
  for (let x = px0 + 40; x < px0 + pw - 30; x += 56) R(x, L.plinthY + 2, 1, ph - 3, '#0c1019');
  // Launch hatch, centred.
  const hx = Math.round(t.x + t.w / 2) - 9;
  const hy = L.plinthY + 2;
  R(hx, hy, 18, Math.max(3, ph - 5), '#0a0d16');
  R(hx + 1, hy + 1, 16, 1, '#2f3850');
  R(hx + 2, hy + 2, 2, 1, '#7fd8ff');
  R(hx + 14, hy + 2, 2, 1, '#7fd8ff');
  // A readout slot on the right.
  const rx = t.x + t.w - 30;
  R(rx, L.plinthY + Math.round(ph / 2) - 2, 22, 4, '#0a0d16');
  R(rx + 1, L.plinthY + Math.round(ph / 2) - 1, 12, 2, '#1f6b7a');
  R(rx + 14, L.plinthY + Math.round(ph / 2) - 1, 4, 2, '#3a8fa0');

  // Glass: thin bright edges, a darker outer line so they read against the stars.
  R(t.x, t.y + 7, 1, t.h - 7, 'rgba(210,245,255,0.55)');
  R(t.x + t.w - 1, t.y + 7, 1, t.h - 7, 'rgba(210,245,255,0.40)');
  R(t.x - 1, t.y + 7, 1, t.h - 7, 'rgba(5,8,16,0.6)');
  R(t.x + t.w, t.y + 7, 1, t.h - 7, 'rgba(5,8,16,0.6)');
  // Steel corner brackets, top and bottom.
  for (const x of [t.x - 1, t.x + t.w - 4]) {
    R(x, L.plinthY - 6, 5, 6, '#8d97ad');
    R(x, L.plinthY - 6, 5, 1, '#c9d2e3');
    R(x + 1, L.plinthY - 4, 3, 1, '#5c667e');
  }

  // Lid: brushed panel with chamfered ends, vents, and the light strip underneath.
  const lx = t.x - 3;
  const lw = t.w + 6;
  const ly = t.y;
  R(lx + 1, ly, lw - 2, 7, '#a8b1c4');
  R(lx, ly + 1, lw, 5, '#a8b1c4');
  R(lx + 1, ly, lw - 2, 1, '#e4e9f2');
  R(lx, ly + 1, 1, 1, '#e4e9f2');
  R(lx + 2, ly + 2, lw - 4, 1, '#c4ccdb');
  R(lx, ly + 5, lw, 1, '#6c768d');
  R(lx + 1, ly + 6, lw - 2, 1, '#3d4559');
  for (let x = lx + 14; x < lx + lw - 14; x += 6) R(x, ly + 3, 3, 1, '#7e889e');
  // An accent band at the lid's left end: the lab's signature colour block.
  R(lx + 4, ly + 2, 14, 3, '#e8a54b');
  R(lx + 4, ly + 2, 14, 1, '#ffd08a');
  R(lx + 20, ly + 2, 6, 3, '#8fa6ff');

  // Hydroponic tray on the lid, under the plants.
  const tx0 = L.tray.x0 - 4;
  const tw = L.tray.x1 - L.tray.x0 + 8;
  R(tx0, ly - 3, tw, 3, '#1b2232');
  R(tx0, ly - 3, tw, 1, '#3a4560');
  R(tx0 + 1, ly - 2, tw - 2, 1, '#2a2028');
  return c;
}

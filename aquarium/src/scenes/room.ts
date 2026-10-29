// Shared bits for the smaller rooms (Interchange, PIP, Lab): a painted lab wall under a cool ceiling light, and a
// cast member standing in it, animated from their baked portrait sheet.

import { Container, Graphics, Sprite } from 'pixi.js';
import { canvas, texOf, lcg, glowTexture } from './paint';
import { CharacterArt } from '../art/characters';
import { retain, release, type Sheet } from '../art/atlas';
import type { Who } from '../content/comms/types';

/** A lab wall: dark composite panels, a lit console rail, a deck strip. Returns the canvas so a room can
 *  paint more on it. Kept dim so the rooms read as the same quiet station as the hatchery. */
export function hullWall(W: number, H: number, seed = 5) {
  const { c, g } = canvas(W, H);
  const R = (x: number, y: number, w: number, h: number, col: string) => ((g.fillStyle = col), g.fillRect(x, y, w, h));
  R(0, 0, W, H, '#0a0e1a');
  const r = lcg(seed);
  const pw = 56;
  for (let x = 0; x < W; x += pw) {
    R(x + 1, 0, pw - 2, H, r() < 0.5 ? '#0d1220' : '#0b101d');
    R(x, 0, 1, H, '#05070d');
    R(x + 1, 0, 1, H, '#161d30');
    // A rounded inset panel per bay, the way consoles are framed aboard.
    const iy = Math.round(H * 0.18);
    const ih = Math.round(H * 0.42);
    R(x + 8, iy + 1, pw - 16, ih - 2, '#0f1525');
    R(x + 9, iy, pw - 18, ih, '#0f1525');
    R(x + 9, iy, pw - 18, 1, '#1b2338');
  }
  // A cool wash from the ceiling strip.
  for (let i = 0; i < 6; i++) R(0, 0, W, Math.round((H * (i + 1)) / 9), `rgba(143,180,255,${0.012 * (6 - i)})`);
  R(0, 2, W, 1, 'rgba(174,244,255,0.35)');
  // Console rail at waist height: amber, lilac and sky blocks like the hatchery lid.
  const ry = H - 30;
  R(0, ry, W, 3, '#141b2c');
  for (let x = 6; x < W; x += 64) {
    R(x, ry + 1, 18, 1, '#f0a24a');
    R(x + 21, ry + 1, 8, 1, '#b79cf0');
    R(x + 32, ry + 1, 5, 1, '#8fb4ff');
  }
  // Deck.
  R(0, H - 14, W, 14, '#07090f');
  R(0, H - 14, W, 1, '#1a2133');
  for (let x = 3; x < W; x += 24) R(x, H - 13, 1, 13, '#0c0f18');
  return { c, g };
}

export class Backdrop {
  root = new Container();
  wall = new Sprite();
  lamp = new Sprite(glowTexture(64, 6));
  constructor() {
    this.lamp.tint = 0x9fc4ff;
    this.lamp.blendMode = 'add';
    this.root.addChild(this.wall, this.lamp);
  }
  set(c: HTMLCanvasElement, lampX: number, lampR: number) {
    this.wall.texture?.destroy(true);
    this.wall.texture = texOf(c);
    this.lamp.width = this.lamp.height = lampR * 2;
    this.lamp.position.set(lampX - lampR, -lampR * 0.7);
  }
  update(t: number, calm: boolean) {
    this.lamp.alpha = calm ? 0.3 : 0.28 + 0.03 * Math.sin(t * 1.3);
  }
}

/** A cast member's portrait sprite that idles and blinks. */
export class Figure {
  root = new Container();
  private sprite = new Sprite();
  private sheets: Record<string, Sheet | null> = {};
  private f = 0;
  private acc = 0;
  private blinkAt = 3;
  mood = 'idle';
  scale = 1;

  constructor(who: Who) {
    this.root.addChild(this.sprite);
    for (const m of ['idle', 'blink', 'talk']) void CharacterArt.load(who, m).then((s) => s && (retain(s), (this.sheets[m] = s)));
  }

  get w() {
    return (this.sheets.idle?.w ?? 32) * this.scale;
  }
  get h() {
    return (this.sheets.idle?.h ?? 32) * this.scale;
  }

  update(dt: number, t: number, talking: boolean, calm: boolean) {
    let s = this.sheets[talking ? 'talk' : 'idle'] ?? this.sheets.idle;
    if (!talking && t > this.blinkAt && this.sheets.blink) {
      s = this.sheets.blink;
      if (t > this.blinkAt + 0.25) this.blinkAt = t + 2.5 + Math.random() * 3;
    }
    if (!s) return;
    this.acc += dt;
    if (!calm && this.acc > 1 / s.fps) {
      this.acc = 0;
      this.f++;
    }
    this.sprite.texture = s.frames[this.f % s.n];
    this.sprite.scale.set(this.scale);
  }

  destroy() {
    for (const s of Object.values(this.sheets)) if (s) release(s);
    this.root.destroy({ children: true });
  }
}

export const g2 = () => new Graphics();

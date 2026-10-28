// Shared bits for the smaller rooms (Counter, Comms, Lab): a painted hull wall with a warm lamp, and a
// cast member standing in it, animated from their baked portrait sheet.

import { Container, Graphics, Sprite } from 'pixi.js';
import { canvas, texOf, lcg, glowTexture } from './paint';
import { CharacterArt } from '../art/characters';
import { retain, release, type Sheet } from '../art/atlas';
import type { Who } from '../content/comms/types';

/** A hull wall: panel seams, rivets, a floor strip. Returns the canvas so a room can paint more on it. */
export function hullWall(W: number, H: number, seed = 5) {
  const { c, g } = canvas(W, H);
  g.fillStyle = '#1b2140';
  g.fillRect(0, 0, W, H);
  const r = lcg(seed);
  const pw = 48;
  for (let x = 0; x < W; x += pw) {
    g.fillStyle = r() < 0.5 ? '#1e2547' : '#192040';
    g.fillRect(x + 1, 0, pw - 2, H);
    g.fillStyle = '#121731';
    g.fillRect(x, 0, 1, H);
    g.fillStyle = '#2c3563';
    g.fillRect(x + 1, 0, 1, H);
    for (let y = 6; y < H - 20; y += 22) {
      g.fillStyle = '#2c3563';
      g.fillRect(x + 4, y, 1, 1);
      g.fillRect(x + pw - 5, y, 1, 1);
    }
  }
  // A warm wash from the ceiling lamp.
  for (let i = 0; i < 6; i++) {
    g.fillStyle = `rgba(255,184,107,${0.018 * (6 - i)})`;
    g.fillRect(0, 0, W, Math.round((H * (i + 1)) / 7));
  }
  // Floor.
  g.fillStyle = '#10142a';
  g.fillRect(0, H - 14, W, 14);
  g.fillStyle = '#2c3563';
  g.fillRect(0, H - 14, W, 1);
  for (let x = 3; x < W; x += 8) {
    g.fillStyle = '#161b36';
    g.fillRect(x, H - 9, 4, 1);
  }
  return { c, g };
}

export class Backdrop {
  root = new Container();
  wall = new Sprite();
  lamp = new Sprite(glowTexture(64, 6));
  constructor() {
    this.lamp.tint = 0xffb86b;
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
    this.lamp.alpha = calm ? 0.55 : 0.5 + 0.05 * Math.sin(t * 1.3);
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

// PIP's terminal: one big console monitor, and PIP's face filling the screen. The face reacts to the
// chat (talks while answering, grins at good advice, alarms at bad news or an incoming call) and
// blinks now and then. Scanlines, a soft screen glow, a voice trace and a call lamp on the bezel.

import { Container, Graphics, Sprite } from 'pixi.js';
import { commsUnread, commsQueue } from '../../store/signals';
import { pipMood, pipThinking } from '../../store/pip';
import { calm, fx, type Scene } from '../stage';
import { Backdrop, hullWall } from '../room';
import { canvas, texOf, glowTexture } from '../paint';
import { drawPip } from '../../art/characters';

export class PipScene implements Scene {
  root = new Container();
  private back = new Backdrop();
  private glow = new Sprite(glowTexture(64, 6));
  private crt = new Graphics();
  private face = new Sprite();
  private lids = new Graphics();
  private scan = new Sprite();
  private lamp = new Sprite(glowTexture(24, 4));
  private faceCanvas = document.createElement('canvas');
  private faceKey = '';
  private faceReady = false;
  private t = 0;
  private blinkAt = 2;
  private screen = { x: 0, y: 0, w: 0, h: 0 };
  private k = 4; // face pixel scale

  fps = () => 30;

  constructor() {
    this.lamp.tint = 0xff7aa8;
    this.lamp.blendMode = 'add';
    this.glow.tint = 0x3fc6c9;
    this.glow.blendMode = 'add';
    this.glow.anchor.set(0.5);
    this.root.addChild(this.back.root, this.glow, this.crt, this.face, this.lids, this.scan, this.lamp);
  }

  resize(W: number, H: number) {
    const { c, g } = hullWall(W, H, 29);
    const R = (x: number, y: number, w: number, h: number, col: string) => ((g.fillStyle = col), g.fillRect(x, y, w, h));
    // The monitor: as big as the room allows, 4:3, sitting a little high.
    let sw = Math.round(Math.min(W * 0.78, 300));
    let sh = Math.round(sw * 0.72);
    if (sh > H * 0.68) (sh = Math.round(H * 0.68)), (sw = Math.round(sh / 0.72));
    const sx = Math.round(W / 2 - sw / 2);
    const sy = Math.round(H * 0.46 - sh / 2);
    this.screen = { x: sx, y: sy, w: sw, h: sh };

    // Console shelf under the monitor.
    const deskY = sy + sh + 12;
    R(0, deskY, W, H - deskY, '#0b0f1a');
    R(0, deskY, W, 1, '#3a4560');
    R(0, deskY + 1, W, 1, '#182033');
    for (let x = 8; x < W - 8; x += 22) R(x, deskY + 6, 12, 2, x % 44 === 8 ? '#2c6f73' : '#1b2232');

    // Bezel: rounded steel with a lilac elbow down the left and an amber cap top right.
    const b = 7;
    R(sx - b, sy - b + 2, sw + b * 2, sh + b * 2 - 4, '#1b2232');
    R(sx - b + 2, sy - b, sw + b * 2 - 4, sh + b * 2, '#1b2232');
    R(sx - b + 2, sy - b, sw + b * 2 - 4, 1, '#4a556e');
    R(sx - b + 2, sy + sh + b - 1, sw + b * 2 - 4, 1, '#0a0d16');
    R(sx - b, sy + 6, 3, Math.round(sh * 0.55), '#b79cf0');
    R(sx - b, sy - b + 2, 16, 3, '#b79cf0');
    R(sx + sw - 30, sy - b + 2, 22, 3, '#f0a24a');
    R(sx + sw + b - 3, sy + sh - 30, 3, 22, '#6fe0ee');
    // Stand.
    R(Math.round(W / 2) - 14, sy + sh + b, 28, deskY - (sy + sh + b), '#141a29');
    R(Math.round(W / 2) - 22, deskY - 2, 44, 2, '#2a3552');
    // Screen.
    R(sx, sy, sw, sh, '#061a1c');
    this.back.set(c, W / 2, Math.min(90, W * 0.3));

    // Face: the 16px drone at the largest whole scale that leaves room for the voice trace.
    this.k = Math.max(2, Math.floor((sh * 0.7) / 16));
    this.face.scale.set(this.k);
    this.face.position.set(Math.round(sx + sw / 2 - 8 * this.k), Math.round(sy + sh * 0.42 - 8 * this.k));

    const s = canvas(sw, sh);
    for (let y = 0; y < sh; y += 2) (s.g.fillStyle = 'rgba(0,0,0,0.32)'), s.g.fillRect(0, y, sw, 1);
    // Corner vignette: the glass curves away.
    const v = s.g.createRadialGradient(sw / 2, sh / 2, sh * 0.35, sw / 2, sh / 2, sw * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    s.g.fillStyle = v;
    s.g.fillRect(0, 0, sw, sh);
    this.scan.texture?.destroy(true);
    this.scan.texture = texOf(s.c);
    this.scan.position.set(sx, sy);

    this.glow.position.set(sx + sw / 2, sy + sh / 2);
    this.glow.width = sw * 1.6;
    this.glow.height = sh * 1.6;
    this.lamp.width = this.lamp.height = 14;
    this.lamp.position.set(sx + sw - 26, sy - b - 4);
  }

  update(dt: number) {
    this.t += dt;
    const quiet = calm();
    this.back.update(this.t, quiet);
    const waiting = commsUnread.peek() > 0 || commsQueue.peek().length > 0;
    const thinking = pipThinking.peek();
    const mood = pipMood.peek() !== 'calm' ? pipMood.peek() : waiting ? 'alarm' : 'calm';
    const talking = thinking || mood === 'talk';
    const { x, y, w, h } = this.screen;

    // Face: hover bob, faster when talking.
    const fr = quiet ? 0 : Math.floor(this.t * (talking ? 5 : 1.5)) % 2;
    const key = `${fr}:${mood}`;
    if (key !== this.faceKey) {
      this.faceKey = key;
      drawPip(this.faceCanvas, fr, mood, 1);
      if (!this.faceReady) (this.face.texture = texOf(this.faceCanvas)), (this.faceReady = true);
      else this.face.texture.source.update();
    }

    // Blink: lids in screen colour over the eye rows for a few frames.
    const g0 = this.lids.clear();
    if (!quiet && this.t > this.blinkAt) {
      if (this.t > this.blinkAt + 0.14) this.blinkAt = this.t + 2 + Math.random() * 4;
      else g0.rect(this.face.x + 4 * this.k, this.face.y + (6 + fr) * this.k, 8 * this.k, 3 * this.k).fill(0x2c3563);
    }

    // Voice trace across the bottom of the screen.
    const g = this.crt.clear();
    const amp = talking ? h * 0.07 : waiting ? h * 0.05 : h * 0.012;
    const mid = y + Math.round(h * 0.86);
    const color = mood === 'alarm' ? 0xff7aa8 : mood === 'grin' ? 0x9be37a : 0x3fc6c9;
    for (let i = 4; i < w - 4; i++) {
      const p = quiet ? i * 0.15 : i * 0.15 + this.t * (talking ? 12 : 4);
      const v = Math.sin(p) * Math.sin(p * 0.31 + this.t) * amp;
      g.rect(x + i, mid + Math.round(v), 1, 1).fill({ color, alpha: 0.9 });
    }
    g.rect(x + 4, mid, w - 8, 1).fill({ color, alpha: 0.15 });
    if (fx()) g.rect(x, y, w, h).fill({ color, alpha: 0.035 + (talking ? 0.02 * Math.sin(this.t * 9) : 0) });
    this.glow.tint = color;
    this.glow.alpha = fx() ? 0.18 + (talking ? 0.06 : 0) : 0;
    this.lamp.alpha = waiting ? (quiet ? 1 : Math.sin(this.t * 6) > 0 ? 1 : 0.15) : 0.1;
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

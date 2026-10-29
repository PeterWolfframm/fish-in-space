// PIP: the radio corner. A CRT with a scrolling waveform and scanlines, a dish readout, the signal
// lamp that blinks when a call is waiting, and PIP hovering by the set.

import { Container, Graphics, Sprite } from 'pixi.js';
import { commsUnread, commsQueue } from '../../store/signals';
import { calm, fx, type Scene } from '../stage';
import { Backdrop, hullWall } from '../room';
import { canvas, texOf, glowTexture } from '../paint';
import { drawPip } from '../../art/characters';

export class PipScene implements Scene {
  root = new Container();
  private back = new Backdrop();
  private crt = new Graphics();
  private scan = new Sprite();
  private lamp = new Sprite(glowTexture(24, 4));
  private pip = new Sprite();
  private pipCanvas = document.createElement('canvas');
  private pipFrame = -1;
  private pipReady = false;
  private t = 0;
  private screen = { x: 0, y: 0, w: 0, h: 0 };

  fps = () => 30;

  constructor() {
    this.lamp.tint = 0xff7aa8;
    this.lamp.blendMode = 'add';
    this.root.addChild(this.back.root, this.crt, this.scan, this.lamp, this.pip);
  }

  resize(W: number, H: number) {
    const { c, g } = hullWall(W, H, 29);
    // The radio desk.
    const deskY = H - 14 - Math.round(H * 0.22);
    g.fillStyle = '#3a2a22';
    g.fillRect(0, deskY, W, H - 14 - deskY);
    g.fillStyle = '#5a4030';
    g.fillRect(0, deskY, W, 2);
    // Knobs and a speaker grille on the set.
    const sw = Math.min(150, Math.round(W * 0.5));
    const sh = Math.min(80, Math.round(H * 0.5));
    const sx = Math.round(W / 2 - sw / 2);
    const sy = deskY - sh;
    g.fillStyle = '#2c3563';
    g.fillRect(sx - 4, sy - 4, sw + 8, sh + 4);
    g.fillStyle = '#c9cfe6';
    g.fillRect(sx - 4, sy - 4, sw + 8, 1);
    g.fillStyle = '#0a1a12';
    this.screen = { x: sx + 4, y: sy + 2, w: Math.round(sw * 0.66), h: sh - 10 };
    g.fillRect(this.screen.x, this.screen.y, this.screen.w, this.screen.h);
    const kx = this.screen.x + this.screen.w + 6;
    for (let i = 0; i < 3; i++) {
      g.fillStyle = '#7d8aa0';
      g.fillRect(kx, sy + 6 + i * 14, 8, 8);
      g.fillStyle = '#ffb86b';
      g.fillRect(kx + 3, sy + 7 + i * 14, 2, 3);
    }
    for (let y = sy + 50; y < sy + sh - 6; y += 3) {
      g.fillStyle = '#161b36';
      g.fillRect(kx - 2, y, sw - this.screen.w - 12, 1);
    }
    // A dish sketch on the wall.
    g.strokeStyle = '#2c3563';
    g.beginPath();
    g.arc(30, 30, 16, 0.2 * Math.PI, 1.2 * Math.PI);
    g.stroke();
    g.fillStyle = '#2c3563';
    g.fillRect(29, 30, 2, 18);
    this.back.set(c, W / 2, Math.min(90, W * 0.3));
    // Scanlines over the screen.
    const s = canvas(this.screen.w, this.screen.h);
    for (let y = 0; y < this.screen.h; y += 2) {
      s.g.fillStyle = 'rgba(0,0,0,0.35)';
      s.g.fillRect(0, y, this.screen.w, 1);
    }
    this.scan.texture?.destroy(true);
    this.scan.texture = texOf(s.c);
    this.scan.position.set(this.screen.x, this.screen.y);
    this.lamp.width = this.lamp.height = 14;
    this.lamp.position.set(kx - 3, sy - 14);
  }

  update(dt: number) {
    this.t += dt;
    const quiet = calm();
    this.back.update(this.t, quiet);
    const waiting = commsUnread.peek() > 0 || commsQueue.peek().length > 0;
    const { x, y, w, h } = this.screen;
    const g = this.crt.clear();
    // Waveform: calm static, or a busy voice when a call waits.
    const amp = waiting ? h * 0.32 : h * 0.08;
    const mid = y + Math.round(h / 2);
    for (let i = 0; i < w; i++) {
      const p = quiet ? i * 0.2 : i * 0.2 + this.t * 6;
      const v = Math.sin(p) * Math.sin(p * 0.37 + 1) * amp + (waiting ? Math.sin(p * 2.3) * amp * 0.3 : 0);
      g.rect(x + i, mid + Math.round(v), 1, 1).fill({ color: 0x9be37a, alpha: 0.9 });
    }
    g.rect(x, mid, w, 1).fill({ color: 0x9be37a, alpha: 0.15 });
    if (fx()) g.rect(x, y, w, h).fill({ color: 0x9be37a, alpha: 0.04 });
    this.lamp.alpha = waiting ? (quiet ? 1 : Math.sin(this.t * 6) > 0 ? 1 : 0.15) : 0.1;

    // PIP bobs at the left of the set.
    const fr = quiet ? 0 : Math.floor(this.t * 2) % 2;
    if (fr !== this.pipFrame) {
      this.pipFrame = fr;
      drawPip(this.pipCanvas, fr, waiting ? 'alarm' : 'calm', 1);
      if (!this.pipReady) {
        this.pip.texture = texOf(this.pipCanvas);
        this.pipReady = true;
      } else this.pip.texture.source.update();
    }
    this.pip.scale.set(2);
    this.pip.position.set(Math.max(4, x - 46), y + 4);
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

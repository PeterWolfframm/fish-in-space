// A thin glass rim at the edges of the world. The lid, tray, deck and plinth are gone:
// the water fills the tank, and the camera only shows glass.

import { Container, Graphics } from 'pixi.js';
import type { HatcheryLayout } from './layout';

export class LabFrame {
  back = new Container();
  frame = new Container();
  private rim = new Graphics();
  private L!: HatcheryLayout;

  constructor() {
    this.frame.addChild(this.rim);
  }

  resize(L: HatcheryLayout) {
    this.L = L;
    this.paint();
  }

  update(_t: number, _night: number, _calm: boolean) {
    /* The rim does not animate. */
  }

  private paint() {
    const L = this.L;
    if (!L) return;
    const g = this.rim.clear();
    const t = L.tank;
    g.rect(t.x, t.y, t.w, 1).fill({ color: 0xd2f5ff, alpha: 0.45 });
    g.rect(t.x, t.y + t.h - 1, t.w, 1).fill({ color: 0xd2f5ff, alpha: 0.28 });
    g.rect(t.x, t.y, 1, t.h).fill({ color: 0xd2f5ff, alpha: 0.55 });
    g.rect(t.x + t.w - 1, t.y, 1, t.h).fill({ color: 0xd2f5ff, alpha: 0.4 });
  }
}

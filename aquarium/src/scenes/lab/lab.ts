// The Lab: the Prof at a bench, a slowly turning double strand in a glass column. When two parents are
// picked in the panel, the strand's rungs take their colours.

import { Container, Graphics } from 'pixi.js';
import { game, labPair } from '../../store/signals';
import * as W from '../../game';
import { calm, fx, type Scene } from '../stage';
import { Backdrop, Figure, hullWall } from '../room';

const ALLELE_COL = [0x3fc6c9, 0x9be37a, 0xffb86b, 0xff7aa8, 0xc9a8ff, 0xf3ead8];
const colOf = (allele: string | undefined) => {
  if (!allele) return 0x7d8aa0;
  let h = 0;
  for (const ch of allele) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ALLELE_COL[h % ALLELE_COL.length];
};

export class LabScene implements Scene {
  root = new Container();
  private back = new Backdrop();
  private prof = new Figure('prof');
  private strand = new Graphics();
  private W = 360;
  private H = 150;
  private t = 0;
  private col = { x: 0, y: 0, w: 0, h: 0 };

  fps = () => 30;

  constructor() {
    this.prof.scale = 2;
    this.root.addChild(this.back.root, this.prof.root, this.strand);
  }

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
    const { c, g } = hullWall(W, H, 41);
    const benchY = H - 14 - Math.round(H * 0.2);
    g.fillStyle = '#c9cfe6';
    g.fillRect(0, benchY, W, 2);
    g.fillStyle = '#2a2f4f';
    g.fillRect(0, benchY + 2, W, H - 16 - benchY);
    // Flasks on the bench.
    const flasks = ['#3fc6c9', '#9be37a', '#ff7aa8'];
    flasks.forEach((f, i) => {
      const x = 14 + i * 14;
      g.fillStyle = 'rgba(243,234,216,0.35)';
      g.fillRect(x, benchY - 12, 8, 12);
      g.fillRect(x + 2, benchY - 17, 4, 5);
      g.fillStyle = f;
      g.globalAlpha = 0.7;
      g.fillRect(x + 1, benchY - 7, 6, 6);
      g.globalAlpha = 1;
    });
    // The glass column.
    const cw = 34;
    const ch = Math.max(40, benchY - 16);
    this.col = { x: Math.round(W * 0.5 - cw / 2), y: 10, w: cw, h: ch - 4 };
    g.fillStyle = 'rgba(63,198,201,0.08)';
    g.fillRect(this.col.x, this.col.y, cw, this.col.h);
    g.fillStyle = 'rgba(243,234,216,0.4)';
    g.fillRect(this.col.x, this.col.y, 1, this.col.h);
    g.fillRect(this.col.x + cw - 1, this.col.y, 1, this.col.h);
    g.fillStyle = '#7d8aa0';
    g.fillRect(this.col.x - 3, this.col.y - 3, cw + 6, 3);
    g.fillRect(this.col.x - 3, this.col.y + this.col.h, cw + 6, 4);
    this.back.set(c, W * 0.5, Math.min(90, W * 0.3));
  }

  update(dt: number) {
    this.t += dt;
    const quiet = calm();
    this.back.update(this.t, quiet);
    const benchY = this.H - 14 - Math.round(this.H * 0.2);
    this.prof.root.position.set(Math.round(this.W * 0.78 - this.prof.w / 2), benchY - this.prof.h + 12);
    this.prof.update(dt, this.t, false, quiet);

    // Parent alleles colour the rungs: one side per parent.
    const s = game.peek();
    const [a, b] = labPair.peek();
    const fa = a ? s.fish.find((f) => f.id === a) : undefined;
    const fb = b ? s.fish.find((f) => f.id === b) : undefined;
    const al = fa ? W.allelesOf(fa.code) : [];
    const bl = fb ? W.allelesOf(fb.code) : [];

    const g = this.strand.clear();
    const { x, y, w, h } = this.col;
    const cx = x + w / 2;
    const amp = w / 2 - 5;
    const turn = quiet ? 0.6 : this.t * 0.8;
    const rungs = Math.floor(h / 6);
    for (let i = 0; i < rungs; i++) {
      const yy = y + 4 + i * 6;
      const ph = i * 0.55 + turn;
      const x1 = cx + Math.sin(ph) * amp;
      const x2 = cx - Math.sin(ph) * amp;
      const front = Math.cos(ph) > 0;
      const ca = colOf(al[i % Math.max(1, al.length)] as string | undefined);
      const cb = colOf(bl[i % Math.max(1, bl.length)] as string | undefined);
      const lo = Math.min(x1, x2);
      const hi = Math.max(x1, x2);
      const midX = (x1 + x2) / 2;
      g.rect(Math.round(lo), yy, Math.max(1, Math.round(midX - lo)), 1).fill({ color: x1 < x2 ? ca : cb, alpha: front ? 0.9 : 0.35 });
      g.rect(Math.round(midX), yy, Math.max(1, Math.round(hi - midX)), 1).fill({ color: x1 < x2 ? cb : ca, alpha: front ? 0.9 : 0.35 });
      g.rect(Math.round(x1), yy - 1, 2, 3).fill({ color: 0xf3ead8, alpha: front ? 1 : 0.4 });
      g.rect(Math.round(x2), yy - 1, 2, 3).fill({ color: 0xf3ead8, alpha: front ? 0.4 : 1 });
    }
    // Bubbles rising in the column.
    if (fx() && !quiet) {
      for (let i = 0; i < 5; i++) {
        const by = y + h - ((this.t * 9 + i * 23) % h);
        g.rect(x + 3 + ((i * 7) % (w - 6)), Math.round(by), 1, 1).fill({ color: 0xbff4f5, alpha: 0.6 });
      }
    }
  }

  destroy() {
    this.prof.destroy();
    this.root.destroy({ children: true });
  }
}

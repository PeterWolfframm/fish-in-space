// The Lab: two small breeding aquariums on a bench with a turning double helix between them, and the Prof
// keeping an eye on things. The tanks are the interface: tap one to choose who goes in it, tap the heart
// on the helix to pair them, tap the lineage chart on the wall for genetics. Mature fish that have bred
// leave still polaroids plastered on the wall; tap one for that fish's card. Pairing drops a quilted blanket over both tanks ("gosh, give them
// some privacy"), it wiggles, hearts rise, it lifts, and a heart pops.

import { Container, Graphics, Sprite } from 'pixi.js';
import { game, labPair, labPick, labBusy, labSpawn, setLabSheet, openBreeder, onScene } from '../../store/signals';
import * as W from '../../game';
import { sheet, retain, release, type Sheet } from '../../art/atlas';
import { alleleNum } from '../../ui/genes';
import { calm, fx, stage, type Scene } from '../stage';
import { Backdrop, Figure, hullWall } from '../room';
import { PolaroidWall } from './polaroids';

const BLANKET_T = 3.4;
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

interface Tank {
  x: number;
  y: number;
  w: number;
  h: number;
}

const LINE_H = 34;
const WALL = 58;

/** One breeding tank's occupant: a baked swim strip that paces the glass. */
class Occupant {
  sprite = new Sprite();
  code = '';
  private s: Sheet | null = null;
  private f = 0;
  private x = 0.5;
  private dir = 1;
  private t = Math.random() * 6;

  set(code: string) {
    if (code === this.code) return;
    if (this.s) release(this.s);
    this.s = null;
    this.code = code;
    this.sprite.visible = false;
  }

  update(dt: number, tank: Tank, quiet: boolean) {
    if (!this.code) return void (this.sprite.visible = false);
    if (!this.s) {
      this.s = sheet('fish4', this.code, 'swim');
      if (!this.s) return;
      retain(this.s);
    }
    const s = this.s;
    this.t += dt;
    this.f += quiet ? 0 : dt * s.fps;
    this.sprite.texture = s.frames[Math.floor(this.f) % s.n];
    // Pixel art stays at 1× unless the tank has plenty of room.
    const k = s.w * 2 < tank.w * 0.7 && s.h * 2 < tank.h * 0.6 ? 2 : 1;
    const span = Math.max(0, tank.w - s.w * k - 10);
    if (!quiet) {
      this.x += (this.dir * dt * 9) / Math.max(20, span);
      if (this.x > 1) (this.x = 1), (this.dir = -1);
      if (this.x < 0) (this.x = 0), (this.dir = 1);
    }
    const bob = quiet ? 0 : Math.sin(this.t * 1.7) * 2;
    const cx = tank.x + 5 + span * this.x + (s.w * k) / 2;
    const cy = tank.y + tank.h * 0.52 + bob;
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(this.dir * k, k);
    this.sprite.position.set(Math.round(cx), Math.round(cy));
    this.sprite.visible = true;
  }

  destroy() {
    if (this.s) release(this.s);
  }
}

export class LabScene implements Scene {
  root = new Container();
  private back = new Backdrop();
  private prof = new Figure('prof');
  private glassBack = new Graphics();
  private fish = [new Occupant(), new Occupant()];
  private glassFront = new Graphics();
  private strand = new Graphics();
  private lineage = new Graphics();
  private polaroids = new PolaroidWall();
  private bench = new Graphics();
  private blanket = new Graphics();
  private W = 360;
  private H = 150;
  private t = 0;
  private benchY = 120;
  private tanks: Tank[] = [];
  private col = { x: 0, y: 0, w: 0, h: 0 };
  private lineageBox: Tank | null = null;
  private wall: Tank | null = null;
  private heartBox: Tank | null = null;
  private cover = -1; // seconds into the blanket, or -1
  private said = false;
  private popped = false;
  private off: () => void;

  fps = () => (this.cover >= 0 || this.fish.some((f) => f.code) ? 60 : 30);

  constructor() {
    this.prof.scale = 2;
    this.root.addChild(
      this.back.root,
      this.polaroids.root,
      this.prof.root,
      this.glassBack,
      ...this.fish.map((f) => f.sprite),
      this.glassFront,
      this.strand,
      this.lineage,
      this.bench,
      this.blanket,
    );
    this.off = onScene((e) => {
      if (e.kind !== 'blanket') return;
      this.cover = calm() ? BLANKET_T - 0.4 : 0;
      this.said = this.popped = false;
    });
  }

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
    this.benchY = H - 14 - Math.round(H * 0.14);
    const { c, g } = hullWall(W, H, 41);
    // Reagent bottles sit left of the lineage chart when the wall is wide enough.
    const lineX = W > 280 ? 72 : 8;
    if (W > 280) {
      g.fillStyle = '#1d2540';
      g.fillRect(8, 26, 58, 2);
      ['#3ee6f5', '#6ff28a', '#ffb3c9', '#ffd84a', '#c79bff'].forEach((col, i) => {
        g.fillStyle = 'rgba(232,238,252,0.25)';
        g.fillRect(11 + i * 11, 15, 7, 11);
        g.fillStyle = col;
        g.globalAlpha = 0.65;
        g.fillRect(12 + i * 11, 19, 5, 6);
        g.globalAlpha = 1;
        g.fillStyle = '#c3cde6';
        g.fillRect(13 + i * 11, 13, 3, 2);
      });
    }
    this.back.set(c, W * 0.5, Math.min(110, W * 0.34));

    // Two tanks with the helix column between them, centred; the Prof gets the right-hand margin.
    // Polaroids are plastered on the wall under the lineage chart and above the helix.
    const colW = 22;
    const gap = colW + 14;
    const tw = Math.max(64, Math.min(124, Math.floor((W - gap - 24) * 0.36)));
    const topReserve = 6 + LINE_H + WALL + 8;
    const th = Math.max(36, Math.min(this.benchY - topReserve, Math.round(tw * 0.72)));
    const left = Math.round(W * 0.46 - gap / 2 - tw);
    const ty = this.benchY - th - 3;
    this.tanks = [
      { x: left, y: ty, w: tw, h: th },
      { x: left + tw + gap, y: ty, w: tw, h: th },
    ];
    this.col = { x: left + tw + Math.round((gap - colW) / 2), y: ty - 6, w: colW, h: th + 3 };
    this.lineageBox = { x: lineX, y: 6, w: Math.max(48, W - lineX - 8), h: LINE_H };
    const wallTop = 6 + LINE_H + 4;
    const right = Math.min(W - 6, this.tanks[1].x + this.tanks[1].w + 6);
    this.wall = { x: 6, y: wallTop, w: Math.max(48, right - 6), h: Math.max(24, this.col.y - 6 - wallTop) };
    this.paintStatic();
    this.polaroids.place(this.wall);
  }

  /** Glass, water and gravel behind the fish; frame and highlights in front. Repainted on resize and when
   *  occupants change, since the empty tank shows a different face. */
  private paintStatic() {
    const b = this.glassBack.clear();
    const f = this.glassFront.clear();
    this.tanks.forEach((k) => {
      // Water: a cool gradient, darker at depth.
      const bands = 6;
      for (let i = 0; i < bands; i++) {
        const y0 = k.y + 4 + Math.floor(((k.h - 4) * i) / bands);
        const y1 = k.y + 4 + Math.floor(((k.h - 4) * (i + 1)) / bands);
        b.rect(k.x, y0, k.w, y1 - y0).fill({ color: [0x154a62, 0x12405a, 0x0f3550, 0x0c2c46, 0x0a243c, 0x081d33][i], alpha: 0.92 });
      }
      b.rect(k.x, k.y + 4, k.w, 1).fill({ color: 0xaef4ff, alpha: 0.5 });
      // Gravel and a couple of sprigs.
      b.rect(k.x, k.y + k.h - 5, k.w, 5).fill(0x3a3550);
      for (let x = k.x + 1; x < k.x + k.w - 1; x += 3) b.rect(x, k.y + k.h - 5 + ((x * 7) % 3), 2, 1).fill({ color: 0x7d7aa0, alpha: 0.8 });
      for (const sx of [k.x + 6, k.x + k.w - 10]) {
        for (let i = 0; i < 10; i++) b.rect(sx + Math.round(Math.sin(i * 0.8) * 1.5), k.y + k.h - 6 - i * 2, 2, 2).fill({ color: i % 3 ? 0x4fb874 : 0x6ff28a, alpha: 0.9 });
      }
      // Frame: a brushed rim, a lid with a lamp strip, a little stand.
      f.rect(k.x - 2, k.y, k.w + 4, 4).fill(0x2a3456);
      f.rect(k.x - 2, k.y, k.w + 4, 1).fill(0x8a96bd);
      f.rect(k.x + 4, k.y + 3, k.w - 8, 1).fill({ color: 0xaef4ff, alpha: 0.9 });
      f.rect(k.x - 2, k.y + 4, 2, k.h - 4).fill(0x232c4a);
      f.rect(k.x + k.w, k.y + 4, 2, k.h - 4).fill(0x232c4a);
      f.rect(k.x - 3, k.y + k.h, k.w + 6, 3).fill(0x2a3456);
      f.rect(k.x - 3, k.y + k.h, k.w + 6, 1).fill(0x8a96bd);
      // Glass glint.
      f.rect(k.x + 3, k.y + 7, 1, Math.round(k.h * 0.4)).fill({ color: 0xffffff, alpha: 0.18 });
      f.rect(k.x + 5, k.y + 7, 1, Math.round(k.h * 0.2)).fill({ color: 0xffffff, alpha: 0.1 });
    });
    // Helix column: a glass tube on brass end caps.
    const { x, y, w, h } = this.col;
    b.rect(x, y, w, h).fill({ color: 0x3ee6f5, alpha: 0.07 });
    f.rect(x, y, 1, h).fill({ color: 0xe8eefc, alpha: 0.35 });
    f.rect(x + w - 1, y, 1, h).fill({ color: 0xe8eefc, alpha: 0.35 });
    f.rect(x - 3, y - 3, w + 6, 3).fill(0x8a96bd);
    f.rect(x - 3, y + h, w + 6, 3).fill(0x8a96bd);
  }

  tap(x: number, y: number) {
    if (labBusy.peek()) return;
    const shot = this.polaroids.hit(x, y);
    if (shot) {
      openBreeder(shot.id, shot.code, shot.name);
      return;
    }
    const line = this.lineageBox;
    if (line && x >= line.x && x < line.x + line.w && y >= line.y && y < line.y + line.h) {
      setLabSheet('genes');
      return;
    }
    const heart = this.heartBox;
    if (heart && x >= heart.x && x < heart.x + heart.w && y >= heart.y && y < heart.y + heart.h) {
      setLabSheet(null);
      labSpawn();
      return;
    }
    const i = this.tanks.findIndex((k) => x >= k.x - 3 && x < k.x + k.w + 3 && y >= k.y - 4 && y < k.y + k.h + 6);
    if (i < 0) return;
    const side = i as 0 | 1;
    setLabSheet(labPick.peek() === side ? null : 'pick', side);
  }

  update(dt: number) {
    this.t += dt;
    const quiet = calm();
    this.back.update(this.t, quiet);
    if (this.tanks.length < 2) return;
    const s = game.peek();
    const pair = labPair.peek();
    const pick = labPick.peek();
    const fishOf = (id: string | null) => (id ? s.fish.find((f) => f.id === id) : undefined);
    const parents = [fishOf(pair[0]), fishOf(pair[1])];
    parents.forEach((p, i) => {
      this.fish[i].set(p?.code ?? '');
      this.fish[i].update(dt, this.tanks[i], quiet);
    });
    this.polaroids.sync();
    if (this.wall) this.polaroids.place(this.wall);
    this.drawLineage();

    // The Prof at the right edge, talking while the blanket is down.
    const covering = this.cover >= 0 && this.cover < BLANKET_T;
    this.prof.root.position.set(Math.round(Math.min(this.W - this.prof.w + 6, this.tanks[1].x + this.tanks[1].w + 8)), this.benchY - this.prof.h + 14);
    this.prof.update(dt, this.t, covering && this.cover > 0.7 && this.cover < 2.6, quiet);

    // Bench front, over the Prof's legs.
    const bn = this.bench.clear();
    bn.rect(0, this.benchY, this.W, 2).fill(0xc3cde6);
    bn.rect(0, this.benchY + 2, this.W, this.H - 14 - this.benchY - 2).fill(0x1d2540);
    bn.rect(0, this.benchY + 2, this.W, 1).fill(0x3a4568);
    for (let x = 10; x < this.W; x += 46) bn.rect(x, this.benchY + 5, 14, 2).fill({ color: [0xffa53d, 0xb48cff, 0x6aa8ff][(x / 46) % 3 | 0], alpha: 0.8 });

    // Per tank: a plate lamp (pink female, blue male), an empty-tank plus, a pick highlight, bubbles.
    const st = this.strand.clear();
    this.tanks.forEach((k, i) => {
      const p = parents[i];
      const sex = p ? W.genomeOf(p.code).sex : null;
      const lamp = sex === 'f' ? 0xffa8c4 : sex === 'm' ? 0x6aa8ff : 0x5d6a8a;
      st.rect(k.x + k.w / 2 - 6, this.benchY + 6, 12, 3).fill({ color: lamp, alpha: p ? 1 : 0.5 });
      if (!p) {
        const a = quiet ? 0.7 : 0.45 + 0.35 * Math.sin(this.t * 3 + i);
        const cx = Math.round(k.x + k.w / 2);
        const cy = Math.round(k.y + k.h / 2);
        st.rect(cx - 6, cy - 1, 13, 3).fill({ color: 0xe8eefc, alpha: a });
        st.rect(cx - 1, cy - 6, 3, 13).fill({ color: 0xe8eefc, alpha: a });
      }
      if (pick === i) {
        const a = quiet ? 0.9 : 0.6 + 0.4 * Math.sin(this.t * 6);
        st.rect(k.x - 4, k.y - 2, k.w + 8, 1).fill({ color: 0xffa53d, alpha: a });
        st.rect(k.x - 4, k.y + k.h + 4, k.w + 8, 1).fill({ color: 0xffa53d, alpha: a });
        st.rect(k.x - 4, k.y - 2, 1, k.h + 7).fill({ color: 0xffa53d, alpha: a });
        st.rect(k.x + k.w + 3, k.y - 2, 1, k.h + 7).fill({ color: 0xffa53d, alpha: a });
      }
      if (fx() && !quiet) {
        for (let b = 0; b < 3; b++) {
          const by = k.y + k.h - 6 - ((this.t * 11 + b * 17 + i * 9) % (k.h - 12));
          st.rect(k.x + k.w - 14 + ((b * 3) % 5), Math.round(by), 1, 1).fill({ color: 0xbff4f5, alpha: 0.7 });
        }
      }
    });

    // The helix: one side per parent, coloured by each parent's alleles. Spins faster under the blanket.
    const al = parents[0] ? W.allelesOf(parents[0].code) : [];
    const bl = parents[1] ? W.allelesOf(parents[1].code) : [];
    const { x, y, w, h } = this.col;
    const cx = x + w / 2;
    const amp = w / 2 - 4;
    const turn = quiet ? 0.6 : this.t * (covering ? 3 : 0.8);
    const rungs = Math.floor((h - 6) / 5);
    for (let i = 0; i < rungs; i++) {
      const yy = y + 4 + i * 5;
      const ph = i * 0.6 + turn;
      const x1 = cx + Math.sin(ph) * amp;
      const x2 = cx - Math.sin(ph) * amp;
      const front = Math.cos(ph) > 0;
      const ca = al.length ? alleleNum(al[i % 2]) : 0x5d6a8a;
      const cb = bl.length ? alleleNum(bl[i % 2]) : 0x5d6a8a;
      const lo = Math.min(x1, x2);
      const hi = Math.max(x1, x2);
      const mid = (x1 + x2) / 2;
      st.rect(Math.round(lo), yy, Math.max(1, Math.round(mid - lo)), 1).fill({ color: x1 < x2 ? ca : cb, alpha: front ? 0.95 : 0.35 });
      st.rect(Math.round(mid), yy, Math.max(1, Math.round(hi - mid)), 1).fill({ color: x1 < x2 ? cb : ca, alpha: front ? 0.95 : 0.35 });
      st.rect(Math.round(x1), yy - 1, 2, 3).fill({ color: 0xe8eefc, alpha: front ? 1 : 0.4 });
      st.rect(Math.round(x2), yy - 1, 2, 3).fill({ color: 0xe8eefc, alpha: front ? 0.4 : 1 });
    }

    // The pair control lives on the helix, once both tanks have a fish.
    this.heartBox = null;
    if (parents[0] && parents[1] && this.cover < 0) {
      const hx = Math.round(cx - 3);
      const hy = Math.round(y + h / 2 - 4);
      const pulse = quiet ? 1 : 0.7 + 0.3 * Math.sin(this.t * 4);
      this.heart(st, hx, hy, 0xff6b8b, pulse);
      this.heartBox = { x: hx - 6, y: hy - 4, w: 20, h: 18 };
    }

    this.drawBlanket(dt, quiet);
  }

  /** Compact family tree on the wall. Tap opens the genetics sheet. */
  private drawLineage() {
    const g = this.lineage.clear();
    const box = this.lineageBox;
    if (!box) return;
    g.roundRect(box.x, box.y, box.w, box.h, 2).fill({ color: 0x12182c, alpha: 0.92 });
    g.rect(box.x, box.y, box.w, 1).fill({ color: 0xc79bff, alpha: 0.75 });
    g.rect(box.x, box.y + box.h - 1, box.w, 1).fill({ color: 0x3a4568, alpha: 0.9 });
    const nodes = W.lineageNodes(game.peek());
    if (!nodes.length) return;
    const gens = [...new Set(nodes.map((n) => n.gen))].sort((a, b) => a - b);
    const rows = gens.map((gen) => nodes.filter((n) => n.gen === gen));
    const idNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;
    const pos = new Map<string, { x: number; y: number }>();
    const pad = 6;
    rows.forEach((row, ri) => {
      if (ri === 0) row.sort((a, b) => idNum(a.id) - idNum(b.id));
      else {
        const bary = (n: (typeof nodes)[number]) => {
          const xs = n.parents.map((p) => pos.get(p.id)?.x).filter((v): v is number => v !== undefined);
          return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 1e6 + idNum(n.id);
        };
        row.sort((a, b) => bary(a) - bary(b));
      }
      const yy = box.y + pad + ((ri + 0.55) * (box.h - pad * 2)) / rows.length;
      row.forEach((n, i) => {
        pos.set(n.id, { x: box.x + pad + ((i + 0.5) * (box.w - pad * 2)) / row.length, y: yy });
      });
    });
    for (const n of nodes) {
      if (n.parents.length !== 2) continue;
      const child = pos.get(n.id);
      if (!child) continue;
      const got = W.handedDown(n.code, n.parents[0].code, n.parents[1].code);
      n.parents.forEach((p, i) => {
        const from = pos.get(p.id);
        if (!from) return;
        g.moveTo(from.x, from.y).lineTo(child.x, child.y).stroke({ color: alleleNum(got[i]), width: 1, alpha: 0.9 });
      });
    }
    for (const n of nodes) {
      const p = pos.get(n.id);
      if (!p) continue;
      const [a] = W.allelesOf(n.code);
      g.rect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3).fill({ color: alleleNum(a), alpha: n.alive ? 1 : 0.4 });
    }
  }

  private drawBlanket(dt: number, quiet: boolean) {
    const g = this.blanket.clear();
    if (this.cover < 0) return;
    this.cover += dt;
    const k = this.cover;
    const [a, b] = this.tanks;
    const x0 = a.x - 4;
    const x1 = b.x + b.w + 4;
    // From the helix cap and the lids down over the glass to the bench.
    const top = Math.min(a.y, this.col.y) - 2;
    const bottom = this.benchY + 1;
    const full = Math.max(1, bottom - top);
    // Drop with a little bounce, hold and wiggle, then lift away.
    let drop: number;
    if (k < 0.55) {
      const u = k / 0.55;
      drop = u * u * (1 + 0.12 * Math.sin(u * Math.PI));
    } else if (k < 2.75) drop = 1;
    else drop = Math.max(0, 1 - ((k - 2.75) / 0.5) ** 2);
    const bounce = k < 0.7 && k > 0.55 ? Math.sin((k - 0.55) * 40) * 2 : 0;
    const hem = Math.round(Math.min(bottom + 2, Math.max(top, top + full * Math.min(1, drop) + bounce)));

    if (drop > 0 && hem > top) {
      const wig = k > 0.6 && k < 2.75 && !quiet;
      const w = x1 - x0;
      const span = hem - top;
      // Body: lilac and peach quilt squares with stitching, lumped where the fish are busy underneath.
      const sq = 9;
      for (let yy = top; yy < hem; yy += sq) {
        for (let xx = x0; xx < x1; xx += sq) {
          const ix = Math.floor((xx - x0) / sq);
          const iy = Math.floor((yy - top) / sq);
          const lump = wig ? Math.round(Math.sin(this.t * 9 + ix * 0.9) * Math.sin(this.t * 5.3 + iy) * 1.4) : 0;
          const col = (ix + iy) % 2 ? 0xb48cff : 0xf6c38d;
          g.rect(xx, yy + lump, Math.min(sq, x1 - xx), Math.min(sq, hem - yy)).fill(col);
          g.rect(xx, yy + lump, Math.min(sq, x1 - xx), 1).fill({ color: 0xffffff, alpha: 0.18 });
          if ((ix + iy) % 2 === 0) g.rect(xx + 4, yy + lump + 4, 1, 1).fill({ color: 0x8a5cd8, alpha: 0.7 });
        }
      }
      // Side shading so it reads as cloth draped over two boxes.
      g.rect(x0, top, 2, span).fill({ color: 0x04050b, alpha: 0.25 });
      g.rect(x1 - 2, top, 2, span).fill({ color: 0x04050b, alpha: 0.25 });
      const dip = Math.round(this.col.x + this.col.w / 2);
      g.rect(dip - 1, top + 8, 3, Math.max(0, span - 12)).fill({ color: 0x04050b, alpha: 0.16 });
      // Scalloped hem.
      for (let xx = x0; xx < x1; xx += 4) g.rect(xx, hem, 3, 2).fill(0xff8fb8);
      // A wiggle now and then: the cloth bunches at the lids.
      if (wig && Math.sin(this.t * 2.4) > 0.92) g.rect(x0 + w * 0.3, top - 2, w * 0.4, 2).fill(0xb48cff);

      // Hearts drifting up from the lids.
      if (wig && fx()) {
        for (let i = 0; i < 4; i++) {
          const u = ((k - 0.6) * 0.6 + i * 0.27) % 1;
          const hx = x0 + w * (0.2 + 0.2 * i) + Math.sin(u * 8 + i) * 4;
          const hy = top - 4 - u * 28;
          this.heart(g, Math.round(hx), Math.round(hy), 0xff6b8b, 1 - u);
        }
      }
    }
    if (k > 0.8 && !this.said) {
      this.said = true;
      stage.callout((x0 + x1) / 2, top - 4, 'gosh, give them some privacy.', '#f6c38d');
    }
    // Lift-off: a big heart pops where the blanket was.
    if (k > 3.15) {
      const u = Math.min(1, (k - 3.15) / 0.6);
      const cx = Math.round((x0 + x1) / 2);
      const cy = Math.round(top + full * 0.4 - u * 8);
      const s = 1 + Math.round((1 - (1 - u) * (1 - u)) * 2);
      this.heart(g, cx - Math.floor((7 * s) / 2), cy, 0xff6b8b, 1 - u * 0.8, s);
      if (!this.popped) {
        this.popped = true;
        stage.callout(cx, cy - 4, '♡ eggs laid', '#ffa8c4');
      }
    }
    if (k > 3.9) this.cover = -1;
  }

  private heart(g: Graphics, x: number, y: number, col: number, alpha: number, s = 1) {
    HEART.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') g.rect(x + i * s, y + j * s, s, s).fill({ color: col, alpha: Math.max(0, alpha) });
    });
  }

  destroy() {
    this.off();
    this.polaroids.destroy();
    this.fish.forEach((f) => f.destroy());
    this.prof.destroy();
    this.root.destroy({ children: true });
  }
}

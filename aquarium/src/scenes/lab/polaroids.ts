// Still polaroids of fish that have bred, stuck at random on the Lab wall.
// A frame appears only once that fish is adult or elder, and it keeps the mature snapshot.
// Tap one to open that fish's card.

import { Container, Graphics, Sprite } from 'pixi.js';
import { game } from '../../store/signals';
import * as W from '../../game';
import { load, release, retain, sheet, type Sheet } from '../../art/atlas';

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Shot {
  code: string;
  name: string;
}

interface Polaroid {
  id: string;
  code: string;
  name: string;
  root: Container;
  frame: Graphics;
  photo: Sprite;
  sheet: Sheet | null;
  tilt: number;
}

const TAPES = [0xffa53d, 0xb48cff, 0xf6c38d, 0x8fd4ff];

function mature(code: string) {
  const stage = W.stageOf(code);
  return stage === 'adult' || stage === 'elder';
}

/** Parent id → the mature snapshot kept on the wall, name included so a departed fish still has a card. */
export function breederShots(): Map<string, Shot> {
  const s = game.peek();
  const out = new Map<string, Shot>();
  const note = (id: string, code: string, name: string) => {
    if (out.has(id)) return;
    const live = s.fish.find((f) => f.id === id);
    const use = mature(code) ? code : live && mature(live.code) ? live.code : null;
    if (!use) return;
    out.set(id, { code: use, name: live ? W.fishName(live) : name });
  };
  for (const egg of s.eggs) egg.parents?.forEach((p) => note(p.id, p.code, p.name));
  for (const f of s.fish) f.parents?.forEach((p) => note(p.id, p.code, p.name));
  return out;
}

function hash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function tiltFor(id: string) {
  return ((hash(id) % 17) - 8) * 0.03;
}

export class PolaroidWall {
  root = new Container();
  private items = new Map<string, Polaroid>();

  constructor() {
    this.root.sortableChildren = true;
  }

  sync() {
    const want = breederShots();
    for (const id of [...this.items.keys()]) if (!want.has(id)) this.drop(id);
    for (const [id, shot] of want) {
      let p = this.items.get(id);
      if (!p) {
        p = this.make(id, shot);
        this.items.set(id, p);
        this.root.addChild(p.root);
        void this.bindPhoto(p);
      } else if (p.code !== shot.code || p.name !== shot.name) {
        const recode = p.code !== shot.code;
        p.code = shot.code;
        p.name = shot.name;
        if (recode) void this.bindPhoto(p);
      }
    }
  }

  /** Scatter each frame on the plaster wall; spot is stable per fish id. */
  place(wall: Wall) {
    if (wall.w < 8 || wall.h < 8) return;
    for (const p of this.items.values()) {
      const h = hash(p.id);
      const fit = Math.min(0.55, (wall.h - 2) / 48, wall.w / 48);
      const scale = Math.max(0.36, fit) * (0.88 + (h % 14) / 80);
      const fw = 36 * scale;
      const top = 38 * scale;
      const bottom = 6 * scale;
      const u = ((h >>> 8) & 1023) / 1023;
      const v = ((h >>> 18) & 1023) / 1023;
      const x = wall.x + fw / 2 + u * Math.max(0, wall.w - fw);
      const y = wall.y + top + v * Math.max(0, wall.h - top - bottom);
      p.root.scale.set(scale);
      p.root.position.set(Math.round(x), Math.round(y));
      p.root.rotation = p.tilt;
      p.root.zIndex = h % 997;
      p.root.eventMode = 'none';
    }
  }

  /** Front-most polaroid under a tap, if any. The test is in the frame's own space, so tilt counts. */
  hit(x: number, y: number): Polaroid | null {
    let best: Polaroid | null = null;
    let z = -1;
    for (const p of this.items.values()) {
      const local = p.root.toLocal({ x, y });
      if (local.x < -22 || local.x > 22 || local.y < -42 || local.y > 10) continue;
      if (p.root.zIndex >= z) {
        best = p;
        z = p.root.zIndex;
      }
    }
    return best;
  }

  destroy() {
    for (const p of this.items.values()) if (p.sheet) release(p.sheet);
    this.items.clear();
  }

  private make(id: string, shot: Shot): Polaroid {
    const root = new Container();
    const frame = new Graphics();
    const photo = new Sprite();
    photo.anchor.set(0.5, 1);
    root.addChild(frame, photo);
    const p: Polaroid = {
      id,
      code: shot.code,
      name: shot.name,
      root,
      frame,
      photo,
      sheet: null,
      tilt: tiltFor(id),
    };
    this.paintFrame(p);
    return p;
  }

  private async bindPhoto(p: Polaroid) {
    if (p.sheet) release(p.sheet);
    p.sheet = null;
    const hit = sheet('fish4', p.code, 'swim');
    const s = hit ?? (await load('fish4', p.code, 'swim'));
    if (!s || !this.items.has(p.id) || this.items.get(p.id)!.code !== p.code) {
      if (s && !hit) release(s);
      return;
    }
    retain(s);
    p.sheet = s;
    p.photo.texture = s.frames[0];
    const scale = Math.min(1.6, 20 / Math.max(s.w, s.h));
    p.photo.scale.set(scale);
    p.photo.anchor.set(0.5, 1);
    p.photo.position.set(0, -10);
    this.paintFrame(p);
  }

  private paintFrame(p: Polaroid) {
    const w = 36;
    const h = 44;
    const g = p.frame.clear();
    g.roundRect(-w / 2, -h + 6, w, h, 2).fill({ color: 0xf4f0e8 });
    g.roundRect(-w / 2 + 3, -h + 9, w - 6, h - 16, 1).fill({ color: 0x9fd4ea });
    g.rect(-6, -h + 2, 12, 5).fill({ color: TAPES[hash(p.id) % TAPES.length], alpha: 0.9 });
  }

  private drop(id: string) {
    const p = this.items.get(id);
    if (!p) return;
    if (p.sheet) release(p.sheet);
    p.root.destroy({ children: true });
    this.items.delete(id);
  }
}

// Decor plants from the generators, scaled by integers only and cropped from the top when too tall.
// `?plants=debug` draws each plant's box and size class so the table is easy to tune.

import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { sheet, onSheet, keyOf, retain, release, type Sheet } from '../../art/atlas';
import { plantSize } from '../../game/plants';
import type { DecorSlot } from '../../game/types';
import { slotPos, type HatcheryLayout } from './layout';

/** Generator size class → integer display scale and max height in tank pixels. */
export const PLANT_SCALE: Record<'waterplant2' | 'plant3', Record<string, { scale: number; maxH: number }>> = {
  waterplant2: {
    small: { scale: 1, maxH: 32 },
    medium: { scale: 1, maxH: 48 },
    large: { scale: 1, maxH: 80 },
    huge: { scale: 1, maxH: 110 },
  },
  plant3: {
    herb: { scale: 1, maxH: 24 },
    shrub: { scale: 1, maxH: 30 },
    tall: { scale: 1, maxH: 40 },
    tree: { scale: 1, maxH: 44 },
    giant: { scale: 1, maxH: 48 },
  },
};

export const plantsDebug = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('plants') === 'debug';

const ANIM = { waterplant2: 'sway', plant3: 'idle' } as const;

interface PlantActor {
  slot: number;
  family: DecorSlot['family'];
  code: string;
  size: string;
  sprite: Sprite;
  frames: Texture[] | null;
  sheet: Sheet | null;
  fps: number;
  t: number;
  x: number;
  y: number;
  back: boolean;
  ledge: boolean;
  maxH: number;
}

export class Plants {
  back = new Container();
  front = new Container();
  ledge = new Container();
  debug = new Graphics();
  private actors = new Map<number, PlantActor>();
  private L!: HatcheryLayout;
  private off: () => void;
  readonly showDebug = plantsDebug();
  labels: { x: number; y: number; text: string }[] = [];

  constructor() {
    this.off = onSheet(() => this.bindAll());
  }

  resize(L: HatcheryLayout) {
    this.L = L;
    for (const a of this.actors.values()) this.place(a);
  }

  sync(decor: DecorSlot[]) {
    const live = new Set<number>();
    for (const d of decor) {
      live.add(d.slot);
      const a = this.actors.get(d.slot);
      if (a && a.code === d.code) continue;
      if (a) this.remove(a);
      const size = plantSize(d.family, d.code);
      const fresh: PlantActor = { slot: d.slot, family: d.family, code: d.code, size, sprite: new Sprite(), frames: null, sheet: null, fps: 6, t: d.slot * 1.7, x: 0, y: 0, back: true, ledge: false, maxH: 40 };
      fresh.sprite.anchor.set(0.5, 1);
      this.actors.set(d.slot, fresh);
      this.place(fresh);
      this.bind(fresh);
    }
    for (const [slot, a] of this.actors) if (!live.has(slot)) this.remove(a);
  }

  private remove(a: PlantActor) {
    a.sprite.destroy();
    a.frames?.forEach((f) => f.destroy());
    if (a.sheet) release(a.sheet);
    this.actors.delete(a.slot);
  }

  private place(a: PlantActor) {
    if (!this.L) return;
    const p = slotPos(this.L, a.slot);
    a.x = p.x;
    a.y = p.y;
    a.back = p.back;
    a.ledge = p.ledge;
    const row = PLANT_SCALE[a.family][a.size] ?? { scale: 1, maxH: 48 };
    // Never taller than the space it lives in.
    const room = p.ledge ? this.L.lidY - 3 : this.L.sandY - this.L.water.y - 6;
    a.maxH = Math.min(row.maxH, room);
    a.sprite.scale.set(row.scale);
    a.sprite.position.set(a.x, a.y);
    const layer = p.ledge ? this.ledge : p.back ? this.back : this.front;
    if (a.sprite.parent !== layer) layer.addChild(a.sprite);
    if (a.sheet) this.crop(a);
  }

  private bindAll() {
    for (const a of this.actors.values()) if (!a.sheet) this.bind(a);
  }

  private bind(a: PlantActor) {
    const s = sheet(a.family, a.code, ANIM[a.family]);
    if (!s) return;
    a.sheet = s;
    a.fps = s.fps;
    retain(s);
    this.crop(a);
  }

  /** Frames cropped from the top to fit maxH (in display pixels). */
  private crop(a: PlantActor) {
    const s = a.sheet!;
    const scale = a.sprite.scale.y;
    const h = Math.min(s.h, Math.floor(a.maxH / scale));
    a.frames?.forEach((f) => f.destroy());
    a.frames = h === s.h ? null : s.frames.map((f) => new Texture({ source: f.source, frame: new Rectangle(f.frame.x, s.h - h, s.w, h) }));
    a.sprite.texture = (a.frames ?? s.frames)[0];
  }

  /** Which slot a tap lands on (for placing cuttings), by distance to the slot's base. */
  slotAt(x: number, y: number, slots: number[]): number | null {
    let best: number | null = null;
    let bd = 14;
    for (const slot of slots) {
      const p = slotPos(this.L, slot);
      const d = Math.hypot(p.x - x, (p.y - y) * 0.5);
      if (d < bd) (bd = d), (best = slot);
    }
    return best;
  }

  update(dt: number, calm: boolean) {
    const g = this.debug;
    if (this.showDebug) g.clear();
    this.labels = [];
    for (const a of this.actors.values()) {
      const frames = a.frames ?? a.sheet?.frames;
      if (frames) {
        a.t += dt * a.fps * (calm ? 0.25 : 1);
        a.sprite.texture = frames[Math.floor(a.t) % frames.length];
      }
      if (this.showDebug && a.sheet) {
        const w = a.sprite.texture.frame.width * a.sprite.scale.x;
        const h = a.sprite.texture.frame.height * a.sprite.scale.y;
        g.rect(Math.round(a.x - w / 2), a.y - h, w, h).stroke({ color: a.frames ? 0xff7aa8 : 0x9be37a, width: 1, alpha: 0.9 });
        this.labels.push({ x: a.x, y: a.y - h - 2, text: `${a.slot}:${a.size}${a.frames ? ' ✂' : ''}` });
      }
    }
  }

  /** Empty slots get a faint marker while a cutting is being placed. */
  drawSlots(g: Graphics, slots: number[], t: number) {
    for (const slot of slots) {
      const p = slotPos(this.L, slot);
      const a = 0.4 + 0.3 * Math.sin(t * 5);
      g.rect(p.x - 4, p.y - 1, 9, 1).fill({ color: 0x9be37a, alpha: a });
      g.rect(p.x, p.y - 6, 1, 4).fill({ color: 0x9be37a, alpha: a });
      g.rect(p.x - 2, p.y - 4, 5, 1).fill({ color: 0x9be37a, alpha: a });
    }
  }

  destroy() {
    this.off();
    for (const a of [...this.actors.values()]) this.remove(a);
  }
}

export const plantKey = (d: DecorSlot) => keyOf(d.family, d.code, ANIM[d.family]);

// Fish actors: steering toward targets in their depth band, chasing food when hungry, swim and
// eat animations from the baked strips, mirrored when swimming left.

import { Container, Sprite } from 'pixi.js';
import { sheet, retain, release, type Sheet } from '../../art/atlas';
import { ecoOf, genomeOf, stageOf } from '../../game/fish';
import type { Fish } from '../../game/types';
import type { HatcheryLayout } from './layout';

export const BAND: Record<string, [number, number]> = { top: [0.06, 0.34], mid: [0.22, 0.66], bottom: [0.6, 0.9], above: [0.03, 0.26] };

export interface Food {
  x: number;
  y: number;
  vy: number;
  age: number;
  eaten?: boolean;
}

export class FishActor {
  id: string;
  code = '';
  fish!: Fish;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  dir = Math.random() < 0.5 ? 1 : -1;
  t = Math.random() * 8;
  tx = 0;
  ty = 0;
  pause = 0;
  eatUntil = 0;
  band: [number, number] = BAND.mid;
  speed = 14;
  glow = false;
  sprite = new Sprite();
  halo: Sprite;
  swim: Sheet | null = null;
  eat: Sheet | null = null;
  w = 16;
  h = 10;

  constructor(f: Fish, L: HatcheryLayout, halo: Sprite) {
    this.id = f.id;
    this.halo = halo;
    const band = BAND[ecoOf(f.code).level] ?? BAND.mid;
    this.x = f.x != null ? L.water.x + f.x * L.water.w : L.water.x + 20 + Math.random() * (L.water.w - 40);
    this.y = f.x != null ? L.sandY - 8 : L.water.y + L.water.h * (band[0] + Math.random() * (band[1] - band[0]));
    this.setFish(f, L);
    this.pickTarget(L);
  }

  setFish(f: Fish, L: HatcheryLayout) {
    this.fish = f;
    if (this.code === f.code) return;
    this.code = f.code;
    this.band = BAND[ecoOf(f.code).level] ?? BAND.mid;
    this.speed = stageOf(f.code) === 'fry' ? 20 : 12 + Math.random() * 8;
    const glow = genomeOf(f.code).glow;
    this.glow = glow === 'edge' || glow === 'full';
    this.drop();
    this.bind();
    this.y = Math.min(this.y, L.sandY - 4);
  }

  bind() {
    if (!this.swim && (this.swim = sheet('fish3', this.code, 'swim'))) retain(this.swim);
    if (!this.eat && (this.eat = sheet('fish3', this.code, 'eat'))) retain(this.eat);
  }

  private drop() {
    if (this.swim) release(this.swim);
    if (this.eat) release(this.eat);
    this.swim = this.eat = null;
  }

  pickTarget(L: HatcheryLayout) {
    this.tx = L.water.x + 12 + Math.random() * (L.water.w - 24);
    this.ty = Math.min(L.sandY - 6, L.water.y + L.water.h * (this.band[0] + Math.random() * (this.band[1] - this.band[0])));
  }

  steer(dt: number, time: number, L: HatcheryLayout, food: Food[], onBite: (a: FishActor) => void) {
    const hungry = this.fish.hunger > 0.12;
    let target: Food | null = null;
    if (hungry && food.length) {
      let d = Infinity;
      for (const p of food) {
        if (p.eaten) continue;
        const dd = Math.hypot(p.x - this.x, p.y - this.y);
        if (dd < d) (d = dd), (target = p);
      }
      if (target && d < 4) {
        target.eaten = true;
        this.eatUntil = time + 0.9;
        onBite(this);
        target = null;
      }
    }
    let speed = this.speed;
    let tx = this.tx;
    let ty = this.ty;
    if (target) (tx = target.x), (ty = target.y), (speed *= 2.1);
    else if (this.pause > 0) {
      this.pause -= dt;
      this.vx *= 0.95;
      this.vy *= 0.95;
      return;
    } else if (Math.hypot(tx - this.x, ty - this.y) < 6) {
      this.pickTarget(L);
      if (Math.random() < 0.4) this.pause = 0.8 + Math.random() * 2.5;
    }
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, dt * 2.2);
    this.vx += ((dx / d) * speed - this.vx) * k;
    this.vy += ((dy / d) * speed * 0.6 - this.vy) * k;
  }

  update(dt: number, time: number, L: HatcheryLayout, night: number, glowFx: boolean) {
    this.x = Math.max(L.water.x + 6, Math.min(L.water.x + L.water.w - 6, this.x + this.vx * dt));
    this.y = Math.max(L.water.y + 6, Math.min(L.sandY - 4, this.y + this.vy * dt));
    if (this.vx > 3) this.dir = 1;
    else if (this.vx < -3) this.dir = -1;
    if (!this.swim || !this.eat) this.bind();
    const s = (this.eatUntil > time && this.eat) || this.swim;
    const pace = this.pause > 0 ? 0.45 : 0.6 + Math.min(1, Math.hypot(this.vx, this.vy) / 25);
    this.t += dt * (s?.fps ?? 10) * pace;
    const bob = Math.round(Math.sin(time * 2 + this.t * 0.3) * (this.pause > 0 ? 1 : 0.5));
    if (s) {
      this.w = s.w;
      this.h = s.h;
      this.sprite.texture = s.frames[Math.floor(this.t) % s.n];
      this.sprite.visible = true;
    } else this.sprite.visible = false;
    const x = Math.round(this.x - this.w / 2);
    this.sprite.scale.x = this.dir;
    this.sprite.position.set(this.dir < 0 ? x + this.w : x, Math.round(this.y - this.h / 2) + bob);
    this.halo.visible = this.glow && glowFx && night > 0.15;
    if (this.halo.visible) {
      this.halo.position.set(Math.round(this.x), Math.round(this.y));
      this.halo.width = this.halo.height = this.w * 1.6;
      this.halo.alpha = night * (0.6 + 0.2 * Math.sin(time * 2 + this.t * 0.1));
    }
  }

  hit(x: number, y: number) {
    const hw = this.w * 0.45 + 3;
    const hh = this.h * 0.45 + 3;
    const dx = Math.abs(x - this.x);
    const dy = Math.abs(y - this.y);
    return dx < hw && dy < hh ? dx + dy : Infinity;
  }

  destroy(parent?: Container) {
    this.drop();
    parent?.removeChild(this.sprite);
    this.sprite.destroy();
    this.halo.destroy();
  }
}

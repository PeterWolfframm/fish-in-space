// The hatchery scene: space and the planet behind the glass, the lab hardware, and the tank with its
// fish, plants, food, bubbles, eggs and effects. The store is the source of truth: the scene reads it each frame and reports taps and bites.

import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { game, selected, pairWith, placing, selectFish, biteFish, tapEgg, placeCutting, onScene, orbit, activeTank, tankPan, type SceneEvent } from '../../store/signals';
import { sfx, unlock } from '../../audio/sfx';
import { LEDGE_SLOTS, WATER_SLOTS } from '../../game/state';
import { regionLive } from '../life';
import { canvas, texOf, lcg, glowTexture, rayTexture, PATTERNS } from '../paint';
import { stage, fx, calm, type Scene } from '../stage';
import { layout, SAND, type HatcheryLayout } from './layout';

// The tank never pans vertically: it always fits the screen top to bottom.
const PAN_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  KeyA: [-1, 0], KeyD: [1, 0],
};
const PAN_SPEED = 220;

function typingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
import { LabFrame } from './labframe';
import { SpaceView } from './spaceview';
import { Plants } from './plants';
import { FishActor, type Food } from './fish';
import { loadPlanet } from '../../planet/load';

interface Bubble {
  x: number;
  y: number;
  r: number;
  ph: number;
}
interface Fx {
  kind: 'heart' | 'spark';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}
interface Pod {
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  sprite: Sprite;
}

function causticTexture(seed: number) {
  const N = 64;
  const { c, g } = canvas(N, N);
  const r = lcg(seed);
  const ph = [r() * 6, r() * 6, r() * 6];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x / N) * Math.PI * 2;
      const v = (y / N) * Math.PI * 2;
      const a = Math.sin(u * 2 + Math.sin(v * 3 + ph[0]) * 1.2 + ph[1]);
      const b = Math.sin(v * 2 + Math.sin(u * 3 + ph[2]) * 1.2);
      const k = Math.abs(a + b);
      if (k < 0.16) {
        g.fillStyle = k < 0.07 ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)';
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  return texOf(c);
}

function paintWater(L: HatcheryLayout) {
  const { x, y, w, h } = L.water;
  const { c, g } = canvas(w, h);
  // The surface stays clear enough for the planet to read through; the depths are a tank, not open space.
  const top = [28, 110, 150, 0.34];
  const bot = [4, 32, 64, 0.82];
  const bands = 16;
  for (let i = 0; i < bands; i++) {
    const k = (i / (bands - 1)) ** 1.25;
    const [r, gg, b, a] = top.map((v, j) => v + (bot[j] - v) * k);
    g.fillStyle = `rgba(${Math.round(r)},${Math.round(gg)},${Math.round(b)},${a.toFixed(3)})`;
    const y0 = Math.floor((i * h) / bands);
    g.fillRect(0, y0, w, Math.floor(((i + 1) * h) / bands) - y0);
  }
  const sandY = L.sandY - y;
  const rock = (rx: number, rw: number, rh: number, col: string) => {
    g.fillStyle = col;
    for (let i = 0; i < rw; i++) {
      const k = i / rw;
      const hh = Math.round(rh * Math.sin(Math.PI * k) ** 0.6 + (i % 7 === 0 ? 1 : 0));
      g.fillRect(Math.round(rx) + i, sandY - hh + 2, 1, hh);
    }
  };
  rock(w * 0.05, 70, 26, 'rgba(10,34,58,0.7)');
  rock(w * 0.55, 90, 34, 'rgba(10,34,58,0.7)');
  rock(w * 0.3, 50, 16, 'rgba(18,52,76,0.8)');
  rock(w * 0.78, 40, 20, 'rgba(18,52,76,0.8)');
  g.fillStyle = '#cdbd97';
  g.fillRect(0, sandY, w, SAND);
  g.fillStyle = '#e6dbbd';
  g.fillRect(0, sandY, w, 1);
  const r = lcg(7);
  for (let i = 0; i < w * 1.4; i++) {
    g.fillStyle = r() < 0.5 ? '#b2a27e' : '#ddd0ae';
    g.fillRect(Math.floor(r() * w), sandY + 1 + Math.floor(r() * (SAND - 1)), 1, 1);
  }
  for (let i = 0; i < w / 30; i++) {
    const px = Math.floor(r() * w);
    g.fillStyle = ['#a7a2b5', '#c98f7a', '#8fb3a7'][i % 3];
    g.fillRect(px, sandY + 2 + Math.floor(r() * 6), 3, 2);
    g.fillRect(px + 1, sandY + 1 + Math.floor(r() * 6), 1, 1);
  }
  // The airstone.
  g.fillStyle = '#7d8aa0';
  g.fillRect(w - 25, sandY - 2, 9, 4);
  g.fillStyle = '#a4b2c6';
  g.fillRect(w - 24, sandY - 2, 7, 1);
  // A gentle vignette, in bands.
  for (let i = 0; i < 4; i++) {
    g.fillStyle = 'rgba(3,6,14,0.08)';
    g.fillRect(0, 0, 3 + i * 3, h);
    g.fillRect(w - 3 - i * 3, 0, 3 + i * 3, h);
  }
  // Air gap above the surface, and the surface line.
  return { tex: texOf(c), x, y };
}

export class HatcheryScene implements Scene {
  root = new Container();
  private world = new Container();
  private L!: HatcheryLayout;
  private frame = new LabFrame();
  private space = new SpaceView();
  private plants = new Plants();
  private water = new Sprite();
  private rays: Sprite[] = [];
  private caustics: TilingSprite[];
  private fishLayer = new Container();
  private halos = new Container();
  private dyn = new Graphics(); // eggs, food, pods' bubbles
  private top = new Graphics(); // bubbles, particles, marks, glass
  private night = new Graphics();
  private tankGlow = new Graphics();
  private podLayer = new Container();
  private actors = new Map<string, FishActor>();
  private food: Food[] = [];
  private bubbles: Bubble[] = [];
  private fxs: Fx[] = [];
  private pods: Pod[] = [];
  private time = 0;
  private lastBite = 0;
  private glowTex = glowTexture(32, 5);
  private off: () => void;
  private debugTexts: string[] = [];
  // Several tanks share the scene; one is in view. The dots switch tanks. Drag, keys and the wheel pan.
  private tankId = activeTank.peek();
  private size = { W: 0, H: 0 };
  private curtain = new Graphics();
  private swapT = 0;
  private recenter = true;
  private cam = { x: 0, y: 0 };
  private camTarget = { x: 0, y: 0 };
  private vel = { x: 0, y: 0 };
  private dragging = false;
  private gliding = false;
  private held = new Set<string>();
  private keysOn = false;

  constructor() {
    const ray = rayTexture(64, 8);
    for (let i = 0; i < 4; i++) {
      const s = new Sprite(ray);
      s.blendMode = 'add';
      s.tint = 0xd8f6ff;
      this.rays.push(s);
    }
    this.caustics = [causticTexture(5), causticTexture(9)].map((texture) => {
      const t = new TilingSprite({ texture, width: 10, height: 10 });
      t.blendMode = 'add';
      t.alpha = 0.035;
      return t;
    });
    this.tankGlow.blendMode = 'add';
    this.world.addChild(
      this.night,
      this.frame.back,
      this.plants.ledge,
      this.water,
      ...this.rays,
      ...this.caustics,
      this.plants.back,
      this.dyn,
      this.halos,
      this.fishLayer,
      this.podLayer,
      this.plants.front,
      this.top,
      this.tankGlow,
      this.frame.frame,
      this.plants.debug,
    );
    // Space and the swap curtain stay locked to the viewport. The tank slides under the camera.
    this.root.addChild(this.space.root, this.world, this.curtain);
    this.off = onScene((e) => this.onEvent(e));
    void loadPlanet(game.peek().planet).then((p) => this.space.setPlanet(p));
  }

  private shape() {
    return game.peek().tanks.find((k) => k.id === this.tankId)?.shape ?? '1x2';
  }

  /** Bring another tank into view: relayout for its shape and let the old tank's life fall away. */
  private switchTank(id: string) {
    this.tankId = id;
    this.food = [];
    this.bubbles = [];
    this.fxs = [];
    for (const a of [...this.actors.values()]) this.removeActor(a);
    this.swapT = 0.35;
    this.recenter = true;
    if (this.size.W) this.resize(this.size.W, this.size.H);
  }

  drag(dx: number, dy: number) {
    this.dragging = true;
    this.gliding = false;
    this.camTarget.x -= dx;
    this.camTarget.y -= dy;
    this.clampCam();
  }

  dragEnd() {
    this.dragging = false;
    if (calm()) {
      this.cam.x = this.camTarget.x;
      this.cam.y = this.camTarget.y;
      this.vel.x = this.vel.y = 0;
      return;
    }
    // Finish the eased lag, then coast.
    this.vel.x += (this.camTarget.x - this.cam.x) * 8;
    this.vel.y += (this.camTarget.y - this.cam.y) * 8;
    this.limitVel();
  }

  wheel(dx: number, dy: number) {
    this.gliding = true;
    this.vel.x = this.vel.y = 0;
    this.camTarget.x += dx * 0.55;
    this.camTarget.y += dy * 0.55;
    this.clampCam();
  }

  resize(W: number, H: number) {
    const prev = this.L;
    let fracX = 0.5;
    let fracY = 1;
    if (prev && !this.recenter) {
      const maxX = Math.max(1, prev.W - prev.viewW);
      const maxY = Math.max(1, prev.H - prev.viewH);
      fracX = this.cam.x / maxX;
      fracY = this.cam.y / maxY;
    }
    this.recenter = false;
    this.size = { W, H };
    this.L = layout(W, H, this.shape());
    const L = this.L;
    this.water.texture?.destroy(true);
    const wtr = paintWater(L);
    this.water.texture = wtr.tex;
    this.water.position.set(wtr.x, wtr.y);
    this.frame.resize(L);
    this.space.resize(L);
    this.plants.resize(L);
    for (const c of this.caustics) {
      c.position.set(L.water.x, L.water.y);
      c.width = L.water.w;
      c.height = L.sandY - L.water.y + 2;
    }
    this.rays.forEach((s, i) => {
      s.height = L.sandY - L.water.y;
      s.width = 14 + i * 4;
      s.skew.x = -0.25 - i * 0.03;
    });
    for (const a of this.actors.values()) {
      a.x = Math.min(a.x, L.water.x + L.water.w - 10);
      a.y = Math.min(a.y, L.sandY - 6);
      a.pickTarget(L);
    }
    const maxX = Math.max(0, L.W - L.viewW);
    const maxY = Math.max(0, L.H - L.viewH);
    this.cam.x = maxX * fracX;
    this.cam.y = maxY * fracY;
    this.camTarget.x = this.cam.x;
    this.camTarget.y = this.cam.y;
    this.vel.x = this.vel.y = 0;
    this.applyCam();
  }

  show() {
    this.listenKeys(true);
    if (activeTank.peek() !== this.tankId) this.switchTank(activeTank.peek());
    this.plants.sync(this.decorHere());
  }

  hide() {
    this.listenKeys(false);
    this.held.clear();
    this.dragging = false;
  }

  private decorHere() {
    return game.peek().decor.filter((d) => d.tank === this.tankId);
  }

  private eggsHere() {
    return game.peek().eggs.filter((g) => g.tank === this.tankId);
  }

  // --- input ------------------------------------------------------------------------------------

  tap(x: number, y: number) {
    unlock();
    const w = this.toWorld(x, y);
    x = w.x;
    y = w.y;
    const L = this.L;
    const s = game.peek();
    if (placing.peek() != null) {
      const c = s.ownedCuttings[placing.peek()!];
      const slots = c?.family === 'plant3' ? LEDGE_SLOTS : WATER_SLOTS;
      const slot = this.plants.slotAt(x, y, slots);
      if (slot != null) return placeCutting(slot);
      return;
    }
    let best: FishActor | null = null;
    let bd = Infinity;
    for (const a of this.actors.values()) {
      const d = a.hit(x, y);
      if (d < bd) (bd = d), (best = a);
    }
    if (best) return selectFish(best.id);
    const egg = this.eggsHere().find((g) => Math.abs(L.water.x + g.x * L.water.w - x) < 8 && y > L.sandY - 12 && y < L.sandY + 4);
    if (egg) return tapEgg(egg);
    if (x > L.water.x && x < L.water.x + L.water.w && y > L.water.y - 4 && y < L.sandY) {
      this.dropFood(x, y);
      sfx.plip();
      if (selected.peek()) selectFish(null);
    }
  }

  dropFood(x: number, y: number, n = 4) {
    const L = this.L;
    for (let i = 0; i < n; i++) {
      this.food.push({ x: Math.max(L.water.x + 4, Math.min(L.water.x + L.water.w - 4, x + (Math.random() - 0.5) * 16)), y: Math.max(L.water.y + 1, y - Math.random() * 6), vy: 6 + Math.random() * 4, age: 0 });
    }
    if (this.food.length > 60) this.food = this.food.slice(-60);
  }

  // --- events from the store ----------------------------------------------------------------------

  private burst(x: number, y: number, kind: Fx['kind'], n = 6) {
    for (let i = 0; i < n; i++) {
      this.fxs.push({ kind, x: x + (Math.random() - 0.5) * (n > 1 ? 14 : 0), y, vx: (Math.random() - 0.5) * (n > 1 ? 20 : 4), vy: -10 - Math.random() * 12, life: 1.2, max: 1.2 });
    }
    if (this.fxs.length > 200) this.fxs = this.fxs.slice(-200);
  }

  private onEvent(e: SceneEvent) {
    if (!this.L) return;
    const L = this.L;
    const a = 'fishId' in e ? this.actors.get(e.fishId) : undefined;
    switch (e.kind) {
      case 'hatched': {
        if (game.peek().fish.find((f) => f.id === e.fishId)?.tank !== this.tankId) break;
        const x = L.water.x + e.x * L.water.w;
        this.burst(x, L.sandY - 4, 'spark', 8);
        for (let i = 0; i < 6; i++) this.bubbles.push({ x: x + (Math.random() - 0.5) * 8, y: L.sandY - 2, r: Math.random() < 0.3 ? 2 : 1, ph: Math.random() * 6 });
        break;
      }
      case 'feedAll':
        for (let i = 0; i < 6; i++) this.dropFood(L.water.x + 20 + Math.random() * (L.water.w - 40), L.water.y + 2, 3);
        break;
      case 'hearts':
        if (a) this.burst(a.x, a.y - 6, 'heart', 5);
        break;
      case 'say':
        if (a) {
          const p = this.toScreen(a.x, a.y - a.h / 2 - 4);
          stage.callout(p.x, p.y, e.text, e.color);
        }
        break;
      case 'sold':
        if (a) {
          this.burst(a.x, a.y, 'spark', 8);
          this.removeActor(a);
        }
        break;
      case 'launch': {
        // A capsule closes around the fish, sinks through the floor hatch, and streaks out the window.
        setTimeout(() => this.space.launch(), 600);
        if (!a) break; // launched from another tank: only the trail to the planet shows
        const sp = new Sprite(a.sprite.texture);
        const w = Math.max(14, a.w + 6);
        const h = Math.max(10, a.h + 6);
        this.removeActor(a);
        this.podLayer.addChild(sp);
        this.pods.push({ x: a.x, y: a.y, w, h, t: 0, sprite: sp });
        break;
      }
    }
  }

  private removeActor(a: FishActor) {
    this.fishLayer.removeChild(a.sprite);
    this.halos.removeChild(a.halo);
    a.destroy();
    this.actors.delete(a.id);
  }

  // --- frame ------------------------------------------------------------------------------------------

  private sync() {
    const s = game.peek();
    if (activeTank.peek() !== this.tankId) this.switchTank(activeTank.peek());
    const live = new Set<string>();
    const sel = selected.peek();
    for (const f of s.fish) {
      if (f.tank !== this.tankId) continue;
      live.add(f.id);
      let a = this.actors.get(f.id);
      if (!a) {
        const halo = new Sprite(this.glowTex);
        halo.anchor.set(0.5);
        halo.blendMode = 'add';
        halo.tint = 0x7ee8ff;
        a = new FishActor(f, this.L, halo);
        this.actors.set(f.id, a);
        this.fishLayer.addChild(a.sprite);
        this.halos.addChild(halo);
      } else a.setFish(f, this.L);
      a.focused = f.id === sel;
    }
    for (const a of [...this.actors.values()]) if (!live.has(a.id)) this.removeActor(a);
    // Small fish on top.
    this.fishLayer.children.sort((p, q) => q.width - p.width);
    this.plants.sync(this.decorHere());
  }

  update(dt: number) {
    if (!this.L) return;
    const L = this.L;
    this.time += dt;
    const t = this.time;
    const quiet = calm();
    const effects = fx();
    const o = orbit.peek();
    const nightK = 1 - o.light;
    this.sync();
    this.stepCamera(dt);

    for (const a of this.actors.values()) {
      a.steer(dt, t, L, this.food, (who) => {
        biteFish(who.id);
        this.burst(who.x, who.y - who.h / 2, 'heart', 1);
        if (performance.now() - this.lastBite > 120) (this.lastBite = performance.now()), sfx.bite();
      });
      a.update(dt, t, L, nightK, effects);
    }
    for (const p of this.food) {
      p.age += dt;
      if (p.y < L.sandY + 2) p.y += p.vy * dt;
      p.x += Math.sin(p.age * 2 + p.vy) * dt * 3;
    }
    this.food = this.food.filter((p) => !p.eaten && p.age < 25);
    const stoneX = L.water.x + L.water.w - 22;
    if (!quiet && Math.random() < dt * 2.2) this.bubbles.push({ x: stoneX + Math.random() * 4, y: L.sandY, r: Math.random() < 0.25 ? 2 : 1, ph: Math.random() * 6 });
    for (const b of this.bubbles) (b.y -= (14 + b.r * 6) * dt), (b.x += Math.sin(t * 3 + b.ph) * dt * 4);
    this.bubbles = this.bubbles.filter((b) => b.y > L.water.y);
    for (const f of this.fxs) (f.x += f.vx * dt), (f.y += f.vy * dt), (f.vy *= 0.97), (f.life -= dt);
    this.fxs = this.fxs.filter((f) => f.life > 0);
    for (const p of this.pods) p.t += dt;
    for (const p of this.pods.filter((x) => x.t > 1.2)) p.sprite.destroy();
    this.pods = this.pods.filter((p) => p.t <= 1.2);

    // Light: god rays from the grow lamp, caustics drifting, day and night.
    this.rays.forEach((s, i) => {
      s.visible = effects;
      s.x = Math.round(L.water.x + (i * L.water.w) / 4 + Math.sin(t * 0.15 * (quiet ? 0.25 : 1) + i * 1.7) * 18 + L.water.w * 0.1);
      s.y = L.water.y;
      s.alpha = (0.05 + 0.03 * Math.sin(t * 0.4 + i)) * (0.6 + o.light * 0.6);
    });
    this.caustics.forEach((c, i) => {
      c.visible = effects;
      if (!quiet) (c.tilePosition.x = (i ? -1 : 1) * t * 2.5), (c.tilePosition.y = t * (i ? 1.5 : 2));
    });
    this.frame.update(t, nightK, quiet);
    this.space.update(dt, t, o, regionLive(game.peek()).life, regionLive(game.peek()).open, quiet);
    this.plants.update(dt, quiet);

    this.drawDynamic(t);
    this.drawTop(t, effects);
    // Night side: the view outside darkens a touch more, the tank glows.
    this.night.clear().rect(0, 0, L.W, L.H).fill({ color: 0x010207, alpha: nightK * 0.25 });
    this.tankGlow.clear();
    if (nightK > 0.2) this.tankGlow.rect(L.water.x, L.water.y, L.water.w, L.sandY - L.water.y).fill({ color: 0x3fc6c9, alpha: (nightK - 0.2) * 0.12 });
    // Switching tanks: the new one surfaces out of the dark.
    this.curtain.clear();
    if (this.swapT > 0) {
      this.swapT -= dt;
      const k = Math.max(0, this.swapT / 0.35);
      this.curtain.rect(0, 0, L.viewW, L.viewH).fill({ color: 0x04050b, alpha: k * k });
    }
    if (this.plants.showDebug) this.debugLabels();
  }

  private drawDynamic(t: number) {
    const L = this.L;
    const g = this.dyn.clear();
    const now = Date.now();
    for (const egg of this.eggsHere()) {
      const x = Math.round(L.water.x + egg.x * L.water.w);
      const y = L.sandY - 2 + 3;
      const left = Math.max(0, egg.hatchAt - now);
      const wob = left < 3000 ? Math.round(Math.sin(t * 18)) : 0;
      if (egg.roe) {
        g.rect(x - 4 + wob, y - 5, 8, 6).fill(egg.kind === 'heritage' ? 0xffe2b8 : 0xd9f6ff);
        g.rect(x - 3 + wob, y - 4, 6, 4).fill(egg.kind === 'heritage' ? 0xffb86b : 0x7fd0ea);
        g.rect(x - 2 + wob, y - 4, 2, 1).fill(0xffffff);
      } else {
        for (const [ex, ey] of [[-3, 0], [0, -1], [3, 0], [-1, -3], [2, -3]]) {
          g.rect(x + ex + wob, y + ey - 1, 2, 2).fill(0xffd9a8);
          g.rect(x + ex + wob + 1, y + ey - 1, 1, 1).fill(0xff9e6e);
        }
      }
      const total = Math.max(1, egg.hatchAt - egg.laid);
      g.rect(x - 5, y - 9, 10, 2).fill({ color: 0x000000, alpha: 0.35 });
      g.rect(x - 5, y - 9, Math.round(10 * (1 - left / total)), 2).fill(0xffe680);
    }
    for (const p of this.food) {
      g.rect(Math.round(p.x), Math.round(p.y), 2, 2).fill(0xb8743a);
      g.rect(Math.round(p.x), Math.round(p.y), 1, 1).fill(0xe8a860);
    }
    // Pods: a capsule closes, sinks into the floor hatch with a flash.
    const hatchX = Math.round(L.tank.x + L.tank.w * 0.5);
    for (const p of this.pods) {
      const k = Math.min(1, p.t / 0.6);
      const x = Math.round(p.x + (hatchX - p.x) * k * k - p.w / 2);
      const y = Math.round(p.y + (L.sandY + 6 - p.y) * k * k - p.h / 2);
      const vis = p.t < 0.6;
      p.sprite.visible = vis;
      if (!vis) {
        if (p.t < 0.85) g.rect(hatchX - 6, L.sandY + 2, 12, 3).fill({ color: 0x7fd8ff, alpha: 1 - (p.t - 0.6) / 0.25 });
        continue;
      }
      p.sprite.position.set(x + 3, y + 3);
      g.rect(x + 1, y, p.w - 2, p.h).fill({ color: 0xc8f5ff, alpha: 0.35 });
      g.rect(x, y + 1, p.w, p.h - 2).fill({ color: 0xc8f5ff, alpha: 0.35 });
      g.rect(x + 1, y, p.w - 2, 1).fill(0xe8fbff);
      g.rect(x + 2, y + 1, 3, 1).fill(0xe8fbff);
    }
  }

  private px(g: Graphics, pattern: string[], x: number, y: number, color: number, alpha = 1) {
    pattern.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === 'X') g.rect(Math.round(x) + i, Math.round(y) + j, 1, 1).fill({ color, alpha });
    });
  }

  private drawTop(t: number, effects: boolean) {
    const L = this.L;
    const g = this.top.clear();
    for (const b of this.bubbles) g.rect(Math.round(b.x), Math.round(b.y), b.r, b.r).fill({ color: 0xebfcff, alpha: 0.75 });
    for (const f of this.fxs) {
      const a = Math.min(1, f.life / (f.max * 0.4));
      this.px(g, f.kind === 'heart' ? PATTERNS.HEART : PATTERNS.SPARK, f.x - 2, f.y - 2, f.kind === 'heart' ? 0xff7aa8 : 0xfff3a0, a);
    }
    // Selection marks.
    const sel = selected.peek();
    const pair = pairWith.peek();
    for (const a of this.actors.values()) {
      const mark = a.id === pair ? 0xff7aa8 : a.id === sel ? 0xffe14d : 0;
      if (!mark) continue;
      const ay = Math.round(a.y - a.h / 2) - 6 + Math.round(Math.sin(t * 5) * 1.5);
      this.px(g, PATTERNS.ARROW, a.x - 2, ay, mark);
    }
    if (placing.peek() != null) {
      const c = game.peek().ownedCuttings[placing.peek()!];
      this.plants.drawSlots(g, c?.family === 'plant3' ? LEDGE_SLOTS : WATER_SLOTS, t);
    }
    // Surface line and glass glint.
    g.rect(L.water.x, L.water.y, L.water.w, 1).fill({ color: 0xe8fbff, alpha: 0.5 });
    if (effects) {
      const wave = Math.floor(t * 3) % 8;
      for (let x = L.water.x + wave; x < L.water.x + L.water.w; x += 8) g.rect(x, L.water.y + 1, 3, 1).fill({ color: 0xffffff, alpha: 0.25 });
    }
    g.rect(L.tank.x + 4, L.water.y + 2, 2, Math.round(L.water.h * 0.4)).fill({ color: 0xffffff, alpha: 0.08 });
    g.rect(L.tank.x + 8, L.water.y + 2, 1, Math.round(L.water.h * 0.25)).fill({ color: 0xffffff, alpha: 0.08 });
  }

  private debugLabels() {
    const key = this.plants.labels.map((l) => `${l.x},${l.y},${l.text}`).join('|');
    if (key === this.debugTexts.join('|')) return;
    this.debugTexts = [key];
    for (const l of this.plants.labels) {
      const p = this.toScreen(l.x, l.y);
      stage.callout(p.x, p.y, l.text, '#9be37a');
    }
  }

  private listenKeys(on: boolean) {
    if (on === this.keysOn) return;
    this.keysOn = on;
    const m = on ? window.addEventListener : window.removeEventListener;
    m('keydown', this.onKeyDown);
    m('keyup', this.onKeyUp);
    m('blur', this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!PAN_KEYS[e.code] || typingTarget(e.target)) return;
    e.preventDefault();
    this.held.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  private onBlur = () => this.held.clear();

  private keyVec() {
    let x = 0;
    let y = 0;
    for (const code of this.held) {
      const d = PAN_KEYS[code];
      if (d) (x += d[0]), (y += d[1]);
    }
    const m = Math.hypot(x, y);
    if (m > 1) (x /= m), (y /= m);
    return { x, y };
  }

  private camPx() {
    return { x: Math.round(this.cam.x), y: Math.round(this.cam.y) };
  }

  /** Viewport pixel → world pixel, matching the rounded camera the tank is drawn at. */
  private toWorld(x: number, y: number) {
    const c = this.camPx();
    return { x: x + c.x, y: y + c.y };
  }

  /** World pixel → viewport pixel, for callouts drawn on the screen. */
  private toScreen(x: number, y: number) {
    const c = this.camPx();
    return { x: x - c.x, y: y - c.y };
  }

  private clampCam() {
    if (!this.L) return;
    const maxX = Math.max(0, this.L.W - this.L.viewW);
    const maxY = Math.max(0, this.L.H - this.L.viewH);
    this.camTarget.x = Math.max(0, Math.min(maxX, this.camTarget.x));
    this.camTarget.y = Math.max(0, Math.min(maxY, this.camTarget.y));
  }

  private limitVel() {
    const max = 900;
    const sp = Math.hypot(this.vel.x, this.vel.y);
    if (sp > max) (this.vel.x *= max / sp), (this.vel.y *= max / sp);
  }

  private applyCam() {
    const c = this.camPx();
    this.world.position.set(-c.x, -c.y);
    this.publishPan();
  }

  /** Tell the HTML layer how far across the glass the camera has panned, for the pan-position dots. */
  private publishPan() {
    const L = this.L;
    if (!L) return;
    const maxX = Math.max(0, L.W - L.viewW);
    const next = maxX > 0 ? Math.round((this.cam.x / maxX) * 100) / 100 : null;
    if (tankPan.peek() !== next) tankPan.value = next;
  }

  /** Ease toward a dragged or wheeled target, accelerate with the keys, and coast after a flick. */
  private stepCamera(dt: number) {
    const L = this.L;
    const maxX = Math.max(0, L.W - L.viewW);
    const maxY = Math.max(0, L.H - L.viewH);
    const snap = calm();
    const keys = this.keyVec();
    const keyed = keys.x !== 0 || keys.y !== 0;
    if (this.dragging) {
      if (snap) {
        this.cam.x = this.camTarget.x;
        this.cam.y = this.camTarget.y;
        this.vel.x = this.vel.y = 0;
      } else {
        const k = 1 - Math.exp(-10 * dt);
        const px = this.cam.x;
        const py = this.cam.y;
        this.cam.x += (this.camTarget.x - this.cam.x) * k;
        this.cam.y += (this.camTarget.y - this.cam.y) * k;
        if (dt > 0) (this.vel.x = (this.cam.x - px) / dt), (this.vel.y = (this.cam.y - py) / dt);
      }
    } else if (keyed) {
      this.gliding = false;
      const k = snap ? 1 : 1 - Math.exp(-8 * dt);
      this.vel.x += (keys.x * PAN_SPEED - this.vel.x) * k;
      this.vel.y += (keys.y * PAN_SPEED - this.vel.y) * k;
      this.cam.x += this.vel.x * dt;
      this.cam.y += this.vel.y * dt;
      this.camTarget.x = this.cam.x;
      this.camTarget.y = this.cam.y;
    } else if (this.gliding) {
      const k = snap ? 1 : 1 - Math.exp(-10 * dt);
      this.cam.x += (this.camTarget.x - this.cam.x) * k;
      this.cam.y += (this.camTarget.y - this.cam.y) * k;
      if (Math.hypot(this.camTarget.x - this.cam.x, this.camTarget.y - this.cam.y) < 0.4) {
        this.cam.x = this.camTarget.x;
        this.cam.y = this.camTarget.y;
        this.gliding = false;
      }
    } else if (!snap) {
      const decay = Math.exp(-2.4 * dt);
      this.vel.x *= decay;
      this.vel.y *= decay;
      if (Math.hypot(this.vel.x, this.vel.y) < 6) this.vel.x = this.vel.y = 0;
      this.cam.x += this.vel.x * dt;
      this.cam.y += this.vel.y * dt;
      this.camTarget.x = this.cam.x;
      this.camTarget.y = this.cam.y;
    }
    this.limitVel();
    this.cam.x = Math.max(0, Math.min(maxX, this.cam.x));
    this.cam.y = Math.max(0, Math.min(maxY, this.cam.y));
    this.camTarget.x = Math.max(0, Math.min(maxX, this.camTarget.x));
    this.camTarget.y = Math.max(0, Math.min(maxY, this.camTarget.y));
    if ((this.cam.x <= 0 && this.vel.x < 0) || (this.cam.x >= maxX && this.vel.x > 0)) this.vel.x = 0;
    if ((this.cam.y <= 0 && this.vel.y < 0) || (this.cam.y >= maxY && this.vel.y > 0)) this.vel.y = 0;
    this.applyCam();
  }

  destroy() {
    this.listenKeys(false);
    this.off();
    this.plants.destroy();
    for (const a of [...this.actors.values()]) this.removeActor(a);
    this.root.destroy({ children: true });
  }
}

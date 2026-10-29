// One Pixi application for every room. The active scene renders into a low-res RenderTexture
// (about 360 px wide), which is drawn to the canvas at an integer scale with nearest filtering.
// The canvas is absolutely positioned inside its container and Pixi resizes to that container,
// never the window (the v2 sizing bug).

import { Application, Container, RenderTexture, Sprite, Text, TextureSource, UPDATE_PRIORITY } from 'pixi.js';
import { signal } from '@preact/signals';
import { reducedMotion } from '../ui/theme';

export const TARGET_W = 360;

export interface Scene {
  root: Container;
  /** Target frame rate when idle; the Bridge drops to 30 when nothing moves. */
  fps?: () => number;
  resize(W: number, H: number): void;
  update(dt: number, t: number): void;
  tap?(x: number, y: number): void;
  drag?(dx: number, dy: number, x: number, y: number): void;
  dragEnd?(): void;
  wheel?(dx: number, dy: number, x: number, y: number): void;
  show?(): void;
  hide?(): void;
  destroy(): void;
}

/** True when effects should be dialled down: battery saver, or the frame rate has struggled. */
export const lowFx = signal(false);
export const batterySaver = signal(false);
export const fx = () => !lowFx.value && !batterySaver.value;
export const calm = () => reducedMotion();

interface Callout {
  text: Text;
  x: number;
  y: number;
  life: number;
  max: number;
}

export class Stage {
  app = new Application();
  W = TARGET_W;
  H = 200;
  S = 1;
  dpr = 1;
  private rt!: RenderTexture;
  private view!: Sprite;
  overlay = new Container();
  private scenes = new Map<string, Scene>();
  private factories = new Map<string, () => Scene>();
  private active: Scene | null = null;
  private activeId = '';
  private callouts: Callout[] = [];
  private labels = new Map<string, { text: Text; seen: boolean; x: number; y: number }>();
  private time = 0;
  private slow = 0;
  private host!: HTMLElement;
  private ro?: ResizeObserver;

  async init(host: HTMLElement) {
    this.host = host;
    TextureSource.defaultOptions.scaleMode = 'nearest';
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    await this.app.init({
      resizeTo: host,
      resolution: this.dpr,
      autoDensity: true,
      antialias: false,
      background: 0x04050b,
      preference: 'webgl',
      powerPreference: 'low-power',
    });
    const c = this.app.canvas;
    c.style.position = 'absolute';
    c.style.inset = '0';
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.touchAction = 'none';
    c.setAttribute('aria-hidden', 'true');
    host.appendChild(c);
    this.rt = RenderTexture.create({ width: this.W, height: this.H, scaleMode: 'nearest' });
    this.view = new Sprite(this.rt);
    this.view.eventMode = 'static';
    this.app.stage.addChild(this.view, this.overlay);
    this.input();
    this.app.ticker.add((tk) => this.frame(tk.deltaMS / 1000), undefined, UPDATE_PRIORITY.HIGH);
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(host);
    this.layout();
    document.addEventListener('visibilitychange', this.onVis);
  }

  private onVis = () => (document.hidden ? this.app.ticker.stop() : this.app.ticker.start());

  register(id: string, make: () => Scene) {
    this.factories.set(id, make);
  }

  show(id: string) {
    if (id === this.activeId) return;
    this.active?.hide?.();
    let s = this.scenes.get(id);
    if (!s) {
      const make = this.factories.get(id);
      if (!make) return;
      s = make();
      this.scenes.set(id, s);
      s.resize(this.W, this.H);
    }
    this.active = s;
    this.activeId = id;
    s.show?.();
  }

  private layout() {
    this.app.resize();
    const bw = Math.max(1, Math.round(this.host.clientWidth * this.dpr));
    const bh = Math.max(1, Math.round(this.host.clientHeight * this.dpr));
    // Integer scale that gets close to the target width without the world getting too short.
    let S = Math.max(1, Math.round(bw / TARGET_W));
    while (S > 1 && bh / S < 150) S--;
    const W = Math.max(1, Math.floor(bw / S));
    const H = Math.max(1, Math.floor(bh / S));
    this.S = S;
    if (W !== this.W || H !== this.H) {
      this.W = W;
      this.H = H;
      // A fresh target: resizing a RenderTexture in place leaves the GPU framebuffer at the old size.
      const old = this.rt;
      this.rt = RenderTexture.create({ width: W, height: H, scaleMode: 'nearest' });
      this.view.texture = this.rt;
      old.destroy(true);
      for (const s of this.scenes.values()) s.resize(W, H);
    }
    this.view.scale.set(S / this.dpr);
    this.view.position.set(Math.floor((bw - W * S) / 2) / this.dpr, Math.floor((bh - H * S) / 2) / this.dpr);
  }

  /** Low-res world pixel → CSS pixel inside the host. */
  toScreen(x: number, y: number) {
    return { x: this.view.x + (x * this.S) / this.dpr, y: this.view.y + (y * this.S) / this.dpr };
  }

  private input() {
    let down: { x: number; y: number; moved: boolean; id: number } | null = null;
    const local = (e: { global: { x: number; y: number } }) => ({ x: (e.global.x - this.view.x) / this.view.scale.x, y: (e.global.y - this.view.y) / this.view.scale.y });
    this.view.on('pointerdown', (e) => {
      const p = local(e);
      down = { ...p, moved: false, id: e.pointerId };
    });
    this.view.on('globalpointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const p = local(e);
      const dx = p.x - down.x;
      const dy = p.y - down.y;
      if (!down.moved && Math.hypot(dx, dy) < 3) return;
      down.moved = true;
      this.active?.drag?.(dx, dy, p.x, p.y);
      down.x = p.x;
      down.y = p.y;
    });
    const up = (e: { pointerId: number; global: { x: number; y: number } }) => {
      if (!down || e.pointerId !== down.id) return;
      if (!down.moved) {
        const p = local(e);
        this.active?.tap?.(p.x, p.y);
      } else this.active?.dragEnd?.();
      down = null;
    };
    this.view.on('pointerup', up);
    this.view.on('pointerupoutside', up);
    this.app.canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.active?.wheel) return;
        e.preventDefault();
        const r = this.app.canvas.getBoundingClientRect();
        const p = local({ global: { x: e.clientX - r.left, y: e.clientY - r.top } });
        this.active.wheel(e.deltaX, e.deltaY, p.x, p.y);
      },
      { passive: false },
    );
  }

  /** Floating text above something in the world, drawn at screen resolution so it stays crisp. */
  callout(x: number, y: number, label: string, color = '#fff6c9') {
    const text = new Text({
      text: label,
      style: { fontFamily: 'Space Grotesk, system-ui, sans-serif', fontSize: 14, fontWeight: '700', fill: color, stroke: { color: '#04050b', width: 3 }, align: 'center' },
      resolution: this.dpr,
    });
    text.anchor.set(0.5, 1);
    this.overlay.addChild(text);
    this.callouts.push({ text, x, y, life: 1.6, max: 1.6 });
  }

  /**
   * A crisp, screen-resolution label pinned to a scene point for this frame only (call it every frame
   * it should show). Returns its size in scene pixels so the scene can draw a plate behind it.
   */
  label(key: string, x: number, y: number, label: string, color = '#f4f7ff') {
    let l = this.labels.get(key);
    const size = Math.max(11, Math.min(18, Math.round((5.5 * this.S) / this.dpr)));
    if (!l) {
      const text = new Text({ text: label, style: { fontFamily: 'Space Grotesk, system-ui, sans-serif', fontSize: size, fontWeight: '700', fill: color }, resolution: this.dpr });
      text.anchor.set(0, 0.5);
      this.overlay.addChild(text);
      l = { text, seen: true, x, y };
      this.labels.set(key, l);
    }
    if (l.text.text !== label) l.text.text = label;
    if (l.text.style.fill !== color) l.text.style.fill = color;
    if (l.text.style.fontSize !== size) l.text.style.fontSize = size;
    l.seen = true;
    l.x = x;
    l.y = y;
    const k = this.dpr / this.S;
    return { w: Math.ceil(l.text.width * k), h: Math.ceil(l.text.height * k) };
  }

  private frame(dt: number) {
    dt = Math.min(0.05, dt);
    this.time += dt;
    // Low-end detection: under 45 fps for 3 s turns the optional effects off.
    const fpsNow = this.app.ticker.FPS;
    if (!lowFx.value && fpsNow < 45 && this.app.ticker.maxFPS === 0) {
      this.slow += dt;
      if (this.slow > 3) lowFx.value = true;
    } else this.slow = Math.max(0, this.slow - dt);
    const want = batterySaver.value ? 30 : (this.active?.fps?.() ?? 60);
    const max = want >= 60 ? 0 : want;
    if (this.app.ticker.maxFPS !== max) this.app.ticker.maxFPS = max;

    for (const l of this.labels.values()) l.seen = false;
    if (this.active) {
      this.active.update(dt, this.time);
      this.app.renderer.render({ container: this.active.root, target: this.rt, clear: true, clearColor: 0x04050b });
    }
    for (const c of this.callouts) {
      c.life -= dt;
      c.y -= 9 * dt;
      const p = this.toScreen(c.x, c.y);
      c.text.position.set(Math.round(p.x), Math.round(p.y));
      c.text.alpha = Math.min(1, c.life / (c.max * 0.4));
      if (c.life <= 0) c.text.destroy();
    }
    this.callouts = this.callouts.filter((c) => c.life > 0);
    for (const l of this.labels.values()) {
      l.text.visible = l.seen;
      if (!l.seen) continue;
      const p = this.toScreen(l.x, l.y);
      l.text.position.set(Math.round(p.x), Math.round(p.y));
    }
  }

  get room() {
    return this.activeId;
  }

  destroy() {
    document.removeEventListener('visibilitychange', this.onVis);
    this.ro?.disconnect();
    for (const s of this.scenes.values()) s.destroy();
    this.app.destroy(true, { children: true, texture: true });
  }
}

export const stage = new Stage();

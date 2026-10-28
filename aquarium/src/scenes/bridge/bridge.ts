// The Bridge: Mirelle filling the forward window. Drag to spin, tap a region to focus it. The station
// rides the equator once per orbit; each open region's launch window is the arc where it passes below.
// A flat surface map is one toggle away. Runs at 30 fps while nothing moves.

import { Container, Graphics, Sprite } from 'pixi.js';
import { game, orbit, focusRegion, surface, onScene, toast, type SceneEvent } from '../../store/signals';
import * as W from '../../game';
import { loadPlanet, type Planet } from '../../planet/load';
import { paint } from '../../planet/paint';
import { Globe } from '../globe';
import { regionLive } from '../life';
import { canvas, texOf, lcg } from '../paint';
import { stage, fx, calm, type Scene } from '../stage';
import { C } from '../../ui/theme';

interface Splash {
  regionId: string;
  clean: boolean;
  t: number;
  said?: boolean;
}

const wrap = (x: number) => x - Math.floor(x);
const near = (a: number, b: number) => {
  const d = wrap(a - b + 0.5) - 0.5;
  return d;
};

export class BridgeScene implements Scene {
  root = new Container();
  private stars = new Sprite();
  private glow = new Graphics();
  private globeSprite = new Sprite();
  private mapSprite = new Sprite();
  private marks = new Graphics();
  private globe: Globe | null = null;
  private planet: Planet | null = null;
  private W = 360;
  private H = 200;
  private gx = 0;
  private gy = 0;
  private spin = 0.25;
  private vel = 0;
  private target: number | null = null;
  private drawn = { spin: NaN, sun: NaN, key: '', hi: -2, surface: false };
  private mapCanvas: ReturnType<typeof canvas> | null = null;
  private mapImg: ImageData | null = null;
  private mapScale = 1;
  private mx = 0;
  private my = 0;
  private splashes: Splash[] = [];
  private busyUntil = 0;
  private t = 0;
  private off: () => void;
  private unfocus: () => void;

  constructor() {
    this.root.addChild(this.stars, this.glow, this.globeSprite, this.mapSprite, this.marks);
    this.glow.blendMode = 'add';
    this.off = onScene((e) => this.onEvent(e));
    this.unfocus = focusRegion.subscribe((id) => this.face(id));
    void loadPlanet(game.peek().planet).then((p) => {
      this.planet = p;
      this.resize(this.W, this.H);
    });
  }

  fps = () => (this.t < this.busyUntil || Math.abs(this.vel) > 0.0005 || this.target !== null || this.splashes.length ? 60 : 30);

  resize(W: number, H: number) {
    this.W = W;
    this.H = H;
    this.paintStars();
    if (!this.planet) return;
    const r = Math.max(30, Math.floor(Math.min(W * 0.46, H * 0.42)));
    if (!this.globe || this.globe.size !== r * 2 + 1) {
      this.globe?.destroy();
      this.globe = new Globe(r);
      this.globe.setPlanet(this.planet);
      this.globeSprite.texture = this.globe.texture;
      this.drawn.key = '';
    }
    this.gx = Math.floor(W / 2 - this.globe.size / 2);
    this.gy = Math.floor(H / 2 - this.globe.size / 2) + 4;
    this.globeSprite.position.set(this.gx, this.gy);
    // Surface map: the whole 256×128 map at the largest integer scale that fits.
    const m = this.planet.map;
    this.mapScale = Math.max(1, Math.floor(Math.min((W - 8) / m.w, (H - 24) / m.h)));
    if (!this.mapCanvas) {
      this.mapCanvas = canvas(m.w, m.h);
      this.mapImg = this.mapCanvas.g.createImageData(m.w, m.h);
      this.mapSprite.texture = texOf(this.mapCanvas.c);
    }
    this.mapSprite.scale.set(this.mapScale);
    // Narrow screens: show the map at 1× and crop the sides rather than shrinking it.
    this.mx = Math.floor((W - m.w * this.mapScale) / 2);
    this.my = Math.floor((H - m.h * this.mapScale) / 2) + 4;
    this.mapSprite.position.set(this.mx, this.my);
    this.drawn.key = '';
  }

  private paintStars() {
    const { c, g } = canvas(this.W, this.H);
    g.fillStyle = '#0b0e1f';
    g.fillRect(0, 0, this.W, this.H);
    const r = lcg(91);
    for (let i = 0; i < (this.W * this.H) / 220; i++) {
      const v = 90 + Math.floor(r() * 150);
      g.fillStyle = `rgb(${v * 0.85},${v * 0.9},${v})`;
      g.fillRect(Math.floor(r() * this.W), Math.floor(r() * this.H), 1, 1);
    }
    this.stars.texture?.destroy(true);
    this.stars.texture = texOf(c);
  }

  /** Ease the spin so a region faces the window. */
  private face(id: string | null) {
    if (!id) return;
    const reg = game.peek().regions.find((r) => r.id === id);
    if (reg) this.target = wrap(reg.lon - 0.5);
  }

  private onEvent(e: SceneEvent) {
    if (e.kind === 'splash') {
      this.splashes.push({ regionId: e.regionId, clean: e.clean, t: 0 });
      this.face(e.regionId);
      this.busyUntil = this.t + 3;
    } else if (e.kind === 'named') {
      this.face(e.regionId);
      this.busyUntil = this.t + 2;
    }
  }

  private indexOf(id: string) {
    return this.planet ? this.planet.map.regions.findIndex((r) => r.id === id) : -1;
  }

  /** Map cell under a texel, in whichever view is showing. */
  private cellAt(x: number, y: number): number | null {
    if (!this.planet) return null;
    if (surface.peek()) {
      const m = this.planet.map;
      const cx = Math.floor((x - this.mx) / this.mapScale);
      const cy = Math.floor((y - this.my) / this.mapScale);
      if (cx < 0 || cy < 0 || cx >= m.w || cy >= m.h) return null;
      return cy * m.w + cx;
    }
    return this.globe?.cellAt(x - this.gx, y - this.gy, this.spin) ?? null;
  }

  tap(x: number, y: number) {
    const cell = this.cellAt(x, y);
    if (cell == null || !this.planet) return;
    // Taps near a coast snap to the closest region within a few cells.
    const m = this.planet.map;
    let ri = m.region[cell];
    if (ri < 0) {
      const cx = cell % m.w;
      const cy = Math.floor(cell / m.w);
      let best = 1e9;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const yy = cy + dy;
          if (yy < 0 || yy >= m.h) continue;
          const k = m.region[yy * m.w + ((cx + dx + m.w) % m.w)];
          if (k >= 0 && dx * dx + dy * dy < best) (best = dx * dx + dy * dy), (ri = k);
        }
    }
    if (ri < 0) {
      focusRegion.value = null;
      return;
    }
    const seed = m.regions[ri];
    const reg = game.peek().regions.find((r) => r.id === seed.id);
    if (!reg) return;
    if (!reg.opened) toast(`${reg.survey}: still surveying. ${W.biomeName(reg.biome)} opens in a later phase.`);
    focusRegion.value = focusRegion.peek() === reg.id ? null : reg.id;
  }

  drag(dx: number) {
    if (surface.peek()) return;
    const r = this.globe ? this.globe.size / 2 : 60;
    const d = -dx / (Math.PI * 2 * r);
    this.spin = wrap(this.spin + d);
    this.vel = d;
    this.target = null;
  }

  wheel(dy: number) {
    if (!surface.peek()) this.drag(-dy * 0.3);
  }

  show() {
    this.drawn.key = '';
  }

  update(dt: number) {
    this.t += dt;
    const quiet = calm();
    const o = orbit.peek();
    const s = game.peek();
    const flat = surface.peek();
    this.globeSprite.visible = !flat;
    this.mapSprite.visible = flat;

    // Spin: ease to a target, coast after a drag, or drift slowly.
    if (this.target !== null) {
      const d = near(this.target, this.spin);
      this.spin = wrap(this.spin + d * Math.min(1, dt * (quiet ? 20 : 4)));
      if (Math.abs(d) < 0.001) this.target = null;
    } else if (Math.abs(this.vel) > 0.00005) {
      this.spin = wrap(this.spin + this.vel);
      this.vel *= Math.pow(0.04, dt);
    } else if (!quiet) this.spin = wrap(this.spin + dt / 300);

    const sun = wrap(o.f + 0.5);
    const night = 1 - o.light;
    const { life, open } = regionLive(s);
    const focus = focusRegion.peek();
    const hi = focus ? this.indexOf(focus) : -1;
    const key = life.join(',') + '|' + open.join('');

    if (this.planet && this.globe && !flat) {
      if (key !== this.drawn.key || hi !== this.drawn.hi || this.drawn.surface) {
        this.globe.repaint(life, open, hi);
        this.drawn.spin = NaN;
      }
      if (!(Math.abs(this.spin - this.drawn.spin) < 0.0008) || Math.abs(sun - this.drawn.sun) > 0.002) {
        this.globe.render(this.spin, sun, night);
        this.drawn.spin = this.spin;
        this.drawn.sun = sun;
      }
    }
    if (this.planet && flat && this.mapImg && this.mapCanvas && (key !== this.drawn.key || hi !== this.drawn.hi || !this.drawn.surface)) {
      paint(this.planet.map, this.planet.prep, life, open, this.mapImg.data, hi);
      this.mapCanvas.g.putImageData(this.mapImg, 0, 0);
      this.mapSprite.texture.source.update();
    }
    this.drawn.key = key;
    this.drawn.hi = hi;
    this.drawn.surface = flat;

    this.drawMarks(dt, s, o, focus, quiet);
  }

  /** Station, window arcs, region pins and splashes, drawn fresh each frame. */
  private drawMarks(dt: number, s: W.State, o: { f: number; night: boolean }, focus: string | null, quiet: boolean) {
    const g = this.marks.clear();
    this.glow.clear();
    if (!this.planet) return;
    const m = this.planet.map;
    const flat = surface.peek();
    const pulse = quiet ? 1 : 0.6 + 0.4 * Math.sin(this.t * 5);

    // Where a lon/lat lands on screen in the current view; `front` is false behind the globe.
    const at = (lon: number, lat: number, lift = 1) => {
      if (flat) return { x: this.mx + wrap(lon) * m.w * this.mapScale, y: this.my + (0.5 - lat / 2) * m.h * this.mapScale, front: true };
      const p = this.globe!.project(lon, lat, this.spin);
      const r = (this.globe!.size - 1) / 2;
      return { x: this.gx + r + (p.x - r) * lift, y: this.gy + r + (p.y - r) * lift, front: p.front };
    };
    if (!flat && !this.globe) return;

    // The station's ground track (a faint dashed line) and the station itself.
    const lift = 1.14;
    for (let i = 0; i < 96; i++) {
      const lon = i / 96;
      const p = at(lon, 0, lift);
      if (!p.front && !flat) continue;
      if (i % 2) g.rect(Math.round(p.x), Math.round(p.y), 1, 1).fill({ color: C.hullHi, alpha: flat ? 0.8 : 0.9 });
    }

    // Launch windows: the arc of track above each open region; the focused one is bright.
    for (const r of s.regions) {
      if (!r.opened) continue;
      const mine = r.id === focus;
      const live = W.inWindow(r.lon, o.f);
      if (!mine && !live) continue;
      const [a, b] = W.windowArc(r.lon);
      for (let k = 0; k <= 24; k++) {
        const p = at(a + ((b - a) * k) / 24, 0, lift);
        if (!p.front && !flat) continue;
        g.rect(Math.round(p.x), Math.round(p.y), 1, 1).fill({ color: live ? C.bloom : C.lamp, alpha: mine ? 1 : 0.6 });
      }
    }

    // Region pins: a dot for open regions, a ring for the focused one.
    for (const r of s.regions) {
      const p = at(r.lon, r.lat);
      if (!p.front) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (r.id === focus) {
        const rr = 4 + (quiet ? 0 : Math.round(pulse));
        g.circle(x, y, rr).stroke({ color: C.ink, width: 1, alpha: 0.95, alignment: 0.5 });
      } else if (r.opened) {
        g.rect(x, y, 1, 1).fill({ color: r.life >= 100 ? C.bloom : C.ink, alpha: 0.85 });
      } else if (r.opensAt <= s.phase + 1) g.rect(x, y, 1, 1).fill({ color: 0x6b7090, alpha: 0.7 });
      // Poll open: a pink tick above the pin.
      if (r.poll && !r.name) g.rect(x, y - 3, 1, 2).fill({ color: C.signal, alpha: pulse });
    }

    // The station.
    const st = at(o.f, 0, lift);
    if (st.front || flat) {
      const x = Math.round(st.x);
      const y = Math.round(st.y);
      g.rect(x - 1, y - 1, 3, 3).fill(C.ink);
      g.rect(x - 4, y, 3, 1).fill(C.tank);
      g.rect(x + 2, y, 3, 1).fill(C.tank);
      if (!quiet) g.rect(x, y - 2, 1, 1).fill({ color: C.signal, alpha: Math.sin(this.t * 4) > 0 ? 1 : 0.2 });
    }

    // Splashes: a pod streak down from the station, then rings and a flash.
    for (const sp of this.splashes) {
      sp.t += dt;
      const r = s.regions.find((x) => x.id === sp.regionId);
      if (!r) continue;
      const p = at(r.lon, r.lat);
      if (sp.t < 0.6 && !quiet) {
        const k = sp.t / 0.6;
        const top = at(r.lon, 0, lift);
        const x = top.x + (p.x - top.x) * k;
        const y = top.y + (p.y - top.y) * k;
        g.rect(Math.round(x), Math.round(y), 1, 2).fill(C.lamp);
      } else {
        const k = (sp.t - 0.6) / 1.6;
        if (k > 0 && k < 1 && p.front) {
          const col = sp.clean ? C.bloom : C.tank;
          for (let i = 0; i < 3; i++) {
            const kk = k - i * 0.15;
            if (kk <= 0) continue;
            g.circle(Math.round(p.x), Math.round(p.y), 2 + kk * 14).stroke({ color: col, width: 1, alpha: (1 - kk) * 0.9 });
          }
          if (fx()) this.glow.circle(p.x, p.y, 6 * (1 - k) + 2).fill({ color: col, alpha: 0.35 * (1 - k) });
          if (!sp.said) {
            sp.said = true;
            stage.callout(p.x, p.y - 6, sp.clean ? 'clean drop!' : 'splash!', '#9be37a');
          }
        }
      }
    }
    this.splashes = this.splashes.filter((x) => x.t < 2.3);
  }

  hide() {
    this.vel = 0;
  }

  destroy() {
    this.off();
    this.unfocus();
    this.globe?.destroy();
    this.root.destroy({ children: true });
  }
}

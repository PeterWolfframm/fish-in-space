// The Bridge: Mirelle filling the forward window. Drag to spin, tap a region to focus it. The station
// rides the equator once per orbit; each open region's launch window is the arc where it passes below.
// A flat surface map is one toggle away. Runs at 30 fps while nothing moves.
// Every drop gets one of three launch gags, in turn: the pneumatic post (a capsule on a parachute), the
// celebration launcher (confetti and a fish in a bubble helmet), and the transporter, which rebuilds the
// fish pixel by pixel above the water.

import { Container, Graphics, Sprite } from 'pixi.js';
import { game, orbit, focusRegion, surface, onScene, toast, type SceneEvent } from '../../store/signals';
import * as W from '../../game';
import { loadPlanet, type Planet } from '../../planet/load';
import { paint } from '../../planet/paint';
import { Globe } from '../globe';
import { regionLive } from '../life';
import { canvas, texOf, lcg } from '../paint';
import { sheet, retain, release, type Sheet } from '../../art/atlas';
import { stage, fx, calm, type Scene } from '../stage';
import { C } from '../../ui/theme';

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: number;
}

interface Splash {
  regionId: string;
  clean: boolean;
  t: number;
  code: string;
  gag: number;
  said?: boolean;
  cue?: number; // which of the gag's callouts have fired, as a bit mask
  bits: Bit[];
  sprite: Sprite;
  mask: Graphics;
  sheet: Sheet | null;
  order: number[] | null; // the transporter's reveal order
}

/** When each gag's fish reaches the water (then the rings start). */
const LAND = [2.5, 2.0, 2.4];
const RINGS = 1.6;
const CONFETTI = [C.gold, C.signal, C.tank, C.bloom, C.lilac, C.ink];

/** 5×5 biome glyphs for the region plates. */
const GLYPH: Record<string, string[]> = {
  melt: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'],
  river: ['.#...', '#.#.#', '...#.', '.#...', '#.#.#'],
  sea: ['.##..', '#..#.', '....#', '.##..', '#..#.'],
  delta: ['..###', '.####', '#.##.', '.#...', '#....'],
  reef: ['.#.#.', '#####', '.###.', '..#..', '.###.'],
  trench: ['..#..', '..#..', '##.##', '..#..', '..#..'],
};
const hexNum = (h: string) => parseInt(h.replace('#', ''), 16);

const wrap = (x: number) => x - Math.floor(x);
const near = (a: number, b: number) => {
  const d = wrap(a - b + 0.5) - 0.5;
  return d;
};

export class BridgeScene implements Scene {
  root = new Container();
  private stars = new Sprite();
  private glow = new Graphics();
  private halo = new Sprite();
  private globeSprite = new Sprite();
  private gags = new Container();
  private gagG = new Graphics();
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
    this.root.addChild(this.stars, this.halo, this.glow, this.globeSprite, this.mapSprite, this.marks, this.gags, this.gagG);
    this.glow.blendMode = 'add';
    this.halo.blendMode = 'add';
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
    const r = Math.max(30, Math.floor(Math.min(W * 0.4, H * 0.46)));
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
    this.paintHalo(r);
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

  /** Deep space: two faint nebula washes, stars (a few with a cross glint), and a vignette. */
  private paintStars() {
    const { W, H } = this;
    const { c, g } = canvas(W, H);
    g.fillStyle = '#0b0e1f';
    g.fillRect(0, 0, W, H);
    const neb = (x: number, y: number, rad: number, col: string) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(11,14,31,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    };
    neb(W * 0.12, H * 0.2, W * 0.45, 'rgba(180,140,255,0.16)');
    neb(W * 0.92, H * 0.85, W * 0.4, 'rgba(62,230,245,0.10)');
    const r = lcg(91);
    for (let i = 0; i < (W * H) / 200; i++) {
      const v = 90 + Math.floor(r() * 150);
      const x = Math.floor(r() * W);
      const y = Math.floor(r() * H);
      g.fillStyle = `rgb(${v * 0.85},${v * 0.9},${v})`;
      g.fillRect(x, y, 1, 1);
      if (v > 232 && r() < 0.5) {
        g.fillStyle = `rgba(${v},${v},255,0.35)`;
        g.fillRect(x - 1, y, 1, 1);
        g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x, y - 1, 1, 1);
        g.fillRect(x, y + 1, 1, 1);
      }
    }
    // Dithered vignette so the edges fall away without banding.
    const cx = W / 2;
    const cy = H / 2;
    const max = Math.hypot(cx, cy);
    g.fillStyle = 'rgba(4,5,11,1)';
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - cx) * 0.8, y - cy) / max;
        const a = Math.max(0, (d - 0.55) / 0.45);
        if (a > 0 && ((x * 7 + y * 13) % 16) / 16 < a * 0.9) g.fillRect(x, y, 1, 1);
      }
    this.stars.texture?.destroy(true);
    this.stars.texture = texOf(c);
  }

  /** The atmosphere: a soft cyan halo just outside the limb, brighter on the sunward side. */
  private paintHalo(r: number) {
    const size = r * 2 + 25;
    const { c, g } = canvas(size, size);
    const m = size / 2;
    const gr = g.createRadialGradient(m - r * 0.15, m - r * 0.1, r * 0.92, m, m, r + 12);
    gr.addColorStop(0, 'rgba(62,230,245,0)');
    gr.addColorStop(0.25, 'rgba(110,200,255,0.45)');
    gr.addColorStop(0.55, 'rgba(62,170,245,0.14)');
    gr.addColorStop(1, 'rgba(62,230,245,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    this.halo.texture?.destroy(true);
    this.halo.texture = texOf(c);
    this.halo.position.set(this.gx + r + 0.5 - m, this.gy + r + 0.5 - m);
  }

  /** Ease the spin so a region faces the window. */
  private face(id: string | null) {
    if (!id) return;
    const reg = game.peek().regions.find((r) => r.id === id);
    if (reg) this.target = wrap(reg.lon - 0.5);
  }

  private onEvent(e: SceneEvent) {
    if (e.kind === 'splash') {
      const gag = ((e.gag % 3) + 3) % 3;
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.visible = false;
      const mask = new Graphics();
      this.gags.addChild(sprite, mask);
      this.splashes.push({ regionId: e.regionId, clean: e.clean, t: calm() ? LAND[gag] : 0, code: e.code, gag, bits: [], sprite, mask, sheet: null, order: null });
      this.face(e.regionId);
      this.busyUntil = this.t + 4.5;
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

  wheel(_dx: number, dy: number) {
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
    this.halo.visible = !flat;
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

    // The station's orbit: a solid ring in front, a faint arc where it peeks past the limb behind,
    // and a tick every tenth of an orbit.
    const lift = 1.14;
    const R = this.globe ? (this.globe.size - 1) / 2 : 0;
    const ox = this.gx + R;
    const oy = this.gy + R;
    for (let i = 0; i < 240; i++) {
      const lon = i / 240;
      const p = at(lon, 0, lift);
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (flat) {
        if (i % 2) g.rect(x, y, 1, 1).fill({ color: C.hullHi, alpha: 0.8 });
        continue;
      }
      if (p.front) g.rect(x, y, 1, 1).fill({ color: i % 24 === 0 ? C.tank : 0x4a5a8a, alpha: i % 24 === 0 ? 0.9 : 0.75 });
      else if (Math.hypot(p.x - ox, p.y - oy) > R + 1) g.rect(x, y, 1, 1).fill({ color: 0x4a5a8a, alpha: 0.3 });
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

    // Region plates: the focused region and any region whose window is open right now.
    for (const r of s.regions) {
      const mine = r.id === focus;
      const live = r.opened && W.inWindow(r.lon, o.f);
      if (!mine && !live) continue;
      const p = at(r.lon, r.lat);
      if (!p.front) continue;
      this.plate(g, r, Math.round(p.x), Math.round(p.y), mine, live, pulse);
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

    // Splashes: the launch gag, then rings and a flash where the fish meets the water.
    this.gagG.clear();
    for (const sp of this.splashes) {
      sp.t += dt;
      const r = s.regions.find((x) => x.id === sp.regionId);
      if (!r) continue;
      const p = at(r.lon, r.lat);
      const top = at(r.lon, 0, lift);
      const land = LAND[sp.gag];
      if (sp.t < land) this.runGag(sp, top, p);
      else sp.sprite.visible = false;
      this.drawBits(sp, dt);
      const k = (sp.t - land) / RINGS;
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
    for (const sp of this.splashes) if (sp.t >= LAND[sp.gag] + RINGS + 0.2) this.endSplash(sp);
    this.splashes = this.splashes.filter((x) => x.t < LAND[x.gag] + RINGS + 0.2);
  }

  /** A name plate above a region pin: a biome glyph in its colour, then the name; a stem down to the pin. */
  private plate(g: Graphics, r: W.State['regions'][number], x: number, y: number, mine: boolean, live: boolean, pulse: number) {
    const biome = W.biomeById(r.biome);
    const col = biome ? hexNum(biome.color) : C.ink;
    const name = r.name ?? r.survey;
    const text = live ? `${name} · open` : name;
    const h = 13;
    const gap = 9;
    const py = y - gap - h;
    // Measure first (label() is cheap and draws the text at screen resolution on the overlay).
    const size = stage.label(`plate:${r.id}`, 0, 0, text, live ? '#9be37a' : mine ? '#f4f7ff' : '#c9d2ee');
    const w = 2 + 11 + 3 + size.w + 4;
    const px = Math.max(2, Math.min(this.W - w - 2, x - Math.round(w / 2)));
    stage.label(`plate:${r.id}`, px + 16, py + h / 2, text, live ? '#9be37a' : mine ? '#f4f7ff' : '#c9d2ee');
    // Stem, then the plate with chipped corners.
    g.rect(x, py + h, 1, gap - 2).fill({ color: col, alpha: 0.8 });
    g.rect(px + 1, py, w - 2, h).fill({ color: 0x0b0e1f, alpha: 0.88 });
    g.rect(px, py + 1, w, h - 2).fill({ color: 0x0b0e1f, alpha: 0.88 });
    const edge = live ? C.bloom : mine ? C.ink : col;
    const ea = live ? 0.5 + 0.5 * pulse : 0.9;
    g.rect(px + 1, py, w - 2, 1).fill({ color: edge, alpha: ea });
    g.rect(px + 1, py + h - 1, w - 2, 1).fill({ color: edge, alpha: ea });
    g.rect(px, py + 1, 1, h - 2).fill({ color: edge, alpha: ea });
    g.rect(px + w - 1, py + 1, 1, h - 2).fill({ color: edge, alpha: ea });
    // The end cap in the biome colour, with its 5×5 glyph cut out of it.
    g.rect(px + 2, py + 2, 11, h - 4).fill(col);
    const glyph = GLYPH[r.biome] ?? GLYPH.sea;
    glyph.forEach((row, gy) => [...row].forEach((ch, gx) => ch === '#' && g.rect(px + 5 + gx, py + 4 + gy, 1, 1).fill(0x0b0e1f)));
  }

  /** The fish's swim frames, once baked. */
  private fishTex(sp: Splash) {
    if (!sp.sheet) {
      sp.sheet = sheet('fish4', sp.code, 'swim');
      if (sp.sheet) retain(sp.sheet);
    }
    return sp.sheet ? sp.sheet.frames[Math.floor(this.t * sp.sheet.fps) % sp.sheet.n] : null;
  }

  private cue(sp: Splash, bit: number, x: number, y: number, text: string, color = '#fff6c9') {
    sp.cue ??= 0;
    if (sp.cue & (1 << bit)) return;
    sp.cue |= 1 << bit;
    stage.callout(x, y, text, color);
  }

  private burst(sp: Splash, x: number, y: number, n: number, speed: number, cols: readonly number[] = CONFETTI) {
    if (!fx()) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      sp.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, life: 0.8 + Math.random() * 0.7, c: cols[i % cols.length] });
    }
  }

  private drawBits(sp: Splash, dt: number) {
    const g = this.gagG;
    for (const b of sp.bits) {
      b.life -= dt;
      b.vy += 40 * dt;
      b.vx *= Math.pow(0.3, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life > 0) g.rect(Math.round(b.x), Math.round(b.y), 1, 1).fill({ color: b.c, alpha: Math.min(1, b.life * 2) });
    }
    sp.bits = sp.bits.filter((b) => b.life > 0);
  }

  /** Put the fish sprite at a point (or a 5×3 stand-in until its sheet bakes). */
  private placeFish(sp: Splash, x: number, y: number, flip = 1, rot = 0) {
    const tex = this.fishTex(sp);
    if (!tex) {
      this.gagG.rect(Math.round(x) - 2, Math.round(y) - 1, 5, 3).fill(C.lamp);
      sp.sprite.visible = false;
      return null;
    }
    sp.sprite.texture = tex;
    sp.sprite.visible = true;
    sp.sprite.position.set(Math.round(x), Math.round(y));
    const k = this.fishK(sp.sheet!);
    sp.sprite.scale.set(flip * k, k);
    sp.sprite.rotation = rot;
    return sp.sheet!;
  }

  /** Fish sheets are big next to the globe: halve anything wider than 28 px. */
  private fishK(s: Sheet) {
    return s.w > 28 ? 0.5 : 1;
  }

  private runGag(sp: Splash, top: { x: number; y: number }, p: { x: number; y: number }) {
    const g = this.gagG;
    const t = sp.t;
    if (sp.gag === 0) {
      // Pneumatic post: thwoomp out of the station, a striped chute pops, a gentle drift down, and the
      // fish hops out of the capsule into the water.
      const shoot = 0.35;
      const open = 2.0;
      let x: number;
      let y: number;
      if (t < shoot) {
        const k = t / shoot;
        x = top.x + (p.x - top.x) * k * 0.3;
        y = top.y + (p.y - top.y) * k * 0.3;
        if (t < 0.2) for (let i = 0; i < 4; i++) g.rect(Math.round(top.x) + i * 2 - 3, Math.round(top.y) - 2 - (i % 2), 2, 2).fill({ color: C.ink, alpha: 0.6 * (1 - t / 0.2) });
        this.cue(sp, 0, top.x, top.y - 4, 'thwoomp!');
      } else {
        const k = Math.min(1, (t - shoot) / (open - shoot));
        const e = 1 - Math.pow(1 - k, 2);
        x = top.x + (p.x - top.x) * (0.3 + 0.7 * e) + Math.sin(t * 4) * 3 * (1 - k);
        y = top.y + (p.y - top.y) * (0.3 + 0.7 * e) - 3;
      }
      const cx = Math.round(x);
      const cy = Math.round(y);
      if (t < open) {
        // Chute: a striped dome with lines down to the capsule.
        if (t >= shoot) {
          const pop = Math.min(1, (t - shoot) / 0.15);
          const w = Math.round(5 + 4 * pop);
          for (let i = -w; i <= w; i++) {
            const hgt = Math.round(Math.sqrt(Math.max(0, 1 - (i / (w + 0.5)) ** 2)) * 5 * pop);
            g.rect(cx + i, cy - 9 - hgt, 1, hgt + 1).fill(Math.floor((i + w) / 3) % 2 ? C.ink : C.signal);
          }
          for (const sx of [-w, 0, w]) g.moveTo(cx + sx + 0.5, cy - 8.5).lineTo(cx + 0.5, cy - 2.5).stroke({ color: C.ink, width: 1, alpha: 0.55 });
          if (pop >= 1) this.cue(sp, 1, cx, cy - 16, 'pneumatic post!', '#ffd84a');
        }
        // Capsule: brass with dark caps and a porthole.
        g.rect(cx - 1, cy - 3, 3, 7).fill(0xd9a441);
        g.rect(cx - 1, cy - 3, 3, 1).fill(0x7a5a1a);
        g.rect(cx - 1, cy + 3, 3, 1).fill(0x7a5a1a);
        g.rect(cx, cy, 1, 1).fill(C.tank);
        sp.sprite.visible = false;
      } else {
        // Landed: the capsule pops and the fish hops out in a little arc.
        const k = (t - open) / (LAND[0] - open);
        g.rect(cx - 1, cy, 3, 4).fill(0xd9a441);
        g.rect(cx - 2 - Math.round(k * 4), cy - 2 - Math.round(k * 3), 2, 1).fill(0x7a5a1a);
        const s = this.placeFish(sp, cx + k * 6, cy - Math.sin(k * Math.PI) * 10, 1, (k - 0.5) * 0.8);
        if (s) sp.sprite.alpha = 1 - Math.max(0, k - 0.8) * 5;
        this.cue(sp, 2, cx, cy - 12, 'special delivery!', '#9be37a');
      }
    } else if (sp.gag === 1) {
      // Celebration launcher: a party popper on the station, a confetti burst, and the fish sails down in
      // a bubble helmet on a happy arc.
      const pop = 0.3;
      if (t < pop + 0.4) {
        const k = Math.min(1, t / pop);
        const cx = Math.round(top.x);
        const cy = Math.round(top.y) + 2;
        for (let i = 0; i < 6; i++) g.rect(cx - Math.floor(i / 2), cy + i, 1 + Math.floor(i / 2) * 2, 1).fill(i % 2 ? C.gold : C.signal);
        if (k < 1) g.rect(cx, cy - 1 - Math.round(k * 2), 1, 1).fill(C.ink);
      }
      if (t >= pop && !(sp.cue! & 1)) this.burst(sp, top.x, top.y, 36, 55);
      if (t >= pop) this.cue(sp, 0, top.x, top.y - 6, 'hooray!', '#ffd84a');
      if (t < pop) return;
      const fly = LAND[1] - pop;
      const k = Math.min(1, (t - pop) / fly);
      const cx = (top.x + p.x) / 2 + (p.x >= top.x ? 26 : -26);
      const cy = Math.max(14, Math.min(top.y, p.y) - 30);
      const u = 1 - k;
      const x = u * u * top.x + 2 * u * k * cx + k * k * p.x;
      const y = u * u * top.y + 2 * u * k * cy + k * k * p.y - 4;
      const dir = p.x >= top.x ? 1 : -1;
      const s = this.placeFish(sp, x, y, dir, Math.sin(t * 7) * 0.25);
      sp.sprite.alpha = 1;
      const rad = s ? Math.ceil((Math.max(s.w, s.h) * this.fishK(s)) / 2) + 1 : 4;
      g.circle(Math.round(x), Math.round(y), rad).stroke({ color: 0xe8eefc, width: 1, alpha: 0.75 });
      g.rect(Math.round(x - rad * 0.5), Math.round(y - rad * 0.6), 2, 1).fill({ color: C.ink, alpha: 0.9 });
      if (Math.random() < 0.5 && fx()) sp.bits.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: -5, life: 0.6, c: CONFETTI[Math.floor(Math.random() * CONFETTI.length)] });
      if (k > 0.97 && !(sp.cue! & 2)) this.burst(sp, p.x, p.y, 20, 35);
      if (k > 0.97) this.cue(sp, 1, p.x, p.y - rad - 4, 'wheee!', '#ff9eb8');
    } else {
      // Transporter: a shimmering column from the station to the water, the fish assembling cell by cell
      // in it, a beat to look around, then into the water it goes.
      const beam = 0.5;
      const built = 1.7;
      const hold = 2.05;
      const s = this.placeFish(sp, p.x, p.y - 10, 1, 0);
      const fw = s ? Math.ceil(s.w * this.fishK(s)) : 6;
      const fh = s ? Math.ceil(s.h * this.fishK(s)) : 4;
      const bw = Math.max(5, Math.round(fw * 0.7));
      const fade = t < built ? 1 : Math.max(0, 1 - (t - built) / 0.3);
      const reach = Math.min(1, t / beam);
      if (fade > 0) {
        const y0 = Math.round(top.y);
        const y1 = Math.round(top.y + (p.y - top.y) * reach);
        const x0 = Math.round((top.x + p.x) / 2 - bw / 2);
        g.rect(x0, y0, bw, y1 - y0).fill({ color: C.tank, alpha: 0.18 * fade });
        g.rect(x0, y0, 1, y1 - y0).fill({ color: C.tank, alpha: 0.6 * fade });
        g.rect(x0 + bw - 1, y0, 1, y1 - y0).fill({ color: C.tank, alpha: 0.6 * fade });
        if (fx()) this.glow.rect(x0 - 2, y0, bw + 4, y1 - y0).fill({ color: C.tank, alpha: 0.12 * fade });
        for (let i = 0; i < 10; i++) {
          const yy = y0 + ((i * 17 + t * 60) % Math.max(1, y1 - y0));
          const xx = x0 + 1 + ((i * 5 + Math.floor(t * 20)) % Math.max(1, bw - 2));
          g.rect(xx, Math.round(yy), 1, 1).fill({ color: i % 3 ? C.ink : C.tank, alpha: fade });
        }
        this.cue(sp, 0, top.x, top.y - 4, 'energise!', '#3ee6f5');
      }
      // Reveal the fish in 2×2 cells, in a shuffled order.
      const cw = Math.ceil(fw / 2);
      const ch = Math.ceil(fh / 2);
      if (!sp.order && s) {
        const r = lcg(sp.gag * 31 + sp.code.length * 7 + Math.floor(p.x));
        sp.order = Array.from({ length: cw * ch }, (_, i) => i).sort(() => r() - 0.5);
      }
      const m = sp.mask.clear();
      if (s && sp.order) {
        const k = Math.max(0, Math.min(1, (t - beam) / (built - beam)));
        const n = Math.floor(sp.order.length * k);
        const ox = Math.round(p.x) - Math.round(fw / 2);
        const oy = Math.round(p.y - 10) - Math.round(fh / 2);
        if (k < 1) {
          for (let i = 0; i < n; i++) {
            const c = sp.order[i];
            m.rect(ox + (c % cw) * 2, oy + Math.floor(c / cw) * 2, 2, 2).fill(0xffffff);
          }
          if (n === 0) m.rect(0, 0, 1, 1).fill(0xffffff);
          sp.sprite.mask = m;
          // Sparkles where cells just landed.
          for (let i = Math.max(0, n - 4); i < n; i++) {
            const c = sp.order[i];
            g.rect(ox + (c % cw) * 2, oy + Math.floor(c / cw) * 2, 1, 1).fill(C.ink);
          }
        } else sp.sprite.mask = null;
        if (t > built + 0.05) this.cue(sp, 1, p.x, p.y - 12 - fh / 2, '…huh?', '#e8eefc');
        if (t > hold) {
          const d = (t - hold) / (LAND[2] - hold);
          sp.sprite.position.set(Math.round(p.x), Math.round(p.y - 10 + d * 10));
          sp.sprite.alpha = 1 - d;
        } else sp.sprite.alpha = 1;
      }
    }
  }

  private endSplash(sp: Splash) {
    if (sp.sheet) release(sp.sheet);
    sp.sprite.mask = null;
    sp.sprite.destroy();
    sp.mask.destroy();
  }

  hide() {
    this.vel = 0;
  }

  destroy() {
    for (const sp of this.splashes) this.endSplash(sp);
    this.off();
    this.unfocus();
    this.globe?.destroy();
    this.root.destroy({ children: true });
  }
}

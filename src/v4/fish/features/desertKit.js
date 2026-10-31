// The desert kit: sand fish are a dune folk, and they go out geared up. One piece per fish:
// a stillsuit (body straps and a catch tube from gill to mouth), a filter mask over the snout, a
// pair of beating ornithopter wings, a shimmering personal shield, a milk-white curved blade
// strapped to the flank, a thumper on the back that knocks with the beat, or dust goggles.
//
// Painted last (after the particles), so the shield can outline everything the fish is.

import { defineFeature } from './define.js';
import { TAU, clamp, mix, INK, painted, colsBetween, topOf, botOf, disc, poly, tri, eyeCentre, waveOf, glowOf } from './paint.js';

const SUIT = { strap: '#4a3b2c', lit: '#6f5a43', tube: '#8a7356', tubeLit: '#b39c78' };

function stillsuit(ctx) {
  const { g, ph, s, colT, nose } = ctx;
  const w = Math.max(1, Math.round(s * 0.8));
  for (const t of [0.28, 0.5]) {
    const c = colT(t);
    if (!c) continue;
    for (let k = 0; k < w; k++) {
      const cc = ctx.colAt(c.x + k) ?? c;
      for (let y = topOf(cc); y <= botOf(cc); y++) {
        if (!ctx.onBody(c.x + k, y)) continue;
        g.px(c.x + k, y, g.color(y === topOf(cc) ? SUIT.lit : SUIT.strap));
      }
    }
  }
  // The catch tube: gill to the corner of the mouth, slung under the cheek.
  const gill = colT(Math.max(0.5, ph.eyeT - 0.16));
  if (!gill || !nose) return;
  const a = [gill.x, Math.round(gill.mid + gill.belly * 0.45)];
  const b = [nose.x - 1, Math.round(nose.mid + Math.max(1, nose.belly * 0.5))];
  const sag = Math.max(1, Math.round(s));
  const mid = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + sag];
  poly(g, [a, mid, b], g.color(SUIT.tube));
  g.px(Math.round(mid[0]), Math.round(mid[1]) - 1, g.color(SUIT.tubeLit));
}

function mask(ctx) {
  const { g, s, nose, colT, ph } = ctx;
  if (!nose) return;
  const w = Math.max(3, Math.round(3.4 * s));
  const x0 = nose.x - w + 1;
  const body = g.color('#5a4a3a');
  const rim = g.color('#2e251c');
  const vent = g.color('#b39c78');
  for (let x = x0; x <= nose.x + 1; x++) {
    const c = ctx.colAt(Math.min(x, nose.x)) ?? nose;
    const y0 = Math.round(c.mid - 0.5);
    const y1 = botOf(c) + (x > nose.x - 2 ? 1 : 0);
    for (let y = y0; y <= y1; y++) g.px(x, y, x === nose.x + 1 || y === y1 ? rim : body);
  }
  // Filter vents and the strap back to the gill.
  const vy = Math.round(nose.mid + Math.max(1, nose.belly * 0.4));
  for (let k = 0; k < Math.max(2, Math.round(s * 1.5)); k++) g.px(nose.x - 1 - k * 2, vy, vent);
  const gill = colT(Math.max(0.5, ph.eyeT - 0.12));
  if (gill) g.line(x0, Math.round(nose.mid), gill.x, Math.round(gill.mid), rim);
}

function thopter(ctx) {
  const { g, s, colT } = ctx;
  const beat = Math.sin(TAU * waveOf(ctx) * 2);
  const membrane = g.color('#d8e6ee', 150);
  const vein = g.color('#8fa3b0', 220);
  for (const [t, lean] of [[0.58, 0.15], [0.42, -0.1]]) {
    const c = colT(t);
    if (!c) continue;
    const base = [c.x, topOf(c) + 1];
    const len = 7 * s;
    // Up and back, flapping between nearly flat and nearly upright.
    const ang = -Math.PI / 2 - 0.55 + lean + beat * 0.45;
    const tip = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len];
    const nx = -Math.sin(ang) * 1.3 * s;
    const ny = Math.cos(ang) * 1.3 * s;
    const mid = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2];
    tri(g, base, [mid[0] + nx, mid[1] + ny], tip, membrane, true);
    tri(g, base, [mid[0] - nx, mid[1] - ny], tip, membrane, true);
    g.line(base[0], base[1], tip[0], tip[1], vein);
  }
  // The rotor hub between the wings.
  const hub = colT(0.5);
  if (hub) {
    g.px(hub.x, topOf(hub), g.color('#8a8f9c'));
    g.px(hub.x + 1, topOf(hub), g.color('#c9ccd6'));
  }
}

function shield(ctx) {
  const { g, s } = ctx;
  const glow = glowOf(ctx);
  const wave = waveOf(ctx);
  // The silhouette's bounds, then every empty pixel exactly `gap` away from it.
  let [x0, y0, x1, y1] = [g.w, g.h, -1, -1];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (!g.get(x, y)) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return;
  const gap = s >= 1.5 ? 2 : 1;
  const filled = (x, y) => Boolean(g.get(x, y));
  const near = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r && filled(x + dx, y + dy)) return true;
    return false;
  };
  const out = [];
  for (let y = y0 - gap - 1; y <= y1 + gap + 1; y++) {
    for (let x = x0 - gap - 1; x <= x1 + gap + 1; x++) {
      if (!g.inside(x, y) || filled(x, y) || near(x, y, gap)) continue;
      if (near(x, y, gap + 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) {
    // A shimmer that runs round the shield: brighter bands, alpha breathing with the glow.
    const band = 0.5 + 0.5 * Math.sin(TAU * ((x + y) / 9 - wave * 2));
    const a = Math.round(clamp(70 + 110 * band * (0.5 + 0.5 * glow), 40, 230));
    g.px(x, y, g.color(mix('#3d7bd9', '#bfe4ff', band), a));
  }
}

function crysknife(ctx) {
  const { g, s, colT } = ctx;
  const a = colT(0.62);
  const b = colT(0.26);
  if (!a || !b) return;
  const y = (c) => Math.round(c.mid + c.belly * 0.35);
  const hilt = g.color('#5a3a22');
  const blade = g.color('#efe9da');
  const edge = g.color('#c9c2b0');
  const ink = g.color(INK);
  const len = a.x - b.x;
  const hw = Math.max(1, Math.round(s * 0.9));
  // Hilt at the front, a curved milky blade sweeping back and up.
  for (let k = 0; k <= len; k++) {
    const x = a.x - k;
    const u = k / Math.max(1, len);
    const yy = Math.round(y(a) + (y(b) - y(a)) * u - Math.sin(Math.PI * u) * 1.5 * s);
    if (u < 0.22) {
      for (let j = 0; j < hw + 1; j++) g.px(x, yy + j, hilt);
    } else {
      const w = Math.max(1, Math.round(hw * (1 - (u - 0.22) / 0.78) + 0.4));
      for (let j = 0; j < w; j++) g.px(x, yy + j, j === w - 1 ? edge : blade);
      g.px(x, yy - 1, ink);
      g.px(x, yy + w, ink);
    }
  }
  // The crossguard.
  const gx = a.x - Math.round(len * 0.22);
  g.line(gx, y(a) - hw, gx, y(a) + hw + 1, g.color('#8a6a3a'));
}

function thumper(ctx) {
  const { g, s, colT } = ctx;
  const c = colT(0.45);
  if (!c) return;
  const top = topOf(c);
  const h = Math.max(3, Math.round(4 * s));
  // Knock, knock: the head drops sharply twice per loop.
  const knock = Math.max(0, Math.sin(TAU * waveOf(ctx) * 2)) ** 4;
  const headY = top - h + Math.round(knock * Math.max(1, s));
  const post = g.color('#9a8f80');
  g.line(c.x, top, c.x, headY, post);
  const hw = Math.max(1, Math.round(s));
  for (let y = headY - hw; y <= headY; y++) for (let x = c.x - hw; x <= c.x + hw; x++) g.px(x, y, g.color(y === headY - hw ? '#8f8270' : '#6b5f50'));
  g.px(c.x + hw, headY - hw, g.color(knock > 0.5 ? '#ff6a3d' : '#6a2418'));
  // Brackets where it is strapped on.
  g.px(c.x - 1, top, g.color(SUIT.strap));
  g.px(c.x + 1, top, g.color(SUIT.strap));
}

function goggles(ctx) {
  const { g, s } = ctx;
  const e = eyeCentre(ctx);
  if (!e) return;
  const r = Math.max(1.5, e.r + 0.8);
  const frame = g.color('#3a2f25');
  // The lens: tint the eye amber where it sits, rim it, and strap it back across the head.
  for (let y = Math.floor(e.y - r); y <= Math.ceil(e.y + r); y++) {
    for (let x = Math.floor(e.x - r); x <= Math.ceil(e.x + r); x++) {
      const d = Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y);
      if (d > r + 0.7) continue;
      if (d > r - 0.5) g.px(x, y, frame);
      else {
        const u = painted(g, x, y);
        if (u) g.px(x, y, g.color(mix(u.hex, '#f2a03d', 0.45), u.a));
      }
    }
  }
  const sy = Math.round(e.y - r * 0.2);
  const back = Math.round(e.x - r - Math.max(3, 3 * s));
  g.line(Math.round(e.x - r), sy, back, sy + 1, frame);
  disc(g, e.x + r * 0.35, e.y - r * 0.35, 0.5, g.color('#fff6d8'));
}

const DRAW = { stillsuit, mask, thopter, shield, crysknife, thumper, goggles };

export default defineFeature({
  id: 'desertKit',
  label: 'Desert kit',
  group: 'gear',
  field: {
    choices: [['none', 'None'], ['stillsuit', 'Stillsuit'], ['mask', 'Filter mask'], ['thopter', 'Thopter wings'], ['shield', 'Body shield'], ['crysknife', 'Crysknife'], ['thumper', 'Thumper'], ['goggles', 'Dust goggles']],
    weights: [35, 12, 10, 10, 9, 8, 8, 8],
    salt: 3104,
    dominance: 0.55,
    volatility: 0.5,
    tierBoost: { epic: 1.3, legendary: 1.6, myth: 2 },
  },
  when: { field: 'terrain', is: 'sand' },
  layer: 'after:orbit',
  points: 3,
  influences: {
    stats: { stressResistance: { '*': 0.04, stillsuit: 0.08, shield: 0.08 }, boldness: { crysknife: 0.06, thumper: 0.04 }, curiosity: { thopter: 0.05, goggles: 0.03 } },
    keys: { '*': ['desertKit'], stillsuit: ['desertKit.stillsuit'], mask: ['desertKit.mask'], thopter: ['desertKit.thopter'], shield: ['desertKit.shield'], crysknife: ['desertKit.crysknife'], thumper: ['desertKit.thumper'], goggles: ['desertKit.goggles'] },
    name: { prefix: 'Fremen', latin: 'arrak' },
  },
  draw(ctx, value) {
    DRAW[value]?.(ctx);
  },
});


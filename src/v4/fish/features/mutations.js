// Nuclear mutations: three slots drawing from one table, so a fish from the hot zone can be a
// little wrong (one extra eye) or a lot wrong (eye stalks, a belly mouth and a triple tail). Slot A
// is near-certain on a nuclear fish, B is a coin toss, C is rare; a chaotic genome mutates more.
// A slot never repeats what an earlier slot already wears.
//
// Each mutation paints in front of the body, behind it (fins, tentacles, shards whose roots the
// body hides), or both. Glows breathe with `pose.glow`; moving parts loop on `pose.wave`.
//
// Append only: the table's order is the code. A new mutation goes at the end, in all three slots.

import { defineFeature } from './define.js';
import { edgeFin } from '../../../v3/fish/draw.js';
import { TAU, clamp, mix, hash01, INK, interior, colsBetween, topOf, botOf, disc, poly, tri, eyeball, eyeCentre, tint, waveOf, glowOf } from './paint.js';

const GLOW = ['#2f8a3a', '#9dff5a', '#eaffc8'];
const glow = (k) => (k < 0.5 ? mix(GLOW[0], GLOW[1], k * 2) : mix(GLOW[1], GLOW[2], (k - 0.5) * 2));
const seedOf = (ctx, slot) => `${ctx.ph.seed}:${slot}`;
const finK = (ctx) => ctx.s * Math.min(1.5, ctx.ph.finMul ?? 1);

// ---------- in front of the body ----------------------------------------------------------------

function flankEye(ctx) {
  const { g, s, colT } = ctx;
  const c = colT(0.42);
  const e = eyeCentre(ctx);
  if (!c) return;
  const r = Math.max(1.2, (e?.r ?? 1.5) * 0.85);
  eyeball(g, c.x, c.mid - c.back * 0.15, r, { iris: '#7dff6a' });
  if (s >= 1.5) g.line(c.x - r - 1, c.mid - c.back * 0.15 - r, c.x + r, c.mid - c.back * 0.15 - r - 1, g.color(INK));
}

function cyclops(ctx) {
  const { g } = ctx;
  const e = eyeCentre(ctx);
  if (!e) return;
  eyeball(g, e.x, e.y - 0.5, Math.max(2, e.r * 1.6), { iris: '#c6ff3d' });
}

function stalks(ctx) {
  const { g, s, colT, ph } = ctx;
  const sway = Math.sin(TAU * waveOf(ctx));
  const stalk = g.color(ctx.fin ? ctx.pal.fin.edge : '#6a8a5a');
  for (const [t, lean, ph0] of [[ph.eyeT - 0.02, 0.35, 0], [ph.eyeT - 0.12, -0.15, 0.3]]) {
    const c = colT(t);
    if (!c) continue;
    const h = 4.5 * s;
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const u = k / 4;
      pts.push([c.x + (lean + sway * 0.25 * Math.sin(TAU * ph0 + 1)) * h * u, topOf(c) + 1 - h * u]);
    }
    poly(g, pts, stalk);
    const [tx, ty] = pts[pts.length - 1];
    eyeball(g, tx, ty - 0.5, Math.max(1, 1.1 * s), { iris: '#ffe14a' });
  }
}

function bellyMouth(ctx) {
  const { g, s, colT } = ctx;
  const c = colT(0.4);
  if (!c) return;
  const open = 0.5 + 0.5 * Math.sin(TAU * waveOf(ctx));
  const w = Math.max(2, Math.round(2.6 * s));
  const y = botOf(c) - Math.max(1, Math.round(s));
  const h = Math.max(1, Math.round(open * 1.6 * s));
  const lip = g.color('#7a2a3a');
  const maw = g.color('#2a0a12');
  const tooth = g.color('#f4f1e6');
  for (let x = c.x - w; x <= c.x + w; x++) {
    const u = 1 - Math.abs(x - c.x) / (w + 0.5);
    const hh = Math.max(0, Math.round(h * u));
    g.px(x, y - hh - 1, lip);
    for (let k = -hh; k <= hh; k++) g.px(x, y + k, maw);
    g.px(x, y + hh + 1, lip);
    if ((x - c.x) % 2 === 0 && hh >= 1) {
      g.px(x, y - hh, tooth);
      g.px(x + 1, y + hh, tooth);
    }
  }
}

function tumours(ctx, slot) {
  const { g, s, bodyCols } = ctx;
  const cols = bodyCols.filter((c) => c.t > 0.12 && c.t < 0.82);
  if (!cols.length) return;
  const k = glowOf(ctx);
  const n = 3 + Math.floor(hash01(seedOf(ctx, slot), 31) * 3);
  for (let i = 0; i < n; i++) {
    const c = cols[Math.floor(hash01(seedOf(ctx, slot), 40 + i) * cols.length)];
    const up = hash01(seedOf(ctx, slot), 60 + i) < 0.55;
    const r = (0.9 + 0.9 * hash01(seedOf(ctx, slot), 80 + i)) * Math.max(1, s * 0.9);
    const cy = up ? topOf(c) + r * 0.3 : botOf(c) - r * 0.3;
    const pulse = 0.5 + 0.5 * Math.sin(TAU * (waveOf(ctx) + i / n));
    disc(g, c.x, cy, r + 0.5, g.color(glow(0.15)));
    disc(g, c.x, cy, r, g.color(glow(0.35 + 0.45 * k * pulse)));
    g.px(Math.round(c.x - r * 0.3), Math.round(cy - r * 0.3), g.color(glow(1)));
  }
}

function xray(ctx) {
  const { g, s, ph } = ctx;
  const k = glowOf(ctx);
  const cols = colsBetween(ctx, 0.22, Math.min(0.62, ph.eyeT - 0.12));
  if (!cols.length) return;
  const bone = g.color(glow(0.75 + 0.25 * k));
  // Window: the skin goes dark and see-through, the skeleton glows inside.
  for (const c of cols) for (let y = topOf(c) + 1; y < botOf(c); y++) if (interior(ctx, c.x, y)) tint(g, c.x, y, '#0f2a24', 0.7);
  const rib = Math.max(2, Math.round(2.2 * s));
  for (const c of cols) {
    const y = Math.round(c.mid - c.back * 0.1);
    if (interior(ctx, c.x, y)) g.px(c.x, y, bone);
    if ((c.x - cols[0].x) % rib === 0) {
      for (let yy = topOf(c) + 2; yy <= botOf(c) - 2; yy++) if (interior(ctx, c.x, yy) && yy !== y) g.px(c.x, yy, g.color(glow(0.5 + 0.3 * k), 210));
    }
  }
}

function giantPec(ctx) {
  const { g, s, colT, ph, fin } = ctx;
  const c = colT(Math.max(0.45, ph.eyeT - 0.24));
  if (!c) return;
  const base = [c.x, Math.round(c.mid + c.belly * 0.2)];
  const flap = Math.sin(TAU * waveOf(ctx));
  const len = 8 * s;
  const a0 = Math.PI * (0.62 + 0.06 * flap);
  const a1 = Math.PI * (0.9 + 0.08 * flap);
  const tipA = [base[0] + Math.cos(a0) * len, base[1] + Math.sin(a0) * len];
  const tipB = [base[0] + Math.cos(a1) * len * 0.9, base[1] + Math.sin(a1) * len * 0.9];
  const mid = [(tipA[0] + tipB[0]) / 2 - s, (tipA[1] + tipB[1]) / 2 + s];
  tri(g, base, tipA, mid, fin.lit);
  tri(g, base, mid, tipB, fin.base);
  poly(g, [tipA, mid, tipB], fin.edge);
  for (const t of [tipA, mid, tipB]) g.line(base[0], base[1], t[0], t[1], fin.ray);
}

function vitiligo(ctx, slot) {
  const { g, bodyCols } = ctx;
  const k = glowOf(ctx);
  const cell = Math.max(2, Math.round(2.4 * ctx.s));
  for (const c of bodyCols) {
    for (let y = topOf(c); y <= botOf(c); y++) {
      if (!interior(ctx, c.x, y)) continue;
      const n = hash01(`${seedOf(ctx, slot)}:${Math.floor(c.x / cell)},${Math.floor(y / cell)}`, 91);
      const n2 = hash01(`${seedOf(ctx, slot)}:${Math.floor((c.x + 1) / cell)},${Math.floor((y + 1) / cell)}`, 91);
      if ((n + n2) / 2 < 0.68) continue;
      tint(g, c.x, y, glow(0.85), 0.45 + 0.4 * k);
    }
  }
}

// ---------- behind the body ---------------------------------------------------------------------

function tentacles(ctx, slot) {
  const { g, s, bodyCols } = ctx;
  const cols = bodyCols.filter((c) => c.t > 0.25 && c.t < 0.7);
  if (!cols.length) return;
  const n = 2 + Math.floor(hash01(seedOf(ctx, slot), 11) * 3);
  const flesh = g.color('#c86a8a');
  const dark = g.color('#7a3050');
  for (let i = 0; i < n; i++) {
    const c = cols[Math.round(((i + 0.5) / n) * (cols.length - 1))];
    const len = (4 + 2 * hash01(seedOf(ctx, slot), 20 + i)) * s;
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      pts.push([c.x - u * len * 0.35 + Math.sin(TAU * (waveOf(ctx) - u * 0.8 + i * 0.3)) * u * 1.6 * s, botOf(c) - 1 + u * len]);
    }
    poly(g, pts, flesh);
    if (s >= 1.5) poly(g, pts.map(([x, y]) => [x + 1, y]), dark);
    const [tx, ty] = pts[pts.length - 1];
    g.px(Math.round(tx), Math.round(ty), g.color(glow(0.6 + 0.4 * glowOf(ctx))));
  }
}

function crystals(ctx, slot) {
  const { g, s, ph } = ctx;
  const cols = colsBetween(ctx, 0.25, Math.min(0.75, ph.eyeT - 0.08));
  if (!cols.length) return;
  const k = glowOf(ctx);
  const n = 2 + Math.floor(hash01(seedOf(ctx, slot), 13) * 3);
  for (let i = 0; i < n; i++) {
    const c = cols[Math.floor(hash01(seedOf(ctx, slot), 100 + i) * cols.length)];
    const h = (3 + 3 * hash01(seedOf(ctx, slot), 120 + i)) * s;
    const lean = (hash01(seedOf(ctx, slot), 140 + i) - 0.6) * 0.8;
    const w = Math.max(1.1, 1.2 * s);
    const base = topOf(c) + 2;
    const tip = [c.x + lean * h, topOf(c) - h];
    tri(g, [c.x - w, base], [c.x + w, base], tip, g.color(glow(0.25)));
    tri(g, [c.x - w * 0.2, base], [c.x + w, base], tip, g.color(glow(0.45 + 0.4 * k)));
    g.px(Math.round(tip[0]), Math.round(tip[1] + 1), g.color(glow(1)));
  }
}

function extraDorsal(ctx) {
  const k = finK(ctx);
  edgeFin(ctx, -1, 0.56, 0.82, (u) => 3.6 * k * Math.sin(Math.PI * u) ** 0.8 * (0.5 + 0.5 * u));
}

function extraPelvics(ctx) {
  const k = finK(ctx);
  edgeFin(ctx, 1, 0.22, 0.3, (u) => 2.6 * k * u ** 0.7, { rays: false });
  edgeFin(ctx, 1, 0.6, 0.68, (u) => 2.6 * k * u ** 0.7, { rays: false });
}

function tripleTail(ctx) {
  const { g, s, bodyCols, fin } = ctx;
  const c0 = bodyCols[0];
  if (!c0) return;
  const beat = Math.sin(TAU * waveOf(ctx));
  const len = 6 * s;
  for (const dir of [-1, 1]) {
    const base = [c0.x + 1, c0.mid + dir * Math.max(1, c0.back * 0.3)];
    const ang = Math.PI + dir * (0.85 + 0.12 * beat);
    const tip = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len];
    const side = [base[0] + Math.cos(ang - dir * 0.5) * len * 0.6, base[1] + Math.sin(ang - dir * 0.5) * len * 0.6];
    tri(g, [base[0], base[1] - dir], tip, side, fin.base);
    g.line(base[0], base[1], tip[0], tip[1], fin.ray);
    poly(g, [tip, side], fin.edge);
  }
}

function spineRow(ctx) {
  const { g, s, ph, fin } = ctx;
  const cols = colsBetween(ctx, 0.12, Math.min(0.8, ph.eyeT - 0.04));
  const every = Math.max(2, Math.round(2.4 * s));
  const tipC = g.color('#e8f0d0');
  cols.forEach((c, j) => {
    if (j % every) return;
    const h = (1.8 + 0.6 * Math.sin(j)) * s + 1;
    const x1 = c.x - 0.7 * h;
    const y1 = topOf(c) - h;
    g.line(c.x, topOf(c) + 1, x1, y1, fin.edge);
    g.px(Math.round(x1), Math.round(y1), tipC);
  });
}

const FRONT = { flankEye, cyclops, stalks, bellyMouth, tumours, xray, giantPec, vitiligo };
const BEHIND = { tentacles, crystals, extraDorsal, tripleTail, extraPelvics, spineRow };

export const MUTATIONS = [
  ['flankEye', 'Flank eye'], ['cyclops', 'Cyclops eye'], ['stalks', 'Eye stalks'], ['bellyMouth', 'Belly mouth'],
  ['tumours', 'Glowing tumours'], ['xray', 'X-ray skin'], ['tentacles', 'Belly tentacles'], ['crystals', 'Isotope crystals'],
  ['extraDorsal', 'Extra dorsal'], ['tripleTail', 'Triple tail'], ['giantPec', 'Giant pectoral'], ['vitiligo', 'Glow blotches'],
  ['extraPelvics', 'Extra pelvics'], ['spineRow', 'Spine row'],
];
export const MUTATION_IDS = MUTATIONS.map(([id]) => id);

/** Chaotic genomes mutate more, stable ones less. */
export const CHAOS = { stable: 0.6, normal: 1, chaotic: 2 };

const slot = (id, label, salt, none, points, earlier, name) =>
  defineFeature({
    id,
    label,
    group: 'mutation',
    field: {
      choices: [['none', 'None'], ...MUTATIONS],
      weights: [none, ...MUTATIONS.map(() => 7)],
      salt,
      dominance: 0.45,
      volatility: 0.8,
      tierBoost: { epic: 1.2, legendary: 1.4, myth: 1.8 },
      boost: (set) => CHAOS[set.chaos] ?? 1,
    },
    when: { field: 'terrain', is: 'nuclear' },
    distinctFrom: earlier,
    layer: 'after:extras',
    behind: {
      layer: 'before:body',
      draw(ctx, value) {
        BEHIND[value]?.(ctx, id);
      },
    },
    points,
    influences: {
      stats: { stressResistance: { '*': -0.03 }, aggression: { bellyMouth: 0.08, spineRow: 0.05, tentacles: 0.04 }, curiosity: { stalks: 0.08, flankEye: 0.05, cyclops: 0.05 }, boldness: { giantPec: 0.05, tripleTail: 0.04 } },
      keys: { '*': ['mutation'], ...Object.fromEntries(MUTATION_IDS.map((m) => [m, [`mutation.${m}`]])) },
      ...(name ? { name } : {}),
    },
    draw(ctx, value) {
      FRONT[value]?.(ctx, id);
    },
  });

export const mutA = slot('mutA', 'Mutation', 3136, 12, 2, [], { prefix: 'Mutant', latin: 'mut' });
export const mutB = slot('mutB', 'Second mutation', 3152, 80, 3, ['mutA']);
export const mutC = slot('mutC', 'Third mutation', 3168, 300, 4, ['mutA', 'mutB']);
export const MUTATION_SLOTS = ['mutA', 'mutB', 'mutC'];

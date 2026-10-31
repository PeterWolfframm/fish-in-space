// The forge kit: lava fish are smiths' fish, half animal and half foundry. One piece per fish:
// obsidian shards growing out of the back, magma dripping off the belly, smoking chimney vents,
// a basalt crown of hex columns, a riveted iron jaw, or eyes of molten metal.
//
// The shards grow from behind the body (their roots are hidden by it); everything else is worn on
// top. Drips and smoke loop on `pose.wave`; the heat breathes with `pose.glow`.

import { defineFeature } from './define.js';
import { TAU, clamp, frac, mix, hash01, tint, colsBetween, topOf, botOf, disc, tri, eyeCentre, recolourEye, waveOf, glowOf } from './paint.js';

const HEAT = ['#6e1a0c', '#ff7a2a', '#ffd36b'];
const heat = (k) => (k < 0.5 ? mix(HEAT[0], HEAT[1], k * 2) : mix(HEAT[1], HEAT[2], (k - 0.5) * 2));

function obsidian(ctx) {
  const { g, s, ph } = ctx;
  const dark = g.color('#14111a');
  const mid = g.color('#2d2838');
  const glint = g.color('#b9b4d6');
  const cols = colsBetween(ctx, 0.2, Math.min(0.8, ph.eyeT - 0.05));
  const n = clamp(Math.round(cols.length / Math.max(3, 4 * s)), 3, 6);
  for (let i = 0; i < n; i++) {
    const c = cols[Math.round(((i + 0.5) / n) * (cols.length - 1))];
    if (!c) continue;
    const h = (2.5 + 2.5 * hash01(`${ph.seed}:obs:${i}`, 1)) * s + 1;
    const lean = -0.6 - 0.4 * hash01(`${ph.seed}:obs:${i}`, 2);
    const w = Math.max(1.2, 1.1 * s);
    const base = topOf(c) + 2;
    const tip = [c.x + lean * h, topOf(c) - h];
    tri(g, [c.x - w, base], [c.x + w, base], tip, dark);
    tri(g, [c.x, base], [c.x + w, base], tip, mid);
    g.px(Math.round(tip[0] + 0.3), Math.round(tip[1] + 1), glint);
  }
}

function drips(ctx) {
  const { g, s, ph, bodyCols } = ctx;
  const cols = bodyCols.filter((c) => c.t > 0.15 && c.t < ph.eyeT - 0.05);
  if (!cols.length) return;
  const n = Math.max(3, Math.round(2.5 * s));
  for (let i = 0; i < n; i++) {
    const a = hash01(`${ph.seed}:drip:${i}`, 1);
    const c = cols[Math.floor(hash01(`${ph.seed}:drip:${i}`, 2) * cols.length)];
    const p = frac(a + waveOf(ctx));
    const y0 = botOf(c);
    // A bead swells on the belly, lets go and falls, cooling as it goes.
    if (p < 0.35) {
      g.px(c.x, y0 + 1, g.color(heat(0.9)));
    } else {
      const fall = ((p - 0.35) / 0.65) * 5 * s;
      const y = Math.round(y0 + 1 + fall);
      const col = g.color(heat(1 - (p - 0.35) * 1.2), Math.round(255 - 140 * p));
      if (g.inside(c.x, y)) g.under(c.x, y, col);
      if (p < 0.6 && g.inside(c.x, y - 1)) g.under(c.x, y - 1, g.color(heat(0.6), 180));
    }
    // The glowing seep where the drop comes from.
    g.px(c.x, y0, g.color(heat(0.55 + 0.4 * glowOf(ctx))));
  }
}

function vents(ctx) {
  const { g, s, ph } = ctx;
  const n = 1 + Math.floor(hash01(`${ph.seed}:vents`, 1) * 3);
  const iron = g.color('#3a3540');
  const lip = g.color('#6a6470');
  for (let i = 0; i < n; i++) {
    const c = ctx.colT(0.3 + (0.35 * (i + 0.5)) / n);
    if (!c) continue;
    const h = Math.max(2, Math.round(2 * s));
    const top = topOf(c);
    for (let k = 0; k < h; k++) g.px(c.x, top - k, iron);
    g.px(c.x - 1, top - h + 1, lip);
    g.px(c.x + 1, top - h + 1, lip);
    g.px(c.x, top - h + 1, g.color(heat(0.5 + 0.5 * glowOf(ctx))));
    // Smoke: puffs rise, drift back and fade.
    for (let j = 0; j < 3; j++) {
      const p = frac(j / 3 + waveOf(ctx) + i * 0.17);
      const x = Math.round(c.x - p * 3 * s);
      const y = Math.round(top - h - p * 5 * s);
      const col = g.color(mix('#9a9098', '#4a4450', p), Math.round(220 - 160 * p));
      disc(g, x, y, Math.max(0.6, (0.6 + p) * s * 0.7), col, true);
    }
  }
}

function crown(ctx) {
  const { g, s, ph, colT } = ctx;
  const c0 = colT(Math.max(0.55, ph.eyeT - 0.16));
  const c1 = colT(Math.min(0.97, ph.eyeT + 0.08));
  if (!c0 || !c1) return;
  const w = Math.max(2, Math.round(1.6 * s));
  const ink = g.color('#120e10');
  let k = 0;
  for (let x = c0.x; x <= c1.x; x += w, k++) {
    const c = ctx.colAt(x) ?? c0;
    const h = Math.max(3, Math.round((2.4 + 1.8 * hash01(`${ph.seed}:crown:${k}`, 1)) * s));
    const top = topOf(c) + 1;
    for (let dx = 0; dx < w; dx++) {
      for (let y = top - h; y <= top; y++) {
        const edge = dx === 0 || y === top - h - 0;
        g.px(x + dx, y, g.color(y === top - h ? '#8a837b' : edge ? '#2a2624' : dx === w - 1 ? '#3b3734' : '#57514c'));
      }
    }
    g.px(x - 1, top - h, ink);
    // Magma glowing up between the columns.
    if (k % 2) g.px(x, top - 1, g.color(heat(0.5 + 0.5 * glowOf(ctx))));
  }
}

function ironJaw(ctx) {
  const { g, s, nose, colT, ph } = ctx;
  if (!nose) return;
  const back = colT(Math.max(0.6, ph.eyeT - 0.06)) ?? nose;
  const plate = g.color('#3e3c44');
  const lit = g.color('#b8b6c2');
  const ink = g.color('#120e10');
  const rivet = g.color('#e8c870');
  const th = Math.max(2, Math.round(1.4 * s));
  // A plate bolted over the lower jaw, jutting one pixel below and in front (an underbite).
  for (let x = back.x; x <= nose.x + 1; x++) {
    const c = ctx.colAt(Math.min(x, nose.x)) ?? nose;
    const y1 = botOf(c) + 1;
    for (let k = 0; k <= th; k++) g.px(x, y1 - k, k === 0 ? ink : k === th ? lit : plate);
  }
  const step = Math.max(2, Math.round(2.5 * s));
  for (let x = back.x + 1; x <= nose.x - 1; x += step) {
    const c = ctx.colAt(x) ?? nose;
    g.px(x, botOf(c) + 1 - Math.ceil(th / 2), rivet);
  }
}

function moltenEyes(ctx) {
  const { g } = ctx;
  const k = glowOf(ctx);
  recolourEye(ctx, { sclera: heat(0.55 + 0.4 * k), pupil: '#fff2c0' });
  const e = eyeCentre(ctx);
  if (!e) return;
  // The socket glows: a ring of heat-tinted skin round the eye, brighter as the glow breathes.
  const { eyeBox: b } = ctx;
  for (let y = Math.floor(e.y - e.r - 1.5); y <= Math.ceil(e.y + e.r + 1.5); y++) {
    for (let x = Math.floor(e.x - e.r - 1.5); x <= Math.ceil(e.x + e.r + 1.5); x++) {
      if (b && x >= b.left && x < b.left + b.size && y >= b.top && y < b.top + b.size) continue;
      const d = Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y) - e.r;
      if (d < 0 || d > 1.6) continue;
      tint(g, x, y, heat(0.7), (0.45 + 0.4 * k) * (1 - d / 2));
    }
  }
}

const FRONT = { drips, vents, crown, ironJaw, moltenEyes };

export default defineFeature({
  id: 'forgeKit',
  label: 'Forge kit',
  group: 'gear',
  field: {
    choices: [['none', 'None'], ['obsidian', 'Obsidian shards'], ['drips', 'Magma drips'], ['vents', 'Smoke vents'], ['crown', 'Basalt crown'], ['ironJaw', 'Iron jaw'], ['moltenEyes', 'Molten eyes']],
    weights: [45, 10, 10, 9, 9, 9, 8],
    salt: 3184,
    dominance: 0.55,
    volatility: 0.5,
    tierBoost: { epic: 1.3, legendary: 1.6, myth: 2 },
  },
  when: { field: 'terrain', is: 'lava' },
  layer: 'after:extras',
  behind: {
    layer: 'before:body',
    draw(ctx, value) {
      if (value === 'obsidian') obsidian(ctx);
    },
  },
  points: 3,
  influences: {
    stats: { boldness: { '*': 0.04, crown: 0.06, ironJaw: 0.08 }, stressResistance: { obsidian: 0.06, vents: 0.04 }, aggression: { ironJaw: 0.06, moltenEyes: 0.04 } },
    keys: { '*': ['forgeKit'], obsidian: ['forgeKit.obsidian'], drips: ['forgeKit.drips'], vents: ['forgeKit.vents'], crown: ['forgeKit.crown'], ironJaw: ['forgeKit.ironJaw'], moltenEyes: ['forgeKit.moltenEyes'] },
    name: { prefix: 'Forged', latin: 'ferro' },
  },
  draw(ctx, value) {
    FRONT[value]?.(ctx);
  },
});


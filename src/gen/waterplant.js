// Tank plants for fish.: kelp, eelgrass, ferns, swords, moss balls and sea fans that sway in a
// seamless loop. New here — fish. lost its seaweed when the old vector background went.
//
// The genome's code fully describes the sprite: layout details (how many blades, their lean) roll
// from the code, not the seed, and the `variant` field exists only to give those rolls 36
// different starting points. So a shared code is the exact plant, and a mutation can change it.

import { defineTraits } from '../pixel/traits.js';
import { Grid } from '../pixel/grid.js';
import { roller } from '../pixel/rng.js';
import { shade, mix } from '../pixel/color.js';
import { walk, pointOn, blade, LEAF_SHAPES } from './plants/stroke.js';

export const WATERPLANT_W = 32;
export const WATERPLANT_H = 48;
export const SWAY_FRAMES = 8;

const BASE_Y = WATERPLANT_H - 3;
const CX = WATERPLANT_W / 2;

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));
const swatches = (...rows) => rows.map(([id, hex, label]) => ({ id, hex, label }));
const isRare = (set) => set.rarity === 'rare' || set.rarity === 'myth';

/** Leaf colours. Water swallows saturation, so these run a little brighter than land plants. */
export const LEAF_COLORS = swatches(
  ['grass', '#4fa83d', 'Grass'],
  ['deep', '#2c7a3f', 'Deep green'],
  ['olive', '#7d8a35', 'Olive'],
  ['lime', '#9ccf3e', 'Lime'],
  ['teal', '#2a9c8a', 'Teal'],
  ['ruby', '#c0394a', 'Ruby'],
  ['rust', '#c0662c', 'Rust'],
  ['plum', '#8a3f8f', 'Plum'],
  ['gold', '#d6a93a', 'Gold'],
  ['kelp', '#8a6a2a', 'Kelp brown'],
);

const GLOW_COLORS = { tips: '#7ff7e8', veins: '#b8ff8a', full: '#ffb8f0' };

export const waterplantTraits = defineTraits({
  prefix: 'w',
  fields: [
    { id: 'rarity', label: 'Rarity', group: 'identity', choices: opts(['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['myth', 'Mythic']), weights: [70, 22, 7, 1], salt: 16, volatility: 0.25 },
    {
      id: 'form', label: 'Form', group: 'shape', salt: 32,
      choices: opts(['kelp', 'Kelp'], ['eelgrass', 'Eelgrass'], ['fern', 'Java fern'], ['anubias', 'Anubias'], ['cabomba', 'Cabomba'], ['sword', 'Sword plant'], ['mossball', 'Moss ball'], ['fan', 'Sea fan']),
      weights: [16, 18, 14, 12, 12, 14, 6, 8],
    },
    { id: 'height', label: 'Height', group: 'shape', salt: 48, choices: opts(['short', 'Short'], ['medium', 'Medium'], ['tall', 'Tall']), weights: [30, 40, 30], default: 'medium', volatility: 1.4 },
    { id: 'leaf', label: 'Leaf width', group: 'shape', salt: 64, choices: opts(['narrow', 'Narrow'], ['medium', 'Medium'], ['broad', 'Broad']), weights: [30, 45, 25], default: 'medium' },
    { id: 'density', label: 'Density', group: 'shape', salt: 80, choices: opts(['sparse', 'Sparse'], ['even', 'Even'], ['lush', 'Lush']), weights: [25, 50, 25], default: 'even', volatility: 1.3 },
    { id: 'color', label: 'Colour', group: 'colour', colors: true, salt: 96, choices: LEAF_COLORS, weights: [20, 16, 10, 10, 10, 6, 6, 4, 4, 8] },
    { id: 'tint', label: 'Markings', group: 'colour', salt: 112, choices: opts(['none', 'None'], ['tips', 'Light tips'], ['dark', 'Dark tips'], ['veins', 'Veins'], ['spots', 'Spots']), weights: [30, 20, 18, 18, 14] },
    { id: 'base', label: 'Base', group: 'scene', salt: 128, choices: opts(['none', 'Bare'], ['pebble', 'Pebbles'], ['rock', 'Rock'], ['wood', 'Driftwood']), weights: [40, 30, 18, 12] },
    { id: 'glow', label: 'Glow', group: 'rare', salt: 144, choices: opts(['none', 'None'], ['tips', 'Glowing tips'], ['veins', 'Glowing veins'], ['full', 'Luminous']), weights: [30, 30, 25, 15], when: isRare, gateHint: 'needs a rare plant', dominance: 0.25 },
    { id: 'bubbles', label: 'Bubbles', group: 'rare', salt: 160, choices: opts(['no', 'None'], ['yes', 'Oxygen bubbles']), weights: [50, 50], when: isRare, gateHint: 'needs a rare plant' },
    { id: 'variant', label: 'Variant', group: 'identity', salt: 176, choices: Array.from({ length: 36 }, (_, i) => ({ id: `v${i}`, label: `#${i + 1}` })), volatility: 2 },
  ],
});

const HEIGHT = { short: 0.55, medium: 0.78, tall: 1 };
const LEAF_W = { narrow: 0.7, medium: 1, broad: 1.4 };
const COUNT = { sparse: 0.7, even: 1, lush: 1.4 };

/** The palette and the per-sprite rolls every form draws from. */
function setup(g, genome) {
  const set = waterplantTraits.normalize(genome);
  const roll = roller(waterplantTraits.encode(set), 3000);
  const hex = waterplantTraits.choiceOf(set, 'color').hex;
  const glow = set.glow !== 'none' ? GLOW_COLORS[set.glow] : null;
  const c = {
    dark: g.color(shade(hex, 0.62)),
    base: g.color(hex),
    light: g.color(shade(hex, 1.28)),
    pale: g.color(shade(hex, 1.55)),
    deep: g.color(shade(hex, 0.45)),
    glow: glow ? g.color(glow) : null,
    glowSoft: glow ? g.color(mix(glow, hex, 0.45)) : null,
  };
  if (set.glow === 'full') {
    // A luminous plant is lit from inside: the whole ramp lifts toward the glow.
    c.base = g.color(mix(hex, glow, 0.35));
    c.light = g.color(mix(hex, glow, 0.7));
    c.dark = g.color(mix(shade(hex, 0.7), glow, 0.2));
  }
  const height = (BASE_Y - 4) * HEIGHT[set.height];
  return { set, roll, c, height, leafW: LEAF_W[set.leaf], count: COUNT[set.density] };
}

/** Light tips, dark tips, veins, spots and glow on top of the plain left/right shading. */
function toner(env, phase) {
  const { set, c } = env;
  return (u, side, x = 0, y = 0) => {
    if (side === 'rib') {
      if (set.glow === 'veins') return c.glow;
      return set.tint === 'veins' ? c.pale : c.dark;
    }
    if (u > 0.86 && set.glow === 'tips') return (Math.floor(phase * 2) + Math.round(u * 20)) % 3 ? c.glow : c.glowSoft;
    if (u > 0.8 && set.tint === 'tips') return c.pale;
    if (u > 0.78 && set.tint === 'dark') return c.deep;
    if (u < 0.1) return c.dark;
    return side === -1 ? c.light : side === 1 ? c.dark : c.base;
  };
}

/** Sway for something rooted at the base: nothing there, most at the tip, a wave travelling up. */
const swayer = (phase, amp, offset = 0, wave = 2.2) => (u) => Math.sin(phase + offset - u * wave) * amp * u * u;

function kelp(g, env, phase) {
  const { roll, height, leafW, count } = env;
  const tone = toner(env, phase);
  const n = Math.max(1, Math.round(roll.int(1, 3, 1) * count));
  for (let i = 0; i < n; i++) {
    const x = CX + (i - (n - 1) / 2) * 5 + roll.range(-1.5, 1.5, 10 + i);
    const len = height * roll.range(0.75, 1, 20 + i);
    const w = 4.6 * leafW * roll.range(0.85, 1.15, 30 + i);
    const stroke = {
      x, y: BASE_Y, len, angle: roll.range(-0.12, 0.12, 40 + i), bend: roll.range(-0.3, 0.3, 50 + i),
      width: (u) => (u < 0.08 ? 1 : w * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15)))),
      sway: swayer(phase, 3.2, i * 1.3),
    };
    blade(g, stroke, tone, { rib: true });
    // Gas bladders where a frond meets the stipe.
    const bladders = Math.floor(len / 9);
    for (let b = 1; b <= bladders; b++) {
      const u = b / (bladders + 1);
      const p = pointOn(stroke, u);
      const side = b % 2 ? -1 : 1;
      const bx = Math.round(p.x + stroke.sway(u) + side * (w / 2 + 0.5));
      g.ellipse(bx + 0.5, p.y, 1.3, 1.3, env.c.light);
    }
  }
}

function eelgrass(g, env, phase) {
  const { roll, height, leafW, count } = env;
  const tone = toner(env, phase);
  const n = Math.round(roll.int(5, 8, 1) * count);
  for (let i = 0; i < n; i++) {
    const x = CX + roll.range(-5, 5, 10 + i);
    const len = height * roll.range(0.55, 1.05, 20 + i);
    const lean = roll.range(-0.35, 0.35, 30 + i);
    blade(g, {
      x, y: BASE_Y, len, angle: lean, bend: lean * roll.range(0.8, 2.2, 40 + i),
      width: (u) => (leafW > 1 ? 2 : 1.4) * (1 - u * 0.4),
      sway: swayer(phase, 2.6, roll.range(0, 6.28, 50 + i)),
    }, tone);
  }
}

/** A rosette of leaves fanning out of the base: java fern, anubias and the sword plant. */
function rosette(g, env, phase, { leaves, spread, len, width, shape, droop, rib }) {
  const { roll } = env;
  const tone = toner(env, phase);
  // Back leaves first, so the ones nearer the middle sit in front.
  const order = Array.from({ length: leaves }, (_, i) => i).sort((a, b) => Math.abs(b - (leaves - 1) / 2) - Math.abs(a - (leaves - 1) / 2));
  for (const i of order) {
    const t = leaves === 1 ? 0 : i / (leaves - 1) - 0.5;
    const angle = t * spread * 2 + roll.range(-0.12, 0.12, 10 + i);
    const l = len * roll.range(0.75, 1.05, 20 + i) * (1 - Math.abs(t) * 0.35);
    const w = width * roll.range(0.85, 1.15, 30 + i);
    blade(g, {
      x: CX + t * 3, y: BASE_Y, len: l, angle, bend: angle * 0.7 * droop,
      droop: droop * l * 0.18 * Math.abs(Math.sin(angle)),
      width: (u) => (u < 0.12 ? 1 : w * shape(Math.min(1, (u - 0.12) / 0.88))),
      sway: swayer(phase, 1.4 + Math.abs(t) * 1.4, i * 0.9),
    }, tone, { rib });
  }
}

function fern(g, env, phase) {
  const { roll, height, leafW, count } = env;
  rosette(g, env, phase, {
    leaves: Math.round(roll.int(4, 6, 1) * count), spread: 0.5, len: height * 0.85, width: 4.2 * leafW,
    shape: LEAF_SHAPES.lance, droop: 1.2, rib: true,
  });
  // The rhizome: a dark knot the leaves come out of.
  g.rect(CX - 3, BASE_Y - 1, 7, 2, env.c.deep);
}

function anubias(g, env, phase) {
  const { roll, height, leafW, count } = env;
  rosette(g, env, phase, {
    leaves: Math.round(roll.int(3, 5, 1) * count), spread: 0.85, len: Math.min(height, 22) * 0.75, width: 6.5 * leafW,
    shape: LEAF_SHAPES.oval, droop: 0.6, rib: true,
  });
}

function sword(g, env, phase) {
  const { roll, height, leafW, count } = env;
  rosette(g, env, phase, {
    leaves: Math.round(roll.int(5, 8, 1) * count), spread: 0.55, len: height * 0.95, width: 4.6 * leafW,
    shape: LEAF_SHAPES.lance, droop: 1.1, rib: true,
  });
}

function cabomba(g, env, phase) {
  const { roll, height, leafW, count, c } = env;
  const n = Math.max(1, Math.round(roll.int(2, 3, 1) * count));
  for (let i = 0; i < n; i++) {
    const stem = {
      x: CX + (i - (n - 1) / 2) * 6 + roll.range(-1, 1, 10 + i), y: BASE_Y, len: height * roll.range(0.75, 1, 20 + i),
      angle: roll.range(-0.15, 0.15, 30 + i), bend: roll.range(-0.25, 0.25, 40 + i), sway: swayer(phase, 2.4, i * 1.7),
    };
    walk(stem, (x, y) => g.px(x, y, c.dark));
    // Whorls of thread-fine leaves, bigger lower down.
    const whorls = Math.floor(stem.len / 4);
    for (let k = 1; k <= whorls; k++) {
      const u = k / (whorls + 0.5);
      const p = pointOn(stem, u);
      const sx = p.x + stem.sway(u);
      const r = (3.4 - u * 1.6) * leafW;
      for (const dir of [-1, 1]) {
        for (let f = 0; f < 3; f++) {
          const a = dir * (0.9 + f * 0.45) - 0.3 * dir * u;
          const tip = u > 0.86 && env.set.glow === 'tips';
          walk({ x: sx, y: p.y, angle: a, len: r * (1 - f * 0.18) }, (x, y, v) => g.px(x, y, tip ? c.glow : v > 0.6 ? c.light : c.base));
        }
      }
    }
  }
}

function mossball(g, env, phase) {
  const { roll, leafW, c, set } = env;
  // Marimo: a ball that breathes rather than sways.
  const r = 6 + (set.height === 'tall' ? 3 : set.height === 'medium' ? 1.5 : 0) * leafW;
  const squash = Math.sin(phase) * 0.35;
  const cy = BASE_Y - r + 0.5 + squash;
  g.ellipse(CX, cy, r + squash * 0.5, r - squash, c.base);
  g.dither(Math.floor(CX - r - 1), Math.floor(cy - r - 1), Math.ceil(r * 2 + 3), Math.ceil(r * 2 + 3), c.dark, 0.35, (x, y) => g.get(x, y) !== 0 && (x + 0.5 - CX) + (y - cy) * 0.4 > -r * 0.2);
  g.dither(Math.floor(CX - r - 1), Math.floor(cy - r - 1), Math.ceil(r * 2 + 3), Math.ceil(r * 2 + 3), c.light, 0.45, (x, y) => g.get(x, y) !== 0 && (x + 0.5 - CX) + (y - cy) < -r * 0.6);
  // A fuzzy rim: single threads poking out.
  for (let k = 0; k < 14; k++) {
    const a = roll.range(0, Math.PI * 2, 10 + k);
    if (Math.sin(a) > 0.7) continue;
    g.px(Math.floor(CX + Math.cos(a) * (r + 0.6)), Math.floor(cy + Math.sin(a) * (r + 0.6)), k % 2 ? c.base : c.light);
  }
  if (set.glow !== 'none') for (let k = 0; k < 5; k++) g.px(Math.floor(CX + roll.range(-r / 2, r / 2, 40 + k)), Math.floor(cy + roll.range(-r / 2, r / 2, 50 + k)), c.glow);
}

function fan(g, env, phase) {
  const { roll, height, leafW, count, c } = env;
  // A gorgonian: one trunk that forks and forks again into a flat fan.
  const tone = toner(env, phase);
  // Sway by height in the whole fan (v 0..1), so a twig moves with the branch it grows from.
  const sway = swayer(phase, 2.2, 0, 1.2);
  let salt = 100;
  const branch = (x, y, angle, len, depth, v0) => {
    const lf = len / height;
    const stroke = { x, y, angle, len, bend: roll.range(-0.25, 0.25, salt++), width: () => (depth ? 1 : Math.max(1, 1.8 * leafW)), sway: (u) => sway(v0 + lf * u) };
    blade(g, stroke, (u, side) => tone(Math.min(0.99, v0 + lf * u), side));
    if (depth >= 3 + (count > 1 ? 1 : 0)) {
      const tip = pointOn(stroke, 1);
      g.px(Math.floor(tip.x + stroke.sway(1)), Math.floor(tip.y), env.set.glow !== 'none' ? c.glow : c.light);
      return;
    }
    const kids = roll.chance(0.25 * count, salt++) ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const at = roll.range(0.75, 1, salt++);
      const p = pointOn(stroke, at);
      const a = angle * 0.5 + (k - (kids - 1) / 2) * roll.range(0.75, 1, salt++);
      branch(p.x, p.y, a, len * roll.range(0.72, 0.9, salt++), depth + 1, v0 + lf * at);
    }
  };
  branch(CX, BASE_Y, roll.range(-0.1, 0.1, 1), height * 0.3, 0, 0);
}

const FORMS = { kelp, eelgrass, fern, anubias, cabomba, sword, mossball, fan };

function base(g, env) {
  const { set, roll } = env;
  if (set.base === 'pebble') {
    for (let k = 0; k < 4; k++) {
      const x = CX + roll.range(-9, 9, 200 + k);
      const tone = g.color(['#8a8f96', '#a69a86', '#6d7480', '#b8b2a6'][k]);
      g.ellipse(x, BASE_Y + 0.5, roll.range(1.4, 2.4, 210 + k), 1.4, tone);
    }
  } else if (set.base === 'rock') {
    const rock = g.color('#6f7682');
    const lit = g.color('#9aa2ad');
    g.ellipse(CX + roll.range(-3, 3, 220), BASE_Y - 1, 8, 3.5, rock, (x, y) => y <= BASE_Y + 1);
    g.dither(0, BASE_Y - 6, WATERPLANT_W, 4, lit, 0.4, (x, y) => g.get(x, y) === rock);
  } else if (set.base === 'wood') {
    const wood = g.color('#6b4a2b');
    const grain = g.color('#8c6740');
    g.rect(CX - 11, BASE_Y - 1, 22, 3, wood);
    g.rect(CX - 9, BASE_Y, 14, 1, grain);
    g.rect(CX + 7, BASE_Y - 3, 2, 2, wood);
  }
}

function bubbles(g, env, frame) {
  if (env.set.bubbles !== 'yes') return;
  const bubble = g.color('#dff6ff');
  const rim = g.color('#9fd8f0');
  // Each bubble rises a whole number of loop-lengths per loop, so frame 8 lands on frame 0.
  for (let k = 0; k < 3; k++) {
    const travel = WATERPLANT_H - 8;
    const y = BASE_Y - 6 - ((env.roll.range(0, travel, 300 + k) + (frame / SWAY_FRAMES) * travel * (k + 1)) % travel);
    const x = CX + env.roll.range(-7, 7, 310 + k) + Math.round(Math.sin((frame / SWAY_FRAMES) * Math.PI * 2 + k));
    g.px(Math.floor(x), Math.floor(y), bubble);
    g.px(Math.floor(x) + 1, Math.floor(y), rim);
    if (k === 0) g.px(Math.floor(x), Math.floor(y) - 1, rim);
  }
}

/** One frame of the sway loop. Frame `SWAY_FRAMES` is frame 0 again. */
export function drawWaterplant(genome, frame = 0) {
  const g = new Grid(WATERPLANT_W, WATERPLANT_H);
  const env = setup(g, genome);
  const f = ((frame % SWAY_FRAMES) + SWAY_FRAMES) % SWAY_FRAMES;
  const phase = (f / SWAY_FRAMES) * Math.PI * 2;
  FORMS[env.set.form](g, env, phase);
  base(g, env);
  g.outline(g.color(shade(waterplantTraits.choiceOf(env.set, 'color').hex, 0.28)));
  bubbles(g, env, f);
  return g.out();
}

export const waterplantFromSeed = (seed) => waterplantTraits.fromSeed(seed);

export default {
  id: 'waterplant',
  label: 'Tank plants',
  game: 'fish.',
  size: { w: WATERPLANT_W, h: WATERPLANT_H },
  bg: '#1e3c5a',
  traits: waterplantTraits,
  fromSeed: waterplantFromSeed,
  anims: [{ id: 'sway', frames: SWAY_FRAMES, fps: 6 }],
  frame: (genome, _anim, i = 0) => drawWaterplant(genome, i),
};

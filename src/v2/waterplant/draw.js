// Tank plants v2: v1's forms rebuilt as lit strokes on a Surface, with depth (back blades darker
// and bluer, as water swallows light), folded leaves that catch the light on one half, a shaded
// bed, and size classes at constant pixel density: a huge plant gets more blades and more
// leaves, not fatter pixels. Three new forms: carpet (wide ground cover), lily, stem plant.
//
// Pure: genome + pose in, IndexedImage out.

import { shade, mix } from '../../pixel/color.js';
import { roller } from '../../pixel/rng.js';
import { Surface, pointAt } from '../kit/surface.js';
import { styleOf } from '../kit/style.js';
import { ellipse, capsule } from '../kit/shapes.js';
import { noise2 } from '../kit/noise.js';
import { roundUp } from '../kit/sizes.js';
import { rest } from '../anim/rig.js';
import { LEAF_SHAPES } from '../../gen/plants/stroke.js';
import { waterplant2Traits, identityCode } from './traits.js';

const TAU = Math.PI * 2;
const WATER = '#1e3c5a';
const GLOW = { tips: '#7ff7e8', veins: '#b8ff8a', full: '#ffb8f0' };
const FLOWER = { white: '#f4f1e8', pink: '#f08ab8', gold: '#f2c84b' };

/** Canvas height per size class; v1's tank plant is `medium`. */
export const CLASS_H = { small: 32, medium: 48, large: 80, huge: 128 };
/** Canvas width and height relative to the class height, per form. */
const FRAME = {
  kelp: [0.62, 1], eelgrass: [0.66, 1], fern: [0.75, 1], anubias: [0.9, 0.75], cabomba: [0.66, 1], sword: [0.8, 1],
  mossball: [0.66, 0.5], fan: [1, 1], carpet: [1.5, 0.42], lily: [0.8, 1], stem: [0.66, 1],
};

const HEIGHT = { short: 0.58, medium: 0.8, tall: 1 };
const LEAF_W = { narrow: 0.7, medium: 1, broad: 1.4 };
const COUNT = { sparse: 0.7, even: 1, lush: 1.4 };

/** The canvas for a genome. */
export function plantCanvas(genome) {
  const set = waterplant2Traits.normalize(genome);
  const H = CLASS_H[set.size] ?? 48;
  const [fw, fh] = FRAME[set.form] ?? [0.66, 1];
  return { w: roundUp(H * fw, 4), h: roundUp(H * fh, 4) };
}

function setup(s, genome, pose) {
  const set = waterplant2Traits.normalize(genome);
  const roll = roller(identityCode(set), 3000);
  const H = CLASS_H[set.size] ?? 48;
  const k = H / 48;
  const hex = waterplant2Traits.choiceOf(set, 'color').hex;
  const glowHex = set.glow !== 'none' ? GLOW[set.glow] : null;
  const leafHex = set.glow === 'full' ? mix(hex, glowHex, 0.35) : hex;
  const bedH = set.base === 'sand' || set.base === 'gravel' ? Math.max(2, Math.round(3 * k)) : Math.max(2, Math.round(2.5 * k));
  const baseY = s.h - bedH;
  // Three depths of leaf: back (darker, bluer), middle, front.
  const depthMat = [0.5, 0.25, 0].map((d) => s.material(mix(shade(leafHex, 1 - d * 0.5), WATER, d), { steps: 5, shift: 22 }));
  const m = {
    depth: depthMat,
    tip: s.material(shade(leafHex, 1.45), { steps: 4 }),
    deep: s.material(shade(leafHex, 0.55), { steps: 4 }),
    vein: s.material(set.glow === 'veins' ? glowHex : set.tint === 'veins' ? shade(leafHex, 1.5) : shade(leafHex, 0.72), { steps: 3, dark: 0.25 }),
    stem: s.material(shade(leafHex, 0.7), { steps: 4 }),
    glow: glowHex ? s.material(glowHex, { steps: 3, dark: 0.15, light: 0.7 }) : null,
    flower: set.flower !== 'none' ? s.material(FLOWER[set.flower], { steps: 5, shift: 18 }) : null,
  };
  return {
    s, set, roll, k, H, m, hex: leafHex, glowHex, pose,
    cx: s.w / 2,
    baseY,
    height: (baseY - Math.max(3, 2 * k)) * HEIGHT[set.height],
    leafW: LEAF_W[set.leaf] * k ** 0.6,
    count: COUNT[set.density] * k ** 0.55,
    phase: pose.wind * TAU,
  };
}

/** Sway for something rooted at its base: none there, most at the tip, a wave travelling up. */
function swayer(env, amp, offset = 0, wave = 2.2) {
  const { phase, pose, k } = env;
  const a = amp * pose.sway * k ** 0.8;
  const lean = pose.lean * 8 * k ** 0.8;
  return (u) => (Math.sin(phase + offset - u * wave) * a + lean) * u * u + Math.sin(pose.flutter * TAU + offset * 3) * 0.6 * u ** 4;
}

/** A blade's material along it: markings, glow, depth. `rib` paints a midrib. */
function bladeMat(env, depth, { rib = false } = {}) {
  const { set, m } = env;
  const body = m.depth[depth];
  return (u, a) => {
    if (rib && Math.abs(a) < 0.18 && u > 0.08 && u < 0.92) return m.vein;
    if (m.glow && set.glow === 'tips' && u > 0.84) return m.glow;
    if (set.tint === 'tips' && u > 0.8) return m.tip;
    if (set.tint === 'dark' && u > 0.78) return m.deep;
    return body;
  };
}

function blade(env, st, depth, opts = {}) {
  const { s } = env;
  return s.stroke(st, { mat: bladeMat(env, depth, opts), profile: opts.profile ?? (opts.rib ? 'fold' : 'round'), bias: (depth - 2) * 0.06 });
}

const depthOf = (i, n) => (n <= 2 ? 2 : i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2);

function kelp(env) {
  const { roll, height, leafW, count, cx, baseY, s, m, k } = env;
  const n = Math.max(1, Math.round(roll.int(1, 3, 1) * count));
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => depthOf(a, n) - depthOf(b, n));
  for (const i of order) {
    const d = depthOf(i, n);
    const x = cx + (i - (n - 1) / 2) * 5 * k ** 0.7 + roll.range(-1.5, 1.5, 10 + i);
    const len = height * roll.range(0.75, 1, 20 + i) * (d === 0 ? 0.92 : 1);
    const w = 4.6 * leafW * roll.range(0.85, 1.15, 30 + i);
    const st = {
      x, y: baseY, len, angle: roll.range(-0.12, 0.12, 40 + i), bend: roll.range(-0.3, 0.3, 50 + i),
      width: (u) => (u < 0.08 ? Math.max(1, k * 0.8) : w * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15)))),
      sway: swayer(env, 3.2, i * 1.3),
    };
    blade(env, st, d, { rib: true, profile: 'fold' });
    // Gas bladders where a frond meets the stipe.
    const bladders = Math.floor(len / (9 * k ** 0.4));
    for (let b = 1; b <= bladders; b++) {
      const u = b / (bladders + 1);
      const p = pointAt(st, u);
      const side = b % 2 ? -1 : 1;
      const r = Math.max(1.2, 1.3 * k ** 0.6);
      const e = ellipse(p.x + side * (st.width(u) / 2 + r * 0.6), p.y, r, r);
      s.fill(e, { box: e.box, mat: m.tip });
    }
  }
}

function eelgrass(env) {
  const { roll, height, leafW, count, cx, baseY, k } = env;
  const n = Math.round(roll.int(5, 8, 1) * count);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => depthOf(a, n) - depthOf(b, n));
  for (const i of order) {
    const x = cx + roll.range(-5, 5, 10 + i) * k ** 0.8;
    const len = height * roll.range(0.55, 1.05, 20 + i);
    const lean = roll.range(-0.35, 0.35, 30 + i);
    const w = (leafW > 1 ? 2.2 : 1.6) * Math.max(1, leafW);
    blade(env, {
      x, y: baseY, len, angle: lean, bend: lean * roll.range(0.8, 2.2, 40 + i),
      width: (u) => w * (1 - u * 0.45),
      sway: swayer(env, 2.6, roll.range(0, 6.28, 50 + i)),
    }, depthOf(i, n), { profile: 'flat' });
  }
}

/** Leaves fanning out of the base: java fern, anubias, the sword plant. */
function rosette(env, { leaves, spread, len, width, shape, droop }) {
  const { roll, cx, baseY, k, s, m } = env;
  const order = Array.from({ length: leaves }, (_, i) => i).sort((a, b) => Math.abs(b - (leaves - 1) / 2) - Math.abs(a - (leaves - 1) / 2));
  order.forEach((i, rank) => {
    const t = leaves === 1 ? 0 : i / (leaves - 1) - 0.5;
    const angle = t * spread * 2 + roll.range(-0.12, 0.12, 10 + i);
    const l = len * roll.range(0.75, 1.05, 20 + i) * (1 - Math.abs(t) * 0.35);
    const w = width * roll.range(0.85, 1.15, 30 + i);
    const d = rank < leaves / 3 ? 0 : rank < (leaves * 2) / 3 ? 1 : 2;
    blade(env, {
      x: cx + t * 3 * k, y: baseY, len: l, angle, bend: angle * 0.7 * droop,
      droop: droop * l * 0.18 * Math.abs(Math.sin(angle)),
      width: (u) => (u < 0.12 ? Math.max(1, k * 0.7) : w * shape(Math.min(1, (u - 0.12) / 0.88))),
      sway: swayer(env, 1.4 + Math.abs(t) * 1.4, i * 0.9),
    }, d, { rib: true });
  });
  return { s, m };
}

function fern(env) {
  const { roll, height, leafW, count, cx, baseY, k, s, m } = env;
  rosette(env, { leaves: Math.round(roll.int(4, 6, 1) * count), spread: 0.5, len: height * 0.85, width: 4.2 * leafW, shape: LEAF_SHAPES.lance, droop: 1.2 });
  // The rhizome: a knobbly root the leaves come out of.
  const r = capsule(cx - 3.5 * k, baseY - 0.5, cx + 3.5 * k, baseY - 0.5, Math.max(1, 1.2 * k));
  s.fill(r, { box: r.box, mat: m.deep });
}

function anubias(env) {
  const { roll, height, leafW, count } = env;
  rosette(env, { leaves: Math.round(roll.int(3, 5, 1) * count), spread: 0.85, len: height * 0.7, width: 6.5 * leafW, shape: LEAF_SHAPES.oval, droop: 0.6 });
}

function sword(env) {
  const { roll, height, leafW, count } = env;
  rosette(env, { leaves: Math.round(roll.int(5, 8, 1) * count), spread: 0.55, len: height * 0.95, width: 4.6 * leafW, shape: LEAF_SHAPES.lance, droop: 1.1 });
  flowerSpike(env, 0.05);
}

/** A flower on a thin stalk above the leaves (swords, stems): only with the flower trait. */
function flowerSpike(env, angle) {
  const { s, m, cx, baseY, height, k } = env;
  if (!m.flower) return;
  const st = { x: cx, y: baseY, len: height * 1.02, angle, bend: 0.1, width: () => 1, sway: swayer(env, 2) };
  s.stroke(st, { mat: m.stem });
  for (const u of [0.72, 0.86, 1]) {
    const p = pointAt(st, u);
    const r = Math.max(1, 1.4 * k ** 0.6);
    const e = ellipse(p.x, p.y, r, r * 0.85);
    s.fill(e, { box: e.box, mat: m.flower });
  }
}

/** Stems with whorls of fine leaves (cabomba) or opposite pairs of round ones (stem). */
function stems(env, kind) {
  const { roll, height, leafW, count, cx, baseY, k, s, m, set } = env;
  const n = Math.max(1, Math.round(roll.int(2, 3, 1) * count));
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => depthOf(a, n) - depthOf(b, n));
  // Stem plants redden toward the light, like rotala.
  const topMat = kind === 'stem' ? s.material(mix(env.hex, '#d0503c', 0.5), { steps: 5, shift: 20 }) : null;
  for (const i of order) {
    const d = depthOf(i, n);
    const st = {
      x: cx + (i - (n - 1) / 2) * 6 * k ** 0.7 + roll.range(-1, 1, 10 + i), y: baseY, len: height * roll.range(0.75, 1, 20 + i),
      angle: roll.range(-0.15, 0.15, 30 + i), bend: roll.range(-0.25, 0.25, 40 + i), width: () => Math.max(1, 0.9 * k ** 0.5), sway: swayer(env, 2.4, i * 1.7),
    };
    s.stroke(st, { mat: m.stem });
    const gap = (kind === 'stem' ? 3 : 4) * k ** 0.5;
    const nodes = Math.floor(st.len / gap);
    for (let j = 1; j <= nodes; j++) {
      const u = j / (nodes + 0.5);
      const p = pointAt(st, u);
      const mat = topMat && u > 0.65 ? topMat : m.depth[d];
      if (kind === 'stem') {
        const r = (2.6 - u * 0.9) * leafW;
        for (const dir of [-1, 1]) {
          const a = dir * (1.25 - u * 0.4) + (j % 2 ? 0.15 : -0.15);
          s.stroke({ x: p.x, y: p.y, angle: a, len: r * 1.8, bend: -dir * 0.3, width: (v) => Math.max(1, r * LEAF_SHAPES.oval(v)) }, { mat, profile: 'fold' });
        }
      } else {
        const r = (3.4 - u * 1.6) * leafW;
        for (const dir of [-1, 1]) {
          for (let f = 0; f < 3; f++) {
            const a = dir * (0.9 + f * 0.45) - 0.3 * dir * u;
            const tip = u > 0.86 && set.glow === 'tips' && m.glow;
            s.stroke({ x: p.x, y: p.y, angle: a, len: r * (1 - f * 0.18), width: () => 1 }, { mat: tip ? m.glow : mat, seam: false });
          }
        }
      }
    }
  }
  if (kind === 'stem') flowerSpike(env, -0.05);
}

function mossball(env) {
  const { s, m, cx, baseY, k, set, pose, roll } = env;
  const r = Math.min(s.w / 2 - 2, (baseY - 2) / 2) * (set.height === 'tall' ? 1 : set.height === 'medium' ? 0.88 : 0.75);
  // Marimo breathe rather than sway.
  const squash = Math.sin(env.phase) * 0.35 * k ** 0.5;
  const cy = baseY - r + squash;
  const e = ellipse(cx, cy, r + squash * 0.5, r - squash);
  s.fill(e, { box: e.box, mat: m.depth[2] });
  const fuzz = noise2(identityCode(set), Math.max(1.5, k * 1.2));
  s.tone((x, y) => e(x, y) && fuzz(x, y) > 0.66, -1, { box: e.box });
  s.tone((x, y) => e(x, y) && fuzz(x + 40, y) > 0.75, 1, { box: e.box });
  // A fuzzy rim: threads poking out.
  const threads = Math.round(14 * k);
  for (let j = 0; j < threads; j++) {
    const a = roll.range(0, TAU, 10 + j);
    if (Math.sin(a) > 0.6) continue;
    s.set(cx + Math.cos(a) * (r + 0.6), cy + Math.sin(a) * (r + 0.6), m.depth[1], 0.6);
  }
  if (m.glow) for (let j = 0; j < 5 * k; j++) s.pin(cx + roll.range(-r / 2, r / 2, 40 + j), cy + roll.range(-r / 2, r / 2, 60 + j), s.color(env.glowHex));
}

function fan(env) {
  const { roll, height, leafW, count, cx, baseY, k, s, m, set } = env;
  const sway = swayer(env, 2.2, 0, 1.2);
  const maxDepth = 3 + (count > 1 ? 1 : 0) + (k >= 1.6 ? 1 : 0);
  let salt = 100;
  const branch = (x, y, angle, len, depth, v0) => {
    const lf = len / height;
    const st = {
      x, y, angle, len, bend: roll.range(-0.25, 0.25, salt++),
      width: () => Math.max(1, (1.9 - depth * 0.35) * leafW),
      sway: (u) => sway(v0 + lf * u) - sway(v0),
    };
    const at0 = { ...st, x: x + sway(v0) };
    s.stroke(at0, { mat: (u) => (m.glow && set.glow === 'tips' && depth === maxDepth && u > 0.6 ? m.glow : m.depth[Math.min(2, depth)]), seam: depth > 0 });
    if (depth >= maxDepth) return;
    const kids = roll.chance(0.25 * Math.min(1.4, count), salt++) ? 3 : 2;
    for (let j = 0; j < kids; j++) {
      const at = roll.range(0.75, 1, salt++);
      const p = pointAt(st, at);
      const a = angle * 0.5 + (j - (kids - 1) / 2) * roll.range(0.75, 1, salt++);
      branch(p.x, p.y, a, len * roll.range(0.72, 0.9, salt++), depth + 1, v0 + lf * at);
    }
  };
  branch(cx, baseY, roll.range(-0.1, 0.1, 1), height * 0.3, 0, 0);
}

/** Ground cover: dozens of tiny tufts across the whole width, back rows darker. */
function carpet(env) {
  const { roll, leafW, count, baseY, k, s } = env;
  const tufts = Math.round((s.w / 1.8) * count);
  const rows = 3;
  let salt = 10;
  for (let row = 0; row < rows; row++) {
    const y = baseY - (rows - 1 - row) * Math.max(1, k * 0.8);
    for (let t = 0; t < tufts / rows; t++) {
      const x = roll.range(2, s.w - 2, salt++);
      // A mound: taller in the middle of the carpet.
      const mound = 1 - ((x - s.w / 2) / (s.w / 2)) ** 2 * 0.5;
      const leaves = 3;
      for (let l = 0; l < leaves; l++) {
        const len = env.height * roll.range(0.22, 0.5, salt++) * mound;
        blade(env, {
          x, y, len, angle: (l - 1) * 0.6 + roll.range(-0.3, 0.3, salt++),
          width: (u) => Math.max(1, 1.6 * leafW * LEAF_SHAPES.oval(u)),
          sway: swayer(env, 0.6, x * 0.3),
        }, row, { profile: 'flat' });
      }
    }
  }
}

/** A water lily: long stalks up to pads at the top of the canvas, a few leaves underwater. */
function lily(env) {
  const { roll, count, cx, baseY, k, s, m, leafW } = env;
  const pads = Math.max(1, Math.round(roll.int(2, 3, 1) * count));
  const top = Math.max(2, 3 * k);
  for (let i = 0; i < pads; i++) {
    const tx = cx + (i - (pads - 1) / 2) * s.w * 0.28 + roll.range(-2, 2, 10 + i) * k;
    const ty = top + roll.range(0, 3, 20 + i) * k + (i % 2) * 2 * k;
    const len = Math.hypot(tx - cx, baseY - ty);
    const angle = Math.atan2(tx - cx, baseY - ty);
    const sw = swayer(env, 1.6, i * 2.1, 1.4);
    const st = { x: cx, y: baseY, len, angle, bend: roll.range(-0.15, 0.15, 30 + i), width: () => Math.max(1, 0.8 * k ** 0.5), sway: sw };
    s.stroke(st, { mat: m.stem, seam: false });
    const end = pointAt(st, 1);
    const rx = Math.max(3, 5 * leafW * k ** 0.65);
    const ry = Math.max(1.2, rx * 0.32);
    const notch = (x, y) => x + 0.5 > end.x && Math.abs(y + 0.5 - end.y) < (x + 0.5 - end.x) * 0.3;
    const pad = ellipse(end.x, end.y, rx, ry);
    s.fill((x, y) => pad(x, y) && !notch(x, y), { box: pad.box, mat: m.depth[2], flat: 0.55, bias: 0.08 });
    if (m.flower && i === 0) {
      const f = ellipse(end.x - rx * 0.3, end.y - ry - 1, Math.max(1.5, 1.8 * k ** 0.6), Math.max(1.2, 1.6 * k ** 0.6));
      s.fill(f, { box: f.box, mat: m.flower });
    }
  }
  // Underwater leaves round the crown.
  rosette(env, { leaves: Math.max(2, Math.round(3 * count)), spread: 0.9, len: env.height * 0.22, width: 4 * leafW, shape: LEAF_SHAPES.heart, droop: 0.8 });
}

const FORMS = { kelp, eelgrass, fern, anubias, cabomba: (e) => stems(e, 'cabomba'), sword, mossball, fan, carpet, lily, stem: (e) => stems(e, 'stem') };

function bed(env) {
  const { s, set, roll, k, cx, baseY } = env;
  if (set.base === 'sand' || set.base === 'gravel') {
    const sand = set.base === 'sand';
    const mat = s.material(sand ? '#c8b48a' : '#8a8478', { steps: 5, shift: 18, keepHue: true });
    const grain = noise2(`${identityCode(set)}:bed`, sand ? 2 : Math.max(1.2, k));
    // A low mound, lit from above.
    const top = (x) => baseY - 0.5 - Math.max(0, 1 - ((x - cx) / (s.w * 0.55)) ** 2) * k;
    s.fill((x, y) => y + 0.5 >= top(x + 0.5), { box: [0, baseY - 2 * k - 1, s.w - 1, s.h - 1], mat, dome: Math.max(2, 2 * k), seam: false, under: true });
    if (!sand) {
      s.tone((x, y) => s.mat[s.idx(x, y)] === mat && grain(x, y) > 0.62, 1, { box: [0, baseY - 3 * k, s.w - 1, s.h - 1] });
      s.tone((x, y) => s.mat[s.idx(x, y)] === mat && grain(x + 31, y) > 0.7, -1, { box: [0, baseY - 3 * k, s.w - 1, s.h - 1] });
    } else {
      s.tone((x, y) => s.mat[s.idx(x, y)] === mat && grain(x, y) > 0.78, -1, { box: [0, baseY - 3 * k, s.w - 1, s.h - 1] });
    }
  } else if (set.base === 'pebble') {
    const tones = ['#8a8f96', '#a69a86', '#6d7480', '#b8b2a6'].map((h) => s.material(h, { steps: 4, keepHue: true }));
    const n = Math.round(4 * Math.max(1, k));
    for (let j = 0; j < n; j++) {
      const x = cx + roll.range(-s.w * 0.35, s.w * 0.35, 200 + j);
      const e = ellipse(x, baseY + 0.5, roll.range(1.4, 2.6, 210 + j) * k ** 0.8, 1.4 * k ** 0.8);
      s.fill(e, { box: e.box, mat: tones[j % 4] });
    }
  } else if (set.base === 'rock') {
    const e = ellipse(cx + roll.range(-3, 3, 220) * k, baseY - 0.5, s.w * 0.3, 3.5 * k ** 0.8);
    s.fill((x, y) => e(x, y) && y <= baseY + 1, { box: e.box, mat: s.material('#6f7682', { steps: 5, keepHue: true }) });
  } else if (set.base === 'wood') {
    const c = capsule(cx - s.w * 0.36, baseY, cx + s.w * 0.3, baseY - 1.5 * k, 1.6 * k ** 0.8, 1.2 * k ** 0.8);
    const wood = s.material('#6b4a2b', { steps: 5, keepHue: true });
    s.fill(c, { box: c.box, mat: wood });
    s.tone((x, y, i) => s.mat[i] === wood && (y + Math.round(x * 0.1)) % 2 === 0 && x % 5 > 1, -1, { box: c.box });
  }
}

function bubbles(env) {
  const { s, set, roll, pose, cx, baseY, k } = env;
  if (set.bubbles !== 'yes') return;
  const bubble = s.color('#dff6ff');
  const rim = s.color('#9fd8f0');
  const travel = baseY - 4;
  const n = Math.round(3 * Math.max(1, k * 0.8));
  for (let j = 0; j < n; j++) {
    // Each bubble rises a whole number of travels per loop, so the loop closes.
    const y = baseY - 4 - ((roll.range(0, 1, 300 + j) + pose.bubbles * (1 + (j % 3))) % 1) * travel;
    const x = cx + roll.range(-s.w * 0.3, s.w * 0.3, 310 + j) + Math.round(Math.sin(pose.bubbles * TAU + j));
    const big = k >= 1.6 && j % 2 === 0;
    s.pin(x, y, bubble);
    s.pin(x + 1, y, rim);
    if (big) {
      s.pin(x, y - 1, rim);
      s.pin(x + 1, y - 1, bubble);
    }
  }
}

/** Pale variegated leaf edges or stripes, and algae specks, onto the lit leaves. */
function leafFinish(env) {
  const { s, m, set } = env;
  const leaves = new Set(m.depth);
  const pale = s.material(mix(s.mats[m.depth[2]].hex, '#eef6d8', 0.6), { steps: 4 });
  const algae = s.material('#4a5a24', { steps: 3 });
  const specks = noise2(`${identityCode(set)}:algae`, Math.max(1.2, env.k));
  s.each(null, (x, y, i) => {
    if (!leaves.has(s.mat[i])) return;
    if (set.algae !== 'none' && specks(x, y) > (set.algae === 'fuzz' ? 0.6 : 0.78)) {
      s.mat[i] = algae;
      return;
    }
    if (set.variegation === 'none' || s.mat[i] !== m.depth[2]) return;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !s.inside(x + dx, y + dy) || !leaves.has(s.mat[s.idx(x + dx, y + dy)]));
    if (set.variegation === 'edge' ? edge : (x + 2 * y) % 5 === 0 && !edge) s.mat[i] = pale;
  });
}

/** A tank-mate on the bed: a snail with a spiral shell, or a little red shrimp. */
function critter(env) {
  const { s, set, roll, k, baseY } = env;
  const side = roll.range(0, 1, 400) < 0.5 ? -1 : 1;
  const x = s.w / 2 + side * s.w * 0.3;
  const r = Math.max(1.6, 2.2 * k ** 0.7);
  if (set.critter === 'snail') {
    const foot = s.material('#c9b9a0', { steps: 3 });
    s.fill(capsule(x - r * 1.2, baseY - 0.5, x + r * 1.3, baseY - 0.5, Math.max(0.7, r * 0.35)), { box: [x - r * 2, baseY - r, x + r * 2, baseY + 1], mat: foot });
    const shell = ellipse(x, baseY - r * 0.9, r, r);
    const sm = s.material('#a0643a', { steps: 5 });
    s.fill(shell, { box: shell.box, mat: sm });
    s.tone((px, py) => shell(px, py) && Math.abs(Math.hypot(px + 0.5 - x, py + 0.5 - (baseY - r * 0.9)) - r * 0.5) < 0.5, -1, { box: shell.box });
    s.pin(x + side * r * 1.25, baseY - Math.max(1, r * 0.5), s.color('#2a2018'));
  } else {
    const sm = s.material('#d2463a', { steps: 4 });
    const body = capsule(x - r * 1.1, baseY - r * 0.7, x + r * 1.1, baseY - r * 0.9, Math.max(0.6, r * 0.42), Math.max(0.5, r * 0.3));
    s.fill(body, { box: body.box, mat: sm });
    s.tone((px, py) => body(px, py) && Math.round(px) % 2 === 0, -1, { box: body.box });
    s.pin(x + r * 1.2, baseY - r * 0.9, s.color('#1a1418'));
    s.stroke({ x: x + r, y: baseY - r * 0.9, angle: 0.3, len: r * 2.2, bend: 0.4, width: () => 1 }, { mat: sm, seam: false });
  }
}

/** One plant in a pose. */
export function drawWaterplant2(genome, pose = rest('plant')) {
  const set = waterplant2Traits.normalize(genome);
  const { w, h } = plantCanvas(set);
  const s = new Surface(w, h, styleOf(set));
  const env = setup(s, set, pose);
  bed(env);
  FORMS[set.form](env);
  if (set.variegation !== 'none' || set.algae !== 'none') leafFinish(env);
  if (set.critter !== 'none') critter(env);
  if (env.m.glow && set.glow !== 'none') {
    // Glow breathes: lift the glowing pixels with the pulse.
    s.lift((x, y, i) => s.mat[i] === env.m.glow, (pose.glow - 0.5) * 0.4);
  }
  bubbles(env);
  return s.render({ dither: env.k >= 1.6 ? 0.08 : 0 });
}

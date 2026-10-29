// Procedural pixel-art crew, ported from Burn-Through (yeswar web/pilot-pixel.js) — byte for byte,
// so a callsign draws the same face here as on the game's radio. One seed (a callsign,
// "MAGIC 1") always makes the same person: helmet paint, visor, mask, skin, eyes, brows, suit.
// `pilotFrame` draws a 32×32 radio portrait with expressions. Non-pilot radio voices get their
// own figure: an air boss for the tower and the ship, a scope for the RWR and jammer, an
// instructor.
//
// Pure: grids and color lists only. The game keeps its own glue (crew overrides, the voxel bust,
// the radio-channel table) on top of this.

import { hash01 } from '../pixel/rng.js';
import { Grid } from '../pixel/grid.js';
import { scaleRgb as shade } from '../pixel/color.js';

export const PORTRAIT = 32;

export const EXPRESSIONS = ['idle', 'blink', 'talk', 'strain', 'alarm', 'grin', 'calm', 'eject'];

const SKIN = [[255, 219, 172], [241, 194, 125], [224, 172, 105], [198, 134, 66], [141, 85, 36], [96, 60, 30]];
const EYES = [[60, 90, 140], [70, 50, 30], [40, 110, 70], [30, 30, 30], [110, 80, 40]];
const HAIR = [[40, 30, 20], [90, 60, 30], [160, 120, 60], [20, 20, 20], [130, 130, 130], [180, 70, 30]];
const HELMET_BLUE = [[214, 218, 214], [96, 104, 84], [60, 66, 72], [40, 56, 96], [200, 200, 190], [70, 80, 64]];
const HELMET_RED = [[226, 228, 226], [190, 196, 200], [120, 128, 134], [70, 90, 70]];
const STRIPES = [[200, 40, 40], [240, 190, 40], [30, 30, 30], [40, 90, 200], [240, 240, 240], [60, 160, 80], [120, 60, 160]];
const VISORS = [[200, 150, 40], [60, 64, 70], [120, 160, 190]];
const SUITS = { blue: [[94, 104, 76], [76, 86, 70], [70, 80, 96]], red: [[90, 100, 120], [100, 110, 90], [80, 86, 96]] };

/** Traits for a crew member. `seed`: callsign or channel; `side`: blue/red; `figure`: pilot, backseat, boss, scope, tutor. */
export function pilotSpec(seed, { side = 'blue', figure = 'pilot' } = {}) {
  return rolledSpec(seed, side, figure);
}

function rolledSpec(seed, side, figure) {
  const r = (salt) => hash01(seed, salt + 101);
  const pick = (list, salt) => list[Math.floor(r(salt) * list.length) % list.length];
  return {
    seed: String(seed),
    side,
    figure,
    skin: pick(SKIN, 1),
    eyes: pick(EYES, 2),
    hair: pick(HAIR, 3),
    helmet: pick(side === 'red' ? HELMET_RED : HELMET_BLUE, 4),
    stripe: pick(STRIPES, 5),
    pattern: pick(['stripe', 'twin', 'checker', 'bolt', 'plain', 'star'], 6),
    visor: pick(VISORS, 7),
    visorDown: r(8) < 0.22,
    mustache: r(9) < 0.3,
    brows: r(10) < 0.5 ? 2 : 1,
    suit: pick(SUITS[side] || SUITS.blue, 11),
    patch: pick(STRIPES, 12),
  };
}

// ---------- Figures ----------

function face(g, spec, expr, frame, { tilt = 0, visorUp = true, mask = true, mouth = false }) {
  const skin = g.color(spec.skin);
  const skinD = g.color(shade(spec.skin, 0.78));
  const ink = g.color([24, 22, 26]);
  const white = g.color([240, 240, 236]);
  const eye = g.color(spec.eyes);
  const cx = 16 + tilt;
  // Head
  g.ellipse(cx, 15, 6.2, 7.4, skin);
  g.rect(cx - 6, 16, 1, 3, skinD);
  g.rect(cx + 5, 16, 1, 3, skinD);
  // Eyes and brows
  const eyeY = 14;
  const L = cx - 3;
  const R = cx + 2;
  const drawEye = (x) => {
    if (expr === 'blink' || (expr === 'grin' && frame % 2 === 0)) {
      g.rect(x, eyeY + 1, 2, 1, ink);
    } else if (expr === 'grin') {
      g.px(x, eyeY + 1, ink);
      g.px(x + 1, eyeY, ink);
    } else if (expr === 'strain') {
      g.rect(x, eyeY + 1, 2, 1, ink);
      g.px(x + (x < cx ? 1 : 0), eyeY, ink);
    } else if (expr === 'calm') {
      g.rect(x, eyeY + 1, 2, 1, eye);
      g.rect(x, eyeY, 2, 1, skinD);
    } else if (expr === 'alarm' || expr === 'eject') {
      g.rect(x, eyeY - 1, 2, 3, white);
      g.px(x + (frame % 2), eyeY, ink);
    } else {
      g.rect(x, eyeY, 2, 2, white);
      g.px(x + (x < cx ? 1 : 0), eyeY + 1, eye);
      g.px(x + (x < cx ? 1 : 0), eyeY, ink);
    }
  };
  if (visorUp) {
    drawEye(L);
    drawEye(R);
    const browY = expr === 'alarm' || expr === 'eject' ? eyeY - 3 : expr === 'strain' ? eyeY - 1 : eyeY - 2;
    const brow = g.color(shade(spec.hair, 0.9));
    for (const x of [L, R]) {
      g.rect(x, browY, 2, 1, brow);
      if (spec.brows > 1) g.px(x + (x < cx ? -1 : 2), browY + (expr === 'strain' ? -1 : 0), brow);
    }
    // Nose
    g.px(cx, eyeY + 2, skinD);
    g.px(cx, eyeY + 3, skinD);
  }
  if (mask) {
    const m = g.color([74, 82, 72]);
    const mD = g.color([50, 56, 50]);
    const lift = expr === 'talk' && frame % 2 ? -1 : 0;
    g.rect(cx - 3, 18 + lift, 7, 4, m);
    g.rect(cx - 2, 22 + lift, 5, 1, m);
    g.rect(cx - 1, 19 + lift, 3, 2, mD);
    // Mic light on the mask while transmitting
    if (expr === 'talk') g.px(cx + 2, 19 + lift, g.color(frame % 3 === 2 ? [80, 255, 120] : [40, 160, 70]));
    // Hose down to the chest
    g.rect(cx - 1, 23, 2, 4, mD);
    g.rect(cx - 2, 26, 2, 2, mD);
    if (spec.mustache && visorUp) g.rect(cx - 2, 17, 5, 1, g.color(shade(spec.hair, 0.8)));
  } else if (mouth) {
    const lip = g.color(shade(spec.skin, 0.62));
    const open = expr === 'talk' ? [0, 2, 1][frame % 3] : expr === 'alarm' ? 2 : 0;
    if (expr === 'grin') {
      g.rect(cx - 2, 19, 5, 1, lip);
      g.px(cx - 3, 18, lip);
      g.px(cx + 3, 18, lip);
    } else if (open) {
      g.rect(cx - 1, 19, 3, open, ink);
      g.rect(cx - 1, 18, 3, 1, lip);
    } else {
      g.rect(cx - 1, 19, 3, 1, lip);
    }
    if (spec.mustache) g.rect(cx - 2, 18 - (open ? 1 : 0), 5, 1, g.color(shade(spec.hair, 0.8)));
  }
}

function suit(g, spec, { harness = true } = {}) {
  const s = g.color(spec.suit);
  const sD = g.color(shade(spec.suit, 0.72));
  const strap = g.color([46, 44, 40]);
  for (let y = 24; y < 32; y++) {
    const half = 8 + Math.min(6, (y - 24) * 1.2);
    g.rect(Math.round(16 - half), y, Math.round(half * 2), 1, y < 26 ? s : y % 3 ? s : sD);
  }
  g.rect(13, 22, 6, 2, s);
  if (harness) {
    g.rect(11, 25, 1, 7, strap);
    g.rect(20, 25, 1, 7, strap);
    g.rect(11, 29, 10, 1, strap);
  }
  g.rect(22, 27, 3, 3, g.color(spec.patch));
  g.px(23, 28, g.color([240, 240, 230]));
}

function helmet(g, spec, expr, frame, { tilt = 0, visorUp = true } = {}) {
  const cx = 16 + tilt;
  const h = g.color(spec.helmet);
  const hD = g.color(shade(spec.helmet, 0.72));
  const hL = g.color(shade(spec.helmet, 1.12));
  const st = g.color(spec.stripe);
  // Shell: covers the top and sides of the head down to the jaw
  g.ellipse(cx, 11.5, 8.6, 8.4, h, (x, y) => y <= 12 || Math.abs(x + 0.5 - cx) > 5.2);
  g.ellipse(cx - 2, 7, 3, 2, hL);
  // Ear cups
  g.rect(cx - 9, 13, 2, 6, hD);
  g.rect(cx + 7, 13, 2, 6, hD);
  // Paint
  if (spec.pattern === 'stripe') g.rect(cx - 1, 3, 2, 9, st);
  if (spec.pattern === 'twin') {
    g.rect(cx - 3, 3, 1, 9, st);
    g.rect(cx + 2, 3, 1, 9, st);
  }
  if (spec.pattern === 'checker') for (let x = cx - 7; x <= cx + 6; x += 2) g.px(x, 10 + ((x + 16) % 4 === 0 ? 0 : 1), st);
  if (spec.pattern === 'bolt') {
    [[cx + 3, 4], [cx + 2, 5], [cx + 3, 6], [cx + 2, 7], [cx + 1, 8], [cx + 2, 9]].forEach(([x, y]) => g.px(x, y, st));
  }
  if (spec.pattern === 'star') {
    g.px(cx, 6, st);
    g.rect(cx - 1, 7, 3, 1, st);
    g.px(cx - 1, 8, st);
    g.px(cx + 1, 8, st);
  }
  // Visor: up sits on the brow, down covers the eyes with a glint that sweeps when talking
  const v = g.color(spec.visor);
  const vL = g.color(shade(spec.visor, 1.5));
  if (visorUp) {
    g.rect(cx - 6, 9, 13, 2, v);
    g.px(cx - 4, 9, vL);
  } else {
    g.ellipse(cx, 14, 6.6, 3.3, v, (x, y) => y >= 11);
    const glint = (frame * 2 + (expr === 'alarm' ? 3 : 0)) % 11;
    g.px(cx - 5 + glint, 12, vL);
    g.px(cx - 4 + glint, 13, vL);
  }
}

function pilotFigure(g, spec, expr, frame) {
  const tilt = expr === 'strain' ? (frame % 2 ? 1 : 0) : expr === 'eject' ? (frame % 2 ? -1 : 1) : 0;
  const visorUp = !spec.visorDown || expr === 'grin';
  suit(g, spec);
  face(g, spec, expr, frame, { tilt, visorUp, mask: true });
  helmet(g, spec, expr, frame, { tilt, visorUp });
  if ((expr === 'strain' || expr === 'alarm') && frame % 4 < 2) {
    const drop = g.color([170, 220, 255]);
    g.px(16 + tilt + 6, 12, drop);
    g.px(16 + tilt + 6, 13, drop);
  }
}

function bossFigure(g, spec, expr, frame) {
  // Air boss / handler: cranial helmet with goggles, headset cups, float coat
  const coat = g.color(spec.side === 'red' ? [70, 80, 100] : [240, 200, 40]);
  const coatD = g.color(spec.side === 'red' ? [50, 60, 78] : [200, 160, 30]);
  for (let y = 23; y < 32; y++) {
    const half = 8 + Math.min(6, (y - 23) * 1.1);
    g.rect(Math.round(16 - half), y, Math.round(half * 2), 1, y % 4 === 0 ? coatD : coat);
  }
  g.rect(13, 21, 6, 2, g.color(shade(spec.skin, 0.85)));
  face(g, spec, expr, frame, { mask: false, mouth: true, visorUp: true });
  const cap = g.color(spec.side === 'red' ? [90, 96, 110] : [240, 200, 40]);
  g.ellipse(16, 10, 7.6, 5.2, cap, (x, y) => y <= 11);
  g.rect(7, 12, 3, 6, g.color([30, 30, 34]));
  g.rect(22, 12, 3, 6, g.color([30, 30, 34]));
  g.rect(10, 6, 12, 2, g.color([40, 46, 52]));
  g.rect(11, 6, 3, 2, g.color([120, 170, 200]));
  g.rect(18, 6, 3, 2, g.color([120, 170, 200]));
  // Boom mic
  g.rect(22, 18, 1, 1, g.color([30, 30, 34]));
  g.rect(19, 19, 3, 1, g.color([30, 30, 34]));
}

function tutorFigure(g, spec, expr, frame) {
  suit(g, { ...spec, suit: [70, 80, 96] }, { harness: false });
  face(g, spec, expr, frame, { mask: false, mouth: true, visorUp: true });
  const cap = g.color([40, 52, 80]);
  g.ellipse(16, 9.5, 7, 4.6, cap, (x, y) => y <= 10);
  g.rect(9, 10, 16, 1, cap);
  g.rect(10, 11, 13, 1, g.color([30, 40, 62]));
  g.rect(15, 6, 2, 2, g.color([240, 200, 60]));
  g.rect(7, 13, 2, 5, g.color([30, 30, 34]));
  g.rect(23, 13, 2, 5, g.color([30, 30, 34]));
}

function scopeFigure(g, spec, expr, frame) {
  const bezel = g.color([46, 50, 54]);
  const bezelL = g.color([80, 86, 92]);
  const alarm = expr === 'alarm';
  const screen = g.color(alarm ? [60, 10, 8] : [6, 28, 18]);
  const trace = g.color(alarm ? [255, 90, 70] : [90, 255, 150]);
  const dim = g.color(alarm ? [140, 40, 30] : [40, 140, 80]);
  g.rect(3, 4, 26, 25, bezel);
  g.rect(3, 4, 26, 1, bezelL);
  g.ellipse(16, 16, 10.5, 10.5, screen);
  for (const r of [3.5, 7, 10]) {
    for (let a = 0; a < 48; a++) {
      const t = (a / 48) * Math.PI * 2;
      g.px(Math.round(16 + Math.cos(t) * r - 0.5), Math.round(16 + Math.sin(t) * r - 0.5), dim);
    }
  }
  const sweep = ((frame % 12) / 12) * Math.PI * 2;
  for (let k = 0; k < 10; k++) g.px(Math.round(16 + Math.cos(sweep) * k - 0.5), Math.round(16 + Math.sin(sweep) * k - 0.5), trace);
  const blips = Math.floor(hash01(spec.seed, 40) * 3) + 2;
  for (let i = 0; i < blips; i++) {
    const a = hash01(spec.seed, 41 + i) * Math.PI * 2;
    const d = 3 + hash01(spec.seed, 51 + i) * 6;
    g.rect(Math.round(16 + Math.cos(a) * d - 1), Math.round(16 + Math.sin(a) * d - 1), 2, 2, trace);
  }
  g.rect(6, 26, 3, 2, g.color(expr === 'talk' && frame % 2 ? [255, 200, 60] : [90, 70, 30]));
  g.rect(23, 26, 3, 2, g.color(alarm && frame % 2 ? [255, 60, 50] : [80, 30, 26]));
}

/**
 * A 32×32 portrait: { w, h, data (palette index per pixel, 0 = clear), palette ([r, g, b, a]) }.
 * `frame` counts up for talking, blinking and glints.
 */
export function pilotFrame(spec, expression = 'idle', frame = 0) {
  const expr = EXPRESSIONS.includes(expression) ? expression : 'idle';
  const g = new Grid(PORTRAIT);
  if (spec.figure === 'scope') scopeFigure(g, spec, expr, frame);
  else if (spec.figure === 'boss') bossFigure(g, spec, expr, frame);
  else if (spec.figure === 'tutor') tutorFigure(g, spec, expr, frame);
  else pilotFigure(g, spec, expr, frame);
  if (spec.figure !== 'scope') g.outline(g.color([10, 10, 12]));
  return g.out();
}

/** The rolled palettes, for building editors on top of `pilotSpec`. */
export const PALETTES = { SKIN, EYES, HAIR, HELMET_BLUE, HELMET_RED, STRIPES, VISORS, SUITS };

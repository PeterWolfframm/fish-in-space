// The astronaut helmet: a glass dome over the head, with a collar ring at the gill line. Glass is
// painted as a tint over whatever is under it (the grid holds one colour per pixel, so "see
// through" means mixing with the fish below), and as faint glass where there is only water.

import { defineFeature } from './define.js';
import { mix, rgbOf, hexFrom } from '../../../pixel/color.js';
import { HIGHLIGHT } from '../../../v3/fish/colors.js';

const STYLE = {
  bubble: { glass: '#cfeeff', rim: '#f4fbff', collar: '#c9ccd6', collarDark: '#8a8f9c', tint: 0.18 },
  retro: { glass: '#d8f0e6', rim: '#f4fff8', collar: '#c8912f', collarDark: '#7a5418', tint: 0.2, bolts: true },
  visor: { glass: '#f2c53d', rim: '#fff2b8', collar: '#d5d8e0', collarDark: '#8a8f9c', tint: 0.38, visor: true },
  antenna: { glass: '#cfeeff', rim: '#f4fbff', collar: '#c9ccd6', collarDark: '#8a8f9c', tint: 0.18, antenna: true },
};

/** The painted colour at (x, y), or null for water. */
function under(g, x, y) {
  const i = g.get(x, y);
  if (!i) return null;
  const [r, gg, b, a] = g.palette[i];
  return { hex: hexFrom([r, gg, b]), a };
}

/** Lay glass of `hex` at strength `k` over a pixel: tint what is there, or faint glass on water. */
function glass(g, x, y, hex, k, waterAlpha) {
  if (!g.inside(x, y)) return;
  const u = under(g, x, y);
  if (!u) g.px(x, y, g.color(hex, waterAlpha));
  else g.px(x, y, g.color(mix(u.hex, hex, k), Math.max(u.a, waterAlpha)));
}

export default defineFeature({
  id: 'helmet',
  label: 'Space helmet',
  group: 'head',
  field: {
    choices: [['none', 'None'], ['bubble', 'Bubble dome'], ['retro', 'Retro fishbowl'], ['visor', 'Gold visor'], ['antenna', 'Antenna dome']],
    weights: [985, 5, 4, 3, 3],
    salt: 3088,
    dominance: 0.6,
    volatility: 0.5,
    tierBoost: { rare: 2, epic: 4, legendary: 6, myth: 8 },
  },
  // Tube eyes poke out of any dome; a beak would have to go through the glass.
  excludes: { eyeMount: ['tubular'], snout: ['long'] },
  layer: 'after:extras',
  influences: {
    stats: { stressResistance: { '*': 0.04 }, curiosity: { '*': 0.05 }, boldness: { antenna: 0.04 } },
    keys: { '*': ['helmet'], bubble: ['helmet.bubble'], retro: ['helmet.retro'], visor: ['helmet.visor'], antenna: ['helmet.antenna'] },
    name: { prefix: 'Cosmonaut', latin: 'astro' },
  },
  params: {
    size: { label: 'Dome size', min: 0.8, max: 1.4, step: 0.05, default: 1.05 },
    glass: { label: 'Glass opacity', min: 20, max: 160, step: 5, default: 70 },
    glint: { label: 'Glint', min: 0, max: 1, step: 1, default: 1 },
  },
  draw(ctx, value, p) {
    const { g, ph, colT, nose, s, pose } = ctx;
    const st = STYLE[value];
    if (!st || !nose) return;
    const eye = colT(ph.eyeT) ?? nose;
    const gillC = colT(Math.max(0.55, ph.eyeT - 0.16)) ?? eye;
    // Centre between the gill line and the nose, a little above the centre line; big enough to
    // hold the eye and the snout.
    const cx = (gillC.x + nose.x) / 2 + 0.5;
    const cy = eye.mid - eye.back * 0.15;
    const headH = Math.max(eye.back + eye.belly, gillC.back + gillC.belly);
    const r = Math.max(3, Math.max((nose.x - gillC.x) / 2 + 1.5, headH * 0.55 + 1) * p.size);
    const R2 = r * r;
    const inner = (r - 1.2) * (r - 1.2);
    const x0 = Math.floor(cx - r - 1);
    const x1 = Math.ceil(cx + r + 1);
    const y0 = Math.floor(cy - r - 1);
    const y1 = Math.ceil(cy + r + 1);
    const collarX = Math.round(cx - r * 0.82);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > R2 || x < collarX) continue;
        const rimPx = d2 > inner;
        // Visor: the front half is gold-tinted, the back half clear.
        const front = st.visor && dx > -r * 0.15;
        const hex = rimPx ? st.rim : front ? st.glass : st.visor ? '#cfeeff' : st.glass;
        const k = rimPx ? 0.45 : front ? st.tint : st.visor ? 0.15 : st.tint;
        glass(g, x, y, hex, k, rimPx ? Math.min(255, p.glass + 90) : p.glass);
      }
    }
    // The collar: a metal ring where the dome meets the body.
    const ring = g.color(st.collar);
    const ringDark = g.color(st.collarDark);
    const cw = Math.max(1, Math.round(s * 0.9));
    const top = Math.round(cy - Math.sqrt(Math.max(0, R2 - (collarX - cx) ** 2)));
    const bot = Math.round(cy + Math.sqrt(Math.max(0, R2 - (collarX - cx) ** 2)));
    for (let y = top; y <= bot; y++) {
      for (let k = 0; k < cw; k++) g.px(collarX + k, y, k === 0 || y === bot ? ringDark : ring);
    }
    if (st.bolts) {
      const bolt = g.color('#f2d48a');
      const step = Math.max(2, Math.round(2.5 * s));
      for (let y = top + 1; y < bot; y += step) g.px(collarX + cw - 1, y, bolt);
    }
    // A glint, upper front, where a lamp would catch the glass.
    if (p.glint) {
      const hi = g.color(HIGHLIGHT);
      const gx = Math.round(cx + r * 0.38);
      const gy = Math.round(cy - r * 0.62);
      g.px(gx, gy, hi);
      if (r >= 6) {
        g.px(gx + 1, gy + 1, hi);
        g.px(gx - 1, gy, g.color(st.rim, 220));
      }
    }
    if (st.antenna) {
      const ax = Math.round(cx - r * 0.2);
      const ay = Math.round(cy - Math.sqrt(Math.max(0, R2 - (ax + 0.5 - cx) ** 2)));
      const h = Math.max(2, Math.round(2.5 * s));
      const stalk = g.color('#8a8f9c');
      for (let k = 1; k <= h; k++) g.px(ax, ay - k, stalk);
      // The tip blinks with the glow channel.
      const on = (pose.glow ?? 0.5) > 0.5;
      const [rr, gg, bb] = rgbOf(on ? '#ff4d5e' : '#7a2430');
      g.px(ax, ay - h - 1, g.color([rr, gg, bb]));
    }
  },
});

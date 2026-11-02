// Pilots v3 painter: Pilots v1's 32×32 radio portrait — flat colours, one shade per part, a dark
// outline — for anyone. The face, eyes, brows and expressions are v1's, measured from the head
// instead of fixed, so a kid's lower, rounder face and an elder's wrinkles fall out of the same
// code. Painted back to front:
//
//   torso → back hair / drapes → neck → head and face → facial hair, mouth → front hair
//   → headwear → eyewear → outline
//
// Hair under a hat is painted through a clip (`below`), so a bun or an afro tucks under a cap
// instead of poking through it.

import { Grid } from '../../pixel/grid.js';
import { rgbOf, scaleRgb as shade, mixRgb } from '../../pixel/color.js';
import { hatClips } from './traits.js';

export const PORTRAIT = 32;
export const EXPRESSIONS = ['idle', 'blink', 'talk', 'strain', 'alarm', 'grin', 'calm'];

const INK = [24, 22, 26];
const WHITE = [240, 240, 236];
const STRAP = [46, 44, 40];
const GOLD = [240, 200, 60];

const FACES = { oval: [6.2, 7.4], round: [6.7, 7.0], long: [5.7, 7.9], square: [6.4, 7.2] };
const SHOULDER = { slim: 7, average: 8, broad: 9 };

/** Where everything sits, measured from the head. `tilt` leans the head, not the body. */
export function geometry(set, tilt = 0) {
  const kid = set.age === 'kid';
  const [fx, fy] = FACES[set.face] ?? FACES.oval;
  const rx = kid ? fx * 0.93 : fx;
  const ry = kid ? fy * 0.86 : fy;
  const cx = 16 + tilt;
  const cy = kid ? 16.5 : 15;
  const eyeY = kid ? 16 : 14;
  return {
    kid, cx, cy, rx, ry, eyeY,
    mouthY: eyeY + (kid ? 4 : 5),
    T: Math.round(cy - ry),
    chin: Math.round(cy + ry),
    L: cx - 3,
    R: cx + 2,
    earY: eyeY + (kid ? 1 : 2),
    earL: Math.round(cx - rx),
    earR: Math.round(cx + rx - 1),
    shoulderY: kid ? 25 : 24,
    shoulder: SHOULDER[set.build] - (kid ? 1.5 : 0),
  };
}

/** The same grid, but nothing above row `minY` is painted. */
function below(g, minY) {
  if (minY <= 0) return g;
  return new Proxy(g, {
    get(t, k, self) {
      if (k === 'px') return (x, y, c) => { if (y >= minY) t.px(x, y, c); };
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(self) : v;
    },
  });
}

/** Palette indices for one person's colours. */
function inks(g, set) {
  const rgb = (hex) => rgbOf(`#${hex}`);
  const skin = rgb(set.skin);
  const hair = rgb(set.hairColor);
  const cloth = rgb(set.cloth);
  const hat = rgb(set.hatColor);
  const accent = rgb(set.accent);
  return {
    rgb: { skin, hair, cloth, hat, accent },
    skin: g.color(skin), skinD: g.color(shade(skin, 0.78)), skinL: g.color(shade(skin, 1.1)),
    hair: g.color(hair), hairD: g.color(shade(hair, 0.72)), hairL: g.color(shade(hair, 1.3)),
    fuzz: g.color(mixRgb(skin, hair, 0.55)),
    cloth: g.color(cloth), clothD: g.color(shade(cloth, 0.72)), clothL: g.color(shade(cloth, 1.15)),
    hat: g.color(hat), hatD: g.color(shade(hat, 0.72)), hatL: g.color(shade(hat, 1.15)),
    accent: g.color(accent),
    ink: g.color(INK), white: g.color(WHITE), eye: g.color(rgb(set.eyes)),
  };
}

// ---------- Torso ----------

function torsoRows(G) {
  const rows = [];
  for (let y = G.shoulderY; y < PORTRAIT; y++) {
    const half = G.shoulder + Math.min(6, (y - G.shoulderY) * 1.2);
    rows.push([y, Math.round(16 - half), Math.round(half * 2)]);
  }
  return rows;
}

function torso(g, set, G, k) {
  const sy = G.shoulderY;
  const rows = torsoRows(G);
  const fill = (c) => rows.forEach(([y, x, w]) => g.rect(x, y, w, 1, typeof c === 'function' ? c(y) : c));
  const vNeck = (c, depth = 5) => g.polygon([[13, sy - 1], [19, sy - 1], [16, sy + depth]], c);
  switch (set.outfit) {
    case 'flightsuit':
      // v1's suit, harness and patch.
      fill((y) => (y < sy + 2 ? k.cloth : (y - sy) % 3 ? k.cloth : k.clothD));
      g.rect(13, sy - 2, 6, 2, k.cloth);
      g.rect(11, sy + 1, 1, 7, g.color(STRAP));
      g.rect(20, sy + 1, 1, 7, g.color(STRAP));
      g.rect(11, sy + 5, 10, 1, g.color(STRAP));
      g.rect(22, sy + 3, 3, 3, k.accent);
      g.px(23, sy + 4, g.color([240, 240, 230]));
      break;
    case 'uniform':
      fill((y) => (y < sy + 2 ? k.clothD : k.cloth));
      g.rect(13, sy - 1, 6, 1, k.clothD);
      g.rect(14, sy - 1, 4, 1, g.color(INK));
      g.rect(10, sy + 3, 2, 2, k.accent);
      g.px(10, sy + 3, g.color(shade(k.rgb.accent, 1.35)));
      g.rect(11, sy + 6, 10, 1, k.clothD);
      break;
    case 'labcoat':
      fill((y) => (y % 4 === 3 ? g.color([214, 212, 206]) : g.color([236, 234, 228])));
      vNeck(k.cloth, 6);
      g.line(13, sy - 1, 15, sy + 6, g.color([196, 194, 188]));
      g.line(19, sy - 1, 17, sy + 6, g.color([196, 194, 188]));
      g.rect(16, sy + 6, 1, 32 - sy - 6, g.color([196, 194, 188]));
      g.rect(19, sy + 4, 3, 1, g.color([196, 194, 188]));
      g.rect(20, sy + 2, 1, 2, k.accent);
      break;
    case 'coverall':
      fill(k.cloth);
      g.polygon([[12, sy - 1], [20, sy - 1], [18, sy + 2], [14, sy + 2]], k.clothD);
      g.rect(16, sy, 1, 32 - sy, k.clothD);
      g.rect(18, sy + 3, 4, 3, k.clothD);
      g.rect(11, sy + 3, 3, 1, k.accent);
      break;
    case 'tee':
      fill(k.cloth);
      g.rect(14, sy - 1, 4, 1, k.skinD);
      g.rect(13, sy, 6, 1, k.clothD);
      g.ellipse(16, sy + 5, 2.2, 2.2, k.accent);
      break;
    case 'hoodie':
      fill(k.cloth);
      g.ellipse(16, sy, 7.5, 2.6, k.clothD);
      g.rect(14, sy + 1, 1, 3, k.accent);
      g.rect(18, sy + 1, 1, 3, k.accent);
      g.rect(12, 29, 9, 1, k.clothD);
      break;
    case 'sweater':
      fill((y) => (y === sy + 4 || y === sy + 5 ? k.accent : k.cloth));
      g.dither(0, sy + 1, 32, 3, k.clothD, 0.25, (x, y) => g.get(x, y) === k.cloth);
      g.rect(13, sy - 1, 6, 2, k.clothD);
      break;
    case 'suit':
      fill(k.cloth);
      vNeck(k.white, 7);
      g.rect(16, sy, 1, 6, k.accent);
      g.px(15, sy + 1, k.accent);
      g.px(17, sy + 1, k.accent);
      g.line(13, sy - 1, 15, sy + 7, k.clothD);
      g.line(19, sy - 1, 17, sy + 7, k.clothD);
      break;
    case 'robe':
      fill(k.cloth);
      vNeck(k.skinD, 3);
      g.line(13, sy - 1, 19, 31, k.clothD);
      g.line(12, sy, 18, 31, k.clothL);
      rows.filter(([y]) => y === sy + 5 || y === sy + 6).forEach(([y, x, w]) => g.rect(x, y, w, 1, k.accent));
      break;
    case 'apron':
      fill(k.cloth);
      g.rect(14, sy - 1, 4, 1, k.skinD);
      g.polygon([[12.5, sy + 2], [19.5, sy + 2], [21, 32], [11, 32]], k.accent);
      g.line(12, sy - 1, 12, sy + 2, k.accent);
      g.line(19, sy - 1, 19, sy + 2, k.accent);
      g.rect(14, sy + 6, 4, 2, g.color(shade(k.rgb.accent, 0.78)));
      break;
    case 'tank':
      fill(k.skinD);
      rows.forEach(([y, x, w]) => g.rect(x + 3, y, w - 6, 1, k.cloth));
      g.rect(14, sy, 4, 1, k.skinD);
      break;
    case 'spacesuit':
      fill((y) => ((y - sy) % 4 === 3 ? g.color([182, 186, 192]) : g.color([214, 218, 222])));
      g.rect(10, sy - 1, 12, 2, g.color([96, 104, 112]));
      g.rect(10, sy - 1, 12, 1, g.color([140, 148, 156]));
      g.rect(13, sy + 3, 6, 3, g.color([60, 66, 74]));
      g.px(14, sy + 4, k.accent);
      g.px(16, sy + 4, g.color([90, 230, 140]));
      g.px(17, sy + 4, g.color([240, 90, 70]));
      g.rect(6, sy + 4, 3, 2, k.cloth);
      g.rect(23, sy + 4, 3, 2, k.cloth);
      break;
    case 'turtleneck':
      fill(k.cloth);
      g.rect(13, G.chin - 1, 6, sy - G.chin + 2, k.clothD);
      g.rect(13, G.chin - 1, 6, 1, k.cloth);
      break;
    default:
      fill(k.cloth);
  }
}

// ---------- Hair ----------

/** The part of the hair that hangs behind the head. */
function hairBack(g, set, G, k) {
  const { cx, cy, rx, ry, shoulderY } = G;
  const H = k.hair;
  switch (set.hair) {
    case 'curly':
      g.ellipse(cx, cy - 1.5, rx + 2.2, ry + 0.4, H);
      g.dither(Math.floor(cx - rx - 3), Math.floor(cy - ry - 2), Math.ceil(rx * 2 + 6), Math.ceil(ry * 2 + 2), k.hairD, 0.3, (x, y) => g.get(x, y) === H);
      break;
    case 'afro':
      g.ellipse(cx, cy - 2.5, rx + 4, ry + 1.5, H);
      g.dither(Math.floor(cx - rx - 5), Math.floor(cy - ry - 5), Math.ceil(rx * 2 + 10), Math.ceil(ry * 2 + 4), k.hairD, 0.3, (x, y) => g.get(x, y) === H);
      break;
    case 'long':
    case 'locs': {
      const x0 = Math.round(cx - rx - 1.5);
      const w = Math.round(rx * 2 + 3);
      g.ellipse(cx, cy - 1, rx + 1.5, ry + 0.5, H);
      g.rect(x0, Math.round(cy), w, shoulderY + 3 - Math.round(cy), H);
      g.rect(x0 + 1, shoulderY + 3, w - 2, 1, H);
      if (set.hair === 'locs') for (let x = x0 + 1; x < x0 + w; x += 2) g.rect(x, Math.round(cy), 1, shoulderY + 3 - Math.round(cy), k.hairD);
      else g.rect(x0, shoulderY, w, 1, k.hairD);
      break;
    }
    case 'bob':
      g.ellipse(cx, cy - 1, rx + 1.6, ry + 0.3, H);
      g.rect(Math.round(cx - rx - 1.5), Math.round(cy), Math.round(rx * 2 + 3), Math.round(ry * 0.6), H);
      break;
    case 'ponytail':
      g.rect(Math.round(cx + rx - 1), Math.round(cy - 2), 3, Math.round(ry + 2), H);
      g.rect(Math.round(cx + rx), Math.round(cy - 2), 1, Math.round(ry + 2), k.hairD);
      break;
    default:
  }
}

/** The hair over the head: crown, sideburns, fringes, braids, buns. */
function hairFront(g, set, G, k) {
  const { cx, cy, rx, T, eyeY, shoulderY } = G;
  const H = k.hair;
  const cap = (c = H, hairline = eyeY - 4, sides = eyeY + 1) =>
    g.ellipse(cx, cy - 0.6, rx + 0.9, G.ry + 0.2, c, (x, y) => y <= hairline || (Math.abs(x + 0.5 - cx) > rx - 1.2 && y <= sides));
  const shine = () => {
    g.px(Math.round(cx - 3), T, k.hairL);
    g.px(Math.round(cx - 2), T, k.hairL);
  };
  switch (set.hair) {
    case 'bald':
      g.px(Math.round(cx - 3), T + 1, k.skinL);
      g.px(Math.round(cx - 2), T + 1, k.skinL);
      g.rect(Math.round(cx - rx), G.earY - 2, 1, 2, k.fuzz);
      g.rect(Math.round(cx + rx - 1), G.earY - 2, 1, 2, k.fuzz);
      break;
    case 'buzz':
      cap(k.fuzz);
      break;
    case 'short':
      cap();
      shine();
      break;
    case 'part':
      cap();
      g.polygon([[cx - rx, T + 1], [cx + 2, T + 1], [cx - rx + 1, eyeY - 2]], H);
      g.px(Math.round(cx + 2), T, k.hairD);
      g.px(Math.round(cx + 2), T + 1, k.hairD);
      break;
    case 'spiky':
      cap();
      for (const dx of [-5, -2, 1, 4]) g.polygon([[cx + dx - 1.5, T + 1], [cx + dx + 1.5, T + 1], [cx + dx + 0.5, T - 3]], H);
      shine();
      break;
    case 'curly':
    case 'afro':
      cap(H, eyeY - 4, eyeY);
      g.dither(Math.floor(cx - rx - 1), T - 1, Math.ceil(rx * 2 + 3), eyeY - T, k.hairD, 0.3, (x, y) => g.get(x, y) === H);
      break;
    case 'bun':
      cap();
      g.ellipse(cx, T - 1.2, 2.6, 2.2, H);
      g.px(Math.round(cx - 1), T - 2, k.hairL);
      break;
    case 'ponytail':
      cap();
      g.rect(Math.round(cx + rx - 1), Math.round(cy - 2), 2, 1, k.accent);
      shine();
      break;
    case 'long':
    case 'locs':
      cap();
      g.rect(Math.round(cx - rx), eyeY - 4, 2, 9, H);
      g.rect(Math.round(cx + rx - 2), eyeY - 4, 2, 9, H);
      g.px(Math.round(cx), T, k.hairD);
      g.px(Math.round(cx), T + 1, k.hairD);
      if (set.hair === 'locs') {
        g.rect(Math.round(cx - rx), eyeY - 2, 1, 7, k.hairD);
        g.rect(Math.round(cx + rx - 1), eyeY - 2, 1, 7, k.hairD);
      }
      break;
    case 'bob':
      cap(H, eyeY - 3);
      g.rect(Math.round(cx - rx), eyeY - 3, 2, 7, H);
      g.rect(Math.round(cx + rx - 2), eyeY - 3, 2, 7, H);
      g.rect(Math.round(cx - rx + 1), eyeY - 3, Math.round(rx * 2 - 2), 1, k.hairD);
      break;
    case 'braids':
      cap();
      for (const x of [Math.round(cx - rx - 1), Math.round(cx + rx - 1)]) {
        for (let y = G.earY; y < shoulderY + 5; y++) g.rect(x, y, 2, 1, (y + x) % 2 ? H : k.hairD);
        g.rect(x, shoulderY + 5, 2, 1, k.accent);
      }
      shine();
      break;
    case 'mohawk':
      cap(k.fuzz);
      g.rect(Math.round(cx - 1), T - 3, 2, eyeY - T, H);
      g.px(Math.round(cx - 1), T - 3, k.hairL);
      break;
    case 'receding':
      g.ellipse(cx, cy - 0.6, rx + 0.9, G.ry + 0.2, H, (x, y) => Math.abs(x + 0.5 - cx) > rx - 2.4 && y <= eyeY + 1 && y >= T + 1);
      g.px(Math.round(cx - 3), T + 1, k.skinL);
      break;
    case 'puffs':
      cap();
      g.ellipse(cx - rx + 0.5, T + 0.5, 2.8, 2.8, H);
      g.ellipse(cx + rx - 0.5, T + 0.5, 2.8, 2.8, H);
      g.px(Math.round(cx - rx), T - 1, k.hairL);
      break;
    default:
      cap();
  }
}

// ---------- Face ----------

function face(g, set, G, k, expr, frame, glance) {
  const { cx, cy, rx, ry, eyeY, L, R } = G;
  // Head, ears
  g.ellipse(cx, cy, rx, ry, k.skin);
  if (set.face === 'square') g.ellipse(cx, cy + 1.5, rx, ry - 1.5, k.skin, (x, y) => y >= cy + 1 && y < Math.round(cy + ry) - 1);
  g.rect(G.earL, G.earY, 1, 3, k.skinD);
  g.rect(G.earR, G.earY, 1, 3, k.skinD);
  if (set.kin === 'pointed') {
    for (const [x, d] of [[G.earL, -1], [G.earR, 1]]) {
      g.rect(x + d, G.earY - 1, 1, 3, k.skin);
      g.px(x + d * 2, G.earY - 2, k.skin);
      g.px(x + d, G.earY + 1, k.skinD);
    }
  }
  // Eyes: v1's, with a glance that moves both pupils together
  const eyeBox = (x) => {
    if (expr === 'blink' || (expr === 'grin' && frame % 2 === 0)) {
      g.rect(x, eyeY + 1, 2, 1, k.ink);
    } else if (expr === 'grin') {
      g.px(x, eyeY + 1, k.ink);
      g.px(x + 1, eyeY, k.ink);
    } else if (expr === 'strain') {
      g.rect(x, eyeY + 1, 2, 1, k.ink);
      g.px(x + (x < cx ? 1 : 0), eyeY, k.ink);
    } else if (expr === 'calm') {
      g.rect(x, eyeY + 1, 2, 1, k.eye);
      g.rect(x, eyeY, 2, 1, k.skinD);
    } else if (expr === 'alarm') {
      g.rect(x, eyeY - 1, 2, 3, k.white);
      g.px(x + (frame % 2), eyeY, k.ink);
    } else {
      const px = glance == null ? (x < cx ? 1 : 0) : glance;
      g.rect(x, eyeY, 2, 2, k.white);
      g.px(x + px, eyeY + 1, k.eye);
      g.px(x + px, eyeY, k.ink);
    }
  };
  eyeBox(L);
  eyeBox(R);
  const browY = expr === 'alarm' ? eyeY - 3 : expr === 'strain' ? eyeY - 1 : eyeY - 2;
  const brow = g.color(shade(k.rgb.hair, 0.9));
  for (const x of [L, R]) {
    const out = x < cx ? -1 : 2;
    g.rect(x, browY, 2, 1, brow);
    if (set.brows !== 'thin') g.px(x + out, browY + (expr === 'strain' ? -1 : 0), brow);
    if (set.brows === 'bushy') g.rect(x, browY - 1, 2, 1, brow);
  }
  // Nose
  g.px(cx, eyeY + 2, k.skinD);
  g.px(cx, eyeY + 3, k.skinD);
  // Kin
  if (set.kin === 'ridged') {
    g.px(cx, eyeY - 1, k.skinD);
    g.px(cx, eyeY - 3, k.skinD);
    g.px(cx - 1, eyeY - 4, k.skinD);
    g.px(cx + 1, eyeY - 4, k.skinD);
  }
  if (set.kin === 'spotted') {
    const spot = g.color(mixRgb(k.rgb.skin, [70, 46, 40], 0.45));
    for (const [dy, dx] of [[0, 1], [2, 1], [4, 2], [6, 2]]) {
      g.px(Math.round(cx - rx) + dx, eyeY - 1 + dy, spot);
      g.px(Math.round(cx + rx - 1) - dx, eyeY - 1 + dy, spot);
    }
  }
  // Age
  if (set.age === 'middle' || set.age === 'elder') {
    g.px(L - 1, eyeY + 1, k.skinD);
    g.px(R + 2, eyeY + 1, k.skinD);
  }
  if (set.age === 'elder') {
    g.px(cx - 3, G.mouthY - 1, k.skinD);
    g.px(cx + 3, G.mouthY - 1, k.skinD);
    g.rect(cx - 2, browY - 2, 4, 1, k.skinD);
  }
  // Marks
  const lighter = (rgb, t) => g.color(mixRgb(k.rgb.skin, rgb, t));
  if (set.marks === 'freckles') {
    const f = lighter([120, 60, 30], 0.35);
    for (const [x, y] of [[-4, 2], [-3, 3], [-5, 3], [3, 2], [4, 3], [2, 3]]) g.px(cx + x, eyeY + y, f);
  } else if (set.marks === 'mole') {
    g.px(cx + 3, G.mouthY - 1, lighter([40, 20, 14], 0.7));
  } else if (set.marks === 'scar') {
    g.line(cx + 3, eyeY + 2, cx + 5, eyeY + 4, lighter([255, 230, 225], 0.45));
  } else if (set.marks === 'blush') {
    const b = lighter([230, 100, 110], 0.4);
    g.rect(cx - 5, eyeY + 3, 2, 1, b);
    g.rect(cx + 3, eyeY + 3, 2, 1, b);
  } else if (set.marks === 'paint') {
    g.rect(L, eyeY + 3, 2, 1, k.accent);
    g.rect(R, eyeY + 3, 2, 1, k.accent);
  }
}

function facialHair(g, set, G, k) {
  const { cx, cy, rx, ry, mouthY } = G;
  if (set.facialHair === 'stubble') {
    const fuzz = g.color(mixRgb(k.rgb.skin, k.rgb.hair, 0.3));
    g.dither(Math.floor(cx - rx), mouthY - 1, Math.ceil(rx * 2 + 1), 5, fuzz, 0.5, (x, y) => g.get(x, y) === k.skin && (y > mouthY || Math.abs(x + 0.5 - cx) > 2.5));
  } else if (set.facialHair === 'beard') {
    g.ellipse(cx, cy + 0.6, rx + 0.3, ry + 0.6, k.hair, (x, y) => y >= mouthY - 2 && (y > mouthY - 2 || Math.abs(x + 0.5 - cx) > 2.5));
    g.rect(cx - 2, mouthY + 1, 5, 1, k.hairD);
  } else if (set.facialHair === 'goatee') {
    g.rect(cx - 1, mouthY + 1, 3, 2, k.hair);
  } else if (set.facialHair === 'chops') {
    for (const x of [Math.round(cx - rx), Math.round(cx + rx - 2)]) g.rect(x, G.earY, 2, mouthY - G.earY + 1, k.hair);
  }
}

const LIPS = { rose: [184, 72, 90], dark: [90, 42, 58] };

function mouth(g, set, G, k, expr, frame) {
  const { cx, mouthY: y } = G;
  const lip = g.color(LIPS[set.lips] ?? shade(k.rgb.skin, 0.62));
  const open = expr === 'talk' ? [0, 2, 1][frame % 3] : expr === 'alarm' ? 2 : 0;
  if (expr === 'grin') {
    g.rect(cx - 2, y, 5, 1, lip);
    g.px(cx - 3, y - 1, lip);
    g.px(cx + 3, y - 1, lip);
  } else if (open) {
    g.rect(cx - 1, y, 3, open, k.ink);
    g.rect(cx - 1, y - 1, 3, 1, lip);
  } else {
    g.rect(cx - 1, y, 3, 1, lip);
  }
  if (['mustache', 'goatee', 'beard'].includes(set.facialHair)) g.rect(cx - 2, y - 1 - (open ? 1 : 0), 5, 1, g.color(shade(k.rgb.hair, 0.8)));
}

/** v1's oxygen mask and hose, for a helmeted flight suit. */
function mask(g, G, expr, frame) {
  const { cx, mouthY } = G;
  const m = g.color([74, 82, 72]);
  const mD = g.color([50, 56, 50]);
  const lift = expr === 'talk' && frame % 2 ? -1 : 0;
  const top = mouthY - 1 + lift;
  g.rect(cx - 3, top, 7, 4, m);
  g.rect(cx - 2, top + 4, 5, 1, m);
  g.rect(cx - 1, top + 1, 3, 2, mD);
  if (expr === 'talk') g.px(cx + 2, top + 1, g.color(frame % 3 === 2 ? [80, 255, 120] : [40, 160, 70]));
  g.rect(cx - 1, top + 5, 2, 4, mD);
  g.rect(cx - 2, top + 8, 2, 2, mD);
}

function earrings(g, set, G) {
  if (set.earring === 'none') return;
  const gold = g.color(GOLD);
  for (const [x, d] of [[G.earL, -1], [G.earR, 1]]) {
    g.px(x, G.earY + 3, gold);
    if (set.earring === 'hoop') {
      g.px(x + d, G.earY + 4, gold);
      g.px(x, G.earY + 5, gold);
    }
  }
}

// ---------- Headwear ----------

/** Where hair stops when a hat sits on it. */
const CLIP = { cap: 3, beanie: 3, turban: 3, bandana: 3, hat: 2, hardhat: 3, beret: 1 };

/** Headwear painted behind the head: a headscarf's drape. */
function headwearBack(g, set, G, k) {
  if (set.headwear !== 'scarf') return;
  const { cx, cy, rx, ry, shoulderY } = G;
  g.polygon([[cx - rx - 2, cy + 2], [cx + rx + 2, cy + 2], [cx + rx + 4, shoulderY + 3], [cx - rx - 4, shoulderY + 3]], k.hat);
  g.ellipse(cx, cy + 0.5, rx + 2, ry + 1.8, k.hat);
  g.line(cx - rx - 2, cy + 3, cx - rx - 3, shoulderY + 2, k.hatD);
  g.line(cx + rx + 1, cy + 3, cx + rx + 2, shoulderY + 2, k.hatD);
}

function headwear(g, set, G, k) {
  const { cx, cy, rx, ry, T, eyeY } = G;
  const H = k.hat;
  switch (set.headwear) {
    case 'cap':
      g.ellipse(cx, T + 3.2, rx + 1, 4.4, H, (x, y) => y <= T + 2);
      g.rect(Math.round(cx - rx - 1), T + 3, Math.round(rx * 2 + 5), 1, k.hatD);
      g.px(Math.round(cx), T - 1, k.hatL);
      g.px(Math.round(cx - 3), T, k.hatL);
      break;
    case 'beanie':
      g.ellipse(cx, T + 3, rx + 1, 5, H, (x, y) => y <= T + 3);
      g.rect(Math.round(cx - rx - 1), T + 2, Math.round(rx * 2 + 2), 2, k.hatD);
      g.rect(Math.round(cx - 1), T - 2, 2, 1, k.hatL);
      break;
    case 'scarf':
      g.ellipse(cx, cy - 0.5, rx + 1.2, ry + 0.8, H, (x, y) => y <= eyeY - 3 || (Math.abs(x + 0.5 - cx) > rx - 0.8 && y <= G.chin));
      g.line(cx - rx, eyeY - 3, cx + rx - 1, eyeY - 3, k.hatD);
      break;
    case 'turban':
      g.ellipse(cx, T + 2, rx + 1.8, 5, H, (x, y) => y <= T + 4);
      g.line(cx - rx, T + 3, cx + 1, T - 2, k.hatD);
      g.line(cx - rx + 3, T + 4, cx + 4, T - 1, k.hatD);
      g.px(Math.round(cx), T + 2, k.accent);
      break;
    case 'headband':
      g.ellipse(cx, cy, rx + 1, ry + 1, H, (x, y) => y === T + 3);
      break;
    case 'bandana':
      g.ellipse(cx, T + 3, rx + 1, 4.4, H, (x, y) => y <= T + 3);
      g.dither(0, T - 2, PORTRAIT, 6, k.hatL, 0.15, (x, y) => g.get(x, y) === H);
      g.px(Math.round(cx + rx + 1), T + 3, H);
      g.px(Math.round(cx + rx + 2), T + 4, k.hatD);
      g.px(Math.round(cx + rx + 1), T + 5, k.hatD);
      break;
    case 'helmet': {
      // v1's flight helmet: shell, highlight, ear cups, paint stripe, visor up on the brow
      g.ellipse(cx, cy - 3.5, rx + 2.4, ry + 1, H, (x, y) => y <= eyeY - 2 || Math.abs(x + 0.5 - cx) > rx - 1);
      g.ellipse(cx - 2, T - 0.6, 3, 2, k.hatL);
      g.rect(Math.round(cx - rx - 2.4), eyeY - 1, 2, 6, k.hatD);
      g.rect(Math.round(cx + rx + 0.6), eyeY - 1, 2, 6, k.hatD);
      g.rect(cx - 1, T - 5, 2, 9, k.accent);
      const visor = g.color([200, 150, 40]);
      g.rect(cx - 6, eyeY - 5, 13, 2, visor);
      g.px(cx - 4, eyeY - 5, g.color([255, 225, 60]));
      break;
    }
    case 'headset': {
      const band = g.color([96, 100, 110]);
      g.ellipse(cx, cy - 0.5, rx + 1.4, ry + 0.9, band, (x, y) => {
        const dx = (x + 0.5 - cx) / (rx + 0.4);
        const dy = (y + 0.5 - cy + 0.5) / (ry - 0.1);
        return y <= G.earY && dx * dx + dy * dy > 1;
      });
      g.rect(Math.round(cx - rx - 1.5), G.earY - 1, 2, 5, band);
      g.rect(Math.round(cx + rx - 0.5), G.earY - 1, 2, 5, band);
      g.line(Math.round(cx + rx - 0.5), G.earY + 3, cx + 3, G.mouthY, band);
      g.px(cx + 2, G.mouthY, H);
      break;
    }
    case 'hat':
      g.ellipse(cx, T + 0.5, rx - 0.6, 3.6, H, (x, y) => y <= T + 1);
      g.rect(Math.round(cx - rx + 1), T + 1, Math.round(rx * 2 - 2), 1, k.accent);
      g.rect(Math.round(cx - rx - 3.5), T + 2, Math.round(rx * 2 + 7), 1, k.hatD);
      break;
    case 'hardhat':
      g.ellipse(cx, T + 3, rx + 1.2, 5.6, H, (x, y) => y <= T + 2);
      g.rect(Math.round(cx), T - 2, 1, 4, k.hatL);
      g.rect(Math.round(cx - rx - 2), T + 3, Math.round(rx * 2 + 4), 1, k.hatD);
      break;
    case 'beret':
      g.ellipse(cx - 1, T + 0.8, rx + 1.4, 2.4, H);
      g.px(Math.round(cx - 1), T - 2, k.hatD);
      g.rect(Math.round(cx - rx), T + 2, Math.round(rx * 2), 1, k.hatD);
      break;
    case 'flower': {
      const x = Math.round(cx + rx - 1);
      const y = T + 3;
      g.rect(x - 1, y, 3, 1, H);
      g.rect(x, y - 1, 1, 3, H);
      g.px(x, y, g.color(GOLD));
      break;
    }
    default:
  }
}

// ---------- Eyewear ----------

function eyewear(g, set, G) {
  const { cx, eyeY, L, R } = G;
  const frame = g.color([30, 30, 34]);
  switch (set.eyewear) {
    case 'round':
    case 'square':
      for (const x of [L, R]) {
        g.rect(x - 1, eyeY - 1, 4, 1, frame);
        g.rect(x - 1, eyeY + 2, 4, 1, frame);
        g.rect(x - 1, eyeY, 1, 2, frame);
        g.rect(x + 2, eyeY, 1, 2, frame);
      }
      if (set.eyewear === 'round') {
        // Knock the corners off.
        for (const x of [L - 1, L + 2, R - 1, R + 2]) {
          g.px(x, eyeY - 1, g.get(x, eyeY - 2) || g.get(x, eyeY));
          g.px(x, eyeY + 2, g.get(x, eyeY + 3) || g.get(x, eyeY + 1));
        }
      }
      g.rect(L + 2, eyeY, R - L - 2, 1, frame);
      break;
    case 'shades':
      g.rect(L - 1, eyeY - 1, R - L + 4, 1, frame);
      g.rect(L - 1, eyeY, 4, 2, frame);
      g.rect(R - 1, eyeY, 4, 2, frame);
      g.px(L, eyeY, g.color([150, 160, 180]));
      g.px(R, eyeY, g.color([150, 160, 180]));
      break;
    case 'goggles': {
      const strap = g.color([60, 48, 36]);
      const lens = g.color([90, 170, 190]);
      g.rect(Math.round(cx - G.rx - 1), eyeY, Math.round(G.rx * 2 + 2), 1, strap);
      for (const x of [L, R]) {
        g.rect(x - 1, eyeY - 1, 4, 4, g.color([120, 110, 96]));
        g.rect(x, eyeY, 2, 2, lens);
        g.px(x, eyeY, g.color([200, 240, 250]));
      }
      break;
    }
    case 'monocle':
      g.rect(R - 1, eyeY - 1, 4, 1, g.color(GOLD));
      g.rect(R - 1, eyeY + 2, 4, 1, g.color(GOLD));
      g.rect(R - 1, eyeY, 1, 2, g.color(GOLD));
      g.rect(R + 2, eyeY, 1, 2, g.color(GOLD));
      g.line(R + 2, eyeY + 3, R + 3, eyeY + 7, g.color(GOLD));
      break;
    case 'patch':
      g.rect(L - 1, eyeY - 1, 4, 3, frame);
      g.line(L - 1, eyeY - 1, Math.round(cx - G.rx), eyeY - 3, frame);
      g.line(L + 2, eyeY - 1, Math.round(cx + G.rx - 1), eyeY - 4, frame);
      break;
    case 'band': {
      const band = g.color([200, 210, 220]);
      g.rect(L - 2, eyeY, R - L + 6, 2, band);
      g.rect(L - 1, eyeY, R - L + 4, 1, g.color([110, 220, 240]));
      break;
    }
    default:
  }
}

// ---------- Portrait ----------

/**
 * A 32×32 portrait: { w, h, data, palette }. `frame` counts up for talking and alarms; `glance`
 * (0 or 1) looks left or right, else the eyes look in like v1's.
 */
export function drawPilot3(set, expression = 'idle', frame = 0, { glance = null } = {}) {
  const expr = EXPRESSIONS.includes(expression) ? expression : 'idle';
  const tilt = expr === 'strain' ? (frame % 2 ? 1 : 0) : 0;
  const g = new Grid(PORTRAIT);
  const k = inks(g, set);
  const G = geometry(set, tilt);
  const hidden = set.headwear === 'helmet' || set.headwear === 'scarf';
  const hairG = hatClips(set) ? below(g, G.T + (CLIP[set.headwear] ?? 0)) : g;

  torso(g, set, G, k);
  headwearBack(g, set, G, k);
  if (!hidden) hairBack(hairG, set, G, k);
  if (set.outfit !== 'turtleneck') g.rect(13, G.chin - 1, 6, G.shoulderY - G.chin + 1, k.skinD);
  face(g, set, G, k, expr, frame, glance);
  const masked = set.headwear === 'helmet' && set.outfit === 'flightsuit';
  if (masked) mask(g, G, expr, frame);
  else {
    facialHair(g, set, G, k);
    mouth(g, set, G, k, expr, frame);
  }
  earrings(g, set, G);
  if (!hidden) hairFront(hairG, set, G, k);
  headwear(g, set, G, k);
  eyewear(g, set, G);
  if (expr === 'strain' || expr === 'alarm') {
    if (frame % 4 < 2) {
      const drop = g.color([170, 220, 255]);
      g.px(G.cx + 6, G.eyeY - 2, drop);
      g.px(G.cx + 6, G.eyeY - 1, drop);
    }
  }
  g.outline(g.color([10, 10, 12]));
  return g.out();
}

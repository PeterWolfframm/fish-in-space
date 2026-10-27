// Fish v2: the v1 idea (a back line and a belly line, not a mirrored lens) drawn as a lit,
// rounded body at constant pixel density. A size class sets the fish's length in pixels; the
// canvas is fitted round the fish, so long fish get wide sprites and big fish get more detail
// (scales, rays, lateral line, an eye with an iris) rather than bigger pixels.
//
// Pure: genome + pose in, IndexedImage out.

import { mix, shade, lum } from '../../pixel/color.js';
import { roller } from '../../pixel/rng.js';
import { Surface } from '../kit/surface.js';
import { poly, ellipse, linePts } from '../kit/shapes.js';
import { noise2 } from '../kit/noise.js';
import { roundUp } from '../kit/sizes.js';
import { rest } from '../anim/rig.js';
import { fish2Traits } from './traits.js';

const HIGHLIGHT = '#f4f1e8';
const PUPIL = '#141018';

/** Nose-to-tail length in px for each size class. */
export const CLASS_LEN = { tiny: 18, small: 26, medium: 40, large: 56, huge: 84, giant: 116 };

/**
 * Bodies: `[t, height]` keys, t = 0 at the tail joint, 1 at the nose, heights in units of a
 * 27-unit body (v1's proportions). v1's eight archetypes keep their profiles; four are new.
 */
const BODIES = {
  torpedo: {
    back: [[0, 1.5], [0.12, 1.5], [0.3, 4.2], [0.55, 5.5], [0.8, 4.6], [0.93, 2.8], [1, 0.8]],
    belly: [[0, 1.5], [0.12, 1.3], [0.3, 3.7], [0.55, 4.4], [0.8, 3.5], [0.93, 2.1], [1, 0.8]],
    length: 1, dorsal: { from: 0.4, to: 0.72, peak: 0.3, boost: 1 }, anal: { from: 0.28, to: 0.5, boost: 0.6 },
  },
  round: {
    back: [[0, 1.5], [0.12, 2], [0.3, 5.8], [0.42, 7], [0.7, 5.6], [0.88, 3.4], [1, 1.2]],
    belly: [[0, 1.5], [0.12, 2], [0.3, 5], [0.55, 6.4], [0.78, 6], [0.92, 3.6], [1, 1.2]],
    length: 0.85, dorsal: { from: 0.38, to: 0.68, peak: 0.35, boost: 1 }, anal: { from: 0.3, to: 0.5, boost: 0.7 },
  },
  disc: {
    back: [[0, 1.5], [0.1, 2.4], [0.3, 5.4], [0.5, 6.2], [0.75, 5.2], [0.9, 3], [1, 1]],
    belly: [[0, 1.5], [0.1, 2.4], [0.3, 5.4], [0.5, 6], [0.75, 5], [0.9, 3], [1, 1]],
    length: 0.6, dorsal: { from: 0.28, to: 0.78, peak: 0.42, boost: 1.7, sharp: true }, anal: { from: 0.28, to: 0.72, boost: 1.6, sharp: true },
  },
  eel: {
    back: [[0, 0.4], [0.07, 1.1], [0.2, 2], [0.5, 2.6], [0.8, 3], [0.92, 3], [1, 1.2]],
    belly: [[0, 0.4], [0.07, 1.1], [0.2, 1.9], [0.5, 2.4], [0.8, 2.6], [0.92, 2.6], [1, 1.2]],
    length: 1.25, dorsal: { from: 0.04, to: 0.9, peak: 0.5, boost: 0.45 }, anal: { from: 0.04, to: 0.6, boost: 0.45 }, tail: 'none',
  },
  arrow: {
    back: [[0, 1.5], [0.12, 1.6], [0.35, 3.6], [0.6, 3.9], [0.78, 3.8], [0.9, 2.6], [1, 0.8]],
    belly: [[0, 1.5], [0.12, 1.6], [0.35, 3.6], [0.6, 4.6], [0.78, 3.6], [0.9, 2.4], [1, 0.8]],
    length: 1.1, dorsal: { from: 0.12, to: 0.36, peak: 0.5, boost: 0.9 }, anal: { from: 0.12, to: 0.32, boost: 0.7 },
  },
  pufferish: {
    back: [[0, 1.5], [0.1, 1.6], [0.3, 5.5], [0.5, 7], [0.75, 6.4], [0.9, 4], [1, 1.8]],
    belly: [[0, 1.5], [0.1, 1.6], [0.3, 5.5], [0.5, 7], [0.75, 6.4], [0.9, 4.2], [1, 1.8]],
    length: 0.7, dorsal: { from: 0.18, to: 0.4, peak: 0.5, boost: 0.5 }, anal: { from: 0.18, to: 0.38, boost: 0.5 }, tail: 'tiny', bigEye: 1.25,
  },
  shark: {
    back: [[0, 1.5], [0.12, 1.5], [0.35, 4.4], [0.55, 5], [0.8, 4.2], [0.93, 2.4], [1, 0.6]],
    belly: [[0, 1.5], [0.12, 1.3], [0.35, 3.6], [0.55, 4], [0.8, 3], [0.93, 2], [1, 1]],
    length: 1.05, dorsal: { from: 0.42, to: 0.66, peak: 0.6, boost: 1.4, sharp: true }, anal: { from: 0.2, to: 0.34, boost: 0.5 },
    tail: 'crescent', gillSlits: true, underMouth: true, pelvic: 0.3,
  },
  hatchet: {
    back: [[0, 1.5], [0.1, 1.6], [0.3, 2.4], [0.5, 2.6], [0.8, 2.6], [0.92, 2.2], [1, 1]],
    belly: [[0, 1.5], [0.1, 2], [0.25, 6.4], [0.45, 8], [0.65, 7], [0.85, 4], [1, 1]],
    length: 0.75, dorsal: { from: 0.3, to: 0.55, peak: 0.5, boost: 0.7 },
  },
  catfish: {
    back: [[0, 1.3], [0.12, 1.5], [0.35, 3.4], [0.6, 4], [0.85, 3.8], [0.95, 3], [1, 2.2]],
    belly: [[0, 1.2], [0.12, 1.4], [0.35, 3], [0.6, 3.6], [0.85, 3.2], [0.95, 2.6], [1, 1.6]],
    length: 1.1, dorsal: { from: 0.62, to: 0.76, peak: 0.25, boost: 1.3, sharp: true }, anal: { from: 0.1, to: 0.45, boost: 0.6 },
    barbels: 'long', flatHead: true,
  },
  betta: {
    back: [[0, 1.6], [0.12, 1.8], [0.35, 3.6], [0.6, 4], [0.85, 3.4], [0.95, 2.2], [1, 1]],
    belly: [[0, 1.6], [0.12, 1.9], [0.35, 3.9], [0.6, 4.3], [0.85, 3.6], [0.95, 2.4], [1, 1.1]],
    length: 0.8, dorsal: { from: 0.18, to: 0.55, peak: 0.45, boost: 1.7 }, anal: { from: 0.1, to: 0.55, boost: 1.3 },
    finBoost: 1.5, tail: 'veil',
  },
  koi: {
    back: [[0, 1.6], [0.12, 1.8], [0.3, 4.6], [0.55, 6], [0.8, 5.2], [0.93, 3.4], [1, 1.6]],
    belly: [[0, 1.6], [0.12, 1.6], [0.3, 4.2], [0.55, 5.2], [0.8, 4.4], [0.93, 2.8], [1, 1.4]],
    length: 1, dorsal: { from: 0.3, to: 0.72, peak: 0.25, boost: 0.8 }, anal: { from: 0.22, to: 0.36, boost: 0.7 },
    barbels: 'short', pelvic: 0.45,
  },
  angler: {
    back: [[0, 1.2], [0.15, 1.6], [0.4, 4], [0.7, 6.4], [0.9, 6.6], [1, 4.2]],
    belly: [[0, 1.2], [0.15, 1.8], [0.4, 4.5], [0.7, 6.8], [0.9, 6.2], [1, 3.4]],
    length: 0.85, dorsal: { from: 0.22, to: 0.42, peak: 0.5, boost: 0.8 }, anal: { from: 0.2, to: 0.4, boost: 0.7 },
    bigMouth: true, teeth: true, smallEye: true,
  },
};

const BELLY = { none: 0, soft: 0.26, pale: 0.4, white: 0.52 };
const DENSITY = { sparse: 0.55, even: 1, dense: 1.6 };
const FIN_LEN = { short: 0.75, normal: 1, long: 1.35, flowing: 1.8 };
const EYE = { small: 0.75, normal: 1, big: 1.35 };

function profileAt(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, h1] = keys[i];
    if (t > t1) continue;
    const [t0, h0] = keys[i - 1];
    const u = (t - t0) / Math.max(1e-6, t1 - t0);
    return h0 + (h1 - h0) * (1 - Math.cos(Math.PI * u)) / 2;
  }
  return last[1];
}

function snouted(keys, snout, side) {
  const out = keys.map(([t, h]) => [t, h]);
  const nose = out[out.length - 1];
  const brow = out[out.length - 2];
  if (snout === 'pointed') {
    nose[1] = Math.min(nose[1], 0.5);
    brow[1] *= 0.8;
  } else if (snout === 'long') {
    nose[1] = Math.min(nose[1], 1.2);
    brow[1] *= 0.85;
  } else if (snout === 'under') {
    if (side === 'belly') nose[1] = Math.max(nose[1], 1.6);
    else nose[1] = Math.min(nose[1], 0.6);
  } else nose[1] = Math.max(nose[1], 2.2);
  return out;
}

const hexOf = (set, id) => fish2Traits.choiceOf(set, id)?.hex ?? '#888888';

/**
 * The fish's geometry in a pose, in canvas pixels. Laid out once at rest to size the canvas, then
 * again per frame inside it.
 */
function layout(set, pose, canvas = null) {
  const arch = BODIES[set.body] ?? BODIES.torpedo;
  const L = CLASS_LEN[set.size] ?? CLASS_LEN.medium;
  const unit = (L * 0.7) / 27;
  const finLen = FIN_LEN[set.finLength] * (arch.finBoost ?? 1);
  const tailKind = arch.tail ?? set.tail;
  const tailLen = tailKind === 'none' ? 0 : L * 0.27 * (tailKind === 'tiny' ? 0.5 : 1) * Math.sqrt(finLen) * ({ fan: 1, fork: 1.05, round: 0.9, lyre: 1.15, veil: 1.15, crescent: 1.1 }[tailKind] ?? 1);
  const bodyLen = L * 0.72 * arch.length;
  const beak = set.snout === 'long' ? Math.max(2, L * 0.07) : 0;
  const back = snouted(arch.back, set.snout, 'back');
  const belly = snouted(arch.belly, set.snout, 'belly');
  const maxBack = Math.max(...back.map((k) => k[1])) * unit;
  const maxBelly = Math.max(...belly.map((k) => k[1])) * unit;
  const dorsalH = set.dorsal === 'none' ? 0 : ({ low: 2.5, tall: 5, spiny: 4.5, sail: 6.5 }[set.dorsal] ?? 2.5) * arch.dorsal.boost * unit * Math.min(1.5, finLen);
  const analH = arch.anal ? dorsalH * arch.anal.boost * 0.8 + (set.dorsal === 'none' ? 2 * unit : 0) : unit;
  const tailSpread = Math.min(tailLen * 0.62, (maxBack + maxBelly) * 1.25);
  const waveAmp = Math.min(3 + L * 0.02, bodyLen * 0.07) * 1.8;

  let W;
  let H;
  let mid;
  let x0;
  if (canvas) {
    ({ w: W, h: H, mid, x0 } = canvas);
  } else {
    const up = Math.max(maxBack + dorsalH, tailSpread * 0.6) + waveAmp + 2;
    const down = Math.max(maxBelly + analH, tailSpread * 0.6) + waveAmp + 2 + (arch.barbels || set.barbels !== 'none' ? unit * 2 : 0);
    const lureUp = arch.bigMouth && set.lure === 'lure' ? unit * 4 : 0;
    W = roundUp(tailLen + bodyLen + beak + 6, 4);
    H = roundUp(up + down + lureUp + 4, 4);
    mid = Math.round(2 + lureUp + up + (H - (up + down + lureUp + 4)) / 2);
    x0 = Math.round((W - (tailLen + bodyLen + beak)) / 2 + tailLen);
  }
  const xb = x0 + bodyLen;
  const x1 = xb + beak;
  const t = (x) => (x - x0) / Math.max(1, xb - x0);
  const cx = (x0 - tailLen + x1) / 2;
  const amp = Math.min(3 + L * 0.02, bodyLen * 0.07) * pose.amp;
  const wave = pose.wave * Math.PI * 2;
  const geo = {
    set, arch, L, unit, finLen, tailKind, tailLen, bodyLen, beak, x0, xb, x1, W, H, midY: mid, tailSpread, cx, dorsalH, analH,
    t,
    back(x) {
      if (x < x0 || x > x1) return 0;
      if (x > xb) return (1.4 - ((x - xb) / beak) * 0.6) * unit * 0.8;
      return profileAt(back, t(x)) * unit;
    },
    belly(x) {
      if (x < x0 || x > x1) return 0;
      if (x > xb) return (1.4 - ((x - xb) / beak) * 0.6) * unit * 0.8;
      return profileAt(belly, t(x)) * unit;
    },
    mid(x) {
      const u = Math.min(1, Math.max(0, t(x)));
      return mid + pose.bob + Math.sin(wave - u * 2.1) * (1 - u) ** 1.6 * amp - pose.lean * (x - cx) * 0.12;
    },
    /** The tail joint's sideways lag behind the body wave. */
    tailSwing: Math.sin(wave - 0.9) * amp * 1.4 + pose.tail * amp * 1.2,
  };
  return geo;
}

/** The canvas a genome's fish needs: fitted at rest, room left for the swim. */
export function fishCanvas(genome) {
  const set = fish2Traits.normalize(genome);
  const g = layout(set, rest('fish'));
  return { w: g.W, h: g.H, mid: g.midY, x0: g.x0 };
}

function finHex(set) {
  const skin = hexOf(set, 'skin');
  switch (set.finTint) {
    case 'light': return { hex: shade(skin, 1.3), alpha: 235 };
    case 'dark': return { hex: shade(skin, 0.68), alpha: 245 };
    case 'accent': return { hex: hexOf(set, 'markColor'), alpha: 235 };
    case 'clear': return { hex: mix(skin, HIGHLIGHT, 0.55), alpha: 165 };
    default: return { hex: skin, alpha: 240 };
  }
}

/** Fin rays: darker lines from base to edge, only where the fin is big enough to carry them. */
function rays(s, part, lines) {
  for (const [ax, ay, bx, by] of lines) {
    if (Math.hypot(bx - ax, by - ay) < 4) continue;
    for (const [x, y] of linePts(ax, ay, bx, by)) if (s.partAt(x, y) === part) s.dt[s.idx(x, y)] = -1;
  }
}

/** Fins light up toward their edge, as membranes do against the light. */
const finLight = (cx, cy, reach) => (x, y, v) => v * 0.6 + 0.2 + Math.min(1, Math.hypot(x - cx, y - cy) / Math.max(1, reach)) * 0.3;

function tail(s, geo, mats) {
  const { tailKind, tailLen, x0, unit } = geo;
  if (tailKind === 'none' || tailLen <= 0) return;
  const hx = x0 + Math.max(1, unit * 1.5);
  const hy = geo.mid(hx);
  const up = Math.max(1.2, geo.back(hx));
  const down = Math.max(1.2, geo.belly(hx));
  const tipX = hx - tailLen - 1;
  const tipY = hy + geo.tailSwing;
  const spread = geo.tailSpread;
  let shape;
  let lines = [];
  if (tailKind === 'fork' || tailKind === 'lyre' || tailKind === 'crescent') {
    const notch = tailKind === 'lyre' ? 0.62 : 0.45;
    const nx = tipX + (hx - tipX) * notch;
    const ny = hy + (tipY - hy) * notch;
    const ux = tailKind === 'crescent' ? tipX - unit : tipX;
    const lx = tailKind === 'crescent' ? tipX + tailLen * 0.3 : tipX;
    const ls = tailKind === 'crescent' ? 0.7 : 1;
    const curl = tailKind === 'lyre' ? spread * 0.15 : 0;
    shape = poly([[hx, hy - up], [ux + curl, tipY - spread - curl], [ux + tailLen * 0.15, tipY - spread * 0.72], [nx, ny], [lx + tailLen * 0.15, tipY + spread * 0.72 * ls], [lx + curl, tipY + spread * ls + curl], [hx, hy + down]]);
    lines = [[hx, hy - up * 0.5, ux, tipY - spread * 0.9], [hx, hy + down * 0.5, lx, tipY + spread * 0.9 * ls], [hx, hy, nx - 1, ny]];
  } else if (tailKind === 'round' || tailKind === 'tiny') {
    shape = ellipse((hx + tipX) / 2, (hy + tipY) / 2, tailLen / 2 + 1, Math.max(2, spread * 0.8));
    lines = [-0.6, -0.2, 0.2, 0.6].map((k) => [hx, hy, tipX + 1, tipY + k * spread * 0.8]);
  } else {
    // Fan and veil: a flared trapezoid; the veil trails and droops.
    const droop = tailKind === 'veil' ? spread * 0.3 : 0;
    const scallop = tailKind === 'veil' ? 2 : 0;
    shape = poly([[hx, hy - up], [tipX + scallop, tipY - spread + droop * 0.4], [tipX - scallop, tipY + droop * 0.4], [tipX + scallop, tipY + spread + droop], [hx, hy + down]]);
    lines = [-0.8, -0.4, 0, 0.4, 0.8].map((k) => [hx, hy + k * up * 0.5, tipX + 1, tipY + k * spread + (k > 0 ? droop : droop * 0.4)]);
  }
  const part = s.fill(shape, { box: shape.box, mat: mats.fin, flat: 0.65, light: finLight(hx, hy, tailLen) });
  if (geo.L >= 26) rays(s, part, lines);
}

function dorsalAndAnal(s, geo, mats) {
  const { set, arch, x0, bodyLen, unit } = geo;
  const lines = [];
  const membrane = (pts, reachX, reachY, reach, rayLines) => {
    const shape = poly(pts);
    const part = s.fill(shape, { box: shape.box, mat: mats.fin, flat: 0.65, light: finLight(reachX, reachY, reach) });
    if (geo.L >= 26) rays(s, part, rayLines);
  };
  if (set.dorsal !== 'none') {
    const style = set.dorsal;
    const sail = style === 'sail';
    const from = x0 + bodyLen * (sail ? Math.min(arch.dorsal.from, 0.2) : arch.dorsal.from);
    const to = x0 + bodyLen * (sail ? Math.max(arch.dorsal.to, 0.85) : arch.dorsal.to);
    const peak = arch.dorsal.peak;
    const lift = (u) => {
      if (arch.dorsal.sharp) return u < peak ? u / peak : 1 - (u - peak) / (1 - peak);
      if (style === 'spiny') return Math.sin(Math.PI * u) ** 0.5;
      if (style === 'tall') return u < peak ? Math.sin((Math.PI / 2) * (u / peak)) : Math.cos((Math.PI / 2) * ((u - peak) / (1 - peak))) ** 1.4;
      return Math.sin(Math.PI * u) ** 0.8;
    };
    const ridge = [];
    const foot = [];
    const n = Math.max(2, Math.round(to - from));
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n;
      const yb = geo.mid(x) - geo.back(x);
      // Fins sweep back: the ridge trails the base.
      const lag = lift(i / n) * geo.dorsalH * 0.35;
      ridge.push([x - lag, Math.max(1, yb - lift(i / n) * geo.dorsalH)]);
      foot.push([x, yb + unit]);
    }
    const rl = [];
    for (let i = 1; i < n; i += 3) rl.push([foot[i][0], foot[i][1] - unit, ridge[i][0], ridge[i][1]]);
    membrane([...ridge, ...[...foot].reverse()], (from + to) / 2, geo.mid(from) - geo.back((from + to) / 2), geo.dorsalH, rl);
    if (style === 'spiny') for (let i = 0; i <= n; i += 2) lines.push([foot[i][0], foot[i][1] - unit, ridge[i][0], ridge[i][1]]);
  }
  if (arch.anal) {
    const from = x0 + bodyLen * arch.anal.from;
    const to = x0 + bodyLen * arch.anal.to;
    const low = [];
    const top = [];
    const n = Math.max(2, Math.round(to - from));
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = from + (to - from) * u;
      const yv = geo.mid(x) + geo.belly(x);
      const l = arch.anal.sharp ? (u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6) : Math.sin(Math.PI * u) ** 0.9;
      low.push([x - l * geo.analH * 0.35, Math.min(geo.H - 2, yv + l * geo.analH)]);
      top.push([x, yv - unit]);
    }
    const rl = [];
    for (let i = 1; i < n; i += 3) rl.push([top[i][0], top[i][1] + unit, low[i][0], low[i][1]]);
    membrane([...low, ...[...top].reverse()], (from + to) / 2, geo.mid(from) + geo.belly((from + to) / 2), geo.analH, rl);
  }
  // Pelvic fin: a small leaf under the belly, forward of the anal fin, once there is room.
  if (geo.L >= 40 && arch.pelvic !== 0) {
    const px = x0 + bodyLen * (arch.pelvic ?? 0.52);
    const py = geo.mid(px) + geo.belly(px) - unit;
    const len = unit * 4 * Math.min(1.4, geo.finLen);
    const shape = poly([[px + unit, py], [px - len, py + len * 0.7], [px - len * 0.4, py + len * 0.35], [px - unit, py]]);
    s.fill(shape, { box: shape.box, mat: mats.fin, flat: 0.65, light: finLight(px, py, len) });
  }
  return lines;
}

function bodyFill(s, geo, mats) {
  const { x0, x1 } = geo;
  const top = [];
  const bot = [];
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    const xc = x + 0.5;
    top[x] = geo.mid(xc) - geo.back(xc);
    bot[x] = geo.mid(xc) + geo.belly(xc);
  }
  const inBody = (x, y) => top[x] !== undefined && geo.back(x + 0.5) + geo.belly(x + 0.5) >= 0.8 && y + 0.5 >= top[x] && y + 0.5 <= bot[x];
  const maxHalf = Math.max(...Object.values(top).map((_, i) => 0), geo.unit * 3);
  const part = s.fill(inBody, { box: [x0 - 1, 0, x1 + 1, geo.H - 1], mat: mats.body, dome: Math.max(2, maxHalf * 1.3) });
  return { part, inBody, top, bot };
}

function markings(s, geo, mats, body, seed) {
  const { set, x0, x1, unit } = geo;
  const { inBody, top, bot } = body;
  const box = [x0 - 1, 0, x1 + 1, geo.H - 1];
  const bellyAmount = BELLY[set.belly] ?? 0.26;
  const density = DENSITY[set.density] ?? 1;
  const span = x1 - x0;
  const rows = (x) => (bot[x] ?? 0) - (top[x] ?? 0);
  const fromTop = (x, y) => (y + 0.5 - top[x]) / Math.max(1, rows(x));
  const nz = noise2(seed, Math.max(2, unit * 2.2));

  // Countershading: a pale belly with a soft, dithered boundary, and a darker back.
  if (bellyAmount > 0) {
    s.recolor((x, y) => inBody(x, y) && fromTop(x, y) > 1 - bellyAmount * 1.25 + (nz(x, y) - 0.5) * 0.12, mats.belly, { box });
  }
  s.lift((x, y) => inBody(x, y) && fromTop(x, y) < 0.22, -0.1, { box });

  const aboveBelly = (x, y) => inBody(x, y) && fromTop(x, y) < 1 - Math.max(0.18, bellyAmount);
  const mark = mats.mark;
  switch (set.pattern) {
    case 'bars': {
      const count = Math.max(2, Math.round(4 * density));
      const w = Math.max(1, Math.round(1.6 * density * unit));
      for (let i = 0; i < count; i++) {
        const bx = x0 + (span * (i + 0.7)) / (count + 0.4);
        s.recolor((x, y) => aboveBelly(x, y) && x >= bx - (y - geo.mid(x)) * 0.15 && x < bx + w - (y - geo.mid(x)) * 0.15, mark, { box });
      }
      break;
    }
    case 'stripe':
      s.recolor((x, y) => {
        if (!inBody(x, y)) return false;
        const c = geo.mid(x + 0.5) - geo.back(x + 0.5) * 0.05;
        const th = Math.max(1, rows(x) * 0.13 * density);
        return Math.abs(y + 0.5 - c) <= th / 2;
      }, mark, { box });
      break;
    case 'spots': {
      const { range } = roller(seed, 600);
      const count = Math.round(8 * density * Math.max(1, geo.L / 40));
      const spots = [];
      for (let i = 0; i < count; i++) {
        const sx = range(x0 + 2, x1 - 3, 10 + i);
        const sy = geo.mid(sx) + range(-geo.back(sx) * 0.75, geo.belly(sx) * 0.5, 60 + i);
        spots.push([sx, sy, (0.8 + range(0, 1.2, 110 + i)) * unit]);
      }
      s.recolor((x, y) => inBody(x, y) && spots.some(([sx, sy, r]) => (x + 0.5 - sx) ** 2 + (y + 0.5 - sy) ** 2 <= r * r), mark, { box });
      break;
    }
    case 'saddle': {
      const count = Math.max(2, Math.round(3 * density));
      const w = Math.max(2, 3 * density * unit);
      for (let i = 0; i < count; i++) {
        const bx = x0 + (span * (i + 0.8)) / (count + 0.6);
        s.recolor((x, y) => inBody(x, y) && fromTop(x, y) < 0.5 - Math.abs(x + 0.5 - bx - w / 2) / w * 0.4 && Math.abs(x + 0.5 - bx - w / 2) < w / 2 + 1, mark, { box });
      }
      break;
    }
    case 'tiger':
      s.recolor((x, y) => aboveBelly(x, y) && ((x + (y - geo.mid(x)) * 0.5) / Math.max(2, 3 * unit / density)) % 1 < 0.38 && nz(x * 2, y) > 0.3, mark, { box });
      break;
    case 'patches': {
      const big = noise2(`${seed}:koi`, Math.max(3, geo.bodyLen / 5));
      s.recolor((x, y) => inBody(x, y) && fromTop(x, y) < 0.8 && big(x, y) > 0.62 - density * 0.06, mark, { box });
      break;
    }
    case 'mottle':
      s.recolor((x, y) => inBody(x, y) && nz(x * 1.7, y * 1.7) > 0.68 - density * 0.08, mark, { box });
      break;
    default:
  }

  // Scales: a scalloped lattice of darker arcs, only once the body has room for it.
  const deepest = Math.max(...Object.keys(top).map((x) => rows(+x)));
  const scaleSize = { fine: 2, plate: 3, armor: 4 }[set.scales];
  if (scaleSize && deepest >= 9 + scaleSize * 2) {
    const sz = Math.max(2, Math.round(scaleSize * Math.max(1, unit * 0.8)));
    s.tone((x, y) => {
      if (!inBody(x, y) || geo.t(x) > 0.8 || geo.t(x) < 0.08) return false;
      const f = fromTop(x, y);
      if (f < 0.12 || f > 0.9) return false;
      const row = Math.floor(y / sz);
      const xx = x + (row % 2 ? sz / 2 : 0);
      const fx = ((xx % sz) + sz) % sz;
      const fy = ((y % sz) + sz) % sz;
      // The trailing (tail-ward) edge of each scale, curved: the arc a scale's rim makes.
      return fx === 0 && fy > 0 ? true : fy === sz - 1 && fx < sz / 2;
    }, -1, { box });
    if (set.scales !== 'fine') s.tone((x, y) => inBody(x, y) && geo.t(x) < 0.8 && fromTop(x, y) > 0.15 && fromTop(x, y) < 0.6 && ((x + (Math.floor(y / sz) % 2 ? sz / 2 : 0)) % sz) === 1 && (y % sz) === 1, 1, { box });
  }

  // Lateral line: a row of pale dots along the flank.
  if (set.lateral === 'yes' && deepest >= 10) {
    s.tone((x, y) => {
      if (!inBody(x, y)) return false;
      const t = geo.t(x);
      if (t < 0.1 || t > 0.76) return false;
      const ly = Math.round(geo.mid(x + 0.5) - geo.back(x + 0.5) * 0.3 + Math.sin(t * 6) * 0.6);
      return y === ly && x % 2 === 0;
    }, 1, { box });
  }

  // Gill cover: a dark arc with lit skin in front of it.
  const gx = x0 + geo.bodyLen * (geo.arch.flatHead ? 0.8 : 0.76);
  if (geo.back(gx) > 1.5) {
    if (geo.arch.gillSlits) {
      for (let i = 0; i < 3 + (geo.L > 60 ? 2 : 0); i++) {
        const sx = Math.round(gx - i * Math.max(2, unit * 1.5));
        const h = Math.max(1, Math.round(geo.back(sx) * 0.45));
        s.tone((x, y) => x === sx && inBody(x, y) && Math.abs(y + 0.5 - geo.mid(sx)) <= h, -1, { box });
      }
    } else {
      const arc = (y) => gx + 1.4 * unit * (1 - ((y + 0.5 - geo.mid(gx)) / Math.max(1, geo.back(gx) * 0.75)) ** 2);
      s.tone((x, y) => inBody(x, y) && fromTop(x, y) > 0.15 && fromTop(x, y) < 0.85 && Math.round(arc(y)) === x, -1, { box });
      if (geo.L >= 40) s.lift((x, y) => inBody(x, y) && x > arc(y) && x < arc(y) + unit * 1.5 && fromTop(x, y) < 0.6, 0.12, { box });
    }
  }
}

function pectoral(s, geo, mats, pose) {
  const { x0, bodyLen, unit, set } = geo;
  const px = x0 + bodyLen * 0.7;
  if (geo.belly(px) < 1.5) return;
  const size = ({ small: 2.6, round: 3.6, long: 4.8, wing: 5.6 }[set.pectoral] ?? 2.6) * unit * Math.min(1.4, geo.finLen) * (geo.tailKind === 'tiny' ? 0.7 : 1);
  const sweep = 0.75 + pose.fin * 0.3;
  const py = geo.mid(px) + geo.belly(px) * 0.2;
  const shape = set.pectoral === 'round'
    ? ellipse(px - size * 0.45 * sweep, py + size * 0.3, size * 0.55, size * 0.4)
    : poly([[px + unit, py - unit], [px - size * sweep, py + size * 0.3], [px - size * 0.55, py + size * 0.75], [px, py + unit]]);
  const part = s.fill(shape, { box: shape.box, mat: mats.fin, flat: 0.5, light: finLight(px, py, size) });
  if (geo.L >= 40) rays(s, part, [[px, py, px - size * sweep, py + size * 0.3], [px, py, px - size * 0.6, py + size * 0.7]]);
}

function eye(s, geo, pose) {
  const { set, arch, x0, bodyLen, unit, beak } = geo;
  const ex = x0 + bodyLen * (arch.flatHead ? 0.9 : 0.86) + (beak ? 1 : 0);
  const depth = geo.back(ex) + geo.belly(ex);
  if (depth < 3) return;
  const ey = geo.mid(ex) - geo.back(ex) * (arch.flatHead ? 0.55 : 0.38);
  const r = Math.max(0.6, Math.min(depth * 0.2, unit * 1.3) * EYE[set.eye] * (arch.bigEye ?? 1) * (arch.smallEye ? 0.6 : 1));
  const skin = hexOf(set, 'skin');
  const iris = hexOf(set, 'eyeColor');
  const sclera = s.color(lum(skin) > 0.55 ? shade(skin, 0.5) : mix(skin, HIGHLIGHT, 0.7));
  const pupil = s.color(PUPIL);
  const glint = s.color(HIGHLIGHT);
  const lid = s.color(shade(skin, 0.7));
  const irisC = s.color(iris);
  const irisL = s.color(mix(iris, HIGHLIGHT, 0.35));
  if (pose.lid > 0.5) {
    const w = Math.max(2, Math.round(r * 2));
    for (let i = 0; i < w; i++) s.pin(Math.round(ex - r) + i, Math.round(ey), lid);
    return;
  }
  if (r < 1.2) {
    // Small eyes: v1's hand-set stamp, the pupil forward, one glint.
    const L = Math.round(ex - 1);
    const T = Math.round(ey - 1);
    s.pin(L, T, pupil);
    s.pin(L + 1, T, glint);
    s.pin(L, T + 1, pupil);
    s.pin(L + 1, T + 1, pupil);
    return;
  }
  // A socket of shadow round the eye, then sclera, iris lit from below, pupil, catchlight.
  s.tone((x, y) => (x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 <= (r + 1) ** 2, -1, { box: [ex - r - 2, ey - r - 2, ex + r + 2, ey + r + 2] });
  for (let y = Math.floor(ey - r - 1); y <= ey + r + 1; y++) {
    for (let x = Math.floor(ex - r - 1); x <= ex + r + 1; x++) {
      const dx = x + 0.5 - ex;
      const dy = y + 0.5 - ey;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const fx = dx - r * 0.18; // the pupil looks forward
      const pd = Math.hypot(fx, dy);
      let c = sclera;
      if (pd <= r * 0.78) c = dy > r * 0.15 ? irisL : irisC;
      if (pd <= r * 0.45) c = pupil;
      s.pin(x, y, c);
    }
  }
  s.pin(Math.floor(ex - r * 0.35), Math.floor(ey - r * 0.45), glint);
  if (r >= 3) s.pin(Math.floor(ex + r * 0.3), Math.floor(ey + r * 0.35), glint);
}

function mouth(s, geo, pose, mats) {
  const { set, arch, x1, unit } = geo;
  const under = set.snout === 'under' || arch.underMouth;
  const big = arch.bigMouth;
  const mx = Math.round(x1);
  const my = Math.round(geo.mid(mx) + (under ? Math.max(0.6, geo.belly(mx) * 0.6) : big ? geo.belly(mx) * 0.1 : 0.3));
  const len = Math.max(2, Math.round(unit * (big ? 5 : 1.6)));
  // Open (pose.mouth > 0), the gape is a near-black gullet, wide enough to read at every size.
  const open = Math.round(pose.mouth * Math.max(1, unit * (big ? 3 : 2)));
  const ink = s.color(shade(hexOf(set, 'skin'), 0.3));
  const gullet = s.color(shade(hexOf(set, 'skin'), 0.1));
  for (let i = 0; i < len; i++) {
    const x = mx - i;
    const slope = big ? Math.round(i * 0.35) : 0;
    s.pin(x, my + slope, open ? gullet : ink);
    for (let k = 1; k <= open; k++) if (i < len - k) s.pin(x, my + slope + k, k === open ? ink : gullet);
  }
  if (arch.teeth && geo.L >= 40) {
    const tooth = s.color(HIGHLIGHT);
    for (let i = 1; i < len - 1; i += 2) s.pin(mx - i, my + Math.round(i * 0.35) - 1, tooth);
  }
  // Barbels: whiskers trailing back from the lip.
  const kind = set.barbels !== 'none' ? set.barbels : arch.barbels;
  if (kind) {
    const L = unit * (kind === 'long' ? 8 : 4);
    for (const [i, a] of [[0, -2.1], [1, -2.6]]) {
      s.stroke({ x: mx - i * unit, y: my + 1, angle: a, len: L * (1 - i * 0.3), bend: 0.6, width: () => 1, sway: (u) => Math.sin(pose.wave * Math.PI * 2 + u * 3) * u },
        { mat: mats.barbel, profile: 'round', seam: false });
    }
  }
}

function lure(s, geo, pose) {
  const { set, arch, x1, unit } = geo;
  if (!(arch.bigMouth && set.lure === 'lure')) return;
  const bx = x1 - unit * 3;
  const by = geo.mid(bx) - geo.back(bx);
  const len = unit * 7;
  const st = { x: bx, y: by + 1, angle: 0.35, len, bend: 1.6, width: () => 1 };
  s.stroke(st, { mat: s.mats.length - 1, profile: 'round', seam: false });
  const end = { x: bx, y: by };
  // Find the stalk's end by walking it.
  let px = st.x;
  let py = st.y;
  for (let d = 0; d < len; d += 0.25) {
    const a = st.angle + st.bend * (d / len);
    px += Math.sin(a) * 0.25;
    py -= Math.cos(a) * 0.25;
  }
  end.x = px;
  end.y = py;
  const glow = s.color('#c8fff4', Math.round(150 + 105 * pose.glow));
  const core = s.color('#ffffff');
  const r = Math.max(1, unit * 0.9);
  for (let y = Math.floor(end.y - r); y <= end.y + r; y++) for (let x = Math.floor(end.x - r); x <= end.x + r; x++) if ((x + 0.5 - end.x) ** 2 + (y + 0.5 - end.y) ** 2 <= r * r) s.pin(x, y, glow);
  s.pin(Math.floor(end.x), Math.floor(end.y), core);
}

function rare(s, geo, pose, mats, body, seed) {
  const { set, x0, x1 } = geo;
  const { inBody } = body;
  const box = [x0 - 1, 0, x1 + 1, geo.H - 1];
  if (set.sheen !== 'none') {
    // A bright diagonal band sweeping head to tail over the top half.
    const sx = x0 - 6 + (x1 - x0 + 12) * pose.sheen;
    const w = Math.max(2, geo.unit * 2);
    s.lift((x, y) => inBody(x, y) && y < geo.mid(x) && Math.abs(x - sx - (y - geo.mid(x)) * 0.6) < w, set.sheen === 'metal' ? 0.45 : 0.3, { box });
  }
  if (set.glow === 'none') return;
  const glowHex = mix(hexOf(set, 'markColor'), HIGHLIGHT, 0.45);
  const alpha = Math.round(140 + 115 * pose.glow);
  const glow = s.color(glowHex, alpha);
  if (set.glow === 'edge' || set.glow === 'full') {
    s.recolor((x, y, i) => s.mat[i] === mats.fin && !inBody(x, y) && (!s.filled(x - 1, y) || !s.filled(x + 1, y) || !s.filled(x, y - 1) || !s.filled(x, y + 1)), mats.glow);
  }
  if (set.glow === 'spots' || set.glow === 'full') {
    const { range } = roller(seed, 900);
    const n = Math.round(6 * Math.max(1, geo.L / 40));
    for (let i = 0; i < n; i++) {
      const x = Math.round(range(x0 + 2, x1 - 3, i));
      const y = Math.round(geo.mid(x) + range(-geo.back(x) * 0.6, geo.belly(x) * 0.6, 30 + i));
      if (!inBody(x, y)) continue;
      s.pin(x, y, glow);
      if (geo.L >= 56) s.pin(x + 1, y, glow);
    }
  }
  if (set.glow === 'full') s.lift((x, y) => inBody(x, y), 0.08 + 0.1 * pose.glow, { box });
}

/** One fish in a pose. */
export function drawFish2(genome, pose = rest('fish')) {
  const set = fish2Traits.normalize(genome);
  const seed = fish2Traits.encode(set);
  const geo = layout(set, pose, fishCanvas(set));
  const s = new Surface(geo.W, geo.H);
  const skin = hexOf(set, 'skin');
  const fin = finHex(set);
  const bellyAmount = BELLY[set.belly] ?? 0.26;
  const mats = {
    fin: s.material(fin.hex, { alpha: fin.alpha }),
    body: s.material(skin, { steps: 6, base: 3 }),
    belly: s.material(set.belly === 'white' ? mix(skin, HIGHLIGHT, 0.8) : mix(skin, HIGHLIGHT, 0.35 + bellyAmount), { steps: 6, base: 3, shift: 14 }),
    mark: s.material(hexOf(set, 'markColor'), { steps: 6, base: 3 }),
    glow: s.material(mix(hexOf(set, 'markColor'), HIGHLIGHT, 0.55), { alpha: 230, dark: 0.2 }),
    barbel: s.material(shade(skin, 0.85)),
  };
  s.material(shade(skin, 0.8)); // the lure's stalk: the last material

  tail(s, geo, mats);
  dorsalAndAnal(s, geo, mats);
  const body = bodyFill(s, geo, mats);
  markings(s, geo, mats, body, seed);
  pectoral(s, geo, mats, pose);
  rare(s, geo, pose, mats, body, seed);
  eye(s, geo, pose);
  mouth(s, geo, pose, mats);
  lure(s, geo, pose);

  if (pose.turn) s.scaleX(geo.cx, Math.cos(pose.turn * Math.PI * 2));
  return s.render({ dither: geo.L >= 40 ? 0.09 : 0 });
}

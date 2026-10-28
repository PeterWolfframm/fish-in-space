/**
 * Drawing a fish from its genome.
 *
 * Pure: a genome in, an indexed image out. Nothing here touches a canvas, PIXI or the DOM, which
 * is what lets the same code feed the tank, the gallery and a PNG export.
 *
 * Parts are functions that paint into a shared Grid, composed back to front — later calls cover
 * earlier ones. The fish faces right; the renderer flips the sprite for direction.
 *
 * The silhouette is two separate profiles, a back line and a belly line, each a handful of
 * keypoints along the body. That asymmetry is the whole difference between a fish and a lens:
 * a goldfish has a humped back over a deep belly, a pike has a straight back, a hatchetfish is
 * all keel, and none of those exist when the top is the bottom mirrored.
 */

import { Grid } from '../../pixel/grid.js';
import { roller } from '../../pixel/rng.js';
import { shade, mix, lum } from '../../pixel/color.js';

import { fishTraits, hexOf } from './genome.js';

import { INK, HIGHLIGHT } from './palettes.js';

/** The sprite grid. Wide enough for a long tail and a sail fin without clipping. */
export const FISH_W = 48;
export const FISH_H = 32;

/** Frames in one tail beat. */
export const FISH_FRAMES = 6;

/** The body's resting centre line. One below the middle so a tall dorsal fin has headroom. */
const CM = FISH_H / 2 + 1;
/** The sprite keeps a clear 1-px border and a 1-px outline inside it: nothing paints past these. */
const TOP = 2;
const BOTTOM = FISH_H - 3;
/** The snout is anchored near the right edge; the body grows leftward from it, and the tail
 * hangs off the left end. Anchoring the nose rather than centring keeps a small fish's tail
 * attached instead of leaving a gap where the body used to reach. A long snout extends past
 * this, which is why it is not flush with the border. */
const SNOUT_X = 42;
const BODY_SPAN = 27;
/** The tail fin reaches this far into the body, so the two always overlap. */
const HINGE_INSET = 2;

/** `[t, height]` along the body: t = 0 at the tail joint, 1 at the nose; height in px at size 1. */

/**
 * Body archetypes. Every one is a real fish shape, named by what it reads as, and each has a
 * feature no other has — that is what makes a school look like different animals rather than
 * the same blob recoloured.
 */
const BODIES = {
  // Tuna: long, pointed, back humps further forward than the belly, hard pinch at the tail.
  torpedo: {
    back: [[0, 1.5], [0.12, 1.5], [0.3, 4.2], [0.55, 5.5], [0.8, 4.6], [0.93, 2.8], [1, 0.8]],
    belly: [[0, 1.5], [0.12, 1.3], [0.3, 3.7], [0.55, 4.4], [0.8, 3.5], [0.93, 2.1], [1, 0.8]],
    length: 1,
    dorsal: { from: 0.4, to: 0.72, peak: 0.3, boost: 1 },
    anal: { from: 0.28, to: 0.5, boost: 0.6 },
  },
  // Goldfish: a high hump, a steep forehead, a belly deeper than the back is tall.
  round: {
    back: [[0, 1.5], [0.12, 2], [0.3, 5.8], [0.42, 7], [0.7, 5.6], [0.88, 3.4], [1, 1.2]],
    belly: [[0, 1.5], [0.12, 2], [0.3, 5], [0.55, 6.4], [0.78, 6], [0.92, 3.6], [1, 1.2]],
    length: 0.85,
    dorsal: { from: 0.38, to: 0.68, peak: 0.35, boost: 1 },
    anal: { from: 0.3, to: 0.5, boost: 0.7 },
  },
  // Angelfish: the body is a short disc; the tall dorsal and anal fins make the outline.
  disc: {
    back: [[0, 1.5], [0.1, 2.4], [0.3, 5.4], [0.5, 6.2], [0.75, 5.2], [0.9, 3], [1, 1]],
    belly: [[0, 1.5], [0.1, 2.4], [0.3, 5.4], [0.5, 6], [0.75, 5], [0.9, 3], [1, 1]],
    length: 0.6,
    dorsal: { from: 0.28, to: 0.78, peak: 0.42, boost: 1.7 },
    anal: { from: 0.28, to: 0.72, boost: 1.6 },
  },
  // Eel: long and low, the head a touch deeper than the body, no tail fin — the body ends in a
  // point and a continuous ridge runs along most of it.
  eel: {
    back: [[0, 0.4], [0.07, 1.1], [0.2, 2], [0.5, 2.6], [0.8, 3], [0.92, 3], [1, 1.2]],
    belly: [[0, 0.4], [0.07, 1.1], [0.2, 1.9], [0.5, 2.4], [0.8, 2.6], [0.92, 2.6], [1, 1.2]],
    length: 1.25,
    dorsal: { from: 0.15, to: 0.95, peak: 0.5, boost: 0.5 },
    anal: { from: 0.12, to: 0.6, boost: 0.5 },
    tail: 'none',
  },
  // Pike: a nearly straight back, a long flat duckbill head, and the dorsal fin set far back.
  arrow: {
    back: [[0, 1.5], [0.12, 1.6], [0.35, 3.6], [0.6, 3.9], [0.78, 3.8], [0.9, 2.6], [1, 0.8]],
    belly: [[0, 1.5], [0.12, 1.6], [0.35, 3.6], [0.6, 4.6], [0.78, 3.6], [0.9, 2.4], [1, 0.8]],
    length: 1.1,
    dorsal: { from: 0.12, to: 0.36, peak: 0.5, boost: 0.9 },
    anal: { from: 0.12, to: 0.32, boost: 0.7 },
  },
  // Puffer: round as a ball, stub fins, a stub tail, big eyes.
  pufferish: {
    back: [[0, 1.5], [0.1, 1.6], [0.3, 5.5], [0.5, 7], [0.75, 6.4], [0.9, 4], [1, 1.8]],
    belly: [[0, 1.5], [0.1, 1.6], [0.3, 5.5], [0.5, 7], [0.75, 6.4], [0.9, 4.2], [1, 1.8]],
    length: 0.7,
    dorsal: { from: 0.18, to: 0.4, peak: 0.5, boost: 0.5 },
    anal: { from: 0.18, to: 0.38, boost: 0.5 },
    tail: 'tiny',
  },
  // Shark: a lean body, a tall triangular dorsal, a pointed snout over an underslung mouth,
  // gill slits and a crescent tail with the upper lobe longer.
  shark: {
    back: [[0, 1.5], [0.12, 1.5], [0.35, 4.4], [0.55, 5], [0.8, 4.2], [0.93, 2.4], [1, 0.6]],
    belly: [[0, 1.5], [0.12, 1.3], [0.35, 3.6], [0.55, 4], [0.8, 3], [0.93, 2], [1, 1]],
    length: 1.05,
    dorsal: { from: 0.42, to: 0.66, peak: 0.6, boost: 1.4 },
    anal: { from: 0.2, to: 0.34, boost: 0.5 },
    tail: 'crescent',
    gillSlits: true,
  },
  // Hatchetfish: a flat back over a huge keel of a belly.
  hatchet: {
    back: [[0, 1.5], [0.1, 1.6], [0.3, 2.4], [0.5, 2.6], [0.8, 2.6], [0.92, 2.2], [1, 1]],
    belly: [[0, 1.5], [0.1, 2], [0.25, 6.4], [0.45, 8], [0.65, 7], [0.85, 4], [1, 1]],
    length: 0.75,
    dorsal: { from: 0.3, to: 0.55, peak: 0.5, boost: 0.7 },
  },
};

const SIZES = { tiny: 0.62, small: 0.8, medium: 1, large: 1.18, huge: 1.34 };

const BELLY = { none: 0, soft: 0.26, pale: 0.4, white: 0.52 };

const DENSITY = { sparse: 0.55, even: 1, dense: 1.6 };

/** Height of a profile at t, easing between its keypoints without overshoot. */
function profileAt(keys, t) {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, h1] = keys[i];
    if (t > t1) continue;
    const [t0, h0] = keys[i - 1];
    const u = (t - t0) / Math.max(1e-6, t1 - t0);
    const s = (1 - Math.cos(Math.PI * u)) / 2;
    return h0 + (h1 - h0) * s;
  }
  return last[1];
}

/** The nose and forehead keys reshaped by the snout trait, so the head geometry actually changes. */
function snouted(keys, snout, side) {
  const out = keys.map(([t, h]) => [t, h]);
  const nose = out[out.length - 1];
  const brow = out[out.length - 2];
  switch (snout) {
    case 'pointed':
      nose[1] = Math.min(nose[1], 0.5);
      brow[1] *= 0.8;
      break;
    case 'long':
      // The beak itself is added as extra columns past the body; here the head just slims.
      nose[1] = Math.min(nose[1], 1.2);
      brow[1] *= 0.85;
      break;
    case 'under':
      // The lower jaw juts: the belly reaches further than the back at the tip.
      if (side === 'belly') nose[1] = Math.max(nose[1], 1.6);
      else nose[1] = Math.min(nose[1], 0.6);
      break;
    default:
      nose[1] = Math.max(nose[1], 2.2);
  }
  return out;
}

/**
 * The body outline for a genome at an animation phase.
 *
 * Separated from painting because the fins, the pattern and the eye all need to know where the
 * body actually is, and because the tank wants the silhouette without a full render.
 */
export function fishShape(genome, phase = 0) {
  const archetype = BODIES[genome.body ?? 'torpedo'] ?? BODIES.torpedo;
  const scale = SIZES[genome.size ?? 'medium'] ?? 1;
  const snout = genome.snout ?? 'blunt';

  // The body proper runs x0..xb; a long snout adds a beak from xb to x1.
  const xb = Math.round(SNOUT_X - (1 - Math.min(1, scale)) * 2);
  const beak = snout === 'long' ? 3 : 0;
  const x1 = xb + beak;
  const span = Math.round(BODY_SPAN * archetype.length * (0.72 + scale * 0.3));
  const x0 = Math.max(10, xb - span);

  const backKeys = snouted(archetype.back, snout, 'back');
  const bellyKeys = snouted(archetype.belly, snout, 'belly');
  // Keep the deepest body inside the sprite with room for its fins and the outline.
  const depthCap = (CM - TOP - 3) / scale;

  const t = (x) => (x - x0) / Math.max(1, xb - x0);
  const beakHeight = (x) => {
    const u = (x - xb) / Math.max(1, beak);
    return 1.4 - u * 0.6;
  };

  return {
    x0,
    x1,
    archetype,
    scale,
    t,
    back(x) {
      if (x < x0 || x > x1) return 0;
      if (x > xb) return beakHeight(x) * Math.min(1, scale + 0.2);
      return Math.min(depthCap, profileAt(backKeys, t(x))) * scale;
    },
    belly(x) {
      if (x < x0 || x > x1) return 0;
      if (x > xb) return beakHeight(x) * Math.min(1, scale + 0.2);
      return Math.min(depthCap + 1, profileAt(bellyKeys, t(x))) * scale;
    },
    half(x) {
      return (this.back(x) + this.belly(x)) / 2;
    },
    mid(x) {
      // The swim wave: amplitude grows toward the tail, so the body leads and the tail follows.
      const u = Math.min(1, Math.max(0, t(x)));
      const sway = (1 - u) ** 1.6;
      return CM + Math.sin(phase * Math.PI * 2 - u * 2.1) * sway * 2.1;
    },
  };
}

/** Fin colours, derived from the body so a fish reads as one animal. */
function finColors(genome) {
  const skin = hexOf(genome, 'skin');
  const accent = hexOf(genome, 'markColor');
  const of = (base, alpha) => ({
    base,
    edge: shade(base, 0.72),
    ray: shade(base, 0.86),
    rim: shade(base, 1.3),
    alpha,
  });
  switch (genome.finTint) {
    case 'light':
      return of(shade(skin, 1.3), 255);
    case 'dark':
      return of(shade(skin, 0.68), 255);
    case 'accent':
      return of(accent, 255);
    case 'clear':
      return of(mix(skin, HIGHLIGHT, 0.55), 190);
    default:
      return of(skin, 255);
  }
}

/** The y of the back edge and belly edge at a column, as drawn. */
const edges = (shape, x) => {
  const cy = shape.mid(x);
  return { yb: Math.round(cy - shape.back(x)), yv: Math.round(cy + shape.belly(x)) };
};

/**
 * Ray lines from a fin's base to its edge, every third column, only over the fin itself. Sparse
 * and only a shade off: dense dark rays turn a fin into a comb.
 */
function rays(g, c, ce, base, tip) {
  for (let i = 1; i < base.length; i += 3) {
    const [bx, by] = base[i];
    const [tx, ty] = tip[i];
    if (Math.abs(ty - by) < 3.5) continue;
    const steps = Math.max(1, Math.round(Math.abs(ty - by)));
    for (let s = 1; s < steps; s++) {
      const u = s / steps;
      const x = Math.round(bx + (tx - bx) * u);
      const y = Math.round(by + (ty - by) * u);
      if (g.get(x, y) === c) g.px(x, y, ce);
    }
  }
}

/** The tail fin, hinged where the body pinches and swinging with the phase. */
function tail(g, genome, shape, phase) {
  const kind = shape.archetype.tail;
  if (kind === 'none') return;
  const { base, edge, rim, alpha } = finColors(genome);
  const c = g.color(base, alpha);
  const ce = g.color(edge, alpha);
  const cr = g.color(rim, alpha);

  const hingeX = shape.x0 + HINGE_INSET;
  const hingeY = shape.mid(hingeX);
  const up = Math.max(1.2, shape.back(hingeX));
  const down = Math.max(1.2, shape.belly(hingeX));
  // The tail trails a quarter-beat behind the body, which is what makes a swim read as a push.
  const swing = Math.sin(phase * Math.PI * 2 - 0.9) * 4.2;
  const { scale } = shape;
  const style = kind === 'crescent' ? 'fork' : genome.tail ?? 'fan';
  const stub = kind === 'tiny' ? 0.6 : 1;

  const len = ({ fan: 9, fork: 10, round: 8, lyre: 11, veil: 13 }[style] ?? 9) * (0.7 + scale * 0.35) * stub;
  const tipX = Math.max(2, hingeX - len);
  const tipY = hingeY + swing * stub;

  // Lyre lobes reach further than the nominal spread, so the multiplier has to be inside the
  // clamp, not applied after it. A tail clipped by the sprite edge reads instantly as broken,
  // and the outline pass then has nowhere to go.
  const lobe = style === 'lyre' ? 1.15 : 1;
  const lobeSpread = ({ fan: 7, fork: 8, round: 6, lyre: 9, veil: 8 }[style] ?? 7) * (0.7 + scale * 0.35) * stub;
  const room = Math.min(tipY - TOP, BOTTOM - tipY) / lobe;
  const spread = Math.max(2, Math.min(lobeSpread, room));

  if (style === 'fork' || style === 'lyre') {
    // Two lobes meeting at a notch. Drawn as separate triangles: a single outline through the
    // notch and back crosses itself, and a self-intersecting polygon scanline-fills as a spike.
    const notchFrac = style === 'lyre' ? 0.62 : 0.45;
    const notchX = tipX + (hingeX - tipX) * notchFrac;
    const notchY = hingeY + (tipY - hingeY) * notchFrac;
    // A shark's upper lobe is the long one.
    const upperX = kind === 'crescent' ? Math.max(2, tipX - 2) : tipX;
    const lowerX = kind === 'crescent' ? tipX + 2 : tipX;
    g.polygon([[hingeX, hingeY - up], [upperX, tipY - spread * lobe], [notchX, notchY]], c);
    g.polygon([[hingeX, hingeY + down], [lowerX, tipY + spread * lobe], [notchX, notchY]], c);
    // A lighter trailing edge on each lobe.
    g.line(upperX, tipY - spread * lobe, notchX, notchY, cr);
    g.line(lowerX, tipY + spread * lobe, notchX, notchY, cr);
  } else if (style === 'round') {
    g.ellipse((hingeX + tipX) / 2, (hingeY + tipY) / 2, len / 2 + 1, spread, c);
  } else {
    // Fan and veil: a trapezoid, veils just longer and softer.
    g.polygon([[hingeX, hingeY - up], [tipX, tipY - spread], [tipX, tipY + spread], [hingeX, hingeY + down]], c);
    g.line(tipX, tipY - spread, tipX, tipY + spread, cr);
  }

  // Rays, so a big tail is not a flat blob. Only over pixels the fin already covers.
  if (style === 'fan' || style === 'veil' || style === 'round') {
    for (let i = -1; i <= 1; i++) {
      const fromY = hingeY + i;
      const toY = tipY + i * spread * 0.7;
      const steps = Math.max(1, hingeX - tipX);
      for (let sIdx = 1; sIdx < steps; sIdx++) {
        const u = sIdx / steps;
        const x = Math.round(hingeX - u * steps);
        const y = Math.round(fromY + (toY - fromY) * u);
        if (g.get(x, y) === c) g.px(x, y, ce);
      }
    }
  }
}

/** The dorsal fin along the back, and the anal fin beneath. */
function finsAboveBelow(g, genome, shape) {
  if (genome.dorsal === 'none') return;
  const { base, edge, ray, rim, alpha } = finColors(genome);
  const c = g.color(base, alpha);
  const ce = g.color(edge, alpha);
  const cy = g.color(ray, alpha);
  const cr = g.color(rim, alpha);
  const { archetype, scale } = shape;
  const style = genome.dorsal ?? 'low';
  const span = shape.x1 - shape.x0;
  const bodySpan = Math.round(span / (1 + (genome.snout === 'long' ? 3 / Math.max(1, span - 3) : 0)));

  // How a fin rises along its length: a dome, a long dome, or a sharp triangle.
  const lift = (u) => {
    const peak = archetype.dorsal.peak;
    if (archetype.tail === 'crescent' || genome.body === 'disc') {
      return u < peak ? u / peak : 1 - (u - peak) / (1 - peak);
    }
    if (style === 'spiny') return Math.sin(Math.PI * u) ** 0.5;
    if (style === 'tall') return u < peak ? Math.sin((Math.PI / 2) * (u / peak)) : Math.cos((Math.PI / 2) * ((u - peak) / (1 - peak))) ** 1.4;
    return Math.sin(Math.PI * u) ** 0.8;
  };

  const height = ({ low: 2.5, tall: 5, spiny: 4.5, sail: 6.5 }[style] ?? 2.5) * archetype.dorsal.boost * (0.75 + scale * 0.25);
  const from = shape.x0 + Math.round(bodySpan * (style === 'sail' ? Math.min(archetype.dorsal.from, 0.2) : archetype.dorsal.from));
  const to = shape.x0 + Math.round(bodySpan * (style === 'sail' ? Math.max(archetype.dorsal.to, 0.85) : archetype.dorsal.to));

  const ridge = [];
  const foot = [];
  for (let x = from; x <= to; x++) {
    const u = (x - from) / Math.max(1, to - from);
    const yb = edges(shape, x).yb;
    ridge.push([x, Math.max(TOP, yb - lift(u) * height)]);
    foot.push([x, yb + 1]);
  }
  if (ridge.length < 2) return;
  g.polygon([...ridge, ...[...foot].reverse()], c);
  rays(g, c, cy, foot, ridge);
  for (let i = 0; i < ridge.length; i++) {
    const [x, y] = ridge[i];
    const ry = Math.round(y);
    if (g.get(x, ry) === c && ry < foot[i] [1] - 1) g.px(x, ry, cr);
  }
  if (style === 'spiny') {
    for (let i = 0; i < ridge.length; i += 2) {
      const [x, y] = ridge[i];
      g.line(x, y, x, foot[i] [1], ce);
    }
  }

  const anal = archetype.anal;
  if (!anal) return;
  const aFrom = shape.x0 + Math.round(bodySpan * anal.from);
  const aTo = shape.x0 + Math.round(bodySpan * anal.to);
  const aHeight = height * anal.boost * (genome.body === 'disc' ? 1 : 0.8);
  const low = [];
  const top = [];
  for (let x = aFrom; x <= aTo; x++) {
    const u = (x - aFrom) / Math.max(1, aTo - aFrom);
    const yv = edges(shape, x).yv;
    const l = genome.body === 'disc' ? (u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6) : Math.sin(Math.PI * u) ** 0.9;
    low.push([x, Math.min(BOTTOM, yv + l * aHeight)]);
    top.push([x, yv - 1]);
  }
  if (low.length < 2) return;
  g.polygon([...low, ...[...top].reverse()], c);
  rays(g, c, cy, top, low);
}

/** The body: contour-shaded, dark along the back, lit a row below it, pale underneath. */
function body(g, genome, shape) {
  const skin = hexOf(genome, 'skin');
  const dark = g.color(shade(skin, 0.72));
  const base = g.color(skin);
  const light = g.color(shade(skin, 1.18));
  const core = g.color(shade(skin, 0.84));
  const bellyAmount = BELLY[genome.belly ?? 'soft'] ?? 0.26;
  const bellyHex = genome.belly === 'white' ? mix(skin, HIGHLIGHT, 0.8) : mix(skin, HIGHLIGHT, 0.35 + bellyAmount);
  const belly = g.color(bellyHex);

  for (let x = shape.x0; x <= shape.x1; x++) {
    if (shape.back(x) + shape.belly(x) < 1) continue;
    const { yb, yv } = edges(shape, x);
    const rows = yv - yb + 1;
    const bellyRows = rows >= 4 ? Math.round(rows * bellyAmount) : 0;
    const t = shape.t(x);
    for (let y = yb; y <= yv; y++) {
      const fromTop = y - yb;
      const fromBottom = yv - y;
      let c = base;
      if (fromTop === 0 || (fromTop === 1 && rows >= 6)) c = dark;
      else if (fromTop === 2 && rows >= 7 && t > 0.25 && t < 0.92) c = light;
      else if (fromBottom < bellyRows) c = belly;
      else if (fromBottom === bellyRows && rows >= 6) c = core;
      g.px(x, y, c);
    }
  }
}

/** Markings, clipped to the body so nothing floats off the fish. */
function pattern(g, genome, shape, seed) {
  if (genome.pattern === 'plain') return;
  const markHex = hexOf(genome, 'markColor');
  const mark = g.color(markHex);
  const density = DENSITY[genome.density ?? 'even'] ?? 1;
  const bellyAmount = BELLY[genome.belly ?? 'soft'] ?? 0.26;
  const { r, range } = roller(seed, 600);

  const onBody = (x, y) => {
    if (shape.back(x) + shape.belly(x) < 1) return false;
    const { yb, yv } = edges(shape, x);
    return y >= yb && y <= yv;
  };
  // Bars and saddles stop short of the belly, which is what keeps them reading as markings on a
  // body rather than a body cut into slices.
  const aboveBelly = (x, y) => {
    if (!onBody(x, y)) return false;
    const { yb, yv } = edges(shape, x);
    return y <= yv - Math.round((yv - yb + 1) * Math.max(0.18, bellyAmount));
  };

  const span = shape.x1 - shape.x0;

  switch (genome.pattern) {
    case 'bars': {
      const count = Math.max(2, Math.round(4 * density));
      for (let i = 0; i < count; i++) {
        const x = shape.x0 + Math.round((span * (i + 0.7)) / (count + 0.4));
        const w = Math.max(1, Math.round(1.6 * density));
        for (let dx = 0; dx < w; dx++) {
          for (let y = 0; y < FISH_H; y++) if (aboveBelly(x + dx, y)) g.px(x + dx, y, mark);
        }
      }
      break;
    }
    case 'stripe': {
      for (let x = shape.x0; x <= shape.x1; x++) {
        const half = shape.half(x);
        if (half < 1) continue;
        const cy = shape.mid(x);
        const thickness = Math.min(3, Math.max(1, Math.round(half * 0.26 * density)));
        const y0 = Math.round(cy - thickness / 2);
        for (let dy = 0; dy < thickness; dy++) if (onBody(x, y0 + dy)) g.px(x, y0 + dy, mark);
      }
      break;
    }
    case 'spots': {
      const count = Math.round(8 * density);
      for (let i = 0; i < count; i++) {
        const x = Math.round(range(shape.x0 + 2, shape.x1 - 3, 10 + i));
        if (shape.half(x) < 1.5) continue;
        const y = Math.round(shape.mid(x) + range(-shape.back(x) * 0.7, shape.belly(x) * 0.6, 60 + i));
        const rr = 1 + Math.round(r(110 + i) * 1.2);
        g.ellipse(x, y, rr, rr, mark, onBody);
      }
      break;
    }
    case 'saddle': {
      const count = Math.max(2, Math.round(3 * density));
      for (let i = 0; i < count; i++) {
        const x = shape.x0 + Math.round((span * (i + 0.8)) / (count + 0.6));
        const w = Math.max(2, Math.round(3 * density));
        for (let dx = 0; dx < w; dx++) {
          const cx = x + dx;
          if (shape.back(cx) < 1) continue;
          const { yb } = edges(shape, cx);
          // Saddles sit over the back only.
          const to = Math.round(shape.mid(cx) - shape.back(cx) * 0.1);
          for (let y = yb; y <= to; y++) if (onBody(cx, y)) g.px(cx, y, mark);
        }
      }
      break;
    }
    case 'tiger': {
      for (let x = shape.x0; x <= shape.x1; x += 3) {
        if (shape.half(x) < 1.5) continue;
        const cy = shape.mid(x);
        const lean = ((x - shape.x0) % 6) - 3;
        g.line(x, cy - shape.back(x), x + lean * 0.5, cy + shape.belly(x) * 0.5, mark);
      }
      break;
    }
    case 'mottle':
    default:
      g.dither(shape.x0, 0, span + 1, FISH_H, mark, 0.22 * density, onBody);
      break;
  }
}

/**
 * Eyes as hand-set stamps rather than nested ellipses: at this size an ellipse of radius 1.5
 * is a smudge, and a 3x3 with the pupil set forward and a single glint is an eye.
 * S = sclera, P = pupil, H = glint.
 */
const EYES = {
  small: ['PH', 'PP'],
  normal: ['SPH', 'SPP', 'SSP'],
  big: ['SPPH', 'SPPP', 'SPPP', 'SSSP'],
};

/** Side fin, gill, mouth and eye — the details that make it read as a face. */
function head(g, genome, shape, phase) {
  const skin = hexOf(genome, 'skin');
  const { base, edge, alpha } = finColors(genome);
  const ink = g.color(INK);
  const { archetype } = shape;
  const span = shape.x1 - shape.x0;
  const bodySpan = genome.snout === 'long' ? span - 3 : span;

  // Pectoral fin just behind the gill, a leaf that sweeps back as the fish pushes.
  const px = shape.x0 + Math.round(bodySpan * 0.7);
  if (shape.belly(px) > 1.5) {
    const size = ({ small: 2.6, round: 3.6, long: 4.8, wing: 5.6 }[genome.pectoral ?? 'small'] ?? 2.6) * (archetype.tail === 'tiny' ? 0.7 : 1);
    const sweep = 0.75 + Math.sin(phase * Math.PI * 2 + 1.2) * 0.3;
    const py = shape.mid(px) + shape.belly(px) * 0.15;
    const fin = g.color(base, alpha);
    const finEdge = g.color(edge, alpha);
    g.polygon(
      [
        [px + 1, py - 1],
        [px - size * sweep, py + size * 0.35],
        [px - size * 0.5, py + size * 0.7],
        [px, py + 1],
      ],
      fin
    );
    g.line(px, py, px - size * sweep * 0.8, py + size * 0.4, finEdge);
  }

  // Gill: an operculum arc, or a shark's slits.
  const gx = shape.x0 + Math.round(bodySpan * 0.75);
  const gillInk = g.color(shade(skin, 0.74));
  if (shape.back(gx) > 1.5) {
    const gy = shape.mid(gx);
    if (archetype.gillSlits) {
      for (let i = 0; i < 3; i++) {
        const sx = gx - 1 - i * 2;
        if (shape.back(sx) > 1.5) g.line(sx, shape.mid(sx) - 1, sx, shape.mid(sx) + 1, gillInk);
      }
    } else {
      g.line(gx + 1, gy - shape.back(gx) * 0.55, gx, gy, gillInk);
      g.line(gx, gy, gx + 1, gy + shape.belly(gx) * 0.55, gillInk);
    }
  }

  // Eye, set high in the front quarter.
  const ex = shape.x0 + Math.round(bodySpan * 0.82) + (genome.snout === 'long' ? 1 : 0);
  let stamp = EYES[genome.eye ?? 'normal'] ?? EYES.normal;
  if (shape.back(ex) + shape.belly(ex) < stamp.length + 1.5) stamp = EYES.small;
  if (shape.back(ex) + shape.belly(ex) >= 3) {
    const size = stamp.length;
    const top = Math.round(shape.mid(ex) - shape.back(ex) * 0.55 - size / 2 + 0.5);
    const left = ex - size + 1;
    const sclera = g.color(lum(skin) > 0.55 ? shade(skin, 0.5) : mix(skin, HIGHLIGHT, 0.75));
    const pupil = g.color(hexOf(genome, 'eyeColor'));
    const glint = g.color(HIGHLIGHT);
    stamp.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        const c = ch === 'S' ? sclera : ch === 'P' ? pupil : glint;
        g.px(left + dx, top + dy, c);
      });
    });
  }

  // Mouth.
  const mx = shape.x1;
  const under = genome.snout === 'under' || archetype.gillSlits;
  const my = Math.round(shape.mid(mx) + (under ? Math.max(0.6, shape.belly(mx) * 0.6) : 0.3));
  g.line(mx - 1, my, mx, my, ink);
}

/** Rare traits: a glow pass and a metallic sheen, both over the finished body. */
function rareFlourish(g, genome, shape, phase, seed) {
  const onBody = (x, y) => {
    if (shape.back(x) + shape.belly(x) < 1) return false;
    const { yb, yv } = edges(shape, x);
    return y >= yb && y <= yv;
  };

  if (genome.sheen && genome.sheen !== 'none') {
    // A bright band that travels along the fish, which is what makes a sheen look wet.
    const sweep = shape.x0 + ((phase * (shape.x1 - shape.x0) * 1.4) % (shape.x1 - shape.x0 + 6)) - 3;
    const hot = g.color(genome.sheen === 'metal' ? HIGHLIGHT : mix(hexOf(genome, 'skin'), HIGHLIGHT, 0.7), 200);
    for (let x = Math.round(sweep); x < sweep + 2; x++) {
      for (let y = 0; y < FISH_H; y++) {
        if (onBody(x, y) && y < shape.mid(x)) g.px(x, y, hot);
      }
    }
  }

  if (!genome.glow || genome.glow === 'none') return;
  const glowHex = mix(hexOf(genome, 'markColor'), HIGHLIGHT, 0.45);
  // Pulse with the beat so a luminous fish breathes.
  const pulse = 0.6 + Math.sin(phase * Math.PI * 2) * 0.4;
  const glow = g.color(glowHex, Math.round(160 + pulse * 95));
  const { range } = roller(seed, 900);

  if (genome.glow === 'spots' || genome.glow === 'full') {
    for (let i = 0; i < 6; i++) {
      const x = Math.round(range(shape.x0 + 2, shape.x1 - 3, i));
      if (shape.half(x) < 1) continue;
      const y = Math.round(shape.mid(x) + range(-shape.back(x) * 0.7, shape.belly(x) * 0.7, 30 + i));
      g.px(x, y, glow);
      if (genome.glow === 'full') g.px(x + 1, y, glow);
    }
  }
  if (genome.glow === 'edge' || genome.glow === 'full') {
    g.outline(glow, { inward: true });
  }
}

/**
 * One frame of a fish.
 *
 * `frame` counts tail beats; the same genome and frame always produce the same pixels.
 */
export function drawFish(genome, frame = 0, frames = FISH_FRAMES) {
  const set = fishTraits.normalize(genome);
  const seed = fishTraits.encode(set);
  const phase = (frame % frames) / frames;

  const g = new Grid(FISH_W, FISH_H);
  const shape = fishShape(set, phase);

  tail(g, set, shape, phase);
  finsAboveBelow(g, set, shape);
  body(g, set, shape);
  pattern(g, set, shape, seed);
  head(g, set, shape, phase);
  rareFlourish(g, set, shape, phase, seed);

  g.outline(g.color(INK));
  return g.out();
}

/** Every frame of one fish's swim cycle. */
export function drawFishFrames(genome, frames = FISH_FRAMES) {
  return Array.from({ length: frames }, (_, i) => drawFish(genome, i, frames));
}

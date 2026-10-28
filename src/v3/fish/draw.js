// The fish3 painter: v1's fish (ink outline, five-tone column shading, hand-set eye stamps, sparse
// rays, flat swatches), generalised to any size at constant pixel density and to a body that
// actually swims (see kinematics.js).
//
// Everything on the body is painted in body space: for a pixel we look up which slice of the
// body it is (bx: px from the tail joint, dy: px from the centre line), so spots, scales and bars
// travel with the bending body instead of sliding over it.
//
// Pure: genome + pose in, an indexed image out, on a scratch canvas with a fixed origin. index.js
// crops every frame of a fish to one shared, body-fitted window.

import { Grid } from '../../pixel/grid.js';
import { roller, hash01 } from '../../pixel/rng.js';
import { shade, mix, lum, rotateHue } from '../../pixel/color.js';
import { phenotype } from './phenotype.js';
import { columns, tailYaw, finMapper, GAITS } from './kinematics.js';
import { bodyRamp, INK, HIGHLIGHT } from './colors.js';

const TAU = Math.PI * 2;
const DENSITY = { sparse: 0.55, even: 1, dense: 1.6 };

/**
 * The scratch canvas a fish is drawn on, and where its nose sits. Generous: index.js crops. The
 * canvas is sized for the fish's biggest life stage (`big`), so every stage shares one canvas and
 * one body centre; the nose sits half the current body length right of that centre.
 */
export function scratchOf(big, ph = big) {
  const s = big.s;
  const fin = Math.max(1, big.finMul, ph.finMul);
  const tailMax = 30 * s * fin + 6;
  const half = Math.ceil(Math.max(big.beak + big.L / 2 + 0.3 * big.L, big.L / 2 + tailMax) + 10);
  const h = Math.ceil(2 * (14 * s + 20 * s * fin) + 28);
  return { w: half * 2, h, origin: { x: half + Math.round(ph.L / 2), y: Math.round(h / 2) } };
}

/** Scanline-fill a polygon, calling `cb(x, y)` per pixel inside. */
function fillPoly(points, cb) {
  if (points.length < 3) return;
  const ys = points.map((p) => p[1]);
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    const xs = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > sy !== yj > sy) xs.push(xi + ((sy - yi) / (yj - yi)) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) cb(x, y);
    }
  }
}

/** Points along a polyline, about one per pixel, so a mapped shape bends smoothly. */
function subdivide(points, closed = true) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let k = 0; k < steps; k++) out.push([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]);
  }
  if (!closed) out.push(points[n - 1]);
  return out;
}

// ---------------------------------------------------------------------------------------------

/** One frame. Returns `{ img, origin }` on the scratch canvas. */
export function drawFish3(genome, pose, look) {
  const ph = phenotype(genome, pose.stage ?? -1);
  const set = ph.set;
  const sc = scratchOf(phenotype(genome, 3), ph);
  const g = new Grid(sc.w, sc.h);
  const K = columns(ph, pose, sc.origin, look ?? set.swim ?? 'raised');
  const ctx = makeCtx(g, ph, K, pose);

  relicBehind(ctx);
  pelvicFins(ctx, 'far');
  tailFin(ctx);
  dorsalFin(ctx);
  analFin(ctx);
  smallFins(ctx);
  body(ctx);
  scales(ctx);
  pattern(ctx);
  morphOverlay(ctx);
  markings(ctx);
  wear(ctx);
  ghostBones(ctx);
  revenant(ctx);
  forehead(ctx);
  gill(ctx);
  pectoralFin(ctx);
  pelvicFins(ctx, 'near');
  eye(ctx);
  mouth(ctx);
  extras(ctx);
  flourish(ctx);
  signature(ctx);
  orbit(ctx);

  let out = g;
  if (pose.turn) out = squash(g, pose.turn, sc.origin.x - ph.L / 2);
  if (set.glow === 'edge' || set.glow === 'full') {
    const pulse = 0.6 + (pose.glow - 0.5) * 0.8;
    out.outline(out.color(mix(ph.colors.mark, HIGHLIGHT, 0.45), Math.round(Math.max(120, Math.min(255, 160 + pulse * 95)))), { inward: true });
  }
  out.outline(out.color(INK));
  return { img: out.out(), origin: sc.origin };
}

/** Shared state for the parts: colours, the body mask, body-space lookups. */
function makeCtx(g, ph, K, pose) {
  const pal = ph.colors;
  const set = ph.set;
  const rampCache = new Map();
  const rampOf = (hex) => {
    let r = rampCache.get(hex);
    if (!r) {
      const raw = bodyRamp(hex, set.belly);
      const a = pal.alpha;
      r = { raw, dark: g.color(raw.dark, a), base: g.color(raw.base, a), light: g.color(raw.light, a), core: g.color(raw.core, a), rim: g.color(raw.rim, a), belly: g.color(raw.belly, a) };
      rampCache.set(hex, r);
    }
    return r;
  };
  const edges = (c) => ({ yb: Math.round(c.mid - c.back), yv: Math.round(c.mid + c.belly) });
  const bodyCols = K.cols.filter((c) => c.back + c.belly >= 1);
  const colAt = (x) => K.byX.get(x);
  /** The column where t is closest to `t`. */
  const colT = (t) => {
    let best = null;
    for (const c of bodyCols) if (!best || Math.abs(c.t - t) < Math.abs(best.t - t)) best = c;
    return best;
  };
  const tone = new Map();
  const onBody = (x, y) => {
    const c = colAt(x);
    if (!c || c.back + c.belly < 1) return false;
    const { yb, yv } = edges(c);
    return y >= yb && y <= yv;
  };
  /** Body space at a pixel: bx px from the tail joint, dy px from the centre line, v −1..1. */
  const bodyAt = (x, y) => {
    const c = colAt(x);
    if (!c) return null;
    const dy = y - c.mid;
    return { c, bx: c.t * ph.L, dy, v: dy < 0 ? dy / Math.max(0.5, c.back) : dy / Math.max(0.5, c.belly) };
  };
  const fin = {
    base: g.color(pal.fin.base, pal.fin.alpha),
    edge: g.color(pal.fin.edge, pal.fin.alpha),
    ray: g.color(pal.fin.ray, pal.fin.alpha),
    rim: g.color(pal.fin.rim, pal.fin.alpha),
    lit: g.color(pal.fin.lit, pal.fin.alpha),
    dim: g.color(pal.fin.dim, pal.fin.alpha),
    mark: g.color(set.finPattern === 'gilded' ? '#f2c53d' : pal.mark, pal.fin.alpha),
  };
  const gaitInfo = GAITS[ph.gait] ?? GAITS.subcarangiform;
  // Nose: the last column of the body proper (the beak, if any, runs past it).
  const nose = bodyCols.reduce((best, c) => (c.t <= 1.0001 && (!best || c.x > best.x) ? c : best), null) ?? bodyCols[bodyCols.length - 1];
  const tip = bodyCols[bodyCols.length - 1];
  return { g, ph, set, pal, K, pose, rampOf, edges, bodyCols, colAt, colT, onBody, bodyAt, fin, tone, gait: gaitInfo, nose, tip, s: ph.s, rng: roller(ph.seed, 7000) };
}

/** A fin pixel's colour: lit or shaded by which way the fin is turned, plus the fin pattern. */
function finColor(ctx, x, y, rFrac, facing = 0) {
  const { set, fin } = ctx;
  const pat = set.finPattern;
  if (pat === 'tipped' && rFrac > 0.74) return fin.mark;
  if (pat === 'banded' && Math.floor(rFrac * 5) % 2 === 1 && rFrac > 0.15) return fin.mark;
  if (pat === 'spotted' && rFrac > 0.2 && hash01(`${Math.floor(x / 2)},${Math.floor(y / 2)}`, 77) < 0.18 && (x + y) % 2 === 0) return fin.mark;
  if (facing > 0.18) return fin.lit;
  if (facing < -0.18) return fin.dim;
  return fin.base;
}

/** Ray lines from a fin's base to its edge, only over the fin's own pixels (v1's rays). */
function rays(ctx, pairs, every = 3) {
  const { g, fin } = ctx;
  const plain = new Set([fin.base, fin.lit, fin.dim]);
  for (let i = 1; i < pairs.length; i += every) {
    const [[bx, by], [tx, ty]] = pairs[i];
    const len = Math.hypot(tx - bx, ty - by);
    if (len < 3.5) continue;
    const steps = Math.round(len);
    for (let k = 1; k < steps; k++) {
      const x = Math.round(bx + ((tx - bx) * k) / steps);
      const y = Math.round(by + ((ty - by) * k) / steps);
      if (plain.has(g.get(x, y))) g.px(x, y, fin.ray);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Tail

/** Tail outlines in fin-local units: r along the fin (0 hinge .. 1 nominal tip), s across it
 * (−1 top .. 1 bottom of the nominal spread). `trail` marks which edges get the light rim. */
const TAILS = {
  fan: { len: 9, spread: 7, polys: [[[0, 'u'], [1, -1], [1, 1], [0, 'd']]], trail: [[1, -1, 1, 1]], rays: true },
  truncate: { len: 8, spread: 6, polys: [[[0, 'u'], [0.95, -1], [1, -0.2], [1, 0.2], [0.95, 1], [0, 'd']]], trail: [[0.95, -1, 1, -0.2], [1, 0.2, 0.95, 1]], rays: true },
  round: { len: 8, spread: 6, polys: [[[0, 'u'], [0.5, -0.95], [0.85, -0.78], [1, -0.32], [1, 0.32], [0.85, 0.78], [0.5, 0.95], [0, 'd']]], trail: [], rays: true },
  paddle: { len: 6, spread: 5, polys: [[[0, 'u'], [0.55, -1], [0.95, -0.6], [1.05, 0], [0.95, 0.6], [0.55, 1], [0, 'd']]], trail: [] },
  fork: { len: 10, spread: 8, polys: [[[0, 'u'], [1, -1], [0.45, 0]], [[0, 'd'], [1, 1], [0.45, 0]], [[0, 'u'], [0.45, 0], [0, 'd']]], trail: [[1, -1, 0.45, 0], [1, 1, 0.45, 0]] },
  lyre: { len: 11, spread: 9, polys: [[[0, 'u'], [0.6, -0.75], [1, -1.15], [0.62, 0]], [[0, 'd'], [0.6, 0.75], [1, 1.15], [0.62, 0]], [[0, 'u'], [0.62, 0], [0, 'd']]], trail: [[1, -1.15, 0.62, 0], [1, 1.15, 0.62, 0]] },
  veil: { len: 13, spread: 8, polys: [[[0, 'u'], [0.55, -0.9], [1, -0.65], [1.05, 0.35], [0.88, 1.12], [0.5, 1.05], [0, 'd']]], trail: [[1, -0.65, 1.05, 0.35], [1.05, 0.35, 0.88, 1.12]], rays: true },
  lunate: { len: 10, spread: 8, polys: [[[0, 'u'], [0.55, -0.62], [1, -1.15], [0.78, -0.5], [0.48, 0], [0.78, 0.5], [1, 1.15], [0.55, 0.62], [0, 'd']]], trail: [[1, -1.15, 0.78, -0.5], [1, 1.15, 0.78, 0.5]] },
  crescent: { len: 10, spread: 8, polys: [[[0, 'u'], [0.6, -0.7], [1.1, -1.2], [0.8, -0.5], [0.5, 0], [0.7, 0.4], [0.8, 0.85], [0.5, 0.55], [0, 'd']]], trail: [[1.1, -1.2, 0.8, -0.5]] },
  hetero: { len: 10, spread: 8, polys: [[[0, 'u'], [0.65, -0.62], [1.18, -0.95], [0.5, 0.05], [0, 'd']], [[0.1, 'd'], [0.5, 0.05], [0.55, 0.65], [0.3, 0.6]]], trail: [[1.18, -0.95, 0.5, 0.05]] },
  double: { len: 9, spread: 7, polys: [[[0, 'u'], [1, -1], [0.55, 0], [1, 1], [0, 'd']]], trail: [[1, -1, 0.55, 0], [0.55, 0, 1, 1]], twin: true },
  sword: { len: 9, spread: 6, polys: [[[0, 'u'], [0.85, -0.9], [0.9, 0.2], [1.6, 0.72], [1.55, 0.95], [0.8, 1], [0, 'd']]], trail: [[0.85, -0.9, 0.9, 0.2]], sword: true },
  streamer: { len: 10, spread: 8, polys: [[[0, 'u'], [1, -1], [0.45, 0]], [[0, 'd'], [1, 1], [0.45, 0]], [[0, 'u'], [0.45, 0], [0, 'd']]], trail: [], streamers: [[1, -1, 1.75, -1.25], [1, 1, 1.75, 1.25]] },
  lobed: { len: 9, spread: 6, polys: [[[0, 'u'], [0.72, -0.95], [0.86, -0.3], [1.28, -0.16], [1.28, 0.16], [0.86, 0.3], [0.72, 0.95], [0, 'd']]], trail: [] },
  pin: { len: 5, spread: 2, polys: [[[0, 'u'], [1, 0], [0, 'd']]], trail: [] },
  clavus: { len: 3.2, spread: 5, polys: [[[0, 'u'], [0.6, -0.95], [1, -0.55], [0.8, -0.15], [1, 0.25], [0.8, 0.6], [0.6, 0.95], [0, 'd']]], trail: [] },
};

function tailFin(ctx) {
  const { g, ph, K, pose, s, fin, set } = ctx;
  if (ph.tail === 'none') return;
  const spec = TAILS[ph.tail] ?? TAILS.fan;
  const joint = K.pointAt(1);
  const inset = Math.max(1, Math.round(2 * s));
  const hingeU = 1 - inset / ph.L;
  const hinge = K.pointAt(hingeU);
  const hingeT = 1 - hingeU;
  const up = Math.max(1.2, ph.back(hingeT));
  const down = Math.max(1.2, ph.belly(hingeT));
  const scaleK = s * 1.05 * ph.finMul * ph.tailStub;
  const len = Math.max(2.5, spec.len * scaleK) + inset;
  const spread = Math.max(1.6, spec.spread * scaleK);
  const yaw = tailYaw(ph.gait, pose);
  const facing = Math.sin((yaw.root + yaw.tip) / 2);
  const notched = set.damage === 'notched' || ph.stage === 'elder';

  const draw = (yawOff, colorShift) => {
    const y2 = { root: yaw.root + yawOff, tip: yaw.tip + yawOff };
    const map = finMapper(hinge, y2, len, K.cam);
    const toLocal = ([r, sv]) => [r * len, sv === 'u' ? -up : sv === 'd' ? down : sv * spread];
    for (const poly of spec.polys) {
      const pts = subdivide(poly.map(toLocal)).map(([r, sv]) => map(r, sv));
      fillPoly(pts, (x, y) => {
        const rFrac = Math.min(1, Math.max(0, (hinge.x - x) / len));
        if (notched && rFrac > 0.8 && Math.abs((y - hinge.y) / spread + 0.45) < 0.14) return;
        let c = finColor(ctx, x, y, rFrac, facing);
        if (colorShift) c = c === fin.mark ? c : fin.dim;
        g.px(x, y, c);
      });
    }
    return map;
  };

  if (spec.twin) draw(0.45, true);
  const map = draw(0, false);
  // Rays from the hinge, and a lighter trailing edge.
  if (spec.rays && s >= 0.7) {
    const pairs = [];
    const n = Math.max(3, Math.round((spread * 2) / 3));
    for (let i = 0; i <= n; i++) {
      const sv = -0.7 + (1.4 * i) / n;
      pairs.push([map(inset, sv * up * 0.5), map(len * 0.95, sv * spread)]);
    }
    rays(ctx, pairs, 1);
  }
  const rim = set.finPattern === 'gilded' ? fin.mark : fin.rim;
  for (const [r0, s0, r1, s1] of spec.trail) {
    const a = map(r0 * len, s0 * spread);
    const b = map(r1 * len, s1 * spread);
    const steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * k) / steps);
      const y = Math.round(a[1] + ((b[1] - a[1]) * k) / steps);
      if (g.get(x, y)) g.px(x, y, rim);
    }
  }
  if (spec.sword) {
    const swordC = g.color(lum(ctx.pal.mark) > 0.6 ? '#2b2f38' : ctx.pal.mark);
    const a = map(0.85 * len, 0.85 * spread);
    const b = map(1.58 * len, 0.84 * spread);
    g.line(a[0], a[1], b[0], b[1], swordC);
  }
  for (const [r0, s0, r1, s1] of spec.streamers ?? []) {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const r = (r0 + ((r1 - r0) * k) / 6) * len;
      const sv = (s0 + ((s1 - s0) * k) / 6) * spread + Math.sin(TAU * ((pose.wave ?? 0) - k / 8)) * 0.6 * s * (k / 6);
      pts.push(map(r, sv));
    }
    for (let k = 0; k < pts.length - 1; k++) g.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], fin.edge);
  }
  ctx.tailHinge = { joint, hinge, len, spread, map };
}

// ---------------------------------------------------------------------------------------------
// Dorsal, anal, finlets

/** A fin along the back (dir −1) or belly (dir 1), from t0 to t1, `height(u)` px at u 0..1. */
function edgeFin(ctx, dir, t0, t1, height, opts = {}) {
  const { g, K, edges, bodyCols, pose, gait, fin } = ctx;
  const cols = bodyCols.filter((c) => c.t >= Math.min(t0, t1) && c.t <= Math.max(t0, t1));
  if (cols.length < 2) return [];
  const ripple = pose.ripple ?? 0;
  const rAmp = opts.ribbon ? 0.35 : gait.ripple ? 0.3 : gait.ribbon && dir > 0 ? 0.35 : 0.1;
  const outer = [];
  const inner = [];
  const facingAt = [];
  cols.forEach((c, i) => {
    const u = cols.length === 1 ? 0 : i / (cols.length - 1);
    const wave = Math.sin(TAU * (ripple - (1 - c.t) * 2.4));
    const h = Math.max(0, height(u) * (1 + rAmp * wave));
    const { yb, yv } = edges(c);
    const base = dir < 0 ? yb + 1 : yv - 1;
    const tipY = base + dir * (h + 1);
    // The fin's free edge trails the body a little, like a flag.
    const lagX = opts.lag ? -opts.lag * u : 0;
    outer.push([c.x + lagX, tipY]);
    inner.push([c.x, base]);
    facingAt.push(Math.cos(TAU * (ripple - (1 - c.t) * 2.4)) * (gait.ripple || gait.ribbon || opts.ribbon ? 1 : 0.3));
  });
  const xs = cols.map((c) => c.x);
  const pts = [...outer, ...[...inner].reverse()];
  fillPoly(pts, (x, y) => {
    const i = Math.max(0, Math.min(cols.length - 1, xs.indexOf(Math.min(Math.max(x, xs[0]), xs[xs.length - 1]))));
    const span = Math.abs(outer[i][1] - inner[i][1]) || 1;
    const rFrac = Math.min(1, Math.abs(y - inner[i][1]) / span);
    g.px(x, y, finColor(ctx, x, y, rFrac, facingAt[i]));
  });
  if (opts.rays !== false && ctx.s >= 0.6) rays(ctx, inner.map((p, i) => [p, outer[i]]), Math.max(2, Math.round(3 * Math.min(1.5, ctx.s))));
  if (opts.rim !== false) {
    const rim = ctx.set.finPattern === 'gilded' ? fin.mark : fin.rim;
    outer.forEach(([x, y], i) => {
      const ry = Math.round(y) - dir;
      if (Math.abs(ry - inner[i][1]) > 1 && g.get(Math.round(x), ry)) g.px(Math.round(x), ry, rim);
    });
  }
  return outer.map((p, i) => ({ outer: p, inner: inner[i] }));
}

function dorsalFin(ctx) {
  const { g, ph, s, fin, pose } = ctx;
  const arch = ph.arch;
  const style = ph.dorsal;
  if (style === 'none') return;
  const d = arch.dorsal ?? { from: 0.4, to: 0.7, peak: 0.4, boost: 1 };
  const k = s * ph.finMul;
  const pointy = arch.triangle;
  const lift = (u, peak = d.peak) => {
    if (pointy) return u < peak ? u / peak : 1 - (u - peak) / (1 - peak);
    if (style === 'spiny' || style === 'venom') return Math.sin(Math.PI * u) ** 0.5;
    if (style === 'tall') return u < peak ? Math.sin((Math.PI / 2) * (u / peak)) : Math.cos((Math.PI / 2) * ((u - peak) / (1 - peak))) ** 1.4;
    return Math.sin(Math.PI * u) ** 0.8;
  };
  const base = { low: 2.5, tall: 5, spiny: 4.5, sail: 6.5, double: 3.6, streamer: 3.2, crest: 5.5, venom: 6.5, finlets: 2.5, adipose: 2.5 }[style] ?? 2.5;
  const H = base * d.boost * k;
  // Edge fins run tail (t small) → head (t large); u in edgeFin is 0 at the tail end.
  if (style === 'double') {
    const mid = (d.from + d.to) / 2;
    edgeFin(ctx, -1, d.from, mid - 0.03, (u) => H * 0.75 * Math.sin(Math.PI * u) ** 0.8);
    edgeFin(ctx, -1, mid + 0.03, Math.min(0.85, d.to + 0.08), (u) => H * Math.sin(Math.PI * u) ** 0.5);
    return;
  }
  if (style === 'crest') {
    // Betta: a long flowing fin that grows toward the tail and spills past it.
    edgeFin(ctx, -1, 0.04, Math.max(d.to, 0.62), (u) => H * (0.25 + 0.75 * (1 - u) ** 0.7) * Math.min(1, u * 6 + 0.3), { lag: 2 * k });
    return;
  }
  if (style === 'venom') {
    // Lionfish: separate spines with a little membrane at the foot, banded.
    const from = Math.min(d.from, 0.2);
    const to = Math.max(d.to, 0.82);
    const tops = edgeFin(ctx, -1, from, to, (u) => H * 0.35 * lift(u), { rays: false, rim: false });
    const spine = g.color(ctx.pal.fin.edge);
    const band = g.color(ctx.pal.mark);
    const every = Math.max(2, Math.round(2 * Math.min(2, s)));
    tops.forEach(({ inner }, i) => {
      if (i % every) return;
      const u = i / Math.max(1, tops.length - 1);
      const h = H * lift(u) + Math.sin(TAU * ((pose.ripple ?? 0) - u)) * 0.6 * s;
      const x = inner[0];
      const y0 = inner[1];
      for (let y = 0; y <= h; y++) g.px(Math.round(x - (y / Math.max(1, h)) * 1.2 * s), Math.round(y0 - y), Math.floor(y / Math.max(1.5, 1.6 * s)) % 2 ? band : spine);
    });
    return;
  }
  const sail = style === 'sail';
  const from = sail ? Math.min(d.from, 0.2) : d.from;
  const to = sail ? Math.max(d.to, 0.85) : d.to;
  // Lift peaks toward the head end for most fins: edgeFin's u runs tail → head, v1's ran head-ward too.
  const tops = edgeFin(ctx, -1, from, to, (u) => H * lift(u));
  if (style === 'spiny') {
    tops.forEach(({ outer, inner }, i) => {
      if (i % 2 === 0) g.line(outer[0], outer[1], inner[0], inner[1], fin.edge);
    });
  }
  if (style === 'streamer' && tops.length > 2) {
    // A long filament off the leading ray, trailing back over the body.
    const lead = tops[tops.length - 1].outer;
    const n = Math.round(ph.L * 0.45);
    let [px, py] = lead;
    for (let i = 1; i <= n; i++) {
      const x = lead[0] - i;
      const y = lead[1] - Math.sin((Math.PI * i) / (n * 1.4)) * 3 * s + Math.sin(TAU * ((pose.wave ?? 0) - i / n)) * 0.8 * s;
      g.line(px, py, x, y, fin.edge);
      px = x;
      py = y;
    }
  }
  if (style === 'adipose' || style === 'finlets') {
    // Tuna finlets or a little fleshy adipose nub, near the tail.
    if (style === 'adipose') edgeFin(ctx, -1, 0.1, 0.18, (u) => 1.3 * s * Math.sin(Math.PI * u) ** 0.6, { rays: false });
  }
}

function analFin(ctx) {
  const { ph, s } = ctx;
  const arch = ph.arch;
  const a = arch.anal ?? { from: 0.2, to: 0.4, boost: 0.6 };
  const d = arch.dorsal ?? { from: 0.4, to: 0.7, peak: 0.4, boost: 1 };
  const k = s * ph.finMul;
  const dorsalH = ({ low: 2.5, tall: 5, spiny: 4.5, sail: 6.5, double: 3.6, streamer: 3.2, crest: 5.5, venom: 4, finlets: 2.5, adipose: 2.5, none: 2.5 }[ph.dorsal] ?? 2.5) * k;
  switch (ph.anal) {
    case 'none':
      return;
    case 'small':
      edgeFin(ctx, 1, a.from, Math.min(a.to, a.from + 0.14), (u) => 1.6 * k * Math.sin(Math.PI * u) ** 0.9);
      return;
    case 'ribbon':
      // Knifefish: one long undulating ribbon along the whole belly.
      edgeFin(ctx, 1, 0.04, 0.86, (u) => 2.4 * k * Math.min(1, u * 5) * Math.min(1, (1 - u) * 6 + 0.25), { ribbon: true });
      return;
    case 'mirror': {
      // Trigger / angel: the anal fin matches the dorsal, top and bottom of a kite.
      const pk = d.peak;
      const lift = arch.triangle ? (u) => (u < pk ? u / pk : 1 - (u - pk) / (1 - pk)) : (u) => Math.sin(Math.PI * u) ** 0.8;
      edgeFin(ctx, 1, Math.max(0.04, d.from - 0.04), d.to - 0.06, (u) => dorsalH * d.boost * 0.85 * lift(u));
      return;
    }
    case 'spike':
      edgeFin(ctx, 1, a.from, a.from + 0.08, (u) => 3 * k * u, { rays: false });
      return;
    case 'sail':
      // Betta: a deep anal fin that sweeps back toward the tail.
      edgeFin(ctx, 1, 0.04, Math.max(a.to, 0.6), (u) => 5 * k * (0.35 + 0.65 * (1 - u) ** 0.6) * Math.min(1, u * 8), { lag: 2 * k });
      return;
    default: {
      const disc = arch.triangle && ph.body !== 'shark' && ph.body !== 'swordfish';
      edgeFin(ctx, 1, a.from, a.to, (u) => dorsalH * 0.0 + 2.5 * k * a.boost * (disc ? 1 : 0.8) * (disc ? (u < 0.6 ? u / 0.6 : 1 - (u - 0.6) / 0.4) : Math.sin(Math.PI * u) ** 0.9));
    }
  }
}

/** Tuna finlets: a row of little flags top and bottom, between the fins and the tail. */
function smallFins(ctx) {
  const { g, ph, s, bodyCols, edges, fin } = ctx;
  if (ph.dorsal !== 'finlets') return;
  const every = Math.max(2, Math.round(2.5 * s));
  bodyCols.filter((c) => c.t > 0.06 && c.t < 0.3).forEach((c, i) => {
    if (i % every) return;
    const { yb, yv } = edges(c);
    const h = Math.max(1, Math.round(1.4 * s));
    g.polygon([[c.x, yb], [c.x - h, yb - h], [c.x + 1, yb]], fin.lit);
    g.px(c.x, yb - 1, fin.base);
    g.polygon([[c.x, yv], [c.x - h, yv + h], [c.x + 1, yv]], fin.dim);
    g.px(c.x, yv + 1, fin.base);
  });
}

// ---------------------------------------------------------------------------------------------
// Body

/** The skin colour at a slice of the body: split, ombré and iridescence live here. */
function skinAt(ctx, c) {
  const { pal, ph, pose } = ctx;
  let hex = pal.skin;
  if (pal.split && c.t < 0.5) hex = pal.split;
  if (pal.ombre) hex = rotateHue(hex, Math.round(((1 - c.t) * pal.ombre) / 12) * 12);
  const iri = ph.set.iridescence;
  if (iri && iri !== 'none') {
    const amp = iri === 'rainbow' ? 70 : 22;
    hex = rotateHue(hex, Math.round((amp * Math.sin(TAU * (c.t * (iri === 'rainbow' ? 1.6 : 1) - (pose.sheen ?? 0)))) / 10) * 10);
  }
  return hex;
}

function body(ctx) {
  const { g, bodyCols, edges, rampOf, tone, ph, s } = ctx;
  for (const c of bodyCols) {
    const R = rampOf(skinAt(ctx, c));
    const { yb, yv } = edges(c);
    const rows = yv - yb + 1;
    const bellyRows = rows >= 4 ? Math.round(rows * R.raw.bellyAmount) : 0;
    const darkRows = rows >= 6 ? Math.max(2, Math.round(rows * 0.12)) : 1;
    const lightRows = rows >= 7 ? Math.max(1, Math.round(rows * 0.07)) : 0;
    const coreRows = rows >= 6 ? Math.max(1, Math.round(rows * 0.05)) : 0;
    const lit = c.t > 0.25 && c.t < 0.92;
    for (let y = yb; y <= yv; y++) {
      const top = y - yb;
      const bot = yv - y;
      let k = 'base';
      if (top < darkRows) k = top === darkRows - 1 && darkRows >= 3 && s >= 1.3 && lit ? 'rim' : 'dark';
      else if (top < darkRows + lightRows && lit) k = 'light';
      else if (bot < bellyRows) k = 'belly';
      else if (bot < bellyRows + coreRows) k = 'core';
      // At big sizes the very top row is a rim light catching the surface.
      g.px(c.x, y, R[k]);
      tone.set(c.x * 4096 + y, k);
    }
  }
  ctx.toneAt = (x, y) => tone.get(x * 4096 + y);
  // Recolour a body pixel with another colour's ramp, keeping its shading.
  ctx.repaint = (x, y, hex) => {
    const k = ctx.toneAt(x, y);
    if (k) g.px(x, y, rampOf(hex)[k]);
  };
  void ph;
}

/** Scale texture, in body space so it travels with the bend. Gated by size. */
function scales(ctx) {
  const { g, set, bodyCols, edges, rampOf, s, ph, toneAt } = ctx;
  const kind = set.scales;
  if (kind === 'smooth' || s < 0.7) return;
  const w = s >= 1.9 ? 4 : 3;
  for (const c of bodyCols) {
    const { yb, yv } = edges(c);
    const R = rampOf(skinAt(ctx, c));
    const bx = Math.round(c.t * ph.L);
    for (let y = yb + 1; y < yv; y++) {
      const k = toneAt(c.x, y);
      if (k === 'dark') continue;
      const dy = Math.round(y - c.mid);
      let hit = false;
      if (kind === 'fine') hit = (((bx + 2 * dy) % 4) + 4) % 4 === 0 && (((dy % 2) + 2) % 2 === 0);
      else if (kind === 'scallops') {
        const row = Math.floor(dy / (w - 1));
        const lx = (((bx + (row % 2 ? Math.floor(w / 2) : 0)) % w) + w) % w;
        const ly = ((dy % (w - 1)) + (w - 1)) % (w - 1);
        const arc = Math.round((1 - ((lx + 0.5) / w * 2 - 1) ** 2) * (w - 2));
        hit = ly === w - 2 - arc;
      } else if (kind === 'plates') hit = (((bx + dy) % 5) + 5) % 5 === 0 || (((bx - dy) % 5) + 5) % 5 === 0;
      else if (kind === 'sandpaper') hit = hash01(`${bx},${dy}`, 31) < 0.1;
      if (!hit) continue;
      g.px(c.x, y, kind === 'sandpaper' ? R.light : k === 'belly' ? R.base : R.core);
    }
  }
  // A lateral line on big fish.
  if (s >= 1.9) {
    for (const c of bodyCols) {
      if (c.t < 0.08 || c.t > ph.eyeT - 0.1 || c.x % 3 === 0) continue;
      const y = Math.round(c.mid - c.back * 0.28);
      if (toneAt(c.x, y)) g.px(c.x, y, rampOf(skinAt(ctx, c)).core);
    }
  }
}

/** v1's patterns and the new ones, clipped to the body, in body space. */
function pattern(ctx) {
  const { g, set, pal, ph, bodyCols, edges, s } = ctx;
  if (set.pattern === 'plain') return;
  const markHex = pal.patternFade ? mix(pal.mark, pal.skin, pal.patternFade) : pal.mark;
  const mark = g.color(markHex, pal.alpha);
  const density = DENSITY[set.density ?? 'even'] ?? 1;
  const bellyAmount = { none: 0, soft: 0.26, pale: 0.4, white: 0.52 }[set.belly] ?? 0.26;
  const { r, range } = roller(ph.seed, 600);
  const L = ph.L;
  const aboveBelly = (v) => v <= 1 - 2 * Math.max(0.18, bellyAmount);

  // Seeded spots in body space: [bx, v, radius].
  const spots = [];
  if (['spots', 'leopard', 'dashdot'].includes(set.pattern)) {
    const n = Math.round(8 * density * Math.max(1, (L / 27) ** 0.8)) * (set.pattern === 'dashdot' ? 0.6 : 1);
    for (let i = 0; i < n; i++) spots.push([range(2, L - 3, 10 + i), range(-0.75, 0.6, 60 + i), (set.pattern === 'leopard' ? 1.4 : 1) * (1 + r(110 + i) * 1.2) * Math.max(0.7, s ** 0.7)]);
  }
  const blobs = [];
  if (set.pattern === 'patches') {
    const n = 2 + Math.round(r(5) * 2 * density);
    for (let i = 0; i < n; i++) blobs.push([range(L * 0.12, L * 0.9, 20 + i), range(-0.9, 0.3, 40 + i), L * range(0.1, 0.2, 80 + i)]);
  }
  const barN = Math.max(2, Math.round(4 * density));
  const barW = Math.max(1, Math.round(1.6 * density * Math.max(0.7, s)));
  const period = Math.max(3, Math.round(3 * Math.max(1, s)));

  for (const c of bodyCols) {
    const { yb, yv } = edges(c);
    const bx = c.t * L;
    for (let y = yb; y <= yv; y++) {
      const dy = y - c.mid;
      const v = dy < 0 ? dy / Math.max(0.5, c.back) : dy / Math.max(0.5, c.belly);
      let hit = false;
      switch (set.pattern) {
        case 'bars':
        case 'leopard': {
          for (let i = 0; i < barN && !hit; i++) {
            const at = (L * (i + 0.7)) / (barN + 0.4);
            if (Math.abs(bx - at) < barW / 2 + 0.01 && aboveBelly(v)) hit = set.pattern === 'bars' || (Math.round(dy) + Math.round(bx)) % 3 !== 0;
          }
          if (set.pattern === 'leopard' && !hit) {
            for (const [sx, sv, rr] of spots) {
              const d = Math.hypot(bx - sx, dy - sv * (sv < 0 ? c.back : c.belly));
              if (d <= rr && d >= rr * 0.45) hit = true;
            }
          }
          break;
        }
        case 'stripe': {
          const half = (c.back + c.belly) / 2;
          const th = Math.min(3 * Math.max(1, s), Math.max(1, Math.round(half * 0.26 * density)));
          hit = half >= 1 && Math.abs(dy + 0.25) < th / 2;
          break;
        }
        case 'dashdot': {
          const half = (c.back + c.belly) / 2;
          const th = Math.max(1, Math.round(half * 0.2 * density));
          const dash = Math.floor(bx / period) % 2 === 0;
          hit = (dash && Math.abs(dy + 0.25) < th / 2) || (!dash && Math.abs(dy + c.back * 0.45) < 0.6 && Math.floor(bx) % period === 1);
          break;
        }
        case 'spots':
          for (const [sx, sv, rr] of spots) if (Math.hypot(bx - sx, dy - sv * (sv < 0 ? c.back : c.belly)) <= rr) hit = true;
          break;
        case 'saddle': {
          const n = Math.max(2, Math.round(3 * density));
          const w = Math.max(2, Math.round(3 * density * Math.max(0.7, s)));
          for (let i = 0; i < n; i++) {
            const at = (L * (i + 0.8)) / (n + 0.6);
            if (bx >= at && bx < at + w && v < -0.1) hit = true;
          }
          break;
        }
        case 'tiger': {
          const per = Math.max(3, Math.round(3 * Math.max(1, s)));
          hit = v < 0.5 && (((Math.round(bx + dy * 0.5) % per) + per) % per) === 0;
          break;
        }
        case 'patches':
          for (const [px0, pv, pr] of blobs) {
            const py = pv * (pv < 0 ? c.back : c.belly);
            const n = hash01(`${Math.floor(bx / 2)},${Math.floor(dy / 2)}`, 5) * 0.25;
            if (Math.hypot((bx - px0) / pr, (dy - py) / (pr * 0.7)) < 1 - n) hit = true;
          }
          break;
        case 'reticulate': {
          const cell = Math.max(3, Math.round(3 * s + 1));
          const a = (((Math.round(bx + dy) % cell) + cell) % cell) === 0;
          const b = (((Math.round(bx - dy) % cell) + cell) % cell) === 0;
          hit = (a || b) && v < 0.75;
          break;
        }
        case 'chevron': {
          const per = Math.max(4, Math.round(5 * Math.max(1, s) / density));
          hit = (((Math.round(bx - Math.abs(dy) * 0.9) % per) + per) % per) < Math.max(1, Math.round(s)) && bx > L * 0.12 && bx < L * (ph.eyeT - 0.05);
          break;
        }
        case 'mottle':
        default: {
          const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
          const ix = Math.round(bx);
          const iy = Math.round(dy);
          hit = (BAYER[(((iy % 4) + 4) % 4) * 4 + (((ix % 4) + 4) % 4)] + 0.5) / 16 < 0.22 * density;
        }
      }
      if (hit) g.px(c.x, y, mark);
    }
  }
}

/** Colour morphs that paint over the body: koi patches, galaxy speckle, the neon stripe. */
function morphOverlay(ctx) {
  const { g, pal, ph, bodyCols, edges, s, pose } = ctx;
  const L = ph.L;
  if (pal.patches) {
    const { range } = roller(ph.seed, 650);
    const blobs = [];
    for (let i = 0; i < 4; i++) blobs.push([range(L * 0.05, L * 0.95, i), range(-0.9, 0.5, 10 + i), L * range(0.12, 0.22, 20 + i), 0]);
    if (pal.patches[1]) for (let i = 0; i < 3; i++) blobs.push([range(L * 0.1, L * 0.85, 30 + i), range(-0.8, 0.2, 40 + i), L * range(0.05, 0.1, 50 + i), 1]);
    for (const c of bodyCols) {
      const { yb, yv } = edges(c);
      const bx = c.t * L;
      for (let y = yb; y <= yv; y++) {
        const dy = y - c.mid;
        for (const [px0, pv, pr, which] of blobs) {
          const py = pv * (pv < 0 ? c.back : c.belly);
          const n = hash01(`${Math.floor(bx / 2)},${Math.floor(dy / 2)}`, 9 + which) * 0.3;
          if (Math.hypot((bx - px0) / pr, (dy - py) / (pr * 0.75)) < 1 - n) ctx.repaint(c.x, y, pal.patches[which]);
        }
      }
    }
  }
  if (pal.speckle) {
    const big = g.color(pal.speckle);
    const dim = g.color(mix(pal.speckle, pal.skin, 0.5));
    for (const c of bodyCols) {
      const { yb, yv } = edges(c);
      for (let y = yb + 1; y < yv; y++) {
        const key = `${Math.round(c.t * L)},${Math.round(y - c.mid)}`;
        const h = hash01(key, 3);
        if (h < 0.035) g.px(c.x, y, big);
        else if (h < 0.08) g.px(c.x, y, dim);
      }
    }
  }
  if (pal.neon) {
    const glow = 0.5 + 0.5 * (pose.glow ?? 0.5);
    const neon = g.color(pal.neon);
    const halo = g.color(mix(pal.neon, HIGHLIGHT, 0.5), Math.round(140 + glow * 100));
    for (const c of bodyCols) {
      if (c.t < 0.1 || c.t > ph.eyeT) continue;
      const y = Math.round(c.mid - c.back * 0.25);
      const th = Math.max(1, Math.round(0.8 * s));
      for (let k = 0; k < th; k++) g.px(c.x, y + k, neon);
      if (s >= 1) g.px(c.x, y - 1, halo);
    }
  }
}

/** Single markings: masks, false eyes, cleaner stripes, lantern lights. */
function markings(ctx) {
  const { g, set, pal, ph, colT, edges, bodyCols, s, onBody, pose } = ctx;
  const L = ph.L;
  const darkHex = lum(pal.mark) > 0.6 ? '#2b2f38' : pal.mark;
  const dark = g.color(darkHex, pal.alpha);
  const R = Math.max(1, 1.3 * s);
  const spot = (t, v, rad, c) => {
    const col = colT(t);
    if (!col) return;
    const y = col.mid + v * (v < 0 ? col.back : col.belly);
    g.ellipse(col.x + 0.5, y + 0.5, rad, rad, c, onBody);
  };
  switch (set.markings) {
    case 'mask':
      for (const c of bodyCols) {
        if (Math.abs(c.t - ph.eyeT) * L > Math.max(1, s * 1.2)) continue;
        const { yb, yv } = edges(c);
        for (let y = yb; y <= Math.round(c.mid + c.belly * 0.7) && y <= yv; y++) g.px(c.x, y, dark);
      }
      break;
    case 'ocellus':
      spot(0.2, -0.35, R + 1, dark);
      spot(0.2, -0.35, R, g.color(mix(pal.skin, HIGHLIGHT, 0.7)));
      spot(0.2, -0.35, Math.max(0.6, R - 1), dark);
      break;
    case 'tailspot':
      spot(0.07, 0, Math.max(1, R), dark);
      break;
    case 'cheek':
      spot(ph.eyeT - 0.06, 0.35, R * 1.1, g.color(pal.mark, pal.alpha));
      break;
    case 'lipstick': {
      const n = ctx.nose;
      if (!n) break;
      const lip = g.color('#e0405a');
      for (let dx = 0; dx < Math.max(1, Math.round(1.5 * s)); dx++) {
        const c = ctx.colAt(n.x - dx);
        if (!c) continue;
        const { yb, yv } = edges(c);
        for (let y = yb; y <= yv; y++) if (Math.abs(y - c.mid) < Math.max(1.5, c.belly * 0.6)) g.px(c.x, y, lip);
      }
      break;
    }
    case 'cleaner':
      for (const c of bodyCols) {
        if (c.t < 0.02) continue;
        const y = Math.round(c.mid);
        const th = Math.max(1, Math.round(0.9 * s));
        for (let k = 0; k < th; k++) if (onBody(c.x, y + k)) g.px(c.x, y + k, dark);
        const py = Math.round(c.mid - c.back * 0.4);
        if (onBody(c.x, py) && s >= 0.9) ctx.repaint(c.x, py, mix(pal.skin, HIGHLIGHT, 0.55));
      }
      break;
    case 'photophores': {
      const on = 0.5 + 0.5 * (pose.glow ?? 0.5);
      const light = g.color(mix('#7ee8ff', HIGHLIGHT, 0.3), Math.round(150 + on * 105));
      const per = Math.max(2, Math.round(3 * Math.max(1, s * 0.8)));
      for (const c of bodyCols) {
        if (c.t < 0.08 || c.t > ph.eyeT - 0.05 || Math.round(c.t * L) % per) continue;
        g.px(c.x, Math.round(c.mid + c.belly * 0.65), light);
        if (s >= 1.4) g.px(c.x, Math.round(c.mid + c.belly * 0.35), light);
      }
      break;
    }
    default:
  }
}

/** Warts, scars. (Notches are cut where the fins are drawn.) */
function wear(ctx) {
  const { g, set, ph, colT, s, rng, onBody, rampOf, pal } = ctx;
  if (set.damage === 'warts') {
    const n = 4 + Math.round(4 * Math.min(2, s));
    for (let i = 0; i < n; i++) {
      const col = colT(rng.range(0.15, 0.9, i));
      if (!col) continue;
      const v = rng.range(-1, 0.7, 20 + i);
      const y = Math.round(col.mid + v * (v < 0 ? col.back : col.belly));
      const c = g.color(shade(pal.skin, 0.78));
      if (onBody(col.x, y)) g.px(col.x, y, c);
      if (v < -0.85) g.px(col.x, y - 1, rampOf(pal.skin).base);
    }
  } else if (set.damage === 'scar') {
    const col = colT(0.48);
    if (!col) return;
    const pale = g.color('#efd3c8');
    const n = Math.max(3, Math.round(4 * s));
    for (let k = 0; k < n; k++) {
      const x = col.x - Math.round(n / 2) + k;
      const y = Math.round(col.mid - col.back * 0.5 + k * 0.8);
      if (onBody(x, y)) g.px(x, y, pale);
    }
  }
  void ph;
}

/** Glass morph: a see-through body shows its spine, ribs and a dark gut. */
function ghostBones(ctx) {
  const { g, ph, bodyCols, s } = ctx;
  if (ph.morph !== 'ghost') return;
  const bone = g.color('#f4f1e6', 220);
  const rib = g.color('#f4f1e6', 150);
  const gut = g.color('#8c3a2a', 230);
  const per = Math.max(2, Math.round(2 * s));
  for (const c of bodyCols) {
    if (c.t < 0.03 || c.t > ph.eyeT - 0.08) continue;
    const y = Math.round(c.mid - c.back * 0.15);
    g.px(c.x, y, bone);
    if (Math.round(c.t * ph.L) % per === 0 && c.t > 0.3) {
      for (let k = 1; k <= Math.round(c.back * 0.6); k++) g.px(c.x - Math.round(k * 0.3), y - k, rib);
      for (let k = 1; k <= Math.round(c.belly * 0.5); k++) g.px(c.x - Math.round(k * 0.3), y + k, rib);
    }
  }
  const gc = ctx.colT(0.58);
  if (gc) g.ellipse(gc.x + 0.5, gc.mid + gc.belly * 0.35, Math.max(1, 1.4 * s), Math.max(0.8, 1 * s), gut);
}

/** Domed, wen-capped or crested heads, and sturgeon scutes along the back. */
function forehead(ctx) {
  const { g, set, ph, bodyCols, edges, s, pal, fin } = ctx;
  if (set.forehead === 'wen') {
    const cap = mix(pal.skin, '#f08a24', 0.55);
    const capC = g.color(cap);
    const capD = g.color(shade(cap, 0.8));
    for (const c of bodyCols) {
      if (c.t < ph.eyeT - 0.06 || c.t > 0.98) continue;
      const { yb } = edges(c);
      const depth = Math.max(1, Math.round(c.back * 0.4));
      const bump = (c.x % 2 === 0 ? 1 : 0) * (s >= 0.8 ? 1 : 0);
      for (let y = yb - bump; y < yb + depth; y++) g.px(c.x, y, (c.x + y) % 3 === 0 ? capD : capC);
    }
  } else if (set.forehead === 'crested') {
    edgeFin(ctx, -1, ph.eyeT - 0.08, Math.min(0.97, ph.eyeT + 0.08), (u) => 2 * s * Math.sin(Math.PI * u), { rays: false });
  }
  if (ph.extras === 'scutes') {
    const pale = g.color(mix(pal.skin, HIGHLIGHT, 0.6));
    const per = Math.max(2, Math.round(3 * s));
    for (const c of bodyCols) {
      if (c.t < 0.1 || c.t > 0.85 || Math.round(c.t * ph.L) % per) continue;
      const { yb, yv } = edges(c);
      g.px(c.x, yb - 1, pale);
      g.px(c.x, yb, pale);
      if (s >= 1.3) g.px(c.x, Math.round(c.mid), pale);
      if (s >= 1.3) g.px(c.x, yv - 1, pale);
    }
  }
  void fin;
}

/** The gill cover, which flaps as the fish breathes, or a shark's slits. */
function gill(ctx) {
  const { g, ph, colT, pal, s, pose } = ctx;
  const gc = colT(Math.max(0.5, ph.eyeT - 0.08));
  if (!gc || gc.back < 1.5) return;
  const ink = g.color(shade(pal.skin, 0.72), pal.alpha);
  if (ph.arch.gillSlits) {
    for (let i = 0; i < 3; i++) {
      const c = ctx.colAt(gc.x - 1 - i * Math.max(2, Math.round(2 * s)));
      if (c && c.back > 1.5) g.line(c.x, c.mid - Math.max(1, c.back * 0.25), c.x, c.mid + Math.max(1, c.belly * 0.25), ink);
    }
    return;
  }
  const flap = Math.round((pose.gill ?? 0) * Math.max(1, 0.8 * s));
  const x = gc.x - flap;
  const top = gc.mid - gc.back * 0.55;
  const bot = gc.mid + gc.belly * 0.55;
  g.line(x + 1, top, x, gc.mid, ink);
  g.line(x, gc.mid, x + 1, bot, ink);
  if (s >= 1.3) {
    const lightC = g.color(shade(pal.skin, 1.15), pal.alpha);
    g.line(x + 2, top + 1, x + 1, gc.mid, lightC);
  }
}

// ---------------------------------------------------------------------------------------------
// Pectoral and pelvic

function pectoralFin(ctx) {
  const { g, ph, colT, s, pose, gait, fin } = ctx;
  const pc = colT(Math.max(0.45, ph.eyeT - 0.12));
  if (!pc || pc.belly < 1.5) return;
  const style = ph.pectoral;
  const k = s * Math.min(1.5, ph.finMul) * (ph.tailStub < 1 ? 0.8 : 1);
  const beat = pose.fin ?? 0;
  const amp = 0.3 * Math.max(0.5, gait.fins);
  const tucked = beat < -0.5 && style !== 'glider';
  const sweep = tucked ? 0.45 : Math.max(0.2, 0.75 + beat * amp + (pose.coast ?? 0) * 0.3);
  const px = pc.x;
  const py = pc.mid + pc.belly * 0.15;
  const facing = beat * 0.5;
  const paint = (pts, rOrigin) =>
    fillPoly(pts, (x, y) => g.px(x, y, finColor(ctx, x, y, Math.min(1, Math.hypot(x - rOrigin[0], y - rOrigin[1]) / Math.max(1, size)), facing)));
  let size = ({ small: 2.6, round: 3.6, long: 4.8, wing: 5.6, fan: 6.5, glider: 9, lobed: 3.6, frilly: 4.2 }[style] ?? 2.6) * k;
  if (style === 'glider') size = ph.L * (0.45 + 0.25 * (pose.coast ?? 0)) * Math.min(1.2, ph.finMul);
  if (style === 'fan') {
    // Lionfish: separate long rays fanned out, a little membrane between.
    const n = Math.max(4, Math.round(5 * Math.min(1.6, s)));
    const band = g.color(ctx.pal.mark, ctx.pal.fin.alpha);
    for (let i = 0; i < n; i++) {
      const a = -0.2 + (i / (n - 1)) * 1.3 * sweep + beat * 0.15;
      const len = size * (0.75 + 0.25 * Math.sin((Math.PI * i) / (n - 1)));
      const tx = px - Math.cos(a) * len;
      const ty = py + Math.sin(a) * len;
      g.line(px, py, tx, ty, fin.base);
      if (len > 4) {
        const mx = px - Math.cos(a) * len * 0.6;
        const my = py + Math.sin(a) * len * 0.6;
        g.px(Math.round(mx), Math.round(my), band);
      }
    }
    return;
  }
  if (style === 'lobed') {
    // Coelacanth: a fleshy stalk, then the fin.
    const stalk = g.color(shade(ctx.pal.skin, 0.9));
    const sx = px - Math.round(1.5 * s);
    const sy = py + 1.2 * s * sweep;
    g.line(px, py, sx, sy, stalk);
    paint([[sx + 1, sy - 1], [sx - size * sweep, sy + size * 0.3], [sx - size * 0.6, sy + size * 0.75], [sx, sy + 1]], [sx, sy]);
    return;
  }
  const pts = [[px + 1, py - 1], [px - size * sweep, py + size * 0.35 * (tucked ? 0.4 : 1)], [px - size * 0.5, py + size * 0.7 * (tucked ? 0.4 : 1)], [px, py + 1]];
  if (style === 'frilly') pts.splice(2, 0, [px - size * 0.8, py + size * 0.65], [px - size * 0.65, py + size * 0.5]);
  paint(pts, [px, py]);
  g.line(px, py, px - size * sweep * 0.8, py + size * 0.4 * (tucked ? 0.4 : 1), fin.edge);
}

function pelvicFins(ctx, side) {
  const { g, ph, colT, s, pose, fin, pal } = ctx;
  if (ph.pelvic === 'none') return;
  const pc = colT(Math.max(0.42, ph.eyeT - 0.24));
  if (!pc || pc.belly < 1) return;
  const far = side === 'far';
  if (far && (ph.pelvic === 'sucker' || ph.pelvic === 'spine')) return;
  const k = s * Math.min(1.5, ph.finMul);
  const flutter = (pose.pelvic ?? 0) * 0.35;
  const x0 = pc.x - (far ? 1 : 0);
  const y0 = pc.mid + pc.belly - 1;
  const col = far ? fin.dim : fin.base;
  switch (ph.pelvic) {
    case 'small': {
      const L = 3 * k;
      g.polygon([[x0 + 1, y0], [x0 - L * (0.9 + flutter), y0 + L * (0.7 - flutter * 0.5)], [x0 - L * 0.3, y0 + L * 0.3], [x0 - 1, y0]], col);
      break;
    }
    case 'long': {
      const L = 4.5 * k;
      const tip = [x0 - L * (0.85 + flutter * 0.4), y0 + L * (0.6 - flutter * 0.2)];
      g.polygon([[x0 + 1, y0], tip, [x0 - L * 0.35, y0 + 1]], col);
      if (!far) g.line(x0, y0, tip[0], tip[1], fin.edge);
      break;
    }
    case 'feelers': {
      // Gourami threads: one-pixel feelers that trail and wave.
      const n = Math.round(ph.L * 0.5);
      let [lx, ly] = [x0, y0 + 1];
      for (let i = 1; i <= n; i++) {
        const x = x0 - i * 0.8;
        const y = y0 + 1 + i * 0.55 + Math.sin(TAU * ((pose.wave ?? 0) * 1 - i / n) + (far ? 1 : 0)) * 1.1 * s * (i / n);
        g.line(lx, ly, x, y, far ? fin.dim : fin.edge);
        lx = x;
        ly = y;
      }
      break;
    }
    case 'spine': {
      const c = g.color(shade(pal.skin, 0.6));
      const L = Math.max(2, 3 * s);
      g.line(x0, y0 + 1, x0 - L * 0.4, y0 + 1 + L, c);
      break;
    }
    case 'sucker': {
      g.ellipse(x0 - s, y0 + 1, Math.max(1.2, 2.4 * s), Math.max(0.8, 0.9 * s), g.color(shade(pal.skin, 0.75)));
      break;
    }
    default:
  }
}

// ---------------------------------------------------------------------------------------------
// Eyes

/** Hand-set eye stamps per size. S sclera, P pupil, H glint, h second glint, . skip. */
const EYES = {
  2: ['PH', 'PP'],
  3: ['SPH', 'SPP', 'SSP'],
  4: ['SPPH', 'SPPP', 'SPPP', 'SSSP'],
  5: ['.SPP.', 'SPPHP', 'SPPPP', 'SPhPP', '.SSS.'],
  6: ['.SSPP.', 'SSPPHP', 'SPPPHP', 'SPPPPP', 'SPhPPP', '.SSSS.'],
};

function eye(ctx) {
  const { g, ph, set, pal, colT, s, pose, rampOf } = ctx;
  const ec = colT(ph.eyeT);
  if (!ec || ec.back + ec.belly < 3) return;
  let size = Math.max(2, Math.min(ph.eyeSize + (set.eyeMount === 'telescope' ? 1 : 0), Math.floor(ec.back + ec.belly) - 1));
  size = Math.min(6, size);
  const stamp = EYES[size];
  let top = Math.round(ec.mid - ec.back * ph.eyeUp - size / 2 + 0.5);
  const left = ec.x - size + 1;
  const skin = pal.skin;
  // The far eye shows once the fish has turned round: heterochromia only shows then.
  const turned = Math.cos(TAU * (pose.turn ?? 0)) < 0;
  const iris = turned ? pal.eye2 : pal.eye;

  if (set.eyeMount === 'tubular') {
    // Deep-sea tube eyes, pointing up.
    const tube = g.color(shade(skin, 0.9));
    const h = Math.max(2, Math.round(2.5 * s));
    for (let y = 0; y < h; y++) for (let x = 0; x < size; x++) g.px(left + x, top - y + 1, tube);
    top -= h - 1;
  }
  if (set.eyeMount === 'telescope') g.ellipse(left + size / 2, top + size / 2, size / 2 + 1, size / 2 + 1, g.color(shade(skin, 0.75)));
  if (ph.bubble) {
    const wob = Math.sin(TAU * (pose.wave ?? 0) * 2) * 0.5;
    g.ellipse(left + size / 2, top + size + size * 0.45, size * 0.7 + 0.5, size * 0.55 + wob + 0.3, g.color('#d6ecf6', 210));
    g.px(left + Math.round(size * 0.7), top + size + 1, g.color(HIGHLIGHT));
  }

  // Clear the skin round the eye, so patterns and marks never swallow it (v1's eyes sit on
  // plain skin). Masks keep their dark band: that is the point of a mask.
  if (set.markings !== 'mask') {
    const R = rampOf(skin);
    const cx = left + size / 2;
    const cy = top + size / 2;
    const rr = size / 2 + Math.max(1, Math.round(0.6 * s));
    g.ellipse(cx, cy, rr, rr, R.base, (x, y) => ctx.toneAt(x, y) && ctx.toneAt(x, y) !== 'dark' && ctx.toneAt(x, y) !== 'belly');
  }

  const sclera = g.color(lum(skin) > 0.55 ? shade(skin, 0.5) : mix(skin, HIGHLIGHT, 0.75));
  const pupil = g.color(iris);
  const glint = g.color(HIGHLIGHT);
  const lidC = rampOf(skin).dark;
  const ink = g.color(INK);
  const style = set.eyeStyle;
  const mood = set.mood;
  const glance = Math.round(pose.glance ?? 0);
  let lid = pose.lid ?? 0;
  if (mood === 'sleepy') lid = Math.max(lid, 0.5);
  if (mood === 'smug') lid = Math.max(lid, 0.35);

  // Happy fish blink as ^ ^.
  if (lid >= 0.99 && mood === 'happy' && size >= 3) {
    const c = (size - 1) / 2;
    for (let x = 0; x < size; x++) g.px(left + x, top + Math.round(Math.abs(x - c) * (2 / size) * (size / 2 - 0.5)), ink);
    return;
  }
  if (lid >= 0.99) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (stamp[y][x] !== '.') g.px(left + x, top + y, rampOf(skin).base);
    for (let x = 0; x < size; x++) g.px(left + x, top + Math.floor(size / 2), ink);
    return;
  }

  if (style === 'googly') {
    const w = sclera === pupil ? sclera : g.color('#f4f1e6');
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (stamp[y][x] !== '.') g.px(left + x, top + y, w);
    const pd = Math.max(1, Math.floor(size / 2));
    const jx = Math.round((Math.sin(TAU * (pose.wave ?? 0)) + 1) * 0.5 * (size - pd));
    const jy = Math.round((Math.cos(TAU * (pose.wave ?? 0) * 2) + 1) * 0.5 * (size - pd));
    for (let y = 0; y < pd; y++) for (let x = 0; x < pd; x++) g.px(left + jx + x, top + jy + y, ink);
  } else {
    stamp.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        if (ch === '.') return;
        let c = ch === 'S' ? sclera : ch === 'P' ? pupil : glint;
        if (style === 'dot' && ch === 'S') return;
        if (ch === 'h' && style !== 'sparkle' && mood !== 'happy' && size < 5) c = pupil;
        g.px(left + dx + (ch === 'P' && glance && dx > 0 && dx < size - 1 ? 0 : 0), top + dy, c);
      });
    });
    if (style === 'sparkle' && size <= 4) g.px(left + 1, top + size - 2, glint);
    if (glance && size >= 3) {
      // Look back: a sclera pixel moves to the front of the eye.
      const x = glance < 0 ? left + size - 1 : left;
      g.px(x, top + 1, sclera);
    }
    if (mood === 'derpy' && size >= 3) {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (stamp[y][x] !== '.') g.px(left + x, top + y, sclera);
      g.px(left, top + size - 1, pupil);
      if (size >= 4) g.px(left + 1, top + size - 1, pupil);
    }
  }
  if (lid > 0.01) {
    const rows = Math.max(1, Math.round(lid * size));
    for (let y = 0; y < rows; y++) for (let x = 0; x < size; x++) if (stamp[y][x] !== '.') g.px(left + x, top + y, lidC);
  }
  if (mood === 'grumpy' && size >= 3) {
    // A brow slanting down toward the nose.
    g.line(left - 1, top - 1, left + size, top + (size >= 5 ? 1 : 0), ink);
  }
  if (set.blush === 'yes' || mood === 'happy') {
    const blush = g.color('#f28aa0', 210);
    const by = top + size + (s >= 1.3 ? 1 : 0);
    const bx = left - Math.max(1, Math.round(s));
    for (let k = 0; k < Math.max(1, Math.round(1.5 * s)); k++) if (ctx.onBody(bx + k, by)) g.px(bx + k, by, blush);
  }
  ctx.eyeBox = { left, top, size };
}

// ---------------------------------------------------------------------------------------------
// Mouth and jaws

function mouth(ctx) {
  const { g, ph, set, pal, s, pose, nose, colAt, edges } = ctx;
  if (!nose) return;
  const ink = g.color(INK);
  const white = g.color(HIGHLIGHT);
  const inside = g.color('#5a2430');
  const jaw = ph.jaw;
  const mood = set.mood;
  const under = set.snout === 'under' || ph.arch.gillSlits || jaw === 'underbite';
  const mx = nose.x;
  const my = Math.round(nose.mid + (under ? Math.max(0.6, nose.belly * 0.6) : 0.3));
  const open = pose.mouth ?? 0;
  const len = Math.max(2, Math.round((jaw === 'gape' || jaw === 'fangs' ? 0.16 : jaw === 'piranha' ? 0.1 : 0.05) * ph.L + 1));

  // Underbites and piranhas: the lower jaw juts past the upper.
  if (jaw === 'underbite' || jaw === 'piranha') {
    const R = ctx.rampOf(pal.skin);
    const chin = Math.max(1, Math.round(0.8 * s));
    for (let dx = 1; dx <= chin; dx++) for (let y = my + 1; y <= Math.round(nose.mid + nose.belly); y++) g.px(mx + dx, y, R.base);
  }
  if (jaw === 'beak') {
    const beak = g.color(mix(pal.skin, '#f4f1e6', 0.55));
    for (let dx = 0; dx < Math.max(2, Math.round(1.8 * s)); dx++) {
      const c = colAt(mx - dx);
      if (!c) continue;
      const { yb, yv } = edges(c);
      for (let y = yb; y <= yv; y++) if (Math.abs(y - c.mid) <= Math.max(1, (c.back + c.belly) * 0.3)) g.px(c.x, y, beak);
    }
  }
  if (jaw === 'bill') {
    const bill = g.color(shade(mix(pal.skin, '#8d949b', 0.5), 0.85));
    for (const c of ctx.bodyCols) if (c.t > 1) {
      const { yb, yv } = edges(c);
      for (let y = yb; y <= yv; y++) g.px(c.x, y, bill);
    }
  }
  if (jaw === 'lips' || set.markings === 'lipstick') {
    const lip = g.color(set.markings === 'lipstick' ? '#e0405a' : mix(pal.skin, '#e0708a', 0.5));
    const t = Math.max(1, Math.round(0.8 * s));
    for (let dy = -t; dy <= t; dy++) g.px(mx + 1, my + dy, lip);
    if (s >= 1) for (let dy = -t; dy <= t; dy++) g.px(mx + 2, my + dy, lip);
  }
  if (jaw === 'sucker') {
    g.ellipse(mx - 1.5 * s, nose.mid + nose.belly, Math.max(1.2, 1.6 * s), Math.max(0.8, s), g.color(shade(pal.skin, 0.6)));
    g.px(Math.round(mx - 1.5 * s), Math.round(nose.mid + nose.belly), ink);
    return;
  }

  // The open mouth: a wedge cut into the nose, teeth along its edges.
  if (open > 0.08) {
    const o = open * Math.max(1.5, (nose.back + nose.belly) * 0.45);
    const depth = Math.max(2, len + 1);
    const tipX = jaw === 'tube' || jaw === 'bill' ? ctx.tip.x + 1 : mx + 1;
    g.polygon([[tipX + 1, my - o], [tipX - depth, my], [tipX + 1, my + o * (under ? 1.3 : 1)]], inside);
    if (jaw === 'piranha' || jaw === 'fangs') {
      for (let k = 0; k < depth; k += 2) {
        const f = k / depth;
        g.px(Math.round(tipX - k), Math.round(my - o * (1 - f)) + 1, white);
        g.px(Math.round(tipX - k - 1), Math.round(my + o * (1 - f)) - 1, white);
      }
    }
    return;
  }

  const back = mx - len;
  const corner = mood === 'grumpy' ? 1 : mood === 'happy' || mood === 'smug' || jaw === 'grin' ? -1 : 0;
  switch (jaw) {
    case 'tube':
    case 'bill':
      g.px(ctx.tip.x, Math.round(ctx.tip.mid), ink);
      if (jaw === 'bill') g.line(mx, my, mx - 1, my, ink);
      break;
    case 'piranha': {
      g.line(back, my, mx + 1, my, ink);
      if (s < 0.6) {
        g.px(mx, my - 1, white);
        break;
      }
      for (let x = back + 1; x <= mx + 1; x++) {
        if ((x - back) % 2) g.px(x, my - 1, white);
        else g.px(x, my + 1, white);
      }
      break;
    }
    case 'fangs': {
      g.line(back, my + 1, mx, my, ink);
      const fang = Math.max(2, Math.round(1.6 * s));
      g.line(mx - 1, my - 1, mx - 1, my - 1 + fang, white);
      g.line(back + 2, my + 1, back + 2, my + 1 - fang, white);
      if (s >= 1.3) g.line(mx - 3, my, mx - 3, my + fang - 1, white);
      break;
    }
    case 'gape':
      g.line(back, my + 1, mx, my, ink);
      g.line(back, my + 2, mx - 1, my + 1, g.color(shade(pal.skin, 0.8)));
      break;
    case 'grin':
    default:
      g.line(back + (corner ? 1 : 0), my, mx, my, ink);
      if (corner) g.px(back, my + corner, ink);
  }
  if (mood === 'derpy') g.px(mx + 1, my + 1, g.color('#f28aa0'));
}

// ---------------------------------------------------------------------------------------------
// Extras

function extras(ctx) {
  const { g, ph, pal, s, pose, nose, colT, edges } = ctx;
  if (!nose) return;
  const wave = pose.wave ?? 0;
  const skinD = g.color(shade(pal.skin, 0.7));
  const skinL = g.color(shade(pal.skin, 1.15));
  const L = ph.L;
  const kind = ph.extras;
  const head = colT(ph.eyeT);
  if (kind === 'barbels') {
    const len = Math.max(3, L * 0.2 * (ph.stage === 'elder' ? 1.35 : 1));
    const x0 = nose.x - 1;
    const y0 = nose.mid + Math.max(0.6, nose.belly * 0.5);
    for (const [dir, lift] of [[-0.2, 0], [-0.8, 0.4]]) {
      let [lx, ly] = [x0, y0];
      const n = Math.round(len);
      for (let i = 1; i <= n; i++) {
        const x = x0 + dir * i;
        const y = y0 + i * (0.65 - lift * 0.5) + Math.sin(TAU * (wave - i / n)) * 0.6 * s * (i / n);
        g.line(lx, ly, x, y, skinD);
        lx = x;
        ly = y;
      }
    }
  } else if (kind === 'horns' && head) {
    const { yb } = edges(head);
    const h = Math.max(2, Math.round(2.4 * s));
    g.polygon([[head.x - 1, yb + 1], [head.x + h * 0.8, yb - h], [head.x + 1, yb + 1]], skinL);
    const rear = colT(0.12);
    if (rear) {
      const { yv } = edges(rear);
      g.polygon([[rear.x + 1, yv - 1], [rear.x - h, yv + h * 0.6], [rear.x - 1, yv - 1]], skinL);
    }
  } else if (kind === 'nosehorn' && head) {
    const c = colT(Math.min(0.97, ph.eyeT + 0.08));
    const { yb } = edges(c);
    const len = Math.max(3, L * 0.16);
    const th = Math.max(1, Math.round(0.8 * s));
    for (let k = 0; k < th; k++) g.line(c.x - k, yb + 1, c.x + len * 0.85 - k, yb - len * 0.5, skinL);
  } else if (kind === 'lure') {
    const c = colT(Math.min(0.96, ph.eyeT + 0.06));
    const { yb } = edges(c);
    const len = Math.max(5, L * 0.38);
    const bob = Math.sin(TAU * wave) * 0.8 * s;
    let [lx, ly] = [c.x, yb];
    let end = [lx, ly];
    for (let i = 1; i <= Math.round(len); i++) {
      const f = i / len;
      const x = c.x + f * len * 0.75;
      const y = yb - Math.sin(Math.PI * Math.min(1, f * 0.8)) * len * 0.45 + f * f * bob;
      g.line(lx, ly, x, y, skinD);
      lx = x;
      ly = y;
      end = [x, y];
    }
    const glowA = Math.round(170 + 85 * (pose.glow ?? 0.5));
    const bulb = g.color(mix(pal.mark === '#2b2f38' ? '#7ee8ff' : pal.mark, HIGHLIGHT, 0.5), glowA);
    const r = Math.max(0.9, 1.1 * s);
    g.ellipse(end[0] + 0.5, end[1] + 1, r, r, bulb);
    g.px(Math.round(end[0]), Math.round(end[1]), g.color(HIGHLIGHT));
  } else if (kind === 'cheekspines') {
    const c = colT(Math.max(0.5, ph.eyeT - 0.08));
    if (!c) return;
    const len = Math.max(2, 2.6 * s);
    for (const v of [-0.2, 0.3]) {
      const y = c.mid + v * (v < 0 ? c.back : c.belly);
      g.line(c.x, y, c.x - len, y + v * len, skinD);
    }
  }
}

/** v1's rare flourishes: a sheen band that sweeps along the body, glowing spots. */
function flourish(ctx) {
  const { g, set, ph, pal, pose, bodyCols, edges, s } = ctx;
  const L = ph.L;
  const sheen = set.sheen && set.sheen !== 'none' ? set.sheen : pal.chrome ? 'metal' : null;
  if (sheen) {
    const at = (pose.sheen ?? 0) * (L + 8) - 4;
    const hot = g.color(sheen === 'metal' ? HIGHLIGHT : mix(pal.skin, HIGHLIGHT, 0.7), 200);
    const w = Math.max(2, Math.round(1.5 * s));
    for (const c of bodyCols) {
      const bx = c.t * L;
      if (bx < at || bx >= at + w) continue;
      const { yb } = edges(c);
      for (let y = yb + 1; y < c.mid; y++) g.px(c.x, y, hot);
    }
  }
  if (set.glow === 'spots' || set.glow === 'full') {
    const glow = g.color(mix(pal.mark, HIGHLIGHT, 0.45), Math.round(Math.max(120, Math.min(255, 160 + (pose.glow ?? 0.5) * 95))));
    const { range } = roller(ph.seed, 900);
    const n = Math.round(6 * Math.max(1, s));
    for (let i = 0; i < n; i++) {
      const c = ctx.colT(range(0.08, 0.88, i));
      if (!c) continue;
      const v = range(-0.7, 0.7, 30 + i);
      const y = Math.round(c.mid + v * (v < 0 ? c.back : c.belly));
      g.px(c.x, y, glow);
      if (set.glow === 'full') g.px(c.x + 1, y, glow);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Signatures and relics: rare- and myth-only features. Each is its own routine and shares no
// path with the ordinary traits, so nothing a common fish can roll or breed reaches these pixels.

const GOLD = '#f2c53d';
const pulseOf = (pose) => 0.5 + 0.5 * Math.sin(TAU * (pose.glow ?? 0.5));
/** The tail joint: the body column nearest t = 0. */
const tailCol = (ctx) => ctx.bodyCols.reduce((best, c) => (!best || c.t < best.t ? c : best), null);

/** The signature: one of eight, picked or set (see genome.js SIGNATURES). */
function signature(ctx) {
  const { g, ph, pal, s, pose, colT, edges } = ctx;
  const kind = ph.signature;
  if (!kind || kind === 'none') return;
  const glowA = Math.round(170 + 85 * pulseOf(pose));
  const head = colT(ph.eyeT);
  if (!head) return;

  if (kind === 'crown') {
    // A row of gold spikes standing on the head.
    const gold = g.color(GOLD);
    const tip = g.color(HIGHLIGHT);
    const n = Math.max(3, Math.min(5, Math.round(2 + s)));
    const h = Math.max(3, Math.round(2.6 * s + 1));
    for (let i = 0; i < n; i++) {
      const c = colT(ph.eyeT - 0.14 + (0.16 * i) / (n - 1));
      if (!c) continue;
      const { yb } = edges(c);
      const hh = i === Math.floor(n / 2) ? h + 1 : h;
      g.line(c.x, yb, c.x, yb - hh, gold);
      g.px(c.x, yb - hh, tip);
    }
    const a = colT(ph.eyeT - 0.14);
    const b = colT(ph.eyeT + 0.02);
    if (a && b) g.line(a.x, edges(a).yb, b.x, edges(b).yb, gold);
  } else if (kind === 'halo') {
    // A gold ring floating over the head, bobbing with the swim.
    const ring = g.color(mix(GOLD, HIGHLIGHT, 0.35), glowA);
    const { yb } = edges(head);
    const cx = head.x - 1;
    const rx = Math.max(2.5, 2.4 * s + 1);
    const ry = Math.max(1, 0.7 * s);
    const cy = yb - Math.max(3, 2.5 * s + 2) + Math.round(Math.sin(TAU * (pose.wave ?? 0)) * 0.6);
    const steps = Math.ceil(TAU * rx * 2);
    for (let i = 0; i < steps; i++) {
      const a = (TAU * i) / steps;
      g.px(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), ring);
    }
  } else if (kind === 'thirdeye') {
    // A large slit-pupilled eye set into the brow, above and behind the real one.
    const c = colT(ph.eyeT - 0.09) ?? head;
    const { yb } = edges(c);
    const r = Math.max(2, Math.round(0.9 * s + 0.8));
    const cx = c.x + 0.5;
    const cy = yb + r + 0.5;
    g.ellipse(cx, cy, r + 1, r + 0.6, g.color(INK));
    g.ellipse(cx, cy, r, r - 0.3, g.color(mix('#ff4fd8', HIGHLIGHT, 0.25 * pulseOf(pose)), glowA));
    g.line(c.x, Math.round(cy - r + 1), c.x, Math.round(cy + r - 1), g.color(INK));
    g.px(c.x - 1, Math.round(cy - r + 1), g.color(HIGHLIGHT));
  } else if (kind === 'runes') {
    // A glowing rune script along the lateral line.
    const rune = g.color(mix('#7ee8ff', HIGHLIGHT, 0.3), glowA);
    const per = Math.max(3, Math.round(2.5 * s));
    for (const c of ctx.bodyCols) {
      if (c.t < 0.12 || c.t > ph.eyeT - 0.12) continue;
      const y = Math.round(c.mid);
      const k = Math.round(c.t * ph.L) % per;
      if (k === per - 1) continue;
      g.px(c.x, y, rune);
      if (k === 0) g.px(c.x, y - 1, rune);
      if (k === 1 && per > 3) g.px(c.x, y + 1, rune);
    }
  } else if (kind === 'embers') {
    // Embers shed from the tail, rising and cooling as they drift back.
    const tc = tailCol(ctx);
    if (!tc) return;
    const hot = ['#fff1a8', '#ffd84a', '#ff9a2e', '#f2552a', '#b8321e'];
    const n = Math.max(4, Math.round(3 + 1.5 * s));
    const w = pose.wave ?? 0;
    for (let i = 0; i < n; i++) {
      const f = (i / n + w) % 1;
      const x = Math.round(tc.x - (2 + f * 14) * s);
      const y = Math.round(tc.mid - f * 10 * s - 1 + Math.sin(TAU * (f * 2 + i * 0.37)) * 1.5 * s);
      const sz = Math.max(2, Math.round((1 - f) * 2 * s + 1));
      const heat = Math.min(hot.length - 2, Math.floor(f * f * (hot.length - 1)));
      g.rect(x, y, sz, sz, g.color(hot[heat + 1]));
      if (sz >= 3) g.rect(x + 1, y + 1, sz - 2, sz - 2, g.color(hot[heat]));
    }
  } else if (kind === 'voideye') {
    // The eye is a hole: black, a single star in it, and a dark streak running back.
    const size = Math.max(2, Math.min(6, ph.eyeSize, Math.floor(head.back + head.belly) - 1));
    const top = Math.round(head.mid - head.back * ph.eyeUp - size / 2 + 0.5);
    const cx = head.x - size + 1 + size / 2;
    const cy = top + size / 2;
    const voidC = g.color('#0b0614');
    g.ellipse(cx, cy, size / 2 + 0.4, size / 2 + 0.4, voidC);
    g.px(Math.round(cx - 0.5), Math.round(cy - 0.5), g.color('#b98cff', glowA));
    const streak = g.color('#2a1640', 220);
    const len = Math.max(2, Math.round(2.5 * s));
    for (let k = 1; k <= len; k++) g.px(Math.round(cx - size / 2 - k), Math.round(cy + size / 2 + k * 0.5), streak);
  } else if (kind === 'wings') {
    // A second pair of wing fins rising from the back, beating with the swim.
    const c = colT(0.55);
    if (!c) return;
    const { yb } = edges(c);
    const beat = 0.7 + 0.3 * Math.sin(TAU * (pose.wave ?? 0) * 2);
    const wing = g.color(mix('#cfe9ff', pal.fin.lit, 0.2), 215);
    const rim = g.color(mix(GOLD, HIGHLIGHT, 0.3), 240);
    for (const [back, k] of [[0, 1], [3 * s, 0.7]]) {
      const bx = c.x - Math.round(back);
      const tip = [bx - 8 * s * k, yb - 7 * s * k * beat - 2];
      const pts = [[bx + 1, yb + 1], [tip[0] + 3 * s, tip[1]], tip, [bx - 4 * s * k, yb - 1.5 * s], [bx - 1, yb + 1]];
      g.polygon(pts, wing);
      g.line(bx, yb, tip[0], tip[1], rim);
    }
  } else if (kind === 'brand') {
    // A glowing sigil burnt into the flank: a diamond crossed by a bar.
    const c = colT(0.45);
    if (!c) return;
    const sig = g.color(mix('#e8551f', GOLD, 0.4 + 0.4 * pulseOf(pose)), 235);
    const r = Math.max(2, Math.round(1.4 * s + 0.6));
    const cx = c.x;
    const cy = Math.round(c.mid - c.back * 0.15);
    for (let k = 0; k < r; k++) {
      g.px(cx - r + k, cy - k, sig);
      g.px(cx + k, cy - r + k, sig);
      g.px(cx + r - k, cy + k, sig);
      g.px(cx - k, cy + r - k, sig);
    }
    g.line(cx, cy - r - 1, cx, cy + r + 1, sig);
  }
}

/** Relics that sit behind the fish: the aurora mantle and the black sun. */
function relicBehind(ctx) {
  const { g, ph, s, pose, K } = ctx;
  const kind = ph.relic;
  if (kind !== 'mantle' && kind !== 'eclipse') return;
  const cols = K.cols.filter((c) => c.back + c.belly >= 1);
  if (!cols.length) return;
  const at = (t) => cols.reduce((best, c) => (!best || Math.abs(c.t - t) < Math.abs(best.t - t) ? c : best), null);
  if (kind === 'mantle') {
    // A ribbon of shifting colour streaming above the back.
    const w = pose.wave ?? 0;
    const lift = Math.max(3, 2.5 * s + 2);
    for (const c of cols) {
      if (c.t < 0.05 || c.t > 0.85) continue;
      const y = Math.round(c.mid - c.back - lift - Math.sin(TAU * (c.t * 1.5 - w)) * s);
      const hue = rotateHue('#7ee8ff', Math.round(c.t * 220 + w * 360) % 360);
      const col = g.color(hue, 200);
      g.px(c.x, y, col);
      g.px(c.x, y + 1, col);
    }
  } else {
    // A black disc with a burning rim, risen behind the back.
    const c = at(0.5);
    const r = Math.max(3, 2.6 * s + 1.5);
    const cx = c.x + 0.5;
    const cy = c.mid - c.back - r * 0.4;
    g.ellipse(cx, cy, r + 1, r + 1, g.color(mix(GOLD, HIGHLIGHT, 0.4 * pulseOf(pose)), 230));
    g.ellipse(cx, cy, r, r, g.color('#07050c'));
  }
}

/** Relic: motes circling the fish, passing behind it on the far side. */
function orbit(ctx) {
  const { g, ph, s, pose, onBody } = ctx;
  if (ph.relic !== 'orbit') return;
  const c = ctx.colT(0.5);
  if (!c) return;
  const rx = ph.L * 0.62;
  const ry = Math.max(3, (c.back + c.belly) * 0.5 + 2 * s);
  const mote = g.color(mix('#b98cff', HIGHLIGHT, 0.5), 235);
  const sz = s >= 1.4 ? 2 : 1;
  for (let i = 0; i < 3; i++) {
    const a = TAU * ((pose.wave ?? 0) + i / 3);
    const x = Math.round(c.x + Math.cos(a) * rx);
    const y = Math.round(c.mid + Math.sin(a) * ry * 0.6);
    const behind = Math.sin(a) < 0;
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < sz + 1; dx++) {
        if (dy === 1 && dx === sz) continue;
        if (behind && onBody(x + dx, y + dy)) continue;
        g.px(x + dx, y + dy, mote);
      }
    }
  }
}

/** Relic: the rear of the body has rotted to bone. */
function revenant(ctx) {
  const { g, ph, bodyCols, edges, s } = ctx;
  if (ph.relic !== 'revenant') return;
  const rot = g.color('#3a3542', 235);
  const bone = g.color('#e8e4d8');
  const per = Math.max(2, Math.round(2 * s));
  for (const c of bodyCols) {
    if (c.t > 0.34) continue;
    const { yb, yv } = edges(c);
    for (let y = yb + 1; y < yv; y++) g.px(c.x, y, rot);
    const y = Math.round(c.mid);
    g.px(c.x, y, bone);
    if (Math.round(c.t * ph.L) % per === 0 && c.t > 0.04) {
      for (let k = 1; k < Math.round(c.back); k++) g.px(c.x - Math.round(k * 0.3), y - k, bone);
      for (let k = 1; k < Math.round(c.belly); k++) g.px(c.x - Math.round(k * 0.3), y + k, bone);
    }
  }
}

// ---------------------------------------------------------------------------------------------

/** The turn: the sprite squashes to a sliver about the body's centre and comes back mirrored. */
function squash(g, turn, cx) {
  const c = Math.cos(TAU * turn);
  if (c > 0.995) return g;
  const k = Math.sign(c || 1) * Math.max(0.16, Math.abs(c));
  const out = new Grid(g.w, g.h);
  out.palette = g.palette;
  out.index = g.index;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const sx = Math.round(cx + (x + 0.5 - cx) / k - 0.5);
      const v = g.get(sx, y);
      if (v) out.data[y * g.w + x] = v;
    }
  }
  return out;
}

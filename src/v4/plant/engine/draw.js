// The frame painter: topology + pose → one indexed image.
//
//   bed (back)  →  prop  →  for each depth layer (back, middle, front):
//                             axes (trunk first) → leaves → heads → clumps (low to high)
//                             → flowers → fruit
//               →  bed lip (buries root crops and stem bases)  →  snow  →  finish
//
// The back layer is painted darker, every primitive drops a contact shadow on what it covers,
// and a crown's clumps share one sphere of light, so a tree reads as a mass and not as balls.

import { Canvas } from './raster.js';
import { posed } from './pose.js';
import { leaf, clump, head, bloom, fruit, root, cap, bead } from './organs.js';
import { hash01 } from '../../../pixel/rng.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ORGAN_K = { root: 0.9, leaf: 1, head: 1.5, clump: 2, bloom: 3, cap: 3, float: 3.5, polyp: 3.5, bead: 3.5, glow: 3.6, fruit: 4, ear: 4, grain: 4, tassel: 3 };
const LATE = new Set(['bloom', 'fruit', 'ear', 'grain', 'tassel']);

/** Plant units → px so the grown plant at rest is `H` tall and at most `H · maxW` wide. */
export function fitScale(topo, H, maxW = 1.7) {
  const P = posed(topo, { growth: 1, sway: 0, wind: 0, lean: 0, flutter: 0 }, 1, { x: 0, y: 0 });
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  const see = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
  };
  for (const a of P.axes) {
    if (!a.visible) continue;
    const w = a.w ?? a.rpx ?? 0;
    for (const p of a.pts) {
      see(p.x - w, p.y);
      see(p.x + w, p.y);
    }
  }
  for (const o of P.organs) {
    const r = o.r;
    if (o.type === 'leaf') {
      see(o.x + Math.sin(o.th) * o.len, o.y - Math.cos(o.th) * o.len * (topo.form.medium === 'water' ? 1 : 0.85));
      see(o.x - r * 0.3, o.y);
      see(o.x + r * 0.3, o.y);
    } else if (o.type === 'head') {
      see(o.x - r, o.y - r * 1.7);
      see(o.x + r, o.y);
    } else {
      see(o.x - r, o.y - r);
      see(o.x + r, o.y - r);
    }
  }
  const hU = Math.max(1e-3, -minY);
  const wU = Math.max(1e-3, maxX - minX);
  return { scale: Math.min(H / hU, (H * maxW) / wU), heightU: hU, widthU: wU, offX: (minX + maxX) / 2 };
}

/** Axis surface textures, (s across −1..1, u along, x, y, r) → a tone offset. */
const TEX = {
  bark: (s, u, x, y, r) => (r < 1.6 ? 0 : (Math.floor((s + 1) * 1.7 + hash01(Math.floor(y / 3), 3) * 0.9) % 2 ? -0.09 : 0.02)),
  birch: (s, u, x, y) => (Math.abs(s) < 0.9 && hash01(Math.floor(x / 2) * 31 + Math.floor(y / 2) * 57, 9) < 0.16 ? -0.6 : 0.06),
  rings: (s, u, x, y, r) => (y % Math.max(3, Math.round(r * 3.5)) === 0 ? -0.28 : 0),
  bands: (s, u, x, y) => (y % 3 === 0 ? -0.16 : 0.03),
  ribs: (s) => (Math.cos(s * Math.PI * 2.6) > 0.45 ? 0.1 : -0.07),
  spots: (s, u, x, y) => (hash01(x * 13 + y * 29, 17) < 0.06 ? 0.3 : 0),
};

/** How a ribbon, frond or bough is wide along its length. */
const WPROF = {
  ribbon: (u) => (u < 0.82 ? 0.85 + 0.15 * Math.min(1, u * 6) : Math.max(0.12, (1 - u) / 0.18)),
  blade: (u) => Math.sin(Math.PI * Math.min(1, 0.08 + u)) ** 0.5,
  frond: (u, n) => Math.sin(Math.PI * Math.min(1, 0.06 + u)) ** 0.5 * (0.3 + 0.7 * Math.abs(Math.sin(u * n * Math.PI))),
  bough: (u, n) => (1 - u * 0.8) * (0.7 + 0.3 * Math.abs(Math.sin(u * n * Math.PI))),
  strand: () => 0.6,
};

function drawAxis(K, a, matOf, dark) {
  const { c } = K;
  const style = a.style;
  if (a.pts.length < 2) return;
  const lenPx = a.len * K.scale * a.grown;
  if (style === 'ribbon' || style === 'frond' || style === 'bough' || style === 'blade' || style === 'strand') {
    if (K.bare && a.mat !== 'bark') {
      // a willow in winter: the strands are bare twigs
      c.chain(a.pts.map((p) => ({ ...p, r: 0.5 })), matOf('bark'), { dark, z: null });
      return;
    }
    const W = Math.max(0.5, (a.w ?? a.r) * K.scale * K.thick);
    const prof = WPROF[a.wProf ?? style] ?? WPROF.ribbon;
    const n = Math.max(2, Math.round(lenPx / (style === 'bough' ? 2.2 : 2.6)));
    const pts = a.pts.map((p, k) => ({ x: p.x, y: p.y, w: Math.max(0.5, W * prof(k / (a.pts.length - 1), n)) }));
    c.sweep(pts, matOf(a.mat), {
      dark,
      rib: style === 'frond' && lenPx > 7,
      ribMat: style === 'frond' ? matOf('stem') : 0,
      fold: style === 'bough' ? 0.16 : a.fold ?? 0.2,
      tip: style === 'bough' ? 0.18 : 0.1,
      paint: style === 'ribbon' || style === 'blade' ? K.ribbonPaint : null,
      shadow: 0.14,
    });
    return;
  }
  let pts = a.pts;
  if (style === 'pad') {
    const R = Math.max(1, a.rpx);
    pts = pts.map((p, k) => ({ ...p, r: Math.max(0.6, R * Math.sin(Math.PI * (0.08 + 0.84 * (k / (pts.length - 1)))) ** 0.55) }));
  }
  const tex = TEX[a.tex] ?? null;
  c.chain(pts, matOf(a.mat), { dark, tex, min: 0.5 });
  if (style === 'column' && K.spines && a.rpx >= 2) {
    // a cactus's spines: pale ticks just outside the silhouette
    for (let k = 1; k < pts.length; k++) {
      const p = pts[k];
      for (const s of [-1, 1]) {
        if (hash01(a.id * 37 + k * 2 + (s > 0 ? 1 : 0), 61) < 0.5) continue;
        c.dot(p.x + s * (p.r + 0.6), p.y, matOf('spine'), 0.8);
      }
    }
  }
}

/** Soil, sand, a rock or a pot. `fromY`: only rows at or below it (the lip pass). */
function drawBed(c, kind, cx, gy, half, M, seed, fromY = -Infinity) {
  if (kind === 'none' || !kind) return;
  c.begin();
  const put = (x, y, m, t) => {
    if (y < fromY) return;
    c.set(x, y, m, clamp01(t));
  };
  if (kind === 'rock') {
    const rx = Math.max(3, half * 0.95);
    const ry = Math.max(2, rx * 0.55);
    const cy = gy + ry * 0.7;
    c.blob(cx, cy, rx, ry, M.rock, { seed: seed + 5, lumps: 0.1, shadow: 0 });
    return;
  }
  if (kind === 'pot') {
    const top = gy - 1;
    const hgt = Math.max(4, Math.round(half * 0.9));
    const rim = Math.max(1, Math.round(hgt * 0.22));
    const w0 = half + 1;
    for (let y = top; y <= top + hgt; y++) {
      const t = (y - top) / hgt;
      const w = y < top + rim ? w0 + 0.6 : w0 * (1 - 0.22 * t);
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
        const s = (x + 0.5 - cx) / w;
        if (Math.abs(s) > 1) continue;
        let tone = 0.62 - 0.42 * s + (y < top + rim ? 0.1 : 0) - (y === top + rim ? 0.25 : 0);
        put(x, y, M.pot, tone);
      }
    }
    for (let x = Math.floor(cx - w0 + 1); x <= Math.ceil(cx + w0 - 1); x++) put(x, top, M.bed, 0.25);
    return;
  }
  const flat = kind === 'sand' || kind === 'gravel' ? 0.22 : kind === 'tilled' ? 0.3 : 0.32;
  const rx = half + 1;
  const ry = Math.max(1.5, rx * flat);
  const cy = gy + ry * 0.55;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(gy + 2); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + Math.min(0, dy) ** 2 > 1 || y > gy + 2) continue;
      if (dy > 0 && Math.abs(dx) > 1 - dy * 0.2) continue;
      let tone = 0.58 - 0.38 * dx - 0.3 * Math.max(-1, Math.min(1, dy));
      let m = M.bed;
      if (kind === 'tilled' && (y - Math.floor(cy - ry)) % 2 === 1 && Math.abs(dx) < 0.8) tone -= 0.2;
      if (hash01(x * 17 + y * 131, seed + 3) < (kind === 'gravel' ? 0.3 : 0.12)) m = M.bed2;
      if (kind === 'grass' && dy < -0.35) m = M.grass ?? M.bed2;
      put(x, y, m, tone);
    }
  }
  if (kind === 'grass' && fromY === -Infinity) {
    for (let i = 0; i < Math.round(half * 1.2); i++) {
      const x = Math.floor(cx - rx + 1 + hash01(i, seed + 7) * (rx * 2 - 2));
      const dx = (x + 0.5 - cx) / rx;
      const top = Math.floor(cy - ry * Math.sqrt(Math.max(0, 1 - dx * dx)));
      put(x, top - 1, M.grass, 0.7);
      if (hash01(i, seed + 9) < 0.4) put(x, top - 2, M.grass, 0.85);
    }
  }
  if (kind === 'gravel' && fromY === -Infinity) {
    for (let i = 0; i < Math.round(half * 0.5); i++) {
      const x = cx - rx * 0.85 + hash01(i, seed + 11) * rx * 1.7;
      c.disc(x, gy + 0.5, 0.9 + hash01(i, seed + 13), M.rock, { own: false });
    }
  }
}

function drawProp(c, kind, cx, gy, H, M, side) {
  if (!kind) return;
  c.begin();
  const x = cx + side * Math.max(1.5, H * 0.07);
  const top = gy - H * (kind === 'pole' ? 1.04 : 0.78);
  c.chain([{ x, y: gy + 1, r: 0.6 }, { x, y: top, r: 0.6 }], M.wood, { min: kind === 'pole' && H > 40 ? 0.9 : 0.5 });
  if (kind === 'stake' && H > 24) {
    // twine ties
    for (const f of [0.35, 0.6]) c.dot(x, gy - H * f, M.straw ?? M.wood, 0.85);
  }
}

/**
 * Paint one frame.
 * opt: { scale, H, w, h, origin, mats, M, look, bed, bedHalf, prop, seed, form, leafPaint,
 *        ribbonPaint, tipFrom, thickness, spines }
 */
export function render(topo, pose, opt) {
  const form = topo.form;
  const water = form.medium === 'water';
  const season = water || pose.season == null || pose.season < 0 ? 1 : Math.max(0, Math.min(3, Math.round(pose.season)));
  const P = posed(topo, pose, opt.scale, opt.origin);
  const c = new Canvas(opt.w, opt.h);
  const M = opt.M;
  const bare = season === 3 && form.deciduous;
  const ripe = form.ripen && P.t >= 0.97;
  const autumn = season === 2 && form.deciduous;
  const matOf = (name) => {
    let n = name;
    if (ripe && (n === 'leaf' || n === 'leafB' || n === 'stem' || n === 'tip')) n = 'straw';
    else if (autumn && (n === 'leaf' || n === 'tip')) n = 'leafAut';
    else if (autumn && n === 'leafB') n = 'leafAutB';
    return M[n] ?? M.leaf;
  };
  const K = {
    c, M, scale: opt.scale, medium: form.medium, open: pose.bloom ?? 1, glow: pose.glow ?? 0.5, droop: pose.droop ?? 0,
    seed: opt.seed ?? 0, groundY: P.groundY, bare, thick: 0.32 + 0.68 * Math.min(1, P.t / 0.8) ** 0.7,
    leafW: opt.leafW ?? 1, spines: opt.spines, ribbonPaint: opt.ribbonPaint ? (u, a, x, y) => opt.ribbonPaint(u, a, x, y, matOf) : null,
    leafPaint: opt.leafPaint ? (u, a, x, y, o) => opt.leafPaint(u, a, x, y, o, matOf) : null,
  };
  const cx = opt.origin.x;
  const gy = opt.origin.y;

  drawBed(c, opt.bed, cx, gy, opt.bedHalf, M, K.seed);
  drawProp(c, opt.prop, cx, gy, opt.H, M, opt.propSide ?? 1);

  // the crown: one sphere of light over every clump
  const clumps = P.organs.filter((o) => o.type === 'clump');
  if (clumps.length > 1) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const o of clumps) {
      x0 = Math.min(x0, o.x - o.r);
      x1 = Math.max(x1, o.x + o.r);
      y0 = Math.min(y0, o.y - o.r);
      y1 = Math.max(y1, o.y + o.r);
    }
    K.crown = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: Math.max(2, (x1 - x0) / 2), ry: Math.max(2, (y1 - y0) / 2) };
  }

  const items = [];
  for (const a of P.axes) {
    if (!a.visible) continue;
    let k = a.order * 0.01;
    if (a.style === 'bough') k = 0.5 + (opt.h - a.pts[0].y) / opt.h * 0.3;
    if (a.layer != null) k = a.layer;
    items.push({ z: a.z, k, a });
  }
  for (const o of P.organs) {
    const rule = o.rule ?? {};
    if (bare && (o.type === 'leaf' || o.type === 'clump' || LATE.has(o.type)) && !rule.winter) continue;
    if (rule.season === 'spring' && season !== 0) continue;
    if (rule.until != null && P.t >= rule.until) continue;
    if (rule.season === 'summer' && (season === 0 || season === 3)) continue;
    if (!water && season === 3 && LATE.has(o.type) && !rule.winter) continue;
    let k = ORGAN_K[o.type] ?? 3;
    if (o.type === 'clump') k += (o.y / opt.h) * -0.5 + 0.5;
    items.push({ z: o.z || 0, k, o });
  }
  items.sort((p, q) => p.z * 10 + p.k - (q.z * 10 + q.k));

  // nothing grows through the soil but roots (and, under water, nothing hangs below the bed)
  const floor = opt.bed === 'pot' ? gy - 1 : gy + (opt.bed && opt.bed !== 'none' ? 1 : 0);
  for (const it of items) {
    const dark = it.z < 0 ? 0.13 : 0;
    c.floor = it.o?.type === 'root' ? Infinity : floor;
    if (it.a) {
      drawAxis(K, it.a, matOf, dark);
      continue;
    }
    const o = it.o;
    switch (o.type) {
      case 'leaf': {
        let m = (o.id * 7 + 3) % 5 === 0 ? 'leafB' : 'leaf';
        if (opt.tipFrom != null && o.u >= opt.tipFrom) m = 'tip';
        if (o.rule?.mat) m = o.rule.mat;
        leaf(K, o, { mat: matOf(m), dark });
        break;
      }
      case 'clump':
        clump(K, o, { mat: matOf(o.z < 0 ? 'leafB' : o.rule?.mat ?? 'leaf'), dark: dark * 0.6 });
        break;
      case 'head':
        head(K, o, { mat: matOf(o.kind === 'moss' ? 'leaf' : 'leafB'), dark });
        break;
      case 'bloom':
        bloom(K, o);
        break;
      case 'cap':
        cap(K, o);
        break;
      case 'root':
        root(K, o);
        break;
      case 'fruit':
      case 'ear':
      case 'grain':
        fruit(K, { ...o, kind: o.type === 'ear' ? 'ear' : o.type === 'grain' ? 'wheat' : o.kind });
        break;
      case 'tassel':
        bloom(K, { ...o, kind: 'tassel' });
        break;
      default:
        bead(K, o);
    }
  }

  c.floor = Infinity;
  // the lip: soil in front of the stem base, burying the bottom of a root
  if (opt.bed && opt.bed !== 'rock' && opt.bed !== 'none') drawBed(c, opt.bed, cx, gy, opt.bedHalf, M, K.seed, opt.bed === 'pot' ? gy : gy + 1);

  if (season === 3 && !water) c.capTop((m) => m !== M.glow, 0.5, M.snow);

  const look = { ...opt.look };
  return { img: c.finish(opt.mats, look), anchorX: cx, groundY: gy };
}

// Organ painters: a posed organ ({x, y, th, len, r, kind, side, z, …}) → primitives on the
// canvas. Each one knows only its own shape. Light, shadow and outline come from the canvas.
//
// Shapes are pixel-honest: below a few pixels every organ falls back to a deliberate 1–3 px mark
// (a flower is a petal-coloured plus with an eye, a berry is one lit pixel and its shadow), the
// way a pixel artist would draw it rather than a shrunken vector.

import { hash01 } from '../../../pixel/rng.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const turn = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

/** Leaf half-width profiles, s 0 base .. 1 tip, as a fraction of length × aspect. */
export const LEAF = {
  lance: { w: (s) => Math.sin(Math.PI * s) ** 0.8 * (1 - 0.35 * s), aspect: 0.26, rib: true },
  oval: { w: (s) => Math.sin(Math.PI * s) ** 0.6, aspect: 0.36, rib: true },
  heart: { w: (s) => Math.sin(Math.PI * Math.min(1, s ** 0.75)) ** 0.5 * (1 - 0.2 * s), aspect: 0.42, rib: true },
  round: { w: (s) => Math.sin(Math.PI * s) ** 0.45, aspect: 0.5, rib: true },
  strap: { w: (s) => (s < 0.8 ? 0.75 + 0.25 * Math.min(1, s * 4) : (1 - s) / 0.2), aspect: 0.09, rib: false },
  needle: { w: () => 0.6, aspect: 0.06, rib: false },
  spoon: { w: (s) => Math.sin(Math.PI * (0.15 + 0.8 * s)) ** 0.6 * (0.45 + 0.55 * s), aspect: 0.38, rib: false },
  ruffle: { w: (s, n) => Math.sin(Math.PI * s) ** 0.5 * (0.84 + 0.16 * Math.abs(Math.sin(s * n * 2.2))), aspect: 0.48, rib: true },
  frond: { w: (s, n) => Math.sin(Math.PI * Math.min(1, s * 1.05)) ** 0.5 * (0.35 + 0.65 * Math.abs(Math.sin(s * n * Math.PI))), aspect: 0.3, rib: true },
  pinnate: { w: (s, n) => Math.sin(Math.PI * s) ** 0.4 * (Math.abs(Math.sin(s * n * Math.PI)) > 0.3 ? 1 : 0.18), aspect: 0.34, rib: true },
  kelp: { w: (s, n) => Math.sin(Math.PI * Math.min(1, s * 1.08)) ** 0.7 * (0.82 + 0.18 * Math.sin(s * n * 2.6)), aspect: 0.24, rib: false },
  wavy: { w: (s, n) => Math.sin(Math.PI * s) ** 0.7 * (0.7 + 0.3 * Math.sin(s * n * 3)), aspect: 0.13, rib: true },
  palmate: { lobes: 5, w: (s) => Math.sin(Math.PI * s) ** 0.7, aspect: 0.26, rib: false },
  trifol: { lobes: 3, w: (s) => Math.sin(Math.PI * s) ** 0.5, aspect: 0.42, rib: false },
  fan: { lobes: 4, w: () => 0.5, aspect: 0.05, rib: false, thin: true },
};

/** Bend a midline: on land a leaf's weight pulls its tip down; under water it floats up. */
function midline(x, y, th, len, { droop = 0, rise = 0, curl = 0, n }) {
  const pts = [{ x, y }];
  const ds = len / n;
  for (let k = 0; k < n; k++) {
    if (rise) th += turn(th, 0) * Math.min(1, rise) / n * 1.6;
    else if (droop) th += turn(th, th >= 0 ? Math.PI : -Math.PI) * Math.min(1, droop) / n * 1.4;
    th += curl / n;
    x += Math.sin(th) * ds;
    y -= Math.cos(th) * ds;
    pts.push({ x, y });
  }
  return pts;
}

/** One leaf blade. */
export function leaf(K, o, { mat, dark = 0 }) {
  const kind = LEAF[o.kind] ? o.kind : 'oval';
  const P = LEAF[kind];
  const len = Math.max(1.6, o.len);
  const aspect = (o.aspect ?? P.aspect) * (K.leafW ?? 1);
  const rise = K.medium === 'water' ? 0.35 + Math.max(0, -(o.droop ?? 0)) : 0;
  const droop = K.medium === 'water' ? 0 : Math.max(0, (o.droop ?? 0) + K.droop * 0.8);
  if (P.lobes) {
    const n = P.lobes;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const L = len * (1 - Math.abs(t) * 0.55);
      blade(K, P, o.x, o.y, o.th + t * (P.thin ? 2.2 : 1.7), L, aspect, droop, rise, mat, dark, kind, o);
    }
    return;
  }
  blade(K, P, o.x, o.y, o.th, len, aspect, droop, rise, mat, dark, kind, o);
}

function blade(K, P, x, y, th, len, aspect, droop, rise, mat, dark, kind, o) {
  const n = Math.max(3, Math.min(14, Math.round(len / 1.3)));
  const lobes = Math.max(2, Math.round(len / 2.6));
  const line = midline(x, y, th, len, { droop, rise, curl: (o.side || 1) * (o.curl ?? 0), n });
  const W = len * aspect;
  const pts = line.map((p, k) => ({ ...p, w: Math.max(kind === 'needle' || P.thin ? 0.45 : 0.5, W * P.w(k / n, lobes)) }));
  K.c.sweep(pts, mat, {
    dark,
    rib: P.rib && len >= 7 && W >= 1.4,
    ribMat: K.M.rib && len >= 7 ? K.M.rib : 0,
    fold: kind === 'strap' || kind === 'needle' ? 0.12 : 0.2,
    paint: K.leafPaint ? (u, a, px, py) => K.leafPaint(u, a, px, py, o) : null,
    shadow: 0.14,
  });
  if (kind === 'kelp' && len > 5) K.c.disc(x + Math.sin(th) * 0.8, y - Math.cos(th) * 0.8, Math.max(0.7, len * 0.07), K.M.fruit2, { spec: true, shadow: 0 });
}

/** A foliage clump: the unit a tree crown is built from. */
export function clump(K, o, { mat, dark = 0 }) {
  const r = Math.max(1.2, o.r);
  const aspect = o.aspect ?? 0.82;
  K.c.blob(o.x, o.y - r * 0.15, r, r * aspect, mat, {
    dark,
    seed: (o.id + 1) * 7919 + K.seed,
    lumps: r < 3 ? 0.05 : o.rule?.lumps ?? 0.16,
    crown: K.crown,
    mixK: K.crown ? 0.5 : 0,
    shadow: 0.2,
  });
  // a few lit leaf-tips break the clump's top edge, like a hand-placed highlight cluster
  if (r >= 4) {
    const n = Math.round(r / 2);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.25 + 0.6 * hash01(o.id * 13 + i, 41 + K.seed));
      const d = r * (0.45 + 0.4 * hash01(o.id * 17 + i, 43 + K.seed));
      const px = Math.floor(o.x + Math.cos(a) * d);
      const py = Math.floor(o.y - r * 0.15 + Math.sin(a) * d * aspect);
      K.c.dot(px, py, mat, clamp01(0.9 - dark));
    }
  }
}

/** A dense head at the base (cabbage) or a moss ball. */
export function head(K, o, { mat, dark = 0 }) {
  const r = Math.max(1.5, o.r);
  K.c.blob(o.x, o.y - r * 0.8, r * 1.05, r * 0.85, mat, { dark, seed: o.id * 31 + K.seed, lumps: o.kind === 'moss' ? 0.22 : 0.06, shadow: 0.2 });
  if (o.kind === 'cabbage' && r > 3) {
    // the wrapper leaves' veins: two dark arcs
    for (let k = -1; k <= 1; k += 2) {
      for (let t = 0; t < 1; t += 0.12) {
        const px = o.x + k * r * 0.5 * Math.sin(Math.PI * t);
        const py = o.y - r * 0.8 + r * 0.8 * (t - 0.5);
        K.c.dot(px, py, mat, 0.38 - dark);
      }
    }
  }
  if (o.kind === 'moss' && r > 3) {
    for (let i = 0; i < r * 2; i++) {
      const a = hash01(i, 71 + K.seed) * TAU;
      const d = Math.sqrt(hash01(i, 73 + K.seed)) * r * 0.85;
      K.c.dot(o.x + Math.cos(a) * d, o.y - r * 0.8 + Math.sin(a) * d * 0.85, mat, 0.82);
    }
  }
}

/** Flowers. `K.open` 0 shut .. 1 open. */
export function bloom(K, o) {
  const { c, M } = K;
  const open = clamp01(K.open);
  const r = o.r * (0.45 + 0.55 * open);
  const x = o.x;
  const y = o.y;
  const kind = o.kind ?? 'daisy';
  const dark = o.z < 0 ? 0.12 : 0;
  if (r < 1.3 || open < 0.15) {
    // a bud, or a flower too small for petals: a plus of petal and one eye pixel
    c.begin();
    if (r >= 0.9 && open >= 0.15) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.set(Math.floor(x) + dx, Math.floor(y) + dy, M.petal, 0.62 - dark);
      c.set(Math.floor(x), Math.floor(y), kind === 'spike' || kind === 'puff' ? M.petal : M.eye, 0.7);
    } else c.set(Math.floor(x), Math.floor(y), open < 0.15 ? M.leafB : M.petal, 0.6 - dark);
    return;
  }
  switch (kind) {
    case 'cup': {
      // tulip: a cup on the stem's line, petal tips at the rim
      const L = r * 1.7;
      const th = o.th * 0.5;
      const pts = midline(x, y + r * 0.35, th, L, { n: 5 }).map((p, k) => ({ ...p, w: r * 0.72 * Math.sin(Math.PI * (0.18 + 0.62 * (k / 5))) ** 0.35 }));
      c.sweep(pts, M.petal, { dark, fold: 0.22, shadow: 0.12 });
      if (r >= 2.2) {
        const tx = x + Math.sin(th) * L;
        const ty = y + r * 0.35 - Math.cos(th) * L;
        c.dot(tx, ty + 1, M.petal2, 0.45);
      }
      return;
    }
    case 'bell': {
      const L = r * 1.6;
      const pts = midline(x, y, Math.PI * Math.sign(o.side || 1) * 0.9, L, { n: 4 }).map((p, k) => ({ ...p, w: r * (0.3 + 0.6 * (k / 4) ** 1.5) }));
      c.sweep(pts, M.petal, { dark, fold: 0.18, shadow: 0.12 });
      return;
    }
    case 'spike': {
      // lavender, salvia: florets stacked up the tip
      c.begin();
      const L = r * 2.4;
      const n = Math.max(3, Math.round(L / 1.2));
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const px = x + Math.sin(o.th) * L * t + (i % 2 ? 0.6 : -0.6) * (1 - t * 0.5);
        const py = y - Math.cos(o.th) * L * t;
        const rr = Math.max(0.55, r * 0.42 * (1 - t * 0.55));
        c.disc(px, py, rr, i % 3 === 2 ? M.petal2 : M.petal, { dark, own: false });
      }
      c.shadow(0.12);
      return;
    }
    case 'umbel':
    case 'puff': {
      c.begin();
      const n = kind === 'puff' ? 1 : 7;
      if (kind === 'puff') {
        c.disc(x, y - r * 0.6, r * 0.9, M.petal, { dark, own: false });
      } else {
        for (let i = 0; i < n; i++) {
          const a = -Math.PI * (i / (n - 1));
          c.disc(x + Math.cos(a) * r * 0.75, y - r * 0.3 + Math.sin(a) * r * 0.6, Math.max(0.6, r * 0.32), i % 2 ? M.petal2 : M.petal, { dark, own: false });
        }
      }
      c.shadow(0.12);
      return;
    }
    case 'spathe': {
      const pts = midline(x, y, o.th * 0.4, r * 1.8, { n: 4 }).map((p, k) => ({ ...p, w: r * 0.55 * Math.sin(Math.PI * (k / 4)) ** 0.6 + 0.4 }));
      c.sweep(pts, M.petal, { dark, shadow: 0.12 });
      c.chain([{ x: x + 0.3, y: y - r * 0.3, r: 0.5 }, { x: x + 0.3, y: y - r * 1.2, r: 0.5 }], M.eye, {});
      return;
    }
    case 'seedhead': {
      const pts = midline(x, y, o.th, r * 2.2, { n: 4, droop: 0.4 }).map((p, k) => ({ ...p, w: Math.max(0.5, r * 0.42 * Math.sin(Math.PI * Math.min(1, 0.2 + k / 4))) }));
      c.sweep(pts, M.straw ?? M.petal, { dark, fold: 0.1, shadow: 0.1 });
      return;
    }
    case 'tassel': {
      c.begin();
      for (let i = -2; i <= 2; i++) {
        const pts = midline(x, y, o.th + i * 0.35, r * (1.6 - Math.abs(i) * 0.2), { n: 3, droop: 0.4 });
        c.chain(pts.map((p) => ({ ...p, r: 0.5 })), M.straw ?? M.petal, { z: null });
      }
      return;
    }
    default: {
      // daisy, star, composite, rose, blossom: petals round an eye, facing us, tilted with the stem
      const petals = kind === 'composite' ? 14 : kind === 'blossom' ? 5 : kind === 'star' ? 5 : kind === 'rose' ? 0 : 8;
      const eye = kind === 'composite' ? 0.55 : kind === 'rose' ? 0 : kind === 'blossom' ? 0.28 : 0.36;
      const tilt = Math.max(0.55, Math.cos(o.th * 0.9));
      c.begin();
      if (kind === 'rose') {
        c.disc(x, y, r * 0.95, M.petal, { dark, own: false });
        // the swirl: a dark arc inside
        for (let a = 0; a < TAU * 0.9; a += 0.5) {
          const d = r * (0.2 + a / TAU * 0.55);
          c.dot(x + Math.cos(a) * d, y + Math.sin(a) * d * tilt, M.petal, 0.32);
        }
      } else {
        const L = r;
        for (let i = 0; i < petals; i++) {
          const a = (i / petals) * TAU + o.phase * 2;
          const pts = [];
          for (let k = 0; k <= 3; k++) {
            const t = eye * 0.6 + (1 - eye * 0.6) * (k / 3);
            pts.push({ x: x + Math.cos(a) * L * t, y: y + Math.sin(a) * L * t * tilt, r: Math.max(0.5, r * (kind === 'composite' ? 0.18 : 0.3) * Math.sin(Math.PI * (0.25 + 0.6 * k / 3))) });
          }
          for (const p of pts) c.disc(p.x, p.y, p.r, i % 4 === 3 && M.petal2 ? M.petal2 : M.petal, { dark: dark + 0.05 * (i % 2), own: false });
        }
        c.disc(x, y, Math.max(0.6, r * eye), M.eye, { dark, own: false, spec: kind === 'composite' });
        if (kind === 'composite' && r >= 3) {
          for (let i = 0; i < 6; i++) {
            const a = hash01(o.id * 7 + i, 91) * TAU;
            const d = r * eye * 0.6 * Math.sqrt(hash01(o.id * 11 + i, 93));
            c.dot(x + Math.cos(a) * d, y + Math.sin(a) * d, M.eye, 0.25);
          }
        }
      }
      c.shadow(0.14);
    }
  }
}

/** Fruit, pods, ears and heads of grain. */
export function fruit(K, o) {
  const { c, M } = K;
  const r = Math.max(0.6, o.r);
  const x = o.x;
  const y = o.y;
  const dark = o.z < 0 ? 0.12 : 0;
  const kind = o.kind ?? 'berry';
  const hangY = o.hang ? r * 0.9 : 0;
  switch (kind) {
    case 'pod': {
      const pts = midline(x, y, Math.PI * 0.97 * (o.side || 1), r * 2.6, { n: 5 }).map((p, k) => ({ ...p, w: Math.max(0.5, r * 0.38 * Math.sin(Math.PI * Math.min(1, 0.15 + k / 5)) ** 0.4) }));
      c.sweep(pts, M.fruit, { dark, fold: 0.18, shadow: 0.12 });
      return;
    }
    case 'pepper': {
      const pts = midline(x, y + 0.5, Math.PI * 0.92 * (o.side || 1), r * 2.2, { n: 4 }).map((p, k) => ({ ...p, r: Math.max(0.5, r * 0.55 * (1 - (k / 4) ** 1.6)) }));
      c.chain(pts, M.fruit, { dark });
      c.dot(x, y, M.leafB ?? M.leaf, 0.5);
      return;
    }
    case 'gourd': {
      // pumpkin, melon: a wide ribbed sphere resting on the soil
      const gy = Math.min(K.groundY - r * 0.8, y);
      c.begin();
      const rx = r * 1.25;
      const ry = r * 0.88;
      for (let py = Math.floor(gy - ry - 1); py <= Math.ceil(gy + ry); py++) {
        for (let px = Math.floor(x - rx - 1); px <= Math.ceil(x + rx); px++) {
          const dx = (px + 0.5 - x) / rx;
          const dy = (py + 0.5 - gy) / ry;
          const d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          let t = 0.22 + 0.78 * Math.max(0, -0.55 * dx - 0.62 * dy + 0.56 * nz) / Math.hypot(0.55, 0.62, 0.56);
          if (r >= 3 && Math.abs(Math.sin(Math.asin(Math.max(-1, Math.min(1, dx))) * 2.5)) < 0.18) t -= 0.18;
          c.set(px, py, M.fruit, clamp01(t - dark));
        }
      }
      c.shadow(0.18);
      c.chain([{ x: x + 0.2, y: gy - ry + 0.5, r: Math.max(0.5, r * 0.14) }, { x: x + r * 0.25, y: gy - ry - r * 0.35, r: 0.5 }], M.wood ?? M.stem, {});
      return;
    }
    case 'strawberry': {
      const pts = midline(x, y, Math.PI, r * 1.6, { n: 4 }).map((p, k) => ({ ...p, w: Math.max(0.5, r * 0.75 * Math.sin(Math.PI * (0.3 + 0.7 * k / 4)) ** 0.7) }));
      c.sweep(pts, M.fruit, { dark, fold: 0.18, shadow: 0.12, paint: (u, a, px, py) => ((px * 3 + py * 5) % 7 === 0 && u > 0.2 && u < 0.8 ? M.fruit2 : 0) });
      c.dot(x, y, M.leaf, 0.6);
      return;
    }
    case 'ear': {
      // corn: a cob in its husk, angled off the stalk
      const th = o.th * 0.6;
      const L = r * 2.4;
      const cob = midline(x, y, th, L, { n: 4 }).map((p, k) => ({ ...p, w: Math.max(0.6, r * 0.5 * Math.sin(Math.PI * Math.min(1, 0.12 + k / 4)) ** 0.5) }));
      c.sweep(cob, M.fruit, { dark, fold: 0.2, shadow: 0.12 });
      const husk = midline(x, y, th + 0.15, L * 0.8, { n: 3 }).map((p, k) => ({ ...p, w: Math.max(0.5, r * 0.32 * (1 - k / 3)) }));
      c.sweep(husk, M.leafB ?? M.leaf, { dark, fold: 0.1, shadow: 0 });
      return;
    }
    case 'wheat': {
      // a head of grain: spikelets alternating up the tip, with awns
      c.begin();
      const L = r * 2.5;
      const n = Math.max(3, Math.round(L / 1.1));
      const pts = midline(x, y, o.th, L, { n, droop: 0.35 + K.droop * 0.5 });
      for (let i = 1; i <= n; i++) {
        const p = pts[i];
        const s = i % 2 ? 1 : -1;
        const k = Math.max(0.5, r * 0.36 * (1 - (i / n) * 0.4));
        c.disc(p.x + s * 0.45, p.y, k, M.fruit, { dark: dark + (s > 0 ? 0 : 0.08), own: false });
      }
      if (r >= 1.8) {
        const tip = pts[n];
        c.dot(tip.x, tip.y - 1, M.fruit, 0.85);
      }
      c.shadow(0.12);
      return;
    }
    case 'cone': {
      const pts = midline(x, y, Math.PI, r * 1.6, { n: 3 }).map((p, k) => ({ ...p, r: Math.max(0.5, r * 0.5 * Math.sin(Math.PI * (0.3 + 0.6 * k / 3))) }));
      c.chain(pts, M.wood ?? M.bark, { dark, tex: (s, u, px, py) => ((px + py) % 2 ? -0.12 : 0) });
      return;
    }
    case 'coconut': {
      c.begin();
      for (const [dx, dy] of [[-0.7, 0.3], [0.6, 0.4], [0, 0.9]]) c.disc(x + dx * r, y + dy * r, r * 0.62, M.fruit, { dark, own: false, spec: true });
      c.shadow(0.14);
      return;
    }
    case 'tuna': {
      c.disc(x, y - r * 0.6, r * 0.75, M.fruit, { dark, spec: true });
      return;
    }
    case 'pome':
    case 'citrus':
    case 'tomato':
    case 'berry':
    default: {
      const cy = y + hangY;
      if (o.hang && r >= 1.5) c.chain([{ x, y, r: 0.5 }, { x, y: cy - r * 0.7, r: 0.5 }], M.stem, { z: null });
      c.disc(x, cy, r, M.fruit, { dark, spec: kind !== 'berry' || r >= 1.6 });
      if ((kind === 'pome' || kind === 'tomato') && r >= 2) c.dot(x + (kind === 'pome' ? 0.6 : 0), cy - r + 0.2, kind === 'pome' ? M.wood ?? M.stem : M.leaf, 0.5);
    }
  }
}

/** The part of a root crop that shows: a shoulder above the soil (the lip hides the rest). */
export function root(K, o) {
  const { c, M } = K;
  const r = Math.max(1, o.r);
  const x = o.x;
  const gy = K.groundY;
  switch (o.kind) {
    case 'carrot':
    case 'parsnip': {
      const pts = [{ x, y: gy - r * 0.55, r: r * 0.7 }, { x, y: gy + r * 0.8, r: r * 0.55 }, { x, y: gy + r * 2.4, r: 0.5 }];
      c.chain(pts, M.root, {});
      return;
    }
    case 'onion':
    case 'garlic': {
      c.disc(x, gy - r * 0.45, r * 0.9, M.root, { spec: true });
      c.chain([{ x, y: gy - r * 1.2, r: r * 0.35 }, { x, y: gy - r * 1.9, r: r * 0.22 }], M.root, {});
      return;
    }
    default: {
      // radish, beet, turnip: a round shoulder half out of the soil
      c.disc(x, gy - r * 0.2, r, M.root, { spec: true });
    }
  }
}

/** A mushroom cap on its stipe. */
export function cap(K, o) {
  const { c, M } = K;
  const r = Math.max(1.5, o.r);
  const kind = o.kind ?? 'dome';
  const x = o.x;
  const y = o.y + r * 0.15;
  c.begin();
  const ry = kind === 'flat' ? r * 0.38 : kind === 'cone' ? r * 0.95 : r * 0.68;
  for (let py = Math.floor(y - ry - 1); py <= Math.ceil(y + 1); py++) {
    for (let px = Math.floor(x - r - 1); px <= Math.ceil(x + r + 1); px++) {
      const dx = (px + 0.5 - x) / r;
      const dy = (py + 0.5 - y) / ry;
      let inside;
      if (kind === 'cone') inside = dy <= 0.3 && dy >= -1 && Math.abs(dx) <= (dy + 1) * 0.72 + 0.12;
      else inside = dy <= 0.25 && dx * dx + dy * dy <= 1;
      if (!inside) continue;
      const nz = Math.sqrt(Math.max(0, 1 - dx * dx - Math.min(1, dy * dy)));
      let t = 0.22 + 0.78 * Math.max(0, -0.55 * dx - 0.62 * dy + 0.56 * nz) / Math.hypot(0.55, 0.62, 0.56);
      if (dy > 0.05) t *= 0.55; // the gill rim in shadow
      const spot = M.capSpot && r >= 2.5 && hash01(Math.floor(px * 0.6) * 37 + Math.floor(py * 0.6) * 101, 7 + o.id) < 0.13 && dy < -0.2;
      c.set(px, py, spot ? M.capSpot : M.cap, clamp01(spot ? 0.85 : t));
    }
  }
  c.shadow(0.16);
}

/** Small round extras: kelp floats, coral polyps, sea-grape beads, glow bulbs. */
export function bead(K, o) {
  const { c, M } = K;
  const r = Math.max(0.5, o.r);
  const mat = o.type === 'glow' ? M.glow : o.type === 'polyp' ? M.petal : o.type === 'float' ? M.fruit2 : M.leafB ?? M.leaf;
  if (r < 0.9) {
    c.begin();
    c.set(Math.floor(o.x), Math.floor(o.y), mat, o.type === 'glow' ? 0.5 + 0.5 * K.glow : 0.7);
    return;
  }
  c.disc(o.x, o.y, r, mat, { spec: true, dark: o.type === 'glow' ? 0.3 * (1 - K.glow) : o.z < 0 ? 0.12 : 0 });
}

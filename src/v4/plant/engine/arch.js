// The architecture engine: a form's growth rules → the plant's topology. No pixels, no pose.
//
// A plant is a tree of AXES (a trunk, a branch, a twig, a tiller, a kelp stipe, a frond rachis).
// Each axis has an ORDER (0 = from the ground). A form gives one rule per order: how long, how
// thick, how it bends (gravitropism, curl, twine), and how it makes children (phyllotaxis,
// where along it, how many, at what angle, and how their length changes with height — the
// "profile" that makes a cone of a spruce and a dome of an oak). That is enough to describe a
// lettuce (one order of short petioles with a leaf each), wheat (tillers ending in an ear), an
// oak (three orders, clumps on the last), a weeping willow (the last order hangs), a sea fan
// (forks four times in a plane) and kelp (one long buoyant stipe hung with blades and floats).
// Botany calls these architectural models (Hallé–Oldeman); here they are data in forms.js.
//
// ORGANS hang on axes: leaves, foliage clumps, blooms, fruit, floats, polyps, caps, ears, heads,
// roots. Every axis and organ has a BIRTH and a DUR on one growth clock (0 seed .. 1 grown), so
// drawing at growth t is the same plant, younger — never a different drawing.
//
// Lengths are in plant units (the first trunk or tiller is about 1 long); pose.js scales them to
// pixels so the grown plant fills its size class.

import { roller } from '../../../pixel/rng.js';

const GOLDEN = 2.399963229728653;

/** How a child's length changes with where it sits on its parent (u 0 base .. 1 tip). */
export const PROFILES = {
  flat: () => 1,
  cone: (u) => 1.25 - 0.95 * u, // long at the bottom: spruce, fir
  dome: (u) => 0.45 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.1)), // round crown: oak, apple
  vase: (u) => 0.45 + 0.75 * u, // long at the top: elm, umbrella
  taper: (u) => 1 - 0.55 * u, // shorter toward the tip: herbs, fronds
  even: (u) => 0.85 + 0.3 * Math.sin(Math.PI * u),
};

/**
 * Grow the topology. `form` is a resolved form (forms.js after genome mods), `seed` the drawing's
 * jitter key. Returns { axes, organs, form }.
 */
export function grow(form, seed) {
  const roll = roller(seed, 6400);
  let salt = 1;
  const r01 = () => roll.r(salt++);
  const rr = (a, b) => a + (b - a) * r01();
  const ri = (a, b) => a + Math.floor(r01() * (b - a + 1));

  const axes = [];
  const organs = [];
  const rules = form.axes;

  const addAxis = (o, parent, u, side, z, angle, lenMul, birth) => {
    const R = rules[o];
    const len = (o === 0 ? R.len : parent.len * R.len) * lenMul * (1 + (R.lenVar ?? 0.12) * (r01() * 2 - 1));
    const r = o === 0 ? R.r : parent.r * (1 - (1 - parent.taper) * u) * R.r;
    const segs = Math.max(2, R.segs ?? 5);
    const wig = Array.from({ length: segs }, () => (r01() * 2 - 1) * (R.wiggle ?? 0));
    const ax = {
      id: axes.length,
      order: o,
      parent: parent ? parent.id : -1,
      u,
      side,
      z,
      angle,
      len,
      r,
      taper: R.taper ?? 0.5,
      segs,
      gravi: R.gravi ?? 0,
      curl: R.curl ?? 0,
      twine: R.twine ?? 0,
      wig,
      style: R.style ?? 'stem',
      tex: R.tex ?? null,
      mat: R.mat ?? (o === 0 ? form.trunkMat ?? 'stem' : 'stem'),
      stiff: R.stiff ?? 1,
      birth,
      dur: (form.grow?.[o] ?? (o === 0 ? 0.5 : 0.36)) * rr(0.85, 1.1),
      phase: r01(),
      kids: [],
      ground: R.ground ?? false,
      up: R.up ?? false,
      hang: R.hang ?? false,
      w: R.w ?? null,
      wProf: R.wProf ?? null,
      fold: R.fold ?? null,
      layer: R.layer ?? null,
    };
    axes.push(ax);
    if (parent) parent.kids.push(ax.id);
    return ax;
  };

  // order 0: from the ground (one trunk, or a fan of tillers / petioles / stipes)
  const B = form.base ?? {};
  const n0 = ri(B.n?.[0] ?? 1, B.n?.[1] ?? B.n?.[0] ?? 1);
  const fan = B.fan ?? 0;
  for (let i = 0; i < n0; i++) {
    const t = n0 === 1 ? 0 : i / (n0 - 1) - 0.5;
    const ang = (form.lean ?? 0) + t * 2 * fan + rr(-1, 1) * (B.angleVar ?? 0.06);
    // the outer tillers of a rosette are shorter and sit in front or behind
    const edge = Math.abs(t) * 2;
    const lenMul = 1 - (B.lenVar ?? 0) * edge * rr(0.6, 1);
    const z = B.depth && n0 > 2 ? (i % 3 === 1 ? -1 : i % 3 === 2 && edge < 0.8 ? 1 : 0) : 0;
    const ax = addAxis(0, null, 0, Math.sign(t) || 1, z, ang, lenMul, (B.stagger ?? 0.04) * i * r01());
    ax.x0 = (B.x0 ?? 0) + t * 2 * (B.spread ?? 0) + rr(-1, 1) * (B.jitter ?? 0);
  }

  // children, breadth first so parents always come before their kids
  for (let k = 0; k < axes.length; k++) {
    const p = axes[k];
    const R = rules[p.order];
    const K = R.kids;
    if (!K || !rules[p.order + 1]) continue;
    const prof = PROFILES[K.profile ?? 'flat'] ?? PROFILES.flat;
    const place = (u, side, z, extraAngle = 0) => {
      if (K.p != null && r01() > K.p) return;
      const ang = side * ((K.angle ?? 0.7) + rr(-1, 1) * (K.angleVar ?? 0.15)) + extraAngle;
      const birth = p.birth + p.dur * u * 0.85;
      addAxis(p.order + 1, p, u, side, z, ang, prof(u), birth);
    };
    if (K.phyllo === 'fork') {
      const n = K.n ?? 2;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const side = t === 0 ? (r01() < 0.5 ? -1 : 1) : Math.sign(t);
        const spreadA = (K.angle ?? 0.5) * (n === 1 ? 0 : 2 * Math.abs(t)) + rr(-1, 1) * (K.angleVar ?? 0.1);
        if (K.p != null && r01() > K.p) continue;
        addAxis(p.order + 1, p, 1, side, 0, side * spreadA, 1, p.birth + p.dur * 0.95);
      }
      continue;
    }
    const nodes = Math.max(0, Math.round((K.n ?? 3) * rr(0.8, 1.2)));
    const from = K.from ?? 0.3;
    const to = K.to ?? 1;
    let side = r01() < 0.5 ? -1 : 1;
    for (let i = 0; i < nodes; i++) {
      const u = Math.min(0.98, from + (to - from) * (nodes === 1 ? 0.5 : i / (nodes - 1)) + rr(-1, 1) * 0.03);
      const depth = K.depth ?? 0;
      switch (K.phyllo ?? 'alt') {
        case 'opp':
          place(u, -1, 0);
          place(u, 1, 0);
          break;
        case 'whorl':
          place(u, -1, 0);
          place(u, 1, 0);
          if (depth) place(u, i % 2 ? 1 : -1, i % 2 ? -1 : 1, 0);
          break;
        case 'spiral': {
          const a = GOLDEN * i + p.phase * 6;
          const s = Math.cos(a) >= 0 ? 1 : -1;
          const z = depth && Math.abs(Math.sin(a)) > 0.8 ? (Math.sin(a) > 0 ? 1 : -1) : 0;
          place(u, s, z);
          break;
        }
        default: {
          const z = depth && r01() < depth ? (r01() < 0.55 ? -1 : 1) : 0;
          place(u, side, z);
          side = -side;
        }
      }
    }
  }

  // organs
  for (const rule of form.organs ?? []) placeOrgans(rule, axes, organs, form, { r01, rr, ri });

  // one growth clock: everything vegetative is grown by ~0.82, blooms and fruit come after
  let end = 0;
  for (const a of axes) end = Math.max(end, a.birth + a.dur);
  for (const o of organs) if (!o.late) end = Math.max(end, o.birth + o.dur);
  const k = end > 0 ? 0.8 / end : 1;
  for (const a of axes) {
    a.birth *= k;
    a.dur *= k;
  }
  for (const o of organs) {
    if (o.late) continue;
    o.birth *= k;
    o.dur *= k;
  }
  return { axes, organs, form };
}

/** The axes a rule applies to: one order, a list of orders, or the last order there is. */
function targets(rule, axes) {
  if (rule.order === 'last') {
    return axes.filter((a) => !a.kids.length);
  }
  const orders = Array.isArray(rule.order) ? rule.order : [rule.order ?? 0];
  return axes.filter((a) => orders.includes(a.order));
}

function placeOrgans(rule, axes, organs, form, { r01, rr }) {
  const add = (o) => {
    const late = o.type === 'bloom' || o.type === 'fruit' || o.type === 'ear' || o.type === 'grain' || o.type === 'tassel';
    organs.push({
      id: organs.length,
      side: 1,
      z: 0,
      angle: 0,
      phase: r01(),
      late,
      ...o,
    });
  };
  const sizeOf = () => (rule.size ?? 0.1) * (1 + (rule.sizeVar ?? 0.15) * (r01() * 2 - 1));
  const lateBirth = () => {
    if (rule.type === 'fruit' || rule.type === 'ear' || rule.type === 'grain') return (form.fruitAt ?? 0.88) + rr(-0.03, 0.03);
    return (form.bloomAt ?? 0.8) + rr(-0.04, 0.04);
  };

  // fruit and blossom studded over the foliage clumps (an apple tree, a blueberry bush)
  if (rule.at === 'clumps') {
    for (const c of organs.filter((o) => o.type === 'clump')) {
      if (rule.p != null && r01() > rule.p) continue;
      const n = Math.max(1, Math.round((rule.n ?? 1) * rr(0.6, 1.4)));
      for (let i = 0; i < n; i++) {
        const a = rr(0, Math.PI * 2);
        const rad = Math.sqrt(r01()) * (rule.reach ?? 0.72);
        add({
          type: rule.type, kind: rule.kind, axis: c.axis, u: c.u, host: c.id, z: c.z,
          dx: Math.cos(a) * rad, dy: Math.sin(a) * rad * 0.85 + (rule.lower ?? 0.12),
          size: sizeOf(), hang: rule.hang ?? false, birth: lateBirth(), dur: 0.1, rule,
        });
      }
    }
    return;
  }

  if (rule.at === 'base') {
    const n = rule.n ?? 1;
    for (let i = 0; i < n; i++) {
      add({ type: rule.type, kind: rule.kind, axis: -1, u: 0, size: sizeOf(), w: rule.w, x: (n === 1 ? 0 : (i / (n - 1) - 0.5)) * (rule.spread ?? 0), y: rule.y ?? 0, z: rule.z ?? 0, birth: rule.birth ?? 0.15, dur: rule.dur ?? 0.6, rule });
    }
    return;
  }

  for (const ax of targets(rule, axes)) {
    if (rule.at === 'tip') {
      if (rule.p != null && r01() > rule.p) continue;
      const late = ['bloom', 'fruit', 'ear', 'grain', 'tassel'].includes(rule.type);
      add({
        type: rule.type, kind: rule.kind, axis: ax.id, u: 1, side: ax.side, z: ax.z,
        angle: rule.angle ?? 0, size: sizeOf(), w: rule.w, droop: rule.droop ?? 0, aspect: rule.aspect,
        birth: late ? lateBirth() : ax.birth + ax.dur * 0.9, dur: late ? 0.1 : rule.dur ?? 0.2, rule,
      });
      continue;
    }
    // nodes along the axis
    const n = Math.max(0, Math.round((rule.n ?? 3) * rr(0.8, 1.2)));
    const from = rule.from ?? 0.2;
    const to = rule.to ?? 1;
    let side = ax.side || 1;
    for (let i = 0; i < n; i++) {
      const u = from + (to - from) * (n === 1 ? 0.5 : i / (n - 1)) + rr(-1, 1) * 0.02;
      const phyllo = rule.phyllo ?? 'alt';
      const sides = phyllo === 'opp' || phyllo === 'whorl' ? [-1, 1] : [side];
      if (phyllo !== 'opp' && phyllo !== 'whorl') side = -side;
      for (const s of sides) {
        if (rule.p != null && r01() > rule.p) continue;
        const late = ['bloom', 'fruit', 'ear', 'grain', 'tassel'].includes(rule.type);
        let z = rule.depth && r01() < rule.depth ? (r01() < 0.5 ? -1 : 1) : ax.z;
        add({
          type: rule.type, kind: rule.kind, axis: ax.id, u: Math.min(1, Math.max(0, u)), side: s, z,
          angle: s * ((rule.angle ?? 0.9) + rr(-1, 1) * (rule.angleVar ?? 0.12)),
          size: sizeOf() * (rule.shrink ? 1 - rule.shrink * u : 1), w: rule.w, droop: rule.droop ?? 0, aspect: rule.aspect,
          hang: rule.hang ?? false,
          birth: late ? lateBirth() : ax.birth + ax.dur * u, dur: late ? 0.1 : rule.dur ?? 0.14, rule,
        });
      }
      if (phyllo === 'whorl' && rule.depth) {
        const s = i % 2 ? 1 : -1;
        add({
          type: rule.type, kind: rule.kind, axis: ax.id, u, side: s, z: i % 2 ? -1 : 1,
          angle: s * (rule.angle ?? 0.9) * 0.35, size: sizeOf() * 0.8, w: rule.w, droop: rule.droop ?? 0,
          birth: ax.birth + ax.dur * u, dur: rule.dur ?? 0.14, rule,
        });
      }
    }
  }
}

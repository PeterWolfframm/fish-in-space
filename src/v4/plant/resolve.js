// Genome → drawable plant: the form's rules bent by the shape genes, its organs swapped for the
// chosen kinds, its colours turned into materials, and the window it is drawn in. Cached per
// genome code, because every frame of every anim shares all of it.

import { FORMS } from './forms.js';
import { grow } from './engine/arch.js';
import { fitScale } from './engine/draw.js';
import { buildMaterials, STEPS } from './engine/materials.js';
import { hexOf, BEDS } from './palettes.js';
import { hash01 } from '../../pixel/rng.js';

export const CLASS_H = { herb: 16, shrub: 32, tall: 48, tree: 64, giant: 96 };

/** Bell steps m3..p3 → −3..3. */
export const stepOf = (v) => (typeof v === 'string' && /^[mp]\d$/.test(v) ? (v[0] === 'm' ? -1 : 1) * Number(v[1]) : v === 'z0' ? 0 : 0);

const BLOOM_KEEP = new Set(['seedhead', 'tassel', 'spathe']);
const FRUIT_KEEP = new Set(['gourd', 'coconut', 'tuna', 'cone']);

/** The form, as this genome grows it. */
export function resolveForm(g) {
  const base = FORMS[g.form] ?? FORMS.lettuce;
  const f = structuredClone({ ...base, id: g.form });
  const h = stepOf(g.height);
  const s = stepOf(g.spread);
  const b = stepOf(g.branching);
  const l = stepOf(g.leafSize);
  const d = stepOf(g.density);
  const t = stepOf(g.thickness);
  const dr = stepOf(g.droop);
  const a = stepOf(g.asym);

  f.heightK = (f.heightK ?? 1) * (1 + 0.05 * h);
  f.lean = (f.lean ?? 0) + a * 0.06;
  if (f.base?.n) {
    const k = 1 + 0.13 * b;
    f.base.n = f.base.n.map((n) => (n <= 1 ? n : Math.max(1, Math.round(n * k))));
  }
  if (f.base?.fan != null) f.base.fan *= 1 + 0.1 * s;
  f.axes = f.axes.map((R, o) => {
    const r = { ...R };
    if (o === 0) r.len *= 1 + 0.1 * h;
    else r.len *= 1 + 0.07 * s;
    r.r *= 1 + 0.12 * t;
    if (r.w != null) r.w *= 1 + 0.1 * l;
    if (o === f.axes.length - 1 && o > 0) r.gravi = (r.gravi ?? 0) - 0.18 * dr;
    if (r.kids) {
      r.kids = { ...r.kids };
      if (r.kids.phyllo !== 'fork') r.kids.n = Math.max(1, (r.kids.n ?? 3) + Math.round(b * 0.6));
      r.kids.angle = (r.kids.angle ?? 0.7) * (1 + 0.1 * s);
    }
    return r;
  });
  const bloomKind = g.bloom && g.bloom !== 'auto' ? g.bloom : null;
  const fruitKind = g.fruit && g.fruit !== 'auto' ? g.fruit : null;
  const leafKind = g.leaf && g.leaf !== 'auto' ? g.leaf : null;
  f.organs = (f.organs ?? [])
    .filter((o) => !(o.type === 'bloom' && bloomKind === 'none' && !BLOOM_KEEP.has(o.kind)))
    .filter((o) => !(o.type === 'fruit' && fruitKind === 'none' && !FRUIT_KEEP.has(o.kind)))
    .map((R) => {
      const o = { ...R };
      if (o.type === 'leaf') {
        o.size *= 1 + 0.1 * l;
        o.droop = (o.droop ?? 0) + (f.medium === 'water' ? -0.05 : 0.12) * dr;
        if (leafKind && o.kind !== 'needle' && o.kind !== 'strap' && o.kind !== 'kelp') o.kind = leafKind;
      }
      if (o.type === 'clump') o.size *= 1 + 0.08 * l + 0.04 * d;
      if (o.n != null && o.type !== 'ear') o.n = Math.max(1, Math.round(o.n * (1 + 0.15 * d)));
      if (o.type === 'bloom' && bloomKind && bloomKind !== 'none' && !BLOOM_KEEP.has(o.kind)) o.kind = bloomKind;
      if (o.type === 'fruit' && fruitKind && fruitKind !== 'none' && !FRUIT_KEEP.has(o.kind)) o.kind = fruitKind;
      return o;
    });
  return f;
}

/** Variegation, painted onto leaves (u along, a across −1..1). */
const PAINT = {
  edge: (u, a) => (Math.abs(a) > 0.58 ? 'tip' : null),
  stripe: (u, a) => (Math.abs(a) < 0.3 && u > 0.05 ? 'tip' : null),
  spots: (u, a, x, y) => (hash01(x * 7 + y * 131, 77) < 0.13 ? 'tip' : null),
  veins: (u, a) => ((u * 6 + Math.abs(a) * 1.5) % 1 < 0.16 && Math.abs(a) > 0.2 ? 'leafB' : null),
  tipTint: (u) => (u > 0.64 ? 'tip' : null),
  blush: (u, a) => (u > 0.8 || (u > 0.55 && Math.abs(a) > 0.7) ? 'tip' : null),
};

const LOOKS = {
  clean: { outline: 'sel' },
  bold: { outline: 'dark', ink: '#1c1622' },
  soft: { outline: 'none', dither: 0.55 },
};

const MEMO = new Map();
const MEMO_MAX = 600;

/**
 * Everything a frame needs, built once per genome: topology, scale, canvas, materials.
 * `g` is a normalised genome; `key` its code.
 */
export function resolve(g, key) {
  const hit = MEMO.get(key);
  if (hit) return hit;
  const form = resolveForm(g);
  const size = CLASS_H[g.size] ? g.size : 'shrub';
  const H = Math.max(8, Math.round(CLASS_H[size] * 0.84 * (form.heightK ?? 1)));
  const topo = grow(form, `${g.form}:${g.sprout}:${g.twist ?? 't0'}`);
  const fit = fitScale(topo, H, form.maxW ?? 1.6);
  form.heightU = fit.heightU;
  const scale = fit.scale;

  const bedId = g.bed && g.bed !== 'auto' ? g.bed : form.colors?.bed?.[0] ?? 'soil';
  const bed = bedId === 'none' ? null : bedId;
  // the bed spans the plant's footprint: its order-0 bases and its base organs
  let span = 0;
  for (const ax of topo.axes) if (ax.order === 0) span = Math.max(span, Math.abs((ax.x0 ?? 0) - fit.offX) * scale + ax.r * scale * 2);
  for (const o of topo.organs) if (o.axis < 0) span = Math.max(span, Math.abs((o.x ?? 0) - fit.offX) * scale + o.size * scale);
  const bedHalf = Math.round(Math.max(3, Math.min(H * (bed === 'pot' ? 0.36 : 0.7), span + Math.max(2, H * 0.1))));
  const potH = bed === 'pot' ? Math.max(4, Math.round(bedHalf * 0.9)) + 2 : 4;

  const w = Math.ceil(H * ((form.maxW ?? 1.6) + 1)) + 24;
  const h = Math.ceil(H * 1.45) + 16 + potH;
  const origin = { x: Math.round(w / 2 - fit.offX * scale), y: h - potH - 2 };

  const colors = {
    leaf: hexOf('leaf', g.leafColor),
    tip: hexOf('tip', g.tipColor),
    bark: hexOf('bark', g.barkColor),
    petal: hexOf('petal', g.petalColor),
    eye: hexOf('eye', g.eyeColor),
    fruit: hexOf('fruit', g.fruitColor),
    fruit2: form.id === 'kelp' ? hexOf('leaf', 'goldkelp') : form.id === 'strawberry' ? '#f2dc6a' : undefined,
    root: hexOf('root', g.rootColor),
    coral: hexOf('coral', g.coralColor),
    autumn: hexOf('autumn', g.autumnColor),
    glow: hexOf('glow', g.glowColor),
    cap: hexOf('fruit', g.fruitColor),
    bed: bed ? BEDS[bed] : null,
  };
  const { mats, M } = buildMaterials(colors, STEPS[size] ?? 5);
  const look = { ...(LOOKS[g.look] ?? LOOKS.clean) };
  if (form.glow || g.glow === 'on') {
    look.halo = colors.glow;
    look.haloAlpha = 60;
  }
  const paintId = g.variegation && g.variegation !== 'none' ? g.variegation : form.paint ?? null;
  const paint = PAINT[paintId] ?? null;
  const leafPaint = paint ? (u, a, x, y, o, matOf) => {
    const m = paint(u, a, x, y);
    return m ? matOf(m) : 0;
  } : null;
  const out = {
    g, form, topo, size, H, scale, w, h, origin, mats, M, look, bed, bedHalf,
    prop: form.prop ?? null,
    propSide: form.prop === 'pole' ? 0 : 1,
    seed: Math.floor(hash01(key, 3) * 997),
    tipFrom: form.tipFrom ?? null,
    spines: form.spines ?? false,
    leafPaint,
    ribbonPaint: paintId === 'stripe' || paintId === 'edge' || paintId === 'tipTint' ? leafPaint : null,
    anchorX: Math.round(w / 2),
  };
  if (MEMO.size >= MEMO_MAX) MEMO.delete(MEMO.keys().next().value);
  MEMO.set(key, out);
  return out;
}

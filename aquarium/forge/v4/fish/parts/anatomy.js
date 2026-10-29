// Anatomy parts: the pieces fish4's own bodies have and fish3's do not. A body record lists its
// anatomy (bodies/*.js `anatomy: [...]`); each part here paints only on a fish whose body lists
// it, so a fish3 fish never sees them and its frame stays fish3's.
//
// Emissive parts (carapace cracks, seams, cores, half-life bands) pulse with `pose.glow`; the
// ambient particles (embers, sand plumes, decay sparkles) move with `pose.wave`, which lands on a
// whole turn at the end of every anim, so they loop. Particles are painted with `g.under`: they
// never cover the fish, and they stay close to it so the frame window barely grows.
//
// Append only: an anatomy part's id is what body records and text keys name.

import { hash01 } from '../../../pixel/rng.js';
import { mix, hexFrom } from '../../../pixel/color.js';
import { INK, HIGHLIGHT } from '../../../v3/fish/colors.js';
import { BODY_RECORDS } from '../bodies/index.js';

const TAU = Math.PI * 2;
const frac = (v) => v - Math.floor(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The emissive colours per terrain: [cool, hot]. */
const GLOW = {
  lava: ['#6e1a0c', '#ffc35a'],
  nuclear: ['#2a6fd0', '#b4ffe0'],
  sand: ['#8a5a2a', '#f6dca0'],
  water: ['#2a6fd0', '#d8f6ff'],
};

const anatomyOf = (ctx) => (ctx.v4?.form && ctx.v4.form !== 'fish3' ? BODY_RECORDS[ctx.v4.form]?.anatomy ?? [] : []);
const terrainOf = (ctx) => BODY_RECORDS[ctx.v4?.form]?.terrain ?? 'water';
const glowLevel = (ctx) => clamp(ctx.pose.glow ?? 0.5, 0, 1);
const glowHex = (ctx, k) => {
  const [lo, hi] = GLOW[terrainOf(ctx)] ?? GLOW.water;
  return mix(lo, hi, clamp(k, 0, 1));
};

/** The colour already painted at (x, y), or null. */
function painted(g, x, y) {
  const i = g.get(x, y);
  if (!i) return null;
  const [r, gg, b, a] = g.palette[i];
  return { hex: hexFrom([r, gg, b]), a };
}

/** Tint what is painted at (x, y) toward `hex` by `k` (nothing painted: nothing happens). */
function tint(g, x, y, hex, k) {
  const u = painted(g, x, y);
  if (u) g.px(x, y, g.color(mix(u.hex, hex, clamp(k, 0, 1)), u.a));
}

/** Body pixels with body on all four sides: where plates and seams go, never on the outline. */
const interior = (ctx, x, y) => ctx.onBody(x, y) && ctx.onBody(x - 1, y) && ctx.onBody(x + 1, y) && ctx.onBody(x, y - 1) && ctx.onBody(x, y + 1);

/** Every body column between two t values. */
const colsBetween = (ctx, t0, t1) => ctx.bodyCols.filter((c) => c.t >= t0 && c.t <= t1);

// ---------- emissive and armour --------------------------------------------------------------

/** Lava plates: a staggered crack lattice over the trunk whose cracks glow with `pose.glow`. */
function carapace(ctx) {
  const { g, ph, s, pose, edges } = ctx;
  const w = Math.max(3, Math.round(3.2 * s));
  const h = Math.max(2, Math.round(2.6 * s));
  const glow = glowLevel(ctx);
  for (const c of colsBetween(ctx, 0.12, ph.eyeT - 0.08)) {
    const { yb, yv } = edges(c);
    for (let y = yb + 1; y < yv; y++) {
      if (!interior(ctx, c.x, y)) continue;
      const ry = y - Math.round(c.mid) + 64;
      const row = Math.floor(ry / h);
      const off = row % 2 ? Math.floor(w / 2) : 0;
      const crack = (c.x + off) % w === 0 || ry % h === 0;
      if (!crack || hash01(`${c.x},${ry}`, 9101) < 0.22) continue;
      // The heat runs down the cracks from head to tail.
      const pulse = 0.5 + 0.5 * Math.cos(TAU * (c.t * 1.5 - (pose.wave ?? 0)));
      g.px(c.x, y, g.color(glowHex(ctx, glow * (0.55 + 0.45 * pulse))));
    }
  }
}

/** An emissive lateral line from the tail joint to behind the gill. */
function seam(ctx) {
  const { g, ph, s, pose } = ctx;
  const glow = glowLevel(ctx);
  const thick = s >= 2 ? 2 : 1;
  for (const c of colsBetween(ctx, 0.06, ph.eyeT - 0.12)) {
    if (c.back + c.belly < 3) continue;
    const y = Math.round(c.mid - c.back * 0.12);
    const pulse = 0.5 + 0.5 * Math.cos(TAU * (c.t * 2.5 - (pose.wave ?? 0)));
    const col = g.color(glowHex(ctx, 0.35 + 0.65 * pulse * (0.4 + 0.6 * glow)));
    for (let k = 0; k < thick; k++) if (interior(ctx, c.x, y + k)) g.px(c.x, y + k, col);
  }
}

/** A light inside the belly, seen through the skin: brightest at the centre, breathing with glow. */
function core(ctx) {
  const { g, ph, s, colT } = ctx;
  const c = colT(0.5);
  if (!c) return;
  const cy = c.mid + c.belly * 0.3;
  const rx = Math.max(1.5, ph.L * 0.15);
  const ry = Math.max(1.2, c.belly * 0.5);
  const glow = glowLevel(ctx);
  const hot = glowHex(ctx, 1);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(c.x - rx); x <= Math.ceil(c.x + rx); x++) {
      const d = Math.hypot((x + 0.5 - c.x) / rx, (y + 0.5 - cy) / ry);
      if (d > 1 || !interior(ctx, x, y)) continue;
      tint(g, x, y, hot, (1 - d) * (0.3 + 0.5 * glow));
    }
  }
  const bright = g.color(mix(hot, '#ffffff', 0.5));
  g.px(Math.round(c.x), Math.round(cy), bright);
  if (s >= 1.5) g.px(Math.round(c.x) + 1, Math.round(cy), bright);
}

/** Half-life tail: the rear of the body in bands, each half as bright as the one before. */
function halfLife(ctx) {
  const { g, pose } = ctx;
  const glow = glowLevel(ctx);
  const span = 0.09;
  const shift = Math.floor(frac(pose.wave ?? 0) * 5);
  for (const c of colsBetween(ctx, 0.02, 0.47)) {
    const band = Math.floor((0.47 - c.t) / span);
    const lead = (band - shift + 5) % 5;
    const { yb, yv } = ctx.edges(c);
    const edge = Math.abs(((0.47 - c.t) % span) - span) < 0.012;
    for (let y = yb + 1; y < yv; y++) {
      if (!ctx.onBody(c.x, y)) continue;
      if (edge) g.px(c.x, y, g.color(glowHex(ctx, 0.1)));
      else tint(g, c.x, y, glowHex(ctx, 1), (0.7 / 2 ** lead) * (0.5 + 0.5 * glow));
    }
  }
}

/** Glass plates: a sparse lattice of bright plate corners and a sheen sweeping the body. */
function silica(ctx) {
  const { g, s, pose, edges, bodyCols } = ctx;
  const step = Math.max(3, Math.round(3.5 * s));
  const hi = g.color('#f4fffb', 230);
  for (const c of bodyCols) {
    const { yb, yv } = edges(c);
    for (let y = yb + 1; y < yv; y++) {
      if (!interior(ctx, c.x, y)) continue;
      const ry = y - Math.round(c.mid) + 64;
      const row = Math.floor(ry / step);
      if (ry % step === 0 && (c.x + (row % 2 ? Math.floor(step / 2) : 0)) % step === 0) g.px(c.x, y, hi);
      else if (frac((c.x + ry) / (9 * s) - (pose.wave ?? 0)) < 0.07) tint(g, c.x, y, '#ffffff', 0.35);
    }
  }
}

/** Tang's scalpel: a bright spine at the tail stalk, pointing forward. */
function scalpel(ctx) {
  const { g, s, colT } = ctx;
  const c = colT(0.1);
  if (!c) return;
  const len = Math.max(2, Math.round(2.2 * s));
  const y = Math.round(c.mid);
  g.line(c.x, y, c.x + len, y - 1, g.color('#f2a33d'));
  g.px(c.x + len, y - 1, g.color('#fff2b8'));
}

// ---------- head and limbs -------------------------------------------------------------------

/** The sand fish's shovel: a flat wedge over the snout, digging forward and down. */
function shovel(ctx) {
  const { g, ph, s, nose, colT, rampOf, pal } = ctx;
  if (!nose) return;
  const back = colT(Math.max(0.6, ph.eyeT - 0.12)) ?? nose;
  const r = rampOf(pal.skin);
  const reach = Math.max(1, Math.round(1.6 * s));
  const tipY = Math.round(nose.mid + nose.belly * 0.25);
  const pts = [
    [back.x, Math.round(back.mid - back.back)],
    [nose.x + reach, tipY],
    [nose.x + reach - 1, tipY + 1],
    [back.x, Math.round(back.mid - back.back * 0.35)],
  ];
  g.polygon(pts, r.dark);
  g.line(back.x, Math.round(back.mid - back.back), nose.x + reach, tipY, r.light);
}

/** Eyes on top: a skin turret around an eye that pokes out of the head. */
function eyeTop(ctx) {
  const { g, rampOf, pal, eyeBox } = ctx;
  if (!eyeBox) return;
  const { left, top, size } = eyeBox;
  const skin = rampOf(pal.skin);
  for (let y = top - 1; y <= top + Math.floor(size / 2); y++) {
    for (let x = left - 1; x <= left + size; x++) if (!g.get(x, y) && g.inside(x, y)) g.px(x, y, y === top - 1 ? skin.dark : skin.base);
  }
}

/** A third eye, smaller, above and behind the first. */
function tripleEye(ctx) {
  const { g, s, eyeBox, onBody } = ctx;
  if (!eyeBox) return;
  const size = Math.max(2, Math.round(eyeBox.size * 0.6));
  const left = eyeBox.left - size - (s >= 1.5 ? 1 : 0);
  let top = eyeBox.top - Math.max(1, Math.round(size / 2));
  // Keep it on the head: slide down until its corners sit on the body.
  for (let k = 0; k < 4 && !(onBody(left, top) && onBody(left + size - 1, top)); k++) top++;
  const sclera = g.color('#f4f1e6');
  const ink = g.color(INK);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) g.px(left + x, top + y, sclera);
  const p = Math.max(1, Math.floor(size / 2));
  for (let y = 0; y < p; y++) for (let x = 0; x < p; x++) g.px(left + size - p + x, top + size - p + y, ink);
  if (size >= 3) g.px(left, top, g.color(HIGHLIGHT));
}

/** Walking pectorals: a jointed fin-leg under the chest with a foot, stepping with the wave. */
function armFins(ctx) {
  const { g, ph, s, colT, fin, pose } = ctx;
  const c = colT(Math.max(0.5, ph.eyeT - 0.22));
  if (!c) return;
  const bx = c.x;
  const by = Math.round(c.mid + c.belly) - 1;
  const swing = Math.sin(TAU * (pose.wave ?? 0));
  const kx = bx + Math.round(swing * 1.2 * s);
  const ky = by + Math.max(1, Math.round(1.4 * s));
  const fx = kx - Math.round((0.6 + 0.6 * swing) * s);
  const fy = ky + Math.max(1, Math.round(1.4 * s));
  g.line(bx, by, kx, ky, fin.edge);
  g.line(kx, ky, fx, fy, fin.edge);
  if (s >= 1.5) {
    g.line(bx + 1, by, kx + 1, ky, fin.base);
    g.line(kx + 1, ky, fx + 1, fy, fin.base);
  }
  g.line(fx - 1, fy, fx + Math.max(1, Math.round(s)), fy, fin.rim);
}

// ---------- ambient particles ----------------------------------------------------------------

const particleCount = (s, mul = 1) => clamp(Math.round((2 + 2.5 * s) * mul), 2, 10);

/** Embers off the tail, rising and cooling as they drift back. */
function emberTrail(ctx) {
  const { g, ph, s, pose, bodyCols } = ctx;
  const c0 = bodyCols[0];
  if (!c0) return;
  const reach = 3 + 3 * s;
  const hgt = c0.back + c0.belly + 2;
  for (let i = 0; i < particleCount(s); i++) {
    const a = hash01(`${ph.seed}:ember:${i}`, 1);
    const b = hash01(`${ph.seed}:ember:${i}`, 2);
    const p = frac(a + (pose.wave ?? 0));
    const x = Math.round(c0.x - 1 - p * reach - b * 2);
    const y = Math.round(c0.mid + (b - 0.5) * hgt - p * 2.5 * s);
    const hex = p < 0.3 ? '#ffd36b' : p < 0.7 ? '#ff7a2a' : '#8a2a12';
    if (g.inside(x, y)) g.under(x, y, g.color(hex, Math.round(255 - 120 * p)));
  }
}

/** Puffs of sand kicked up under the belly, settling behind the fish. */
function sandPlume(ctx) {
  const { g, ph, s, pose, bodyCols, colT } = ctx;
  if (!bodyCols.length) return;
  for (let i = 0; i < particleCount(s, 1.2); i++) {
    const a = hash01(`${ph.seed}:sand:${i}`, 1);
    const b = hash01(`${ph.seed}:sand:${i}`, 2);
    const c = colT(0.05 + 0.45 * b);
    if (!c) continue;
    const p = frac(a + (pose.wave ?? 0));
    const x = Math.round(c.x - p * 2.5 * s);
    const y = Math.round(c.mid + c.belly + 1 + p * 1.8 * s);
    const hex = b < 0.5 ? '#e1c38e' : '#c98c3b';
    if (g.inside(x, y)) g.under(x, y, g.color(hex, Math.round(220 - 130 * p)));
  }
}

/** Sparkles that blink on and off around the body: radiant, harmless. */
function decaySparkle(ctx) {
  const { g, ph, s, pose, colT } = ctx;
  const glow = glowLevel(ctx);
  for (let i = 0; i < particleCount(s); i++) {
    const a = hash01(`${ph.seed}:spark:${i}`, 1);
    const b = hash01(`${ph.seed}:spark:${i}`, 2);
    const d = hash01(`${ph.seed}:spark:${i}`, 3);
    if (frac(a + 2 * (pose.wave ?? 0)) > 0.3 + 0.2 * glow) continue;
    const c = colT(0.1 + 0.85 * b);
    if (!c) continue;
    const up = d < 0.5;
    const off = 1 + Math.round((d < 0.5 ? d : d - 0.5) * 2 * 1.5 * s);
    const x = c.x;
    const y = Math.round(up ? c.mid - c.back - off : c.mid + c.belly + off);
    if (!g.inside(x, y)) continue;
    g.under(x, y, g.color(glowHex(ctx, 1)));
    if (s >= 1.5) {
      const arm = g.color(glowHex(ctx, 0.45), 200);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.inside(x + dx, y + dy)) g.under(x + dx, y + dy, arm);
    }
  }
}

/** Every anatomy part: id, where it goes in the fish3 part order, and its painter. */
export const ANATOMY = [
  { id: 'scalpel', layer: 'after:body', paint: scalpel, label: 'Scalpel spine' },
  { id: 'shovel', layer: 'after:body', paint: shovel, label: 'Shovel snout' },
  { id: 'silica', layer: 'after:scales', paint: silica, label: 'Glass plates' },
  { id: 'carapace', layer: 'after:pattern', paint: carapace, label: 'Cracked carapace' },
  { id: 'core', layer: 'after:pattern', paint: core, label: 'Glowing core' },
  { id: 'halfLife', layer: 'after:pattern', paint: halfLife, label: 'Half-life bands' },
  { id: 'seam', layer: 'after:markings', paint: seam, label: 'Emissive seam' },
  { id: 'armFins', layer: 'after:pectoralFin', paint: armFins, label: 'Walking fins' },
  { id: 'eyeTop', layer: 'after:eye', paint: eyeTop, label: 'Eyes on top' },
  { id: 'tripleEye', layer: 'after:eye', paint: tripleEye, label: 'Third eye' },
  { id: 'emberTrail', layer: 'after:orbit', paint: emberTrail, label: 'Ember trail' },
  { id: 'sandPlume', layer: 'after:orbit', paint: sandPlume, label: 'Sand plume' },
  { id: 'decaySparkle', layer: 'after:orbit', paint: decaySparkle, label: 'Decay sparkles' },
];

export const ANATOMY_IDS = ANATOMY.map((a) => a.id);

/**
 * The part list with the anatomy parts spliced in. Each paints only when the fish's body lists
 * it; `enabled(id)` switches one off (studio layer toggles).
 */
export function withAnatomy(parts, { enabled = () => true } = {}) {
  const out = [...parts];
  for (const a of ANATOMY) {
    if (!enabled(a.id)) continue;
    const [where, anchor] = a.layer.split(':');
    const part = {
      id: a.id,
      anatomy: true,
      paint: (ctx) => {
        if (anatomyOf(ctx).includes(a.id)) a.paint(ctx);
      },
    };
    // Later parts at the same anchor go after the earlier ones.
    let i = out.findIndex((p) => p.id === anchor);
    if (i < 0) i = out.length - 1;
    if (where === 'after') while (out[i + 1]?.anatomy) i++;
    out.splice(where === 'before' ? i : i + 1, 0, part);
  }
  return out;
}

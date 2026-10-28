// What pixelgen sees of a sprite: one flat vector in three blocks.
//
//   aesthetic  measured on the rendered frame, the same for every kind: colour count, contrast,
//              hue spread, saturation, fill, silhouette, noise, symmetry …
//   style      the shared style genome one-hot (src/v2/kit/style.js), zeros for v1 kinds
//   kind       a kind one-hot, then each kind's own traits one-hot in a slot of its own
//
// The aesthetic and style blocks are what let one network learn "beautiful" across fish, pilots
// and plants; the kind block lets it learn that a trait reads differently on one kind. The layout
// is derived from the registry, and `schema()` hashes it, so a model trained on another layout is
// spotted and retrained rather than misread.

import { GENERATORS } from '../gen/registry.js';
import { STYLE_FIELDS, STYLE_IDS } from '../v2/kit/style.js';
import { hash01 } from '../pixel/rng.js';
import { rgbOf } from '../pixel/color.js';

export const AESTHETIC = [
  'colors', // distinct colours used, /32
  'lumMean',
  'lumSd',
  'lumRange', // p95 − p5 of luminance
  'localContrast', // mean |Δlum| between touching pixels
  'bgContrast', // |mean lum − background lum|
  'satMean',
  'satSd',
  'hueSpread', // 1 − mean resultant length of saturated hues
  'hueEntropy', // over 12 hue bins, /log 12
  'darkShare', // lum < 0.2
  'brightShare', // lum > 0.8
  'fill', // drawn / bounding box
  'compactness', // 4π·area / perimeter², clamped
  'noise', // pixels with no same-colour 4-neighbour
  'jaggies', // edge pixels / √area, scaled
  'symmetryX', // left/right mirror agreement of the silhouette
  'clusters', // same-colour regions per 100 drawn pixels
  'scale', // log canvas area
];

const SATURATED = 0.18;

/** Hue (0..1), saturation, luminance of an rgb triple. */
function hsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return [0, 0, 0.299 * r + 0.587 * g + 0.114 * b];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h / 6 + 1) % 1;
  return [h, Math.min(1, s), 0.299 * r + 0.587 * g + 0.114 * b];
}

/** The aesthetic block for one image (an indexed {w, h, data, palette} frame) on `bg`. */
export function aesthetics(img, bg = '#000000') {
  const { w, h, data, palette } = img;
  const n = w * h;
  const pal = palette.map((c) => hsl(c));
  const lums = [];
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let area = 0;
  let sat = 0;
  let sat2 = 0;
  let hx = 0;
  let hy = 0;
  let hn = 0;
  const bins = new Float64Array(12);
  let dark = 0;
  let bright = 0;
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const v = data[i];
    if (!v || palette[v][3] === 0) continue;
    const x = i % w;
    const y = (i / w) | 0;
    area++;
    used.add(v);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    const [hu, s, l] = pal[v];
    lums.push(l);
    sat += s;
    sat2 += s * s;
    if (l < 0.2) dark++;
    if (l > 0.8) bright++;
    if (s >= SATURATED) {
      hx += Math.cos(hu * 2 * Math.PI);
      hy += Math.sin(hu * 2 * Math.PI);
      hn++;
      bins[Math.floor(hu * 12) % 12]++;
    }
  }
  const f = new Float32Array(AESTHETIC.length);
  if (!area) return f;
  lums.sort((a, b) => a - b);
  const mean = lums.reduce((a, b) => a + b, 0) / area;
  const sd = Math.sqrt(lums.reduce((a, b) => a + (b - mean) ** 2, 0) / area);
  const pct = (p) => lums[Math.min(area - 1, Math.floor(p * area))];
  const satMean = sat / area;

  let local = 0;
  let pairs = 0;
  let perimeter = 0;
  let edgePx = 0;
  let lonely = 0;
  let mirror = 0;
  let mirrorN = 0;
  const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] > 0;
  const cx = (x0 + x1) / 2;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      const v = data[i];
      if (!v) continue;
      let edge = false;
      let same = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!filled(x + dx, y + dy)) {
          perimeter++;
          edge = true;
          continue;
        }
        const u = data[(y + dy) * w + x + dx];
        if (u === v) same = true;
        if (dx > 0 || dy > 0) {
          local += Math.abs(pal[v][2] - pal[u][2]);
          pairs++;
        }
      }
      if (edge) edgePx++;
      if (!same) lonely++;
      const mx = Math.round(2 * cx - x);
      mirrorN++;
      if (filled(mx, y)) mirror++;
    }
  }

  // Same-colour regions, 4-connected.
  const seen = new Uint8Array(n);
  let clusters = 0;
  const stack = [];
  for (let i = 0; i < n; i++) {
    if (!data[i] || seen[i]) continue;
    clusters++;
    seen[i] = 1;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop();
      const x = j % w;
      const y = (j / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx;
        const Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const k = Y * w + X;
        if (!seen[k] && data[k] === data[j]) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
  }

  let entropy = 0;
  for (const b of bins) if (b) entropy -= (b / hn) * Math.log(b / hn);
  const bgL = hsl(rgbOf(bg))[2];
  const vals = {
    colors: Math.min(1, used.size / 32),
    lumMean: mean,
    lumSd: Math.min(1, sd * 3),
    lumRange: pct(0.95) - pct(0.05),
    localContrast: pairs ? Math.min(1, (local / pairs) * 4) : 0,
    bgContrast: Math.abs(mean - bgL),
    satMean,
    satSd: Math.min(1, Math.sqrt(Math.max(0, sat2 / area - satMean ** 2)) * 3),
    hueSpread: hn ? 1 - Math.hypot(hx, hy) / hn : 0,
    hueEntropy: hn ? entropy / Math.log(12) : 0,
    darkShare: dark / area,
    brightShare: bright / area,
    fill: area / ((x1 - x0 + 1) * (y1 - y0 + 1)),
    compactness: Math.min(1, (4 * Math.PI * area) / Math.max(1, perimeter) ** 2 * 2),
    noise: lonely / area,
    jaggies: Math.min(1, edgePx / Math.sqrt(area) / 8),
    symmetryX: mirrorN ? mirror / mirrorN : 0,
    clusters: Math.min(1, (clusters / area) * 2),
    scale: Math.min(1, Math.log(n) / Math.log(124 * 96)),
  };
  AESTHETIC.forEach((k, i) => (f[i] = vals[k]));
  return f;
}

// ---------- layout ----------

const STYLE_LEN = STYLE_FIELDS.reduce((a, fl) => a + fl.choices.length, 0);

/** Each kind's own fields: its traits minus the shared style fields. */
const ownFields = (gen) => gen.traits.fields.filter((fl) => !STYLE_IDS.includes(fl.id));

function buildLayout() {
  const kinds = {};
  let at = AESTHETIC.length + STYLE_LEN + GENERATORS.length;
  GENERATORS.forEach((gen, k) => {
    const fields = ownFields(gen).map((fl) => {
      const slot = { id: fl.id, at, choices: fl.choices.map((c) => c.id) };
      at += fl.choices.length;
      return slot;
    });
    kinds[gen.id] = { index: k, fields };
  });
  // Fix-head targets: one per style field (shared), then one per kind field.
  const fix = [...STYLE_IDS, ...GENERATORS.flatMap((gen) => ownFields(gen).map((fl) => `${gen.id}.${fl.id}`))];
  return {
    aesthetic: [0, AESTHETIC.length],
    style: [AESTHETIC.length, STYLE_LEN],
    kindAt: AESTHETIC.length + STYLE_LEN,
    kinds,
    dim: at,
    fix,
  };
}

let LAYOUT = null;
/** The vector layout (blocks, per-kind slots, fix targets), built once from the registry. */
export const layout = () => (LAYOUT ??= buildLayout());

/** A short hash of the layout: models carry it, and one with another schema is retrained. */
export function schema() {
  const L = layout();
  const key = [AESTHETIC.join(), STYLE_FIELDS.map((f) => f.id + ':' + f.choices.map((c) => c.id)).join(), ...Object.entries(L.kinds).map(([id, k]) => id + ':' + k.fields.map((f) => f.id + '=' + f.choices.join('/')).join())].join('|');
  return Math.floor(hash01(key) * 2 ** 32).toString(36) + L.dim.toString(36);
}

/** Whether a kind carries the style genome (the v2 kinds). */
export const hasStyle = (gen) => STYLE_IDS.every((id) => gen.traits.fieldById(id));

/** The style block alone: a one-hot per style field, zeros where the kind has none. */
function styleBlock(gen, genome, out, at) {
  if (!hasStyle(gen)) return;
  for (const fl of STYLE_FIELDS) {
    const c = Math.max(0, fl.choices.findIndex((c) => c.id === genome[fl.id]));
    out[at + c] = 1;
    at += fl.choices.length;
  }
}

/** The frame a sprite is judged by: its first anim's first frame, or a plant fully grown. */
export function still(gen, genome) {
  const [a] = gen.anims;
  return gen.frame(genome, a.id, a.id === 'stages' ? a.frames - 1 : 0);
}

/** The feature vector of a sprite; `img` defaults to its `still`. */
export function featurize(gen, genome, img = null) {
  const L = layout();
  img ??= still(gen, genome);
  const out = new Float32Array(L.dim);
  out.set(aesthetics(img, gen.bg), 0);
  styleBlock(gen, genome, out, L.style[0]);
  const kind = L.kinds[gen.id];
  if (!kind) return out;
  out[L.kindAt + kind.index] = 1;
  for (const fl of kind.fields) {
    const c = fl.choices.indexOf(genome[fl.id]);
    if (c >= 0) out[fl.at + c] = 1;
  }
  return out;
}

/** Fix-head target index for a field of `gen` (a style field is shared by every kind). */
export function fixIndex(gen, fieldId) {
  const L = layout();
  return L.fix.indexOf(STYLE_IDS.includes(fieldId) ? fieldId : `${gen.id}.${fieldId}`);
}

/** Per-input L2 multipliers: the kind block is regularised harder, so the net learns looks. */
export function l2Mask() {
  const L = layout();
  const m = new Float32Array(L.dim).fill(1);
  for (let i = L.kindAt; i < L.dim; i++) m[i] = 4;
  return m;
}

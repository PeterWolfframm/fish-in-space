// The style genome: how a v2 sprite is *rendered*, apart from what it *is*. The same fields are
// appended to every v2 kind, so a lighting or palette choice means the same thing on a fish, a
// pilot and a tree, and pixelgen (src/pixelgen/) can learn and tune them across all of them.
//
// Every field's first choice is the look v2 had before styles existed, so a code written before
// they were appended decodes to exactly the old pixels (test/v2-compat.test.mjs).
//
// `look` switches the whole render: `lit` is v2's shaded solids, `comic` is v1's simple charm on
// v2 shapes (cel bands, a tinted ink outline, fewer colours, less fine texture), `clean` sits
// between them.

import { toHsl, fromHsl } from './ramp.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));

/** Salts start at 1024 so they never meet a kind's own fields. */
export const STYLE_FIELDS = [
  { id: 'look', label: 'Look', group: 'style', salt: 1024, choices: opts(['lit', 'Lit'], ['comic', 'Comic'], ['clean', 'Clean']), weights: [60, 25, 15] },
  { id: 'light', label: 'Light from', group: 'style', salt: 1040, choices: opts(['topleft', 'Top left'], ['top', 'Top'], ['topright', 'Top right'], ['front', 'Front'], ['back', 'Behind']), weights: [50, 16, 14, 12, 8] },
  { id: 'contrast', label: 'Contrast', group: 'style', salt: 1056, choices: opts(['normal', 'Normal'], ['soft', 'Soft'], ['punchy', 'Punchy']), weights: [55, 20, 25] },
  { id: 'hueShift', label: 'Hue shift', group: 'style', salt: 1072, choices: opts(['normal', 'Normal'], ['none', 'None'], ['subtle', 'Subtle'], ['strong', 'Strong']), weights: [50, 10, 20, 20] },
  { id: 'saturation', label: 'Saturation', group: 'style', salt: 1088, choices: opts(['normal', 'Normal'], ['muted', 'Muted'], ['vivid', 'Vivid']), weights: [55, 20, 25] },
  { id: 'harmony', label: 'Harmony', group: 'style', salt: 1104, choices: opts(['natural', 'Natural'], ['analogous', 'Analogous'], ['complement', 'Complementary'], ['triadic', 'Triadic'], ['mono', 'Monochrome']), weights: [50, 16, 14, 10, 10] },
  { id: 'dither', label: 'Dither', group: 'style', salt: 1120, choices: opts(['auto', 'Auto'], ['off', 'Off'], ['band', 'Band'], ['heavy', 'Heavy']), weights: [55, 20, 15, 10] },
  { id: 'outline', label: 'Outline', group: 'style', salt: 1136, choices: opts(['selective', 'Selective'], ['none', 'None'], ['bold', 'Bold']), weights: [60, 15, 25] },
  { id: 'rimLight', label: 'Rim light', group: 'style', salt: 1152, choices: opts(['no', 'No'], ['yes', 'Yes']), weights: [70, 30] },
];

export const STYLE_IDS = STYLE_FIELDS.map((f) => f.id);

const norm = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

const LIGHTS = {
  topleft: null, // the renderer's own LIGHT
  top: norm(0, -0.85, 0.6),
  topright: norm(0.55, -0.75, 0.62),
  front: norm(-0.2, -0.3, 0.95),
  back: norm(0.35, -0.55, 0.3),
};
const GAIN = { normal: 1, soft: 0.7, punchy: 1.35 };
const SHIFT = { normal: 1, none: 0, subtle: 0.5, strong: 1.7 };
const SAT = { normal: 1, muted: 0.62, vivid: 1.3 };
const HARMONY = { natural: null, analogous: [0, 30, -30], complement: [0, 180], triadic: [0, 120, 240], mono: [0] };
const DITHER = { auto: null, off: 0, band: 0.13, heavy: 0.24 };

/**
 * The style a genome asks for, resolved for `Surface`; null when every field is at its default,
 * so the renderer takes exactly its old path. `detail` (≤ 1) scales the size thresholds at which a
 * draw adds fine texture.
 */
export function styleOf(genome) {
  const g = genome ?? {};
  const v = (id) => g[id] ?? STYLE_FIELDS.find((f) => f.id === id).choices[0].id;
  const look = v('look');
  if (STYLE_IDS.every((id) => v(id) === STYLE_FIELDS.find((f) => f.id === id).choices[0].id)) return null;
  const comic = look === 'comic';
  return {
    look,
    light: LIGHTS[v('light')] ?? null,
    gain: (GAIN[v('contrast')] ?? 1) * (comic ? 1.15 : 1),
    shift: SHIFT[v('hueShift')] ?? 1,
    sat: SAT[v('saturation')] ?? 1,
    harmony: HARMONY[v('harmony')] ?? null,
    dither: comic || look === 'clean' ? 0 : DITHER[v('dither')] ?? null,
    outline: comic ? 'ink' : v('outline') === 'selective' ? null : v('outline'),
    rim: v('rimLight') === 'yes',
    steps: comic ? 3 : look === 'clean' ? 4 : null,
    detail: comic ? 0.4 : look === 'clean' ? 0.6 : 1,
  };
}

/** Size thresholds for fine texture, raised for simpler looks: `fine(L, 40)` replaces `L >= 40`. */
export const fineAt = (style) => (size, threshold) => size >= threshold / (style?.detail ?? 1);

/** A material's base colour under a style: saturation, then hue snapped to the harmony. */
export function styleHex(hex, style, anchorHue) {
  if (!style) return hex;
  let [h, s, l] = toHsl(hex);
  if (s < 0.08) return hex;
  if (style.harmony && anchorHue != null) {
    let best = h;
    let bd = 1e9;
    for (const off of style.harmony) {
      const t = (anchorHue + off + 360) % 360;
      const d = Math.abs(((t - h + 540) % 360) - 180);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    h = best;
  }
  s = Math.min(1, s * style.sat);
  return fromHsl(h, s, l);
}

/**
 * The near-black a comic outline takes for a colour: its own hue, very dark. Hues snap to six
 * families and greys share one ink, so neighbouring materials share an outline like v1's.
 */
export function inkOf(hex) {
  const [h, s] = toHsl(hex);
  if (s < 0.15) return fromHsl(220, 0.18, 0.1);
  return fromHsl(Math.round(h / 60) * 60 % 360, 0.4, 0.11);
}

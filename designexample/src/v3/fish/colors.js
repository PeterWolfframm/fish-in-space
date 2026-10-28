// Colour for fish3: v1's flat swatches, run through the colour morphs, plus the OKLab maths
// breeding uses to blend two parents' colours without ending up with mud.

import { shade, mix, lum, rotateHue, rgbOf, hexFrom } from '../../pixel/color.js';
import { BODY_COLORS, MARK_COLORS, EYE_COLORS, INK, HIGHLIGHT } from '../../gen/fish/palettes.js';

export { INK, HIGHLIGHT };

const grey = (hex) => {
  const v = lum(hex) * 255;
  return hexFrom([v, v, v]);
};
const saturate = (hex, k) => mix(grey(hex), hex, k);

/** Every colour the drawing needs, after the morph has had its say. */
export function paletteOf(set, ph) {
  const of = (list, id) => (list.find((c) => c.id === id) ?? list[0]).hex;
  let skin = of(BODY_COLORS, set.skin);
  let mark = of(MARK_COLORS, set.markColor);
  let eye = of(EYE_COLORS, set.eyeColor);
  let eye2 = set.eyeColor2 && set.eyeColor2 !== 'same' ? of(EYE_COLORS, set.eyeColor2) : eye;
  let patternFade = 0;
  let alpha = 255;
  const extra = {};

  switch (ph.morph) {
    case 'albino':
      skin = mix(skin, '#f7e6e2', 0.84);
      mark = mix(mark, '#f0c4c2', 0.75);
      eye = eye2 = '#d23042';
      patternFade = 0.4;
      break;
    case 'leucistic':
      skin = mix(skin, '#f4f2ec', 0.88);
      mark = mix(mark, '#e6e2d8', 0.7);
      patternFade = 0.5;
      break;
    case 'melanistic':
      skin = mix(shade(skin, 0.4), '#24232c', 0.55);
      mark = mix(mark, '#121118', 0.6);
      break;
    case 'axanthic':
      skin = mix(grey(skin), '#7d93ab', 0.45);
      mark = mix(grey(mark), '#4a5a70', 0.4);
      break;
    case 'xanthic':
      skin = mix(skin, '#f4b928', 0.78);
      mark = mix(mark, '#e3862a', 0.5);
      break;
    case 'ghost':
      alpha = 120;
      skin = mix(skin, '#dce8ee', 0.6);
      patternFade = 0.6;
      break;
    case 'galaxy':
      skin = mix(skin, '#1f2340', 0.82);
      mark = '#f4f1e6';
      extra.speckle = '#fbf7ec';
      break;
    case 'neon':
      skin = mix(shade(skin, 0.55), '#1c2a3c', 0.4);
      extra.neon = saturate(rotateHue(mark === '#2b2f38' ? '#2d7fd0' : mark, 0), 1.4);
      break;
    case 'chrome':
      skin = mix(grey(skin), '#c9d2da', 0.55);
      mark = mix(mark, '#6f7a86', 0.4);
      extra.chrome = true;
      break;
    case 'split':
      extra.split = rotateHue(skin, 150);
      break;
    case 'ombre':
      extra.ombre = 70;
      break;
    case 'piebald':
      extra.patches = [HIGHLIGHT];
      break;
    case 'calico':
      extra.patches = [HIGHLIGHT, '#26252d'];
      break;
    default:
  }

  // Dimorphic males run hot, females a touch muted; elders fade.
  if (ph.saturation !== 1) {
    skin = saturate(skin, ph.saturation);
    mark = saturate(mark, ph.saturation);
  }
  if (ph.stage === 'elder') {
    skin = mix(skin, grey(skin), 0.35);
    mark = mix(mark, grey(mark), 0.3);
  }
  if (ph.stage === 'fry') patternFade = Math.max(patternFade, 0.45);

  const fin = finColorsOf(set.finTint, skin, mark);
  if (ph.stage === 'fry') fin.alpha = Math.min(fin.alpha, 150);
  if (ph.morph === 'ghost') fin.alpha = Math.min(fin.alpha, 110);

  return { skin, mark, eye, eye2, fin, alpha, patternFade, ...extra };
}

/** Fin colours, derived from the body so a fish reads as one animal (v1's rule). */
export function finColorsOf(tint, skin, accent) {
  const of = (base, alpha) => ({ base, edge: shade(base, 0.72), ray: shade(base, 0.86), rim: shade(base, 1.3), lit: shade(base, 1.12), dim: shade(base, 0.86), alpha });
  switch (tint) {
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

/** The body's shading ramp around a base colour: v1's five tones. */
export function bodyRamp(skin, belly) {
  const bellyAmount = { none: 0, soft: 0.26, pale: 0.4, white: 0.52 }[belly] ?? 0.26;
  return {
    dark: shade(skin, 0.72),
    base: skin,
    light: shade(skin, 1.18),
    core: shade(skin, 0.84),
    rim: shade(skin, 1.32),
    belly: belly === 'white' ? mix(skin, HIGHLIGHT, 0.8) : mix(skin, HIGHLIGHT, 0.35 + bellyAmount),
    bellyAmount,
  };
}

// ---------- OKLab, for blending parents ----------

const lin = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const unlin = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function oklab(hex) {
  const [r, g, b] = rgbOf(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

export function fromOklab([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return hexFrom([unlin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), unlin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), unlin(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)]);
}

/**
 * Two swatches blended in OKLab, then snapped to the nearest swatch of `list`. Chroma is kept at
 * the parents' mean rather than the mean colour's (which is greyer), so purple × yellow lands on
 * a warm pink or a tan, not on mud.
 */
export function blendSwatch(list, idA, idB, k = 0.5) {
  const a = oklab((list.find((c) => c.id === idA) ?? list[0]).hex);
  const b = oklab((list.find((c) => c.id === idB) ?? list[0]).hex);
  const m = a.map((v, i) => v + (b[i] - v) * k);
  const chroma = (c) => Math.hypot(c[1], c[2]);
  const want = chroma(a) + (chroma(b) - chroma(a)) * k;
  const have = chroma(m) || 1;
  const target = [m[0], (m[1] * want) / have, (m[2] * want) / have];
  let best = list[0].id;
  let bestD = Infinity;
  for (const c of list) {
    const o = oklab(c.hex);
    const d = (o[0] - target[0]) ** 2 + (o[1] - target[1]) ** 2 + (o[2] - target[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

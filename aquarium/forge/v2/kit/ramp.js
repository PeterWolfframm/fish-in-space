// Hue-shifted colour ramps: the single biggest difference between flat procedural sprites and
// hand-painted ones. Shadows do not just darken, they drift cool (toward blue-violet) and gain
// saturation; highlights drift warm (toward yellow) and lose a little. A ramp is darkest first.

import { rgbOf, hexFrom } from '../../pixel/color.js';

export function toHsl(hex) {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return hexFrom([r + m, g + m, b + m].map((v) => Math.round(v * 255)));
}

/** Turn hue `h` toward `target` by up to `deg` degrees along the short way round. */
function toward(h, target, deg) {
  const d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), deg);
}

/**
 * `steps` colours, darkest first, with `hex` at index `base` (default the middle).
 * `shift`: degrees of hue drift at the ends. `dark`/`light`: how far the ends reach.
 */
export function hueRamp(hex, { steps = 5, base = Math.floor((steps - 1) / 2), shift = 24, dark = 0.62, light = 0.6, cool = 245, warm = 52 } = {}) {
  const [h, s, l] = toHsl(hex);
  const grey = s < 0.08;
  const out = [];
  for (let i = 0; i < steps; i++) {
    if (i === base) {
      out.push(hex);
      continue;
    }
    const k = i < base ? (base - i) / base : (i - base) / (steps - 1 - base);
    if (i < base) {
      const hh = grey ? h : toward(h, cool, shift * k);
      out.push(fromHsl(hh, grey ? s + 0.04 * k : s + (1 - s) * 0.18 * k, l * (1 - dark * k)));
    } else {
      const hh = grey ? h : toward(h, warm, shift * 0.8 * k);
      out.push(fromHsl(hh, s * (1 - 0.22 * k), l + (1 - l) * light * k));
    }
  }
  return out;
}

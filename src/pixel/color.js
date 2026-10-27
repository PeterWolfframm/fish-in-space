// Vendored from the pixel kit — do not edit here.
// Source: kit/web/pixel/color.js in the Burn-Through repo.
// Run `node scripts/vendor-pixel.mjs` to update, and edit it there.
// Colour maths for pixel art: hex in, hex out, plus the shadow/base/highlight ramp that every
// shaded sprite needs.

/** `#rgb` or `#rrggbb` as [r, g, b]. */
export function rgbOf(hex) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** [r, g, b] as `#rrggbb`, clamped and rounded. */
export const hexFrom = (rgb) =>
  `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * [r, g, b] darkened (k < 1) or lightened toward white (k > 1).
 *
 * The lighten branch is the reason this is not a plain multiply: multiplying cannot lift a dark
 * colour, so a highlight on near-black would stay near-black.
 */
export const shadeRgb = (rgb, k) =>
  (k <= 1 ? rgb.map((v) => v * k) : rgb.map((v) => v + (255 - v) * (k - 1))).map(clamp255);

/**
 * [r, g, b] multiplied by `k`, clamped.
 *
 * Unlike `shadeRgb`, this cannot lighten a dark colour — but it is what flat multiplicative
 * shading looks like, and sprites tuned against it need it to stay that way.
 */
export const scaleRgb = (rgb, k) => rgb.map((v) => clamp255(v * k));

/** `hex` darkened (k < 1) or lightened toward white (k > 1). */
export const shade = (hex, k) => hexFrom(shadeRgb(rgbOf(hex), k));

/** Linear mix of two [r, g, b] colours, `t` from 0 (a) to 1 (b). */
export const mixRgb = (a, b, t) => a.map((v, i) => clamp255(v + (b[i] - v) * t));

/** Linear mix of two colours, `t` from 0 (a) to 1 (b). */
export const mix = (a, b, t) => hexFrom(mixRgb(rgbOf(a), rgbOf(b), t));

/** Perceived brightness, 0..1. Use it to decide whether ink or paper reads better on a colour. */
export const lum = (hex) => {
  const [r, g, b] = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/** Whichever of `dark`/`light` contrasts more with `hex`. */
export const inkOn = (hex, dark = '#101014', light = '#ffffff') => (lum(hex) > 0.55 ? dark : light);

/**
 * A shading ramp around a base colour: `steps` entries, darkest first, `base` in the middle.
 * `spread` is how far the ends travel (0.45 ≈ a strong but still readable ramp).
 */
export function ramp(hex, steps = 3, spread = 0.45) {
  if (steps < 2) return [hex];
  const mid = (steps - 1) / 2;
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = (i - mid) / mid; // -1 at the dark end, +1 at the light end
    out.push(t === 0 ? hex : shade(hex, t < 0 ? 1 + t * spread : 1 + t * spread));
  }
  return out;
}

/** Shorthand for the common three-tone ramp. */
export function trio(hex, spread = 0.45) {
  const [dark, base, light] = ramp(hex, 3, spread);
  return { dark, base, light };
}

/** Rotate a colour's hue by `deg`, keeping its brightness and saturation. */
export function rotateHue(hex, deg) {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h / 6) * 360 + deg) % 360 + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const chan = (t) => {
    const tt = (t + 1) % 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return hexFrom([chan(h + 1 / 3) * 255, chan(h) * 255, chan(h - 1 / 3) * 255]);
}

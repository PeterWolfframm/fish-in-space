// The palette, shared by Pixi scenes. theme.css carries the same values for the HTML layer.

export const C = {
  void: 0x0b0e1f,
  hull: 0x1b2140,
  hullHi: 0x2c3563,
  lamp: 0xffb86b,
  tank: 0x3fc6c9,
  bloom: 0x9be37a,
  signal: 0xff7aa8,
  ink: 0xf3ead8,
} as const;

export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
export const rgbOf = (n: number): [number, number, number] => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export function mixRgb(a: readonly number[], b: readonly number[], k: number): [number, number, number] {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}
export const toNum = (c: readonly number[]) => ((Math.round(c[0]) & 255) << 16) | ((Math.round(c[1]) & 255) << 8) | (Math.round(c[2]) & 255);

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

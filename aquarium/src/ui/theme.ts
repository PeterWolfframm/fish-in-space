// The palette, shared by Pixi scenes. theme.css carries the same values for the HTML layer.

export const C = {
  void: 0x04050b,
  hull: 0x10162a,
  hullHi: 0x212c4e,
  line: 0x3a4568,
  lamp: 0xffa53d,
  peach: 0xf6c38d,
  lilac: 0xb48cff,
  sky: 0x6aa8ff,
  tank: 0x3ee6f5,
  bloom: 0x6ff28a,
  signal: 0xff6b8b,
  gold: 0xffd84a,
  ink: 0xf4f7ff,
} as const;

export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
export const rgbOf = (n: number): [number, number, number] => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export function mixRgb(a: readonly number[], b: readonly number[], k: number): [number, number, number] {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}
export const toNum = (c: readonly number[]) => ((Math.round(c[0]) & 255) << 16) | ((Math.round(c[1]) & 255) << 8) | (Math.round(c[2]) & 255);

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

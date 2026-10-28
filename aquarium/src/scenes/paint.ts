// Small helpers for painting pixel textures on a 2D canvas.

import { Texture } from 'pixi.js';

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

export const texOf = (c: HTMLCanvasElement) => Texture.from({ resource: c, scaleMode: 'nearest' });

/** A seeded LCG for decoration that must not change between frames. */
export function lcg(seed = 7) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const rgba = (c: readonly number[], a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

/** A soft radial blob in hard bands, for glows. */
export function glowTexture(size = 32, bands = 5) {
  const { c, g } = canvas(size, size);
  const r = size / 2;
  for (let i = 0; i < bands; i++) {
    g.fillStyle = `rgba(255,255,255,${((i + 1) / bands) * 0.22})`;
    g.beginPath();
    g.arc(r, r, r * (1 - i / bands), 0, Math.PI * 2);
    g.fill();
  }
  return texOf(c);
}

/** A vertical fade from opaque to clear, in bands. */
export function rayTexture(h = 64, bands = 8) {
  const { c, g } = canvas(1, h);
  for (let i = 0; i < bands; i++) {
    g.fillStyle = `rgba(255,255,255,${1 - i / bands})`;
    g.fillRect(0, Math.floor((i * h) / bands), 1, Math.ceil(h / bands));
  }
  return texOf(c);
}

export const PATTERNS = {
  HEART: ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'],
  SPARK: ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'],
  ARROW: ['XXXXX', '.XXX.', '..X..'],
};

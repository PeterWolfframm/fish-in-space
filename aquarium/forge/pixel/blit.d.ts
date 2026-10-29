import type { IndexedImage } from './grid.js';

export interface Sheet extends IndexedImage {
  frameWidth: number;
  frameHeight: number;
  columns: number;
}

export function toRGBA(img: IndexedImage, out?: Uint8ClampedArray): Uint8ClampedArray;
export function toImageData(img: IndexedImage): ImageData;
export function toCanvas(img: IndexedImage, scale?: number): HTMLCanvasElement;
export function paint(
  ctx: CanvasRenderingContext2D,
  img: IndexedImage,
  scale?: number,
  x0?: number,
  y0?: number
): void;
export function toSheet(frames: readonly IndexedImage[], options?: { columns?: number }): Sheet;
export function toPNG(img: IndexedImage, scale?: number): Promise<Blob>;
export function toDataURL(img: IndexedImage, scale?: number): string;

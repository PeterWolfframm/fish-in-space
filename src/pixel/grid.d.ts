/** An indexed-colour image: one palette index per pixel, 0 meaning nothing drawn. */
export interface IndexedImage {
  w: number;
  h: number;
  data: Uint16Array;
  palette: number[][];
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OutlineOptions {
  /** Recolour the sprite's own edge instead of growing it by a pixel. */
  inward?: boolean;
  /** Include the four diagonal neighbours. */
  diagonal?: boolean;
}

/** Return false to leave a pixel alone. */
export type PixelTest = (x: number, y: number) => boolean;

export class Grid {
  readonly w: number;
  readonly h: number;
  readonly data: Uint16Array;
  readonly palette: number[][];

  constructor(w: number, h?: number);

  /** The palette index for a colour, adding it if new. */
  color(color: string | readonly number[], a?: number): number;
  inside(x: number, y: number): boolean;
  px(x: number, y: number, c: number): void;
  get(x: number, y: number): number;
  /** Paint only where nothing has been drawn yet. */
  under(x: number, y: number, c: number): void;
  rect(x0: number, y0: number, w: number, h: number, c: number): void;
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number, test?: PixelTest | null): void;
  line(x0: number, y0: number, x1: number, y1: number, c: number): void;
  polygon(points: ReadonlyArray<readonly [number, number]>, c: number): void;
  /**
   * One row per y from y0 to y1, centred on cx, `width(t)` wide, with t running 0..1 down
   * the band. A tapered shape in one call.
   */
  band(
    cx: number,
    y0: number,
    y1: number,
    width: (t: number) => number,
    color: number | ((t: number, y: number) => number)
  ): void;
  mirror(axis?: 'x' | 'y'): void;
  replace(from: number, to: number): void;
  /** 4x4 ordered dither of `c` at `level` coverage, over drawn pixels by default. */
  dither(
    x0: number,
    y0: number,
    w: number,
    h: number,
    c: number,
    level?: number,
    test?: PixelTest | null
  ): void;
  outline(c: number, options?: OutlineOptions): void;
  bounds(): Bounds | null;
  out(): IndexedImage;
}

// Where everything sits in the hatchery, in low-res pixels. The tank is a landscape world larger than
// the viewport: the glass fills the screen, and the camera pans across the rest.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HatcheryLayout {
  W: number; // world width
  H: number; // world height
  viewW: number;
  viewH: number;
  tank: Rect; // the glass, edge to edge of the world
  water: Rect; // the water, filling the glass
  sandY: number; // top of the sand
  /** @deprecated lid and tray are gone; kept so older call sites still type-check. */
  lidY: number;
  tray: { x0: number; x1: number; y: number };
  plinthY: number;
  planet: { cx: number; cy: number; r: number };
}

export const SAND = 14;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** How many viewport-widths across the tank is, capped at 1.5x so there is always glass and frame
 * in view. Jerry's solo '1x1' tank needs no room to swim in and stays smaller than the rest. */
const SPAN: Record<string, number> = { '1x1': 1, '2x1': 1.3, '1x2': 1.15, '2x2': 1.25, '3x1': 1.5 };

export function layout(viewW: number, viewH: number, shape = '1x2'): HatcheryLayout {
  const span = SPAN[shape] ?? SPAN['1x2'];
  // The tank always fits the screen vertically: no vertical panning, ever.
  const H = viewH;
  const W = Math.max(viewW, Math.round(viewW * span));
  const tank = { x: 0, y: 0, w: W, h: H };
  const water = { x: 0, y: 0, w: W, h: H };
  const r = Math.round(clamp(Math.min(viewW * 0.47, viewH * 0.34), 60, 240));
  const planet = { cx: Math.round(viewW * 0.5 + r * 0.08), cy: Math.round(viewH * 0.7), r };
  return {
    W, H, viewW, viewH, tank, water, sandY: water.y + water.h - SAND,
    lidY: 0, tray: { x0: 0, x1: 0, y: 0 }, plinthY: H, planet,
  };
}

/** Ten plant slots along the sand. Odd slots sit a little higher, in the back row. */
export function slotPos(L: HatcheryLayout, slot: number): { x: number; y: number; back: boolean; ledge: boolean } {
  const i = Math.min(9, Math.max(0, slot));
  const back = i % 2 === 1;
  const x = Math.round(L.water.x + L.water.w * ((i + 0.5) / 10));
  return { x, y: L.sandY + (back ? 3 : 8), back, ledge: false };
}

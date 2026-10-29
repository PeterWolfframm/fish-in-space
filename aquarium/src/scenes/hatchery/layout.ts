// Where everything sits in the hatchery, in low-res pixels, for a given world size. There is no wall:
// the tank stands on a slim plinth in front of the viewport, with the planet hanging low behind it.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HatcheryLayout {
  W: number;
  H: number;
  tank: Rect; // the glass box, lid to plinth
  water: Rect; // inside the glass, below the surface
  sandY: number; // top of the sand
  lidY: number; // top of the lid, where the hydroponic tray stands
  tray: { x0: number; x1: number; y: number };
  plinthY: number;
  planet: { cx: number; cy: number; r: number };
}

export const SAND = 14;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Tank aspect (w/h) by wall-grid shape; a tall tank fills a phone. */
const ASPECT: Record<string, number> = { '1x1': 1.05, '2x1': 1.9, '1x2': 0.62, '2x2': 1.05, '3x1': 2.6 };

export function layout(W: number, H: number, shape = '1x2'): HatcheryLayout {
  const margin = clamp(Math.round(W * 0.03), 5, 14);
  const top = clamp(Math.round(H * 0.075), 26, 48); // headroom for the tray plants
  const plinthH = clamp(Math.round(H * 0.04), 10, 18);
  const plinthY = H - plinthH;
  const maxW = W - margin * 2;
  const maxH = plinthY - top;
  const aspect = ASPECT[shape] ?? ASPECT['1x2'];
  // A tall tank always takes the full height and as much width as it can; the others fill the width
  // first and, when that would be too tall, are held to the height.
  let w = maxW;
  let h = Math.round(w / aspect);
  if (shape === '1x2') (h = maxH), (w = Math.min(maxW, Math.round(maxH * 0.9)));
  else if (h > maxH) (h = maxH), (w = Math.min(maxW, Math.max(Math.round(maxH * aspect), Math.min(maxW, 220))));
  const tank = { x: Math.round((W - w) / 2), y: plinthY - h, w, h };
  const water = { x: tank.x + 2, y: tank.y + 9, w: tank.w - 4, h: tank.h - 11 };
  const r = Math.round(clamp(Math.min(W * 0.47, H * 0.34), 60, 240));
  const planet = { cx: Math.round(W * 0.5 + r * 0.08), cy: Math.round(H * 0.7), r };
  return {
    W, H, tank, water, sandY: water.y + water.h - SAND,
    lidY: tank.y, tray: { x0: tank.x + 10, x1: tank.x + tank.w - 10, y: tank.y }, plinthY, planet,
  };
}

/** Plant slots: six on the sand (odd slots in the back row), four in the hydroponic tray on the lid. */
export function slotPos(L: HatcheryLayout, slot: number): { x: number; y: number; back: boolean; ledge: boolean } {
  if (slot >= 6) {
    const k = Math.min(3, slot - 6);
    const span = L.tray.x1 - L.tray.x0;
    return { x: Math.round(L.tray.x0 + span * (0.12 + k * 0.253)), y: L.tray.y - 2, back: true, ledge: true };
  }
  const x = Math.round(L.water.x + L.water.w * (0.08 + slot * 0.168));
  return { x, y: L.sandY + (slot % 2 ? 3 : 8), back: slot % 2 === 1, ledge: false };
}

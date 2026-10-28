// Where everything sits in the hatchery, in low-res pixels, for a given world size.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HatcheryLayout {
  W: number;
  H: number;
  wallH: number;
  tank: Rect; // the glass box
  water: Rect; // inside the glass, below the surface
  sandY: number; // top of the sand
  porthole: { cx: number; cy: number; r: number };
  ledge: { x0: number; x1: number; y: number };
  cabinetY: number;
}

export const SAND = 14;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function layout(W: number, H: number): HatcheryLayout {
  const margin = clamp(Math.round(W * 0.03), 6, 14);
  const wallH = clamp(Math.round(H * 0.24), 46, 100);
  const cabinetH = clamp(Math.round(H * 0.05), 8, 16);
  const tank = { x: margin, y: wallH, w: W - margin * 2, h: H - wallH - cabinetH };
  const water = { x: tank.x + 2, y: tank.y + 7, w: tank.w - 4, h: tank.h - 9 };
  const r = Math.round(clamp(Math.min(wallH * 0.5, W * 0.15), 18, 60));
  // The porthole sits behind the tank: its lower edge dips under the tank's rim.
  const porthole = { cx: Math.round(W * 0.3), cy: wallH - Math.round(r * 0.55), r };
  const ledge = { x0: Math.round(W * 0.56), x1: W - margin - 2, y: wallH - 1 };
  return { W, H, wallH, tank, water, sandY: water.y + water.h - SAND, porthole, ledge, cabinetY: tank.y + tank.h };
}

/** Plant slots: six on the sand (odd slots in the back row), two on the dry ledge. */
export function slotPos(L: HatcheryLayout, slot: number): { x: number; y: number; back: boolean; ledge: boolean } {
  if (slot >= 6) {
    const k = slot - 6;
    return { x: Math.round(L.ledge.x0 + 18 + k * Math.min(48, (L.ledge.x1 - L.ledge.x0) * 0.45)), y: L.ledge.y, back: true, ledge: true };
  }
  const x = Math.round(L.water.x + L.water.w * (0.08 + slot * 0.168));
  return { x, y: L.sandY + (slot % 2 ? 3 : 8), back: slot % 2 === 1, ledge: false };
}

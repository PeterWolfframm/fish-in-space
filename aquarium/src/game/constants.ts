// Tuning, carried over from v2 so the port plays the same, plus the v3 and v4 additions.

import type { TankShape } from './types';

export const SAVE_VERSION = 4;
export const START_CREDITS = 150;
export const MAX_ORDERS = 3;
export const ORDER_EVERY = 75_000;
export const EGG_HATCH = 20_000;
export const ROE_THAW = 5_000;
export const SPAWN_COOLDOWN = 90_000;
export const GROW = { juvenile: 60, adult: 150, elder: 1800 }; // seconds of growth to reach each stage
export const HUNGER_PER_S = 1 / 300;
export const BASE_CAPACITY = 10;
export const MAX_CAPACITY = 30;
export const ANNEX_BERTHS = 8;
export const OFFLINE_CAP = 6 * 3600_000;

export const ORBIT_MS = 12 * 60_000;
export const WINDOW_HALF = 0.06; // fraction of an orbit either side of a region's pass
export const WINDOW_BONUS = 1.25;
export const LIFE_MAX = 100;
export const DRAWERS = 6;
export const CRATE_EVERY = 3; // orbits between mystery crates
export const AMBIENT_MIN = 3 * 60_000;
export const AMBIENT_MAX = 6 * 60_000;
export const AMBIENT_REPEAT = 30 * 60_000;

// --- tanks ------------------------------------------------------------------------------------------

/** Footprint in wall-grid units (width x height). '1x2' is tall: the phone default. */
export const TANK_DIMS: Record<TankShape, { w: number; h: number }> = {
  '1x1': { w: 1, h: 1 },
  '2x1': { w: 2, h: 1 },
  '1x2': { w: 1, h: 2 },
  '2x2': { w: 2, h: 2 },
  '3x1': { w: 3, h: 1 },
};
export const TANK_CAPACITY: Record<TankShape, number> = { '1x1': 6, '2x1': 10, '1x2': 10, '2x2': 18, '3x1': 14 };
export const TANK_PRICE: Record<TankShape, number> = { '1x1': 200, '2x1': 380, '1x2': 380, '2x2': 700, '3x1': 560 };
export const TANK_GRID_W = 3; // the wall gallery is 3 units wide

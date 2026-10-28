// Tuning, carried over from v2 so the port plays the same, plus the v3 additions.

export const SAVE_VERSION = 3;
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

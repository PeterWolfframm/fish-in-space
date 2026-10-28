// The station's orbit: one lap is about 12 real minutes, derived from an epoch so it needs no state
// of its own. Each region passes under the station once per lap; that pass is its launch window.

import { ORBIT_MS, WINDOW_HALF } from './constants';

export interface OrbitNow {
  n: number; // 1-based lap number
  f: number; // 0..1 through the lap
  night: boolean;
  light: number; // 0 (deep night) .. 1 (noon), smooth
  clock: string; // mm:ss into the lap
}

export function orbitAt(epoch: number, now: number): OrbitNow {
  const t = Math.max(0, now - epoch);
  const n = Math.floor(t / ORBIT_MS) + 1;
  const into = t % ORBIT_MS;
  const f = into / ORBIT_MS;
  const s = Math.floor(into / 1000);
  return {
    n,
    f,
    night: f >= 0.5,
    light: 0.5 + 0.5 * Math.cos((f - 0.25) * Math.PI * 2),
    clock: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`,
  };
}

/** Circular distance between two lap fractions. */
const lapDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
};

export const inWindow = (regionLon: number, f: number) => lapDist(regionLon, f) <= WINDOW_HALF;

/** Milliseconds until the region's next window opens (0 if it is open now). */
export function untilWindow(regionLon: number, epoch: number, now: number): number {
  const { f } = orbitAt(epoch, now);
  if (inWindow(regionLon, f)) return 0;
  const start = (((regionLon - WINDOW_HALF - f) % 1) + 1) % 1;
  return Math.round(start * ORBIT_MS);
}

export const windowArc = (regionLon: number): [number, number] => [regionLon - WINDOW_HALF, regionLon + WINDOW_HALF];

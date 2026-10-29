// Drawing strokes that bend: a blade, a leaf, a stem. Shared by the tank plants and the garden
// plants, which are both mostly "a tapered ribbon that curves and sways".
//
// A stroke is sampled along its length in quarter-pixel steps; at each step a short span is laid
// across it, so width, bend and sway can all vary along the stroke without any polygon maths.
// Pure: writes into a kit Grid.

/**
 * Walk a stroke and call `plot(x, y, u, k, hw)` for every covered pixel sample:
 * `u` 0..1 along the stroke, `k` the signed offset across it, `hw` the half width there.
 *
 * - `x, y`   where it starts
 * - `angle`  its direction at the start, radians from straight up (positive leans right)
 * - `len`    its length in pixels
 * - `bend`   how much the direction turns by the end, radians (positive curls right)
 * - `width(u)` full width along it (default 1)
 * - `sway(u)` sideways offset in pixels along it (default none) — the base should stay at 0
 * - `droop`  pull toward the ground that grows with the square of u, pixels at the tip
 * - `upto`   stop at this fraction of the length (0..1) — a growing stroke is the grown one cut short,
 *            so it never changes shape as it lengthens
 */
export function walk({ x, y, angle = 0, len, bend = 0, width = () => 1, sway = () => 0, droop = 0, upto = 1 }, plot) {
  if (len <= 0 || upto <= 0) return;
  const step = 0.25;
  let px = x;
  let py = y;
  for (let s = 0; s <= len * upto; s += step) {
    const u = s / len;
    const a = angle + bend * u;
    const cx = px + sway(u);
    const cy = py + droop * u * u;
    const hw = Math.max(0, width(u) / 2);
    if (hw < 0.5) plot(Math.floor(cx), Math.floor(cy), u, 0, hw);
    else {
      // Across the stroke: the normal to its direction.
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      for (let k = -hw; k <= hw; k += 0.5) plot(Math.floor(cx + nx * k), Math.floor(cy + ny * k), u, k, hw);
    }
    px += Math.sin(a) * step;
    py -= Math.cos(a) * step;
  }
}

/** Where a stroke ends up at `u` (no sway), for hanging things off it. */
export function pointOn({ x, y, angle = 0, len, bend = 0, droop = 0 }, u) {
  const step = 0.25;
  let px = x;
  let py = y;
  const end = len * u;
  for (let s = 0; s < end; s += step) {
    const a = angle + bend * (s / len);
    px += Math.sin(a) * step;
    py -= Math.cos(a) * step;
  }
  return { x: px, y: py + droop * u * u, angle: angle + bend * u };
}

/**
 * A shaded leaf or blade: light on the left edge, dark on the right, an optional midrib.
 * `tone(u, side)` picks the palette index (side: -1 left edge, 0 middle, 1 right edge, 'rib').
 */
export function blade(g, stroke, tone, { rib = false } = {}) {
  walk(stroke, (x, y, u, k, hw) => {
    let side = 0;
    if (hw >= 1) side = k < -hw * 0.45 ? -1 : k > hw * 0.45 ? 1 : 0;
    if (rib && hw >= 1 && Math.abs(k) < 0.5 && u > 0.08 && u < 0.85) side = 'rib';
    const c = tone(u, side);
    if (c) g.px(x, y, c);
  });
}

/** Leaf outlines people recognise, as width-along-the-leaf functions (peak 1). */
export const LEAF_SHAPES = {
  lance: (u) => Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 0.8,
  oval: (u) => Math.sin(Math.PI * u) ** 0.5,
  heart: (u) => (u < 0.35 ? 0.75 + u * 0.7 : Math.sin(Math.PI * Math.min(1, (u - 0.35) / 0.65 * 0.5 + 0.5))),
  ribbon: (u) => (u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15 * 0.7),
  needle: (u) => 1 - u * 0.8,
  round: (u) => Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)),
};

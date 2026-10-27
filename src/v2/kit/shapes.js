// Shape tests for Surface.fill: each returns `(x, y) → inside?` for the pixel at x, y (sampled at
// its centre), plus a bounding box to keep fills cheap.

/** A polygon, any winding, as [[x, y], …]. */
export function poly(pts) {
  const test = (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  test.box = [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1];
  return test;
}

/** An ellipse centred at cx, cy. */
export function ellipse(cx, cy, rx, ry) {
  const test = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  test.box = [cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1];
  return test;
}

/** A segment with a radius that runs r0 → r1 along it. */
export function capsule(x0, y0, x1, y1, r0, r1 = r0) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const test = (x, y) => {
    const px = x + 0.5 - x0;
    const py = y + 0.5 - y0;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / l2));
    return Math.hypot(px - dx * t, py - dy * t) <= r0 + (r1 - r0) * t;
  };
  const r = Math.max(r0, r1);
  test.box = [Math.min(x0, x1) - r - 1, Math.min(y0, y1) - r - 1, Math.max(x0, x1) + r + 1, Math.max(y0, y1) + r + 1];
  return test;
}

/** Any of them. */
export function union(...tests) {
  const test = (x, y) => tests.some((t) => t(x, y));
  const boxes = tests.map((t) => t.box).filter(Boolean);
  if (boxes.length === tests.length) {
    test.box = [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];
  }
  return test;
}

/** Pixels on a line, Bresenham. */
export function linePts(x0, y0, x1, y1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const out = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

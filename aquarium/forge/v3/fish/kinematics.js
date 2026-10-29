// How a fish swims, as geometry.
//
// The midline carries a travelling wave (Lighthill's model): at arc length u (0 nose .. 1 tail
// joint, in body lengths) and wave phase w (turns), the sideways displacement is
//
//     z(u, w) = A(u) · sin(2π (u/λ − w)),   A(u) = a0 + a1·u + a2·u²
//
// with λ (wavelength) and the amplitude envelope set by the gait. The wave runs nose → tail, which
// is what pushes water back and the fish forward.
//
// The camera then decides what of that you see. All three looks are one projection:
//   side     pure side view: the bend is toward/away from you, so it only shortens the body
//            (x is the integral of cos θ) and swings the tail fin edge-on and back
//   raised   the same, seen from a little above (28°): the sideways wave also shows as a small
//            vertical one
//   cartoon  v1's look: no foreshortening, the wave drawn as a vertical wag, made larger
//
// Painting walks screen columns, so `columns` inverts x(u) (monotone, since cos θ > 0).

const TAU = Math.PI * 2;

/** Gaits: wavelength, amplitude envelope, and how much the fins do. */
export const GAITS = {
  anguilliform: { lambda: 0.65, a: [0.03, 0.03, 0.06], tail: 0.5, fins: 0.3 },
  subcarangiform: { lambda: 1.0, a: [0.02, -0.04, 0.12], tail: 0.8, fins: 0.5 },
  carangiform: { lambda: 1.2, a: [0.015, -0.06, 0.145], tail: 0.9, fins: 0.3 },
  thunniform: { lambda: 1.4, a: null, tail: 1.1, fins: 0.2 },
  ostraciiform: { lambda: 1.0, a: [0.004, 0, 0], tail: 0.75, fins: 0.9, rigid: true },
  labriform: { lambda: 1.0, a: [0.004, 0, 0.012], tail: 0.25, fins: 1.6, rigid: true },
  balistiform: { lambda: 1.0, a: [0.004, 0, 0.012], tail: 0.3, fins: 0.7, ripple: 1, rigid: true },
  amiiform: { lambda: 1.0, a: [0.002, 0, 0.004], tail: 0.1, fins: 0.4, ribbon: 1, rigid: true },
};

/** The camera for each look: whether the bend foreshortens, how much sideways shows as up/down. */
export const LOOKS = {
  side: { foreshorten: true, ky: 0, kyFin: 0 },
  raised: { foreshorten: true, ky: Math.sin((28 * Math.PI) / 180), kyFin: Math.sin((28 * Math.PI) / 180) },
  cartoon: { foreshorten: false, ky: 0.85, kyFin: 0.75 },
};

const ampAt = (g, u) => {
  if (!g.a) return 0.01 + 0.1 * Math.max(0, (u - 0.68) / 0.32) ** 2;
  const [a0, a1, a2] = g.a;
  return Math.max(0, a0 + a1 * u + a2 * u * u);
};

/**
 * The midline at a pose, in body lengths: z(u) and its slope. `bend` adds a C-bend (a turn),
 * curving the tail one way with the head a little the other.
 */
export function midline(gaitId, pose) {
  const g = GAITS[gaitId] ?? GAITS.subcarangiform;
  const w = pose.wave ?? 0;
  const amp = pose.amp ?? 1;
  const bend = pose.bend ?? 0;
  const z = (u) => {
    const uu = Math.max(0, u);
    return amp * ampAt(g, uu) * Math.sin(TAU * (uu / g.lambda - w)) + bend * (0.22 * uu * uu - 0.05 * uu);
  };
  const slope = (u) => (z(u + 0.002) - z(u - 0.002)) / 0.004;
  return { z, slope, gait: g };
}

/**
 * The tail fin's yaw (radians) at the hinge and at the trailing edge. Rigid swimmers wag the
 * fin itself; wave swimmers carry the body's slope into it, and the edge lags a little behind,
 * so the fin flexes like a sheet rather than swinging like a paddle.
 */
export function tailYaw(gaitId, pose) {
  const g = GAITS[gaitId] ?? GAITS.subcarangiform;
  const amp = pose.amp ?? 1;
  const w = pose.wave ?? 0;
  const at = (ww) => {
    const m = midline(gaitId, { ...pose, wave: ww });
    const own = g.rigid ? 0.7 * g.tail * amp * Math.sin(TAU * (1 / g.lambda - ww)) : 0;
    return Math.atan(m.slope(1)) * (g.rigid ? 0 : 1) + own;
  };
  const root = at(w);
  const tip = at(w - 0.12) * (1.15 + 0.25 * g.tail);
  return { root, tip };
}

/**
 * The body as screen columns. Returns `{ cols, xAt, toScreen }`:
 * - cols: one entry per pixel column from tail joint to snout tip, each `{ x, u, t, mid, back,
 *   belly }` with `mid` the projected centre line and back/belly the profile heights (px)
 * - pointAt(u): the screen point of the midline at u (fractional)
 */
export function columns(ph, pose, origin, look = 'raised') {
  const cam = LOOKS[look] ?? LOOKS.raised;
  const { L } = ph;
  const m = midline(ph.gait, pose);
  const uMin = -ph.beak / L;
  const steps = Math.max(24, Math.ceil(L * 3 * (1 - uMin)));
  const surge = 0.5 * ph.s * (pose.amp ?? 1) * Math.sin(2 * TAU * (pose.wave ?? 0)) * (cam.foreshorten ? 1 : 0.5);
  const lean = pose.lean ?? 0;
  const pts = [];
  let x = origin.x + surge;
  for (let k = 0; k <= steps; k++) {
    const u = uMin + ((1 - uMin) * k) / steps;
    if (k > 0) {
      const du = ((1 - uMin) / steps) * L;
      const th = Math.atan(m.slope(u - (1 - uMin) / steps / 2));
      x -= cam.foreshorten ? du * Math.cos(th) : du;
    }
    const y = origin.y + (pose.bob ?? 0) + m.z(u) * L * cam.ky - lean * (0.5 - u) * L * 0.18;
    pts.push({ u, x, y, th: Math.atan(m.slope(u)) });
  }
  const pointAt = (u) => {
    const f = Math.max(0, Math.min(steps, ((u - uMin) / (1 - uMin)) * steps));
    const i = Math.min(steps - 1, Math.floor(f));
    const k = f - i;
    const a = pts[i];
    const b = pts[i + 1];
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, th: a.th + (b.th - a.th) * k };
  };
  const cols = [];
  const x0 = Math.ceil(pts[pts.length - 1].x);
  const x1 = Math.floor(pts[0].x);
  let j = 0;
  for (let cx = x1; cx >= x0; cx--) {
    while (j < steps - 1 && pts[j + 1].x > cx) j++;
    const a = pts[j];
    const b = pts[j + 1];
    const k = a.x === b.x ? 0 : (a.x - cx) / (a.x - b.x);
    const u = a.u + (b.u - a.u) * k;
    const t = 1 - u;
    cols.push({ x: cx, u, t, mid: a.y + (b.y - a.y) * k, back: ph.back(t), belly: ph.belly(t) });
  }
  cols.reverse();
  const byX = new Map(cols.map((c) => [c.x, c]));
  return { cols, byX, pointAt, cam, midline: m };
}

/**
 * A fin-local point (r back from the hinge, s down from it) on screen, for a fin whose yaw goes
 * from `root` at the hinge to `tip` at r = len. Foreshortens and lifts by the camera.
 */
export function finMapper(hinge, yaw, len, cam, dir = -1) {
  return (r, s) => {
    const k = Math.min(1, Math.max(0, r / Math.max(1, len))) ** 2;
    const phi = yaw.root + (yaw.tip - yaw.root) * k;
    const along = cam.foreshorten ? r * Math.cos(phi) : r;
    return [hinge.x + dir * along, hinge.y + s + cam.kyFin * r * Math.sin(phi)];
  };
}

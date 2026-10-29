// How a plant bends in the wind, as geometry.
//
// A stem is a cantilever rooted at its base. Arc length u runs 0 at the root to 1 at the tip.
// The habit sets the envelope; the pose only sets phase and strength:
//
//     θ(u) = droop(u) + lean·L(u) + sway·A(u)·sin(2π (wind + phase − lag·u))
//     A(u) = a0 + a1·u + a2·u²
//
// Leaves sample that curve, so a marking stays on the same bit of stem when it bends.
// The look is a projection of the same angle:
//   garden   v1's flat sway: the bend shoves the stem sideways and does not shorten it
//   breeze   the bend is the tangent, so a curved tip drops
//   cartoon  the garden projection, drawn larger

const TAU = Math.PI * 2;

/** Habit gaits: amplitude envelope, phase lag, and how much the leaves and the head do. */
export const GAITS = {
  grass: { a: [0.02, 0.05, 0.55], lag: 0.15, flutter: 0.35, head: 0.05, droop: 0.05, lean: 1 },
  rosette: { a: [0.42, -0.08, 0], lag: 0.05, flutter: 1.15, head: 0.2, droop: 0.12, lean: 0.45 },
  flower: { a: [0, 0.06, 0.36], lag: 0.35, flutter: 0.85, head: 0.65, droop: 0.08, lean: 1 },
  bush: { a: [0.02, 0.08, 0.22], lag: 0.25, flutter: 1, head: 0.3, droop: 0.1, lean: 0.75 },
  tree: { a: [0.01, 0.02, 0.3], lag: 0.55, flutter: 0.75, head: 0.35, droop: 0.04, lean: 0.5 },
  vine: { a: [0.04, 0.1, 0.18], lag: 0.4, flutter: 1.05, head: 0.25, droop: 0.06, lean: 0.85 },
  cactus: { a: [0.008, 0.008, 0.035], lag: 0.1, flutter: 0.12, head: 0.2, droop: 0, lean: 0.18 },
  bamboo: { a: [0.004, 0, 0.48], lag: 0.28, flutter: 0.95, head: 0.15, droop: 0.03, lean: 0.8 },
  mushroom: { a: [0.02, 0.02, 0.05], lag: 0.2, flutter: 0.15, head: 0.95, droop: 0.02, lean: 0.22 },
};

export const LOOKS = {
  garden: { scale: 1, foreshorten: false },
  breeze: { scale: 1, foreshorten: true },
  cartoon: { scale: 1.7, foreshorten: false },
};

const gaitOf = (habit) => GAITS[habit] ?? GAITS.flower;
const lookOf = (pose) => LOOKS[pose?.look] ?? LOOKS.garden;

/** θ(u) in radians, before it is integrated into a point. */
export function windAngle(habit, pose = {}, u = 0, phase = 0) {
  const g = gaitOf(habit);
  const uu = Math.max(0, u);
  const A = Math.max(0, g.a[0] + g.a[1] * uu + g.a[2] * uu * uu);
  const wind = (pose.wind ?? 0) + phase;
  const wave = (pose.sway ?? 1) * A * Math.sin(TAU * (wind - g.lag * uu));
  const lean = (pose.lean ?? 0) * g.lean * uu * uu;
  const droop = (g.droop + (pose.restDroop ?? 0)) * uu * uu + (pose.droop ?? 0) * 0.6 * uu * uu;
  return droop + (wave + lean) * lookOf(pose).scale;
}

/**
 * Leaf flutter, radians. Zero whenever the flutter channel is a whole number, and opposite
 * from leaf to leaf via `leafPhase`, so a still pose draws still leaves.
 */
export function flutterOf(habit, pose = {}, u = 1, leafPhase = 0) {
  const g = gaitOf(habit);
  const uu = Math.max(0, Math.min(1, u));
  const amp = Math.sin(TAU * (pose.flutter ?? 0)) * Math.cos(TAU * (leafPhase ?? 0));
  return g.flutter * amp * (0.15 + 0.85 * uu * uu) * 0.55 * lookOf(pose).scale;
}

/** Extra wag of a heavy head (a flower, a cap), trailing the stem. */
export function headWag(habit, pose = {}) {
  const g = gaitOf(habit);
  return g.head * (pose.sway ?? 1) * Math.sin(TAU * ((pose.wind ?? 0) - g.head * 0.35)) * 0.7 * lookOf(pose).scale;
}

/**
 * Walk a stem. `visit` sees each sample's centre, the angle a child should inherit, and the
 * normal used to thicken the ribbon. `upto` stops a growing stem without changing its shape.
 */
function march(stroke, upto, visit) {
  const len = stroke.len ?? 0;
  const endU = Math.max(0, Math.min(1, upto));
  const x0 = stroke.x ?? 0;
  const y0 = stroke.y ?? 0;
  const angle0 = stroke.angle ?? 0;
  if (!(len > 0) || endU <= 0) {
    visit({ u: 0, cx: x0, cy: y0, a: angle0, hw: 0, nx: 1, ny: 0 });
    return;
  }
  const step = 0.25;
  const end = len * endU;
  const pose = stroke.pose ?? {};
  const foreshorten = lookOf(pose).foreshorten;
  const width = stroke.width ?? (() => 1);
  let px = x0;
  let py = y0;
  let windX = 0;
  const n = Math.max(1, Math.ceil(end / step));
  for (let i = 0; i <= n; i++) {
    const s = Math.min(end, i * step);
    const u = s / len;
    const rest = angle0 + (stroke.bend ?? 0) * u;
    const th = windAngle(stroke.habit, pose, u, stroke.phase ?? 0);
    const dir = foreshorten ? rest + th : rest;
    const coil = stroke.coil ? stroke.coil(u) : 0;
    const cx = px + (foreshorten ? 0 : windX) + coil;
    const cy = py + (stroke.droop ?? 0) * u * u;
    const hw = Math.max(0, width(u) / 2);
    visit({
      u, cx, cy, a: rest + th, hw, nx: Math.cos(dir), ny: Math.sin(dir),
    });
    if (s >= end - 1e-6) break;
    const ds = Math.min(step, end - s);
    if (!foreshorten) windX += Math.sin(th) * ds;
    px += Math.sin(dir) * ds;
    py -= Math.cos(dir) * ds;
  }
}

/** Where a bent stem is at fraction `u`, in the stroke's own units. */
export function trace(stroke, u = 1) {
  let hit = { x: stroke.x ?? 0, y: stroke.y ?? 0, angle: stroke.angle ?? 0 };
  march(stroke, u, (s) => {
    hit = { x: s.cx, y: s.cy, angle: s.a };
  });
  return hit;
}

/** Draw a bent stem. `plot(x, y, u, k, hw)` matches `walk` in the shared stroke kit. */
export function walkBent(stroke, plot) {
  march(stroke, stroke.upto ?? 1, (s) => {
    const { cx, cy, u, hw, nx, ny } = s;
    if (hw < 0.5) plot(Math.floor(cx), Math.floor(cy), u, 0, hw);
    else for (let k = -hw; k <= hw; k += 0.5) plot(Math.floor(cx + nx * k), Math.floor(cy + ny * k), u, k, hw);
  });
}

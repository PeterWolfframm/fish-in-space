// Posed geometry: topology (arch.js) + a pose → every axis as a pixel polyline and every organ
// at a pixel position. The only place a frame differs from another.
//
// Each axis is walked root to tip in `segs` steps. Its heading θ (0 = straight up, + leans right)
// starts from the parent's heading where it is attached, plus its own insertion angle, and each
// step adds:
//
//   gravitropism   pull toward up (gravi > 0) or down (gravi < 0)
//   curl, twine    a steady roll (fern crozier) or a zigzag (a bean climbing its pole)
//   wiggle         the axis's own seeded kinks
//   sway           a bend that travels up the plant:  A · flex · sin 2π(wind + φ − lag·s)
//   lean           a steady push (a gust), and droop (a wilt)
//
// flex falls with thickness (a trunk barely moves, a twig whips) and children inherit the
// parent's bent heading, so a gust ripples from trunk to leaf. Air sways with little lag; water
// sends a slow travelling wave up the stipe. Every term is periodic in `wind`, so loops close.

const TAU = Math.PI * 2;

export const MEDIA = {
  air: { amp: 0.2, lag: 0.22, lean: 0.55, flutter: 0.16, stiff: 0.55, phaseVar: 0.25, rise: 0 },
  water: { amp: 0.42, lag: 1.1, lean: 0.4, flutter: 0.1, stiff: 0.32, phaseVar: 0.12, rise: 1 },
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Shortest signed turn from a to b. */
const turn = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

const gravTarget = (theta, gravi) => (gravi >= 0 ? 0 : theta >= 0 ? Math.PI : -Math.PI);

/** A point and heading at fraction u along a posed polyline. */
export function along(ax, u) {
  const pts = ax.pts;
  if (!pts || pts.length < 2) return pts?.[0] ? { x: pts[0].x, y: pts[0].y, r: pts[0].r, th: ax.th0 ?? 0 } : null;
  const f = clamp01(u / Math.max(ax.grown, 1e-6)) * (pts.length - 1);
  const k = Math.min(pts.length - 2, Math.floor(f));
  const t = f - k;
  const a = pts[k];
  const b = pts[k + 1];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    r: a.r + (b.r - a.r) * t,
    th: Math.atan2(b.x - a.x, -(b.y - a.y)),
  };
}

/**
 * Pose the plant. `scale` px per plant unit; `origin` {x, y} is the root on the ground line.
 * Returns { axes: posed[], organs: posed[], medium }.
 */
export function posed(topo, pose, scale, origin) {
  const { axes, organs, form } = topo;
  const M = MEDIA[form.medium] ?? MEDIA.air;
  const t = clamp01(pose.growth ?? 1);
  const wind = pose.wind ?? 0;
  const sway = (pose.sway ?? 1) * (form.swayK ?? 1);
  const lean = (pose.lean ?? 0) * (form.leanK ?? 1);
  const droop = pose.droop ?? 0;
  const thick = 0.32 + 0.68 * Math.min(1, t / 0.8) ** 0.7;
  const groundY = origin.y;
  const H = form.heightU ?? 1;

  const out = [];
  for (const ax of axes) {
    const grown = clamp01((t - ax.birth) / Math.max(ax.dur, 1e-6));
    const P = ax.parent >= 0 ? out[ax.parent] : null;
    if (grown <= 0 || (P && (!P.visible || P.grown < ax.u * 0.98))) {
      out.push({ ...ax, visible: false, grown: 0, pts: [] });
      continue;
    }
    let x;
    let y;
    let th;
    let s0;
    if (P) {
      const at = along(P, ax.u);
      x = at.x;
      y = at.y;
      const fore = ax.z ? 0.55 : 1;
      // an upright shoot off a runner (caulerpa, a strawberry) ignores the runner's heading
      th = ax.up ? ax.angle * 0.3 : ax.hang ? Math.sign(ax.side || 1) * (Math.PI - 0.25) + ax.angle * 0.15 : at.th + ax.angle * fore;
      s0 = P.s0 + P.len * scale * ax.u;
    } else {
      x = origin.x + (ax.x0 ?? 0) * scale;
      y = groundY;
      th = ax.angle;
      s0 = 0;
    }
    const len = ax.len * scale * grown * (ax.z ? 0.82 : 1);
    const ds = len / ax.segs;
    const r0 = ax.r * scale * thick;
    const pts = [{ x, y, r: r0, u: 0 }];
    const gravi = ax.gravi - (ax.order > 0 ? droop * 1.2 : droop * 0.3);
    for (let k = 0; k < ax.segs; k++) {
      const u = (k + 0.5) / ax.segs;
      const rHere = r0 * (1 - (1 - ax.taper) * u * grown);
      th += (Math.min(2, Math.abs(gravi)) * turn(th, gravTarget(th, gravi))) / ax.segs;
      th += (ax.curl * (ax.side || 1)) / ax.segs;
      th += ax.wig[k] ?? 0;
      if (ax.twine) th += (k % 2 ? 1 : -1) * ax.twine;
      const flex = ax.stiff / (1 + M.stiff * rHere * 2);
      const sAbs = (s0 + ds * (k + 0.5)) / (H * scale);
      const phase = ax.phase * M.phaseVar;
      th += (sway * M.amp * flex * Math.sin(TAU * (wind + phase - M.lag * sAbs))) / ax.segs * (1 + ax.order * 0.35);
      th += (lean * M.lean * flex) / ax.segs;
      x += Math.sin(th) * ds;
      y -= Math.cos(th) * ds;
      if (y > groundY - 0.4 && !ax.ground) {
        y = groundY - 0.4;
        th = th >= 0 ? Math.min(th, Math.PI / 2) : Math.max(th, -Math.PI / 2);
      }
      if (ax.ground && y > groundY - rHere * 0.6) y = groundY - rHere * 0.6;
      pts.push({ x, y, r: r0 * (1 - (1 - ax.taper) * (k + 1) / ax.segs * grown), u: (k + 1) / ax.segs });
    }
    out.push({ ...ax, visible: true, grown, pts, s0, th0: ax.angle, rpx: r0 });
  }

  const posedOrgans = [];
  for (const o of organs) {
    const g = clamp01((t - o.birth) / Math.max(o.dur, 1e-6));
    if (g <= 0) continue;
    let x;
    let y;
    let th = 0;
    if (o.host != null) {
      const h = posedOrgans.find((p) => p.id === o.host);
      if (!h) continue;
      x = h.x + (o.dx ?? 0) * h.r;
      y = h.y + (o.dy ?? 0) * h.r;
    } else if (o.axis < 0) {
      x = origin.x + (o.x ?? 0) * scale;
      y = groundY - (o.y ?? 0) * scale;
    } else {
      const A = out[o.axis];
      if (!A?.visible || A.grown < o.u * 0.98) continue;
      const at = along(A, o.u);
      x = at.x;
      y = at.y;
      th = o.rule?.up ? 0 : at.th;
    }
    const flut = Math.sin(TAU * ((pose.flutter ?? 0) + o.phase)) * M.flutter * (pose.sway ?? 1);
    const fore = o.z ? 0.5 : 1;
    const size = o.size * scale * g;
    posedOrgans.push({
      ...o,
      g,
      x,
      y,
      th: th + (o.angle ?? 0) * fore + flut * (o.type === 'leaf' ? 1 : 0.4),
      len: size * (o.z ? 0.85 : 1),
      r: size,
      rise: M.rise,
    });
  }
  return { axes: out, organs: posedOrgans, medium: form.medium ?? 'air', groundY, t };
}

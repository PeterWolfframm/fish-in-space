// Fin dress: fish4 genes that vary how fish3's fins are cut, so two fish with the same dorsal
// choice still differ. Edge (scallops, saw teeth, a cleft, ragged tips, a pennant, spines), how
// tall each fin stands, which way it rakes, and two extra fins fish3 never drew (a second, rear
// dorsal and a belly keel).
//
// Every field's first choice / centre step is a no-op: a fish3 fish, or an f4 code written before
// these fields, paints exactly the pixels it always did. The painter reads `ctx.finDress`
// (set in frame.js) only inside edgeFin, dorsalFin, analFin and pelvicFins; without it nothing
// changes.
//
// Append only, salts fixed (2688..).

import { hash01 } from '../../pixel/rng.js';
import { stepOf } from '../../v3/fish/genome.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));
const STEPS = opts(['n3', '−3'], ['n2', '−2'], ['n1', '−1'], ['0', '·'], ['p1', '+1'], ['p2', '+2'], ['p3', '+3']);
/** A flatter bell than fish3's proportions: fins are where fish should differ. */
const FIN_BELL = [5, 10, 18, 34, 18, 10, 5];
const field = (spec) => ({ group: 'fins', dominance: 0.5, volatility: 1, ...spec, default: spec.default ?? spec.choices[0].id });
const step = (id, label, salt) => field({ id, label, salt, choices: STEPS, weights: FIN_BELL, default: '0' });

export const FIN_FIELDS = [
  field({
    id: 'finEdge',
    label: 'Fin edge',
    salt: 2688,
    choices: opts(['smooth', 'Smooth'], ['scalloped', 'Scalloped'], ['serrated', 'Serrated'], ['notched', 'Notched'], ['frayed', 'Frayed'], ['pennant', 'Pennant'], ['spiked', 'Spiked rays']),
    weights: [40, 12, 12, 10, 8, 10, 8],
  }),
  step('dorsalH', 'Dorsal height', 2704),
  step('analH', 'Anal height', 2720),
  step('pelvicL', 'Pelvic length', 2736),
  step('finRake', 'Fin rake', 2752),
  field({
    id: 'dorsal2',
    label: 'Rear dorsal',
    salt: 2768,
    choices: opts(['none', 'None'], ['adipose', 'Adipose'], ['spike', 'Spike'], ['sailet', 'Little sail'], ['finlets', 'Finlet row']),
    weights: [70, 10, 7, 6, 7],
  }),
  field({
    id: 'keel',
    label: 'Belly keel',
    salt: 2784,
    choices: opts(['none', 'None'], ['keel', 'Keel'], ['spines', 'Belly spines'], ['finlets', 'Finlet row']),
    weights: [80, 8, 6, 6],
  }),
];
export const FIN_IDS = FIN_FIELDS.map((f) => f.id);
export const FIN_STEP_IDS = ['dorsalH', 'analH', 'pelvicL', 'finRake'];

const mul = (id) => 1 + 0.14 * stepOf(id);

/**
 * What the painter needs, or undefined when every fin gene is at its no-op (so fish3 paths stay
 * untouched). `role` is 'dorsal' or 'anal' (edgeFin's caller); other edge fins are left alone.
 */
export function finDressOf(set) {
  const edge = set.finEdge ?? 'smooth';
  const rake = stepOf(set.finRake);
  const m = { dorsal: mul(set.dorsalH), anal: mul(set.analH) };
  const pelvicMul = mul(set.pelvicL);
  if (edge === 'smooth' && !rake && m.dorsal === 1 && m.anal === 1 && pelvicMul === 1) return undefined;
  const key = `${set.lineA ?? ''}${set.skin ?? ''}${set.finEdge}`;
  return {
    edge,
    pelvicMul,
    /** u runs tail (0) → head (1); a raked fin leans its mass forward, a swept one back. */
    warp(u, role) {
      if (!m[role] || !rake) return u;
      const p = 2 ** (-0.22 * rake);
      return u <= 0 ? 0 : u >= 1 ? 1 : u ** p;
    },
    /** One column's height, cut to the edge style. `i` / `n`: column index and count. */
    shape(h, u, i, n, role) {
      if (!m[role]) return h;
      let out = h * m[role];
      if (out < 1.5 || n < 3) return out;
      switch (edge) {
        case 'scalloped':
          out *= 1 - 0.45 * Math.abs(Math.sin(Math.PI * (i / Math.max(3, Math.round(n / 4))))) ** 2;
          break;
        case 'serrated':
          out -= i % 2 ? Math.min(2, Math.max(1, out * 0.3)) : 0;
          break;
        case 'notched': {
          const at = Math.abs(u - 0.45);
          if (at < 0.1) out *= 0.45 + at * 4;
          break;
        }
        case 'frayed':
          if (hash01(`${key}:${role}:${i}`, 61) < 0.3) out *= 0.55 + 0.3 * hash01(`${key}:${role}:${i}`, 62);
          break;
        default:
      }
      return out;
    },
    /** Lines over the painted fin: a pennant ray off the tallest point, or spines past the rim. */
    after(ctx, tops, dir, role) {
      if (!m[role] || tops.length < 3) return;
      const { g, fin, s, pose } = ctx;
      if (edge === 'pennant') {
        let best = 0;
        tops.forEach((t, k) => {
          if (Math.abs(t.outer[1] - t.inner[1]) > Math.abs(tops[best].outer[1] - tops[best].inner[1])) best = k;
        });
        const [x0, y0] = tops[best].outer;
        const len = Math.max(3, Math.round(5 * s * m[role]));
        let [px, py] = [x0, y0];
        for (let k = 1; k <= len; k++) {
          const x = x0 - k * 0.9;
          const y = y0 + dir * (k * 0.45) + Math.sin(Math.PI * 2 * ((pose.wave ?? 0) - k / len)) * 0.6 * (k / len);
          g.line(px, py, x, y, fin.edge);
          px = x;
          py = y;
        }
      } else if (edge === 'spiked') {
        const every = Math.max(2, Math.round(2 * Math.min(2, s)));
        tops.forEach(({ outer, inner }, k) => {
          if (k % every || Math.abs(outer[1] - inner[1]) < 2) return;
          g.line(outer[0], outer[1], outer[0] - 0.4 * s, outer[1] + dir * Math.max(1, 1.2 * s), fin.edge);
        });
      }
    },
  };
}

// ---------- the two extra fins ---------------------------------------------------------------

/** A row of little flags along one edge, between `t0` and `t1` (tuna finlets). */
function finletRow(edgeFin, ctx, dir, t0, t1, k) {
  const n = Math.max(2, Math.round((t1 - t0) / 0.035));
  for (let j = 0; j < n; j++) {
    const a = t0 + ((t1 - t0) * j) / n;
    edgeFin(ctx, dir, a, a + 0.03, (u) => 1.6 * k * u, { rays: false, rim: false });
  }
}

/** A second dorsal near the tail: an adipose nub, a spike, a little sail or a finlet row. */
function dorsal2(edgeFin, ctx) {
  const k = ctx.s * Math.min(1.5, ctx.ph.finMul);
  switch (ctx.v4?.dorsal2) {
    case 'adipose':
      edgeFin(ctx, -1, 0.12, 0.22, (u) => 1.7 * k * Math.sin(Math.PI * u) ** 0.6, { rays: false });
      break;
    case 'spike':
      edgeFin(ctx, -1, 0.15, 0.21, (u) => 3.6 * k * u ** 1.4, { rays: false });
      break;
    case 'sailet':
      edgeFin(ctx, -1, 0.1, 0.28, (u) => 3.4 * k * Math.sin(Math.PI * u) ** 0.7 * (0.6 + 0.4 * u));
      break;
    case 'finlets':
      finletRow(edgeFin, ctx, -1, 0.06, 0.22, k);
      break;
    default:
  }
}

/** A belly keel: a low ridge, a row of spines, or finlets under the tail stalk. */
function keel(edgeFin, ctx) {
  const k = ctx.s * Math.min(1.5, ctx.ph.finMul);
  const { g, fin, bodyCols, edges } = ctx;
  switch (ctx.v4?.keel) {
    case 'keel':
      edgeFin(ctx, 1, 0.45, 0.72, (u) => 1.6 * k * Math.sin(Math.PI * u) ** 0.5, { rays: false });
      break;
    case 'spines': {
      const cols = bodyCols.filter((c) => c.t >= 0.35 && c.t <= 0.75);
      const every = Math.max(2, Math.round(2.5 * Math.min(2, ctx.s)));
      cols.forEach((c, j) => {
        if (j % every) return;
        const { yv } = edges(c);
        g.line(c.x, yv + 1, c.x - 0.6 * k, yv + 1 + Math.max(1.5, 2.2 * k), fin.edge);
      });
      break;
    }
    case 'finlets':
      finletRow(edgeFin, ctx, 1, 0.06, 0.2, k);
      break;
    default:
  }
}

/** The extra fin parts, spliced after fish3's dorsal and anal fins (frame.js). */
export const FIN_PARTS = [
  { id: 'dorsal2', after: 'dorsalFin', label: 'Rear dorsal', paint: dorsal2 },
  { id: 'keel', after: 'analFin', label: 'Belly keel', paint: keel },
];

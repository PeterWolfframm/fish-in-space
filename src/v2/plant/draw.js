// Garden plants v2: v1's growth model (every part has a `birth` and a `span`, and a plant at
// growth t is the grown plant cut short) on a skeleton built in real pixels, so a size class is
// more plant, not bigger pixels: trees branch deeper and grow more leaf clusters, stems carry
// more leaves set round them by the golden angle (those behind the stem drawn darker), and
// everything is lit by the same top-left light as the other v2 kinds.
//
// Pure: genome + growth + pose in, IndexedImage out.

import { shade, mix } from '../../pixel/color.js';
import { roller } from '../../pixel/rng.js';
import { Surface, pointAt } from '../kit/surface.js';
import { ellipse, poly, capsule } from '../kit/shapes.js';
import { noise2 } from '../kit/noise.js';
import { roundUp } from '../kit/sizes.js';
import { rest } from '../anim/rig.js';
import { LEAF_SHAPES } from '../../gen/plants/stroke.js';
import { plant2Traits } from './traits.js';

export { STAGE_T } from '../../gen/plant.js';

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SOIL = '#5a3e28';
const GLOW = '#9ff7ff';

/** Canvas height per class; v1's `plant` is a herb, `plant32` a shrub. */
export const CLASS_H = { herb: 16, shrub: 32, tall: 48, tree: 64, giant: 96 };
const WIDTH = { grass: 0.75, rosette: 1, flower: 0.75, bush: 1.25, tree: 1.25, vine: 0.75, cactus: 0.75, bamboo: 0.75, mushroom: 1, conifer: 0.75 };
const HEIGHT = { low: 0.55, medium: 0.78, tall: 1 };
const LEAF_W = { lance: 1.7, oval: 2.2, heart: 2.4, needle: 1, round: 2.6 };

export function plantCanvas(genome) {
  const set = plant2Traits.normalize(genome);
  const H = CLASS_H[set.size] ?? 32;
  return { w: Math.max(16, roundUp(H * (WIDTH[set.form] ?? 1), 4)), h: H };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------- skeleton ----------

/** All the parts of the grown plant, in pixels. */
function skeleton(set, W, H) {
  const roll = roller(plant2Traits.encode(set), 5000);
  const k = H / 16;
  const kd = k ** 0.6; // detail scale: leaves and stems grow slower than the plant, so there are more of them
  const groundY = H - Math.max(2, Math.round(H * 0.12));
  const cx = W / 2;
  const Hp = (groundY - 2) * HEIGHT[set.height];
  const leafW = LEAF_W[set.leaf] * kd;
  const parts = [];
  let salt = 1;
  const r = (a, b) => roll.range(a, b, salt++);
  const ri = (a, b) => roll.int(a, b, salt++);
  const add = (p) => (parts.push(p), p);
  const stem = (st, birth, span, kind = 'plain', extra = {}) => add({ type: 'stem', st, birth, span, kind, ...extra });
  const tip = (s) => pointAt(s.st, 1);
  /** A leaf at `u` up a stem; `back` ones sit behind it. */
  const leafAt = (host, u, angle, len, width, extra = {}) => {
    const at = pointAt(host.st, u);
    return add({ type: 'leaf', st: { x: at.x, y: at.y, angle: at.angle + angle, len, bend: angle * 0.5, droop: len * 0.15 }, width, birth: host.birth + host.span * u + 0.05, span: 0.22, ...extra });
  };
  /** Leaves round a stem by the golden angle: side from sin, front/back from cos, foreshortened. */
  const phyllo = (host, from, to, n, len, width, spread = 1.1) => {
    for (let j = 0; j < n; j++) {
      const phi = j * GOLDEN + salt;
      const side = Math.sin(phi) >= 0 ? 1 : -1;
      const fore = 0.65 + 0.35 * Math.abs(Math.sin(phi));
      leafAt(host, from + ((to - from) * j) / Math.max(1, n - 1), side * spread * r(0.8, 1.15), len * fore * r(0.85, 1.1), width, { back: Math.cos(phi) < -0.2 });
    }
  };
  const bloomAt = (x, y, size, birth) => add({ type: 'bloom', x, y, size, birth, span: 0.25 });
  const fruitAt = (x, y, size, birth, extra = {}) => add({ type: 'fruit', x, y, size, birth, span: 0.2, ...extra });
  const blob = (x, y, rr, birth, back) => add({ type: 'blob', x, y, r: rr, birth, span: 0.35, back });

  switch (set.form) {
    case 'grass': {
      const n = Math.round(ri(3, 5) * k ** 0.4);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const s = stem({ x: cx + t * 2.5 * kd, y: groundY, angle: t * 0.7 + r(-0.1, 0.1), len: Hp * r(0.75, 1), bend: t * 0.5, width: () => Math.max(1, 0.9 * kd) }, 0.02 + Math.abs(t) * 0.2, 0.55, 'leafy');
        if (set.fruit !== 'none' || i % 2 === 0) fruitAt(tip(s).x, tip(s).y, kd, 0.7 + r(0, 0.15), { grain: true });
      }
      break;
    }
    case 'rosette': {
      const n = Math.round(ri(5, 7) * k ** 0.35);
      const leaves = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        leaves.push({ type: 'leaf', st: { x: cx + t * kd, y: groundY, angle: t * 2.6, len: Hp * 0.5 * (1 - Math.abs(t) * 0.5) + 1.5 * kd, bend: t * 0.6, droop: 0.5 * kd }, width: leafW * 1.2, birth: 0.04 + Math.abs(t) * 0.4, span: 0.3, back: Math.abs(t) > 0.3 });
      }
      leaves.sort((a, b) => Math.abs(b.st.angle) - Math.abs(a.st.angle)).forEach(add);
      if (set.bloom !== 'none') {
        const s = stem({ x: cx, y: groundY - 1, angle: r(-0.1, 0.1), len: Hp * 0.75, width: () => Math.max(1, 0.8 * kd) }, 0.55, 0.2);
        bloomAt(tip(s).x, tip(s).y, 1.8 * kd, 0.72);
      }
      break;
    }
    case 'flower': {
      const heads = Math.max(1, Math.round(k ** 0.5 * 0.8));
      for (let h = 0; h < heads; h++) {
        const t = heads === 1 ? 0 : h / (heads - 1) - 0.5;
        const s = stem({ x: cx + t * 3 * kd, y: groundY, angle: r(-0.12, 0.12) + t * 0.5, len: Hp * (1 - Math.abs(t) * 0.3), bend: r(-0.25, 0.25), width: () => Math.max(1, 1.1 * kd) }, 0.03 + Math.abs(t) * 0.08, 0.55);
        phyllo(s, 0.15, 0.7, Math.round(ri(2, 4) * k ** 0.3), r(2.5, 4) * kd, leafW);
        bloomAt(tip(s).x, tip(s).y, (set.bloom === 'spike' ? 2.4 : 2.2) * kd, 0.62 + h * 0.04);
      }
      break;
    }
    case 'bush': {
      const n = Math.round(ri(3, 4) * k ** 0.3);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        const s = stem({ x: cx + t * 2 * kd, y: groundY, angle: t * 1.4, len: Hp * r(0.6, 0.85), bend: t * 0.4, width: () => Math.max(1, 0.9 * kd) }, 0.03 + Math.abs(t) * 0.1, 0.5, 'woody');
        // Bigger bushes branch once more.
        // A leafy mass behind the twigs, so a bush reads as a bush and not a bundle of sticks.
        for (let c = 0; c < 1 + Math.round(k ** 0.5); c++) {
          const p = pointAt(s.st, r(0.6, 1));
          blob(p.x + r(-1, 1) * kd, p.y + r(-0.5, 0.8) * kd, r(1.6, 2.2) * kd, s.birth + s.span * 0.6, true);
        }
        if (k >= 3) {
          const at = pointAt(s.st, 0.55);
          const b = stem({ x: at.x, y: at.y, angle: at.angle + (t < 0 ? -0.7 : 0.7), len: s.st.len * 0.45, bend: 0.2, width: () => Math.max(1, 0.7 * kd) }, s.birth + s.span * 0.55, 0.25, 'woody');
          phyllo(b, 0.3, 1, Math.round(4 * k ** 0.3), r(2.2, 3.2) * kd, Math.min(2.4 * kd, leafW * 1.2));
        }
        phyllo(s, 0.3, 1, Math.round(4 * k ** 0.35), r(2.2, 3.2) * kd, Math.min(2.4 * kd, leafW * 1.2));
        if (set.bloom !== 'none' && i % 2 === 0) bloomAt(tip(s).x, tip(s).y, 1.2 * kd, 0.68 + i * 0.04);
        if (set.fruit !== 'none') for (let f = 0; f < Math.max(1, Math.round(k ** 0.5)); f++) {
          const p = pointAt(s.st, r(0.55, 0.95));
          fruitAt(p.x + r(-1, 1) * kd, p.y, kd, 0.82 + r(0, 0.1));
        }
      }
      break;
    }
    case 'tree': {
      // Grow the tree, measure how high the crown reached, and regrow it with a shorter trunk
      // until the crown fits under the top edge. Same rolls each try, so only the scale changes.
      const salt0 = salt;
      const n0 = parts.length;
      let trunkLen = Hp * 0.5;
      for (let attempt = 0; attempt < 5; attempt++) {
        salt = salt0;
        parts.length = n0;
        const trunkW = Math.max(2, 1.9 * k ** 0.7);
        const maxDepth = 1 + Math.round(Math.log2(k));
        const cr0 = (set.leaf === 'needle' ? 2 : 2.6) * kd;
        const trunk = stem({ x: cx, y: groundY, angle: r(-0.06, 0.06), len: Math.max(2, trunkLen), bend: r(-0.15, 0.15), width: (u) => trunkW * (1 - u * 0.4) }, 0.02, 0.4, 'woody');
        const tips = [];
        const branch = (host, depth) => {
          if (depth > maxDepth) {
            tips.push({ ...tip(host), birth: host.birth + host.span });
            return;
          }
          const kids = depth === 1 ? ri(2, 3) : 2;
          for (let j = 0; j < kids; j++) {
            const side = j % 2 ? 1 : -1;
            const u = kids === 2 ? r(0.7, 1) : 0.55 + j * 0.2;
            const at = pointAt(host.st, u);
            const w0 = host.st.width(u) * 0.7;
            const b = stem({ x: at.x, y: at.y, angle: at.angle * 0.5 + side * r(0.55, 0.95), len: host.st.len * r(0.58, 0.72), bend: -side * 0.25, width: (v) => Math.max(1, w0 * (1 - v * 0.4)) }, host.birth + host.span * u, 0.22, 'woody');
            branch(b, depth + 1);
          }
          tips.push({ ...tip(host), birth: host.birth + host.span });
        };
        branch(trunk, 1);
        // A canopy of leaf clusters round the twig tips: back clusters first, darker.
        const cr = cr0;
        const back = [];
        const front = [];
        tips.forEach((p, i) => {
          const n = 1 + (k >= 2 ? 1 : 0) + (k >= 4 ? 1 : 0);
          for (let j = 0; j < n; j++) {
            const b = { x: p.x + r(-1, 1) * cr, y: p.y + r(-1, 0.6) * cr, r: cr * r(0.8, 1.2), birth: Math.min(0.75, 0.38 + p.birth * 0.3 + i * 0.01) };
            (j === 0 && i % 2 ? back : j === 1 ? back : front).push(b);
          }
        });
        for (const b of back) blob(b.x, b.y, b.r, b.birth, true);
        for (const b of front) blob(b.x, b.y, b.r, b.birth, false);
        const spots = front.length ? front : back;
        if (set.fruit !== 'none') spots.forEach((c, i) => i % 2 === 0 && fruitAt(c.x + r(-1, 1) * cr * 0.6, c.y + r(0, 1) * cr * 0.6, kd, 0.85 + (i % 5) * 0.02));
        else if (set.bloom !== 'none') spots.forEach((c, i) => i % 2 === 0 && bloomAt(c.x + r(-1, 1) * cr * 0.6, c.y - r(0, 1) * cr * 0.6, kd, 0.72 + (i % 5) * 0.04));
        const top = Math.min(...parts.slice(n0).filter((q) => q.type === 'blob').map((q) => q.y - q.r * 1.2));
        if (top >= 1) break;
        trunkLen *= Math.max(0.5, (Hp - (1 - top)) / Hp) ** 1.4;
      }
      break;
    }
    case 'conifer': {
      const trunkW = Math.max(1, 1.4 * k ** 0.6);
      const trunk = stem({ x: cx, y: groundY, angle: r(-0.04, 0.04), len: Hp, width: (u) => trunkW * (1 - u * 0.6) }, 0.02, 0.6, 'woody');
      const tiers = 2 + Math.round(1.6 * k ** 0.5);
      const baseW = Math.min(W / 2 - 1, Hp * 0.38);
      for (let i = 0; i < tiers; i++) {
        const u0 = 0.18 + (0.8 * i) / tiers;
        const u1 = Math.min(1.04, u0 + 0.36);
        add({ type: 'tier', host: trunk, u0, u1, w: baseW * (1 - (i / tiers) * 0.75), birth: 0.12 + (i / tiers) * 0.5, span: 0.3, i });
      }
      if (set.fruit !== 'none') for (let i = 0; i < Math.round(2 * k ** 0.5); i++) {
        const p = pointAt(trunk.st, r(0.25, 0.7));
        fruitAt(p.x + r(-0.6, 0.6) * baseW, p.y, kd, 0.86, { cone: true });
      }
      break;
    }
    case 'vine': {
      add({ type: 'stake', x: cx + 1.5 * kd, y: groundY, len: Hp + 0.5, w: Math.max(1, Math.round(kd * 0.8)), birth: 0, span: 0.01 });
      const amp = 1.4 * kd;
      const s = stem({ x: cx, y: groundY, angle: 0.08, len: Hp, coil: (u) => Math.sin(u * Math.PI * (3.2 + k * 0.4)) * amp * Math.min(1, u * 3), width: () => Math.max(1, 0.8 * kd) }, 0.03, 0.62, 'plain');
      const n = Math.round(ri(4, 6) * k ** 0.4);
      for (let i = 0; i < n; i++) {
        const u = 0.15 + i * (0.78 / n);
        const at = pointAt(s.st, u);
        const side = i % 2 ? 1 : -1;
        add({ type: 'leaf', st: { x: at.x + s.st.coil(u), y: at.y, angle: side * 1.2, len: r(2, 3) * kd, bend: side * 0.4, droop: 0.4 * kd }, width: Math.max(1.8 * kd, leafW), birth: s.birth + s.span * u + 0.04, span: 0.2, back: i % 3 === 2 });
      }
      if (set.fruit !== 'none') for (let i = 0; i < Math.round(2 * k ** 0.4); i++) {
        const u = 0.45 + i * 0.25;
        const at = pointAt(s.st, Math.min(0.95, u));
        fruitAt(at.x + s.st.coil(u) + (i % 2 ? 1.5 : -1.5) * kd, at.y + kd, kd, 0.84 + i * 0.03);
      } else if (set.bloom !== 'none') bloomAt(tip(s).x + s.st.coil(1), tip(s).y, 1.3 * kd, 0.75);
      break;
    }
    case 'cactus': {
      const bw = Math.max(3, 4 * k ** 0.75);
      const dome = (w, cap) => (u) => (u > 1 - cap ? w * Math.sqrt(Math.max(0, 1 - ((u - (1 - cap)) / cap) ** 2)) : w);
      const body = stem({ x: cx, y: groundY, angle: 0, len: Hp * 0.85, width: dome(bw, 0.15) }, 0.02, 0.5, 'succulent');
      const arms = set.height === 'low' ? 0 : ri(1, 2) + (k >= 4 ? 1 : 0);
      for (let i = 0; i < arms; i++) {
        const side = i % 2 ? 1 : -1;
        const at = pointAt(body.st, r(0.3, 0.6));
        const out = { x: at.x + side * bw * 0.35, y: at.y, angle: side * 1.4, len: bw * 0.6, width: () => bw * 0.5 };
        stem(out, 0.45 + i * 0.08, 0.1, 'succulent');
        const elbow = pointAt(out, 1);
        stem({ x: elbow.x, y: elbow.y + bw * 0.12, angle: 0, len: Hp * r(0.22, 0.34), width: dome(bw * 0.5, 0.25) }, 0.55 + i * 0.08, 0.18, 'succulent');
      }
      if (set.bloom !== 'none') bloomAt(tip(body).x, tip(body).y, 1.4 * kd, 0.75);
      else if (set.fruit !== 'none') fruitAt(tip(body).x + kd, tip(body).y + 0.5, kd, 0.8);
      break;
    }
    case 'bamboo': {
      const n = Math.round(ri(1, 3) * k ** 0.35);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const s = stem({ x: cx + t * 8 * kd, y: groundY, angle: t * 0.2, len: Hp * r(0.85, 1) * (1 - Math.abs(t) * 0.25), width: () => Math.max(2, 1.3 * kd), node: Math.max(3, 3.2 * kd) }, 0.02 + Math.abs(t) * 0.15, 0.55, 'jointed');
        phyllo(s, 0.4, 0.98, Math.round(3 * k ** 0.4), r(3.5, 5) * kd, 1.2 * kd, 1.5);
      }
      break;
    }
    case 'mushroom': {
      const caps = ri(1, 3) + (k >= 3 ? 1 : 0);
      for (let i = 0; i < caps; i++) {
        const big = i === 0;
        const x = big ? cx : cx + (i % 2 ? -1 : 1) * (3 + i) * kd + r(-0.5, 0.5);
        const len = (big ? Hp * 0.55 : Hp * 0.3) + kd;
        const s = stem({ x, y: groundY, angle: r(-0.1, 0.1), len, width: () => Math.max(1, (big ? 2 : 1.2) * kd) }, 0.05 + i * 0.12, 0.45, 'mush');
        add({ type: 'cap', x: tip(s).x, y: tip(s).y, size: (big ? 3.6 : 2.2) * kd, birth: s.birth + 0.1, span: 0.5 });
      }
      break;
    }
    default:
  }
  return { parts, groundY, cx, k, kd, Hp };
}

// ---------- drawing ----------

function materials(s, set) {
  const hexOf = (id) => plant2Traits.choiceOf(set, id)?.hex ?? '#888888';
  const glow = set.glow === 'glow' || set.glow === 'crystal';
  const lit = (hex) => (glow ? mix(hex, GLOW, set.glow === 'crystal' ? 0.45 : 0.25) : hex);
  const leaf = lit(hexOf('leafColor'));
  const petal = set.bloom !== 'none' ? hexOf('petal') : '#f5c842';
  const fruit = set.fruit !== 'none' ? hexOf('fruitColor') : '#d23a3a';
  const capHex = set.bloom !== 'none' ? petal : set.fruit !== 'none' ? fruit : '#c8553a';
  return {
    leaf: s.material(leaf, { steps: 5 }),
    leafBack: s.material(mix(shade(leaf, 0.72), '#2b3a5a', 0.18), { steps: 4 }),
    young: s.material(shade(leaf, 1.25), { steps: 4 }),
    stem: s.material(hexOf('stemColor'), { steps: 4 }),
    bark: s.material(set.stemColor === 'green' ? '#6e5236' : hexOf('stemColor'), { steps: 5 }),
    petal: s.material(lit(petal), { steps: 5, shift: 18 }),
    heart: s.material(set.bloom === 'daisy' ? '#c8871b' : shade(petal, 0.5), { steps: 4 }),
    bud: s.material(shade(leaf, 0.85), { steps: 4 }),
    fruit: s.material(fruit, { steps: 5, light: 0.7 }),
    grain: s.material('#e8b820', { steps: 4 }),
    grainGreen: s.material('#c8c070', { steps: 4 }),
    cone: s.material('#8a5a32', { steps: 4 }),
    soil: s.material(SOIL, { steps: 4, shift: 14 }),
    seed: s.material('#c9a66b', { steps: 3 }),
    cap: s.material(capHex, { steps: 5 }),
    gill: s.material('#e8dcc4', { steps: 3 }),
    stake: s.material('#a07c50', { steps: 3 }),
  };
}

/** One plant at growth `t` in a pose (wind, flutter, bloom, glow). */
export function drawPlant2(genome, t = 1, pose = rest('plant')) {
  const set = plant2Traits.normalize(genome);
  const { w: W, h: H } = plantCanvas(set);
  const s = new Surface(W, H);
  const m = materials(s, set);
  const { parts, groundY, cx, k, kd, Hp } = skeleton(set, W, H);
  const seed = plant2Traits.encode(set);
  const phase = pose.wind * TAU;
  const amp = 1.3 * k ** 0.8 * pose.sway;
  const lean = pose.lean * 3 * k ** 0.8;
  // Wind moves things by their height: rooted at the ground, most at the top.
  const disp = (y) => {
    const v = clamp01((groundY - y) / Math.max(1, Hp));
    return (Math.sin(phase - v * 1.8) * amp + lean) * v * v;
  };
  const swayed = (st) => {
    const end = pointAt(st, 1);
    return (u) => disp(st.y + (end.y - st.y) * u) + (st.coil ? st.coil(u) : 0);
  };
  const flutter = (u) => Math.sin(pose.flutter * TAU + u * 3) * 0.5 * u * u;

  // Soil: a lit mound.
  const soil = ellipse(cx, groundY + Math.max(1, kd * 1.2), Math.max(3, 4.2 * k ** 0.85), Math.max(1.5, 1.6 * k ** 0.7));
  s.fill((x, y) => soil(x, y) && y < H, { box: soil.box, mat: m.soil, seam: false });
  if (H >= 48) s.tone((x, y, i) => s.mat[i] === m.soil && noise2(`${seed}:soil`, 1.5)(x, y) > 0.7, 1, { box: soil.box });
  if (t < 0.14) {
    const e = ellipse(cx, groundY, Math.max(1, 1.1 * kd), Math.max(0.8, 0.8 * kd));
    s.fill(e, { box: e.box, mat: m.seed });
    if (t > 0.05) s.set(cx, groundY - 1, m.young, 0.7);
  }

  const layer = (p) => (p.back ? 0 : p.type === 'stake' ? 0 : p.type === 'stem' || p.type === 'tier' ? 1 : p.type === 'leaf' || p.type === 'blob' ? 2 : 3);
  const order = parts.map((p, i) => [p, i]).sort((a, b) => layer(a[0]) - layer(b[0]) || a[1] - b[1]).map(([p]) => p);

  for (const p of order) {
    const grown = clamp01((t - p.birth) / p.span);
    if (grown <= 0) continue;
    switch (p.type) {
      case 'stake': {
        const top = groundY - p.len;
        s.fill((x, y) => x >= Math.floor(p.x) && x < Math.floor(p.x) + p.w && y >= top && y <= groundY, { box: [p.x - 1, top - 1, p.x + p.w + 1, groundY + 1], mat: m.stake, seam: false });
        break;
      }
      case 'stem': {
        const thin = 0.55 + 0.45 * grown;
        const st = { ...p.st, upto: grown, sway: swayed(p.st), width: (u) => Math.max(1, (p.st.width ? p.st.width(u) : 1) * thin) };
        if (p.kind === 'succulent') {
          // Ribs as grooves, spines on the edges.
          const ribs = Math.max(2, Math.round(st.width(0) / 2.2));
          s.stroke(st, { mat: m.leaf, light: (u, a, v) => v - (Math.abs(Math.sin((a + 1) * Math.PI * ribs * 0.5)) < 0.25 && st.width(u) >= 4 ? 0.22 : 0) });
          if (grown > 0.4) {
            const spine = s.color('#e8dcb0');
            const n = Math.floor(p.st.len * grown);
            for (let d = 2; d < n; d += Math.max(2, Math.round(2.5 * kd))) {
              const u = d / p.st.len;
              const at = pointAt(p.st, u);
              const hw = st.width(u) / 2;
              const dx = st.sway(u);
              s.pin(at.x + dx - hw - 1, at.y, spine);
              s.pin(at.x + dx + hw, at.y, spine);
            }
          }
        } else if (p.kind === 'jointed') {
          s.stroke(st, { mat: m.leaf, light: (u, a, v) => (Math.round(u * p.st.len) % Math.round(p.st.node) === 0 && u > 0.05 ? v * 0.55 : v) });
        } else if (p.kind === 'mush') {
          s.stroke(st, { mat: m.gill });
        } else if (p.kind === 'leafy') {
          s.stroke(st, { mat: (u) => (u > 0.4 ? (u > 0.75 ? m.young : m.leaf) : m.stem) });
        } else {
          s.stroke(st, { mat: p.kind === 'woody' ? m.bark : m.stem });
          if (p.kind === 'woody' && st.width(0) >= 3) {
            const bark = noise2(`${seed}:bark`, 1.4);
            s.tone((x, y, i) => s.mat[i] === m.bark && bark(x * 3, y * 0.6) > 0.68, -1);
          }
        }
        break;
      }
      case 'leaf': {
        const shape = LEAF_SHAPES[set.leaf] ?? LEAF_SHAPES.lance;
        const len = p.st.len * (0.35 + 0.65 * grown);
        const base = { ...p.st, len };
        const dx0 = disp(p.st.y);
        const st = {
          ...base, x: p.st.x + dx0,
          sway: (u) => flutter(u) * kd + (disp(p.st.y - len * u) - dx0) * 0.4,
          width: (u) => (u < 0.1 ? Math.max(1, kd * 0.6) : Math.max(1, p.width * (0.5 + 0.5 * grown) * shape(Math.min(1, (u - 0.1) / 0.9)))),
        };
        s.stroke(st, { mat: grown < 0.4 ? m.young : p.back ? m.leafBack : m.leaf, profile: p.width >= 2.5 ? 'fold' : 'round', bias: p.back ? -0.1 : 0 });
        break;
      }
      case 'blob': {
        const rr = p.r * (0.4 + 0.6 * grown);
        const x = p.x + disp(p.y);
        // A leafy edge: a lumpy circle, lumps from noise round the rim.
        const lumps = noise2(`${seed}:${Math.round(p.x)}:${Math.round(p.y)}`, Math.max(1, rr * 0.45));
        const test = (px, py) => {
          const d = Math.hypot(px + 0.5 - x, (py + 0.5 - p.y) * 1.08);
          return d <= rr * (0.82 + 0.3 * lumps(px, py));
        };
        test.box = [x - rr * 1.2 - 1, p.y - rr * 1.2 - 1, x + rr * 1.2 + 1, p.y + rr * 1.2 + 1];
        s.fill(test, { box: test.box, mat: p.back ? m.leafBack : m.leaf, dome: rr * 1.1 });
        // Clumps of leaves inside a big blob catch the light separately.
        if (rr >= 4) s.tone((px, py, i) => test(px, py) && s.mat[i] !== m.fruit && lumps(px * 2.3, py * 2.3) > 0.72, 1, { box: test.box });
        break;
      }
      case 'tier': {
        const a = pointAt(p.host.st, Math.min(1, p.u1 * (0.6 + 0.4 * grown)));
        const b = pointAt(p.host.st, p.u0);
        const w = p.w * (0.4 + 0.6 * grown);
        const dxA = disp(a.y);
        const dxB = disp(b.y);
        // A jagged skirt along the bottom edge.
        const teeth = Math.max(2, Math.round(w / Math.max(1.5, kd)));
        const pts = [[a.x + dxA, a.y]];
        for (let j = 0; j <= teeth; j++) {
          const f = j / teeth;
          pts.push([b.x + dxB + w * (1 - 2 * f), b.y + (j % 2 ? -kd * 0.8 : 0) + Math.abs(f - 0.5) * kd]);
        }
        const tri = poly(pts.reverse());
        s.fill(tri, { box: tri.box, mat: p.i % 2 ? m.leaf : m.leafBack, dome: Math.max(2, w * 0.5) });
        break;
      }
      case 'bloom':
        bloom(s, m, set, p.x + disp(p.y), p.y, p.size, grown * (0.55 + 0.45 * pose.bloom), kd);
        break;
      case 'cap': {
        const rr = p.size * (0.35 + 0.65 * grown);
        const x = p.x + disp(p.y);
        const y = p.y + 0.5;
        const dome = ellipse(x, y, rr, rr * 0.7);
        s.fill((px, py) => dome(px, py) && py + 0.5 <= y + 0.5, { box: dome.box, mat: m.cap });
        s.fill((px, py) => py === Math.floor(y + 0.5) && Math.abs(px + 0.5 - x) <= rr * 0.85, { box: [x - rr - 1, y - 1, x + rr + 1, y + 2], mat: m.gill, flat: 0.8 });
        if (grown > 0.5 && rr >= 3) {
          const dot = s.color('#f4f1e6');
          const roll = roller(`${seed}:${Math.round(p.x)}`, 0);
          for (let j = 0; j < Math.round(rr * 0.8); j++) {
            const a = roll.range(Math.PI * 1.1, Math.PI * 1.9, j);
            const d = roll.range(0.3, 0.75, 20 + j);
            s.pin(x + Math.cos(a) * rr * d, y + Math.sin(a) * rr * 0.7 * d, dot);
          }
        }
        break;
      }
      case 'fruit': {
        if (grown < 0.2) break;
        const ripe = grown >= 0.9;
        const x = p.x + disp(p.y);
        if (p.grain || set.fruit === 'grain') {
          const c = capsule(x, p.y - p.size * 1.6, x, p.y, Math.max(0.5, p.size * 0.6));
          s.fill(c, { box: c.box, mat: ripe ? m.grain : m.grainGreen });
          if (p.size >= 2) s.tone((px, py) => c(px, py) && py % 2 === 0, -1, { box: c.box });
        } else if (p.cone || set.fruit === 'pod') {
          const c = capsule(x, p.y, x, p.y + p.size * 1.8, Math.max(0.6, p.size * 0.55));
          s.fill(c, { box: c.box, mat: p.cone ? m.cone : ripe ? m.fruit : m.bud });
        } else {
          const rr = Math.max(0.8, p.size * (set.fruit === 'round' ? 1.2 : 0.85));
          const e = ellipse(x + 0.5, p.y + 0.5, rr, rr);
          s.fill(e, { box: e.box, mat: ripe ? m.fruit : m.bud });
        }
        break;
      }
      default:
    }
  }

  // Rare plants: sparkles that twinkle with the glow channel.
  if (set.glow !== 'none' && t >= 0.6) {
    const roll = roller(seed, 7000);
    const glow = s.color(GLOW, Math.round(170 + 85 * pose.glow));
    const n = (set.glow === 'sparkle' ? 3 : set.glow === 'crystal' ? 4 : 2) + Math.round(k ** 0.5) - 1;
    const top = groundY - Hp;
    for (let i = 0; i < n; i++) {
      const x = roll.range(W * 0.15, W * 0.85, i);
      const y = roll.range(top, top + Hp * 0.7, 10 + i);
      s.pin(x, y, glow);
      if (set.glow !== 'glow' && H > 16 && pose.glow > 0.3) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) s.pin(x + dx, y + dy, glow);
    }
  }
  return s.render({ dither: H >= 48 ? 0.08 : 0, outline: H > 16 });
}

function bloom(s, m, set, x, y, size, grown, kd) {
  if (grown < 0.45) {
    const e = ellipse(x + 0.5, y + 0.5, Math.max(0.8, size * 0.35), Math.max(0.9, size * 0.5));
    s.fill(e, { box: e.box, mat: grown > 0.3 ? m.petal : m.bud });
    return;
  }
  const r = size * (0.6 + 0.4 * grown);
  // Petals darken toward the heart of the flower.
  const toHeart = (cx, cy) => (px, py, v) => v * (0.75 + 0.25 * Math.min(1, Math.hypot(px + 0.5 - cx, py + 0.5 - cy) / Math.max(1, r)));
  switch (set.bloom) {
    case 'daisy': {
      const n = r >= 3 ? 12 : 8;
      for (let a = 0; a < n; a++) {
        const ang = (a / n) * TAU;
        s.stroke({ x: x + 0.5, y: y + 0.5, angle: ang, len: r, width: (u) => Math.max(1, r * 0.5 * LEAF_SHAPES.oval(u)) }, { mat: m.petal, profile: 'flat', light: (u, _a, v) => v * (0.75 + 0.3 * u) });
      }
      const h = ellipse(x + 0.5, y + 0.5, Math.max(0.8, r * 0.38), Math.max(0.8, r * 0.38));
      s.fill(h, { box: h.box, mat: m.heart });
      break;
    }
    case 'cup': {
      const e = ellipse(x + 0.5, y, r, r * 0.95);
      s.fill((px, py) => e(px, py) && (py >= y - r * 0.3 || Math.abs(px + 0.5 - x - 0.5) > r * 0.35), { box: e.box, mat: m.petal, light: toHeart(x + 0.5, y - r * 0.3) });
      break;
    }
    case 'spike': {
      const n = Math.round(r * 2.2);
      for (let i = 0; i < n; i++) {
        const w = (i % 2 ? 0.6 : 0.9) * r * (1 - (i / n) * 0.5);
        const e = ellipse(x + 0.5, y - i + 0.5, Math.max(0.6, w / 2), 0.7 + kd * 0.2);
        s.fill(e, { box: e.box, mat: m.petal, bias: i % 3 === 0 ? 0.12 : 0 });
      }
      break;
    }
    case 'cluster': {
      const n = r >= 3 ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.4;
        const e = ellipse(x + 0.5 + Math.cos(a) * r * 0.6, y + 0.5 + Math.sin(a) * r * 0.45, Math.max(0.7, r * 0.42), Math.max(0.7, r * 0.42));
        s.fill(e, { box: e.box, mat: m.petal });
      }
      break;
    }
    case 'bell': {
      const e = ellipse(x + 0.5, y + r * 0.4, r * 0.75, r * 0.9);
      s.fill((px, py) => e(px, py) && py <= y + r * 0.9, { box: e.box, mat: m.petal });
      s.tone((px, py) => Math.abs(py - Math.floor(y + r * 0.9)) < 1 && e(px, py), -2, { box: e.box });
      break;
    }
    default: {
      const e = ellipse(x + 0.5, y + 0.5, Math.max(0.8, r * 0.6), Math.max(0.8, r * 0.6));
      s.fill(e, { box: e.box, mat: m.petal });
    }
  }
}

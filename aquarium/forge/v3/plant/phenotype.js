// From genome to plant: the species resolved, the proportions applied, and one adult skeleton
// of parts. A sprout is that skeleton drawn short. Pure, and cached by code: a frame only
// changes the pose.

import { roller } from '../../pixel/rng.js';
import { mix } from '../../pixel/color.js';
import { plant3Traits, stepOf, jitterKey, hexOf, normalizePlant } from './genome.js';
import { resolveSpec } from './habits.js';

/** Pixel height of the 16-unit design, per size class. Herb is v1's 16. */
export const CLASS_H = { herb: 16, shrub: 32, tall: 48, tree: 64, giant: 96 };

const GROUND = 13;
const LEAF_W = { lance: 1.7, oval: 2.2, heart: 2.4, needle: 1, round: 2.6 };
const HEIGHT = { low: 0.55, medium: 0.78, tall: 1 };

/** What the two pigment slots show. Only a matching pair leaves green behind. */
export function genetics(set) {
  const a = set.geneA ?? 'green';
  const b = set.geneB ?? 'green';
  const pigment = a === b ? a : 'green';
  const carries = [...new Set([a, b].filter((x) => x !== 'green' && x !== pigment))];
  return { pigment, carries };
}

/** A short line for the editor: the species, and what the genes show and hide. */
export function describePlant(genome) {
  const set = normalizePlant(genome);
  const g = genetics(set);
  const spec = resolveSpec(set);
  const bits = [spec.label];
  const size = plant3Traits.choiceOf(set, 'size')?.label;
  if (size) bits.push(size.toLowerCase());
  if (g.pigment !== 'green') bits.push(g.pigment);
  if (g.carries.length) bits.push(`carries ${g.carries.join(', ')}`);
  return bits.join(' · ');
}

const cache = new Map();

/** Everything the painter needs that does not move. */
export function phenotype(genome) {
  const set = normalizePlant(genome);
  const code = plant3Traits.encode(set);
  const hit = cache.get(code);
  if (hit) return hit;
  const ph = build(set);
  if (cache.size > 400) cache.clear();
  cache.set(code, ph);
  return ph;
}

function build(set) {
  const spec = resolveSpec(set);
  const gen = genetics(set);
  const classH = CLASS_H[set.size] ?? 32;
  const s = classH / 16;
  const seed = jitterKey(set);
  const roll = roller(seed, 6100);
  const parts = skeleton(set, spec, roll);
  const leaf = tintLeaf(hexOf(set, 'leafColor'), gen.pigment);
  const petal = set.bloom !== 'none' || spec.forceBloom ? hexOf(set, 'petal') : '#f5c842';
  const fruit = set.fruit !== 'none' ? hexOf(set, 'fruitColor') : '#d23a3a';
  return {
    set,
    spec,
    habit: spec.habit,
    seed,
    classH,
    s,
    pigment: gen.pigment,
    carries: gen.carries,
    parts,
    colors: {
      leaf,
      stem: hexOf(set, 'stemColor'),
      petal,
      fruit,
      cap: set.bloom !== 'none' ? petal : set.fruit !== 'none' ? fruit : '#c8553a',
    },
  };
}

function tintLeaf(hex, pigment) {
  if (pigment === 'silver') return mix(hex, '#b7c9c2', 0.62);
  if (pigment === 'purple') return mix(hex, '#6d3d86', 0.72);
  if (pigment === 'gold') return mix(hex, '#e2c15a', 0.38);
  return hex;
}

/**
 * The adult plant in a 16-unit box (ground at y 13). Parts point at their parent stem by index
 * so the painter can hang them on the bent curve. `foliage` says what winter does with them:
 * `keep` stays, `blade` turns to straw, `drop` falls off a deciduous plant.
 */
function skeleton(set, spec, roll) {
  const heightK = HEIGHT[set.height] ?? 0.78;
  const H = 11.5 * heightK * (1 + 0.08 * stepOf(set.stemH));
  const spread = 1 + 0.1 * stepOf(set.spread);
  const leafMul = 1 + 0.1 * stepOf(set.leafSize);
  const thick = 1 + 0.12 * stepOf(set.thick);
  const leafW = (LEAF_W[set.leaf] ?? 1.8) * leafMul;
  const parts = [];
  const stems = [];
  let salt = 1;
  const r = (a, b) => roll.range(a, b, salt++);
  const ri = (a, b) => roll.int(a, b, salt++);

  const addStem = (stroke, birth, span, extra = {}) => {
    const stem = stems.length;
    const part = {
      type: 'stem', stem, stroke, birth, span,
      phase: extra.phase ?? 0,
      foliage: extra.foliage ?? 'keep',
      habit: extra.habit,
      attach: extra.attach,
      woody: extra.woody,
      leafy: extra.leafy,
      jointed: extra.jointed,
      succulent: extra.succulent,
      mushroom: extra.mushroom,
    };
    stems.push(part);
    parts.push(part);
    return stem;
  };
  const add = (part) => {
    parts.push(part);
    return part;
  };
  const bloomKind = spec.forceBloom && set.bloom === 'none' ? 'daisy' : set.bloom;

  const blades = ({ n, jointed = false, tall = 1, gap = 3.1 }) => {
    const count = ri(n[0], n[1]);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const id = addStem({
        x: 8 + t * gap * spread + r(-0.12, 0.12),
        y: GROUND,
        angle: t * 0.55 + r(-0.08, 0.08),
        len: H * r(0.78, 1.02) * tall * (1 - Math.abs(t) * 0.18),
        bend: t * 0.4,
        width: () => (jointed ? 1.55 : 0.95) * thick,
      }, 0.02 + Math.abs(t) * 0.18, 0.55, {
        phase: t * 0.85,
        foliage: 'blade',
        leafy: !jointed,
        jointed,
      });
      if (set.fruit !== 'none' || i % 2 === 0) {
        add({
          type: 'fruit', attach: { host: id, u: 1 }, birth: 0.7 + r(0, 0.12), span: 0.2, size: 1,
          grain: set.fruit === 'none' || set.fruit === 'grain', foliage: 'drop',
        });
      }
    }
  };

  switch (spec.parts) {
    case 'blades':
      blades({ n: [3, 5] });
      break;
    case 'reed':
      blades({ n: [2, 4], jointed: true, tall: 1.12, gap: 3.6 });
      break;
    case 'meadow': {
      blades({ n: [3, 5], gap: 3.4 });
      const id = addStem({
        x: 8 + r(-0.2, 0.2), y: GROUND, angle: r(-0.08, 0.08), len: H * 0.92, bend: r(-0.2, 0.2), width: () => 1.05 * thick,
      }, 0.08, 0.5, { phase: 0.15 });
      add({ type: 'bloom', attach: { host: id, u: 1 }, birth: 0.66, span: 0.24, size: 2, foliage: 'drop', kind: bloomKind });
      break;
    }
    case 'rosette': {
      const n = ri(5, 7);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        add({
          type: 'leaf', x: 8 + t * 0.7 * spread, y: GROUND, angle: t * 2.45, len: H * 0.48 * (1 - Math.abs(t) * 0.4) + 1.5,
          bend: t * 0.55, droop: 0.45, width: leafW * 1.15, birth: 0.04 + Math.abs(t) * 0.32, span: 0.3,
          phase: t, foliage: 'blade', habit: 'rosette',
        });
      }
      if (bloomKind !== 'none') {
        const id = addStem({
          x: 8, y: GROUND - 0.6, angle: r(-0.08, 0.08), len: H * 0.62, width: () => thick,
        }, 0.55, 0.2);
        add({ type: 'bloom', attach: { host: id, u: 1 }, birth: 0.72, span: 0.2, size: 1.7, foliage: 'drop', kind: bloomKind });
      }
      break;
    }
    case 'fronds': {
      const n = ri(4, 6);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        const id = addStem({
          x: 8 + t * 0.35, y: GROUND, angle: t * 1.05, len: H * 0.82 * (1 - Math.abs(t) * 0.22) + 0.8, bend: t * 0.2, droop: 0.15,
          width: () => 0.7 * thick,
        }, 0.04 + Math.abs(t) * 0.16, 0.42, { phase: t * 0.7, foliage: 'blade', habit: 'rosette' });
        const pinnae = 5;
        for (let k = 0; k < pinnae; k++) {
          const u = 0.22 + k * (0.7 / pinnae);
          const side = k % 2 ? 1 : -1;
          add({
            type: 'leaf', attach: { host: id, u }, angle: side * 1.15, len: (1.15 + u * 0.7) * leafMul,
            width: 1.05, birth: 0.18 + u * 0.4, span: 0.18, phase: t + side * 0.25,
            foliage: 'drop', habit: 'rosette',
          });
        }
      }
      break;
    }
    case 'stacked': {
      const id = addStem({
        x: 8, y: GROUND, angle: r(-0.04, 0.04), len: H * 0.55 + 1.2, width: () => 1.7 * thick,
      }, 0.04, 0.4, { succulent: true, habit: 'cactus', foliage: 'keep' });
      for (let layer = 0; layer < 3; layer++) {
        for (const side of [-1, 1]) {
          add({
            type: 'leaf', attach: { host: id, u: 0.22 + layer * 0.24 }, angle: side * (1.15 - layer * 0.15),
            len: (2.4 - layer * 0.35) * leafMul, bend: side * 0.15, width: leafW * 1.3,
            birth: 0.12 + layer * 0.12, span: 0.22, phase: side * (0.2 + layer * 0.1),
            foliage: 'keep', habit: 'rosette',
          });
        }
      }
      break;
    }
    case 'flower': {
      const id = addStem({
        x: 8 + r(-0.15, 0.15), y: GROUND, angle: r(-0.12, 0.12), len: H, bend: r(-0.28, 0.28), width: () => 1.15 * thick,
      }, 0.03, 0.52);
      const leaves = ri(2, 4);
      for (let i = 0; i < leaves; i++) {
        const u = 0.16 + i * (0.5 / leaves);
        const side = i % 2 ? 1 : -1;
        add({
          type: 'leaf', attach: { host: id, u }, angle: side * r(0.85, 1.25), len: r(2.4, 3.8) * leafMul,
          bend: side * 0.2, width: leafW, birth: 0.12 + u * 0.4, span: 0.22, phase: side * 0.25, foliage: 'drop',
        });
      }
      if (bloomKind !== 'none') {
        add({ type: 'bloom', attach: { host: id, u: 1 }, birth: 0.62, span: 0.24, size: bloomKind === 'spike' ? 2.3 : 2.1, foliage: 'drop', kind: bloomKind });
      }
      break;
    }
    case 'bush': {
      const n = ri(3, 4);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        const id = addStem({
          x: 8 + t * 2.2 * spread, y: GROUND, angle: t * 1.15, len: H * r(0.58, 0.82), bend: t * 0.35, width: () => 1.05 * thick,
        }, 0.03 + Math.abs(t) * 0.08, 0.48, { phase: t * 0.7, woody: true });
        for (let k = 0; k < 3; k++) {
          const u = 0.35 + k * 0.18;
          const side = k % 2 ? 1 : -1;
          add({
            type: 'leaf', attach: { host: id, u }, angle: side * r(0.65, 1.1), len: r(1.6, 2.5) * leafMul,
            width: Math.min(leafW, 2.1), birth: 0.22 + u * 0.3, span: 0.2, phase: t + side * 0.15, foliage: 'drop',
          });
        }
        if (bloomKind !== 'none' && i % 2 === 0) {
          add({ type: 'bloom', attach: { host: id, u: 1 }, birth: 0.68 + i * 0.03, span: 0.2, size: 1.15, foliage: 'drop', kind: bloomKind });
        }
        if (set.fruit !== 'none') {
          add({ type: 'fruit', attach: { host: id, u: r(0.55, 0.85) }, birth: 0.8, span: 0.16, size: 1, foliage: 'drop' });
        }
      }
      break;
    }
    case 'tree': {
      const droop = spec.crown === 'droop';
      const trunk = addStem({
        x: 8 + r(-0.1, 0.1), y: GROUND, angle: r(-0.05, 0.05), len: H * (droop ? 0.7 : 0.62), bend: r(-0.12, 0.12),
        width: (u) => (2.15 - u * 0.75) * thick,
      }, 0.02, 0.42, { woody: true });
      const n = droop ? 4 : ri(2, 3);
      const crowns = [];
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const id = addStem({
          angle: droop ? t * 1.35 : side * r(0.55, 0.95),
          len: H * (droop ? 0.5 : r(0.28, 0.4)),
          bend: droop ? t * 2.2 : -side * 0.28,
          width: () => thick * (droop ? 0.85 : 1),
        }, 0.28 + i * 0.04, 0.24, { woody: true, attach: { host: trunk, u: droop ? 0.8 : 0.52 + i * 0.14 }, phase: t * 0.2 });
        crowns.push(id);
      }
      if (!droop) crowns.push(trunk);
      crowns.forEach((id, i) => {
        const size = droop ? 1.25 : r(2.15, 3) * (set.leaf === 'needle' ? 0.82 : 1);
        add({ type: 'canopy', attach: { host: id, u: 1 }, birth: 0.4 + i * 0.04, span: 0.32, size, foliage: 'drop' });
      });
      if (set.fruit !== 'none') {
        crowns.forEach((id, i) => add({ type: 'fruit', attach: { host: id, u: 1 }, birth: 0.84, span: 0.14, size: 1, foliage: 'drop', hang: i % 2 ? 0.4 : -0.2 }));
      } else if (bloomKind !== 'none') {
        crowns.forEach((id, i) => add({ type: 'bloom', attach: { host: id, u: 1 }, birth: 0.7 + i * 0.03, span: 0.18, size: 1.05, foliage: 'drop', kind: bloomKind }));
      }
      break;
    }
    case 'palm': {
      const trunk = addStem({
        x: 8, y: GROUND, angle: r(-0.04, 0.04), len: H * 0.74, width: (u) => (1.7 - u * 0.35) * thick,
      }, 0.02, 0.48, { woody: true, habit: 'cactus' });
      const n = ri(5, 7);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        add({
          type: 'leaf', attach: { host: trunk, u: 0.98 }, angle: t * 2.35, len: H * 0.34 * (1 - Math.abs(t) * 0.15),
          bend: t * 0.45, width: Math.max(leafW, 1.4), birth: 0.42 + Math.abs(t) * 0.1, span: 0.28,
          phase: t, foliage: 'drop', habit: 'tree',
        });
      }
      if (set.fruit !== 'none') add({ type: 'fruit', attach: { host: trunk, u: 0.96 }, birth: 0.8, span: 0.16, size: 1.1, foliage: 'drop' });
      break;
    }
    case 'tiers': {
      const trunk = addStem({
        x: 8, y: GROUND, angle: r(-0.03, 0.03), len: H * 0.9, width: (u) => (1.7 - u * 0.6) * thick,
      }, 0.02, 0.5, { woody: true });
      [[0.4, 4.4], [0.6, 3.3], [0.8, 2.25]].forEach(([u, size], i) => {
        add({ type: 'tier', attach: { host: trunk, u }, birth: 0.3 + i * 0.08, span: 0.28, size: size * spread * (set.leaf === 'needle' ? 0.9 : 1), foliage: 'drop' });
      });
      break;
    }
    case 'vine': {
      add({ type: 'stake', x: 9.3, y: GROUND, len: H + 0.6, birth: 0, span: 0.02, foliage: 'keep' });
      const dense = Boolean(spec.dense);
      const id = addStem({
        x: 7.6, y: GROUND, angle: 0.06, len: H * (dense ? 1.02 : 0.96), width: () => 0.9 * thick,
        coil: (u) => Math.sin(u * Math.PI * (dense ? 4.4 : 3.2)) * (dense ? 1.15 : 1.45) * Math.min(1, u * 3),
      }, 0.04, 0.6, { phase: 0.1 });
      const leaves = ri(dense ? 6 : 4, dense ? 8 : 6);
      for (let i = 0; i < leaves; i++) {
        const u = 0.14 + i * (0.78 / leaves);
        const side = i % 2 ? 1 : -1;
        add({
          type: 'leaf', attach: { host: id, u }, angle: side * 1.15, len: r(1.8, 2.8) * leafMul,
          bend: side * 0.25, width: Math.max(1.6, leafW), birth: 0.1 + u * 0.55, span: 0.18,
          phase: side * 0.3, foliage: 'drop',
        });
      }
      if (set.fruit !== 'none') {
        for (let i = 0; i < 2; i++) add({ type: 'fruit', attach: { host: id, u: 0.45 + i * 0.28 }, birth: 0.82, span: 0.14, size: 1, foliage: 'drop', hang: i ? 0.5 : -0.5 });
      } else if (bloomKind !== 'none') {
        add({ type: 'bloom', attach: { host: id, u: 1 }, birth: 0.74, span: 0.18, size: 1.25, foliage: 'drop', kind: bloomKind });
      }
      break;
    }
    case 'cactus': {
      const body = addStem({
        x: 8, y: GROUND, angle: 0, len: H * 0.86,
        width: (u) => 3.5 * thick * (u > 0.86 ? Math.sqrt(Math.max(0, 1 - ((u - 0.86) / 0.14) ** 2)) : 1),
      }, 0.02, 0.5, { succulent: true, foliage: 'keep' });
      const arms = set.height === 'low' ? 0 : ri(1, 2);
      for (let i = 0; i < arms; i++) {
        const side = i ? 1 : -1;
        const arm = addStem({
          angle: side * 1.35, len: 2.5, width: () => 1.7 * thick,
        }, 0.46, 0.1, { succulent: true, attach: { host: body, u: 0.4 + i * 0.1 }, foliage: 'keep' });
        addStem({
          angle: -side * 1.15, len: H * 0.28,
          width: (u) => 1.7 * thick * (u > 0.75 ? Math.sqrt(Math.max(0, 1 - ((u - 0.75) / 0.25) ** 2)) : 1),
        }, 0.56, 0.16, { succulent: true, attach: { host: arm, u: 1 }, foliage: 'keep' });
      }
      if (bloomKind !== 'none') add({ type: 'bloom', attach: { host: body, u: 1 }, birth: 0.75, span: 0.18, size: 1.35, foliage: 'drop', kind: bloomKind });
      else if (set.fruit !== 'none') add({ type: 'fruit', attach: { host: body, u: 0.98 }, birth: 0.8, span: 0.16, size: 1, foliage: 'drop' });
      break;
    }
    case 'bamboo': {
      const n = ri(1, 3);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const id = addStem({
          x: 8 + t * 3.6 * spread, y: GROUND, angle: t * 0.12, len: H * r(0.88, 1.05) * (1 - Math.abs(t) * 0.2),
          width: () => 1.7 * thick,
        }, 0.02 + Math.abs(t) * 0.12, 0.55, { jointed: true, phase: t * 0.5, foliage: 'keep' });
        for (let k = 0; k < 3; k++) {
          const side = k % 2 ? 1 : -1;
          add({
            type: 'leaf', attach: { host: id, u: 0.5 + k * 0.16 }, angle: side * r(0.95, 1.3), len: r(2.6, 3.8) * leafMul,
            width: 1.35, birth: 0.35 + k * 0.08, span: 0.2, phase: side * 0.25, foliage: 'drop', habit: 'bamboo',
          });
        }
      }
      break;
    }
    case 'mushroom': {
      const caps = ri(1, 3);
      for (let i = 0; i < caps; i++) {
        const big = i === 0;
        const id = addStem({
          x: big ? 8 : 8 + (i === 1 ? -3.2 : 3.2) * spread + r(-0.3, 0.3),
          y: GROUND,
          angle: r(-0.08, 0.08),
          len: (big ? H * 0.52 : H * 0.3) + 1,
          width: () => (big ? 2 : 1.15) * thick,
        }, 0.05 + i * 0.1, 0.42, { mushroom: true, phase: i * 0.2, foliage: 'keep', habit: 'mushroom' });
        add({ type: 'cap', attach: { host: id, u: 1 }, birth: 0.16 + i * 0.08, span: 0.45, size: big ? 3.5 : 2.15, foliage: 'keep' });
      }
      break;
    }
    default:
      break;
  }
  return parts;
}

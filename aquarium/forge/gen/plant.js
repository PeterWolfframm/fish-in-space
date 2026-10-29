// Growing plants for plantasia: grain, rosettes, flowers, bushes, saplings, vines, cacti, bamboo
// and mushrooms, drawn at any point of their growth.
//
// A plant is built once as a skeleton of parts — stems, leaves, flowers, fruit — and every part
// has a `birth` (when it appears, 0..1) and a `span` (how long it takes to finish). Drawing at
// growth `t` shows each born part cut short at its progress, so a sprout is literally the bottom
// of the grown plant and the four plantasia stages are one plant, not four drawings.
//
// Native size is 16×16, the viewBox plantasia's PlantSprite draws in; `plant32` is the same plant
// with room for detail. Like the tank plants, the code describes the sprite exactly: layout rolls
// come from the code, and `variant` gives them 36 starting points.

import { defineTraits } from '../pixel/traits.js';
import { Grid } from '../pixel/grid.js';
import { roller } from '../pixel/rng.js';
import { shade, mix } from '../pixel/color.js';
import { walk, pointOn, LEAF_SHAPES } from './plants/stroke.js';

/** plantasia's growth stages start at these fractions of the grow time (engine/growth.ts). */
export const STAGE_THRESHOLDS = [0, 0.25, 0.6, 1];
/** The growth each stage's sprite shows: a little way into the stage, the last one fully grown. */
export const STAGE_T = [0.1, 0.36, 0.66, 1];

/** plantasia's own soil and stem colours, so generated plants sit beside the hand-drawn ones. */
const SOIL = '#5a3e28';
const SOIL_LIGHT = '#7a5638';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));
const swatches = (...rows) => rows.map(([id, hex, label]) => ({ id, hex, label }));
const isRare = (set) => set.rarity === 'rare' || set.rarity === 'myth';

export const LEAF_COLORS = swatches(
  ['spring', '#7bbf6e', 'Spring'],
  ['garden', '#4a9c3f', 'Garden'],
  ['forest', '#2f7a3a', 'Forest'],
  ['sage', '#8aa889', 'Sage'],
  ['olive', '#8c9a3c', 'Olive'],
  ['lime', '#a8d04a', 'Lime'],
  ['silver', '#a9c2b8', 'Silver'],
  ['frost', '#9fd3c7', 'Frost'],
  ['purple', '#7a4f8f', 'Purple'],
  ['autumn', '#c47a2c', 'Autumn'],
);

export const STEM_COLORS = swatches(
  ['green', '#4a7c3f', 'Green'],
  ['brown', '#7a5232', 'Bark'],
  ['dark', '#3c4f30', 'Dark'],
  ['red', '#9a3b3b', 'Red'],
  ['pale', '#a8a070', 'Straw'],
);

export const BLOOM_COLORS = swatches(
  ['sun', '#f5c842', 'Sun'],
  ['snow', '#f4f1e6', 'Snow'],
  ['blush', '#f09ab8', 'Blush'],
  ['poppy', '#e04a3a', 'Poppy'],
  ['violet', '#9b72d4', 'Violet'],
  ['sky', '#6aa8e8', 'Sky'],
  ['tangerine', '#f08a24', 'Tangerine'],
  ['magenta', '#c83f9a', 'Magenta'],
);

const GLOW = '#9ff7ff';

export const plantTraits = defineTraits({
  prefix: 'g',
  fields: [
    { id: 'rarity', label: 'Rarity', group: 'identity', choices: opts(['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['myth', 'Mythic']), weights: [60, 27, 10, 3], salt: 16, volatility: 0.25 },
    {
      id: 'form', label: 'Form', group: 'shape', salt: 32,
      choices: opts(['grass', 'Grain'], ['rosette', 'Rosette'], ['flower', 'Flower'], ['bush', 'Bush'], ['tree', 'Sapling'], ['vine', 'Vine'], ['cactus', 'Cactus'], ['bamboo', 'Bamboo'], ['mushroom', 'Mushroom']),
      weights: [12, 12, 18, 12, 10, 9, 9, 8, 6],
    },
    { id: 'leaf', label: 'Leaf', group: 'shape', salt: 48, choices: opts(['lance', 'Lance'], ['oval', 'Oval'], ['heart', 'Heart'], ['needle', 'Needle'], ['round', 'Round']), weights: [28, 26, 16, 14, 16] },
    { id: 'height', label: 'Height', group: 'shape', salt: 64, choices: opts(['low', 'Low'], ['medium', 'Medium'], ['tall', 'Tall']), weights: [25, 45, 30], default: 'medium', volatility: 1.4 },
    { id: 'leafColor', label: 'Leaf colour', group: 'colour', colors: true, salt: 80, choices: LEAF_COLORS, weights: [18, 22, 14, 8, 8, 8, 6, 5, 5, 6] },
    { id: 'stemColor', label: 'Stem colour', group: 'colour', colors: true, salt: 96, choices: STEM_COLORS, weights: [50, 22, 14, 6, 8] },
    { id: 'bloom', label: 'Bloom', group: 'bloom', salt: 112, choices: opts(['none', 'None'], ['daisy', 'Daisy'], ['cup', 'Cup'], ['spike', 'Spike'], ['cluster', 'Cluster'], ['bell', 'Bell']), weights: [18, 22, 18, 14, 16, 12] },
    { id: 'petal', label: 'Petal colour', group: 'bloom', colors: true, salt: 128, choices: BLOOM_COLORS, when: (set) => set.bloom !== 'none', gateHint: 'needs a bloom' },
    { id: 'fruit', label: 'Fruit', group: 'harvest', salt: 144, choices: opts(['none', 'None'], ['berry', 'Berries'], ['round', 'Round fruit'], ['pod', 'Pods'], ['grain', 'Grain head']), weights: [34, 22, 18, 12, 14] },
    { id: 'fruitColor', label: 'Fruit colour', group: 'harvest', colors: true, salt: 160, choices: swatches(['red', '#d23a3a', 'Red'], ['orange', '#f08a24', 'Orange'], ['gold', '#e8b820', 'Gold'], ['blue', '#4a5fc8', 'Blue'], ['purple', '#6a3a8a', 'Purple'], ['green', '#8cc63f', 'Green']), when: (set) => set.fruit !== 'none', gateHint: 'needs fruit' },
    { id: 'glow', label: 'Magic', group: 'rare', salt: 176, choices: opts(['none', 'None'], ['sparkle', 'Sparkle'], ['glow', 'Glowing'], ['crystal', 'Crystal']), weights: [30, 30, 25, 15], when: isRare, gateHint: 'needs a rare plant', dominance: 0.25 },
    { id: 'variant', label: 'Variant', group: 'identity', salt: 192, choices: Array.from({ length: 36 }, (_, i) => ({ id: `v${i}`, label: `#${i + 1}` })), volatility: 2 },
  ],
});

const HEIGHT = { low: 0.55, medium: 0.78, tall: 1 };

// ---------- skeleton ----------
//
// Coordinates are in a 16-unit box (ground at y 13); `k` scales them to the real grid.

const GROUND = 13;

/** All the parts of one grown plant, in draw order. */
function skeleton(set) {
  const roll = roller(plantTraits.encode(set), 5000);
  const H = 11.5 * HEIGHT[set.height];
  const parts = [];
  let salt = 1;
  const r = (a, b) => roll.range(a, b, salt++);
  const ri = (a, b) => roll.int(a, b, salt++);
  const add = (part) => {
    parts.push(part);
    return part;
  };
  const stem = (stroke, birth, span, extra = {}) => add({ type: 'stem', stroke, birth, span, ...extra });
  const leafAt = (host, u, angle, len, width, birthPad = 0.05, extra = {}) => {
    const at = pointOn(host.stroke, u);
    // A leaf appears once its stem has grown past it.
    const birth = host.birth + host.span * u + birthPad;
    return add({ type: 'leaf', stroke: { x: at.x, y: at.y, angle: at.angle + angle, len, bend: angle * 0.5, droop: len * 0.15 }, width, birth, span: 0.22, ...extra });
  };
  const bloomAt = (host, u, size, birth) => {
    const at = pointOn(host.stroke, u);
    return add({ type: 'bloom', x: at.x, y: at.y, size, birth, span: 0.25 });
  };
  const fruitAt = (x, y, size, birth) => add({ type: 'fruit', x, y, size, birth, span: 0.2 });
  const tip = (host) => pointOn(host.stroke, 1);
  const leafW = { lance: 1.7, oval: 2.2, heart: 2.4, needle: 1, round: 2.6 }[set.leaf];

  switch (set.form) {
    case 'grass': {
      const n = ri(3, 5);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const s = stem({ x: 8 + t * 2.5, y: GROUND, angle: t * 0.7 + r(-0.1, 0.1), len: H * r(0.75, 1), bend: t * 0.5, width: () => 1 }, 0.02 + Math.abs(t) * 0.2, 0.55, { leafy: true });
        if (set.fruit !== 'none' || i % 2 === 0) fruitAt(tip(s).x, tip(s).y, 1, 0.7 + r(0, 0.15)).grain = true;
      }
      break;
    }
    case 'rosette': {
      const n = ri(5, 7);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        add({ type: 'leaf', stroke: { x: 8 + t, y: GROUND, angle: t * 2.6, len: H * 0.5 * (1 - Math.abs(t) * 0.5) + 1.5, bend: t * 0.6, droop: 0.5 }, width: leafW * 1.2, birth: 0.04 + Math.abs(t) * 0.4, span: 0.3 });
      }
      if (set.bloom !== 'none') {
        const s = stem({ x: 8, y: GROUND - 1, angle: r(-0.1, 0.1), len: H * 0.75, width: () => 1 }, 0.55, 0.2);
        bloomAt(s, 1, 1.8, 0.72);
      }
      break;
    }
    case 'flower': {
      const s = stem({ x: 8, y: GROUND, angle: r(-0.12, 0.12), len: H, bend: r(-0.25, 0.25), width: () => 1.2 }, 0.03, 0.55);
      const leaves = ri(2, 4);
      for (let i = 0; i < leaves; i++) leafAt(s, 0.15 + i * (0.55 / leaves), (i % 2 ? 1 : -1) * r(0.9, 1.3), r(2.5, 4), leafW);
      bloomAt(s, 1, set.bloom === 'spike' ? 2.4 : 2.2, 0.62);
      break;
    }
    case 'bush': {
      const n = ri(3, 4);
      const stems = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        stems.push(stem({ x: 8 + t * 2, y: GROUND, angle: t * 1.4, len: H * r(0.6, 0.85), bend: t * 0.4, width: () => 1 }, 0.03 + Math.abs(t) * 0.1, 0.5));
      }
      stems.forEach((s, i) => {
        for (let k = 0; k < 4; k++) leafAt(s, 0.3 + k * 0.2, (k % 2 ? 1 : -1) * r(0.7, 1.2), r(1.8, 2.8), Math.min(2, leafW));
        if (set.bloom !== 'none' && i % 2 === 0) bloomAt(s, 1, 1.2, 0.68 + i * 0.04);
        if (set.fruit !== 'none') {
          const p = pointOn(s.stroke, r(0.55, 0.9));
          fruitAt(p.x + r(-1, 1), p.y, 1, 0.82 + r(0, 0.1));
        }
      });
      break;
    }
    case 'tree': {
      const trunk = stem({ x: 8, y: GROUND, angle: r(-0.06, 0.06), len: H * 0.62, bend: r(-0.15, 0.15), width: (u) => 2 - u * 0.8 }, 0.02, 0.45, { woody: true });
      const branches = ri(2, 3);
      const crowns = [];
      for (let i = 0; i < branches; i++) {
        const side = i % 2 ? 1 : -1;
        const at = pointOn(trunk.stroke, 0.55 + i * 0.15);
        const b = stem({ x: at.x, y: at.y, angle: side * r(0.6, 0.95), len: H * r(0.28, 0.4), bend: -side * 0.3, width: () => 1 }, 0.28 + i * 0.06, 0.25, { woody: true });
        crowns.push(tip(b));
      }
      crowns.push(tip(trunk));
      crowns.forEach((c, i) => add({ type: 'canopy', x: c.x, y: c.y, size: r(2.2, 3) * (set.leaf === 'needle' ? 0.85 : 1), birth: 0.4 + i * 0.05, span: 0.35 }));
      if (set.fruit !== 'none') crowns.forEach((c, i) => fruitAt(c.x + r(-1.5, 1.5), c.y + r(-0.5, 1.5), 1, 0.85 + i * 0.03));
      else if (set.bloom !== 'none') crowns.forEach((c, i) => add({ type: 'bloom', x: c.x + r(-1.5, 1.5), y: c.y + r(-1.5, 0.5), size: 1, birth: 0.72 + i * 0.05, span: 0.2 }));
      break;
    }
    case 'vine': {
      add({ type: 'stake', x: 9.5, y: GROUND, len: H + 0.5, birth: 0, span: 0.01 });
      const s = stem({ x: 8, y: GROUND, angle: 0.08, len: H, sway: (u) => Math.sin(u * Math.PI * 3.2) * 1.4 * Math.min(1, u * 3), width: () => 1 }, 0.03, 0.62, { winding: true });
      const leaves = ri(4, 6);
      for (let i = 0; i < leaves; i++) {
        const u = 0.15 + i * (0.78 / leaves);
        const sw = s.stroke.sway(u);
        const at = pointOn(s.stroke, u);
        const side = i % 2 ? 1 : -1;
        add({ type: 'leaf', stroke: { x: at.x + sw, y: at.y, angle: side * 1.2, len: r(2, 3), bend: side * 0.4, droop: 0.4 }, width: Math.max(1.8, leafW), birth: s.birth + s.span * u + 0.04, span: 0.2 });
      }
      if (set.fruit !== 'none') for (let i = 0; i < 2; i++) {
        const u = 0.45 + i * 0.3;
        const at = pointOn(s.stroke, u);
        fruitAt(at.x + s.stroke.sway(u) + (i ? 1.5 : -1.5), at.y + 1, 1, 0.84 + i * 0.06);
      } else if (set.bloom !== 'none') bloomAt(s, 1, 1.3, 0.75);
      break;
    }
    case 'cactus': {
      const body = stem({ x: 8, y: GROUND, angle: 0, len: H * 0.85, width: (u) => (u > 0.85 ? 4 * Math.sqrt(Math.max(0, 1 - ((u - 0.85) / 0.15) ** 2)) : 4) }, 0.02, 0.5, { succulent: true });
      const arms = set.height === 'low' ? 0 : ri(1, 2);
      for (let i = 0; i < arms; i++) {
        const side = i ? 1 : -1;
        const at = pointOn(body.stroke, r(0.35, 0.55));
        const out = { x: at.x + side * 1.5, y: at.y, angle: side * 1.4, len: 2.2, width: () => 2 };
        stem(out, 0.45 + i * 0.08, 0.1, { succulent: true });
        const elbow = pointOn(out, 1);
        stem({ x: elbow.x, y: elbow.y + 0.5, angle: 0, len: H * 0.3, width: (u) => (u > 0.75 ? 2 * Math.sqrt(Math.max(0, 1 - ((u - 0.75) / 0.25) ** 2)) : 2) }, 0.55 + i * 0.08, 0.18, { succulent: true });
      }
      if (set.bloom !== 'none' || set.fruit !== 'none') {
        const top = tip(body);
        if (set.bloom !== 'none') add({ type: 'bloom', x: top.x, y: top.y, size: 1.4, birth: 0.75, span: 0.2 });
        else fruitAt(top.x + 1, top.y + 0.5, 1, 0.8);
      }
      break;
    }
    case 'bamboo': {
      const n = ri(1, 3);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const s = stem({ x: 8 + t * 4, y: GROUND, angle: t * 0.15, len: H * r(0.85, 1.05) * (1 - Math.abs(t) * 0.25), width: () => 2 }, 0.02 + Math.abs(t) * 0.15, 0.55, { jointed: true });
        for (let k = 0; k < 3; k++) leafAt(s, 0.45 + k * 0.2, (k % 2 ? 1 : -1) * r(1.0, 1.4), r(3, 4.2), 1.4, 0.05);
      }
      break;
    }
    case 'mushroom': {
      const caps = ri(1, 3);
      for (let i = 0; i < caps; i++) {
        const big = i === 0;
        const x = big ? 8 : 8 + (i === 1 ? -4 : 4) + r(-0.5, 0.5);
        const len = (big ? H * 0.55 : H * 0.3) + 1;
        const s = stem({ x, y: GROUND, angle: r(-0.1, 0.1), len, width: () => (big ? 2 : 1) }, 0.05 + i * 0.12, 0.45, { mushroom: true });
        const at = tip(s);
        add({ type: 'cap', x: at.x, y: at.y, size: big ? 3.6 : 2.2, birth: s.birth + 0.1, span: 0.5 });
      }
      break;
    }
  }
  return parts;
}

// ---------- drawing ----------

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function palette(g, set) {
  const hexOf = (id) => plantTraits.choiceOf(set, id)?.hex ?? '#888888';
  const leaf = hexOf('leafColor');
  const stem = hexOf('stemColor');
  const petal = set.bloom !== 'none' ? hexOf('petal') : '#f5c842';
  const fruit = set.fruit !== 'none' ? hexOf('fruitColor') : '#d23a3a';
  const glow = set.glow === 'glow' || set.glow === 'crystal';
  const lit = (hex) => (glow ? mix(hex, GLOW, set.glow === 'crystal' ? 0.45 : 0.25) : hex);
  return {
    leaf: g.color(lit(leaf)),
    leafL: g.color(lit(shade(leaf, 1.3))),
    leafD: g.color(shade(leaf, 0.7)),
    stem: g.color(stem),
    stemL: g.color(shade(stem, 1.25)),
    stemD: g.color(shade(stem, 0.7)),
    petal: g.color(lit(petal)),
    petalL: g.color(shade(petal, 1.35)),
    petalD: g.color(shade(petal, 0.72)),
    heart: g.color(set.bloom === 'daisy' ? '#c8871b' : shade(petal, 0.5)),
    fruit: g.color(fruit),
    fruitL: g.color(shade(fruit, 1.45)),
    bud: g.color(shade(leaf, 0.85)),
    soil: g.color(SOIL),
    soilL: g.color(SOIL_LIGHT),
    seed: g.color('#c9a66b'),
    glow: g.color(GLOW),
    cap: g.color(set.bloom !== 'none' ? petal : set.fruit !== 'none' ? fruit : '#c8553a'),
    capL: g.color(shade(set.bloom !== 'none' ? petal : set.fruit !== 'none' ? fruit : '#c8553a', 1.4)),
    gill: g.color('#e8dcc4'),
  };
}

/** One plant at growth `t` (0 just planted … 1 fully grown) on a `size`×`size` grid. */
export function drawPlant(genome, t = 1, size = 16) {
  const set = plantTraits.normalize(genome);
  const g = new Grid(size);
  const k = size / 16;
  const c = palette(g, set);
  const S = (v) => v * k;
  const scaled = (stroke, extra) => ({
    ...stroke, x: S(stroke.x), y: S(stroke.y), len: S(stroke.len), droop: S(stroke.droop ?? 0),
    width: stroke.width ? (u) => S(stroke.width(u)) : () => S(1), sway: stroke.sway ? (u) => S(stroke.sway(u)) : () => 0, ...extra,
  });
  const parts = skeleton(set);

  // Soil: a low mound, as in plantasia's own sprites.
  g.ellipse(S(8), S(GROUND + 1.2), S(4.2), S(1.6), c.soil);
  g.rect(Math.round(S(5)), Math.round(S(GROUND + 0.5)), Math.round(S(6)), 1, c.soilL);
  if (t < 0.14) {
    // The seed, and the first green as it splits.
    g.ellipse(S(8), S(GROUND), Math.max(1, S(1.1)), Math.max(0.8, S(0.8)), c.seed);
    if (t > 0.05) g.px(Math.floor(S(8)), Math.floor(S(GROUND - 1)), c.leafL);
  }

  for (const p of parts) {
    const grown = clamp01((t - p.birth) / p.span);
    if (grown <= 0) continue;
    switch (p.type) {
      case 'stake':
        g.rect(Math.floor(S(p.x)), Math.floor(S(p.y - p.len)), Math.max(1, Math.round(k)), Math.round(S(p.len)), g.color('#a07c50'));
        break;
      case 'stem': {
        const thin = 0.55 + 0.45 * grown;
        const stroke = scaled(p.stroke, { upto: grown, width: (u) => Math.max(1, S(p.stroke.width ? p.stroke.width(u) : 1) * thin) });
        if (p.succulent) {
          walk(stroke, (x, y, u, kk, hw) => g.px(x, y, kk < -hw * 0.3 ? c.leafL : kk > hw * 0.4 ? c.leafD : c.leaf));
          // Spines down the ribs.
          walk({ ...stroke, width: () => 1 }, (x, y, u) => {
            if (Math.round(u * stroke.len) % 3 === 1 && grown > 0.4) {
              g.px(x - Math.round(stroke.width(u) / 2), y, c.seed);
              g.px(x + Math.round(stroke.width(u) / 2) - 1, y, c.seed);
            }
          });
        } else if (p.jointed) {
          walk(stroke, (x, y, u, kk, hw) => {
            const node = Math.round(u * p.stroke.len) % 3 === 0 && u > 0.05;
            g.px(x, y, node ? c.stemD : kk < 0 ? c.leafL : c.leaf);
          });
        } else if (p.mushroom) {
          walk(stroke, (x, y) => g.px(x, y, c.gill));
        } else {
          const tone = p.woody ? (kk, hw) => (kk < 0 && hw >= 1 ? c.stemL : c.stem) : () => c.stem;
          walk(stroke, (x, y, u, kk, hw) => g.px(x, y, p.leafy && u > 0.4 ? (u > 0.75 ? c.leafL : c.leaf) : tone(kk, hw)));
        }
        break;
      }
      case 'leaf': {
        const shape = LEAF_SHAPES[set.leaf] ?? LEAF_SHAPES.lance;
        const len = p.stroke.len * (0.35 + 0.65 * grown);
        const stroke = scaled({ ...p.stroke, len }, {
          width: (u) => (u < 0.1 ? S(1) : Math.max(1, S(p.width * (0.5 + 0.5 * grown)) * shape(Math.min(1, (u - 0.1) / 0.9)))),
        });
        walk(stroke, (x, y, u, kk, hw) => {
          let tone = kk < -hw * 0.35 ? c.leafL : kk > hw * 0.35 ? c.leafD : c.leaf;
          if (grown < 0.4) tone = c.leafL;
          g.px(x, y, tone);
        });
        break;
      }
      case 'canopy': {
        const r = S(p.size) * (0.4 + 0.6 * grown);
        const cx = S(p.x);
        const cy = S(p.y);
        g.ellipse(cx, cy, r * 1.15, r, c.leaf);
        g.ellipse(cx - r * 0.3, cy - r * 0.3, r * 0.6, r * 0.5, c.leafL);
        g.dither(Math.floor(cx - r * 1.2), Math.floor(cy), Math.ceil(r * 2.4) + 1, Math.ceil(r) + 1, c.leafD, 0.5, (x, y) => g.get(x, y) === c.leaf);
        break;
      }
      case 'bloom':
        bloom(g, set, c, S(p.x), S(p.y), S(p.size), grown, k);
        break;
      case 'cap': {
        const r = S(p.size) * (0.35 + 0.65 * grown);
        const cx = S(p.x);
        const cy = S(p.y) + 0.5;
        g.ellipse(cx, cy, r, r * 0.7, c.cap, (x, y) => y + 0.5 <= cy);
        g.rect(Math.round(cx - r * 0.8), Math.floor(cy), Math.max(1, Math.round(r * 1.6)), 1, c.gill);
        if (grown > 0.5) {
          g.px(Math.floor(cx - r * 0.4), Math.floor(cy - r * 0.45), c.capL);
          if (r > 2) g.px(Math.floor(cx + r * 0.35), Math.floor(cy - r * 0.3), c.capL);
        }
        break;
      }
      case 'fruit': {
        if (grown < 0.2) break;
        const x = Math.floor(S(p.x));
        const y = Math.floor(S(p.y));
        const ripe = grown >= 0.9;
        if (p.grain || set.fruit === 'grain') {
          const ear = ripe ? g.color('#e8b820') : g.color('#c8c070');
          g.rect(x, y - Math.round(S(1)), Math.max(1, Math.round(k)), Math.max(2, Math.round(S(2))), ear);
          if (k > 1) g.px(x + 1, y - Math.round(S(1)), c.seed);
        } else if (set.fruit === 'pod') {
          g.rect(x, y, Math.max(1, Math.round(k)), Math.max(2, Math.round(S(2))), ripe ? c.fruit : c.bud);
        } else {
          const r = set.fruit === 'round' ? 1.2 : 0.8;
          g.ellipse(x + 0.5, y + 0.5, Math.max(0.8, S(r)), Math.max(0.8, S(r)), ripe ? c.fruit : c.bud);
          if (ripe && k > 1) g.px(x, y, c.fruitL);
        }
        break;
      }
    }
  }

  if (size > 16) g.outline(g.color(shade(plantTraits.choiceOf(set, 'leafColor').hex, 0.32)));
  magic(g, set, c, t, size);
  return g.out();
}

function bloom(g, set, c, x, y, size, grown, k) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (grown < 0.45) {
    // A bud first: a green knot that colours as it swells.
    g.ellipse(x, y, Math.max(0.8, size * 0.35), Math.max(0.9, size * 0.5), grown > 0.3 ? c.petalD : c.bud);
    return;
  }
  const r = size * (0.6 + 0.4 * grown);
  switch (set.bloom) {
    case 'daisy':
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        walk({ x: x + 0.5, y: y + 0.5, angle: ang, len: r, width: () => Math.max(1, k * 0.9) }, (px, py, u) => g.px(px, py, u > 0.6 ? c.petalL : c.petal));
      }
      g.ellipse(x + 0.5, y + 0.5, Math.max(0.8, r * 0.38), Math.max(0.8, r * 0.38), c.heart);
      break;
    case 'cup':
      g.ellipse(x + 0.5, y, r, r * 0.95, c.petal, (px, py) => py >= y - r * 0.3 || Math.abs(px + 0.5 - x - 0.5) > r * 0.35);
      g.rect(cx, Math.floor(y - r * 0.6), 1, Math.max(1, Math.round(r * 0.5)), c.petalD);
      g.px(Math.floor(x - r * 0.5), Math.floor(y), c.petalL);
      break;
    case 'spike':
      for (let i = 0; i < Math.round(r * 2.2); i++) {
        const w = i % 2 ? Math.max(1, Math.round(r * 0.6)) : Math.max(1, Math.round(r * 0.9));
        g.rect(Math.round(x + 0.5 - w / 2), cy - i, w, 1, i % 3 === 0 ? c.petalL : c.petal);
      }
      break;
    case 'cluster':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        const px = x + Math.cos(a) * r * 0.6;
        const py = y + Math.sin(a) * r * 0.45;
        g.ellipse(px + 0.5, py + 0.5, Math.max(0.7, r * 0.42), Math.max(0.7, r * 0.42), i % 2 ? c.petal : c.petalL);
      }
      break;
    case 'bell':
      g.ellipse(x + 0.5, y + r * 0.4, r * 0.75, r * 0.9, c.petal, (px, py) => py <= y + r * 0.9);
      g.rect(Math.round(x + 0.5 - r * 0.9), Math.floor(y + r * 1.0), Math.max(1, Math.round(r * 1.8)), 1, c.petalD);
      break;
    default:
      g.ellipse(x + 0.5, y + 0.5, Math.max(0.8, r * 0.6), Math.max(0.8, r * 0.6), c.petal);
  }
}

/** Rare plants: a sparkle that walks the outline, or a glow that rims the leaves. */
function magic(g, set, c, t, size) {
  if (set.glow === 'none' || t < 0.6) return;
  const b = g.bounds();
  if (!b) return;
  const roll = roller(plantTraits.encode(set), 7000);
  const n = set.glow === 'sparkle' ? 3 : set.glow === 'crystal' ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(b.x + roll.range(0, b.w, i));
    const y = Math.floor(b.y + roll.range(0, b.h * 0.7, 10 + i));
    g.px(x, y, c.glow);
    if (set.glow !== 'glow' && size > 16) {
      g.px(x - 1, y, c.glow);
      g.px(x + 1, y, c.glow);
      g.px(x, y - 1, c.glow);
      g.px(x, y + 1, c.glow);
    }
  }
}

/** The four plantasia stage sprites, seedling to grown. */
export const plantStages = (genome, size = 16) => STAGE_T.map((t) => drawPlant(genome, t, size));

export const plantFromSeed = (seed) => plantTraits.fromSeed(seed);

const TIMELAPSE = 16;

function plantGenerator(size) {
  return {
    id: size === 16 ? 'plant' : `plant${size}`,
    label: size === 16 ? 'Garden plants' : `Garden plants ${size}px`,
    game: 'plantasia',
    size: { w: size, h: size },
    bg: '#2b3a2a',
    traits: plantTraits,
    fromSeed: plantFromSeed,
    anims: [
      { id: 'stages', frames: STAGE_T.length, fps: 1.5 },
      { id: 'grow', frames: TIMELAPSE, fps: 8, continuous: true },
    ],
    frame: (genome, anim, i = 0) =>
      anim === 'grow' ? drawPlant(genome, i / (TIMELAPSE - 1), size) : drawPlant(genome, STAGE_T[Math.min(i, STAGE_T.length - 1)], size),
    at: (genome, t) => drawPlant(genome, t, size),
  };
}

export const plant32 = plantGenerator(32);
export default plantGenerator(16);

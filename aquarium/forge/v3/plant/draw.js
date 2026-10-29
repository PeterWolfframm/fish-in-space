// Plant v3 painter. v1's pixel language — flat colour, a soil mound, the same flowers — on a
// skeleton whose stems are bent by the habit gait. Parts hang off the bent curve, so a leaf
// stays on its node. Bigger size classes are more pixels of the same plant, plus veins and bark.

import { Grid } from '../../pixel/grid.js';
import { shade, mix } from '../../pixel/color.js';
import { roller } from '../../pixel/rng.js';
import { walk, LEAF_SHAPES } from '../../gen/plants/stroke.js';
import { rest } from '../../v2/anim/rig.js';
import { phenotype } from './phenotype.js';
import { trace, walkBent, flutterOf, headWag } from './kinematics.js';

const SOIL = '#5a3e28';
const SOIL_LIGHT = '#7a5638';
const STRAW = '#c2a15a';
const GLOW = '#9ff7ff';
const GROUND = 13;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function seasonOf(pose) {
  if (pose.season == null || pose.season < 0) return 1;
  return Math.max(0, Math.min(3, pose.season | 0));
}

function seasonLeaf(hex, season, evergreen) {
  if (season === 0) return mix(hex, '#d7f2c4', 0.5);
  if (season === 2) return mix(hex, '#c47a2c', evergreen ? 0.3 : 0.66);
  if (season === 3 && evergreen) return mix(hex, '#9aa184', 0.42);
  return hex;
}

/** One frame. `pose` is a plant3 pose; the genome's look is the camera. */
export function drawPlant3(genome, poseIn = {}) {
  const ph = phenotype(genome);
  const { set, spec, parts } = ph;
  const pose = { ...rest('plant3'), ...poseIn, look: set.look, restDroop: spec.droop ?? 0 };
  const t = clamp01(pose.growth ?? 1);
  const season = seasonOf(pose);
  const evergreen = Boolean(spec.evergreen);
  const winterBare = season === 3 && !evergreen;
  const k = ph.classH / 16;
  const wide = set.look === 'cartoon' ? 4.8 : 3.6;
  const W = Math.ceil(Math.max(48, ph.classH * wide) / 4) * 4;
  const H = Math.ceil(Math.max(48, ph.classH * 2.15) / 4) * 4;
  const origin = { x: (W - 16 * k) / 2, y: ph.classH * 0.42 };
  const g = new Grid(W, H);
  const col = palette(g, ph, pose, season, evergreen);
  const habit = spec.habit;

  const soil = { x: origin.x + 8 * k, y: origin.y + (GROUND + 1.1) * k };
  g.ellipse(soil.x, soil.y, Math.max(3, 4.2 * k), Math.max(1.4, 1.6 * k), col.soil);
  g.rect(Math.round(soil.x - 3 * k), Math.round(soil.y - 0.3 * k), Math.max(2, Math.round(6 * k)), 1, col.soilL);
  if (t < 0.14) {
    g.ellipse(origin.x + 8 * k, origin.y + GROUND * k, Math.max(1, 1.1 * k), Math.max(0.8, 0.8 * k), col.seed);
    if (t > 0.05) g.px(Math.floor(origin.x + 8 * k), Math.floor(origin.y + (GROUND - 1) * k), col.leafL);
  }

  const resolved = [];
  for (const part of parts) {
    if (part.type !== 'stem') continue;
    resolved[part.stem] = stemStroke(part, resolved, origin, k, pose, habit, 1);
  }

  const order = [...parts].sort((a, b) => layer(a) - layer(b));
  for (const part of order) {
    const grown = clamp01((t - part.birth) / (part.span || 0.001));
    if (grown <= 0) continue;
    if (winterBare && part.foliage === 'drop') continue;
    const dead = winterBare && part.foliage === 'blade';
    switch (part.type) {
      case 'stake':
        drawStake(g, part, origin, k, grown, col);
        break;
      case 'stem':
        drawStem(g, part, resolved, k, grown, col, dead, ph.s, pose);
        break;
      case 'leaf':
        drawLeaf(g, part, resolved, origin, k, grown, col, dead, ph, pose, habit);
        break;
      case 'canopy':
        drawCanopy(g, part, resolved, k, grown, col, ph.s, pose);
        break;
      case 'tier':
        drawTier(g, part, resolved, k, grown, col);
        break;
      case 'cap':
        drawCap(g, part, resolved, k, grown, col, pose, habit);
        break;
      case 'bloom':
        drawBloom(g, part, resolved, k, grown, col, ph.s, pose, habit);
        break;
      case 'fruit':
        drawFruit(g, part, resolved, k, grown, col, set);
        break;
      default:
        break;
    }
  }

  if (ph.classH > 16) g.outline(g.color(shade(ph.colors.leaf, 0.32)));
  sparkle(g, ph, pose, t, col);
  return {
    img: g.out(),
    anchorX: origin.x + 8 * k,
    groundY: origin.y + (GROUND + 2.2) * k,
  };
}

function layer(p) {
  if (p.type === 'stake') return 0;
  if (p.type === 'stem') return 1;
  if (p.type === 'tier' || p.type === 'canopy') return 2;
  if (p.type === 'leaf') return 3;
  if (p.type === 'cap' || p.type === 'fruit') return 4;
  return 5;
}

function palette(g, ph, pose, season, evergreen) {
  const glowOn = ph.set.glow === 'glow' || ph.set.glow === 'crystal';
  const gmul = glowOn ? clamp01((pose.glow ?? 0.5) * 2) * (ph.set.glow === 'crystal' ? 0.45 : 0.25) : 0;
  const lit = (hex) => (gmul > 0 ? mix(hex, GLOW, gmul) : hex);
  const leaf = lit(seasonLeaf(ph.colors.leaf, season, evergreen));
  const stem = ph.colors.stem;
  const petal = season === 3 && evergreen ? mix(ph.colors.petal, '#d9d3c4', 0.35) : lit(ph.colors.petal);
  const fruit = ph.colors.fruit;
  const cap = lit(ph.colors.cap);
  return {
    leaf: g.color(leaf),
    leafL: g.color(lit(shade(leaf, 1.3))),
    leafD: g.color(shade(leaf, 0.7)),
    pale: g.color(mix(leaf, '#f6f2d4', 0.62)),
    gold: g.color('#e2c15a'),
    straw: g.color(STRAW),
    strawD: g.color(shade(STRAW, 0.72)),
    stem: g.color(stem),
    stemL: g.color(shade(stem, 1.28)),
    stemD: g.color(shade(stem, 0.68)),
    petal: g.color(petal),
    petalL: g.color(shade(petal, 1.35)),
    petalD: g.color(shade(petal, 0.72)),
    heart: g.color(ph.set.bloom === 'daisy' || ph.spec.forceBloom ? '#c8871b' : shade(petal, 0.5)),
    fruit: g.color(fruit),
    fruitL: g.color(shade(fruit, 1.45)),
    bud: g.color(shade(leaf, 0.85)),
    soil: g.color(SOIL),
    soilL: g.color(SOIL_LIGHT),
    seed: g.color('#c9a66b'),
    glow: g.color(GLOW),
    cap: g.color(cap),
    capL: g.color(shade(cap, 1.4)),
    gill: g.color('#e8dcc4'),
    stake: g.color('#a07c50'),
    spine: g.color('#e8dcb0'),
  };
}

function stemStroke(part, resolved, origin, k, pose, habit, grown) {
  const st = part.stroke ?? {};
  let x;
  let y;
  let angle;
  if (part.attach) {
    const host = resolved[part.attach.host];
    if (!host) return null;
    const at = trace(host, part.attach.u ?? 1);
    x = at.x;
    y = at.y;
    angle = at.angle + (st.angle ?? 0);
  } else {
    x = origin.x + (st.x ?? 8) * k;
    y = origin.y + (st.y ?? GROUND) * k;
    angle = st.angle ?? 0;
  }
  const thin = 0.55 + 0.45 * grown;
  return {
    x, y, angle,
    len: (st.len ?? 0) * k,
    bend: st.bend ?? 0,
    droop: (st.droop ?? 0) * k,
    width: (u) => Math.max(1, (st.width ? st.width(u) : 1) * k * thin),
    coil: st.coil ? (u) => st.coil(u) * k : undefined,
    habit: part.habit ?? habit,
    pose,
    phase: part.phase ?? 0,
  };
}

function drawStake(g, part, origin, k, grown, col) {
  const x = Math.floor(origin.x + part.x * k);
  const y1 = origin.y + part.y * k;
  const len = part.len * k * grown;
  g.rect(x, Math.floor(y1 - len), Math.max(1, Math.round(k * 0.7)), Math.max(1, Math.round(len)), col.stake);
}

function drawStem(g, part, resolved, k, grown, col, dead, s, pose) {
  const stroke = resolved[part.stem];
  if (!stroke) return;
  const thin = 0.55 + 0.45 * grown;
  const use = {
    ...stroke,
    upto: grown,
    width: (u) => Math.max(1, stroke.width(u) * thin),
  };
  walkBent(use, (x, y, u, kk, hw) => {
    let tone = col.stem;
    if (dead) tone = kk > hw * 0.3 ? col.strawD : col.straw;
    else if (part.succulent) tone = kk < -hw * 0.3 ? col.leafL : kk > hw * 0.4 ? col.leafD : col.leaf;
    else if (part.jointed) {
      const node = u > 0.05 && Math.round(u * 10) % 3 === 0;
      tone = node ? col.stemD : kk < 0 ? col.stemL : col.stem;
    } else if (part.mushroom) tone = col.gill;
    else if (part.leafy) tone = u > 0.72 ? col.leafL : u > 0.4 ? col.leaf : col.stem;
    else if (part.woody) {
      tone = kk < 0 && hw >= 1 ? col.stemL : col.stem;
      if (s >= 2 && u > 0.08 && u < 0.9 && Math.abs(kk) < 0.45 && Math.floor(u * (part.stroke.len ?? 1) * 4) % 5 === 2) tone = col.stemD;
    }
    g.px(x, y, tone);
    if (part.succulent && !dead && grown > 0.4 && s >= 1 && hw >= 1 && Math.abs(kk) >= hw - 0.51 && Math.round(u * 7) % 3 === 1) {
      const dir = kk < 0 ? -1 : 1;
      g.px(x + dir, y, col.spine);
    }
  });
}

function leafStroke(part, resolved, origin, k, grown, pose, habit) {
  let x;
  let y;
  let tangent = 0;
  if (part.attach) {
    const host = resolved[part.attach.host];
    if (!host) return null;
    const at = trace(host, part.attach.u ?? 1);
    x = at.x;
    y = at.y;
    tangent = at.angle;
  } else {
    x = origin.x + part.x * k;
    y = origin.y + part.y * k;
  }
  const leafPose = part.attach
    ? { ...pose, sway: (pose.sway ?? 1) * 0.4, lean: (pose.lean ?? 0) * 0.35, restDroop: (pose.restDroop ?? 0) * 0.2 }
    : pose;
  const uAtt = part.attach?.u ?? 1;
  const angle = (part.attach ? tangent : 0) + (part.angle ?? 0) + flutterOf(part.habit ?? habit, pose, uAtt, part.phase ?? 0);
  const len = (part.len ?? 1) * k * (0.4 + 0.6 * grown);
  const maxW = (part.width ?? 1.6) * k * (0.45 + 0.55 * grown);
  const kind = part.leafShape;
  return {
    x, y, angle, len,
    bend: part.bend ?? 0,
    droop: (part.droop ?? 0) * k,
    habit: part.habit ?? habit,
    pose: leafPose,
    phase: 0,
    width: (u) => {
      if (u < 0.08) return Math.max(1, k * 0.65);
      const t = Math.min(1, (u - 0.08) / 0.92);
      const shapeFn = LEAF_SHAPES[kind] ?? LEAF_SHAPES.lance;
      return Math.max(1, maxW * shapeFn(t));
    },
  };
}

function drawLeaf(g, part, resolved, origin, k, grown, col, dead, ph, pose, habit) {
  const stroke = leafStroke({ ...part, leafShape: ph.set.leaf }, resolved, origin, k, grown, pose, habit);
  if (!stroke || stroke.len <= 0) return;
  const shine = pose.sheen ?? 0;
  walkBent(stroke, (x, y, u, kk, hw) => {
    let tone = dead ? (kk > 0 ? col.strawD : col.straw) : kk < -hw * 0.35 ? col.leafL : kk > hw * 0.35 ? col.leafD : col.leaf;
    if (!dead && grown < 0.4) tone = col.leafL;
    if (!dead && ph.pigment === 'variegated' && Math.floor(u * 6 + (part.phase ?? 0) * 3) % 2 === 0) tone = col.pale;
    if (!dead && ph.pigment === 'gold' && hw > 0.8 && Math.abs(kk) > hw * 0.55) tone = col.gold;
    if (!dead && ph.s >= 2 && hw >= 1 && Math.abs(kk) < 0.55 && u > 0.12 && u < 0.86) tone = col.leafD;
    if (!dead && shine > 0.02 && Math.abs(u - shine) < 0.08 && Math.abs(kk) < Math.max(0.5, hw * 0.45)) tone = col.leafL;
    g.px(x, y, tone);
  });
}

function atHost(part, resolved) {
  const host = resolved[part.attach?.host];
  if (!host) return null;
  return trace(host, part.attach.u ?? 1);
}

function drawCanopy(g, part, resolved, k, grown, col, s, pose) {
  const at = atHost(part, resolved);
  if (!at) return;
  const rad = part.size * k * (0.4 + 0.6 * grown);
  if (rad < 0.6) return;
  const wag = (pose.lean ?? 0) * k * 0.4;
  const x = at.x + wag;
  const y = at.y;
  g.ellipse(x, y, rad * 1.15, rad, col.leaf);
  g.ellipse(x - rad * 0.28, y - rad * 0.28, rad * 0.55, rad * 0.42, col.leafL);
  if (s >= 2) {
    g.dither(Math.floor(x - rad * 1.2), Math.floor(y), Math.ceil(rad * 2.4) + 1, Math.ceil(rad) + 1, col.leafD, 0.45, (px, py) => g.get(px, py) === col.leaf);
  }
}

function drawTier(g, part, resolved, k, grown, col) {
  const at = atHost(part, resolved);
  if (!at) return;
  const rx = part.size * k * (0.45 + 0.55 * grown);
  const ry = Math.max(1, rx * 0.4);
  g.ellipse(at.x, at.y, rx, ry, col.leaf, (px, py) => py >= at.y - ry * 0.15);
  g.ellipse(at.x, at.y - ry * 0.15, rx * 0.45, ry * 0.35, col.leafL);
}

function drawCap(g, part, resolved, k, grown, col, pose, habit) {
  const at = atHost(part, resolved);
  if (!at) return;
  const r = part.size * k * (0.35 + 0.65 * grown);
  const wag = headWag(part.habit ?? habit, pose);
  const x = at.x + Math.sin(wag) * k;
  const y = at.y;
  g.ellipse(x, y, r, r * 0.68, col.cap, (px, py) => py + 0.5 <= y + r * 0.15);
  g.rect(Math.round(x - r * 0.75), Math.floor(y), Math.max(1, Math.round(r * 1.5)), 1, col.gill);
  if (grown > 0.5 && r > 1.5) g.px(Math.floor(x - r * 0.35), Math.floor(y - r * 0.35), col.capL);
}

function drawBloom(g, part, resolved, k, grown, col, s, pose, habit) {
  const at = atHost(part, resolved);
  if (!at) return;
  const open = clamp01(grown * (pose.bloom ?? 1));
  const wag = headWag(habit, pose);
  const x = at.x + Math.sin(wag) * k * 1.3;
  const y = at.y + Math.max(0, wag) * k * 0.15;
  bloom(g, part.kind ?? 'daisy', col, x, y, part.size * k, open, k, s, wag);
}

function bloom(g, kind, c, x, y, size, open, k, s, wag) {
  if (open < 0.45) {
    g.ellipse(x, y, Math.max(0.8, size * 0.35 * (0.5 + open)), Math.max(0.9, size * 0.5 * (0.5 + open)), open > 0.22 ? c.petalD : c.bud);
    return;
  }
  const r = size * (0.6 + 0.4 * open);
  const n = s >= 2 ? 8 : 6;
  switch (kind) {
    case 'daisy':
      for (let a = 0; a < n; a++) {
        const ang = (a / n) * Math.PI * 2 + wag * 0.35;
        walk({ x, y, angle: ang, len: r, width: () => Math.max(1, k * 0.85) }, (px, py, u) => g.px(px, py, u > 0.6 ? c.petalL : c.petal));
      }
      g.ellipse(x, y, Math.max(0.8, r * 0.36), Math.max(0.8, r * 0.36), c.heart);
      break;
    case 'cup':
      g.ellipse(x, y, r, r * 0.95, c.petal, (px, py) => py >= y - r * 0.3 || Math.abs(px - x) > r * 0.35);
      g.rect(Math.floor(x), Math.floor(y - r * 0.55), 1, Math.max(1, Math.round(r * 0.5)), c.petalD);
      g.px(Math.floor(x - r * 0.45), Math.floor(y), c.petalL);
      break;
    case 'spike':
      for (let i = 0; i < Math.max(2, Math.round(r * 2.2)); i++) {
        const w = i % 2 ? Math.max(1, Math.round(r * 0.55)) : Math.max(1, Math.round(r * 0.85));
        g.rect(Math.round(x - w / 2), Math.floor(y) - i, w, 1, i % 3 === 0 ? c.petalL : c.petal);
      }
      break;
    case 'cluster':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4 + wag * 0.2;
        g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.4, Math.max(0.7, r * 0.4), Math.max(0.7, r * 0.4), i % 2 ? c.petal : c.petalL);
      }
      break;
    case 'bell':
      g.ellipse(x, y + r * 0.35, r * 0.72, r * 0.85, c.petal, (px, py) => py <= y + r * 0.9);
      g.rect(Math.round(x - r * 0.85), Math.floor(y + r * 0.95), Math.max(1, Math.round(r * 1.7)), 1, c.petalD);
      break;
    default:
      g.ellipse(x, y, Math.max(0.8, r * 0.55), Math.max(0.8, r * 0.55), c.petal);
  }
}

function drawFruit(g, part, resolved, k, grown, col, set) {
  if (grown < 0.2) return;
  const at = atHost(part, resolved);
  if (!at) return;
  const x = Math.floor(at.x + (part.hang ?? 0) * k);
  const y = Math.floor(at.y + 0.35 * k);
  const ripe = grown >= 0.9;
  if (part.grain || set.fruit === 'grain') {
    const ear = ripe ? g.color('#e8b820') : g.color('#c8c070');
    g.rect(x, y - Math.max(2, Math.round(k * 1.4)), Math.max(1, Math.round(k * 0.8)), Math.max(2, Math.round(k * 1.6)), ear);
    return;
  }
  if (set.fruit === 'pod') {
    g.rect(x, y, Math.max(1, Math.round(k)), Math.max(2, Math.round(2 * k)), ripe ? col.fruit : col.bud);
    return;
  }
  const rad = Math.max(0.8, (set.fruit === 'round' ? 1.15 : 0.8) * k);
  g.ellipse(x + 0.5, y + 0.5, rad, rad, ripe ? col.fruit : col.bud);
  if (ripe && k > 1) g.px(x, y, col.fruitL);
}

function sparkle(g, ph, pose, t, col) {
  if (ph.set.glow === 'none' || t < 0.6 || (pose.glow ?? 0) < 0.18) return;
  const pts = [];
  const stride = Math.max(2, Math.round(ph.classH / 24));
  for (let y = 0; y < g.h; y += stride) {
    for (let x = 0; x < g.w; x += stride) if (g.get(x, y)) pts.push(x, y);
  }
  if (pts.length < 2) return;
  const roll = roller(ph.seed, 7000);
  const n = ph.set.glow === 'sparkle' ? 3 : ph.set.glow === 'crystal' ? 4 : 2;
  const shift = Math.floor((pose.glow ?? 0.5) * 13);
  for (let i = 0; i < n; i++) {
    const j = Math.floor(roll.range(0, pts.length / 2, i + 3)) + shift;
    const p = ((j % (pts.length / 2)) + pts.length / 2) % (pts.length / 2);
    const x = pts[p * 2];
    const y = pts[p * 2 + 1];
    if (g.get(x, y)) g.px(x, y, col.glow);
  }
}

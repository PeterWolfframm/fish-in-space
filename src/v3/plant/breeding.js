// Breeding plant3. Smaller than the fish, same shape: proportions land near the parents'
// mean, colours snap to a swatch between them, pigment is Mendelian, and a few species pairs
// can strike a named cross. `breedDetailed` returns the child and what happened.

import { roller } from '../../pixel/rng.js';
import { mix, rgbOf } from '../../pixel/color.js';
import { LEAF_COLORS, STEM_COLORS, BLOOM_COLORS } from '../../gen/plant.js';
import { plant3Traits, stepOf, STEP_IDS, labelOf, normalizePlant } from './genome.js';
import { SPECIES, resolveSpec } from './habits.js';
import { genetics } from './phenotype.js';

const T = plant3Traits;
const STEPS = ['stemH', 'spread', 'leafSize', 'thick'];
const SIZES = ['herb', 'shrub', 'tall', 'tree', 'giant'];
const HEIGHTS = ['low', 'medium', 'tall'];
const NAMED = {
  'flower|willow': 'weeping',
  'flower|grass': 'meadow',
  'conifer|tree': 'fir',
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function nearest(choices, hex) {
  let best = choices[0]?.id;
  let bestD = Infinity;
  const [r, g, b] = rgbOf(hex);
  for (const c of choices) {
    if (!c.hex) continue;
    const [r2, g2, b2] = rgbOf(c.hex);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

const specLabel = (id) => SPECIES[id]?.label ?? id;

/** The child of `a` and `b`, and what happened. */
export function breedDetailed(a, b, seed) {
  const A = normalizePlant(a);
  const B = normalizePlant(b);
  const { r, chance, pick } = roller(seed, 5200);
  const events = [];
  const say = (kind, text) => events.push({ kind, text });
  const child = T.combine(A, B, seed);

  const drift = (salt) => (r(salt) - 0.5) * 2.2;
  STEPS.forEach((f, i) => {
    const v = Math.round((stepOf(A[f]) + stepOf(B[f])) / 2 + drift(100 + i));
    child[f] = STEP_IDS[clamp(v, -3, 3) + 3];
  });
  const si = clamp(Math.round((SIZES.indexOf(A.size) + SIZES.indexOf(B.size)) / 2 + drift(140) * 0.45), 0, SIZES.length - 1);
  child.size = SIZES[si];
  const hi = clamp(Math.round((HEIGHTS.indexOf(A.height) + HEIGHTS.indexOf(B.height)) / 2), 0, 2);
  child.height = HEIGHTS[hi];

  if (A.leafColor !== B.leafColor && r(150) < 0.6) {
    const id = nearest(LEAF_COLORS, mix(hexOf(A, 'leafColor'), hexOf(B, 'leafColor'), 0.5));
    if (id && id !== A.leafColor && id !== B.leafColor) {
      child.leafColor = id;
      say('blend', `leaves blended to ${labelOf(child, 'leafColor').toLowerCase()}`);
    }
  }
  if (A.stemColor !== B.stemColor && r(154) < 0.6) {
    const id = nearest(STEM_COLORS, mix(hexOf(A, 'stemColor'), hexOf(B, 'stemColor'), 0.5));
    if (id && id !== A.stemColor && id !== B.stemColor) child.stemColor = id;
  }
  if (A.bloom !== 'none' && B.bloom !== 'none' && A.petal !== B.petal && r(156) < 0.6) {
    const id = nearest(BLOOM_COLORS, mix(hexOf(A, 'petal'), hexOf(B, 'petal'), 0.5));
    if (id) child.petal = id;
  }

  child.geneA = chance(0.5, 170) ? A.geneA : A.geneB;
  child.geneB = chance(0.5, 171) ? B.geneA : B.geneB;

  const keep = new Set([...STEPS, 'size', 'height', 'geneA', 'geneB', 'cross', 'species', 'form', 'look']);
  const varied = T.vary(child, 0.06, `${seed}:mut`);
  for (const f of T.fields) {
    if (keep.has(f.id) || A[f.id] === B[f.id]) continue;
    child[f.id] = varied[f.id];
  }

  child.cross = 'none';
  const named = NAMED[[A.species, B.species].sort().join('|')];
  if (named && chance(0.4, 182)) {
    child.cross = named;
    if ((named === 'weeping' || named === 'meadow') && child.bloom === 'none') child.bloom = 'daisy';
    if (named === 'fir') child.leaf = 'needle';
    say('hybrid', `hybrid! ${specLabel(A.species)} × ${specLabel(B.species)} made a ${resolveSpec(child).label.toLowerCase()}`);
  } else if (resolveSpec(A).habit === resolveSpec(B).habit && A.species !== B.species && chance(0.22, 184)) {
    say('hybrid', `${specLabel(A.species)} × ${specLabel(B.species)} grew as one plant`);
  }

  if (chance(0.04, 200)) {
    const allele = pick(['variegated', 'silver', 'gold', 'purple'], 201);
    if (chance(0.5, 202)) child.geneA = allele;
    else child.geneB = allele;
    say('sport', `sport: a new ${allele} gene appeared`);
  }

  const out = normalizePlant(child);
  const shown = genetics(out).pigment;
  if (shown !== 'green' && shown !== genetics(A).pigment && shown !== genetics(B).pigment) {
    say('reveal', `surprise: both parents carried ${shown}`);
  }
  return { child: out, events };
}

/** The plain breed hook: just the child. */
export const breed = (a, b, seed) => breedDetailed(a, b, seed).child;

function hexOf(set, id) {
  return T.choiceOf(set, id)?.hex ?? '#888888';
}

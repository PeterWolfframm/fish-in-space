// Materials: role colours → hue-shifted ramps the painter indexes by tone. One table per plant;
// index 0 is "nothing". Ramps get more steps as the sprite grows, so a 16 px lettuce keeps
// three or four flat shades and a 96 px oak gets a soft roll-off.

import { hueRamp } from '../../../v2/kit/ramp.js';
import { mix, shade, rotateHue } from '../../../pixel/color.js';

const ORDER = [
  'bark', 'stem', 'leaf', 'leafB', 'tip', 'petal', 'petal2', 'eye', 'fruit', 'fruit2', 'root', 'bed', 'bed2',
  'rock', 'wood', 'glow', 'snow', 'coral', 'cap', 'capSpot', 'straw', 'leafAut', 'leafAutB', 'pale', 'cane',
  'grass', 'pot', 'spine',
];

const WEIGHT = { petal: 6, petal2: 6, eye: 6, fruit: 7, fruit2: 7, glow: 8, cap: 5, leaf: 4, leafB: 4, tip: 4, leafAut: 4, leafAutB: 4, straw: 4, coral: 4, bark: 3, stem: 3, cane: 3, wood: 2, snow: 5, bed: 1, bed2: 1, rock: 1, pot: 2, grass: 1, pale: 3, spine: 1, root: 5, capSpot: 5 };

/**
 * `c`: { leaf, tip, bark, petal, eye, fruit, root, coral, autumn, glow, cap, bed: {bed, bed2, grass} }
 * `steps`: ramp length. Returns { mats, M } — mats[i] = { ramp, glow?, weight }, M[name] = i.
 */
export function buildMaterials(c, steps = 5) {
  const leaf = c.leaf;
  const hex = {
    bark: c.bark,
    stem: mix(shade(leaf, 0.86), c.bark, 0.18),
    leaf,
    leafB: shade(rotateHue(leaf, -10), 0.86),
    tip: c.tip,
    petal: c.petal,
    petal2: mix(c.petal, '#ffffff', 0.35),
    eye: c.eye,
    fruit: c.fruit,
    fruit2: c.fruit2 ?? '#f2dc6a',
    root: c.root,
    bed: c.bed?.bed ?? '#6a4a32',
    bed2: c.bed?.bed2 ?? '#4f3624',
    rock: c.bed?.rock ?? '#76767e',
    wood: '#8a6a44',
    glow: c.glow,
    snow: '#e8f0f8',
    coral: c.coral,
    cap: c.cap ?? c.fruit,
    capSpot: '#f4ecdc',
    straw: '#d8b45a',
    leafAut: c.autumn,
    leafAutB: shade(rotateHue(c.autumn, -12), 0.84),
    pale: '#e6dcc2',
    cane: c.bark,
    grass: c.bed?.grass ?? '#5a9a3a',
    pot: '#b8643a',
    spine: '#f0ead8',
  };
  const mats = [null];
  const M = {};
  for (const name of ORDER) {
    const n = name === 'snow' || name === 'spine' || name === 'capSpot' ? Math.min(3, steps) : steps;
    const ramp = hueRamp(hex[name], { steps: n, dark: name === 'glow' ? 0.4 : 0.62, light: name === 'snow' ? 0.8 : 0.6 });
    M[name] = mats.length;
    mats.push({ ramp, weight: WEIGHT[name] ?? 2, glow: name === 'glow' });
  }
  return { mats, M, hex };
}

export const STEPS = { herb: 4, shrub: 5, tall: 5, tree: 6, giant: 6 };

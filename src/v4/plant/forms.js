// Plant forms: each is DATA for the architecture engine (engine/arch.js), not a painter. A form
// says how many axes rise from the ground, how each order branches (phyllotaxis, angle, the
// length profile that makes a cone or a dome), how stiff and how heavy each order is, and which
// organs hang where. The genome then bends these numbers (resolve.js), so one form is a family:
// a tall thin oak and a squat wide one, a sparse wheat and a dense one.
//
// Units: the first trunk, tiller or stipe is about 1 long; organ sizes are in the same units.
// `sizes`: which size classes the form comes in (weights). `maxW`: how wide it may be, as a
// multiple of its height, before it is scaled to fit (pumpkins and carpets are wide).
// `colors`: the swatches it prefers (palettes.js ids); the ecotype roll starts from these.

const leafAt = (kind, size, extra = {}) => ({ type: 'leaf', kind, at: 'tip', order: 0, size, ...extra });
const crown = (sizes) => sizes.map(([order, size, extra = {}]) => ({ type: 'clump', order, at: 'tip', size, sizeVar: 0.22, ...extra }));

const TREE_SIZES = { tall: 1, tree: 3, giant: 2 };
const CROP_SIZES = { herb: 3, shrub: 2 };
const HERB_SIZES = { herb: 2, shrub: 3, tall: 1 };
const SHRUB_SIZES = { shrub: 3, tall: 2, tree: 1 };
const AQUA_SIZES = { herb: 1, shrub: 3, tall: 2, tree: 1 };

export const FORMS = {
  // ─────────────────────────────── land: crops ───────────────────────────────
  lettuce: {
    label: 'Lettuce', realm: 'land', crop: true, sizes: CROP_SIZES, maxW: 1.8,
    base: { n: [8, 12], fan: 1.25, angleVar: 0.12, lenVar: 0.35, depth: true, stagger: 0.05 },
    axes: [{ len: 0.12, r: 0.02, segs: 2, mat: 'stem' }],
    organs: [leafAt('ruffle', 0.55, { sizeVar: 0.2, droop: 0.22 })],
    colors: { leaf: ['lime', 'spring', 'redleaf'], bed: ['tilled', 'soil'] },
    stats: { days: 5, regrow: 0, sell: 50, season: 'spring' },
  },
  cabbage: {
    label: 'Cabbage', realm: 'land', crop: true, sizes: CROP_SIZES, maxW: 1.9,
    base: { n: [6, 8], fan: 1.4, angleVar: 0.1, lenVar: 0.3, depth: true },
    axes: [{ len: 0.1, r: 0.02, segs: 2, mat: 'stem' }],
    organs: [leafAt('round', 0.46, { droop: 0.55 }), { type: 'head', kind: 'cabbage', at: 'base', size: 0.3, birth: 0.3, dur: 0.5 }],
    colors: { leaf: ['bluegreen', 'sage', 'purple'], bed: ['tilled', 'soil'] },
    stats: { days: 9, regrow: 0, sell: 120, season: 'autumn' },
  },
  kale: {
    label: 'Kale', realm: 'land', crop: true, sizes: CROP_SIZES, maxW: 1.4,
    base: { n: [5, 7], fan: 0.7, angleVar: 0.15, lenVar: 0.25, depth: true },
    axes: [{ len: 0.45, r: 0.02, segs: 3, gravi: 0.2, mat: 'stem' }],
    organs: [leafAt('ruffle', 0.6, { aspect: 0.32, droop: 0.4 })],
    colors: { leaf: ['bluegreen', 'deep', 'purple'], bed: ['tilled'] },
    stats: { days: 6, regrow: 0, sell: 110, season: 'spring' },
  },
  carrot: {
    label: 'Carrot', realm: 'land', crop: true, sizes: CROP_SIZES, maxW: 1.4,
    base: { n: [4, 7], fan: 0.45, angleVar: 0.12, lenVar: 0.3, depth: true },
    axes: [{ len: 0.55, r: 0.012, segs: 3, gravi: 0.3, mat: 'stem' }],
    organs: [leafAt('frond', 0.5, { droop: 0.3 }), { type: 'root', kind: 'carrot', at: 'base', size: 0.085, birth: 0.25, dur: 0.6 }],
    colors: { leaf: ['grass', 'spring'], root: ['carrot', 'purpleroot', 'cream'], bed: ['tilled', 'soil'] },
    stats: { days: 6, regrow: 0, sell: 35, season: 'spring' },
  },
  radish: {
    label: 'Radish', realm: 'land', crop: true, sizes: CROP_SIZES, maxW: 1.6,
    base: { n: [3, 5], fan: 0.65, angleVar: 0.12, lenVar: 0.25, depth: true },
    axes: [{ len: 0.25, r: 0.015, segs: 2, gravi: 0.2, mat: 'stem' }],
    organs: [leafAt('oval', 0.55, { aspect: 0.4, droop: 0.3 }), { type: 'root', kind: 'radish', at: 'base', size: 0.13, birth: 0.25, dur: 0.6 }],
    colors: { leaf: ['spring', 'grass'], root: ['radish', 'beet', 'cream'], bed: ['tilled', 'soil'] },
    stats: { days: 6, regrow: 0, sell: 90, season: 'summer' },
  },
  onion: {
    label: 'Onion', realm: 'land', crop: true, sizes: CROP_SIZES, maxW: 1,
    base: { n: [3, 5], fan: 0.22, angleVar: 0.1, lenVar: 0.2 },
    axes: [{ len: 0.85, r: 0.022, taper: 0.35, segs: 4, gravi: 0.15, wiggle: 0.07, mat: 'leaf' }],
    organs: [{ type: 'root', kind: 'onion', at: 'base', size: 0.12, birth: 0.3, dur: 0.55 }],
    colors: { leaf: ['bluegreen', 'sage'], root: ['onion', 'redonion'], bed: ['tilled'] },
    stats: { days: 7, regrow: 0, sell: 60, season: 'spring' },
  },
  wheat: {
    label: 'Wheat', realm: 'land', crop: true, ripen: true, sizes: { herb: 2, shrub: 3 }, maxW: 1,
    base: { n: [6, 10], fan: 0.2, spread: 0.12, angleVar: 0.06, lenVar: 0.15 },
    axes: [{ len: 1, r: 0.01, taper: 0.6, segs: 6, gravi: 0.2, mat: 'stem', stiff: 1.4 }],
    organs: [
      { type: 'leaf', kind: 'strap', order: 0, at: 'nodes', n: 2, from: 0.12, to: 0.45, angle: 0.45, droop: 0.6, size: 0.32 },
      { type: 'grain', order: 0, at: 'tip', size: 0.09 },
    ],
    fruitAt: 0.86,
    colors: { leaf: ['grass', 'olive'], fruit: ['gold'], bed: ['tilled'] },
    stats: { days: 4, regrow: 0, sell: 25, season: 'summer' },
  },
  corn: {
    label: 'Corn', realm: 'land', crop: true, sizes: { shrub: 2, tall: 2 }, maxW: 1.1,
    base: { n: [1, 1] },
    axes: [{ len: 1, r: 0.035, taper: 0.55, segs: 7, gravi: 0.6, mat: 'stem', stiff: 0.7 }],
    organs: [
      { type: 'leaf', kind: 'strap', order: 0, at: 'nodes', n: 6, from: 0.1, to: 0.85, angle: 0.55, angleVar: 0.2, droop: 0.28, size: 0.6 },
      { type: 'ear', order: 0, at: 'nodes', n: 1, from: 0.46, to: 0.52, angle: 0.35, size: 0.12 },
      { type: 'tassel', order: 0, at: 'tip', size: 0.06 },
    ],
    colors: { leaf: ['grass', 'spring'], fruit: ['gold', 'cream'], bed: ['tilled'] },
    stats: { days: 14, regrow: 4, sell: 50, season: 'summer' },
  },
  tomato: {
    label: 'Tomato', realm: 'land', crop: true, prop: 'stake', sizes: { shrub: 3, tall: 1 }, maxW: 1.2,
    base: { n: [1, 1] },
    axes: [
      { len: 1, r: 0.025, taper: 0.6, segs: 6, wiggle: 0.05, gravi: 0.8, mat: 'stem', stiff: 0.9, kids: { phyllo: 'alt', n: 5, from: 0.15, to: 0.88, profile: 'taper', angle: 0.95, angleVar: 0.15, depth: 0.3 } },
      { len: 0.42, r: 0.6, segs: 3, gravi: -0.2, mat: 'stem' },
    ],
    organs: [
      { type: 'leaf', kind: 'pinnate', order: 1, at: 'tip', size: 0.2, droop: 0.3 },
      { type: 'leaf', kind: 'pinnate', order: 1, at: 'nodes', n: 1, from: 0.5, to: 0.5, size: 0.15, angle: 0.8, droop: 0.3 },
      leafAt('oval', 0.13),
      { type: 'bloom', kind: 'star', order: 1, at: 'nodes', n: 1, from: 0.3, to: 0.3, p: 0.6, size: 0.04, until: 0.9 },
      { type: 'fruit', kind: 'tomato', order: 1, at: 'nodes', n: 2, from: 0.25, to: 0.8, p: 0.55, size: 0.05, hang: true },
    ],
    colors: { leaf: ['grass', 'forest'], petal: ['yellow'], fruit: ['red', 'orange', 'yellow'], bed: ['tilled'] },
    stats: { days: 11, regrow: 4, sell: 60, season: 'summer' },
  },
  bean: {
    label: 'Pole bean', realm: 'land', crop: true, prop: 'pole', sizes: { shrub: 2, tall: 2 }, maxW: 0.9,
    base: { n: [1, 1] },
    axes: [{ len: 1.05, r: 0.012, taper: 0.7, segs: 12, twine: 0.22, gravi: 1.2, mat: 'stem' }],
    organs: [
      { type: 'leaf', kind: 'heart', order: 0, at: 'nodes', n: 7, from: 0.1, to: 0.96, angle: 1.1, size: 0.15, droop: 0.4 },
      { type: 'fruit', kind: 'pod', order: 0, at: 'nodes', n: 4, from: 0.3, to: 0.8, size: 0.05, hang: true },
    ],
    colors: { leaf: ['grass', 'spring'], fruit: ['lime', 'purple', 'yellow'], bed: ['tilled'] },
    stats: { days: 10, regrow: 3, sell: 40, season: 'spring' },
  },
  pumpkin: {
    label: 'Pumpkin', realm: 'land', crop: true, sizes: { herb: 1, shrub: 3 }, maxW: 1.6,
    base: { n: [2, 3], fan: 1.2, angleVar: 0.12 },
    axes: [{ len: 0.7, r: 0.022, taper: 0.6, segs: 8, wiggle: 0.08, gravi: -0.25, mat: 'stem' }],
    organs: [
      { type: 'leaf', kind: 'heart', order: 0, at: 'nodes', n: 3, from: 0.2, to: 0.95, angle: 0.25, size: 0.4, droop: 0.15, up: true },
      { type: 'fruit', kind: 'gourd', order: 0, at: 'nodes', n: 1, from: 0.4, to: 0.55, p: 0.85, size: 0.21 },
    ],
    colors: { leaf: ['grass', 'deep'], fruit: ['pumpkin', 'cream', 'lime'], bed: ['soil', 'tilled'] },
    stats: { days: 13, regrow: 0, sell: 320, season: 'autumn' },
  },
  pepper: {
    label: 'Pepper', realm: 'land', crop: true, sizes: CROP_SIZES, maxW: 1.3,
    base: { n: [1, 1] },
    axes: [
      { len: 0.42, r: 0.03, taper: 0.7, segs: 3, gravi: 0.8, mat: 'stem', kids: { phyllo: 'fork', n: 3, angle: 0.6, angleVar: 0.15 } },
      { len: 1.0, r: 0.6, segs: 4, gravi: 0.4, mat: 'stem', kids: { phyllo: 'alt', n: 2, from: 0.5, to: 0.9, angle: 0.6 } },
      { len: 0.5, r: 0.7, segs: 3, gravi: 0.3, mat: 'stem' },
    ],
    organs: [
      { type: 'leaf', kind: 'lance', order: [1, 2], at: 'nodes', n: 3, from: 0.3, to: 1, size: 0.17, droop: 0.25 },
      { type: 'fruit', kind: 'pepper', order: 1, at: 'nodes', n: 2, from: 0.35, to: 0.8, p: 0.7, size: 0.07, hang: true },
    ],
    colors: { leaf: ['forest', 'grass'], fruit: ['red', 'yellow', 'orange', 'lime'], bed: ['tilled'] },
    stats: { days: 5, regrow: 3, sell: 40, season: 'summer' },
  },
  strawberry: {
    label: 'Strawberry', realm: 'land', crop: true, sizes: CROP_SIZES, maxW: 1.8,
    base: { n: [5, 8], fan: 1.15, angleVar: 0.12, lenVar: 0.3, depth: true },
    axes: [{ len: 0.35, r: 0.012, segs: 3, gravi: 0.1, mat: 'stem' }],
    organs: [
      leafAt('trifol', 0.28, { droop: 0.1 }),
      { type: 'bloom', kind: 'star', order: 0, at: 'nodes', n: 1, from: 0.7, to: 0.7, p: 0.35, size: 0.06, until: 0.9 },
      { type: 'fruit', kind: 'strawberry', order: 0, at: 'nodes', n: 1, from: 0.45, to: 0.6, p: 0.5, size: 0.07 },
    ],
    colors: { leaf: ['forest', 'grass'], petal: ['white'], fruit: ['red'], bed: ['soil', 'tilled'] },
    stats: { days: 8, regrow: 4, sell: 120, season: 'spring' },
  },

  // ───────────────────────────── land: flowers ───────────────────────────────
  sunflower: {
    label: 'Sunflower', realm: 'land', sizes: { shrub: 2, tall: 3 }, maxW: 0.9,
    base: { n: [1, 1] },
    axes: [{ len: 1, r: 0.03, taper: 0.75, segs: 6, gravi: 0.9, mat: 'stem', stiff: 0.8 }],
    organs: [
      { type: 'leaf', kind: 'heart', order: 0, at: 'nodes', n: 5, from: 0.15, to: 0.75, angle: 1, size: 0.24, droop: 0.35, shrink: 0.4 },
      { type: 'bloom', kind: 'composite', order: 0, at: 'tip', angle: 0.35, size: 0.17 },
    ],
    bloomAt: 0.78,
    colors: { leaf: ['grass'], petal: ['yellow', 'orange'], eye: ['brown'], bed: ['soil', 'grass'] },
    stats: { days: 8, regrow: 0, sell: 80, season: 'summer' },
  },
  tulip: {
    label: 'Tulip', realm: 'land', sizes: { herb: 3, shrub: 2 }, maxW: 1,
    base: { n: [1, 3], fan: 0.18, spread: 0.08 },
    axes: [{ len: 0.7, r: 0.016, segs: 4, gravi: 0.9, mat: 'stem' }],
    organs: [
      { type: 'leaf', kind: 'strap', order: 0, at: 'nodes', n: 2, from: 0.03, to: 0.12, angle: 0.35, size: 0.5, aspect: 0.16, droop: 0.3 },
      { type: 'bloom', kind: 'cup', order: 0, at: 'tip', size: 0.1 },
    ],
    colors: { leaf: ['bluegreen', 'sage'], petal: ['red', 'pink', 'yellow', 'purple', 'white'], bed: ['soil', 'grass'] },
    stats: { days: 6, regrow: 0, sell: 30, season: 'spring' },
  },
  daisy: {
    label: 'Daisy', realm: 'land', sizes: HERB_SIZES, maxW: 1.2,
    base: { n: [3, 6], fan: 0.45, spread: 0.05, lenVar: 0.25 },
    axes: [{ len: 0.85, r: 0.01, segs: 4, wiggle: 0.08, gravi: 0.6, mat: 'stem' }],
    organs: [
      { type: 'leaf', kind: 'lance', order: 0, at: 'nodes', n: 2, from: 0.05, to: 0.25, angle: 0.8, size: 0.2, droop: 0.3 },
      { type: 'bloom', kind: 'daisy', order: 0, at: 'tip', size: 0.1 },
    ],
    colors: { leaf: ['grass', 'spring'], petal: ['white', 'pink', 'yellow', 'lavender'], eye: ['yellow', 'brown'], bed: ['grass', 'soil'] },
    stats: { days: 7, regrow: 0, sell: 40, season: 'summer' },
  },
  lavender: {
    label: 'Lavender', realm: 'land', sizes: HERB_SIZES, maxW: 1.3,
    base: { n: [6, 11], fan: 0.5, spread: 0.06, lenVar: 0.25 },
    axes: [{ len: 1, r: 0.008, segs: 4, gravi: 0.5, mat: 'stem' }],
    organs: [
      { type: 'leaf', kind: 'needle', order: 0, at: 'nodes', n: 3, from: 0.04, to: 0.4, size: 0.12, angle: 0.5 },
      { type: 'bloom', kind: 'spike', order: 0, at: 'tip', size: 0.09 },
    ],
    colors: { leaf: ['sage'], petal: ['lavender', 'purple', 'white'], bed: ['soil', 'gravel'] },
    stats: { days: 9, regrow: 0, sell: 70, season: 'summer' },
  },
  rose: {
    label: 'Rose', realm: 'land', sizes: { shrub: 3, tall: 2 }, maxW: 1.3,
    base: { n: [2, 3], fan: 0.35, angleVar: 0.12 },
    axes: [
      { len: 0.7, r: 0.025, segs: 4, wiggle: 0.1, gravi: 0.5, mat: 'stem', kids: { phyllo: 'alt', n: 3, from: 0.35, to: 0.9, angle: 0.6, depth: 0.3 } },
      { len: 0.55, r: 0.6, segs: 3, wiggle: 0.08, gravi: 0.4, mat: 'stem' },
    ],
    organs: [
      { type: 'leaf', kind: 'oval', order: [0, 1], at: 'nodes', n: 4, from: 0.2, to: 0.9, size: 0.09, angle: 0.9, depth: 0.3 },
      { type: 'bloom', kind: 'rose', order: 'last', at: 'tip', p: 0.85, size: 0.09 },
    ],
    colors: { leaf: ['forest', 'deep'], petal: ['red', 'pink', 'white', 'yellow'], bed: ['soil', 'grass'] },
    stats: { days: 12, regrow: 0, sell: 150, season: 'summer' },
  },

  // ───────────────────────────── land: shrubs ────────────────────────────────
  bush: {
    label: 'Berry bush', realm: 'land', deciduous: true, sizes: SHRUB_SIZES, maxW: 1.5,
    base: { n: [3, 5], fan: 0.55, angleVar: 0.15, spread: 0.05 },
    axes: [
      { len: 0.65, r: 0.03, taper: 0.5, segs: 4, wiggle: 0.1, gravi: 0.2, mat: 'bark', kids: { phyllo: 'alt', n: 3, from: 0.4, to: 0.95, angle: 0.6, depth: 0.4 } },
      { len: 0.55, r: 0.6, segs: 3, wiggle: 0.1, gravi: 0.2, mat: 'bark' },
    ],
    organs: [
      ...crown([['last', 0.22], [0, 0.24]]),
      { type: 'fruit', kind: 'berry', at: 'clumps', n: 4, size: 0.03, reach: 0.75 },
    ],
    colors: { leaf: ['forest', 'grass', 'deep'], bark: ['brown', 'red'], fruit: ['blue', 'red', 'purple', 'black'], bed: ['grass', 'soil'] },
    stats: { days: 14, regrow: 3, sell: 50, season: 'summer' },
  },
  hydrangea: {
    label: 'Flowering shrub', realm: 'land', deciduous: true, sizes: SHRUB_SIZES, maxW: 1.5,
    base: { n: [3, 5], fan: 0.6, angleVar: 0.15, spread: 0.05 },
    axes: [
      { len: 0.6, r: 0.028, taper: 0.5, segs: 4, wiggle: 0.08, gravi: 0.3, mat: 'stem', kids: { phyllo: 'alt', n: 3, from: 0.4, to: 0.95, angle: 0.55, depth: 0.4 } },
      { len: 0.5, r: 0.6, segs: 3, gravi: 0.2, mat: 'stem' },
    ],
    organs: [...crown([['last', 0.2], [0, 0.22]]), { type: 'bloom', kind: 'umbel', at: 'clumps', n: 1, size: 0.09, reach: 0.5, lower: -0.3 }],
    colors: { leaf: ['grass', 'forest'], petal: ['blue', 'pink', 'white', 'purple'], bed: ['soil', 'grass'] },
    stats: { days: 16, regrow: 0, sell: 180, season: 'summer' },
  },

  // ────────────────────────────── land: trees ────────────────────────────────
  oak: {
    label: 'Oak', realm: 'land', tree: true, deciduous: true, sizes: TREE_SIZES, maxW: 1.25,
    base: { n: [1, 1] },
    axes: [
      { len: 0.8, r: 0.075, taper: 0.5, segs: 5, wiggle: 0.04, gravi: 0.6, tex: 'bark', mat: 'bark', stiff: 0.4, kids: { phyllo: 'alt', n: 5, from: 0.42, to: 0.96, profile: 'dome', angle: 0.8, angleVar: 0.25, depth: 0.4 } },
      { len: 0.62, r: 0.62, taper: 0.45, segs: 4, wiggle: 0.08, gravi: 0.25, mat: 'bark', stiff: 0.8, kids: { phyllo: 'alt', n: 3, from: 0.35, to: 0.95, angle: 0.65, angleVar: 0.2, depth: 0.35 } },
      { len: 0.5, r: 0.6, taper: 0.4, segs: 3, wiggle: 0.1, gravi: 0.3, mat: 'bark', stiff: 1 },
    ],
    organs: crown([['last', 0.2], [1, 0.24], [0, 0.3]]),
    colors: { leaf: ['forest', 'grass', 'olive'], bark: ['brown', 'grey'], autumn: ['amber', 'rust'], bed: ['grass'] },
    stats: { days: 28, regrow: 0, sell: 0, season: 'any' },
  },
  maple: {
    label: 'Maple', realm: 'land', tree: true, deciduous: true, sizes: TREE_SIZES, maxW: 1.1,
    base: { n: [1, 1] },
    axes: [
      { len: 0.85, r: 0.06, taper: 0.5, segs: 5, wiggle: 0.04, gravi: 0.7, tex: 'bark', mat: 'bark', stiff: 0.45, kids: { phyllo: 'alt', n: 6, from: 0.38, to: 0.98, profile: 'vase', angle: 0.6, angleVar: 0.2, depth: 0.4 } },
      { len: 0.55, r: 0.6, taper: 0.45, segs: 4, wiggle: 0.06, gravi: 0.45, mat: 'bark', kids: { phyllo: 'alt', n: 2, from: 0.4, to: 0.95, angle: 0.55, depth: 0.3 } },
      { len: 0.5, r: 0.6, segs: 3, gravi: 0.4, mat: 'bark' },
    ],
    organs: crown([['last', 0.19], [1, 0.22], [0, 0.26]]),
    colors: { leaf: ['grass', 'forest'], bark: ['grey', 'brown'], autumn: ['scarlet', 'amber'], bed: ['grass'] },
    stats: { days: 28, regrow: 0, sell: 0, season: 'any' },
  },
  fruittree: {
    label: 'Fruit tree', realm: 'land', tree: true, deciduous: true, sizes: { tall: 2, tree: 3, giant: 1 }, maxW: 1.3,
    base: { n: [1, 1] },
    axes: [
      { len: 0.55, r: 0.06, taper: 0.55, segs: 4, wiggle: 0.08, gravi: 0.6, tex: 'bark', mat: 'bark', stiff: 0.4, kids: { phyllo: 'alt', n: 5, from: 0.5, to: 0.98, profile: 'dome', angle: 0.85, angleVar: 0.25, depth: 0.4 } },
      { len: 0.85, r: 0.62, taper: 0.45, segs: 4, wiggle: 0.12, gravi: 0.3, mat: 'bark', kids: { phyllo: 'alt', n: 3, from: 0.35, to: 0.95, angle: 0.6, depth: 0.35 } },
      { len: 0.5, r: 0.6, segs: 3, wiggle: 0.1, gravi: 0.3, mat: 'bark' },
    ],
    organs: [
      ...crown([['last', 0.18], [1, 0.22], [0, 0.26]]),
      { type: 'bloom', kind: 'blossom', at: 'clumps', n: 4, size: 0.035, reach: 0.8, lower: -0.05, season: 'spring', winter: false },
      { type: 'fruit', kind: 'pome', at: 'clumps', n: 2, size: 0.04, reach: 0.7, season: 'summer' },
    ],
    bloomAt: 0.82, fruitAt: 0.9,
    colors: { leaf: ['grass', 'forest'], bark: ['brown', 'red'], petal: ['blush', 'white'], fruit: ['red', 'orange', 'yellow', 'lime'], autumn: ['amber'], bed: ['grass'] },
    stats: { days: 28, regrow: 1, sell: 100, season: 'summer' },
  },
  spruce: {
    label: 'Spruce', realm: 'land', tree: true, sizes: TREE_SIZES, maxW: 0.9,
    base: { n: [1, 1] },
    axes: [
      { len: 1, r: 0.045, taper: 0.12, segs: 8, gravi: 1, tex: 'bark', mat: 'bark', stiff: 0.5, kids: { phyllo: 'whorl', n: 7, from: 0.12, to: 0.97, profile: 'cone', angle: 1.3, angleVar: 0.1, depth: 1 } },
      { len: 0.38, r: 0.4, w: 0.065, taper: 0.3, segs: 4, gravi: -0.35, style: 'bough', mat: 'leaf', stiff: 1 },
    ],
    organs: [{ type: 'fruit', kind: 'cone', order: 1, at: 'tip', p: 0.22, size: 0.035, hang: true, winter: true }],
    colors: { leaf: ['pine', 'deep', 'bluegreen'], bark: ['darkbrown', 'brown'], bed: ['grass'] },
    stats: { days: 28, regrow: 0, sell: 0, season: 'any' },
  },
  cypress: {
    label: 'Cypress', realm: 'land', tree: true, sizes: TREE_SIZES, maxW: 0.5,
    base: { n: [1, 1] },
    axes: [{ len: 1, r: 0.03, taper: 0.3, segs: 7, gravi: 1, mat: 'bark', stiff: 0.5 }],
    organs: [
      { type: 'clump', order: 0, at: 'nodes', n: 7, from: 0.12, to: 1, size: 0.14, shrink: 0.55, aspect: 1.25, angle: 0.15, lumps: 0.1 },
    ],
    colors: { leaf: ['pine', 'deep'], bark: ['brown'], bed: ['grass'] },
    stats: { days: 28, regrow: 0, sell: 0, season: 'any' },
  },
  birch: {
    label: 'Birch', realm: 'land', tree: true, deciduous: true, sizes: TREE_SIZES, maxW: 0.95,
    base: { n: [1, 2], fan: 0.12, spread: 0.06 },
    axes: [
      { len: 1, r: 0.04, taper: 0.45, segs: 6, wiggle: 0.04, gravi: 0.8, tex: 'birch', mat: 'bark', stiff: 0.5, kids: { phyllo: 'alt', n: 6, from: 0.35, to: 0.97, profile: 'even', angle: 0.55, depth: 0.4 } },
      { len: 0.42, r: 0.5, segs: 4, wiggle: 0.12, gravi: -0.1, mat: 'bark', kids: { phyllo: 'alt', n: 2, from: 0.4, to: 0.95, angle: 0.5 } },
      { len: 0.5, r: 0.6, segs: 3, gravi: -0.3, mat: 'bark' },
    ],
    organs: [...crown([['last', 0.13], [0, 0.17]]), { type: 'clump', order: 1, at: 'nodes', n: 2, from: 0.4, to: 0.8, size: 0.11 }],
    colors: { leaf: ['spring', 'lime', 'grass'], bark: ['paper'], autumn: ['gold'], bed: ['grass'] },
    stats: { days: 28, regrow: 0, sell: 0, season: 'any' },
  },
  willow: {
    label: 'Willow', realm: 'land', tree: true, deciduous: true, sizes: TREE_SIZES, maxW: 1.35,
    base: { n: [1, 1] },
    axes: [
      { len: 0.7, r: 0.08, taper: 0.55, segs: 5, wiggle: 0.06, gravi: 0.5, mat: 'bark', tex: 'bark', stiff: 0.4, kids: { phyllo: 'alt', n: 5, from: 0.55, to: 0.98, profile: 'vase', angle: 0.85, angleVar: 0.25, depth: 0.4 } },
      { len: 0.6, r: 0.55, taper: 0.45, segs: 4, gravi: 0.35, wiggle: 0.1, mat: 'bark', kids: { phyllo: 'alt', n: 5, from: 0.2, to: 1, angle: 0.4, angleVar: 0.3, depth: 0.35 } },
      { len: 1.5, r: 0.3, w: 0.014, segs: 6, gravi: -1.2, hang: true, style: 'strand', mat: 'leaf', wiggle: 0.03, stiff: 2.2, layer: 2.6 },
    ],
    organs: crown([[1, 0.16, { lumps: 0.2 }], [0, 0.2]]),
    swayK: 1.3,
    colors: { leaf: ['lime', 'spring', 'sage'], bark: ['grey', 'brown'], autumn: ['gold'], bed: ['grass'] },
    stats: { days: 28, regrow: 0, sell: 0, season: 'any' },
  },
  palm: {
    label: 'Palm', realm: 'land', tree: true, sizes: TREE_SIZES, maxW: 1.2,
    base: { n: [1, 1] },
    axes: [
      { len: 1.2, r: 0.045, taper: 0.72, segs: 8, curl: 0.35, gravi: 0.2, mat: 'bark', tex: 'bands', stiff: 0.5, kids: { phyllo: 'spiral', n: 9, from: 0.97, to: 1, angle: 1.1, angleVar: 0.55, depth: 1 } },
      { len: 0.42, r: 0.15, w: 0.07, segs: 6, gravi: -0.9, style: 'frond', mat: 'leaf', stiff: 1.4 },
    ],
    organs: [{ type: 'fruit', kind: 'coconut', order: 0, at: 'tip', size: 0.06, winter: true }],
    colors: { leaf: ['grass', 'forest', 'olive'], bark: ['tan', 'brown'], fruit: ['brown', 'lime'], bed: ['sand'] },
    stats: { days: 28, regrow: 3, sell: 120, season: 'summer' },
  },
  acacia: {
    label: 'Acacia', realm: 'land', tree: true, sizes: TREE_SIZES, maxW: 1.6,
    base: { n: [1, 1] },
    axes: [
      { len: 0.6, r: 0.05, taper: 0.6, segs: 4, wiggle: 0.15, gravi: 0.6, mat: 'bark', tex: 'bark', stiff: 0.4, kids: { phyllo: 'fork', n: 2, angle: 0.55, angleVar: 0.12 } },
      { len: 0.75, r: 0.7, taper: 0.6, segs: 4, wiggle: 0.1, gravi: 0.15, mat: 'bark', kids: { phyllo: 'fork', n: 2, angle: 0.5, angleVar: 0.15 } },
      { len: 0.6, r: 0.7, segs: 3, wiggle: 0.1, gravi: 0.1, mat: 'bark', kids: { phyllo: 'fork', n: 2, angle: 0.45, p: 0.8 } },
      { len: 0.45, r: 0.7, segs: 2, gravi: 0.2, mat: 'bark' },
    ],
    organs: crown([['last', 0.22, { aspect: 0.38, lumps: 0.1 }]]),
    colors: { leaf: ['olive', 'sage', 'grass'], bark: ['darkbrown', 'grey'], bed: ['sand', 'soil'] },
    stats: { days: 28, regrow: 0, sell: 0, season: 'any' },
  },

  // ───────────────────────────── land: others ────────────────────────────────
  fern: {
    label: 'Fern', realm: 'land', sizes: HERB_SIZES, maxW: 1.8,
    base: { n: [6, 9], fan: 0.95, angleVar: 0.15, lenVar: 0.3, depth: true },
    axes: [{ len: 0.9, r: 0.02, w: 0.12, segs: 7, gravi: -0.55, curl: 0.1, style: 'frond', mat: 'leaf' }],
    organs: [],
    colors: { leaf: ['grass', 'forest', 'lime'], bed: ['soil', 'grass'] },
    stats: { days: 10, regrow: 0, sell: 30, season: 'any' },
  },
  saguaro: {
    label: 'Saguaro', realm: 'land', spines: true, sizes: { shrub: 1, tall: 3, tree: 2 }, maxW: 1.2,
    base: { n: [1, 1] },
    axes: [
      { len: 1, r: 0.1, taper: 0.88, segs: 6, gravi: 1, style: 'column', tex: 'ribs', mat: 'leaf', stiff: 0.15, kids: { phyllo: 'alt', n: 2, from: 0.3, to: 0.55, angle: 1.5, angleVar: 0.1, p: 0.9 } },
      { len: 0.42, r: 0.78, taper: 0.88, segs: 6, gravi: 2.2, style: 'column', tex: 'ribs', mat: 'leaf', stiff: 0.2 },
    ],
    organs: [{ type: 'bloom', kind: 'star', order: [0, 1], at: 'tip', p: 0.5, size: 0.05 }],
    swayK: 0.15,
    colors: { leaf: ['cactus', 'sage'], petal: ['white', 'pink'], bed: ['sand'] },
    stats: { days: 20, regrow: 0, sell: 0, season: 'summer' },
  },
  prickly: {
    label: 'Prickly pear', realm: 'land', sizes: { herb: 1, shrub: 3, tall: 1 }, maxW: 1.5,
    base: { n: [1, 2], fan: 0.3, spread: 0.12 },
    axes: [
      { len: 0.4, r: 0.17, taper: 1, segs: 3, gravi: 0.5, style: 'pad', tex: 'spots', mat: 'leaf', stiff: 0.15, kids: { phyllo: 'fork', n: 2, angle: 0.8, angleVar: 0.25 } },
      { len: 0.85, r: 0.95, taper: 1, segs: 3, gravi: 0.3, style: 'pad', tex: 'spots', mat: 'leaf', stiff: 0.15, kids: { phyllo: 'fork', n: 2, angle: 0.75, angleVar: 0.25, p: 0.7 } },
      { len: 0.85, r: 0.95, taper: 1, segs: 3, gravi: 0.4, style: 'pad', tex: 'spots', mat: 'leaf', stiff: 0.2 },
    ],
    organs: [{ type: 'fruit', kind: 'tuna', order: 'last', at: 'tip', p: 0.5, size: 0.05 }],
    swayK: 0.15,
    colors: { leaf: ['cactus', 'bluegreen'], fruit: ['magenta', 'red'], bed: ['sand'] },
    stats: { days: 18, regrow: 5, sell: 60, season: 'summer' },
  },
  succulent: {
    label: 'Succulent', realm: 'land', sizes: { herb: 3, shrub: 2 }, maxW: 1.6,
    base: { n: [9, 13], fan: 0.95, angleVar: 0.1, lenVar: 0.4, depth: true },
    axes: [{ len: 0.05, r: 0.02, segs: 2, mat: 'leaf' }],
    organs: [leafAt('spoon', 0.42, { aspect: 0.55, droop: -0.1 })],
    paint: 'blush',
    swayK: 0.2,
    colors: { leaf: ['sage', 'bluegreen', 'cactus'], tip: ['blush', 'magenta'], bed: ['pot', 'sand'] },
    stats: { days: 12, regrow: 0, sell: 90, season: 'any' },
  },
  mushroom: {
    label: 'Mushroom', realm: 'land', sizes: { herb: 3, shrub: 2 }, maxW: 1.4,
    base: { n: [1, 3], fan: 0.18, spread: 0.3, angleVar: 0.15, lenVar: 0.3 },
    axes: [{ len: 0.45, r: 0.065, taper: 1.05, segs: 3, gravi: 0.8, mat: 'pale', stiff: 0.2 }],
    organs: [{ type: 'cap', kind: 'dome', order: 0, at: 'tip', size: 0.3 }],
    swayK: 0.15,
    colors: { cap: ['red', 'brown', 'cream', 'purple'], bed: ['grass', 'soil'] },
    stats: { days: 4, regrow: 0, sell: 60, season: 'autumn' },
  },
  grass: {
    label: 'Grass', realm: 'land', sizes: HERB_SIZES, maxW: 1.4,
    base: { n: [8, 14], fan: 0.42, spread: 0.15, angleVar: 0.1, lenVar: 0.3 },
    axes: [{ len: 1, r: 0.02, w: 0.02, segs: 5, gravi: -0.2, wiggle: 0.05, style: 'ribbon', wProf: 'blade', mat: 'leaf', stiff: 1.4 }],
    organs: [{ type: 'bloom', kind: 'seedhead', order: 0, at: 'tip', p: 0.15, size: 0.05 }],
    colors: { leaf: ['grass', 'olive', 'sage'], bed: ['grass', 'soil'] },
    stats: { days: 3, regrow: 2, sell: 10, season: 'any' },
  },
  bamboo: {
    label: 'Bamboo', realm: 'land', sizes: { tall: 2, tree: 3, giant: 1 }, maxW: 0.8,
    base: { n: [2, 4], spread: 0.3, fan: 0.06 },
    axes: [
      { len: 1.1, r: 0.028, taper: 0.8, segs: 7, gravi: 1, tex: 'rings', mat: 'cane', stiff: 0.6, kids: { phyllo: 'alt', n: 4, from: 0.5, to: 0.95, angle: 0.7 } },
      { len: 0.18, r: 0.4, segs: 2, mat: 'cane' },
    ],
    organs: [
      { type: 'leaf', kind: 'lance', order: 1, at: 'nodes', n: 3, from: 0.3, to: 1, size: 0.13, angle: 0.6, droop: 0.5 },
      leafAt('lance', 0.12),
    ],
    colors: { leaf: ['grass', 'lime'], bark: ['cane'], bed: ['soil', 'grass'] },
    stats: { days: 14, regrow: 0, sell: 20, season: 'any' },
  },

  // ─────────────────────────────── water ─────────────────────────────────────
  kelp: {
    label: 'Kelp', realm: 'water', medium: 'water', sizes: { tall: 2, tree: 3, giant: 2 }, maxW: 0.9,
    base: { n: [2, 3], fan: 0.14, spread: 0.18, lenVar: 0.25 },
    axes: [{ len: 1.2, r: 0.012, taper: 0.8, segs: 10, gravi: 0.5, wiggle: 0.04, mat: 'stem', stiff: 1.3 }],
    organs: [{ type: 'leaf', kind: 'kelp', order: 0, at: 'nodes', n: 7, from: 0.12, to: 0.98, angle: 0.8, angleVar: 0.25, size: 0.34, droop: -0.3 }],
    colors: { leaf: ['kelp', 'goldkelp', 'olive'], fruit2: ['goldkelp'], bed: ['rock', 'sand'] },
    stats: { days: 12, light: 'high', season: 'cold' },
  },
  vallis: {
    label: 'Ribbon grass', realm: 'water', medium: 'water', sizes: AQUA_SIZES, maxW: 1.1,
    base: { n: [7, 12], fan: 0.32, spread: 0.25, angleVar: 0.08, lenVar: 0.35 },
    axes: [{ len: 1, r: 0.015, w: 0.022, segs: 8, gravi: 0.2, curl: 0.55, wiggle: 0.06, style: 'ribbon', mat: 'leaf', stiff: 1.5 }],
    organs: [],
    colors: { leaf: ['spring', 'grass', 'lime'], bed: ['sand', 'gravel'] },
    stats: { days: 6, light: 'low', season: 'warm' },
  },
  sword: {
    label: 'Sword plant', realm: 'water', medium: 'water', sizes: AQUA_SIZES, maxW: 1.6,
    base: { n: [8, 13], fan: 0.85, angleVar: 0.12, lenVar: 0.35, depth: true },
    axes: [{ len: 0.32, r: 0.012, segs: 3, gravi: 0.25, mat: 'stem' }],
    organs: [leafAt('lance', 0.6, { aspect: 0.24, droop: -0.2 })],
    colors: { leaf: ['grass', 'spring', 'redleaf'], bed: ['gravel', 'sand'] },
    stats: { days: 9, light: 'medium', season: 'warm' },
  },
  stemplant: {
    label: 'Stem plant', realm: 'water', medium: 'water', sizes: AQUA_SIZES, maxW: 0.9, tipFrom: 0.62,
    base: { n: [3, 6], fan: 0.16, spread: 0.18, lenVar: 0.25 },
    axes: [{ len: 1, r: 0.01, segs: 8, gravi: 1, wiggle: 0.03, mat: 'stem', stiff: 1.2 }],
    organs: [{ type: 'leaf', kind: 'oval', order: 0, at: 'nodes', phyllo: 'opp', n: 9, from: 0.06, to: 0.98, shrink: 0.3, size: 0.1, angle: 1.1, droop: -0.4 }],
    colors: { leaf: ['spring', 'lime', 'grass'], tip: ['redleaf', 'orange', 'blush'], bed: ['sand', 'gravel'] },
    stats: { days: 5, light: 'high', season: 'warm' },
  },
  cabomba: {
    label: 'Fanwort', realm: 'water', medium: 'water', sizes: AQUA_SIZES, maxW: 0.9, tipFrom: 0.75,
    base: { n: [3, 5], fan: 0.14, spread: 0.16, lenVar: 0.2 },
    axes: [{ len: 1, r: 0.009, segs: 8, gravi: 1, wiggle: 0.03, mat: 'stem', stiff: 1.3 }],
    organs: [{ type: 'leaf', kind: 'fan', order: 0, at: 'nodes', phyllo: 'opp', n: 10, from: 0.05, to: 0.98, shrink: 0.25, size: 0.1, angle: 1.2, droop: -0.3 }],
    colors: { leaf: ['lime', 'spring'], tip: ['blush', 'redleaf'], bed: ['sand'] },
    stats: { days: 5, light: 'high', season: 'warm' },
  },
  hairgrass: {
    label: 'Hairgrass carpet', realm: 'water', medium: 'water', sizes: { herb: 2, shrub: 3, tall: 1 }, heightK: 0.45, maxW: 2.6,
    base: { n: [14, 22], fan: 0.38, spread: 1.0, angleVar: 0.1, lenVar: 0.45 },
    axes: [{ len: 0.35, r: 0.008, w: 0.008, segs: 3, gravi: 0.4, style: 'ribbon', wProf: 'blade', mat: 'leaf', stiff: 1.6 }],
    organs: [],
    colors: { leaf: ['lime', 'spring', 'grass'], bed: ['sand'] },
    stats: { days: 7, light: 'high', season: 'warm' },
  },
  mossball: {
    label: 'Moss ball', realm: 'water', medium: 'water', sizes: { herb: 3, shrub: 2 }, heightK: 0.6, maxW: 1.4,
    base: { n: [0, 0] },
    axes: [{ len: 0.1, r: 0.01 }],
    organs: [{ type: 'head', kind: 'moss', at: 'base', size: 0.5, birth: 0, dur: 0.8 }],
    swayK: 0,
    colors: { leaf: ['forest', 'deep', 'grass'], bed: ['sand', 'gravel'] },
    stats: { days: 20, light: 'low', season: 'cold' },
  },
  seafan: {
    label: 'Sea fan', realm: 'water', medium: 'water', sizes: { shrub: 2, tall: 3, tree: 1 }, maxW: 1.3,
    base: { n: [1, 1] },
    axes: [
      { len: 0.3, r: 0.05, taper: 0.6, segs: 3, gravi: 1, mat: 'coral', stiff: 0.25, kids: { phyllo: 'fork', n: 2, angle: 0.5, angleVar: 0.12 } },
      { len: 0.85, r: 0.75, taper: 0.6, segs: 3, gravi: 0.5, wiggle: 0.1, mat: 'coral', stiff: 0.3, kids: { phyllo: 'fork', n: 2, angle: 0.45, angleVar: 0.15 } },
      { len: 0.85, r: 0.75, taper: 0.6, segs: 3, gravi: 0.5, wiggle: 0.1, mat: 'coral', stiff: 0.4, kids: { phyllo: 'fork', n: 2, angle: 0.42, angleVar: 0.15 } },
      { len: 0.8, r: 0.75, taper: 0.6, segs: 3, gravi: 0.5, wiggle: 0.12, mat: 'coral', stiff: 0.5, kids: { phyllo: 'fork', n: 2, angle: 0.4, angleVar: 0.15, p: 0.85 } },
      { len: 0.75, r: 0.7, segs: 2, gravi: 0.5, wiggle: 0.12, mat: 'coral', stiff: 0.6 },
    ],
    organs: [{ type: 'polyp', order: [3, 4], at: 'nodes', n: 2, from: 0.3, to: 1, size: 0.014 }],
    swayK: 0.5,
    colors: { coral: ['coral', 'magenta', 'gold', 'purple'], petal: ['cream', 'yellow'], bed: ['rock', 'sand'] },
    stats: { days: 18, light: 'medium', season: 'warm' },
  },
  staghorn: {
    label: 'Branch coral', realm: 'water', medium: 'water', sizes: { shrub: 3, tall: 2 }, maxW: 1.4,
    base: { n: [1, 3], fan: 0.4, spread: 0.1 },
    axes: [
      { len: 0.45, r: 0.055, taper: 0.8, segs: 3, gravi: 0.8, mat: 'coral', stiff: 0.1, kids: { phyllo: 'alt', n: 3, from: 0.25, to: 0.95, angle: 0.75, depth: 0.5 } },
      { len: 0.7, r: 0.8, taper: 0.75, segs: 3, gravi: 0.35, mat: 'coral', stiff: 0.1, kids: { phyllo: 'alt', n: 3, from: 0.35, to: 0.95, angle: 0.65, depth: 0.4 } },
      { len: 0.6, r: 0.8, taper: 0.7, segs: 2, gravi: 0.4, mat: 'coral', stiff: 0.1 },
    ],
    organs: [{ type: 'polyp', order: 'last', at: 'tip', size: 0.03 }],
    swayK: 0.05,
    colors: { coral: ['coral', 'gold', 'purple', 'cyan'], petal: ['cream', 'cyan'], bed: ['sand', 'rock'] },
    stats: { days: 22, light: 'high', season: 'warm' },
  },
  caulerpa: {
    label: 'Sea grapes', realm: 'water', medium: 'water', sizes: { herb: 2, shrub: 3 }, maxW: 2.2, heightK: 0.6,
    base: { n: [1, 1], x0: -0.5 },
    lean: 1.5,
    axes: [
      { len: 1, r: 0.012, segs: 6, ground: true, gravi: 0, mat: 'stem', kids: { phyllo: 'alt', n: 5, from: 0.08, to: 0.95, angle: 0.2, angleVar: 0.2 } },
      { len: 0.32, r: 0.9, segs: 4, gravi: 0.6, up: true, mat: 'stem', wiggle: 0.05 },
    ],
    organs: [{ type: 'bead', order: 1, at: 'nodes', phyllo: 'opp', n: 6, from: 0.15, to: 1, size: 0.045, angle: 0.6 }],
    colors: { leaf: ['lime', 'grass'], bed: ['sand', 'rock'] },
    stats: { days: 6, light: 'medium', season: 'warm' },
  },
  anubias: {
    label: 'Anubias', realm: 'water', medium: 'water', sizes: { herb: 2, shrub: 3 }, maxW: 1.6,
    base: { n: [4, 7], fan: 0.8, angleVar: 0.15, lenVar: 0.3, depth: true },
    axes: [{ len: 0.32, r: 0.015, segs: 3, gravi: 0.4, mat: 'stem' }],
    organs: [
      leafAt('oval', 0.4, { aspect: 0.5, droop: 0.1 }),
      { type: 'bloom', kind: 'spathe', order: 0, at: 'nodes', n: 1, from: 0.6, to: 0.6, p: 0.25, size: 0.05 },
    ],
    colors: { leaf: ['deep', 'forest'], petal: ['white', 'cream'], eye: ['yellow'], bed: ['rock'] },
    stats: { days: 16, light: 'low', season: 'warm' },
  },
  aponogeton: {
    label: 'Lace plant', realm: 'water', medium: 'water', sizes: AQUA_SIZES, maxW: 1.2,
    base: { n: [5, 9], fan: 0.38, angleVar: 0.12, lenVar: 0.35, depth: true },
    axes: [{ len: 0.15, r: 0.012, segs: 2, mat: 'stem' }],
    organs: [leafAt('wavy', 0.95, { droop: -0.5 })],
    colors: { leaf: ['spring', 'olive', 'redleaf'], bed: ['sand', 'gravel'] },
    stats: { days: 8, light: 'medium', season: 'warm' },
  },
  sealettuce: {
    label: 'Sea lettuce', realm: 'water', medium: 'water', sizes: { herb: 2, shrub: 3 }, maxW: 1.6,
    base: { n: [4, 7], fan: 0.9, angleVar: 0.15, lenVar: 0.3, depth: true },
    axes: [{ len: 0.05, r: 0.012, segs: 2, mat: 'leaf' }],
    organs: [leafAt('ruffle', 0.55, { droop: -0.3, aspect: 0.42 })],
    colors: { leaf: ['lime', 'redalgae', 'spring'], bed: ['rock', 'sand'] },
    stats: { days: 4, light: 'high', season: 'cold' },
  },
  glowstalk: {
    label: 'Glowstalk', realm: 'water', medium: 'water', glow: true, sizes: AQUA_SIZES, maxW: 1,
    base: { n: [2, 4], fan: 0.28, spread: 0.1 },
    axes: [{ len: 1, r: 0.016, taper: 0.6, segs: 7, gravi: 0.6, curl: 0.2, mat: 'stem' }],
    organs: [
      { type: 'leaf', kind: 'lance', order: 0, at: 'nodes', n: 4, from: 0.15, to: 0.7, size: 0.12, angle: 0.9, droop: -0.2 },
      { type: 'glow', order: 0, at: 'tip', size: 0.05 },
      { type: 'glow', order: 0, at: 'nodes', n: 3, from: 0.3, to: 0.9, size: 0.022 },
    ],
    colors: { leaf: ['teal', 'deep'], glow: ['cyanglow', 'limeglow', 'pinkglow'], bed: ['rock', 'gravel'] },
    stats: { days: 10, light: 'none', season: 'any' },
  },
};

export const FORM_IDS = Object.keys(FORMS);
export const LAND_FORMS = FORM_IDS.filter((id) => FORMS[id].realm === 'land');
export const WATER_FORMS = FORM_IDS.filter((id) => FORMS[id].realm === 'water');

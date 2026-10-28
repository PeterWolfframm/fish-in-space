// Body archetypes, in v1's format: `[t, height]` keypoints for the back and the belly, with t = 0
// at the tail joint and 1 at the nose, heights in px for a medium (27 px) fish. v1's eight are
// copied as they are (src/gen is frozen, so they are not imported from there). Each archetype
// also names how it swims (`gait`) and what it wears when the genome says `auto`.

/** v1's eight, unchanged, plus their v3 defaults. */
const V1 = {
  torpedo: {
    back: [[0, 1.5], [0.12, 1.5], [0.3, 4.2], [0.55, 5.5], [0.8, 4.6], [0.93, 2.8], [1, 0.8]],
    belly: [[0, 1.5], [0.12, 1.3], [0.3, 3.7], [0.55, 4.4], [0.8, 3.5], [0.93, 2.1], [1, 0.8]],
    length: 1,
    dorsal: { from: 0.4, to: 0.72, peak: 0.3, boost: 1 },
    anal: { from: 0.28, to: 0.5, boost: 0.6 },
    gait: 'carangiform',
  },
  round: {
    back: [[0, 1.5], [0.12, 2], [0.3, 5.8], [0.42, 7], [0.7, 5.6], [0.88, 3.4], [1, 1.2]],
    belly: [[0, 1.5], [0.12, 2], [0.3, 5], [0.55, 6.4], [0.78, 6], [0.92, 3.6], [1, 1.2]],
    length: 0.85,
    dorsal: { from: 0.38, to: 0.68, peak: 0.35, boost: 1 },
    anal: { from: 0.3, to: 0.5, boost: 0.7 },
    gait: 'subcarangiform',
  },
  disc: {
    back: [[0, 1.5], [0.1, 2.4], [0.3, 5.4], [0.5, 6.2], [0.75, 5.2], [0.9, 3], [1, 1]],
    belly: [[0, 1.5], [0.1, 2.4], [0.3, 5.4], [0.5, 6], [0.75, 5], [0.9, 3], [1, 1]],
    length: 0.6,
    dorsal: { from: 0.28, to: 0.78, peak: 0.42, boost: 1.7 },
    anal: { from: 0.28, to: 0.72, boost: 1.6 },
    gait: 'labriform',
    triangle: true,
    pelvic: 'long',
  },
  eel: {
    back: [[0, 0.4], [0.07, 1.1], [0.2, 2], [0.5, 2.6], [0.8, 3], [0.92, 3], [1, 1.2]],
    belly: [[0, 0.4], [0.07, 1.1], [0.2, 1.9], [0.5, 2.4], [0.8, 2.6], [0.92, 2.6], [1, 1.2]],
    length: 1.25,
    dorsal: { from: 0.15, to: 0.95, peak: 0.5, boost: 0.5 },
    anal: { from: 0.12, to: 0.6, boost: 0.5 },
    tail: 'none',
    gait: 'anguilliform',
    pelvic: 'none',
  },
  arrow: {
    back: [[0, 1.5], [0.12, 1.6], [0.35, 3.6], [0.6, 3.9], [0.78, 3.8], [0.9, 2.6], [1, 0.8]],
    belly: [[0, 1.5], [0.12, 1.6], [0.35, 3.6], [0.6, 4.6], [0.78, 3.6], [0.9, 2.4], [1, 0.8]],
    length: 1.1,
    dorsal: { from: 0.12, to: 0.36, peak: 0.5, boost: 0.9 },
    anal: { from: 0.12, to: 0.32, boost: 0.7 },
    gait: 'carangiform',
    jaw: 'gape',
  },
  pufferish: {
    back: [[0, 1.5], [0.1, 1.6], [0.3, 5.5], [0.5, 7], [0.75, 6.4], [0.9, 4], [1, 1.8]],
    belly: [[0, 1.5], [0.1, 1.6], [0.3, 5.5], [0.5, 7], [0.75, 6.4], [0.9, 4.2], [1, 1.8]],
    length: 0.7,
    dorsal: { from: 0.18, to: 0.4, peak: 0.5, boost: 0.5 },
    anal: { from: 0.18, to: 0.38, boost: 0.5 },
    tail: 'tiny',
    gait: 'ostraciiform',
    jaw: 'beak',
    pelvic: 'none',
  },
  shark: {
    back: [[0, 1.5], [0.12, 1.5], [0.35, 4.4], [0.55, 5], [0.8, 4.2], [0.93, 2.4], [1, 0.6]],
    belly: [[0, 1.5], [0.12, 1.3], [0.35, 3.6], [0.55, 4], [0.8, 3], [0.93, 2], [1, 1]],
    length: 1.05,
    dorsal: { from: 0.42, to: 0.66, peak: 0.6, boost: 1.4 },
    anal: { from: 0.2, to: 0.34, boost: 0.5 },
    tail: 'crescent',
    gillSlits: true,
    triangle: true,
    gait: 'thunniform',
    jaw: 'underbite',
  },
  hatchet: {
    back: [[0, 1.5], [0.1, 1.6], [0.3, 2.4], [0.5, 2.6], [0.8, 2.6], [0.92, 2.2], [1, 1]],
    belly: [[0, 1.5], [0.1, 2], [0.25, 6.4], [0.45, 8], [0.65, 7], [0.85, 4], [1, 1]],
    length: 0.75,
    dorsal: { from: 0.3, to: 0.55, peak: 0.5, boost: 0.7 },
    gait: 'subcarangiform',
    pelvic: 'small',
  },
};

/** The new bodies. `prefer` are trait values a fresh roll leans toward (most of the time). */
const NEW = {
  piranha: {
    back: [[0, 1.6], [0.12, 2], [0.3, 5.2], [0.5, 6.4], [0.72, 6], [0.88, 4.4], [1, 2.2]],
    belly: [[0, 1.6], [0.12, 2.2], [0.3, 5.6], [0.55, 6.8], [0.8, 5.6], [0.92, 3.8], [1, 2.6]],
    length: 0.8,
    dorsal: { from: 0.4, to: 0.62, peak: 0.45, boost: 0.9 },
    anal: { from: 0.12, to: 0.42, boost: 0.8 },
    gait: 'subcarangiform',
    jaw: 'piranha',
    prefer: { mood: 'grumpy', dorsal: 'adipose', tail: 'truncate', belly: 'pale', skin: 'slate' },
  },
  boxfish: {
    back: [[0, 1.2], [0.1, 1.4], [0.2, 5], [0.35, 5.6], [0.75, 5.6], [0.9, 4.6], [1, 2.6]],
    belly: [[0, 1.2], [0.1, 1.4], [0.2, 5], [0.35, 5.4], [0.75, 5.4], [0.9, 4.4], [1, 2.4]],
    length: 0.72,
    dorsal: { from: 0.12, to: 0.24, peak: 0.5, boost: 0.6 },
    anal: { from: 0.12, to: 0.22, boost: 0.6 },
    gait: 'ostraciiform',
    jaw: 'lips',
    pelvic: 'none',
    boxy: true,
    prefer: { scales: 'plates', pattern: 'spots', skin: 'butter', markColor: 'soot', tail: 'paddle' },
  },
  cowfish: {
    back: [[0, 1.2], [0.1, 1.4], [0.2, 4.6], [0.4, 5.4], [0.7, 5.6], [0.88, 5], [1, 2.4]],
    belly: [[0, 1.2], [0.1, 1.4], [0.2, 4.6], [0.4, 5.6], [0.7, 5.6], [0.9, 4.2], [1, 2]],
    length: 0.8,
    dorsal: { from: 0.1, to: 0.22, peak: 0.5, boost: 0.6 },
    anal: { from: 0.1, to: 0.2, boost: 0.6 },
    gait: 'ostraciiform',
    jaw: 'lips',
    extras: 'horns',
    pelvic: 'none',
    boxy: true,
    prefer: { scales: 'plates', pattern: 'spots', tail: 'paddle' },
  },
  trigger: {
    back: [[0, 1.4], [0.12, 1.8], [0.3, 4.6], [0.55, 7], [0.75, 6.2], [0.9, 3.6], [1, 1.4]],
    belly: [[0, 1.4], [0.12, 1.8], [0.3, 4.4], [0.5, 6.4], [0.72, 5.2], [0.9, 3], [1, 1.2]],
    length: 0.8,
    dorsal: { from: 0.12, to: 0.5, peak: 0.4, boost: 1.2 },
    anal: { from: 0.12, to: 0.46, boost: 1.2 },
    gait: 'balistiform',
    jaw: 'beak',
    anal3: 'mirror',
    pelvic: 'spine',
    prefer: { dorsal: 'double', tail: 'lunate', markings: 'mask', pattern: 'chevron' },
  },
  mola: {
    back: [[0, 4], [0.08, 5], [0.3, 7.2], [0.6, 7.4], [0.85, 5.6], [0.95, 3.6], [1, 2]],
    belly: [[0, 4], [0.08, 5], [0.3, 7], [0.6, 7.2], [0.85, 5.4], [0.95, 3.4], [1, 1.8]],
    length: 0.62,
    dorsal: { from: 0.04, to: 0.2, peak: 0.55, boost: 2.4 },
    anal: { from: 0.04, to: 0.2, boost: 2.4 },
    tail: 'clavus',
    gait: 'balistiform',
    jaw: 'beak',
    pelvic: 'none',
    triangle: true,
    prefer: { skin: 'pewter', belly: 'white', scales: 'sandpaper', pectoral: 'small' },
  },
  lionfish: {
    back: [[0, 1.4], [0.12, 1.6], [0.35, 4], [0.6, 5], [0.82, 4.8], [0.94, 3.2], [1, 1.6]],
    belly: [[0, 1.4], [0.12, 1.4], [0.35, 3.4], [0.6, 4.2], [0.82, 3.8], [0.94, 2.6], [1, 1.4]],
    length: 0.95,
    dorsal: { from: 0.15, to: 0.85, peak: 0.6, boost: 1.4 },
    anal: { from: 0.15, to: 0.35, boost: 1 },
    gait: 'labriform',
    pelvic: 'long',
    dimorphic: true,
    prefer: { dorsal: 'venom', pectoral: 'fan', pattern: 'bars', markColor: 'chalk', skin: 'ember', tail: 'round', finPattern: 'banded' },
  },
  betta: {
    back: [[0, 1.6], [0.12, 1.8], [0.35, 3.6], [0.6, 4.2], [0.82, 3.8], [0.94, 2.6], [1, 1.4]],
    belly: [[0, 1.6], [0.12, 1.8], [0.35, 3.8], [0.6, 4.4], [0.82, 3.6], [0.94, 2.4], [1, 1.2]],
    length: 0.9,
    dorsal: { from: 0.12, to: 0.5, peak: 0.5, boost: 1.6 },
    anal: { from: 0.06, to: 0.62, boost: 2 },
    gait: 'subcarangiform',
    jaw: 'grin',
    anal3: 'sail',
    pelvic: 'long',
    dimorphic: true,
    prefer: { tail: 'veil', dorsal: 'crest', finTint: 'accent', pectoral: 'round' },
  },
  koi: {
    back: [[0, 1.6], [0.12, 1.8], [0.3, 4.6], [0.5, 5.6], [0.75, 5], [0.9, 3.4], [1, 1.8]],
    belly: [[0, 1.6], [0.12, 1.8], [0.3, 4.2], [0.55, 5.2], [0.8, 4.6], [0.92, 3], [1, 1.6]],
    length: 1.05,
    dorsal: { from: 0.25, to: 0.75, peak: 0.4, boost: 0.8 },
    anal: { from: 0.15, to: 0.3, boost: 0.7 },
    gait: 'subcarangiform',
    jaw: 'lips',
    extras: 'barbels',
    prefer: { pattern: 'patches', skin: 'pearl', markColor: 'ember', scales: 'scallops' },
  },
  catfish: {
    back: [[0, 1.4], [0.12, 1.6], [0.4, 3.6], [0.7, 4.4], [0.88, 3.6], [0.97, 2.6], [1, 2.2]],
    belly: [[0, 1.4], [0.12, 1.6], [0.4, 3.4], [0.7, 4], [0.88, 3.6], [0.97, 2.8], [1, 2.4]],
    length: 1.1,
    dorsal: { from: 0.6, to: 0.72, peak: 0.4, boost: 1.2 },
    anal: { from: 0.06, to: 0.45, boost: 0.8 },
    gait: 'subcarangiform',
    jaw: 'gape',
    extras: 'barbels',
    flatHead: true,
    prefer: { dorsal: 'adipose', scales: 'smooth', skin: 'bronze', pattern: 'mottle', tail: 'fork' },
  },
  angler: {
    back: [[0, 1.4], [0.12, 1.8], [0.35, 4.4], [0.6, 6.4], [0.8, 6.8], [0.94, 5.6], [1, 4]],
    belly: [[0, 1.4], [0.12, 1.8], [0.35, 4.6], [0.6, 6.4], [0.85, 6.6], [0.96, 5.4], [1, 4.4]],
    length: 0.8,
    dorsal: { from: 0.2, to: 0.4, peak: 0.5, boost: 0.8 },
    anal: { from: 0.15, to: 0.32, boost: 0.7 },
    gait: 'subcarangiform',
    jaw: 'fangs',
    extras: 'lure',
    pelvic: 'none',
    prefer: { skin: 'ink', eye: 'small', mood: 'grumpy', scales: 'smooth', tail: 'round' },
  },
  barracuda: {
    back: [[0, 1.4], [0.1, 1.4], [0.35, 3.2], [0.6, 3.6], [0.85, 3.2], [0.95, 2], [1, 0.6]],
    belly: [[0, 1.4], [0.1, 1.3], [0.35, 3], [0.6, 3.4], [0.85, 3], [0.95, 2.2], [1, 1.2]],
    length: 1.35,
    dorsal: { from: 0.15, to: 0.3, peak: 0.5, boost: 1 },
    anal: { from: 0.12, to: 0.25, boost: 0.8 },
    gait: 'carangiform',
    jaw: 'fangs',
    prefer: { dorsal: 'double', tail: 'fork', skin: 'pewter', pattern: 'bars', markColor: 'soot', density: 'sparse' },
  },
  needle: {
    back: [[0, 1.2], [0.08, 1.2], [0.3, 2.2], [0.6, 2.6], [0.8, 2.4], [0.9, 1.4], [1, 0.5]],
    belly: [[0, 1.2], [0.08, 1.2], [0.3, 2.2], [0.6, 2.6], [0.8, 2.2], [0.9, 1.2], [1, 0.5]],
    length: 1.45,
    dorsal: { from: 0.08, to: 0.2, peak: 0.5, boost: 0.9 },
    anal: { from: 0.08, to: 0.2, boost: 0.9 },
    gait: 'subcarangiform',
    jaw: 'bill',
    prefer: { skin: 'lagoon', belly: 'white', tail: 'fork', pattern: 'stripe' },
  },
  swordfish: {
    back: [[0, 1.4], [0.1, 1.3], [0.3, 4], [0.55, 5.2], [0.8, 4.6], [0.93, 2.6], [1, 1]],
    belly: [[0, 1.4], [0.1, 1.2], [0.3, 3.4], [0.55, 4.2], [0.8, 3.4], [0.93, 2], [1, 0.8]],
    length: 1.1,
    dorsal: { from: 0.6, to: 0.76, peak: 0.25, boost: 1.7 },
    anal: { from: 0.18, to: 0.28, boost: 0.8 },
    tail: 'crescent',
    triangle: true,
    gait: 'thunniform',
    jaw: 'bill',
    prefer: { skin: 'cobalt', belly: 'white', pattern: 'plain' },
  },
  discus: {
    back: [[0, 1.6], [0.08, 2.6], [0.25, 6], [0.5, 7.2], [0.75, 6.4], [0.9, 4], [1, 1.6]],
    belly: [[0, 1.6], [0.08, 2.6], [0.25, 6], [0.5, 7.2], [0.75, 6.4], [0.9, 4], [1, 1.6]],
    length: 0.62,
    dorsal: { from: 0.08, to: 0.82, peak: 0.5, boost: 0.8 },
    anal: { from: 0.08, to: 0.7, boost: 0.8 },
    gait: 'labriform',
    jaw: 'lips',
    pelvic: 'long',
    prefer: { pattern: 'reticulate', tail: 'fan', skin: 'tangerine', markColor: 'lagoon' },
  },
  butterfly: {
    back: [[0, 1.6], [0.1, 3], [0.3, 6], [0.5, 6.6], [0.75, 5.4], [0.9, 3], [1, 1]],
    belly: [[0, 1.6], [0.1, 3], [0.3, 5.6], [0.5, 6], [0.75, 5], [0.9, 2.8], [1, 1]],
    length: 0.65,
    dorsal: { from: 0.1, to: 0.78, peak: 0.45, boost: 1 },
    anal: { from: 0.1, to: 0.5, boost: 1 },
    gait: 'labriform',
    jaw: 'tube',
    pelvic: 'small',
    prefer: { markings: 'mask', skin: 'butter', pattern: 'chevron', markColor: 'soot', tail: 'truncate' },
  },
  clown: {
    back: [[0, 1.6], [0.12, 2], [0.3, 4.4], [0.55, 5.2], [0.8, 4.6], [0.92, 3], [1, 1.6]],
    belly: [[0, 1.6], [0.12, 2], [0.3, 4.2], [0.55, 4.8], [0.8, 4.2], [0.92, 2.8], [1, 1.4]],
    length: 0.8,
    dorsal: { from: 0.18, to: 0.75, peak: 0.6, boost: 0.9 },
    anal: { from: 0.15, to: 0.35, boost: 0.9 },
    gait: 'labriform',
    jaw: 'grin',
    prefer: { pattern: 'bars', markColor: 'chalk', skin: 'tangerine', tail: 'round', dorsal: 'double', finPattern: 'tipped', density: 'sparse' },
  },
  tetra: {
    back: [[0, 1.4], [0.12, 1.6], [0.35, 4], [0.6, 4.6], [0.82, 4], [0.94, 2.6], [1, 1.2]],
    belly: [[0, 1.4], [0.12, 1.6], [0.35, 4.2], [0.6, 4.8], [0.82, 3.8], [0.94, 2.4], [1, 1.2]],
    length: 0.85,
    dorsal: { from: 0.48, to: 0.62, peak: 0.4, boost: 1.2 },
    anal: { from: 0.1, to: 0.4, boost: 0.8 },
    gait: 'carangiform',
    prefer: { dorsal: 'adipose', tail: 'fork', pattern: 'stripe', markColor: 'lagoon', skin: 'coral' },
  },
  guppy: {
    back: [[0, 1.6], [0.12, 1.8], [0.35, 3.4], [0.6, 4], [0.82, 3.6], [0.94, 2.4], [1, 1.2]],
    belly: [[0, 1.6], [0.12, 2], [0.35, 4], [0.6, 4.6], [0.82, 3.8], [0.94, 2.4], [1, 1.2]],
    length: 0.8,
    dorsal: { from: 0.3, to: 0.5, peak: 0.4, boost: 1.1 },
    anal: { from: 0.25, to: 0.4, boost: 0.6 },
    gait: 'subcarangiform',
    dimorphic: true,
    prefer: { tail: 'veil', finPattern: 'spotted', finTint: 'accent' },
  },
  oarfish: {
    back: [[0, 0.4], [0.06, 1], [0.2, 1.8], [0.6, 2.2], [0.88, 2.4], [0.96, 2], [1, 1]],
    belly: [[0, 0.4], [0.06, 1], [0.2, 1.8], [0.6, 2.2], [0.88, 2.2], [0.96, 1.8], [1, 1]],
    length: 1.6,
    dorsal: { from: 0.02, to: 0.98, peak: 0.5, boost: 0.7 },
    tail: 'none',
    gait: 'anguilliform',
    pelvic: 'feelers',
    prefer: { skin: 'pearl', finTint: 'accent', markColor: 'ember', forehead: 'crested', pattern: 'spots', density: 'sparse' },
  },
  sturgeon: {
    back: [[0, 1.2], [0.12, 1.4], [0.35, 3.8], [0.6, 4.2], [0.85, 3.4], [0.95, 2], [1, 0.6]],
    belly: [[0, 1.2], [0.12, 1.2], [0.35, 3], [0.6, 3.4], [0.85, 2.6], [0.95, 1.8], [1, 1]],
    length: 1.2,
    dorsal: { from: 0.15, to: 0.25, peak: 0.5, boost: 0.9 },
    anal: { from: 0.12, to: 0.22, boost: 0.7 },
    gait: 'subcarangiform',
    jaw: 'underbite',
    extras: 'scutes',
    prefer: { tail: 'hetero', skin: 'slate', scales: 'smooth', pattern: 'plain' },
  },
  coelacanth: {
    back: [[0, 1.6], [0.1, 2], [0.3, 4.6], [0.55, 5.4], [0.8, 5], [0.93, 3.6], [1, 2]],
    belly: [[0, 1.6], [0.1, 2], [0.3, 4.4], [0.55, 5], [0.8, 4.6], [0.93, 3.4], [1, 2]],
    length: 1,
    dorsal: { from: 0.18, to: 0.3, peak: 0.5, boost: 1 },
    anal: { from: 0.18, to: 0.28, boost: 1 },
    gait: 'subcarangiform',
    pelvic: 'long',
    prefer: { tail: 'lobed', pectoral: 'lobed', dorsal: 'double', scales: 'scallops', skin: 'cobalt', pattern: 'spots', markColor: 'chalk', density: 'sparse' },
  },
  blobfish: {
    back: [[0, 1], [0.12, 1.4], [0.3, 3.6], [0.55, 5.6], [0.8, 6.4], [0.93, 5.6], [1, 4]],
    belly: [[0, 1], [0.12, 1.4], [0.3, 3.2], [0.55, 4.6], [0.8, 5.6], [0.93, 5.2], [1, 4.4]],
    length: 0.75,
    dorsal: { from: 0.3, to: 0.45, peak: 0.5, boost: 0.4 },
    anal: { from: 0.2, to: 0.3, boost: 0.4 },
    gait: 'ostraciiform',
    jaw: 'plain',
    pelvic: 'none',
    droopy: true,
    prefer: { skin: 'rose', mood: 'grumpy', eye: 'small', scales: 'smooth', pattern: 'plain', tail: 'round', dorsal: 'none' },
  },
  flyingfish: {
    back: [[0, 1.4], [0.12, 1.4], [0.35, 3.4], [0.6, 3.8], [0.85, 3.2], [0.95, 2], [1, 1]],
    belly: [[0, 1.4], [0.12, 1.4], [0.35, 3.4], [0.6, 3.8], [0.85, 3], [0.95, 2], [1, 1]],
    length: 1,
    dorsal: { from: 0.12, to: 0.25, peak: 0.5, boost: 0.9 },
    anal: { from: 0.12, to: 0.25, boost: 0.9 },
    gait: 'carangiform',
    pelvic: 'long',
    prefer: { pectoral: 'glider', tail: 'fork', skin: 'cobalt', belly: 'white', finTint: 'clear' },
  },
  knifefish: {
    back: [[0, 0.5], [0.1, 1], [0.35, 3.4], [0.65, 4.4], [0.85, 4.2], [0.95, 3], [1, 1.4]],
    belly: [[0, 0.5], [0.1, 1], [0.35, 3.6], [0.65, 4.4], [0.85, 3.8], [0.95, 2.6], [1, 1.4]],
    length: 1.1,
    dorsal: { from: 0.4, to: 0.5, peak: 0.5, boost: 0.3 },
    anal: { from: 0.04, to: 0.86, boost: 0.8 },
    tail: 'pin',
    gait: 'amiiform',
    anal3: 'ribbon',
    noDorsal: true,
    pelvic: 'none',
    prefer: { skin: 'ink', pattern: 'plain', markings: 'none', finTint: 'clear' },
  },
};

export const BODIES = { ...V1, ...NEW };

/**
 * Hybrids: two parent bodies → a body neither has. The shape is the parents' profiles blended
 * (`mix` toward b), then `with` overrides. `sterile` hybrids are mules: they cannot pass on genes.
 */
export const HYBRIDS = {
  chompball: { a: 'piranha', b: 'pufferish', mix: 0.55, with: { jaw: 'piranha', gait: 'ostraciiform' } },
  noodleshark: { a: 'shark', b: 'eel', mix: 0.6, with: { tail: 'crescent', gillSlits: true, gait: 'anguilliform', jaw: 'underbite' } },
  kitefish: { a: 'disc', b: 'trigger', mix: 0.5, with: { gait: 'balistiform', anal3: 'mirror' } },
  whiskerkoi: { a: 'koi', b: 'catfish', mix: 0.45, with: { extras: 'barbels', jaw: 'gape' } },
  moonblob: { a: 'mola', b: 'blobfish', mix: 0.5, with: { tail: 'clavus', droopy: true }, sterile: true },
  lancefish: { a: 'swordfish', b: 'needle', mix: 0.5, with: { jaw: 'bill', tail: 'crescent', gait: 'thunniform' } },
  pincushion: { a: 'lionfish', b: 'pufferish', mix: 0.6, with: { extras: 'cheekspines', gait: 'ostraciiform', spiny: true }, sterile: true },
  silkkoi: { a: 'betta', b: 'koi', mix: 0.55, with: { anal3: 'sail', dimorphic: true } },
  lanternbite: { a: 'angler', b: 'tetra', mix: 0.55, with: { extras: 'lure', jaw: 'fangs' } },
  jesterbox: { a: 'clown', b: 'boxfish', mix: 0.5, with: { boxy: true, gait: 'ostraciiform', jaw: 'grin' } },
  sawdisc: { a: 'discus', b: 'piranha', mix: 0.5, with: { jaw: 'piranha', gait: 'labriform' } },
  dragonling: { a: 'sturgeon', b: 'eel', mix: 0.55, with: { extras: 'scutes', gait: 'anguilliform', tail: 'none' }, sterile: true },
  gliderhatch: { a: 'hatchet', b: 'flyingfish', mix: 0.5, with: { gait: 'carangiform' } },
  neonfan: { a: 'guppy', b: 'tetra', mix: 0.5, with: { dimorphic: true } },
  plumpike: { a: 'round', b: 'arrow', mix: 0.5, with: { jaw: 'gape' }, sterile: true },
  fossilcat: { a: 'coelacanth', b: 'catfish', mix: 0.5, with: { extras: 'barbels' } },
};

/** The hybrid two bodies can make, if any (order does not matter). */
export function hybridOf(bodyA, bodyB) {
  for (const [id, h] of Object.entries(HYBRIDS)) {
    if ((h.a === bodyA && h.b === bodyB) || (h.a === bodyB && h.b === bodyA)) return id;
  }
  return null;
}

/** Profiles sampled on a common grid, so two archetypes can be blended keypoint by keypoint. */
const GRID = [0, 0.06, 0.12, 0.2, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9, 0.96, 1];

/** Height of a profile at t, easing between its keypoints without overshoot (v1's profileAt). */
export function profileAt(keys, t) {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, h1] = keys[i];
    if (t > t1) continue;
    const [t0, h0] = keys[i - 1];
    const u = (t - t0) / Math.max(1e-6, t1 - t0);
    const s = (1 - Math.cos(Math.PI * u)) / 2;
    return h0 + (h1 - h0) * s;
  }
  return last[1];
}

const lerp = (a, b, k) => a + (b - a) * k;
const blendRange = (x, y, k) => (x && y ? { from: lerp(x.from, y.from, k), to: lerp(x.to, y.to, k), peak: lerp(x.peak ?? 0.5, y.peak ?? 0.5, k), boost: lerp(x.boost, y.boost, k) } : x ?? y);

/** The archetype a body (or a hybrid) draws with. */
export function archetypeOf(body, hybrid = 'none') {
  const h = HYBRIDS[hybrid];
  if (!h) return BODIES[body] ?? BODIES.torpedo;
  const A = BODIES[h.a];
  const B = BODIES[h.b];
  const k = h.mix;
  const blend = (side) => GRID.map((t) => [t, lerp(profileAt(A[side], t), profileAt(B[side], t), k)]);
  return {
    ...A,
    ...B,
    prefer: null,
    back: blend('back'),
    belly: blend('belly'),
    length: lerp(A.length, B.length, k),
    dorsal: blendRange(A.dorsal, B.dorsal, k),
    anal: blendRange(A.anal, B.anal, k),
    tail: undefined,
    ...h.with,
    hybrid,
    sterile: Boolean(h.sterile),
  };
}

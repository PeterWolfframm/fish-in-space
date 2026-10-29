// Trait linkage: looks that go together. Plain JSON in a module (the studio can edit it).
//
// LINKS: { id, when, mul: { field: { choice: × } } }. After a fish's first roll, every link whose
// `when` holds (a rules.js condition over its fields: terrain, region and niche are fields too)
// re-rolls the fields in `mul` with those odds multiplied in. Fields a fish kept from its species
// are not re-rolled (the species was linked already). `params.links.strength` raises every × to a
// power (0 = off); `params.links.off` lists ids to skip.
//
// KITS: fields that travel together in breeding. Each kit comes whole from one parent, with
// chance `params.links.kitChance`; otherwise fish3's breeding decides them field by field.

export const LINKS = [
  // Weapons and how a fish swims.
  { id: 'fangs-fast', when: { field: 'jaw', in: ['fangs', 'piranha'] }, mul: { tail: { lunate: 1.8, fork: 1.4, veil: 0.4, round: 0.6 }, eye: { big: 1.3 } } },
  { id: 'gape-ambush', when: { field: 'jaw', is: 'gape' }, mul: { tail: { round: 1.6, truncate: 1.4, lunate: 0.6 }, pattern: { mottle: 1.6, reticulate: 1.3 } } },
  { id: 'venom-warning', when: { field: 'dorsal', is: 'venom' }, mul: { pattern: { bars: 1.8, tiger: 1.5, plain: 0.5 }, finPattern: { banded: 1.8 } } },
  { id: 'lure-dark', when: { field: 'extras', is: 'lure' }, mul: { glow: { spots: 1.8, edge: 1.4 }, markings: { photophores: 2 }, eye: { small: 1.4 } } },
  { id: 'scutes-plates', when: { field: 'extras', is: 'scutes' }, mul: { scales: { plates: 2.5, sandpaper: 1.4 } } },
  // Fins.
  { id: 'veil-slow', when: { field: 'tail', in: ['veil', 'streamer', 'lyre'] }, mul: { dorsal: { sail: 1.6, streamer: 1.6, tall: 1.3 }, pectoral: { frilly: 1.8, long: 1.3 } } },
  { id: 'thunniform', when: { field: 'tail', is: 'lunate' }, mul: { dorsal: { finlets: 2, low: 1.3, sail: 0.6 }, chonk: { lean: 1.4, fit: 1.3, round: 0.5 } } },
  // Body and colour.
  { id: 'round-cute', when: { field: 'chonk', is: 'round' }, mul: { eye: { big: 1.5 }, eyeStyle: { sparkle: 1.4 }, blush: { yes: 1.5 } } },
  { id: 'deep-pale', when: { field: 'region', in: ['deep', 'icemoon'] }, mul: { eye: { big: 1.4 }, belly: { pale: 1.4 }, glow: { spots: 1.5 } } },
  // Terrains. (glow only rolls on rare fish, as in v1: these push it when it can.)
  { id: 'sand-flat', when: { field: 'terrain', is: 'sand' }, mul: { dorsal: { low: 2, none: 1.6, sail: 0.3, tall: 0.5 }, eye: { small: 1.4 }, pattern: { mottle: 1.5, saddle: 1.3 } } },
  { id: 'lava-armour', when: { field: 'terrain', is: 'lava' }, mul: { scales: { plates: 2, sandpaper: 1.6, smooth: 0.5 }, glow: { edge: 1.6, spots: 1.3 } } },
  { id: 'nuclear-glow', when: { field: 'terrain', is: 'nuclear' }, mul: { glow: { spots: 1.6, edge: 1.8, full: 1.6 }, eye: { big: 1.3 } } },
];

export const KITS = [
  { id: 'weapons', fields: ['jaw', 'extras', 'pelvic'] },
  { id: 'fins', fields: ['dorsal', 'tail', 'pectoral', 'anal', 'finPattern'] },
  { id: 'face', fields: ['eye', 'eyeStyle', 'eyeMount', 'eyeColor', 'eyeColor2'] },
];

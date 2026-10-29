// fish4's "fun" layer: nicknames a keeper might give a fish, picked by what the fish is like.
// Plain JSON in a module (the studio edits it). Each entry:
//   { id, when, humour, priority?, names: [...] }
// `when` is a rules.js condition (stats, loci, facts, fields, features, tier, size); `humour` is
// how silly the names are, 0..1: params.text.humour hides entries sillier than it. The most
// specific matching entry wins (higher `priority` first); the entry and word are picked by the
// fish's own key.
// Tone: hopeful, warm, a bit cheeky (Seedfall), never mean.

export default [
  { id: 'cosmonaut', humour: 0.3, priority: 2, when: { feature: 'helmet', not: 'none' }, names: ['Major Tom', 'Commander Fin', 'Captain Bubbles', 'Sputnik', 'Laika', 'Ensign Gills'] },
  { id: 'antenna', humour: 0.6, priority: 2, when: { feature: 'helmet', is: 'antenna' }, names: ['Beacon', 'Ping', 'Signal', 'Blinky'] },
  { id: 'visor-smug', humour: 0.7, priority: 2, when: { all: [{ feature: 'helmet', is: 'visor' }, { field: 'mood', is: 'smug' }] }, names: ['Goldie', 'The Admiral', 'Flyboy'] },
  { id: 'mythic', humour: 0.2, priority: 3, when: { tier: 'myth' }, names: ['Starborn', 'Halo', 'Seedfall', 'Wish'] },
  { id: 'legendary', humour: 0.2, priority: 3, when: { tier: 'legendary' }, names: ['Comet', 'Aurora', 'Nova'] },
  { id: 'hothead', humour: 0.5, when: { all: [{ stat: 'aggression', gte: 0.7 }, { stat: 'boldness', gte: 0.6 }] }, names: ['Sparky', 'Little Thunder', 'Pepper', 'Firecracker'] },
  { id: 'gentle', humour: 0.4, when: { all: [{ stat: 'aggression', lte: 0.15 }, { stat: 'sociability', gte: 0.6 }] }, names: ['Buttercup', 'Pal', 'Honey', 'Dumpling'] },
  { id: 'pacifist', humour: 0.5, when: { all: [{ fact: 'diet', is: 'piscivore' }, { stat: 'predatoryDrive', lte: 0.45 }] }, names: ['Herbert', 'Mr Nice Fins', 'Tofu'] },
  { id: 'zippy', humour: 0.4, when: { all: [{ stat: 'energy', gte: 0.7 }, { stat: 'swimSpeed', gte: 0.55 }] }, names: ['Zoom', 'Dash', 'Rocket', 'Whizz'] },
  { id: 'sleepy', humour: 0.4, when: { stat: 'energy', lte: 0.22 }, names: ['Snooze', 'Drift', 'Pillow', 'Sir Naps-a-lot'] },
  { id: 'night', humour: 0.3, when: { stat: 'circadian', gte: 0.8 }, names: ['Moth', 'Midnight', 'Owl', 'Lantern'] },
  { id: 'nosy', humour: 0.5, when: { stat: 'curiosity', gte: 0.62 }, names: ['Nosy', 'Inspector', 'Peeper', 'Snoop'] },
  { id: 'shy', humour: 0.3, when: { stat: 'boldness', lte: 0.25 }, names: ['Whisper', 'Blush', 'Mouse', 'Shadow'] },
  { id: 'greedy', humour: 0.5, when: { stat: 'appetite', gte: 0.64 }, names: ['Gobbles', 'Muncher', 'Biscuit', 'Hoover'] },
  { id: 'old', humour: 0.3, when: { stat: 'lifespan', gte: 0.45 }, names: ['Grandpa', 'Old Tom', 'Methuselah', 'Granny'] },
  { id: 'giant', humour: 0.4, when: { size: '>=huge' }, names: ['Tiny', 'Moose', 'Big Lou', 'Hoss'] },
  { id: 'tiny', humour: 0.4, when: { size: 'tiny' }, names: ['Pip', 'Peanut', 'Button', 'Speck'] },
  { id: 'round', humour: 0.6, when: { field: 'chonk', is: 'round' }, names: ['Meatball', 'Pudding', 'Bun', 'Chonkers'] },
  { id: 'derpy', humour: 0.8, when: { field: 'mood', is: 'derpy' }, names: ['Goofus', 'Bloop', 'Wobble', 'Dingus'] },
  { id: 'grumpy', humour: 0.6, when: { field: 'mood', is: 'grumpy' }, names: ['Grumbles', 'Crabby', 'Sir Sulks'] },
  { id: 'schooler', humour: 0.2, when: { stat: 'schooling', gte: 0.75 }, names: ['Crowd', 'Chorus', 'Flock'] },
  { id: 'any', humour: 0, when: true, names: ['Finn', 'Nemo', 'Bubbles', 'Scout', 'Juno', 'Kip', 'Sunny', 'Marlo', 'Pebble', 'Ziggy'] },
];

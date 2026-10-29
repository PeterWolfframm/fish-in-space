// fish4's default stat rules: diet, size and gene interactions written as conditions, so a
// piscivore hunts, a grazer keeps the peace, and now and then a fish breaks its own rule (the
// `chance` ones: deterministic per fish, so the same fish is always the exception).
//
// Plain JSON in a module: the studio edits and saves it. Shape (rules.js documents `when`):
//   { id, note, tag?, when, then: [{ stat | stats, add | mul | set | jitter }] }
// Rules read the stats as they were before any rule ran, so their order only matters when two
// rules touch the same stat (they apply top to bottom).

export default [
  // --- diet --------------------------------------------------------------------------------
  { id: 'piscivore', tag: 'diet', note: 'Fish-eaters hunt: more predatory, more aggressive.', when: { fact: 'diet', is: 'piscivore' }, then: [{ stat: 'predatoryDrive', add: 0.15 }, { stat: 'aggression', add: 0.1 }] },
  { id: 'carnivore', tag: 'diet', note: 'Meat-eaters run a little hot.', when: { fact: 'diet', in: ['carnivore', 'carrion'] }, then: [{ stat: 'aggression', add: 0.06 }, { stat: 'predatoryDrive', add: 0.05 }] },
  { id: 'grazer', tag: 'diet', note: 'Plant and plankton eaters have nothing to fight over.', when: { fact: 'diet', in: ['herbivore', 'planktivore'] }, then: [{ stat: 'aggression', add: -0.15 }, { stat: 'territoriality', add: -0.1 }] },
  { id: 'sifter', tag: 'diet', note: 'Bottom-sifters keep their heads down.', when: { fact: 'diet', is: 'detritivore' }, then: [{ stat: 'aggression', add: -0.08 }] },
  { id: 'gentle-giant', tag: 'diet', note: 'A huge fish that eats greens is calm and hard to rattle.', when: { all: [{ size: '>=huge' }, { fact: 'diet', in: ['herbivore', 'planktivore', 'detritivore'] }] }, then: [{ stat: 'aggression', mul: 0.6 }, { stat: 'stressResistance', add: 0.1 }] },

  // --- exceptions (mutations): rare, but always the same fish ---------------------------------
  { id: 'pacifist', tag: 'mutation', note: 'A piscivore that will not hunt.', when: { all: [{ fact: 'diet', is: 'piscivore' }, { chance: 0.08, salt: 'pacifist' }] }, then: [{ stat: 'aggression', mul: 0.35 }, { stat: 'predatoryDrive', mul: 0.5 }] },
  { id: 'berserker', tag: 'mutation', note: 'A grazer with a temper.', when: { all: [{ fact: 'diet', in: ['herbivore', 'planktivore'] }, { chance: 0.05, salt: 'berserker' }] }, then: [{ stat: 'aggression', add: 0.35 }, { stat: 'territoriality', add: 0.2 }] },
  { id: 'night-owl', tag: 'mutation', note: 'A day fish that keeps night hours.', when: { all: [{ fact: 'activity', is: 'diurnal' }, { chance: 0.04, salt: 'night-owl' }] }, then: [{ stat: 'circadian', set: 0.8 }] },

  // --- body & place ----------------------------------------------------------------------------
  { id: 'betta-male', tag: 'body', note: 'Male bettas guard their patch of surface.', when: { all: [{ any: [{ field: 'body', is: 'betta' }, { field: 'hybrid', is: 'silkkoi' }] }, { field: 'sex', is: 'm' }] }, then: [{ stat: 'territoriality', add: 0.3 }, { stat: 'aggression', add: 0.1 }] },
  { id: 'tiny-school', tag: 'social', note: 'Small and sociable: safety in numbers.', when: { all: [{ size: '<=small' }, { stat: 'sociability', gt: 0.6 }] }, then: [{ stat: 'schooling', add: 0.15 }] },
  { id: 'dark-water', tag: 'place', note: 'Twilight and abyss fish keep night hours in cooler water.', when: { fact: 'depth', in: ['twilight', 'abyss', 'void'] }, then: [{ stat: 'circadian', add: 0.08 }, { stat: 'idealTempC', add: -0.05 }] },
  { id: 'sterile-hybrid', tag: 'body', note: 'Some crosses cannot breed.', when: { fact: 'sterile', is: true }, then: [{ stat: 'fertility', set: 0 }] },
  { id: 'chaotic', tag: 'genes', note: 'Chaotic genes: every behaviour a little off-centre.', when: { field: 'chaos', is: 'chaotic' }, then: [{ stats: ['aggression', 'boldness', 'energy', 'sociability', 'curiosity', 'verticalPref'], jitter: 0.12 }] },

  // --- gene interactions (epistasis) ----------------------------------------------------------
  { id: 'hothead', tag: 'epistasis', note: 'Bold and fiery genes together: picks fights it cannot always win.', when: { all: [{ locus: 'boldness', gte: 0.67 }, { locus: 'aggression', gte: 0.67 }] }, then: [{ stat: 'territoriality', add: 0.12 }, { stat: 'stressResistance', add: -0.06 }] },
  { id: 'peacemaker', tag: 'epistasis', note: 'Gregarious and placid: calms a whole tank.', when: { all: [{ locus: 'sociability', gte: 0.67 }, { locus: 'aggression', lte: 0.33 }] }, then: [{ stat: 'aggression', mul: 0.7 }, { stat: 'schooling', add: 0.08 }, { stat: 'stressResistance', add: 0.05 }] },
  { id: 'live-wire', tag: 'epistasis', note: 'Fast metabolism and high energy: never still, always hungry, burns bright.', when: { all: [{ locus: 'metabolism', gte: 0.67 }, { locus: 'energy', gte: 0.67 }] }, then: [{ stat: 'energy', add: 0.1 }, { stat: 'appetite', add: 0.1 }, { stat: 'lifespan', add: -0.06 }] },
  { id: 'old-soul', tag: 'epistasis', note: 'Hardy and long-lived genes: unhurried, unbothered, ancient.', when: { all: [{ locus: 'vigor', gte: 0.6 }, { locus: 'longevity', gte: 0.67 }] }, then: [{ stat: 'lifespan', add: 0.1 }, { stat: 'stressResistance', add: 0.06 }, { stat: 'energy', add: -0.04 }] },
  { id: 'shy-giant', tag: 'epistasis', note: 'A big fish with shy genes startles at its own shadow.', when: { all: [{ size: '>=huge' }, { locus: 'boldness', lte: 0.33 }] }, then: [{ stat: 'stressResistance', add: -0.08 }] },

  // --- fun -----------------------------------------------------------------------------------
  { id: 'helmet-diva', tag: 'fun', note: 'A smug fish in a gold visor knows exactly how it looks.', when: { all: [{ feature: 'helmet', is: 'visor' }, { field: 'mood', is: 'smug' }] }, then: [{ stat: 'boldness', add: 0.1 }] },
];

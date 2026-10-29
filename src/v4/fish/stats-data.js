// fish4's stat tables: every coefficient a fish has, what it starts from, and what moves it.
// Plain data; stats.js composes it. Every stat is a number 0..1 (`value`); stats with a unit also
// map to a real number (`real`, e.g. °C) over `real: [lo, hi]`.
//
// Composition, in order (stats.js): body baseline (from fish3's ecology) → family priors →
// loci → size and tier → traits → features → rules (data/rules.js) → clamp.
//
// Bump STATS_VERSION when a stat's meaning or scale changes: behaviour models key on it.
//
// v2: the terrain stats (heatTolerance, radiance, burrowing, armour, luminosity); body leanings;
// for a fish of another medium (lava, sand, coolant, void), idealTempC and tempTolerance map over
// its medium's band (`TERRAINS.tempC`) and the water stats say so (`applies: false`).

export const STATS_VERSION = 2;

/** The stats, in display order. `low`/`high` are the words for the ends. */
export const STATS = [
  // water
  { id: 'idealTempC', label: 'Ideal temperature', group: 'water', unit: '°C', real: [2, 38], digits: 1, low: 'cold', high: 'warm' },
  { id: 'tempTolerance', label: 'Temperature tolerance', group: 'water', unit: '± °C', real: [1, 8], digits: 1, low: 'fussy', high: 'tolerant' },
  { id: 'idealPH', label: 'Ideal pH', group: 'water', unit: 'pH', real: [5.5, 9], digits: 1, low: 'acid', high: 'alkaline' },
  { id: 'phTolerance', label: 'pH tolerance', group: 'water', unit: '± pH', real: [0.1, 1], digits: 2, low: 'fussy', high: 'tolerant' },
  { id: 'salinityTolerance', label: 'Salinity tolerance', group: 'water', low: 'strict', high: 'any water' },
  // constitution
  { id: 'hardiness', label: 'Hardiness', group: 'constitution', low: 'delicate', high: 'hardy' },
  { id: 'stressResistance', label: 'Stress resistance', group: 'constitution', low: 'nervy', high: 'unflappable' },
  // temperament
  { id: 'aggression', label: 'Aggression', group: 'temperament', low: 'placid', high: 'fiery' },
  { id: 'predatoryDrive', label: 'Predatory drive', group: 'temperament', low: 'harmless', high: 'hunter' },
  { id: 'boldness', label: 'Boldness', group: 'temperament', low: 'shy', high: 'bold' },
  { id: 'territoriality', label: 'Territoriality', group: 'temperament', low: 'shares', high: 'guards' },
  // social
  { id: 'sociability', label: 'Sociability', group: 'social', low: 'loner', high: 'gregarious' },
  { id: 'schooling', label: 'Schooling', group: 'social', low: 'alone', high: 'shoals' },
  // movement
  { id: 'verticalPref', label: 'Preferred zone', group: 'movement', low: 'bottom', high: 'surface' },
  { id: 'zoneBreadth', label: 'Zone breadth', group: 'movement', low: 'stays put', high: 'roams' },
  { id: 'energy', label: 'Energy', group: 'movement', low: 'languid', high: 'zippy' },
  { id: 'stamina', label: 'Stamina', group: 'movement', low: 'tires fast', high: 'tireless' },
  { id: 'swimSpeed', label: 'Swim speed', group: 'movement', unit: 'BL/s', real: [0.5, 5], digits: 1, low: 'slow', high: 'fast' },
  // rhythm & feeding
  { id: 'circadian', label: 'Day rhythm', group: 'rhythm', low: 'diurnal', high: 'nocturnal' },
  { id: 'appetite', label: 'Appetite', group: 'rhythm', low: 'picky', high: 'greedy' },
  { id: 'metabolicRate', label: 'Metabolic rate', group: 'rhythm', low: 'slow', high: 'fast' },
  { id: 'dietBreadth', label: 'Diet breadth', group: 'rhythm', low: 'specialist', high: 'eats anything' },
  { id: 'curiosity', label: 'Curiosity', group: 'rhythm', low: 'aloof', high: 'nosy' },
  // life history
  { id: 'fertility', label: 'Fertility', group: 'life', low: 'shy breeder', high: 'prolific' },
  { id: 'clutchSize', label: 'Clutch size', group: 'life', unit: 'eggs', real: [1, 6], digits: 0, low: 'few eggs', high: 'many eggs' },
  { id: 'breedCooldownMul', label: 'Breeding rest', group: 'life', unit: '×', real: [0.6, 2.5], digits: 2, low: 'ready again soon', high: 'long rest' },
  { id: 'maturationMul', label: 'Time to adult', group: 'life', unit: '×', real: [0.5, 3], digits: 2, low: 'grows up fast', high: 'slow to mature' },
  { id: 'lifespan', label: 'Lifespan', group: 'life', unit: 'years', real: [1, 40], digits: 0, low: 'brief', high: 'long-lived' },
  { id: 'growthRate', label: 'Growth rate', group: 'life', low: 'slow', high: 'fast' },
  { id: 'mythicPotential', label: 'Mythic potential', group: 'life', low: 'none', high: 'saturated' },
  // terrain (v2)
  { id: 'heatTolerance', label: 'Heat tolerance', group: 'terrain', low: 'needs it cool', high: 'fireproof' },
  { id: 'radiance', label: 'Radiance', group: 'terrain', low: 'none', high: 'radiant (harmless)' },
  { id: 'burrowing', label: 'Burrowing', group: 'terrain', low: 'never digs', high: 'lives buried' },
  { id: 'armour', label: 'Armour', group: 'terrain', low: 'soft', high: 'plated' },
  { id: 'luminosity', label: 'Luminosity', group: 'terrain', low: 'dark', high: 'lamp-bright' },
];

/** The water stats: they only mean something in a wet medium (ecology4 WET). */
export const WATER_ONLY = ['idealPH', 'phTolerance', 'salinityTolerance'];

// ---------- terrain baselines (v2) ---------------------------------------------------------

/** Heat band (ecology4 HEAT) → heat tolerance. */
export const HEAT_TOLERANCE = { frozen: 0.1, cold: 0.15, mild: 0.25, warm: 0.35, hot: 0.55, baking: 0.72, molten: 0.9 };
/** Baselines by terrain; water fish start low and earn these from their looks. */
export const TERRAIN_BASE = {
  water: { burrowing: 0.05, armour: 0.08, luminosity: 0.02 },
  lava: { burrowing: 0.08, armour: 0.3, luminosity: 0.3 },
  sand: { burrowing: 0.45, armour: 0.15, luminosity: 0.02 },
  nuclear: { burrowing: 0.03, armour: 0.06, luminosity: 0.35 },
  aether: { burrowing: 0, armour: 0.05, luminosity: 0.2 },
};

export const STAT_IDS = STATS.map((s) => s.id);
export const statById = (id) => STATS.find((s) => s.id === id);

// ---------- baselines from fish3's ecology facts -------------------------------------------

/** Temperament step (0 skittish .. 4 apex) → aggression. */
export const TEMPER_AGGRESSION = [0.1, 0.25, 0.4, 0.55, 0.7];
export const PREDATION_BY_DIET = { piscivore: 0.72, carnivore: 0.55, carrion: 0.5, durophage: 0.35, omnivore: 0.28, detritivore: 0.12, planktivore: 0.1, herbivore: 0.08 };
export const DIET_BREADTH = { omnivore: 0.8, carrion: 0.7, detritivore: 0.6, carnivore: 0.45, herbivore: 0.4, durophage: 0.35, planktivore: 0.35, piscivore: 0.25 };
/** Sociality → sociability, schooling, territoriality. */
export const SOCIAL = {
  school: { sociability: 0.75, schooling: 0.7, territoriality: 0.2 },
  pair: { sociability: 0.55, schooling: 0.25, territoriality: 0.6 },
  solitary: { sociability: 0.25, schooling: 0.08, territoriality: 0.55 },
  warband: { sociability: 0.7, schooling: 0.5, territoriality: 0.5 },
  retinue: { sociability: 0.6, schooling: 0.4, territoriality: 0.4 },
};
export const LEVEL_Y = { above: 0.95, top: 0.82, mid: 0.5, bottom: 0.15 };
export const CURRENT_ENERGY = { still: 0.3, gentle: 0.45, strong: 0.65, torrent: 0.8 };
export const CIRCADIAN = { diurnal: 0.15, crepuscular: 0.5, nocturnal: 0.82, sleepless: 0.5 };
export const SALINITY_TOLERANCE = { fresh: 0.25, brackish: 0.8, marine: 0.3, any: 1 };
export const TEMP_TOLERANCE = { tropical: 0.35, temperate: 0.6, cold: 0.5, volcanic: 0.3, polar: 0.4 };
/** Starting points for stats with no ecology fact behind them. */
export const FLAT_BASE = {
  hardiness: 0.5, stressResistance: 0.5, boldness: 0.5, zoneBreadth: 0.4, stamina: 0.5, swimSpeed: 0.4, appetite: 0.5,
  metabolicRate: 0.5, curiosity: 0.45, fertility: 0.55, clutchSize: 0.4, breedCooldownMul: 0.21, maturationMul: 0.2,
  lifespan: 0.25, growthRate: 0.5, mythicPotential: 0, phTolerance: 0.4,
};

// ---------- loci ---------------------------------------------------------------------------

/**
 * How each locus moves each stat: delta = (locus − centre) × weight; centre is 0.5 unless given.
 * A locus at its middle leaves the baseline alone, so imported fish keep their ecology's sense.
 */
export const LOCUS_EFFECTS = {
  idealTempC: [['thermal', 0.17]],
  tempTolerance: [['vigor', 0.3]],
  idealPH: [['acidity', 0.23]],
  phTolerance: [['vigor', 0.3]],
  salinityTolerance: [['vigor', 0.15]],
  hardiness: [['vigor', 0.6]],
  stressResistance: [['resilience', 0.6]],
  aggression: [['aggression', 0.5]],
  predatoryDrive: [['aggression', 0.25]],
  boldness: [['boldness', 0.6]],
  territoriality: [['aggression', 0.3]],
  sociability: [['sociability', 0.5]],
  schooling: [['sociability', 0.4]],
  verticalPref: [['zone', 0.35]],
  zoneBreadth: [['energy', 0.35], ['boldness', 0.25]],
  energy: [['energy', 0.5], ['metabolism', 0.1]],
  stamina: [['energy', 0.3], ['vigor', 0.2]],
  swimSpeed: [['energy', 0.3]],
  appetite: [['metabolism', 0.5]],
  metabolicRate: [['metabolism', 0.6]],
  curiosity: [['boldness', 0.5], ['metabolism', 0.2]],
  fertility: [['fertility', 0.6]],
  clutchSize: [['fecundity', 0.6]],
  breedCooldownMul: [['fertility', -0.5]],
  maturationMul: [['maturation', 0.4]],
  lifespan: [['longevity', 0.4], ['vigor', 0.1]],
  growthRate: [['metabolism', 0.4], ['maturation', -0.4]],
  mythicPotential: [['aether', 1, 0]],
  heatTolerance: [['thermal', 0.2], ['vigor', 0.1]],
  burrowing: [['zone', -0.2]],
  armour: [['resilience', 0.1]],
};

// ---------- size and tier ------------------------------------------------------------------

/** Per size step from medium (tiny −2 … giant +3). Big fish live long, grow up slow, lay fewer. */
export const SIZE_EFFECTS = {
  lifespan: 0.07, metabolicRate: -0.05, clutchSize: -0.05, maturationMul: 0.05, breedCooldownMul: 0.03,
  boldness: 0.04, swimSpeed: 0.03, schooling: -0.04,
};

/**
 * Per tier rank above Common: rarity costs reproduction (slower, fewer, rarer broods), so a rare
 * line is worth more but never out-breeds a common one.
 */
export const TIER_EFFECTS = { maturationMul: 0.04, breedCooldownMul: 0.035, fertility: -0.035, clutchSize: -0.03 };

// ---------- traits -------------------------------------------------------------------------

/**
 * What the fish's looks and resolved genes do. `when` is a rules.js condition over the fish
 * (fields, ecology facts, and the extra facts morph, longfin, bubble, hybrid, sterile, male).
 */
export const TRAIT_EFFECTS = [
  { when: { field: 'scales', is: 'plates' }, label: 'armour plates', then: { hardiness: 0.08, swimSpeed: -0.04, armour: 0.3 } },
  { when: { fact: 'morph', in: ['albino', 'leucistic', 'ghost'] }, label: 'pale morph', then: { hardiness: -0.08, stressResistance: -0.05 } },
  { when: { fact: 'morph', is: 'melanistic' }, label: 'melanistic', then: { hardiness: 0.03 } },
  { when: { fact: 'longfin', is: true }, label: 'long fins', then: { swimSpeed: -0.12, stamina: -0.08, hardiness: -0.04 } },
  { when: { fact: 'bubble', is: true }, label: 'bubble eyes', then: { hardiness: -0.08, stressResistance: -0.06, swimSpeed: -0.05 } },
  { when: { field: 'chonk', is: 'round' }, label: 'round build', then: { swimSpeed: -0.1, energy: -0.06, appetite: 0.06 } },
  { when: { field: 'chonk', is: 'plump' }, label: 'plump build', then: { swimSpeed: -0.04, energy: -0.03, appetite: 0.03 } },
  { when: { field: 'chonk', is: 'lean' }, label: 'lean build', then: { swimSpeed: 0.04, energy: 0.04, appetite: -0.02 } },
  { when: { fact: 'hybrid', is: true }, label: 'hybrid vigour', then: { hardiness: 0.06, stamina: 0.03 } },
  { when: { fact: 'temperament', is: 'skittish' }, label: 'skittish', then: { boldness: -0.12, stressResistance: -0.08 } },
  { when: { fact: 'feeding', is: 'pursuit' }, label: 'pursuit hunter', then: { swimSpeed: 0.06, stamina: 0.04 } },
  { when: { fact: 'feeding', is: 'ambush' }, label: 'ambush hunter', then: { energy: -0.06, predatoryDrive: 0.04 } },
  { when: { fact: 'feeding', is: 'lure' }, label: 'lure fisher', then: { energy: -0.1, zoneBreadth: -0.08 } },
  { when: { fact: 'feeding', is: 'grazing' }, label: 'grazer', then: { appetite: 0.06 } },
  { when: { field: 'eye', is: 'big' }, label: 'big eyes', then: { curiosity: 0.04 } },
  { when: { field: 'eyeMount', is: 'telescope' }, label: 'telescope eyes', then: { curiosity: 0.04, swimSpeed: -0.03 } },
  { when: { field: 'mood', is: 'happy' }, label: 'happy face', then: { stressResistance: 0.04 } },
  { when: { field: 'mood', is: 'grumpy' }, label: 'grumpy face', then: { territoriality: 0.05 } },
  { when: { field: 'mood', is: 'derpy' }, label: 'derpy face', then: { curiosity: 0.06, boldness: 0.03 } },
  { when: { field: 'mood', is: 'sleepy' }, label: 'sleepy face', then: { energy: -0.08 } },
  { when: { field: 'mood', is: 'smug' }, label: 'smug face', then: { boldness: 0.06 } },
  { when: { field: 'pelvic', is: 'sucker' }, label: 'sucker fins', then: { zoneBreadth: -0.1, verticalPref: -0.05, burrowing: -0.04 } },
  { when: { field: 'pectoral', is: 'glider' }, label: 'glider fins', then: { verticalPref: 0.06, swimSpeed: 0.04 } },
  { when: { field: 'damage', in: ['scar', 'notched'] }, label: 'old scars', then: { boldness: 0.03, stressResistance: 0.03 } },
  { when: { all: [{ fact: 'male', is: true }, { fact: 'dimorphic', is: true }] }, label: 'showy male', then: { territoriality: 0.06, boldness: 0.03 } },
  // terrain stats (v2)
  { when: { field: 'scales', is: 'sandpaper' }, label: 'sandpaper skin', then: { armour: 0.1, burrowing: 0.06 } },
  { when: { field: 'dorsal', in: ['spiny', 'venom', 'crest'] }, label: 'armed dorsal', then: { armour: 0.08 } },
  { when: { field: 'glow', in: ['spots', 'edge'] }, label: 'glow', then: { luminosity: 0.2 } },
  { when: { field: 'glow', is: 'full' }, label: 'full glow', then: { luminosity: 0.4 } },
  { when: { field: 'markings', is: 'photophores' }, label: 'photophores', then: { luminosity: 0.2 } },
  { when: { field: 'morph', is: 'neon' }, label: 'neon morph', then: { luminosity: 0.12, radiance: 0.05 } },
  { when: { field: 'niche', is: 'burrower' }, label: 'burrower niche', then: { burrowing: 0.25 } },
  { when: { field: 'niche', is: 'sifter' }, label: 'sifter niche', then: { burrowing: 0.1 } },
  { when: { fact: 'level', is: 'bottom' }, label: 'bottom dweller', then: { burrowing: 0.05 } },
  { when: { field: 'eye', is: 'small' }, label: 'small eyes', then: { burrowing: 0.04 } },
];

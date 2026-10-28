// Ecology tables for fish3: what a fish's body says about how it lives. Plain data only -- the
// rules that read it are in ecology.js. Nothing here is random: a fish's ecology is worked out
// from its traits, so a player who knows the tables can read a fish's diet off its jaw.
//
// Every value below is also a lore key (see lore-data.js and docs/lore-writing-guide.md):
// renaming one renames its pools.

/** The scales every ecology fact is measured on, in order (where order means something). */
export const SCALES = {
  diet: ['piscivore', 'carnivore', 'durophage', 'omnivore', 'herbivore', 'detritivore', 'planktivore'],
  feeding: ['pursuit', 'ambush', 'lure', 'grazing', 'sifting', 'picking'],
  level: ['top', 'mid', 'bottom'],
  temperament: ['skittish', 'peaceful', 'territorial', 'aggressive', 'apex'],
  sociality: ['school', 'pair', 'solitary'],
  activity: ['diurnal', 'crepuscular', 'nocturnal'],
  depth: ['shallows', 'reef', 'open', 'twilight', 'abyss'],
  salinity: ['fresh', 'brackish', 'marine'],
  temp: ['cold', 'temperate', 'tropical'],
  current: ['still', 'gentle', 'strong', 'torrent'],
  hardness: ['soft', 'medium', 'hard'],
};

/** Values only a signature or relic can give (see SIGNATURE_ECOLOGY). Lore keys like any other. */
export const SPECIAL = {
  diet: ['carrion'],
  level: ['above'],
  temperament: [],
  sociality: ['warband', 'retinue'],
  activity: ['sleepless'],
  depth: ['void'],
  salinity: ['any'],
  temp: ['volcanic', 'polar'],
};

/**
 * Each body's baseline, before its own traits move it. `temper` is a step on SCALES.temperament
 * (0 skittish .. 4 apex). A hybrid with no entry uses its first parent's.
 */
export const HABITAT = {
  torpedo: { diet: 'omnivore', level: 'mid', temper: 1, social: 'school', activity: 'diurnal', depth: 'open', salinity: 'fresh', temp: 'temperate', current: 'strong', hardness: 'medium' },
  round: { diet: 'omnivore', level: 'mid', temper: 1, social: 'pair', activity: 'diurnal', depth: 'shallows', salinity: 'fresh', temp: 'temperate', current: 'gentle', hardness: 'medium' },
  disc: { diet: 'omnivore', level: 'mid', temper: 1, social: 'pair', activity: 'diurnal', depth: 'shallows', salinity: 'fresh', temp: 'tropical', current: 'still', hardness: 'soft' },
  eel: { diet: 'carnivore', level: 'bottom', temper: 2, social: 'solitary', activity: 'nocturnal', depth: 'reef', salinity: 'brackish', temp: 'temperate', current: 'gentle', hardness: 'medium' },
  arrow: { diet: 'piscivore', level: 'top', temper: 2, social: 'solitary', activity: 'crepuscular', depth: 'shallows', salinity: 'fresh', temp: 'temperate', current: 'gentle', hardness: 'medium' },
  pufferish: { diet: 'durophage', level: 'mid', temper: 2, social: 'solitary', activity: 'diurnal', depth: 'reef', salinity: 'brackish', temp: 'tropical', current: 'gentle', hardness: 'hard' },
  shark: { diet: 'piscivore', level: 'mid', temper: 3, social: 'solitary', activity: 'crepuscular', depth: 'open', salinity: 'marine', temp: 'tropical', current: 'strong', hardness: 'hard' },
  hatchet: { diet: 'planktivore', level: 'top', temper: 0, social: 'school', activity: 'diurnal', depth: 'shallows', salinity: 'fresh', temp: 'tropical', current: 'gentle', hardness: 'soft' },
  piranha: { diet: 'carnivore', level: 'mid', temper: 3, social: 'school', activity: 'crepuscular', depth: 'shallows', salinity: 'fresh', temp: 'tropical', current: 'gentle', hardness: 'soft' },
  boxfish: { diet: 'durophage', level: 'mid', temper: 1, social: 'solitary', activity: 'diurnal', depth: 'reef', salinity: 'marine', temp: 'tropical', current: 'gentle', hardness: 'hard' },
  cowfish: { diet: 'durophage', level: 'bottom', temper: 1, social: 'solitary', activity: 'diurnal', depth: 'reef', salinity: 'marine', temp: 'tropical', current: 'gentle', hardness: 'hard' },
  trigger: { diet: 'durophage', level: 'mid', temper: 3, social: 'solitary', activity: 'diurnal', depth: 'reef', salinity: 'marine', temp: 'tropical', current: 'strong', hardness: 'hard' },
  mola: { diet: 'planktivore', level: 'top', temper: 1, social: 'solitary', activity: 'diurnal', depth: 'open', salinity: 'marine', temp: 'temperate', current: 'gentle', hardness: 'hard' },
  lionfish: { diet: 'piscivore', level: 'mid', temper: 2, social: 'solitary', activity: 'crepuscular', depth: 'reef', salinity: 'marine', temp: 'tropical', current: 'gentle', hardness: 'hard' },
  betta: { diet: 'carnivore', level: 'top', temper: 3, social: 'solitary', activity: 'diurnal', depth: 'shallows', salinity: 'fresh', temp: 'tropical', current: 'still', hardness: 'soft' },
  koi: { diet: 'omnivore', level: 'mid', temper: 1, social: 'school', activity: 'diurnal', depth: 'shallows', salinity: 'fresh', temp: 'cold', current: 'gentle', hardness: 'medium' },
  catfish: { diet: 'detritivore', level: 'bottom', temper: 1, social: 'school', activity: 'nocturnal', depth: 'shallows', salinity: 'fresh', temp: 'tropical', current: 'gentle', hardness: 'medium' },
  angler: { diet: 'piscivore', level: 'bottom', temper: 2, social: 'solitary', activity: 'nocturnal', depth: 'abyss', salinity: 'marine', temp: 'cold', current: 'still', hardness: 'hard' },
  barracuda: { diet: 'piscivore', level: 'mid', temper: 3, social: 'solitary', activity: 'diurnal', depth: 'open', salinity: 'marine', temp: 'tropical', current: 'strong', hardness: 'hard' },
  needle: { diet: 'piscivore', level: 'top', temper: 2, social: 'school', activity: 'diurnal', depth: 'shallows', salinity: 'brackish', temp: 'tropical', current: 'gentle', hardness: 'medium' },
  swordfish: { diet: 'piscivore', level: 'mid', temper: 3, social: 'solitary', activity: 'crepuscular', depth: 'open', salinity: 'marine', temp: 'temperate', current: 'torrent', hardness: 'hard' },
  discus: { diet: 'carnivore', level: 'mid', temper: 1, social: 'school', activity: 'diurnal', depth: 'shallows', salinity: 'fresh', temp: 'tropical', current: 'still', hardness: 'soft' },
  butterfly: { diet: 'omnivore', level: 'mid', temper: 1, social: 'pair', activity: 'diurnal', depth: 'reef', salinity: 'marine', temp: 'tropical', current: 'gentle', hardness: 'hard' },
  clown: { diet: 'omnivore', level: 'mid', temper: 2, social: 'pair', activity: 'diurnal', depth: 'reef', salinity: 'marine', temp: 'tropical', current: 'gentle', hardness: 'hard' },
  tetra: { diet: 'omnivore', level: 'mid', temper: 0, social: 'school', activity: 'diurnal', depth: 'shallows', salinity: 'fresh', temp: 'tropical', current: 'gentle', hardness: 'soft' },
  guppy: { diet: 'omnivore', level: 'top', temper: 0, social: 'school', activity: 'diurnal', depth: 'shallows', salinity: 'fresh', temp: 'tropical', current: 'gentle', hardness: 'medium' },
  oarfish: { diet: 'planktivore', level: 'mid', temper: 1, social: 'solitary', activity: 'nocturnal', depth: 'twilight', salinity: 'marine', temp: 'temperate', current: 'still', hardness: 'hard' },
  sturgeon: { diet: 'detritivore', level: 'bottom', temper: 1, social: 'solitary', activity: 'crepuscular', depth: 'shallows', salinity: 'brackish', temp: 'cold', current: 'strong', hardness: 'medium' },
  coelacanth: { diet: 'carnivore', level: 'bottom', temper: 1, social: 'solitary', activity: 'nocturnal', depth: 'twilight', salinity: 'marine', temp: 'cold', current: 'gentle', hardness: 'hard' },
  blobfish: { diet: 'detritivore', level: 'bottom', temper: 1, social: 'solitary', activity: 'nocturnal', depth: 'abyss', salinity: 'marine', temp: 'cold', current: 'still', hardness: 'hard' },
  flyingfish: { diet: 'planktivore', level: 'top', temper: 0, social: 'school', activity: 'diurnal', depth: 'open', salinity: 'marine', temp: 'tropical', current: 'strong', hardness: 'hard' },
  knifefish: { diet: 'carnivore', level: 'bottom', temper: 2, social: 'solitary', activity: 'nocturnal', depth: 'shallows', salinity: 'fresh', temp: 'tropical', current: 'gentle', hardness: 'soft' },
  // hybrids that differ from their first parent
  noodleshark: { diet: 'piscivore', level: 'bottom', temper: 3, social: 'solitary', activity: 'nocturnal', depth: 'reef', salinity: 'brackish', temp: 'tropical', current: 'gentle', hardness: 'medium' },
  whiskerkoi: { diet: 'omnivore', level: 'bottom', temper: 1, social: 'school', activity: 'crepuscular', depth: 'shallows', salinity: 'fresh', temp: 'temperate', current: 'gentle', hardness: 'medium' },
  moonblob: { diet: 'planktivore', level: 'mid', temper: 1, social: 'solitary', activity: 'nocturnal', depth: 'twilight', salinity: 'marine', temp: 'cold', current: 'still', hardness: 'hard' },
  lanternbite: { diet: 'piscivore', level: 'mid', temper: 2, social: 'school', activity: 'nocturnal', depth: 'twilight', salinity: 'fresh', temp: 'tropical', current: 'gentle', hardness: 'soft' },
  dragonling: { diet: 'carnivore', level: 'bottom', temper: 3, social: 'solitary', activity: 'nocturnal', depth: 'reef', salinity: 'brackish', temp: 'cold', current: 'strong', hardness: 'medium' },
  gliderhatch: { diet: 'planktivore', level: 'top', temper: 0, social: 'school', activity: 'diurnal', depth: 'shallows', salinity: 'brackish', temp: 'tropical', current: 'strong', hardness: 'medium' },
  fossilcat: { diet: 'detritivore', level: 'bottom', temper: 1, social: 'solitary', activity: 'nocturnal', depth: 'twilight', salinity: 'brackish', temp: 'cold', current: 'gentle', hardness: 'hard' },
};

/** Jaws that decide the diet outright. Unlisted jaws (plain) leave the body's diet. */
export const DIET_BY_JAW = {
  piranha: 'carnivore',
  fangs: 'piscivore',
  gape: 'piscivore',
  bill: 'piscivore',
  beak: 'durophage',
  lips: 'herbivore',
  sucker: 'herbivore',
  tube: 'planktivore',
  grin: 'omnivore',
};

/** Jaws that read as weapons: they push temperament up a step. */
export const ARMED_JAWS = ['piranha', 'fangs', 'gape', 'bill'];
/** Defences that push temperament up a step. */
export const ARMED_DORSALS = ['spiny', 'venom'];
export const ARMED_EXTRAS = ['cheekspines', 'horns', 'nosehorn', 'scutes'];

/** How a tail moves the preferred current: fast tails want flow, flowing tails want calm. */
export const CURRENT_BY_TAIL = { lunate: 1, crescent: 1, fork: 1, hetero: 1, sword: 1, veil: -1, lyre: -1, round: -1, streamer: -1, paddle: -1 };
/** Gaits that move the preferred current. */
export const CURRENT_BY_GAIT = { thunniform: 1, carangiform: 1, ostraciiform: -1, labriform: -1, amiiform: -1 };

/** Size class → adult length in cm and the smallest tank for one fish, litres. */
export const SIZE_CARE = {
  tiny: { cm: 3, litres: 20 },
  small: { cm: 6, litres: 40 },
  medium: { cm: 12, litres: 110 },
  large: { cm: 25, litres: 300 },
  huge: { cm: 50, litres: 900 },
  giant: { cm: 110, litres: 4000 },
};

/** Water numbers per band, for the dossier. */
export const TEMP_C = { cold: [10, 18], temperate: [16, 24], tropical: [24, 30], volcanic: [31, 38], polar: [2, 8] };
export const PH = { soft: [6, 7], medium: [6.8, 7.6], hard: [7.6, 8.4] };
export const MARINE_PH = [8.1, 8.4];

/**
 * What a signature or relic does to the ecology on top of the traits. These are the only way to
 * reach the SPECIAL values, so a reader who sees "volcanic" knows the fish carries embers.
 */
export const SIGNATURE_ECOLOGY = {
  crown: { temperament: 'apex' },
  halo: { temperament: 'peaceful', activity: 'diurnal' },
  thirdeye: { activity: 'sleepless' },
  runes: { salinity: 'any' },
  embers: { temp: 'volcanic' },
  voideye: { depth: 'abyss', activity: 'nocturnal' },
  wings: { level: 'above' },
  brand: { sociality: 'warband' },
  mantle: { temp: 'polar' },
  orbit: { sociality: 'retinue' },
  eclipse: { depth: 'void' },
  revenant: { diet: 'carrion' },
};

/** Plain words for every value, for the dossier and the factual fallbacks. */
export const WORDS = {
  diet: { piscivore: 'eats other fish', carnivore: 'eats meat', durophage: 'crushes shells', omnivore: 'eats anything', herbivore: 'eats plants and algae', detritivore: 'eats what settles on the bottom', planktivore: 'eats plankton', carrion: 'eats the dead' },
  feeding: { pursuit: 'chases its food down', ambush: 'waits, then strikes', lure: 'lures prey in with its light', grazing: 'grazes', sifting: 'sifts the substrate', picking: 'picks food from the water' },
  level: { top: 'swims near the surface', mid: 'swims in mid-water', bottom: 'stays near the bottom', above: 'leaps clear of the water' },
  temperament: { skittish: 'skittish', peaceful: 'peaceful', territorial: 'territorial', aggressive: 'aggressive', apex: 'dominant over every tankmate' },
  sociality: { school: 'keep in a school', pair: 'keep as a pair', solitary: 'keep alone', warband: 'leads others', retinue: 'never swims alone' },
  activity: { diurnal: 'active by day', crepuscular: 'active at dusk and dawn', nocturnal: 'active at night', sleepless: 'never sleeps' },
  depth: { shallows: 'shallow water', reef: 'reefs', open: 'open water', twilight: 'the twilight zone', abyss: 'the abyss', void: 'no known depth' },
  salinity: { fresh: 'fresh water', brackish: 'brackish water', marine: 'salt water', any: 'any water' },
  temp: { cold: 'cold', temperate: 'temperate', tropical: 'tropical', volcanic: 'scalding', polar: 'near-freezing' },
  current: { still: 'still water', gentle: 'a gentle current', strong: 'a strong current', torrent: 'a torrent' },
  hardness: { soft: 'soft', medium: 'medium', hard: 'hard' },
};

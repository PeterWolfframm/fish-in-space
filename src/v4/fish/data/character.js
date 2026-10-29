// fish4's character data: plain JSON in a module (the studio can edit it). character.js reads a
// fish's personality off its stats, loci, facts, niche and terrain with these tables.
// Tone: Seedfall. Warm, curious, a little cheeky; never cruel. Nuclear fish are radiant and harmless.

/**
 * The five personality axes, each a blend of stats (weights sum to 1). Body and niche leanings
 * nudge them after (character.js).
 */
export const AXES = {
  boldness: { label: 'Boldness', from: { boldness: 0.7, curiosity: 0.15, stressResistance: 0.15 }, low: 'timid', high: 'bold' },
  sociability: { label: 'Sociability', from: { sociability: 0.6, schooling: 0.4 }, low: 'solitary', high: 'social' },
  curiosity: { label: 'Curiosity', from: { curiosity: 0.8, zoneBreadth: 0.2 }, low: 'incurious', high: 'curious' },
  temper: { label: 'Temper', from: { aggression: 0.55, territoriality: 0.3, predatoryDrive: 0.15 }, low: 'placid', high: 'fiery' },
  energy: { label: 'Energy', from: { energy: 0.6, swimSpeed: 0.2, stamina: 0.2 }, low: 'languid', high: 'lively' },
};

/** Niche leanings on the axes (added, ±). */
export const NICHE_AXES = {
  grazer: { temper: -0.06, sociability: 0.04 },
  school: { sociability: 0.1, boldness: -0.04 },
  ambush: { energy: -0.08, temper: 0.06, sociability: -0.06 },
  ornament: { curiosity: 0.06, boldness: 0.04 },
  percher: { curiosity: 0.08, energy: -0.04 },
  pursuit: { energy: 0.1, temper: 0.04 },
  drifter: { energy: -0.1, temper: -0.06 },
  lurker: { boldness: -0.06, sociability: -0.08 },
  sifter: { curiosity: 0.04, temper: -0.04 },
  glider: { energy: 0.04, curiosity: 0.04 },
  burrower: { boldness: -0.08, energy: -0.06 },
};

/**
 * Archetypes: a centre on the axes (0..1, `null` = any). The nearest one wins; ties break on the
 * fish's own key. `voice` tags steer text.
 */
export const ARCHETYPES = [
  { id: 'sentinel', label: 'Sentinel', centre: { boldness: 0.7, sociability: 0.4, curiosity: 0.45, temper: 0.65, energy: 0.45 }, line: 'keeps watch over its patch', voice: ['steady', 'dutiful'] },
  { id: 'gossip', label: 'Gossip', centre: { boldness: 0.55, sociability: 0.85, curiosity: 0.7, temper: 0.3, energy: 0.65 }, line: 'knows everyone in the tank by lunchtime', voice: ['chatty', 'warm'] },
  { id: 'drifter', label: 'Drifter', centre: { boldness: 0.4, sociability: 0.4, curiosity: 0.4, temper: 0.2, energy: 0.15 }, line: 'goes where the current goes', voice: ['dreamy', 'calm'] },
  { id: 'bruiser', label: 'Bruiser', centre: { boldness: 0.8, sociability: 0.3, curiosity: 0.3, temper: 0.85, energy: 0.6 }, line: 'settles every argument by being bigger', voice: ['gruff', 'blunt'] },
  { id: 'scholar', label: 'Scholar', centre: { boldness: 0.45, sociability: 0.35, curiosity: 0.85, temper: 0.25, energy: 0.35 }, line: 'inspects every pebble twice', voice: ['curious', 'precise'] },
  { id: 'showoff', label: 'Show-off', centre: { boldness: 0.85, sociability: 0.65, curiosity: 0.55, temper: 0.45, energy: 0.8 }, line: 'swims best when someone is watching', voice: ['bright', 'cheeky'] },
  { id: 'hermit', label: 'Hermit', centre: { boldness: 0.25, sociability: 0.1, curiosity: 0.35, temper: 0.4, energy: 0.3 }, line: 'would rather you knocked first', voice: ['quiet', 'dry'] },
  { id: 'socialite', label: 'Socialite', centre: { boldness: 0.5, sociability: 0.9, curiosity: 0.45, temper: 0.2, energy: 0.5 }, line: 'never swims alone if it can help it', voice: ['warm', 'easy'] },
  { id: 'daredevil', label: 'Daredevil', centre: { boldness: 0.9, sociability: 0.45, curiosity: 0.75, temper: 0.5, energy: 0.9 }, line: 'tries every gap, twice as fast', voice: ['bright', 'reckless'] },
  { id: 'worrier', label: 'Worrier', centre: { boldness: 0.15, sociability: 0.6, curiosity: 0.4, temper: 0.3, energy: 0.55 }, line: 'counts its shoal every few minutes', voice: ['nervous', 'kind'] },
  { id: 'monk', label: 'Monk', centre: { boldness: 0.5, sociability: 0.2, curiosity: 0.3, temper: 0.05, energy: 0.15 }, line: 'has found the one good spot and stays there', voice: ['calm', 'still'] },
  { id: 'hunter', label: 'Hunter', centre: { boldness: 0.65, sociability: 0.2, curiosity: 0.55, temper: 0.7, energy: 0.65 }, line: 'patrols, waits, pounces', voice: ['keen', 'terse'] },
  { id: 'guardian', label: 'Guardian', centre: { boldness: 0.6, sociability: 0.7, curiosity: 0.35, temper: 0.6, energy: 0.45 }, line: 'looks after the little ones, whoever they belong to', voice: ['steady', 'warm'] },
  { id: 'clown', label: 'Clown', centre: { boldness: 0.65, sociability: 0.6, curiosity: 0.8, temper: 0.2, energy: 0.75 }, line: 'turns every feeding into a show', voice: ['cheeky', 'bright'] },
  { id: 'explorer', label: 'Explorer', centre: { boldness: 0.7, sociability: 0.35, curiosity: 0.85, temper: 0.35, energy: 0.7 }, line: 'has mapped the whole tank and is starting again', voice: ['curious', 'keen'] },
  { id: 'sleeper', label: 'Sleeper', centre: { boldness: 0.35, sociability: 0.45, curiosity: 0.2, temper: 0.2, energy: 0.05 }, line: 'is resting its eyes, thank you', voice: ['dreamy', 'dry'] },
];

/**
 * Adjectives beyond the axes: a stat (or locus / fact) far from the middle. `hi` / `lo` words;
 * salience is the distance from 0.5, scaled by `k`.
 */
export const TRAIT_WORDS = [
  { stat: 'appetite', hi: 'greedy', lo: 'picky', k: 1 },
  { stat: 'circadian', hi: 'nocturnal', lo: 'early-rising', k: 0.75 },
  { stat: 'hardiness', hi: 'tough', lo: 'delicate', k: 0.9 },
  { stat: 'territoriality', hi: 'territorial', lo: 'easy-going', k: 0.9 },
  { stat: 'stressResistance', hi: 'unflappable', lo: 'jumpy', k: 0.9 },
  { stat: 'luminosity', hi: 'glowing', k: 1.2 },
  { stat: 'burrowing', hi: 'burrowing', k: 1.1 },
  { stat: 'armour', hi: 'armoured', k: 1 },
  { stat: 'radiance', hi: 'radiant', k: 1.1 },
  { stat: 'lifespan', hi: 'long-lived', lo: 'short-lived', k: 0.7 },
  { stat: 'swimSpeed', hi: 'quick', lo: 'unhurried', k: 0.8 },
  { stat: 'predatoryDrive', hi: 'predatory', k: 0.8 },
];

/**
 * Quirks: habits a keeper notices. `when` is a rules.js condition (stats, facts, fields, size,
 * tier; facts include terrain, region, niche, archetype, role). The most specific matching ones
 * are preferred; ties break on the fish's key.
 */
export const QUIRKS = [
  { id: 'pebbles', when: { all: [{ stat: 'curiosity', gte: 0.55 }, { fact: 'level', is: 'bottom' }] }, text: 'hoards pebbles in one corner' },
  { id: 'sulks', when: { stat: 'stressResistance', lte: 0.35 }, text: 'sulks after a water change' },
  { id: 'reflection', when: { all: [{ stat: 'aggression', gte: 0.55 }, { stat: 'boldness', gte: 0.55 }] }, text: 'races its own reflection' },
  { id: 'glass', when: { stat: 'curiosity', gte: 0.6 }, text: 'follows fingers along the glass' },
  { id: 'firstfood', when: { stat: 'appetite', gte: 0.6 }, text: 'is first to the food, every time' },
  { id: 'spits', when: { stat: 'appetite', lte: 0.35 }, text: 'spits out flakes it does not fancy' },
  { id: 'nightpatrol', when: { stat: 'circadian', gte: 0.7 }, text: 'patrols the tank after lights-out' },
  { id: 'dawn', when: { stat: 'circadian', lte: 0.12 }, text: 'greets the morning light at the front glass' },
  { id: 'counts', when: { all: [{ stat: 'schooling', gte: 0.6 }, { stat: 'boldness', lte: 0.45 }] }, text: 'counts its shoal, then counts again' },
  { id: 'leads', when: { fact: 'role', is: 'leader' }, text: 'turns, and the whole shoal turns with it' },
  { id: 'nap', when: { stat: 'energy', lte: 0.3 }, text: 'naps in the same spot each afternoon' },
  { id: 'zoomies', when: { stat: 'energy', gte: 0.72 }, text: 'does laps of the tank for no reason at all' },
  { id: 'plant', when: { fact: 'diet', is: 'herbivore' }, text: 'trims the plants a little too neatly' },
  { id: 'hide', when: { stat: 'boldness', lte: 0.3 }, text: 'peeks out from behind the decor' },
  { id: 'guard', when: { stat: 'territoriality', gte: 0.65 }, text: 'has claimed one rock and will tell you about it' },
  { id: 'bubbles', when: { field: 'mood', in: ['happy', 'derpy'] }, text: 'blows a bubble at anyone who says hello' },
  { id: 'grumpy', when: { field: 'mood', is: 'grumpy' }, text: 'gives new tankmates a long hard look' },
  { id: 'helmet', when: { feature: 'helmet', not: 'none' }, text: 'polishes its helmet against the gravel' },
  { id: 'old', when: { field: 'stage', is: 'elder' }, text: 'takes the long way round, these days' },
  { id: 'big', when: { size: '>=huge' }, text: 'rearranges the decor just by turning around' },
  { id: 'tiny', when: { size: 'tiny' }, text: 'fits through gaps nobody else knew were there' },
  // Terrains.
  { id: 'lava-hum', terrain: true, when: { fact: 'terrain', is: 'lava' }, text: 'crackles softly when it is content' },
  { id: 'lava-crust', terrain: true, when: { all: [{ fact: 'terrain', is: 'lava' }, { stat: 'armour', gte: 0.5 }] }, text: 'naps under a fresh crust of cooling rock' },
  { id: 'lava-sparks', terrain: true, when: { all: [{ fact: 'terrain', is: 'lava' }, { stat: 'energy', gte: 0.55 }] }, text: 'leaves a trail of sparks on its turns' },
  { id: 'lava-cold', terrain: true, when: { fact: 'terrain', is: 'lava' }, text: 'sidles up to the warmest seam in the tank' },
  { id: 'sand-dive', terrain: true, when: { fact: 'terrain', is: 'sand' }, text: 'dives into the sand mid-sentence' },
  { id: 'sand-eyes', terrain: true, when: { all: [{ fact: 'terrain', is: 'sand' }, { stat: 'burrowing', gte: 0.5 }] }, text: 'leaves only its eyes above the dune' },
  { id: 'sand-ripples', terrain: true, when: { all: [{ fact: 'terrain', is: 'sand' }, { stat: 'curiosity', gte: 0.5 }] }, text: 'draws ripples in the sand and admires them' },
  { id: 'sand-hop', terrain: true, when: { all: [{ fact: 'terrain', is: 'sand' }, { fact: 'niche', is: 'percher' }] }, text: 'hops from dune to dune on its fins' },
  { id: 'nuc-hum', terrain: true, when: { fact: 'terrain', is: 'nuclear' }, text: 'hums in the coolant' },
  { id: 'nuc-glow', terrain: true, when: { all: [{ fact: 'terrain', is: 'nuclear' }, { stat: 'luminosity', gte: 0.5 }] }, text: 'glows a little brighter when it is happy' },
  { id: 'nuc-night', terrain: true, when: { all: [{ fact: 'terrain', is: 'nuclear' }, { stat: 'circadian', gte: 0.55 }] }, text: 'is the night-light everyone else sleeps by' },
  { id: 'nuc-sparkle', terrain: true, when: { all: [{ fact: 'terrain', is: 'nuclear' }, { stat: 'sociability', gte: 0.55 }] }, text: 'sparkles at its friends' },
  // Anyone (least specific: they only fill in).
  { id: 'bubbles-watch', when: true, text: 'watches the bubbles rise as if they might say something' },
  { id: 'decor', when: true, text: 'inspects new decor before anyone else' },
  { id: 'route', when: true, text: 'swims the same loop, in the same order, every morning' },
  { id: 'aether', terrain: true, when: { fact: 'terrain', is: 'aether' }, text: 'is sometimes not quite there' },
];

/** What it likes and dislikes, by fact or stat. Each `{ when, likes?, dislikes?, fears? }`. */
export const LEANINGS = [
  { when: { fact: 'diet', is: 'piscivore' }, likes: ['live food'], dislikes: ['flakes'] },
  { when: { fact: 'diet', is: 'herbivore' }, likes: ['algae wafers', 'soft plants'] },
  { when: { fact: 'diet', is: 'omnivore' }, likes: ['a bit of everything'] },
  { when: { fact: 'diet', in: ['carnivore', 'durophage'] }, likes: ['frozen shrimp'] },
  { when: { fact: 'diet', is: 'planktivore' }, likes: ['fine powdered food'] },
  { when: { fact: 'diet', is: 'detritivore' }, likes: ['whatever sank last night'] },
  { when: { stat: 'circadian', gte: 0.65 }, likes: ['dim light'], dislikes: ['bright lamps'] },
  { when: { stat: 'circadian', lte: 0.3 }, likes: ['bright mornings'] },
  { when: { stat: 'schooling', gte: 0.6 }, likes: ['a big shoal'], fears: ['being alone'] },
  { when: { stat: 'sociability', lte: 0.3 }, likes: ['a quiet corner'], dislikes: ['crowds'] },
  { when: { stat: 'territoriality', gte: 0.6 }, likes: ['a cave of its own'], dislikes: ['newcomers'] },
  { when: { stat: 'boldness', lte: 0.3 }, likes: ['plenty of cover'], fears: ['sudden shadows'] },
  { when: { fact: 'current', in: ['strong', 'torrent'] }, likes: ['a strong current'] },
  { when: { fact: 'current', is: 'still' }, dislikes: ['strong currents'] },
  { when: { fact: 'niche', is: 'percher' }, likes: ['flat rocks to sit on'] },
  { when: { fact: 'niche', is: 'ambush' }, likes: ['caves and overhangs'] },
  { when: { fact: 'niche', is: 'sifter' }, likes: ['a soft sandy bed'] },
  { when: { fact: 'niche', is: 'drifter' }, likes: ['open water'] },
  { when: { fact: 'niche', is: 'grazer' }, likes: ['rocks with a good film of algae'] },
  { when: { stat: 'aggression', gte: 0.65 }, dislikes: ['long-finned tankmates'] },
  { when: { stat: 'predatoryDrive', gte: 0.6 }, likes: ['the chase'] },
  { when: { size: '<=small' }, fears: ['big mouths'] },
  { when: { fact: 'terrain', is: 'lava' }, likes: ['a fresh lava flow', 'basalt pillars'], dislikes: ['cold draughts'], fears: ['water'] },
  { when: { fact: 'terrain', is: 'sand' }, likes: ['deep, loose sand', 'wind ripples'], dislikes: ['packed sand'], fears: ['rain'] },
  { when: { fact: 'terrain', is: 'nuclear' }, likes: ['clear, warm coolant', 'a blue night-light'], dislikes: ['murky coolant'], fears: ['a lead-lined tank (too dark)'] },
  { when: { fact: 'terrain', is: 'aether' }, likes: ['starlight'], fears: ['being looked at too long'] },
  { when: { fact: 'terrain', is: 'water' }, likes: ['clean water'] },
];

/** Social roles: first match wins. */
export const ROLES = [
  { id: 'leader', label: 'Leader', when: { all: [{ fact: 'boldnessAxis', gte: 0.6 }, { fact: 'sociabilityAxis', gte: 0.5 }] } },
  { id: 'sentinel', label: 'Sentinel', when: { all: [{ stat: 'territoriality', gte: 0.55 }, { fact: 'boldnessAxis', gte: 0.5 }] } },
  { id: 'loner', label: 'Loner', when: { fact: 'sociabilityAxis', lt: 0.35 } },
  { id: 'follower', label: 'Follower', when: true },
];

/** Feeding rhythm from appetite × metabolism. */
export const FEEDING = [
  { upTo: 0.3, text: 'once every other day' },
  { upTo: 0.5, text: 'once a day' },
  { upTo: 0.7, text: 'twice a day' },
  { upTo: 1.01, text: 'little and often' },
];

/** What a terrain's care sheet calls its medium chemistry, by medium. */
export const CHEMISTRY = {
  water: 'pH',
  coolant: 'pH',
  magma: 'flow',
  sand: 'grain',
  void: 'drift',
};

// Word pools for fish3 names. Plain data only -- names.js builds a name from the fish's body and
// its most striking traits, and only ever picks *within* the pool a trait points to.
//
// Rules for adding words (see docs/lore-writing-guide.md, "Name pools"):
// - A word must describe what its key shows: a `jaw.fangs` modifier talks about fangs.
// - Nouns in TAXA must suit that body; every name ends in one, so the body always shows.
// - LATIN roots keep one meaning per key, so the binomials stay learnable.

/**
 * Per body (and hybrid): `genus`, the first half of the binomial, and `nouns`, the last word of
 * the common name. Hybrids without an entry use their first parent's.
 */
export const TAXA = {
  torpedo: { genus: 'Fusichthys', nouns: ['Dart', 'Runner', 'Minnow'] },
  round: { genus: 'Globichthys', nouns: ['Bream', 'Roundfish', 'Pomfret'] },
  disc: { genus: 'Discichthys', nouns: ['Disc', 'Plate', 'Angel'] },
  eel: { genus: 'Anguillops', nouns: ['Eel', 'Ribbon', 'Serpent'] },
  arrow: { genus: 'Sagittichthys', nouns: ['Arrow', 'Pike', 'Gar'] },
  pufferish: { genus: 'Tetraodus', nouns: ['Puffer', 'Toad', 'Balloon'] },
  shark: { genus: 'Squalops', nouns: ['Shark', 'Hound', 'Reaper'] },
  hatchet: { genus: 'Securichthys', nouns: ['Hatchet', 'Axe', 'Blade'] },
  piranha: { genus: 'Serrasalmus', nouns: ['Piranha', 'Fang', 'Ripper'] },
  boxfish: { genus: 'Ostracion', nouns: ['Boxfish', 'Coffer', 'Trunk'] },
  cowfish: { genus: 'Lactophrys', nouns: ['Cowfish', 'Horn-box', 'Coffer'] },
  trigger: { genus: 'Balistops', nouns: ['Trigger', 'Hammer', 'Grinder'] },
  mola: { genus: 'Molops', nouns: ['Mola', 'Sunfish', 'Millstone'] },
  lionfish: { genus: 'Pteroichthys', nouns: ['Lionfish', 'Firefish', 'Turkeyfish'] },
  betta: { genus: 'Bettops', nouns: ['Betta', 'Fighter', 'Duelist'] },
  koi: { genus: 'Cyprinops', nouns: ['Koi', 'Carp', 'Nishiki'] },
  catfish: { genus: 'Siluropsis', nouns: ['Catfish', 'Whisker', 'Bullhead'] },
  angler: { genus: 'Lophiops', nouns: ['Angler', 'Lanternjaw', 'Seadevil'] },
  barracuda: { genus: 'Sphyraenops', nouns: ['Barracuda', 'Lancer', 'Pike'] },
  needle: { genus: 'Belonops', nouns: ['Needlefish', 'Needle', 'Garfish'] },
  swordfish: { genus: 'Xiphops', nouns: ['Swordfish', 'Broadbill', 'Blade'] },
  discus: { genus: 'Symphysodon', nouns: ['Discus', 'Shield', 'Medallion'] },
  butterfly: { genus: 'Chaetodops', nouns: ['Butterflyfish', 'Wingfish', 'Bannerfish'] },
  clown: { genus: 'Amphiprion', nouns: ['Clownfish', 'Anemonefish', 'Jester'] },
  tetra: { genus: 'Characops', nouns: ['Tetra', 'Spark', 'Glint'] },
  guppy: { genus: 'Poecilops', nouns: ['Guppy', 'Millionfish', 'Livebearer'] },
  oarfish: { genus: 'Regalecus', nouns: ['Oarfish', 'Ribbonking', 'Streamer'] },
  sturgeon: { genus: 'Acipenops', nouns: ['Sturgeon', 'Shovelnose', 'Armourback'] },
  coelacanth: { genus: 'Latimerops', nouns: ['Coelacanth', 'Lobefin', 'Old-fin'] },
  blobfish: { genus: 'Psychrolutes', nouns: ['Blobfish', 'Fathead', 'Sculpin'] },
  flyingfish: { genus: 'Exocoetops', nouns: ['Flying fish', 'Glider', 'Skimmer'] },
  knifefish: { genus: 'Gymnotops', nouns: ['Knifefish', 'Ghost-knife', 'Razor'] },
  chompball: { genus: 'Serratetrodon', nouns: ['Chompball', 'Bite-puffer', 'Gnasher'] },
  noodleshark: { genus: 'Squalanguilla', nouns: ['Noodleshark', 'Eelshark', 'Coilhound'] },
  kitefish: { genus: 'Discobalistes', nouns: ['Kitefish', 'Kite', 'Diamondfin'] },
  whiskerkoi: { genus: 'Cyprisilurus', nouns: ['Whiskerkoi', 'Barbel-carp', 'Elder-koi'] },
  moonblob: { genus: 'Molalutes', nouns: ['Moonblob', 'Moon-sag', 'Driftmass'] },
  lancefish: { genus: 'Xiphobelone', nouns: ['Lancefish', 'Lance', 'Spear'] },
  pincushion: { genus: 'Pterotetrodon', nouns: ['Pincushion', 'Spine-ball', 'Thornglobe'] },
  silkkoi: { genus: 'Bettacyprinus', nouns: ['Silk koi', 'Veil-carp', 'Silkfin'] },
  lanternbite: { genus: 'Lophicharax', nouns: ['Lanternbite', 'Glowfang', 'Lampjaw'] },
  jesterbox: { genus: 'Amphiostracion', nouns: ['Jesterbox', 'Motley-box', 'Grinbox'] },
  sawdisc: { genus: 'Symphyserrus', nouns: ['Sawdisc', 'Sawblade', 'Bite-disc'] },
  dragonling: { genus: 'Acipenguilla', nouns: ['Dragonling', 'Wyrm', 'Drake'] },
  gliderhatch: { genus: 'Securexocoetus', nouns: ['Gliderhatch', 'Wing-axe', 'Skimblade'] },
  neonfan: { genus: 'Poecilocharax', nouns: ['Neonfan', 'Glowtail', 'Sparkfan'] },
  plumpike: { genus: 'Globisagitta', nouns: ['Plumpike', 'Round-pike', 'Bulletfish'] },
  fossilcat: { genus: 'Latimerisilurus', nouns: ['Fossilcat', 'Stonewhisker', 'Relic-cat'] },
};

/**
 * Salience keys → the word that leads the name ("Fanged …"). Keys are `field.value` (see
 * salienceOf in names.js for the order they are tried in).
 */
export const MODIFIERS = {
  'relic.mantle': ['Aurora', 'Mantled'],
  'relic.orbit': ['Orbited', 'Attended'],
  'relic.eclipse': ['Eclipsed', 'Black-sun'],
  'relic.revenant': ['Revenant', 'Unburied'],
  'signature.crown': ['Crowned', 'Spine-crowned'],
  'signature.halo': ['Haloed', 'Ringed'],
  'signature.thirdeye': ['Three-eyed', 'Seeing'],
  'signature.runes': ['Rune-lit', 'Inscribed'],
  'signature.embers': ['Ember-wake', 'Smouldering'],
  'signature.voideye': ['Void-eyed', 'Hollow-eyed'],
  'signature.wings': ['Four-winged', 'Winged'],
  'signature.brand': ['Branded', 'Sigiled'],
  'morph.galaxy': ['Galaxy', 'Starfield'],
  'morph.neon': ['Neon', 'Electric'],
  'morph.chrome': ['Chrome', 'Mirror'],
  'morph.ombre': ['Ombré', 'Fading'],
  'morph.split': ['Split', 'Halved'],
  'morph.albino': ['Albino', 'Pale'],
  'morph.leucistic': ['Leucistic', 'White'],
  'morph.melanistic': ['Melanistic', 'Black'],
  'morph.axanthic': ['Axanthic', 'Grey'],
  'morph.ghost': ['Glass', 'Ghost'],
  'morph.xanthic': ['Golden', 'Gilt'],
  'morph.calico': ['Calico', 'Patchwork'],
  'morph.piebald': ['Piebald', 'Pied'],
  'glow.on': ['Glowing', 'Lantern'],
  'lure.on': ['Lure-bearing', 'Lamp-headed'],
  'photophores.on': ['Light-studded', 'Lamp-sided'],
  'jaw.piranha': ['Saw-toothed', 'Biting'],
  'jaw.fangs': ['Fanged', 'Long-toothed'],
  'jaw.gape': ['Gaping', 'Wide-mouthed'],
  'jaw.bill': ['Billed', 'Spear-nosed'],
  'jaw.beak': ['Beaked', 'Shell-cracking'],
  'jaw.sucker': ['Sucker-mouthed', 'Clinging'],
  'jaw.tube': ['Tube-snouted', 'Piping'],
  'jaw.lips': ['Thick-lipped', 'Grazing'],
  'jaw.grin': ['Grinning', 'Smiling'],
  'jaw.underbite': ['Underslung', 'Jutting'],
  'extras.barbels': ['Whiskered', 'Bearded'],
  'extras.horns': ['Horned', 'Two-horned'],
  'extras.nosehorn': ['Unicorn', 'Nose-horned'],
  'extras.cheekspines': ['Cheek-spined', 'Barbed'],
  'extras.scutes': ['Armoured', 'Plated'],
  'dorsal.spiny': ['Spiny', 'Thorn-backed'],
  'dorsal.venom': ['Venomous', 'Stinging'],
  'dorsal.sail': ['Sailfin', 'Sail-backed'],
  'dorsal.crest': ['Crested', 'Plumed'],
  'dorsal.streamer': ['Streaming', 'Pennant'],
  'tail.veil': ['Veiltail', 'Trailing'],
  'tail.lyre': ['Lyretail', 'Harp-tailed'],
  'tail.streamer': ['Streamertail', 'Long-tailed'],
  'tail.sword': ['Swordtail', 'Blade-tailed'],
  'tail.double': ['Twin-tailed', 'Forked'],
  'eyes.telescope': ['Telescope-eyed', 'Stalk-eyed'],
  'eyes.tubular': ['Tube-eyed', 'Upward-gazing'],
  'eyes.bubble': ['Bubble-eyed', 'Blister-eyed'],
  'size.tiny': ['Pygmy', 'Dwarf'],
  'size.huge': ['Great', 'Greater'],
  'size.giant': ['Giant', 'Colossal'],
  'mood.grumpy': ['Scowling', 'Sullen'],
  'mood.sleepy': ['Drowsy', 'Heavy-lidded'],
  'mood.smug': ['Proud', 'Smug'],
  'mood.derpy': ['Cross-eyed', 'Wandering'],
  'mood.happy': ['Bright', 'Cheerful'],
};

/** Salience keys → the body part a compound names ("Ember-finned"). Keys without one use `finned`. */
export const PARTS = {
  jaw: ['jawed', 'toothed'],
  extras: ['headed', 'faced'],
  dorsal: ['backed', 'spined'],
  tail: ['tailed'],
  eyes: ['eyed'],
  pattern: ['banded', 'marked'],
  scales: ['scaled'],
  default: ['finned', 'bellied', 'flanked'],
};

/** Pattern keys get their own compound part, so a spotted fish reads "Ember-spotted". */
export const PATTERN_PARTS = {
  bars: 'barred', stripe: 'striped', spots: 'spotted', mottle: 'mottled', saddle: 'saddled', tiger: 'tiger-striped',
  leopard: 'leopard', dashdot: 'dashed', patches: 'patched', reticulate: 'netted', chevron: 'chevroned',
};

/** Latin-ish roots for the binomial's epithet: by full salience key first, else by its family. */
export const LATIN = {
  'morph.galaxy': ['astro'], 'morph.neon': ['photo'], 'morph.chrome': ['argyro'], 'morph.ombre': ['nephelo'],
  'morph.split': ['dicho'], 'morph.albino': ['leuco'], 'morph.leucistic': ['leuco'], 'morph.melanistic': ['melano'],
  'morph.axanthic': ['polio'], 'morph.ghost': ['hyalo'], 'morph.xanthic': ['chryso'], 'morph.calico': ['poikilo'], 'morph.piebald': ['poikilo'],
  'signature.crown': ['corono'], 'signature.halo': ['cyclo'], 'signature.thirdeye': ['triophthalmo'], 'signature.runes': ['grammato'],
  'signature.embers': ['pyro'], 'signature.voideye': ['keno'], 'signature.wings': ['tetraptero'], 'signature.brand': ['sigilli'],
  'relic.mantle': ['aurori'], 'relic.orbit': ['planeto'], 'relic.eclipse': ['umbri'], 'relic.revenant': ['necro'],
  'skin.ember': ['pyrrho'], 'skin.tangerine': ['pyrrho'], 'skin.coral': ['erythro'], 'skin.rose': ['rhodo'], 'skin.orchid': ['porphyro'],
  'skin.butter': ['xantho'], 'skin.sand': ['psammo'], 'skin.bronze': ['chalco'], 'skin.lime': ['chloro'], 'skin.jade': ['chloro'],
  'skin.teal': ['cyano'], 'skin.lagoon': ['cyano'], 'skin.cobalt': ['cyano'], 'skin.violet': ['iono'], 'skin.slate': ['phaeo'],
  'skin.pewter': ['polio'], 'skin.ink': ['melano'], 'skin.pearl': ['margarito'],
  relic: ['necro', 'aurori', 'umbri'],
  signature: ['corono', 'sigilli', 'pyro'],
  morph: ['chromo', 'leuco', 'melano'],
  glow: ['luci', 'photo'],
  lure: ['lampadi', 'luci'],
  photophores: ['photo', 'stelli'],
  jaw: ['odonto', 'gnatho', 'stomo'],
  extras: ['cerato', 'pogono'],
  dorsal: ['acantho', 'lopho'],
  tail: ['uro', 'cerco'],
  eyes: ['ophthalmo', 'ops'],
  pattern: ['zono', 'stigmo', 'poecilo'],
  size: ['micro', 'mega'],
  mood: ['tristi', 'somni', 'superbi'],
  skin: ['chryso', 'cyano', 'erythro', 'chloro'],
};

/** Epithet endings. */
export const LATIN_ENDS = ['urus', 'ops', 'pterus', 'gaster', 'cephalus', 'ensis', 'oides', 'notus'];

/** Rare and myth titles: "<Name>, the <title>". Keyed by signature or relic id. */
export const TITLES = {
  crown: ['Crowned', 'Spine-King'],
  halo: ['Haloed', 'Ringbearer'],
  thirdeye: ['All-Seeing', 'Third-Eyed'],
  runes: ['Inscribed', 'Rune-Bearer'],
  embers: ['Smouldering', 'Ember-Wake'],
  voideye: ['Void-Gazer', 'Hollow-Eyed'],
  wings: ['Four-Winged', 'Skyward'],
  brand: ['Branded', 'Sigil-Marked'],
  mantle: ['Aurora-Mantled', 'Lightcloak'],
  orbit: ['Attended', 'Centre of Motes'],
  eclipse: ['Eclipse-Born', 'Black-Sun'],
  revenant: ['Revenant', 'Twice-Drowned'],
};

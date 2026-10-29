// fish4's classification tables: a shallow tree (order → family → genus → species → variety)
// laid over fish3's bodies. Genus and species are fish3's own (names-data.js TAXA and the Latin
// epithet), so every fish3 binomial stays as it was; orders and families sit above them.
//
// A family is not only a label: `priors` nudge its members' stats (stats.js), so two fish of one
// family share a temperament a keeper can learn. Priors are small (±0.1): the body and the genes
// still decide.
//
// Adding a body: give it a family in FAMILY_OF (see .claude/skills/extend-fish4).

/** Orders: the broadest split, by way of life. */
export const ORDERS = {
  Velociformes: { label: 'Swift-fins', note: 'Built for open water: streamlined cruisers, skimmers and spear-nosed hunters.' },
  Gemmiformes: { label: 'Jewel-fish', note: 'Deep-bodied and ornamental: the pond, reef and pan fish keepers fall for.' },
  Loricatiformes: { label: 'Armoured fish', note: 'Plates, spines and balloons: fish that would rather not be eaten.' },
  Serpentiformes: { label: 'Ribbon-fish', note: 'Long bodies that swim by waves: eels, knifefish and oarfish.' },
  Abyssiformes: { label: 'Dark-water fish', note: 'Made for pressure and night: lures, soft bodies and big eyes.' },
  Archaeiformes: { label: 'Old-lines', note: 'Living fossils and bottom-sifters whose shape has not changed in an age.' },
};

/** Families, each in one order, with stat priors (deltas on 0..1 stats). */
export const FAMILIES = {
  Cursoridae: { order: 'Velociformes', label: 'Cruisers', priors: { stamina: 0.08, swimSpeed: 0.06, schooling: 0.05 } },
  Dentidae: { order: 'Velociformes', label: 'Toothed hunters', priors: { predatoryDrive: 0.1, aggression: 0.06, swimSpeed: 0.05 } },
  Lancidae: { order: 'Velociformes', label: 'Spear-snouts', priors: { predatoryDrive: 0.06, swimSpeed: 0.08, verticalPref: 0.05 } },
  Scintillidae: { order: 'Gemmiformes', label: 'Sparks', priors: { schooling: 0.1, sociability: 0.08, clutchSize: 0.06, maturationMul: -0.05 } },
  Disculidae: { order: 'Gemmiformes', label: 'Pan-fish', priors: { stressResistance: -0.05, sociability: 0.05, idealPH: -0.04 } },
  Gemmulidae: { order: 'Gemmiformes', label: 'Ornamentals', priors: { curiosity: 0.06, boldness: 0.04 } },
  Ostracopsidae: { order: 'Loricatiformes', label: 'Boxfish', priors: { hardiness: 0.08, swimSpeed: -0.08, territoriality: 0.04 } },
  Inflatidae: { order: 'Loricatiformes', label: 'Balloon-fish', priors: { swimSpeed: -0.06, curiosity: 0.06, appetite: 0.05 } },
  Spinulidae: { order: 'Loricatiformes', label: 'Spine-fans', priors: { boldness: 0.08, energy: -0.05, predatoryDrive: 0.04 } },
  Serpentidae: { order: 'Serpentiformes', label: 'Eels & knives', priors: { circadian: 0.08, verticalPref: -0.06, zoneBreadth: -0.05 } },
  Remigidae: { order: 'Serpentiformes', label: 'Oar-fish', priors: { energy: -0.06, lifespan: 0.06, stressResistance: -0.04 } },
  Lucernidae: { order: 'Abyssiformes', label: 'Lantern-jaws', priors: { predatoryDrive: 0.06, energy: -0.08, idealTempC: -0.04 } },
  Gelatidae: { order: 'Abyssiformes', label: 'Soft-bodies', priors: { energy: -0.1, stamina: -0.06, stressResistance: 0.06 } },
  Fossilidae: { order: 'Archaeiformes', label: 'Living fossils', priors: { lifespan: 0.12, maturationMul: 0.08, hardiness: 0.05 } },
  Barbatidae: { order: 'Archaeiformes', label: 'Whiskered sifters', priors: { dietBreadth: 0.06, sociability: 0.04, hardiness: 0.04 } },
};

/** Every fish3 body's family. Hybrids not listed here take their first parent's family. */
export const FAMILY_OF = {
  torpedo: 'Cursoridae', flyingfish: 'Cursoridae',
  shark: 'Dentidae', piranha: 'Dentidae', barracuda: 'Dentidae',
  arrow: 'Lancidae', needle: 'Lancidae', swordfish: 'Lancidae',
  tetra: 'Scintillidae', guppy: 'Scintillidae', hatchet: 'Scintillidae',
  disc: 'Disculidae', discus: 'Disculidae', butterfly: 'Disculidae',
  round: 'Gemmulidae', koi: 'Gemmulidae', betta: 'Gemmulidae', clown: 'Gemmulidae',
  boxfish: 'Ostracopsidae', cowfish: 'Ostracopsidae', trigger: 'Ostracopsidae',
  pufferish: 'Inflatidae', mola: 'Inflatidae',
  lionfish: 'Spinulidae',
  eel: 'Serpentidae', knifefish: 'Serpentidae',
  oarfish: 'Remigidae',
  angler: 'Lucernidae',
  blobfish: 'Gelatidae',
  coelacanth: 'Fossilidae', sturgeon: 'Fossilidae',
  catfish: 'Barbatidae',
};

/** Variety names from a colour morph (`var. galaxy`); a pure line instead gives `line N`. */
export const VARIETY_OF_MORPH = {
  albino: 'albina', leucistic: 'nivea', melanistic: 'nigra', axanthic: 'caerulea', ghost: 'spectralis',
  xanthic: 'aurea', piebald: 'variegata', calico: 'tricolor',
  galaxy: 'stellata', neon: 'fulgens', chrome: 'argentea', ombre: 'umbrata', split: 'dimidiata',
};

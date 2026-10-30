// Where fish4's fish come from: terrain → region → niche. Plain data; ecotype.js rolls from it.
//
//   terrain  the medium a fish lives in (water, magma, sand, reactor coolant, the void). Fish of
//            two terrains cannot breed or share a tank.
//   region   a place in the Seedfall's sky: a reef, a gas giant's cloud sea, a magma sea, a dune
//            sea, a starbase cooling lake. Each has a palette, a mutation pressure, its own sports
//            and 2–4 niches.
//   niche    a guild (grazer, school, ambush, …): the bodies that fill it there, and how the
//            guild leans (weight multipliers on look fields, shifts of the locus bells).
//
// Every multiplier is `{ field: { choice: × } }` over genome fields (fish3's and fish4's). Niche
// `loci` shift a locus bell's centre in allele steps (±). Append only to every list: ids are
// genome digits (genome.js).

/** Terrains. `tempC` is the medium's band (null: fish3's water numbers); `weight` the default odds. */
export const TERRAINS = {
  water: { label: 'Water', medium: 'water', mediumLabel: 'water', tempC: null, weight: 64, note: 'Rivers, reefs, open ocean, a gas giant\'s cloud seas and the oceans under moon ice.' },
  lava: { label: 'Lava', medium: 'magma', mediumLabel: 'molten rock', tempC: [850, 1250], weight: 12, note: 'Molten seas and black-smoker vent fields: fish with stone shells and glowing seams.' },
  sand: { label: 'Sand', medium: 'sand', mediumLabel: 'sand', tempC: [35, 70], weight: 12, note: 'Dune seas and fused-glass flats: fish that swim through sand as if it were water.' },
  nuclear: { label: 'Nuclear', medium: 'coolant', mediumLabel: 'reactor coolant', tempC: [40, 90], weight: 12, note: 'A starbase cooling lake that grew its own fish, and warm isotope springs: radiant and harmless.' },
  aether: { label: 'Aether', medium: 'void', mediumLabel: 'open void', tempC: [-271, -240], weight: 0, locked: true, note: 'The drift between stars. Locked: unlocked by the frontier preset or the game.' },
};
export const TERRAIN_IDS = Object.keys(TERRAINS);

/**
 * Guilds, shared by every region. `weights` lean the look; `loci` shift the gene bells (allele
 * steps); `character` is a word the dossier uses.
 */
export const NICHES = {
  unmapped: { label: 'Unmapped', weights: {}, loci: {} },
  grazer: {
    label: 'Grazer',
    note: 'crops algae, crust and film off every surface',
    weights: { jaw: { beak: 2, lips: 2, sucker: 1.5, fangs: 0.3 }, size: { small: 1.2, medium: 1.3 }, mood: { content: 1.4 } },
    diet: { herbivore: 2.5, durophage: 1.5, detritivore: 0.3, planktivore: 0.3, piscivore: 0.15, carnivore: 0.2 },
    loci: { metabolism: 2, aggression: -2, sociability: 1 },
  },
  school: {
    label: 'Schooler',
    note: 'moves in a shoal and never strays far from it',
    weights: { size: { tiny: 2.2, small: 2, large: 0.4, huge: 0.1, giant: 0.05 }, tail: { fork: 2, lunate: 1.3 }, pattern: { stripe: 1.6, plain: 1.2 }, chonk: { lean: 1.5, round: 0.5 } },
    loci: { sociability: 4, boldness: -1, fecundity: 2 },
  },
  ambush: {
    label: 'Ambusher',
    note: 'waits, perfectly still, then strikes',
    weights: { size: { large: 1.6, huge: 1.4, tiny: 0.4 }, mood: { grumpy: 1.6 }, pattern: { mottle: 1.8, saddle: 1.4 }, tail: { round: 1.5 }, jaw: { gape: 2, fangs: 1.5 } },
    diet: { piscivore: 2, carnivore: 2, detritivore: 0.1, durophage: 0.3, herbivore: 0.2, planktivore: 0.2 },
    loci: { aggression: 2, energy: -3, sociability: -2 },
  },
  pursuit: {
    label: 'Pursuer',
    note: 'runs its food down in open water',
    weights: { tail: { lunate: 2.2, fork: 2, round: 0.4, veil: 0.2 }, size: { large: 1.5, huge: 1.5, giant: 1.2, tiny: 0.3 }, chonk: { lean: 1.8, round: 0.3 } },
    diet: { piscivore: 2.5, carnivore: 1.5, detritivore: 0.1, durophage: 0.2, herbivore: 0.2, planktivore: 0.2 },
    loci: { energy: 4, vigor: 1, aggression: 1 },
  },
  sifter: {
    label: 'Sifter',
    note: 'sifts the bottom for what has settled',
    weights: { extras: { barbels: 2.5 }, snout: { under: 2 }, eye: { small: 1.4 } },
    diet: { detritivore: 8, herbivore: 0.5, durophage: 0.3, planktivore: 0.2, piscivore: 0.2, carnivore: 0.2 },
    loci: { zone: -4, energy: -1, sociability: 1 },
  },
  drifter: {
    label: 'Drifter',
    note: 'hangs in the current and lets the food come',
    weights: { tail: { veil: 1.5, round: 1.5, fork: 0.6 }, chonk: { plump: 1.4, round: 1.4 }, mood: { sleepy: 1.5, content: 1.3 } },
    loci: { energy: -4, longevity: 2, resilience: 1 },
  },
  percher: {
    label: 'Percher',
    note: 'sits on a perch it has claimed and watches',
    weights: { pectoral: { fan: 2, lobed: 2, round: 1.3 }, eye: { big: 1.5 }, eyeMount: { telescope: 1.6 } },
    loci: { zone: -3, boldness: 2, aggression: 1 },
  },
  burrower: {
    label: 'Burrower',
    note: 'lives buried, with only its eyes showing',
    weights: { eye: { small: 2 }, dorsal: { low: 2, none: 1.5, sail: 0.3 }, pattern: { mottle: 1.6 }, tail: { truncate: 1.5, round: 1.3 } },
    loci: { zone: -5, energy: -2, resilience: 2 },
  },
  glider: {
    label: 'Glider',
    note: 'glides on wide fins between currents',
    weights: { pectoral: { glider: 3, wing: 2.5, long: 1.5 }, tail: { fork: 1.6 }, chonk: { lean: 1.5 } },
    loci: { zone: 5, energy: 1, boldness: 1 },
  },
  lurker: {
    label: 'Lurker',
    note: 'keeps to the dark and brings its own light',
    weights: { extras: { lure: 2.5 }, eye: { big: 1.5 }, glow: { spots: 2, edge: 1.5 }, skin: { ink: 2, slate: 1.4 }, mood: { grumpy: 1.4 } },
    loci: { energy: -3, aggression: 2, zone: -2, longevity: 2 },
  },
  ornament: {
    label: 'Show-fin',
    note: 'all display: fins, colour and attitude',
    weights: { dorsal: { sail: 1.6, streamer: 1.6, crest: 1.4 }, tail: { veil: 1.6, lyre: 1.6, double: 1.3 }, finPattern: { spotted: 1.4, banded: 1.4, tipped: 1.4 }, finTint: { accent: 1.6 } },
    loci: { fertility: 2, boldness: 1, resilience: -1 },
  },
};
export const NICHE_IDS = Object.keys(NICHES);

/**
 * Regions. `niches`: niche id → `{ bodies: { bodyOrForm: weight }, weights? }` (weights stack on
 * the niche's own). `palette`: multipliers over fish3 swatches (`skin`, `markColor`) and fish4
 * pigments (`pigment`, `markPigment`), with `native` = the odds a fish wears a pigment at all.
 * `mutation` scales the chaos and sport odds; `sports` is the region's sport table.
 */
export const REGIONS = {
  unmapped: { terrain: 'water', label: 'Unmapped waters', niches: {}, palette: {}, mutation: 1 },
  riverlands: {
    terrain: 'water',
    label: 'The Riverlands',
    note: 'clear, slow rivers through the forest moon\'s lowlands',
    niches: {
      school: { bodies: { tetra: 3, guppy: 2, hatchet: 2, torpedo: 2, archerfish: 1.5 } },
      sifter: { bodies: { catfish: 3, loach: 3, goby: 1 } },
      ambush: { bodies: { gar: 2, arrow: 2, piranha: 1.5, knifefish: 1 } },
      ornament: { bodies: { betta: 2, koi: 2, disc: 1.5, discus: 1.5, round: 1 } },
    },
    palette: { skin: { jade: 1.5, lime: 1.4, bronze: 1.4, sand: 1.3, tangerine: 1.2 }, markColor: { soot: 1.4, butter: 1.2 } },
    weights: { scales: { fine: 1.3 } },
    loci: { thermal: 2 }, // warm lowland water
    mutation: 1,
  },
  reef: {
    terrain: 'water',
    label: 'The Glass Reef',
    note: 'a warm reef ringing the station\'s equatorial island',
    niches: {
      grazer: { bodies: { parrotfish: 3, tang: 3, butterfly: 2, boxfish: 1, cowfish: 1 } },
      ornament: { bodies: { clown: 3, lionfish: 1.5, trigger: 1.5, pufferish: 1.5 } },
      ambush: { bodies: { grouper: 3, lionfish: 1, eel: 2, shark: 0.5 } },
      percher: { bodies: { goby: 3, cowfish: 1 } },
    },
    palette: { skin: { coral: 1.6, tangerine: 1.4, butter: 1.5, cobalt: 1.4, orchid: 1.3, violet: 1.3 }, markColor: { chalk: 1.5, soot: 1.2, butter: 1.3 } },
    loci: { thermal: 2 }, // warm shallow water
    mutation: 1,
  },
  pelagic: {
    terrain: 'water',
    label: 'The Blue Open',
    note: 'open ocean far from any shore',
    niches: {
      pursuit: { bodies: { shark: 2, barracuda: 2, swordfish: 2, torpedo: 1 } },
      school: { bodies: { torpedo: 2, flyingfish: 2, needle: 2 } },
      drifter: { bodies: { mola: 2, opah: 2, oarfish: 0.5 } },
    },
    palette: { skin: { cobalt: 1.6, lagoon: 1.5, pewter: 1.4, slate: 1.3 }, markColor: { chalk: 1.4 } },
    weights: { belly: { white: 2, pale: 1.5 } },
    loci: { thermal: -1 }, // open water, a touch cool
    mutation: 0.9,
  },
  deep: {
    terrain: 'water',
    label: 'The Deep',
    note: 'the cold dark under the thermocline',
    niches: {
      lurker: { bodies: { angler: 3, eel: 1 } },
      drifter: { bodies: { blobfish: 3, oarfish: 1.5 } },
      sifter: { bodies: { coelacanth: 2, sturgeon: 1.5, catfish: 1 } },
    },
    palette: { skin: { ink: 1.8, slate: 1.5, violet: 1.3, rose: 1.2 }, markColor: { lagoon: 1.4, violet: 1.3 } },
    weights: { glow: { spots: 2, edge: 1.5 }, eye: { big: 1.4 } },
    loci: { thermal: -3 }, // cold under pressure
    mutation: 1.1,
  },
  nebula: {
    terrain: 'water',
    label: 'The Cloud Seas',
    note: 'warm water-cloud layers deep in a gas giant\'s atmosphere',
    niches: {
      glider: { bodies: { flyingfish: 3, hatchet: 2, disc: 1, mola: 1 } },
      drifter: { bodies: { mola: 2, opah: 2, blobfish: 1, oarfish: 1.5 } },
      school: { bodies: { needle: 2, tetra: 1 } },
    },
    palette: { skin: { violet: 1.8, orchid: 1.7, cobalt: 1.4, rose: 1.4, pearl: 1.2 }, markColor: { chalk: 1.4, violet: 1.3, coral: 1.2 } },
    weights: { finTint: { clear: 1.5, light: 1.4 } },
    loci: { thermal: 1 }, // mild cloud seas
    mutation: 1.3,
    sports: { morph: { galaxy: 3 } },
  },
  icemoon: {
    terrain: 'water',
    label: 'Under the Ice',
    note: 'the black ocean under an ice moon\'s crust, warmed from below',
    niches: {
      drifter: { bodies: { oarfish: 2, blobfish: 2 } },
      lurker: { bodies: { angler: 2, coelacanth: 1 } },
      school: { bodies: { hatchet: 2, tetra: 1, needle: 1 } },
    },
    palette: { skin: { pearl: 1.8, lagoon: 1.5, teal: 1.4, slate: 1.3 }, markColor: { chalk: 1.5, lagoon: 1.3 } },
    weights: { glow: { spots: 1.8, edge: 1.4 } },
    loci: { thermal: -4 }, // ocean under the ice
    mutation: 1.15,
    sports: { geneA: { ghost: 3 } },
  },
  magmasea: {
    terrain: 'lava',
    label: 'The Magma Sea',
    note: 'an open sea of molten rock on a young world, crusted and cracking',
    niches: {
      school: { bodies: { emberdart: 4 } },
      pursuit: { bodies: { pyreel: 2, emberdart: 1, barracuda: 0.6 } },
      grazer: { bodies: { cinderback: 3 } },
    },
    palette: { native: 0.85, pigment: { magma: 2, obsidian: 1.6, cinder: 1.5, sulfur: 1.2 }, markPigment: { magma: 2, sulfur: 1.6 }, skin: { ember: 2, tangerine: 1.5, ink: 1.4 } },
    weights: { glow: { spots: 2, edge: 2.2, full: 1.2 }, scales: { plates: 1.6, sandpaper: 1.4 } },
    mutation: 1.2,
    sports: { glow: { full: 2 }, scales: { plates: 2 } },
  },
  ventfields: {
    terrain: 'lava',
    label: 'The Vent Fields',
    note: 'black-smoker chimneys where lava meets a cold ocean floor',
    niches: {
      grazer: { bodies: { cinderback: 3 } },
      ambush: { bodies: { slagjaw: 3, pyreel: 1 } },
      lurker: { bodies: { slagjaw: 1, angler: 1 } },
    },
    palette: { native: 0.85, pigment: { basalt: 1.8, obsidian: 1.6, ash: 1.4 }, markPigment: { magma: 1.6, sulfur: 1.4, cinder: 1.3 }, skin: { ink: 1.6, slate: 1.4 } },
    weights: { scales: { plates: 1.8, sandpaper: 1.5 }, damage: { warts: 1.4 } },
    mutation: 1.1,
    sports: { glow: { edge: 2 } },
  },
  dunesea: {
    terrain: 'sand',
    label: 'The Dune Sea',
    note: 'a desert world\'s fine, flowing sand, swum like water',
    niches: {
      school: { bodies: { dunefin: 4 } },
      burrower: { bodies: { burrowmaw: 3 } },
      percher: { bodies: { sandskipper: 3 } },
    },
    palette: { native: 0.85, pigment: { dune: 2, ochre: 1.8, sandstone: 1.5, terracotta: 1.2 }, markPigment: { terracotta: 1.8, ochre: 1.5 }, skin: { sand: 2, bronze: 1.6 } },
    weights: { pattern: { mottle: 1.6, saddle: 1.4 }, belly: { pale: 1.6 } },
    mutation: 1,
    sports: { pattern: { reticulate: 2 } },
  },
  glassflats: {
    terrain: 'sand',
    label: 'The Glass Flats',
    note: 'plains of sand fused to glass by an old impact, still glittering',
    niches: {
      drifter: { bodies: { glassback: 4 } },
      percher: { bodies: { sandskipper: 2 } },
      burrower: { bodies: { burrowmaw: 2, dunefin: 1 } },
    },
    palette: { native: 0.85, pigment: { glass: 2.4, desertrose: 1.6, dune: 1.3 }, markPigment: { glass: 1.6, desertrose: 1.6 }, skin: { pearl: 1.8, rose: 1.4 } },
    weights: { scales: { plates: 1.6 }, finTint: { clear: 2 } },
    mutation: 1.1,
    sports: { iridescence: { shimmer: 2 } },
  },
  reactorlake: {
    terrain: 'nuclear',
    label: 'The Cooling Lake',
    note: 'a starbase\'s reactor cooling lake that, left alone for a century, grew its own fish',
    niches: {
      school: { bodies: { rodfish: 4, tetra: 1 } },
      drifter: { bodies: { glowbelly: 3 } },
      ornament: { bodies: { quarkling: 3, guppy: 1 } },
    },
    palette: { native: 0.85, pigment: { cherenkov: 2.2, uraniumglass: 1.8, radium: 1.5 }, markPigment: { cherenkov: 1.8, radium: 1.6, isotopeamber: 1.2 }, skin: { lagoon: 1.6, lime: 1.5 } },
    weights: { glow: { spots: 2.4, edge: 2.2, full: 1.4 } },
    mutation: 1.6,
    sports: { morph: { neon: 3 }, eyeColor2: { sky: 2, moss: 2 }, signature: { thirdeye: 2 } },
  },
  isotopesprings: {
    terrain: 'nuclear',
    label: 'The Isotope Springs',
    note: 'warm, faintly glowing springs on a moon with a radioactive core',
    niches: {
      sifter: { bodies: { isotail: 2, catfish: 1 } },
      drifter: { bodies: { glowbelly: 2 } },
      ornament: { bodies: { quarkling: 3 } },
    },
    palette: { native: 0.85, pigment: { isotopeamber: 2, thorium: 1.8, radium: 1.5, uraniumglass: 1.2 }, markPigment: { isotopeamber: 1.6, cherenkov: 1.5 }, skin: { butter: 1.5, lime: 1.4 } },
    weights: { glow: { spots: 2, edge: 1.6 } },
    mutation: 1.4,
    sports: { morph: { neon: 2 }, eyeColor2: { amber: 2 } },
  },
  voiddrift: {
    terrain: 'aether',
    label: 'The Void Drift',
    note: 'the between-stars: fish that swim on nothing at all',
    niches: {
      drifter: { bodies: { mola: 1, oarfish: 1, blobfish: 1, opah: 1 } },
      glider: { bodies: { flyingfish: 1, hatchet: 1 } },
    },
    palette: { native: 0.9, pigment: { voidink: 2, starlight: 1.5 }, markPigment: { starlight: 2 } },
    weights: { glow: { full: 2, edge: 2 } },
    mutation: 1.8,
    sports: { morph: { galaxy: 4 } },
  },
};
export const REGION_IDS = Object.keys(REGIONS);
export const regionsOf = (terrain) => REGION_IDS.filter((id) => id !== 'unmapped' && REGIONS[id].terrain === terrain);

/** The temperature band of a terrain (°C), or null for fish3's water numbers. */
export const tempBandOf = (terrain) => TERRAINS[terrain]?.tempC ?? null;

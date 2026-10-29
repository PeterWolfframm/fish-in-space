// fish4's text library: plain JSON in a module (the studio and the Haiku text pass can extend it).
// Each entry: { id, pool, when, priority?, lines: [...] }.
//   pool      tagline (one line under the name), origin (where it comes from), codex (a fact),
//             care (a keeper's note), quote (something a keeper or scientist said)
//   when      a rules.js condition over the fish's stats, loci, facts, fields, features, tier and
//             size; facts include terrain, region, niche, medium, heat, and the character's
//             archetype, role and the axes (boldnessAxis, …)
//   priority  higher wins before specificity (default 0)
// The most specific matching entry wins; the line within it is picked by the fish's own key.
// Tokens: {name} {common} {binomial} {archetype} {role} {trait} {trait2} {quirk} {region} {niche}
//         {nicheNote} {terrain} {medium} {tempC} {school} {lifespan} {likes} {fear} {diet}
// Tone: Seedfall. Hopeful, warm, a little cheeky. Nuclear fish are radiant and harmless.

export default [
  // --- taglines ----------------------------------------------------------------------------------
  { id: 'tag-any', pool: 'tagline', when: true, lines: ['A {trait} {archetype}.', 'Quite {trait}, and a little {trait2}.'] },
  { id: 'tag-leader', pool: 'tagline', when: { fact: 'role', is: 'leader' }, lines: ['Where it turns, the shoal turns.', 'A {trait} {archetype} with a following.'] },
  { id: 'tag-loner', pool: 'tagline', when: { fact: 'role', is: 'loner' }, lines: ['Happiest with a corner to itself.', 'A {trait} {archetype} who keeps its own counsel.'] },
  { id: 'tag-gossip', pool: 'tagline', when: { fact: 'archetype', is: 'gossip' }, lines: ['Knows everyone by name. Tells everyone everything.'] },
  { id: 'tag-scholar', pool: 'tagline', when: { fact: 'archetype', is: 'scholar' }, lines: ['Has read every pebble in the tank.'] },
  { id: 'tag-showoff', pool: 'tagline', when: { fact: 'archetype', is: 'showoff' }, lines: ['Swims best with an audience.'] },
  { id: 'tag-monk', pool: 'tagline', when: { fact: 'archetype', is: 'monk' }, lines: ['Found the one good spot. Stays there.'] },
  { id: 'tag-lava', pool: 'tagline', when: { fact: 'terrain', is: 'lava' }, lines: ['Swims through rock the way you swim through water.', 'A {trait} {archetype} of the molten seas.'] },
  { id: 'tag-lava-armour', pool: 'tagline', when: { all: [{ fact: 'terrain', is: 'lava' }, { stat: 'armour', gte: 0.55 }] }, lines: ['Wears its own cooled crust like a coat.'] },
  { id: 'tag-sand', pool: 'tagline', when: { fact: 'terrain', is: 'sand' }, lines: ['Swims through dunes like they were water.', 'A {trait} {archetype} of the sand seas.'] },
  { id: 'tag-sand-burrow', pool: 'tagline', when: { all: [{ fact: 'terrain', is: 'sand' }, { stat: 'burrowing', gte: 0.55 }] }, lines: ['Two eyes on a dune. The rest is somewhere below.'] },
  { id: 'tag-nuclear', pool: 'tagline', when: { fact: 'terrain', is: 'nuclear' }, lines: ['Glows. Harms nothing. Hums a little.', 'A {trait} {archetype} of the cooling lakes.'] },
  { id: 'tag-nuclear-glow', pool: 'tagline', when: { all: [{ fact: 'terrain', is: 'nuclear' }, { stat: 'luminosity', gte: 0.6 }] }, lines: ['Brings its own light to every room.'] },
  { id: 'tag-aether', pool: 'tagline', when: { fact: 'terrain', is: 'aether' }, priority: 1, lines: ['Swims between stars, mostly.'] },
  { id: 'tag-myth', pool: 'tagline', when: { tier: 'myth' }, priority: 2, lines: ['Some fish are caught. This one was found.'] },

  // --- origin ------------------------------------------------------------------------------------
  { id: 'origin-any', pool: 'origin', when: true, lines: ['A {niche} from {region}: {nicheNote}.'] },
  { id: 'origin-unmapped', pool: 'origin', when: { fact: 'region', is: 'unmapped' }, lines: ['From waters nobody has charted yet.'] },
  { id: 'origin-riverlands', pool: 'origin', when: { fact: 'region', is: 'riverlands' }, lines: ['From the Riverlands, where the water still remembers the rain.'] },
  { id: 'origin-reef', pool: 'origin', when: { fact: 'region', is: 'reef' }, lines: ['From the Glass Reef, bright as a stained window.'] },
  { id: 'origin-pelagic', pool: 'origin', when: { fact: 'region', is: 'pelagic' }, lines: ['From the Blue Open, where there is no bottom and no walls.'] },
  { id: 'origin-deep', pool: 'origin', when: { fact: 'region', is: 'deep' }, lines: ['From the Deep, where the only light is the light you bring.'] },
  { id: 'origin-nebula', pool: 'origin', when: { fact: 'region', is: 'nebula' }, lines: ["From the Cloud Seas of a gas giant, where the water hangs in the sky."] },
  { id: 'origin-icemoon', pool: 'origin', when: { fact: 'region', is: 'icemoon' }, lines: ['From the ocean under a moon’s ice: dark, cold, and very patient.'] },
  { id: 'origin-magmasea', pool: 'origin', when: { fact: 'region', is: 'magmasea' }, lines: ['From the Magma Sea, where the waves glow at night.'] },
  { id: 'origin-ventfields', pool: 'origin', when: { fact: 'region', is: 'ventfields' }, lines: ['From the Vent Fields, where black smokers raise chimneys of new rock.'] },
  { id: 'origin-dunesea', pool: 'origin', when: { fact: 'region', is: 'dunesea' }, lines: ["From the Dune Sea, a desert world's fine sand, swum like water."] },
  { id: 'origin-glassflats', pool: 'origin', when: { fact: 'region', is: 'glassflats' }, lines: ['From the Glass Flats, where lightning fused the plains to silica.'] },
  { id: 'origin-reactorlake', pool: 'origin', when: { fact: 'region', is: 'reactorlake' }, lines: ["From a starbase's cooling lake, which grew its own fish and was delighted about it."] },
  { id: 'origin-isotopesprings', pool: 'origin', when: { fact: 'region', is: 'isotopesprings' }, lines: ['From the Isotope Springs on a quiet moon, warm and softly glowing.'] },
  { id: 'origin-voiddrift', pool: 'origin', when: { fact: 'region', is: 'voiddrift' }, lines: ['From the Void Drift. Nobody is sure how it got here.'] },

  // --- codex: a fact a scientist would note ---------------------------------------------------------
  { id: 'codex-any', pool: 'codex', when: true, lines: ['A {diet}; it {quirk}.', 'Keepers report that it {quirk}.'] },
  { id: 'codex-school', pool: 'codex', when: { stat: 'schooling', gte: 0.6 }, lines: ['Schools in groups of about {school}; alone, it frets.'] },
  { id: 'codex-night', pool: 'codex', when: { stat: 'circadian', gte: 0.7 }, lines: ['Most active after dark, when it {quirk}.'] },
  { id: 'codex-old', pool: 'codex', when: { stat: 'lifespan', gte: 0.55 }, lines: ['Lives about {lifespan}; old ones are calmer, and wiser about the food.'] },
  { id: 'codex-lava', pool: 'codex', when: { fact: 'terrain', is: 'lava' }, lines: ['Keeps to {tempC} °C rock; below that it stiffens, and sulks.', 'Its skin is a crust that cracks and heals as it swims.'] },
  { id: 'codex-sand', pool: 'codex', when: { fact: 'terrain', is: 'sand' }, lines: ['Swims by fluidising the sand ahead of it, then slipping through.', 'Breathes through the gaps between grains; sealed sand would suffocate it.'] },
  { id: 'codex-nuclear', pool: 'codex', when: { fact: 'terrain', is: 'nuclear' }, lines: ['Its glow is Cherenkov light, and perfectly safe to watch.', 'Feeds on what the coolant carries, and leaves it cleaner.'] },
  { id: 'codex-nuclear-glow', pool: 'codex', when: { all: [{ fact: 'terrain', is: 'nuclear' }, { stat: 'luminosity', gte: 0.6 }] }, lines: ['Glows brighter when it is happy; a dim one wants company.'] },

  // --- care -----------------------------------------------------------------------------------------
  { id: 'care-any', pool: 'care', when: true, lines: ['Keep in {medium} at about {tempC} °C; it likes {likes}.'] },
  { id: 'care-school', pool: 'care', when: { stat: 'schooling', gte: 0.6 }, lines: ['Keep at least {school} together, at about {tempC} °C.'] },
  { id: 'care-shy', pool: 'care', when: { stat: 'boldness', lte: 0.3 }, lines: ['Give it cover; it fears {fear}.'] },
  { id: 'care-temper', pool: 'care', when: { stat: 'aggression', gte: 0.65 }, lines: ['A fiery fish: no long fins in its tank, and room to patrol.'] },
  { id: 'care-lava', pool: 'care', priority: 1, when: { fact: 'terrain', is: 'lava' }, lines: ['Needs a magma tank at about {tempC} °C. Never, ever add water.'] },
  { id: 'care-sand', pool: 'care', priority: 1, when: { fact: 'terrain', is: 'sand' }, lines: ['Needs a deep bed of loose, dry sand at about {tempC} °C; rake it now and then.'] },
  { id: 'care-nuclear', pool: 'care', priority: 1, when: { fact: 'terrain', is: 'nuclear' }, lines: ['Needs a coolant tank at about {tempC} °C. Shielding optional; it is the friendliest glow aboard.'] },

  // --- quotes -----------------------------------------------------------------------------------------
  { id: 'quote-any', pool: 'quote', when: true, lines: ['“It {quirk}. Every single day.” — a keeper', '“{trait}? That is putting it kindly.” — a keeper'] },
  { id: 'quote-gossip', pool: 'quote', when: { fact: 'archetype', in: ['gossip', 'socialite'] }, lines: ['“By the second day it knew the whole tank. By the third, the whole tank knew it.” — a keeper'] },
  { id: 'quote-hermit', pool: 'quote', when: { fact: 'archetype', in: ['hermit', 'monk'] }, lines: ['“We did not see it for a week. It was fine. It was thinking.” — a keeper'] },
  { id: 'quote-lava', pool: 'quote', when: { fact: 'terrain', is: 'lava' }, lines: ['“The first time it surfaced, it set the net on fire. We use a ceramic one now.” — a vent-field ranger'] },
  { id: 'quote-sand', pool: 'quote', when: { fact: 'terrain', is: 'sand' }, lines: ['“You do not see the dune move. Then you see the dune blink.” — a desert surveyor'] },
  { id: 'quote-nuclear', pool: 'quote', when: { fact: 'terrain', is: 'nuclear' }, lines: ['“The engineers named them. Then they asked to keep them.” — a starbase quartermaster', '“Best night-light on the station.” — a cadet'] },
  { id: 'quote-myth', pool: 'quote', when: { tier: 'myth' }, priority: 2, lines: ['“I have bred fish for forty years. I have never seen one like this.” — an old breeder'] },
];

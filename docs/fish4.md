# fish4: the procedural fish generator

fish4 (`src/v4/fish/`) is PixGen's fourth fish generator. It keeps fish3's painter and every
fish3 field, and adds:

- **places:** terrain → region → niche → clade (species) → individual, so fish cluster into kinds;
- **four terrains on by default:** water, lava, sand and nuclear (aether is locked);
- **20 new bodies (`form`)** and terrain **pigments**;
- **15 gene loci** and **35 stats** with evidence;
- **a character** (personality, archetype, quirks, likes, care, story) read off the genome;
- **rarity, breeding, economy and a pacing simulator**;
- **five procgen features:** links, biome palettes, the aesthetic guard, balanced batches and
  mutation pressure;
- **params** with a schema, presets and a CLI.

Related docs:

- [fish4-params.md](fish4-params.md): every knob
- [fish4-stats.md](fish4-stats.md): the 35 stats and the loci
- [fish4-character.md](fish4-character.md): character and compatibility
- [fish4-roadmap.md](fish4-roadmap.md): what comes next

## Using it

```js
import fish4 from './src/v4/fish/index.js';

const set = fish4.fromSeed('dock-7');                 // default params: ecotype
const lava = fish4.fromSeed('dock-7', 'ecotype', { terrain: 'lava' });   // pin the place
const shop = fish4.batch('shop:day-3', 12, 'seedfall');                  // a balanced batch

fish4.character(set);       // personality, archetype, quirks, likes, care, story …
fish4.blurb(set);           // "A placid, languid drifter from the Isotope Springs; sparkles at its friends."
fish4.stats(set);           // 35 stats, each with `because`
fish4.rarityOf(set);        // points, tier, breakdown
fish4.breed(a, b, 'seed');  // child, events
fish4.compatibility(a, b);  // 0..1 with reasons
fish4.frame(set, 'swim', 0) // pixels
```

From the CLI:

```sh
node cli/forge.mjs fish4 --count 24 --contact --set terrain=lava
node cli/forge.mjs fish4 --params seedfall --batch --count 12 --dossier
```

`params` can be a preset id, an object of overrides (merged onto its `base` preset), or nothing.
The default is `ecotype`.

## The ecotype roll (`ecotype.js`)

### 1. Place: `placeOf(seed, P, pin)`, band 5000

This step picks the terrain, then the region, the niche and the clade.

- **Terrain** odds come from `terrainWeights(P)`. By default they are water 64, lava 12, sand 12
  and nuclear 12. Aether is locked; `unlocked: ['aether']` opens it.
- **Region** and **niche** odds are multiplied by `P.regions` and `P.niches`.
- **Clade** is one of `k0 … k{speciesPerNiche-1}`, with Zipf weights `1/(k+1)^zipf`.

A `pin` fixes any level, and the levels below it roll inside it. A pinned region implies its
terrain.

| Terrain | Medium | Regions (niches) |
|---|---|---|
| water | water | **riverlands** (school, sifter, ambush, ornament), **reef** (grazer, ornament, ambush, percher), **pelagic** (pursuit, school, drifter), **deep** (lurker, drifter, sifter), **nebula**, the cloud seas of a gas giant (glider, drifter, school), **icemoon**, the ocean under moon ice (drifter, lurker, school) |
| lava | magma, 850–1250 °C | **magmasea** (school, pursuit, grazer), **ventfields** (grazer, ambush, lurker) |
| sand | sand, 35–70 °C | **dunesea** (school, burrower, percher), **glassflats** (drifter, percher, burrower) |
| nuclear | coolant, 40–90 °C | **reactorlake**, a starbase cooling lake that grew its own fish (school, drifter, ornament), **isotopesprings** (sifter, drifter, ornament) |
| aether | void, locked | **voiddrift** (drifter, glider) |

Nuclear fish are radiant and harmless: Seedfall's engineers keep them as a point of pride.

### 2. Species: `protoOf(place, P, weightOf)`, band 5100

Every `(region, niche, clade)` has a **prototype**, rolled once from the seed
`proto:region/niche/clade`. The prototype is the species.

- **Body.** The niche's clades share its body pool through a golden-ratio sequence over the
  cumulative odds, so four clades of a 3:1 pool give three of one body and one of the other.
  `P.bodies` multiplies the pool.
- **Every look field** rolls under the *leanings* of the place: niche weights × region weights ×
  the region's niche weights × the region's palette (raised to `palette.strength`). Mutation
  pressure scales the chaos odds (see below).
- **The body's own `prefer`** applies each field with chance `bodyPrefer` (0.6).
- **Links**, then the **guard** (see below).

Prototypes are cached per params object.

### 3. Individual: `ecotypeFromSeed(seed, P, weightOf, place)`, band 5200

Each field is copied from the prototype with chance `cohesion × stick[group]`. Otherwise it is
rolled again under the same leanings:

| Group | Stick | When not kept |
|---|---|---|
| fixed (body, form, hybrid) | 1 | always kept |
| bell (length, depth, head, size …) | 0.75 | drifts a step from the prototype (`clusters.drift`) |
| colour (skin, markColor, eyeColor, pigments) | 0.85 | moves to a near swatch (OKLab distance) |
| pattern | 0.95 | re-rolled |
| shape (fins, jaw, snout …) | 0.95 | re-rolled |
| face (eyes, blush, quirk) | 0.5 | re-rolled |
| other | 0.6 | re-rolled |
| free (mood, sex, stage, morph, chaos …) | 0 | always own |

The default `cohesion` is 0.9. The individual roll then runs these steps in order:

1. **Mutation pressure.** With chance `mutation.sport × mutationOf(region)`, one of the region's
   sports fires. For example, the reactor lake can give a morph, a second eye colour or a
   signature, and the magma sea can give glow or scales.
2. **Links and the guard** over the fields this fish rolled itself. Fields kept from the species
   were linked already.
3. **Loci** roll around bell centres the niche has shifted (`clusters.lociStrength`).

Result: one clade shares a body, a binomial and most of a look. One niche shares a guild's
shape. One region shares a palette.

`speciesKey(set)` returns `region/niche/clade`.

## The five procgen features

### Trait linkage (`links.js`, `data/links.js`)

A link is `{ id, when, mul: { field: { choice: × } } }`. After the first roll, every link whose
`when` holds multiplies its odds into the linked fields, and those fields re-roll at salt
`base + 7`. The 12 default links are:

- fangs-fast
- gape-ambush
- venom-warning
- lure-dark
- scutes-plates
- veil-slow
- thunniform
- round-cute
- deep-pale
- sand-flat
- lava-armour
- nuclear-glow

**Params:**

- `links.strength` is an exponent on every multiplier; 0 turns links off.
- `links.off` lists ids to skip.
- `links.list` replaces the table.

**Breeding kits** (`KITS`) keep linked fields together across generations. With chance
`links.kitChance` (0.5), a kit comes whole from one parent. Chance salts are `140 + 2i` and
`141 + 2i`. The kits are:

| Kit | Fields |
|---|---|
| weapons | jaw, extras, pelvic |
| fins | dorsal, tail, pectoral, anal, finPattern |
| face | eye, eyeStyle, eyeMount, eyeColor, eyeColor2 |

### Biome palettes

Each region declares `palette` weight maps over skin and mark swatches, plus `native` pigments.
They stack into the leanings, raised to `palette.strength`. 0 means no pull, and above 1 pulls
harder. The colour group's near-swatch move keeps individuals near their species.

### The aesthetic guard (`guard.js`, `data/constraints.js`)

A guard is `{ id, when, fix, fallback, note }`. A fish that trips it re-rolls `fix` without the
values already tried, at salt `base + 101·k` for k = 1..4, then takes the fallback. The defaults
are:

| Guard | What it prevents |
|---|---|
| tiny-arsenal | a tiny fish with venom spines and a sword tail |
| helmet-eyes | a helmet over telescope or tube eyes |
| lava-veil | a veil or streamer tail in lava |
| sand-sail | a tall dorsal on a sand-swimmer |
| nuclear-warts | warts in the cooling lake |
| big-googly | googly eyes on a giant |
| tiny-sword | a bill on a tiny fish |

`guard.enabled` and `guard.off` steer it. `violations(set, P)` lists what a fish trips; the tests
check 2,000 seeds and find none.

### Balanced batches (`batch.js`), band 7700

`batch(seed, n, P, pin)` is the API for shop stock, wild catches and starting shoals. It works
like this:

- **One terrain per batch,** because terrains cannot share a tank. A `pin` can fix the terrain or
  the region.
- **The species pool** is every region of that terrain × its niches × clades, with Zipf weights.
- **Each species has a trophic level** taken from its prototype's diet:
  - 0: herbivore, planktivore or detritivore
  - 1: omnivore or durophage
  - 2: carnivore or piscivore
- **Quotas follow `batch.pyramid`** (0.6 / 0.3 / 0.1). A level with no species hands its share
  to a neighbouring level.
- **Levels fill top first.** A species already in the batch is weighted down by
  `(1 − diversity)^uses`.
- **Schooling species come in schools** of `min(left, groupSize, maxSchool)`. Hunters come one at
  a time.
- **Fish are `ecotypeFromSeed(`${seed}:${i}`)`** in their species' place.

It returns `{ place, fish: [{ set, species, level, school }], pyramid, species }`.

### Mutation pressure

`mutationOf(region, P) = region.mutation ^ mutation.strength`. Pressure ranges from 0.9 in the
open ocean to 1.6 in the reactor lake and 1.8 in the void. It scales the chaos odds (stable ÷ m,
chaotic × m²) and the sport chance.

## Bodies and terrains in one generator

Lava, sand and nuclear fish are **terrain modes of fish4, not a separate generator.** Every new
body fits the painter's model:

- back and belly profile keypoints
- fin ranges and flags
- anatomy parts spliced into `PARTS`

The anatomy parts are:

- carapace
- seam
- core
- eyeTop
- shovel
- silica
- armFins
- the ambient particles emberTrail, sandPlume and decaySparkle

Breeding, loci, stats, character, rarity and the economy work the same for every fish. A new
painter mode is only justified for a body plan that does not fit (radial, segmented,
multi-bodied).

**The 20 forms (`bodies/*.js`)** are listed below with their `kin`, the fish3 body used for
fallbacks and f3 export:

| Terrain | Forms |
|---|---|
| water | goby (catfish), parrotfish (round), tang (disc), grouper (round), gar (needle), archerfish (hatchet), loach (eel), opah (round) |
| lava | cinderback (trigger), emberdart (tetra), slagjaw (angler), pyreel (eel) |
| sand | dunefin (sturgeon), burrowmaw (angler), sandskipper (catfish), glassback (round) |
| nuclear | glowbelly (round), rodfish (torpedo), isotail (oarfish), quarkling (guppy) |

`form: 'fish3'` means that the fish3 `body` field is the body. A form must belong to its fish's
terrain (`when` on the field). The 32 fish3 bodies are mirrored into the same registry by
reference.

**Pigments** (`data/pigments.js`, fields `pigment` and `markPigment`) are terrain colours such as
obsidian, magma, ash, ochre, dune, sandstone, uranium glass, Cherenkov and isotope amber. They
override the painter's skin and mark ramps. `fish3` keeps the v1 swatch.

**Giant detail.** Fish4-native fish carry `detail: 'v4'`, so scales, rays and plates scale with
the fish (`ctx.detailScale`). Imports and `classic` keep `v3`. Below large, the pixels are
identical.

## Determinism

The only sources of randomness are `roller(seed, band)` and `hash01`. There is no `Math.random`
and no `Date`.

| Band | Use |
|---|---|
| 5000 | place |
| 5100 | prototype (species) |
| 5200 | individual |
| 5300 | clutch |
| 5500 | Mythic egg |
| 7000 | hatch |
| 7600 | simulator |
| 7700 | batch |
| 8101–8103 | character hash salts |
| 8201–8202 | text hash salts |

Salts within a field's band:

| Salt | Use |
|---|---|
| `f.salt` | the first roll |
| `+7` | link re-roll |
| `+11` | bell drift |
| `+13` | near swatch |
| `+17` | individual re-roll (and individual links) |
| `+101·k` | guard |
| 3300+ | body prefer |
| 9001–9003 | sports |

**Field salts:**

| Salts | Fields |
|---|---|
| 2048 | chroma |
| 2064–2543 | loci (two alleles each) |
| 2560–2672 | terrain, region, niche, clade, form, pigment, markPigment, detail |
| 3072+ | feature modules (helmet 3088) |

## Codes and compatibility

- **fish4 writes `f4.` codes.** `fromCode` reads `f4.`, `f3.` and v1 codes.
- **f3 and v1 codes open pixel for pixel.** The golden prints in `test/fish3-golden.test.mjs`
  cover every body, size and anim, through both gen3 and the fish4 import path. Imports get
  `terrain: water`, a region and niche mapped from their habitat, `clade: wild` and
  `detail: v3`.
- **`classic` rolls fish3 exactly,** field by field, plus fish4 genes and features at their base
  odds.
- **The default changed.** Under `ecotype`, a seed rolls a different fish than fish3 did. This
  break is deliberate.
- **Terrain fish and new forms are f4-only.** `toFish3` exports them as their `kin` body, which
  loses their form and pigments.
- **`f4` is not frozen yet.** Freeze it before the game stores fish4 codes (see the roadmap).
- **`params.algo`** is `ecotype` or `classic`, and `paramsHash` goes into the CLI manifest.
  Record both with any stored batch.

## Tests

`test/fish4.test.mjs` covers:

- determinism under every preset
- classic = fish3
- pixel-identical imports
- every body × size × anim inside the window
- terrains turn up by default
- clustering agreement within and between clades
- cross-terrain breeding refused
- character complete with no stray tokens
- links, guard and batches
- rarity never demoted
- brood limits
- sim pacing bands
- scaled detail
- params schema

Two fish3 tests ("two commons never make a signature except by a sport" and "lore: complete,
stable, no stray tokens, not the camera") fail on `main` too. They predate fish4.

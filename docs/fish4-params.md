# fish4 params: steering the generator

Every fish4 entry point takes `params`. It can be:

- a preset id such as `'seedfall'`;
- an object of overrides, merged onto its `base` preset (ecotype if none);
- nothing, which means `ecotype`.

`resolveParams(p)` gives the full object, and `paramsHash(p)` gives a stable hash. The CLI writes
both into `manifest.json`.

**Changing params changes which fish a seed rolls.** That is the point. Store the params, or their
hash, with any batch you want to reproduce. Params never change how a stored code paints: a code
is the fish.

## API

```js
import fish4, { PARAM_SCHEMA, PARAM_GROUPS, validateParams, setParam, schemaFor } from './src/v4/fish/index.js';

const p = setParam({ base: 'ecotype' }, 'clusters.cohesion', 0.5);
validateParams(p);          // { ok, errors[], warnings[] }   unknown paths are warnings
fish4.fromSeed('x', p);
fish4.params.presets;       // the presets
fish4.params.schema;        // PARAM_SCHEMA (path, type, range, label, group, note)
```

`validateParams` checks:

- types, ranges and enums
- rules arrays
- choice-weight maps against the real fields and choices
- the whole params object resolved, which catches:
  - `clutchMin > clutchMax`
  - every terrain switched off
  - an all-zero trophic pyramid

The studio can build its sliders straight from `PARAM_SCHEMA`.

## CLI

```sh
# a contact sheet of 24 seedfall fish
node cli/forge.mjs fish4 --params seedfall --count 24 --contact

# only lava, low cohesion (species vary more), no links
node cli/forge.mjs fish4 --set terrain=lava --param clusters.cohesion=0.5 --param links.strength=0 --contact

# one species, twelve individuals
node cli/forge.mjs fish4 --set region=reactorlake --set niche=school --set clade=k0 --count 12 --contact

# a balanced shop batch, with character dossiers
node cli/forge.mjs fish4 --params seedfall --batch --count 12 --dossier

# params from a file
node cli/forge.mjs fish4 --params my-params.json --count 48 --contact
```

- `--param path=value` is repeatable. The value is parsed as JSON, otherwise as text.
- `--set` on terrain, region, niche or clade pins the place. On any other field it forces that
  field.
- Params are validated before anything rolls: warnings are printed, and errors exit with code 2.

## Presets

| Preset | What it is |
|---|---|
| `ecotype` | **The default.** Places, species and clustering, with lava, sand and nuclear fish on. |
| `classic` | fish3's roll exactly, field by field, plus fish4 genes and features at base odds. |
| `seedfall` | The game: a touch more colour, no wild-caught Mythics (they are bred), a few wild Epics. |
| `frontier` | Aether unlocked (weight 6), mutation strength 1.3, sport 0.05. |
| `water` | Water regions only (lava, sand and nuclear set to 0). |
| `vivid` | v1's saturated palette and the chroma gene on. |
| `wild` | Wider proportions, cohesion 0.6, 6 species per niche, more mutation, odd bits and helmets. |
| `curated` | Tight proportions, cohesion 0.95, 3 species per niche, low mutation, no odd eyes or wear. |

## Recipes

| You want | Set |
|---|---|
| Species that look alike | `clusters.cohesion` 0.95–1 |
| Every fish its own | `clusters.cohesion` 0.3 |
| Fewer, more distinct species | `clusters.speciesPerNiche` 2, `clusters.zipf` 2 |
| More lava fish | `terrains: { lava: 40 }` |
| No nuclear fish | `terrains: { nuclear: 0 }` |
| Only the reef | `regions: { reef: 1, riverlands: 0, pelagic: 0, deep: 0, nebula: 0, icemoon: 0 }` (plus `terrains` water only) |
| More hunters | `niches: { ambush: 3, pursuit: 3 }` |
| A body everywhere it is allowed | `bodies: { gar: 5 }` |
| Fish closer to their region's colours | `palette.strength` 2 |
| Sports and odd fish | `mutation.strength` 1.5, `mutation.sport` 0.08 |
| Looks that do not go together | `links.strength` 0 |
| Let the guard sleep | `guard.enabled: false`, or `guard.off: ['big-googly']` |
| A shop with more hunters | `batch.pyramid: [0.5, 0.3, 0.2]` |
| Bigger schools | `batch.maxSchool` 10 |
| Fewer Mythics | `mythic.maxChance` lower, or `mythic.threshold` higher |

## Every param

### algorithm

| Path | Type | Range | Meaning |
|---|---|---|---|
| `id` | string |  | Preset id |
| `label` | string |  | Label |
| `note` | string |  | Note |
| `base` | enum (ecotype, classic, frontier, water, vivid, wild, curated, seedfall) |  | Built on preset |
| `algo` | enum (ecotype-1, ecotype, classic) |  | Algorithm: ecotype-1: places and species; classic: fish3, field by field. Plain `ecotype` means the newest ecotype roll |
| `rules` | rules |  | Stat rules: 'default' or an array of rules (stats-data.js) |

### places

| Path | Type | Range | Meaning |
|---|---|---|---|
| `terrains` | map |  | Terrain odds: missing = the terrain’s own weight; locked terrains need `unlocked` |
| `unlocked` | list (water, lava, sand, nuclear, aether) |  | Unlocked terrains |
| `regions` | map |  | Region odds × |
| `niches` | map |  | Niche odds × |
| `bodies` | map |  | Body odds × |

### clusters

| Path | Type | Range | Meaning |
|---|---|---|---|
| `clusters.cohesion` | number | 0..1 | Cohesion: how much a fish looks like its species |
| `clusters.speciesPerNiche` | int | 1..8 | Species per niche |
| `clusters.zipf` | number | 0..4 | Dominance (Zipf): higher: one species dominates its niche |
| `clusters.drift` | number | 0..4 | Proportion drift |
| `clusters.lociStrength` | number | 0..3 | Niche pull on genes |
| `clusters.stick` | map |  | Stickiness per group |
| `bodyPrefer` | number | 0..1 | Body’s own looks: fish3: 0.6 |

### procgen

| Path | Type | Range | Meaning |
|---|---|---|---|
| `links.strength` | number | 0..4 | Link strength: 0 = links off |
| `links.off` | list (fangs-fast, gape-ambush, venom-warning, lure-dark, scutes-plates, veil-slow, thunniform, round-cute, deep-pale, sand-flat, lava-armour, nuclear-glow) |  | Links off |
| `links.kitChance` | number | 0..1 | Kit inheritance: kits: weapons, fins, face |
| `guard.enabled` | bool |  | Aesthetic guard |
| `guard.off` | list (tiny-arsenal, helmet-eyes, lava-veil, sand-sail, nuclear-warts, big-googly, tiny-sword) |  | Guards off |
| `palette.strength` | number | 0..3 | Biome palette strength |
| `mutation.strength` | number | 0..4 | Mutation pressure |
| `mutation.sport` | number | 0..1 | Sport chance |
| `batch.pyramid` | tuple | 0..1 | Trophic shares: [base, middle, top] |
| `batch.diversity` | number | 0..0.95 | Batch diversity |
| `batch.maxSchool` | int | 1..12 | Largest school |

### looks

| Path | Type | Range | Meaning |
|---|---|---|---|
| `weights` | choiceWeights |  | Choice odds ×: { field: { choice: × } } |
| `spread` | number | 0.2..4 | Proportion spread |
| `color.vivid` | number | 0..1 | Vivid colour |
| `color.chroma` | tuple | 0..100 | Chroma gene odds |
| `features` | map |  | Feature odds × |
| `loci.spread` | number | 0.2..4 | Gene spread |

### rarity

| Path | Type | Range | Meaning |
|---|---|---|---|
| `rarity` | map |  | Wild tier odds |
| `rarityPoints.thresholds` | map |  | Tier thresholds |
| `rarityPoints.minBits` | number | 0..100 | Points: minBits |
| `rarityPoints.bitPoints` | number | 0..100 | Points: bitPoints |
| `rarityPoints.homozygous` | number | 0..100 | Points: homozygous |
| `rarityPoints.carrier` | number | 0..100 | Points: carrier |
| `rarityPoints.morph` | number | 0..100 | Points: morph |
| `rarityPoints.iridescence` | number | 0..100 | Points: iridescence |
| `rarityPoints.hybrid` | number | 0..100 | Points: hybrid |
| `rarityPoints.signature` | number | 0..100 | Points: signature |
| `rarityPoints.relic` | number | 0..100 | Points: relic |
| `rarityPoints.feature` | number | 0..100 | Points: feature |
| `rarityPoints.aether` | number | 0..100 | Points: aether |
| `rarityPoints.locusPoints` | number | 0..100 | Points: locusPoints |
| `rarityPoints.perGeneration` | number | 0..100 | Points: perGeneration |
| `rarityPoints.generationCap` | number | 0..100 | Points: generationCap |
| `rarityPoints.perPurity` | number | 0..100 | Points: perPurity |
| `rarityPoints.extremeLocus` | number | 0..1 | Extreme gene from |

### breeding

| Path | Type | Range | Meaning |
|---|---|---|---|
| `breeding.broodLimit` | int | 1..100 | Brood limit |
| `breeding.tierMul` | map |  | Brood limit × per tier |
| `breeding.fertilitySpread` | number | 0..1 | Fertility spread |
| `breeding.mythicBroodLimit` | int | 0..100 | Mythic brood limit |
| `breeding.clutchMin` | int | 1..20 | Clutch min |
| `breeding.clutchMax` | int | 1..20 | Clutch max |
| `breeding.cooldownMul` | number | 0..10 | Cooldown × |
| `breeding.maturationMul` | number | 0..10 | Maturation × |
| `breeding.spawnBase` | number | 0..1 | Spawn chance |
| `mythic.baseChance` | number | 0..1 | Mythic base chance |
| `mythic.curve` | number | 0..10 | Mythic curve |
| `mythic.threshold` | number | 0..200 | Mythic threshold (points) |
| `mythic.aetherWeight` | number | 0..1 | Aether weight |
| `mythic.purityWeight` | number | 0..1 | Purity weight |
| `mythic.maxChance` | number | 0..1 | Mythic cap per egg |
| `mythic.regression` | number | 0..1 | Regression to the mean |

### economy

| Path | Type | Range | Meaning |
|---|---|---|---|
| `economy.perPoint` | number | 0..100 | Credits per point |
| `economy.base` | number | 0..10000 | Base credits |
| `economy.scarcity` | number | 0..10 | Scarcity premium |
| `economy.saturation` | number | 0..1 | Genus saturation |
| `economy.floor` | number | 0..1 | Saturation floor |
| `economy.eggCost` | number | 0..10000 | Egg cost |

### text

| Path | Type | Range | Meaning |
|---|---|---|---|
| `text.humour` | number | 0..1 | Humour |
| `text.voices` | map |  | Voices: reserved for the Haiku text pass (reserved) |
| `text.library` | string |  | Text library (reserved) |

`reserved` params validate but do nothing yet. `text.voices` and `text.library` wait for the
Haiku text pass (see [fish4-roadmap.md](fish4-roadmap.md)).

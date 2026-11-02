# plant4: the procedural plant generator

plant4 (`src/v4/plant/`) draws every plant with one engine: a 16 px radish, a 96 px oak, a
weeping willow, a kelp forest, a sea fan or a sunflower. plant3 described a plant as a stem with
things stuck on it, which is why it could not make a convincing tree. plant4 describes a plant
the way botany does, as **axes that branch by order**.

- **50 forms** in three realms, each with 18 or 14 forms:
  - **farm (18):** lettuce, cabbage, kale, carrot, radish, onion, wheat, corn, tomato, bean,
    pumpkin, pepper, strawberry, sunflower, tulip, daisy, lavender, rose
  - **wild (18):** bush, hydrangea, oak, maple, fruit tree, spruce, cypress, birch, willow,
    palm, acacia, fern, saguaro, prickly pear, succulent, mushroom, grass, bamboo
  - **water (14):** kelp, vallisneria, sword plant, stem plant, cabomba, hairgrass, moss ball,
    sea fan, branch coral, caulerpa, anubias, aponogeton, sea lettuce, glowstalk
- **five size classes:** herb 16, shrub 32, tall 48, tree 64 and giant 96 px tall;
- **a place roll** (realm → region → form → looks), the same shape as fish4's;
- **farm numbers:** grow days, regrowth, yield, sell price, season and rarity, Stardew style;
- **seed-catalogue names** ("Dwarf Striped Lettuce 'Merel'"), **breeding** that keeps the kind,
  and **balanced batches**;
- **animations:** idle, wind, gust, rustle, bloom, glow, grow, stages and seasons.

## Using it

```js
import plant4 from './src/v4/plant/index.js';

const set = plant4.fromSeed('plot-7');                        // default params: ecotype
const oak = plant4.fromSeed('plot-7', null, { form: 'oak' }); // pin the form
const reef = plant4.fromSeed('plot-7', 'aquarium');           // a preset
const bed = plant4.batch('market:day-3', 12, 'farm');         // one place, a few varieties

plant4.name(set);              // "Tall Blushing Tulip 'Kalu'"
plant4.stats(set);             // days, regrow, yield, sell, season, hardiness, rarity …
plant4.rarityOf(set);          // points, tier, why
plant4.breedDetailed(a, b, 's');  // child, events, name
plant4.frame(set, 'wind', 3);  // pixels
plant4.at(set, 0.4);           // the plant at 40 % grown
```

From the CLI:

```sh
node cli/forge.mjs plant4 --count 24 --contact --bg --scale 3
node cli/forge.mjs plant4 --set realm=water --count 12 --contact
node cli/forge.mjs plant4 --batch --count 16 --contact --anim seasons
```

## The pipeline

| step | file | in → out |
| --- | --- | --- |
| roll | `ecotype.js` | seed, params, pin → genome |
| resolve | `resolve.js` | genome → bent form, scale, canvas, materials (cached per code) |
| grow | `engine/arch.js` | form + seed → topology: axes and organs, each with a birth time |
| pose | `engine/pose.js` | topology + pose → points in pixels |
| draw | `engine/draw.js` | posed plant → material/tone buffer → outlined, lit indexed image |

### Forms are data (`forms.js`)

A form gives one rule per **order**, where order 0 grows from the ground. Each rule sets:

- how long and thick the axis is, and its taper;
- how it bends: `gravi` (gravitropism), `curl`, `wiggle`, `stiff`, and `hang` for weeping strands;
- how it makes children: `kids.phyllo` (alt, opposite, whorl, spiral, fork), `n`, `from`/`to`
  along the parent, `angle`, and a **profile**. The profile is how child length changes with
  height: `cone` makes a spruce, `dome` an oak, `vase` an elm and `taper` a herb.

**Organs** hang on axes:

| organs | used for |
| --- | --- |
| leaf, clump | foliage; a tree crown is clumps |
| bloom, fruit | flowers and fruit |
| ear, head | wheat ears, cabbage heads |
| float, polyp | kelp floats, coral polyps |
| cap, root | mushroom caps, carrot and radish roots |

Every axis and organ has a `birth` and a `dur` on one growth clock, from 0 (seed) to 1 (grown).
Drawing at growth t therefore shows the same plant younger, and growing only ever adds pixels.

To add a form, add an entry to `FORMS` with `realm`, `sizes`, `maxW`, `base`, `axes`, `organs`,
`colors` and `stats`, then append its id to `FARM_FORMS`, `WILD_FORMS` or `WATER_FORMS` in
`genome.js`. Each list has room for 36 forms. Always append to a list. Never reorder or remove
an id, because codes store a form's position in its list.

### Pose (`engine/pose.js`)

A bend travels up every axis, `A · flex · sin 2π(wind + φ − lag·s)`, and each child starts from
its parent's bent heading, so a gust ripples from trunk to leaf. Air has little lag. Water uses
a slow travelling wave and stronger sway, and its idle sway is larger, because a tank plant
never sits still.

The pose channels are:

| channel | what it does |
| --- | --- |
| `wind`, `sway`, `lean`, `flutter` | movement |
| `bloom` | how far flowers are open |
| `growth` | 0..1 on the growth clock |
| `glow` | brightness of glowing parts |
| `droop` | extra sag |
| `season` | −1 summer, 0 spring … 3 winter. Deciduous forms blossom, colour, then go bare with snow; evergreens keep their leaves. |

Loops close because every term is periodic in `wind`.

## The genome (`genome.js`, prefix `p4.`)

| fields | what they set |
| --- | --- |
| `realm`, `region`, `farmForm` / `wildForm` / `waterForm` | where it grows and what it is. Only the realm's own form field is live. |
| `size` | herb, shrub, tall, tree or giant |
| `look` | clean, bold (dark ink) or soft (no outline, dithered) |
| `height` `spread` `branching` `leafSize` `density` `thickness` `droop` `asym` | shape steps m3..p3. Each one bends the form's numbers in `resolveForm`. |
| `leaf`, `bloom`, `fruit` | `auto` (the form's own), `none`, or a swapped organ kind |
| `leafColor` `tipColor` `barkColor` `petalColor` `eyeColor` `fruitColor` `rootColor` `coralColor` `autumnColor` `glowColor` | palette swatches |
| `variegation`, `glow`, `bed` | rare looks and what it stands in |
| `sprout`, `twist` | the individual: which branches, which jitter |
| `growth` `yield` `hardiness` `thirst` `flavour` `longevity` | quiet genes. They change farm numbers, not pixels. |

Fields and salts are append-only. Fish4's rules apply: never reorder a field or its choices.

## The roll (`ecotype.js`, `data/places.js`, `params.js`)

1. **Realm**, weighted by `P.realms` (default: farm 38, wild 34, water 28).
2. **Region** within the realm. There are 17 regions, for example:
   - farm: kitchen garden, flowerbed
   - wild: taiga, desert
   - water: reef, abyss

   Each region weights its forms and sizes, tints colours and picks a bed. Abyss plants can
   glow.
3. **Form** from the region's weights, and **size** from the form's allowed sizes. Both odds
   are multiplied by the region's odds and by `sizePrefer`.
4. **Colours.** With chance `formColors`, each colour comes from the form's preferred swatches
   and the region's tint. Otherwise it is free.
5. **Shape.** The steps are drawn from a bell curve, scaled by `shapeSpread`.
6. **Rare looks** (variegation, glow, organ swaps), scaled by `rare`.

The presets are:

| preset | what it gives |
| --- | --- |
| `ecotype` | the default roll above |
| `classic` | field by field, with no place-driven colours |
| `farm`, `wild`, `aquarium` | one realm only |
| `trees` | wild realm only, fewer deserts, more savanna, forms always at their own sizes |
| `rare` | more variegation, glow and odd colours |

`params` can be a preset id, an object of overrides (merged onto its base preset), or nothing.

## Farm, names, breeding, batches

- **`farm.js`:**
  - `statsOf` scales the form's `stats` by the quiet genes, the size and the rarity tier.
  - Plants you don't harvest (ornamental trees, corals) sell for 0.
  - `rarityOf` gives points for variegation, glow, a giant, a size the form doesn't usually
    come in, extreme shape steps, organ swaps and unusual colours. The tiers are common 0,
    uncommon 2, rare 4, epic 7 and legendary 10. Each tier multiplies the sell price.
- **`names.js`:** the name is size + variegation + the most striking off-type colour + the
  form's label, then a syllable cultivar name. A colour word is used only if the form shows
  that organ.
- **`breeding.js`:**
  - Realm, region and form come whole from one parent: a lettuce crossed with an oak gives a
    lettuce or an oak.
  - Size lands between the parents.
  - Shape and quiet genes take the mean plus drift.
  - Mutation changes looks, never the species.
- **`batch.js`:** a batch is one realm, a few regions and a few forms per region. Counts follow
  the regions' weights. Within a variety, plants share the founder's colours with chance
  `cohesion`, like a seed packet.

## Tests

`test/plant4.test.mjs` checks:

- the registry and the code width;
- determinism and code round-trips;
- that realm, region and form agree;
- that every form draws at every size inside its window, never touching the edge;
- that loops close and that wind moves a crop, a tree and a water plant;
- that growth only adds;
- seasons: the oak goes bare, the spruce stays green;
- breeding, batches, params, stats and names.

`test/generators.test.mjs` also covers plant4 through the shared generator contract.

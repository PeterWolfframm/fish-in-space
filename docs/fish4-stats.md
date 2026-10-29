# fish4 stats and genes

`statsOf(set, { rules?, tier? })` (`src/v4/fish/stats.js`, tables in `stats-data.js`) returns 35
stats. Each one is

```js
{ value: 0..1, real?, unit?, display, word, because: [{ source, label, value | delta }] }
```

`behaviourProfile(set)` flattens them into a versioned vector for the behaviour models
(`STATS_VERSION` 2).

## How a stat is built

The steps run in this order, and every step is recorded in `because`:

1. **Body baseline.** fish3's ecology for the body (temperature, pH, level, diet, temper), or the
   terrain's own base (`TERRAIN_BASE`).
2. **Family priors** (taxonomy).
3. **Body leanings.** For example, a skittish kind gets −0.1 boldness.
4. **Loci** (`LOCUS_EFFECTS`), centred on 0.5.
5. **Size and tier** (`SIZE_EFFECTS`, `TIER_EFFECTS`).
6. **Traits** (`TRAIT_EFFECTS`): fins, jaw, extras and so on.
7. **Features** such as the helmet.
8. **Rules.** `params.rules` holds rules-DSL entries that add or set stats.
9. **Clamp** to 0..1. Stats with a `real` range map onto it.

**Fish of another medium.** Lava, sand, coolant and void fish map `idealTempC` and
`tempTolerance` over their medium's band:

| Medium | Band |
|---|---|
| magma | 850–1250 °C |
| sand | 35–70 °C |
| coolant | 40–90 °C |
| void | −271 to −240 °C |

Their water-only stats (`idealPH`, `phTolerance`, `salinityTolerance`) carry `applies: false`.

## The 35 stats

| Stat | Group | Label | Range | Low → high |
|---|---|---|---|---|
| `idealTempC` | water | Ideal temperature | 2–38 °C | cold → warm |
| `tempTolerance` | water | Temperature tolerance | 1–8 ± °C | fussy → tolerant |
| `idealPH` | water | Ideal pH | 5.5–9 pH | acid → alkaline |
| `phTolerance` | water | pH tolerance | 0.1–1 ± pH | fussy → tolerant |
| `salinityTolerance` | water | Salinity tolerance | 0..1 | strict → any water |
| `hardiness` | constitution | Hardiness | 0..1 | delicate → hardy |
| `stressResistance` | constitution | Stress resistance | 0..1 | nervy → unflappable |
| `aggression` | temperament | Aggression | 0..1 | placid → fiery |
| `predatoryDrive` | temperament | Predatory drive | 0..1 | harmless → hunter |
| `boldness` | temperament | Boldness | 0..1 | shy → bold |
| `territoriality` | temperament | Territoriality | 0..1 | shares → guards |
| `sociability` | social | Sociability | 0..1 | loner → gregarious |
| `schooling` | social | Schooling | 0..1 | alone → shoals |
| `verticalPref` | movement | Preferred zone | 0..1 | bottom → surface |
| `zoneBreadth` | movement | Zone breadth | 0..1 | stays put → roams |
| `energy` | movement | Energy | 0..1 | languid → zippy |
| `stamina` | movement | Stamina | 0..1 | tires fast → tireless |
| `swimSpeed` | movement | Swim speed | 0.5–5 BL/s | slow → fast |
| `circadian` | rhythm | Day rhythm | 0..1 | diurnal → nocturnal |
| `appetite` | rhythm | Appetite | 0..1 | picky → greedy |
| `metabolicRate` | rhythm | Metabolic rate | 0..1 | slow → fast |
| `dietBreadth` | rhythm | Diet breadth | 0..1 | specialist → eats anything |
| `curiosity` | rhythm | Curiosity | 0..1 | aloof → nosy |
| `fertility` | life | Fertility | 0..1 | shy breeder → prolific |
| `clutchSize` | life | Clutch size | 1–6 eggs | few eggs → many eggs |
| `breedCooldownMul` | life | Breeding rest | 0.6–2.5 × | ready again soon → long rest |
| `maturationMul` | life | Time to adult | 0.5–3 × | grows up fast → slow to mature |
| `lifespan` | life | Lifespan | 1–40 years | brief → long-lived |
| `growthRate` | life | Growth rate | 0..1 | slow → fast |
| `mythicPotential` | life | Mythic potential | 0..1 | none → saturated |
| `heatTolerance` | terrain | Heat tolerance | 0..1 | needs it cool → fireproof |
| `radiance` | terrain | Radiance | 0..1 | none → radiant (harmless) |
| `burrowing` | terrain | Burrowing | 0..1 | never digs → lives buried |
| `armour` | terrain | Armour | 0..1 | soft → plated |
| `luminosity` | terrain | Luminosity | 0..1 | dark → lamp-bright |

The terrain stats start from `TERRAIN_BASE`:

| Terrain | burrowing | armour | luminosity |
|---|---|---|---|
| water | .05 | .08 | .02 |
| lava | .08 | .30 | .30 |
| sand | .45 | .15 | .02 |
| nuclear | .03 | .06 | .35 |
| aether | 0 | .05 | .20 |

Body leanings add to these. For example, cinderback gets +.25 armour, glowbelly gets +.3
luminosity and +.2 radiance, and burrowmaw gets +.4 burrowing.

## The 15 loci (`loci.js`)

Each locus is diploid: two allele fields, A and B, each holding 0..15. Each field rolls from a
bell centred on 7.5, except aether, which is skewed low. A fish shows the mean of its two
alleles, or mostly the higher one for a dominant-high locus. A child takes one allele from each
parent, so selection moves a locus about one step per generation, and a pure line can fix it.

Under ecotype, the niche shifts each bell's centre (`NICHES[n].loci`, scaled by
`clusters.lociStrength`).

Loci never reach the paint. They feed stats, rarity and reproduction.

| Locus | Low → high | Feeds (weight) |
|---|---|---|
| metabolism | slow → fast | metabolicRate .6, appetite .5, growthRate .4, curiosity .2, energy .1 |
| vigor | delicate → hardy | hardiness .6, tempTolerance .3, phTolerance .3, stamina .2, salinityTolerance .15, lifespan .1, heatTolerance .1 |
| resilience | skittish → unflappable | stressResistance .6, armour .1 |
| boldness | shy → bold | boldness .6, curiosity .5, zoneBreadth .25 |
| aggression | placid → fiery (dominant-high .35) | aggression .5, territoriality .3, predatoryDrive .25 |
| sociability | loner → gregarious | sociability .5, schooling .4 |
| thermal | cool → warm | idealTempC .17, heatTolerance .2 |
| acidity | soft & acid → hard & alkaline | idealPH .23 |
| zone | bottom → surface | verticalPref .35, burrowing −.2 |
| energy | languid → zippy | energy .5, zoneBreadth .35, stamina .3, swimSpeed .3 |
| fertility | shy breeder → prolific | fertility .6, breedCooldownMul −.5, brood limit |
| fecundity | few eggs → many eggs | clutchSize .6 |
| maturation | grows up fast → slow to mature | maturationMul .4, growthRate −.4 |
| longevity | brief → long-lived | lifespan .4 |
| aether | none → saturated (rare-high) | mythicPotential 1 |

Appending a locus needs two new allele fields with fresh salts after 2543. Never reorder the
loci: their order is part of the code.

## Where stats go

- **Character:** axes, traits, care and social role ([fish4-character.md](fish4-character.md)).
- **Reproduction:** spawn chance, clutch, cooldown, maturation and brood limit.
- **Rarity:** extreme loci and the purity of lines.
- **Economy:** a premium for slow and shy breeders.
- **Batches:** schooling gives the school size.
- **The aquarium's behaviour models**, through `behaviourProfile`.

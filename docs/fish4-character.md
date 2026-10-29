# fish4 character: what a genome tells you

`characterOf(set, opts)` (`src/v4/fish/character.js`, tables in `data/character.js`) reads
everything a keeper would want to know off one fish. It is pure:

- **Inputs:** stats, loci, ecology facts, niche and terrain.
- **Tie-breaks:** the fish's own key (`jitterKey`) only breaks ties, at hash salts 8101–8103.
- **Evidence:** every judgement carries `because`, so the studio can show why.

```js
const c = fish4.character(set);
// { names, personality, archetype, traits, quirks, likes, dislikes, fears, social, care,
//   story, value, voice, facts }
fish4.blurb(set);   // "A placid, languid drifter from the Isotope Springs; sparkles at its friends."
fish4.text(set);    // { tagline, origin, codex, care, quote }
```

## Personality: five axes

Each axis is a weighted mix of stats, plus a small nudge from the niche (`NICHE_AXES`). For
example, ambushers are lower on energy and higher on temper, schoolers are more social, and
burrowers are more timid.

| Axis | From | Low → high |
|---|---|---|
| boldness | boldness .7, curiosity .15, stressResistance .15 | timid → bold |
| sociability | sociability .6, schooling .4 | solitary → social |
| curiosity | curiosity .8, zoneBreadth .2 | incurious → curious |
| temper | aggression .55, territoriality .3, predatoryDrive .15 | placid → fiery |
| energy | energy .6, swimSpeed .2, stamina .2 | languid → lively |

The stats already carry the body's leanings and the loci (see [fish4-stats.md](fish4-stats.md)),
so the genes behind boldness, aggression, sociability, energy and so on show through.

## Archetype

The fish gets the nearest of 16 archetype centres on the five axes, measured by Euclidean
distance. Ties within 0.01 break on the fish's key. The result also names the runner-up and the
distance.

The 16 archetypes are:

- Sentinel
- Gossip
- Drifter
- Bruiser
- Scholar
- Show-off
- Hermit
- Socialite
- Daredevil
- Worrier
- Monk
- Hunter
- Guardian
- Clown
- Explorer
- Sleeper

Each archetype has a `line`, such as "is resting its eyes, thank you", and `voice` tags for
text.

## Traits, quirks, likes

- **Traits:** 3–5 adjectives by salience. The extreme axes come first, then stats far from the
  middle (`TRAIT_WORDS`: greedy/picky, hardy/delicate, nocturnal, radiant …).
- **Quirks:** 1–3 habits from 37 rules-DSL entries (`QUIRKS`). The most specific match comes
  first, then the fish's key. Examples: "hoards pebbles in one corner", "races its own
  reflection", "hums in the coolant", "is the night-light everyone else sleeps by".
- **Likes, dislikes and fears:** from 33 `LEANINGS`. Foods depend on the terrain:
  - Water and aether fish eat aquarium food: live food, algae wafers, flakes.
  - Lava grazers eat fresh mineral crust; lava hunters eat ember shrimp.
  - Sand grazers eat lichen crumbs; sand hunters eat dune beetles.
  - Nuclear grazers eat isotope algae; nuclear hunters eat glow-shrimp.
  - Omnivores get both.

  Decor, light and current likes follow niche, zone and stats.

## Social role and care

**Social role.** The first matching role wins:

| Role | When |
|---|---|
| leader | bold and social |
| sentinel | territorial and bold |
| loner | sociability axis < .35 |
| follower | anything else |

The role also reports the school size (`groupSizeOf(schooling)`), the temperament and the zone.

**Care sheet.** It lists:

- the medium (water, magma, sand, reactor coolant, void)
- the ideal temperature and range, mapped over the medium's band
- the heat word
- the medium's chemistry (pH, flow, grain, drift)
- the radiation level and note for nuclear fish ("radiant, and harmless: it glows, it does not
  burn")
- tank litres
- the group to keep
- diet and feeding rhythm (appetite × metabolism)
- the zone

## Story, value, voice

- **Story:** terrain, region, niche (with its note), clade, binomial, body, lifespan,
  maturation and brood outlook (`reproduction`).
- **Value:** rarity points, tier and breakdown, plus credits (`valueOf`).
- **Voice:** tags from the archetype, the terrain, the role and the axes. The text library keys
  on them.

## Compatibility

`compatibility(a, b)` returns `{ score 0..1, verdict, reasons[] }`. Every reason carries its own
multiplier.

| Check | Effect |
|---|---|
| Terrain | Different terrains score **0**, "needs its own tank: reactor coolant and water do not mix" |
| Predation | A fish with predatory drive ≥ .5 that is two or more sizes bigger |
| Temper | Two hotheads (aggression × .65 + territoriality × .35, product > .2) |
| Territory | Two territorial fish (≥ .55) in the same zone: × .65 |
| Temperature | Overlap of the comfortable ranges |
| Kin | Same species: noted ("they will school together") |

Verdicts:

| Score | Verdict |
|---|---|
| ≥ .8 | great tankmates |
| ≥ .55 | can share a tank |
| ≥ .3 | risky |
| below .3 | keep apart |

## Text

`textFor(set, pool)` matches `data/text-library.js` entries against the full look:

- stats, loci and facts
- fields and features
- tier and size
- character facts

The most specific entry wins. A hash of the fish's key picks the line within it, and tokens such
as `{archetype}`, `{quirk}`, `{region}`, `{medium}` and `{likes}` are filled from the character.
The pools are tagline, origin, codex, care and quote. When nothing matches, fish3's `loreOf`
fills in.

`text.humour` steers names. `text.voices` and `text.library` are reserved for the Haiku text
pass (see the roadmap).

## Extending

The tables are plain data in `data/character.js` and use the rules DSL (`rules.js`):

- `when` takes `{ stat | locus | fact | field | feature | tier | size, is | in | not | gt | gte | lt | lte | between }`
- `all` / `any` / `none` combine conditions

New quirks, likes or archetypes need no code. The test "character is complete, has no stray
tokens and differs across niches" guards them.

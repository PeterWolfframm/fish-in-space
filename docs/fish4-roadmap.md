# fish4 roadmap: next steps

This roadmap was written when the generator core was done (`agent/fish-v4-wip`, Parts A–G of the
fish4 plan). Docs: [fish4.md](fish4.md), [fish4-params.md](fish4-params.md),
[fish4-stats.md](fish4-stats.md), [fish4-character.md](fish4-character.md).

## Where things stand

**Done**

- Rarity, reproduction, breeding, economy and the pacing simulator.
- Scaled detail for giants.
- Text.
- Terrains: water, lava, sand and nuclear are on by default; aether is locked.
- 13 regions and 11 niches.
- The ecotype roll and clustering.
- 20 new forms and terrain pigments.
- Anatomy parts.
- Character and compatibility.
- The five procgen features: links, biome palettes, the guard, batches and mutation pressure.
- `PARAM_SCHEMA`, presets and the CLI.

**Not done yet**

- **The aquarium** still runs on fish3. It has no fish4 import yet.
- **The `f4` code format is not frozen.**
- **Two known test failures:**
  - Two fish3 tests fail on `main` as well and predate this branch: "two commons never make a
    signature except by a sport" and "lore: complete, stable, no stray tokens, not the camera".
  - The aquarium's typecheck and `test/tinder.test.ts` fail because of uncommitted Tinder work in
    `aquarium/src`, which is not part of fish4.

## 1. Before anything stores fish4 codes (do first)

1. **Freeze `f4`.**
   - Write a golden test for codes: a fixed set of seeds × presets → code strings and frame hashes.
   - Write a field-order lint: new fields only at the end, salts never reused.
   - Bump `algo` (`ecotype-1`), so a later change to the roll can't silently re-map stored seeds.
     Codes are safe either way, because a code is the fish.
2. **Region-aware care temperature.** `idealTempC` comes from the body and the thermal locus,
   never the region. So an icemoon needlefish can want 26 °C and a reef fish can want cold water.
   - Add `thermal` shifts per region (icemoon and deep cold, reef and riverlands warm) on the
     locus bell, like niche loci.
   - Add a region baseline in `stats.js` with `because`.
3. **Niche-aware diet.** Diet comes from body and jaw only, so a grouper ambusher can eat
   detritus.
   - Let niches set diet odds (ambush and pursuit → carnivore or piscivore, grazer → herbivore,
     sifter → detritivore).
   - Re-check batch trophic levels afterwards, because `LEVEL_OF_DIET` reads the diet.
4. **Name repetition.** Common names can repeat a word ("Cherenkov-finned Cherenkov"). Add a
   no-repeat pass in `names.js` that re-picks the colour or fin word from the next candidate.
5. **Eye stamp 7.** Hand-set eye stamps stop at 6 px (`v3/fish/draw.js` `EYES`), so giant fish
   with `detail: 'v4'` get small eyes. Add 7 and 8 px stamps as a v4-only pass-through (default
   cap 6, golden prints unchanged).

## 2. Game integration (aquarium)

- **Import fish4** through the vendored `aquarium/forge/v4`:
  - `fromSeed(seed, 'seedfall')` for wild fish
  - `batch` for shop stock and wild catches, so each shop day is one terrain and one balanced
    shoal
  - `breed` for the hatchery
- **Terrain tanks.** Water, lava (magma), sand and coolant tanks, each with its own backdrop
  (the dark lab, with space and a planet behind the tank). `compatibility` returns 0 across
  terrains, so the UI needs a "needs its own tank" state.
- **Region discovery** as progression. `unlocked` and `terrains` already gate places. Expeditions
  open regions (the Glass Flats, the Cooling Lake), and aether stays locked until the Mythic arc.
- **Character in the UI.**
  - The fish card shows the archetype, traits, quirks and blurb.
  - The care sheet drives tank warnings.
  - Compatibility drives "will they get along" hints.
- **Behaviour models** read `behaviourProfile` (stats v2). Map burrowing, armour and luminosity
  onto sand burrowing, lava plating and glow at night.
- **Pacing in hours.** The sim measures generations, at about 2.7 minutes per generation with the
  game's timers.
  - Re-run `sweep` against the real timers once the hatchery uses fish4.
  - Retune `breeding.cooldownMul` and `maturationMul` so the tiers land in play hours, not only
    in generations: legendary in about a week of casual play, Mythic as a long goal.

## 3. Tools

- **Studio: a species atlas.**
  - A grid of terrain × region × niche × clade showing every prototype, with a click-through to
    ten individuals.
  - Sliders built from `PARAM_SCHEMA`: cohesion, stick per group, Zipf, palette strength,
    mutation, link strength, guards and pyramid.
  - A live species count and a "how clustered" readout: the within-clade vs between-clade
    agreement the tests measure.
- **The `extend-fish4` skill** (`.claude/skills/extend-fish4`; `loci.js` already points to it).
  It needs recipes for:
  - adding a body (record, kin, parts, leanings, taxa, test)
  - a region or niche (bodies, weights, palette, sports, loci shifts)
  - a terrain (medium, band, pigments, guards, foods)
  - a locus (append, salts)
  - a link or guard
  - a quirk, like or archetype
  - text entries

  It should also list the salt map and the golden-test rules.

## 4. Generator features, by value

1. **Terrain hybrids and bridge crosses.** Today, cross-terrain breeding is refused. Add rare
   bridge regions where two terrains meet, such as the vent shore (lava and water) or the glass
   lagoon (sand and water). A bridge fish has a dual medium and can breed with either side. Its
   children could carry a `bridge` locus, giving a long breeding goal that ties terrains
   together.
2. **Sand gait.** Sand fish swim with water motions. A sand-swim motion in `motions.js` would
   help: the body under a sand surface line with only the dorsal and eyes showing, a sand plume
   behind, and leaps for the sandskipper.
3. **Stronger links.** Niche leanings already decide most of the linked fields, so links mostly
   matter between niches. Options:
   - apply links on the prototype at a higher strength (`links.speciesStrength`);
   - add links that read loci (bold fish get bright colours, shy fish get countershading).
4. **Glow for nuclear fish.** v1's `glow` field is rare-only (`when: isRare`), so links can't make
   common nuclear fish glow, and emissive parts carry it today. Make glow a fish4 field, or let
   the terrain lift the gate for nuclear and lava. A terrain gate is enough.
5. **Character params.** Add `character.axes` (weights per axis), `character.archetypes`
   (add or remove centres), `character.quirks.extra` and `character.thresholds`, so a game mode
   can lean personalities (a "cozy" mode with fewer Bruisers).
6. **Haiku text pass.**
   - Fill `text.voices` (scientific, playful, legend weights) and `text.library`.
   - Generate library entries offline with Haiku 4.5, keyed by terrain, region, niche, archetype,
     quirk and voice.
   - Lint them with the lore guide (`docs/lore-writing-guide.md`): no stray tokens, the Seedfall
     tone, and nuclear fish stay radiant and harmless.
   - Ship them as data, never at runtime.
7. **Mimicry.** Some species copy another species of the same region: a harmless fish takes the
   pattern and colours of a venomous one. It works as a clade-level link to a "model" prototype.
   The character side: "is mistaken for a lionfish and enjoys it".
8. **Juvenile colour phases.** Fry and juveniles show a different pattern or pigment: spots that
   fade, or a bright juvenile that darkens. It is a stage-gated paint pass with data per
   species.
9. **More dimorphism.** Today, sex only nudges a few fields. Add per-niche dimorphism tables
   (males with sails or crests, females larger), applied after the individual roll.

## 5. Later, if a body plan needs it

A new painter mode is only justified for shapes that do not fit back and belly profile
keypoints:

- radial (jelly-like drifters for the void)
- segmented (eel-chains for the reactor lake)
- multi-bodied (colonial fish)

Keep them in fish4 as further forms, so the genome, breeding, stats and character stay shared.

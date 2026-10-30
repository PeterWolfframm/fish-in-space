# Plan: the fish4 roadmap items

A build plan for every item in `docs/fish4-roadmap.md`. Section numbers match the roadmap. The
studio (§3, species atlas) and the `extend-fish4` skill (§3) have their own plans:
`01-studio.md` and `03-extend-fish4-skill.md`. The Haiku text pass (§4.6) is `02-haiku-text.md`.

## Current state, checked 2026-10-30

- fish4 is on `main` in pixelforge (`src/v4/fish/`, about 40 modules), with
  `test/fish4.test.mjs`.
- **The game already decodes fish4.** `~/Code/aquarium/src/game/fish.ts` imports
  `@forge/v4/fish`, rolls wild fish with `WATER_PLACE` and shop and colony fish with `classic`.
  But it only uses the fish3-shaped API (`fromSeed`, `breedDetailed`, `ecology`, `lore`,
  `frame`). It uses none of fish4's systems: no `characterOf`, `compatibility`, `batch`,
  `canBreed`, `broodLimit`, `valueOf`, `behaviourProfile` or `RARITY_COLORS`.
  `SAVE_VERSION` is 4.
- Two fish3 tests fail on `main` and predate fish4: "two commons never make a signature except by
  a sport" and "lore: complete, stable, no stray tokens, not the camera".

**Progress, 2026-10-30:** Step 0 and §1.1 are done. `npm test` is 118/118 green in pixelforge,
and `~/Code/aquarium` typechecks with 64/64 green against the re-vendored forge.

## Step 0. Get to green — DONE

Fix the two failing fish3 tests before anything else. A red baseline hides new breakage, and
every later step relies on "tests stay green".

**What it was.** Both were stale tests, not broken rules.

- *Signature:* two rare parents can produce a **myth** child, and a myth shows no signature
  (`phenotype.js` only resolves one for `rarity === 'rare'`, which a neighbouring test pins).
  The test counted myth children as counter-examples. It now excludes them and still asserts
  that every non-myth child carries a parent's signature, and that both `crown` and `halo` show.
- *Lore:* the test expected rare **and myth** fish to have a legend, but a legend is the story of
  a signature or a relic, and relics were removed (`RELICS = []` in `genome.js`), so a myth has
  neither. The expectation is now `rarity === 'rare'`; two stale comments in `lore.js` and
  `lore-data.js` were corrected to match.

*Original notes:*

- **Signature test:** find the seed that breaks it (the test prints it, or bisect the sample),
  then decide if the rule or the test is wrong. If breeding really can produce a signature from
  two commons without a sport, the fix is in `breeding.js`, behind a check that fish3 goldens do
  not change. Otherwise tighten the test's sample.
- **Lore test:** run it and read which check fails (stray token, unstable line or "the camera").
  It is most likely a data line in `lore-data.js`; fix the line.

## §1. Before anything stores fish4 codes (do first)

### 1.1 Freeze `f4` — DONE

Covered in full by the prerequisite in `03-extend-fish4-skill.md`: the golden codes test, the
field-order lint, the salt map script and the `ecotype-1` algo bump. Do it first, because the
game already stores codes that decode as fish4.

**What landed:**

- `test/fish4-golden.test.mjs` + `test/fixtures/fish4-golden.json`: 8 presets × 16 seeds → code,
  `swim` and `dead` prints, plus a second test that re-opens every stored code and repaints it.
- `test/fish4-fields.test.mjs` + `test/fixtures/fish4-fields.json`: the 95-field snapshot
  (id, salt, choice order). Appending passes and prints what to refresh; moving, re-salting or
  removing fails. It also checks the 36-choice code-digit limit and field salt uniqueness.
- `scripts/fish4-salts.mjs`: the live salt map (117 salts) with the next free salt per range and
  `--check` for CI. Two ranges are **full**: chroma (2048) and loci (2064–2543, exactly 15×32),
  so a 16th locus needs a wider range.
- `algo` is now `ecotype-1`, with `isEcotype()` in `params.js` keeping plain `ecotype` working as
  an alias for the newest roll. The goldens were written *before* the bump and are unchanged
  after it, which is the proof it re-maps nothing.
- `docs/fish4.md` and `docs/fish4-params.md` updated; the "not frozen yet" warning is gone.

Note on the one deviation from the prerequisite as written: the fixtures are written by the tests
themselves under `UPDATE_GOLDENS=1`, the way `test/fish3-golden.test.mjs` already does, rather
than by a new `fish4` target in `scripts/make-goldens.mjs`. That script exists to capture goldens
from *other* checkouts (the original game, yeswar); fish4's come from this repo.

### 1.2 Region-aware care temperature

- In `data/terrains.js`, add `loci: { thermal: <shift> }` to the regions that need it: icemoon
  and deep cold (−3 to −4 allele steps), reef and riverlands warm (+2), nebula mild. This uses
  the same locus-shift mechanism niches already have.
- In `stats.js`, add a region baseline step for `idealTempC` before the locus contribution,
  with `because: ['from the icemoon: cold water']`.
- **Code stability:** the shift changes the *roll* of new fish, not the decode of a stored code
  (the alleles are in the code). Stats of stored fish change only through the new baseline. That
  is fine, since stats are derived, but bump `STATS_VERSION`.
- **Test:** median `idealTempC` per region over 2,000 seeds is ordered icemoon < deep < pelagic
  < reef. No icemoon fish above 18 °C.

**DONE.** What landed:

- The six water regions carry `loci: { thermal }` in `data/terrains.js`: riverlands and reef +2,
  nebula +1, pelagic −1, deep −3, icemoon −4.
- `lociWeights` in `ecotype.js` now takes the whole `where` and adds the region's shift to the
  niche's, so an icemoon lurker is colder than either on its own. Measured median thermal allele:
  icemoon 0.267, deep 0.300, pelagic 0.433, reef 0.633.
- `stats.js` gained step 3, "the region's water", between the family priors and the loci (the
  later steps renumbered). It pulls `idealTempC` from the body's own preference toward the
  region's by `REGION_THERMAL.blend` (0.75), with the region's warmth read off the same thermal
  shift at `REGION_THERMAL.step` (0.083 of the 2–38 °C band, about 3 °C per allele step). The
  evidence line reads `from under the ice: cold water`.
- `STATS_VERSION` 2 → 3, with the v3 note in `stats-data.js`.
- Test `region water: a fish is as warm as where it lives, not only what it descends from` in
  `test/fish4.test.mjs`. Medians over 2,000 seeds each: icemoon 7.6 < deep 9.2 < pelagic 17.3 <
  reef 26.6 °C, nothing under the ice above 18 (its warmest is 14.6).
- The roll moved as intended, so `test/fixtures/fish4-golden.json` was refreshed under
  `UPDATE_GOLDENS=1`. `test/fixtures/fish4-codes.json` was **not** touched (md5 identical before
  and after) and still passes: a stored code opens as the same fish it always did.

Why the stat step pulls rather than adds: icemoon's bodies (angler, oarfish, blobfish, hatchet)
carry temperate ecology from fish3, so their median ran 16.4 °C and 667 of 2,000 sat above 18.
A flat additive shift big enough to fix that pinned a third of them to the 2 °C floor. Blending
toward the region's own water fixes the ordering and keeps a 10 °C spread inside the region.

### 1.3 Niche-aware diet

- Let niches set diet odds: `NICHES.<id>.weights.diet` (ambush and pursuit → carnivore or
  piscivore, grazer → herbivore, sifter → detritivore). These are weight multipliers through
  `weightOf`, like the other niche weights.
- Re-check batches: `LEVEL_OF_DIET` reads diet, so run `batch` over 200 seeds and check the
  trophic pyramid param still holds.
- **Test:** no grouper ambusher is a detritivore over 2,000 seeds; the batch pyramid test still
  passes.

**DONE**, but not the way the step was written. `diet` is not a rollable field: `ecology.js`
reads it off the jaw, then a lure or barbels, then the body's own `habitat.diet`. So there was no
`weights.diet` for `weightOf` to multiply.

What landed instead: a niche declares `diet` (diet id → multiplier) in `data/terrains.js`, and
`dietWeights()` in `ecotype.js` resolves it onto the choices that actually decide a diet, through
a `DIET_SOURCES` map built from `DIET_BY_JAW` plus the two extras rules (`barbels` → detritus,
`lure` → fish) and `underbite` → detritus. `leaningsOf` stacks it under the niche's own weights,
so an explicit `weights.jaw` still composes with it. Four niches carry a table: grazer, ambush,
pursuit, sifter.

Measured over every region that offers each niche (400 seeds per region):

| niche   | on-niche before | after | detritivore before | after |
| ------- | --------------- | ----- | ------------------ | ----- |
| ambush  | 71%             | 96%   | 21%                | 0%    |
| pursuit | 52%             | 76%   | 1%                 | 0%    |
| grazer  | 85%             | 96%   | 1%                 | 0%    |
| sifter  | 19%             | 53%   | 19%                | 53%   |

The headline bug the step was really about: **70% of reef grouper ambushers were detritivores.**
A grouper sits on the bottom, 42% of reef ambushers rolled an underbite, and `ecology.js` turns
underbite + bottom into a detritus eater before the body's own piscivore habitat gets a say. It
is now 0 in 2,000.

Two things worth knowing for the next step that tunes these tables:

- A region + niche is a handful of sticky clades, not a smooth distribution, so **one prototype's
  jaw decides 60–70% of its population.** Squeezing one diet down just moves the lock to the next
  jaw: holding sifter's `herbivore` at 0.5 gave 63% lips/herbivore, 0.25 gave 63% beak/durophage.
  Tune against *every* region that offers the niche, never one.
- `jaw: 'auto'` (60 of ~100 base weight) means "as the body", and no diet multiplier reaches it —
  that fish eats what its body record eats. The remaining sifter piscivores and carnivores are the
  deep's coelacanth and sturgeon doing exactly that, which is correct.

Test: `niche diet: a hunter hunts and a sifter sifts, whatever jaw it was dealt`. It asserts no
grouper ambusher is a detritivore over 2,000 reef seeds, >90% of them hunt, grazers crop >85%,
and a sifter eats detritus more often than it eats meat. The `batch` trophic pyramid test still
passes untouched. Goldens refreshed (the roll moved); `fish4-codes.json` untouched and passing.

### 1.4 Name repetition

- In `src/v4/fish/names.js`, after building the common name, compare word stems (lowercased,
  punctuation stripped). On a repeat, re-pick the colour or fin word from the next candidate
  with a new salt (deterministic).
- **Test:** over 5,000 seeds, no common name repeats a word. Golden names for seeds without a
  repeat are unchanged.

**DONE**, in `src/v3/fish/names.js` rather than fish4's, because that is where the three parts of
a common name still exist as separate words: `[modifier] [colour]-[part] [noun]`. By the time
`namesOf4` sees it, it is one string. `namesOf(genome, ext, { dedupe })` is **off by default**, so
fish3's fish keep the names they have always had, and `namesOf4` passes `{ dedupe: true }`.

- `saysTwice(pieces)` decides it, on two narrow rules: the words share a stem (`stem()` strips
  `ed|ing|s` then a trailing `e`, so Spine-/‑spined and Fanged/Fang match), or one **whole** word
  opens or closes the other with 3+ letters left over (Glass- inside Glassback). The second rule
  compares whole words on purpose: on stems it would call "Ink-barred Barracuda" (barr…,
  barracuda) a repeat. Only words from *different* parts are compared, so a compound noun is free
  to repeat itself.
- On a repeat it tries, in order, four other nouns for the taxon, four other body parts, four
  other lead words, then dropping the lead word, then dropping the colour — each on its own salt
  (30+k, 36+k, 42+k in the `roller(ph.seed, 8800)` band), so a fish keeps one name for good. If
  nothing clears it the name stands: a wrong word is worse than a repeated one.
- The colour is never re-picked, only dropped as a last resort — it is what the fish looks like.

Measured over 5,000 fish4 seeds: **102 repeats before, 0 after**, and exactly those 102 names
changed — the overlap is perfect, nothing else was renamed. Examples: "Thick-lipped Dune-tailed
Dune-hopper" → "… Sandskipper", "Veiltail Glass-saddled Glassback" → "… Silica", "Cheek-spined
Coral-spined Disc" → "… Coral-backed Disc", "Fanged Slate-mottled Fang" → "… Ripper".

Known miss, about 1 in 5,000: "Wide-mouthed Sandstone-striped Pitmouth". `mouthed` is not the
whole word `mouth` and its stem is not `pitmouth`'s, so neither rule fires. Catching it means
seam-matching on stems, which brings the Barracuda false positive back. Left as is.

The roadmap's other half of the test — "golden names for seeds without a repeat are unchanged" —
is the `changed`/`saysTwice` cross-check inside the test rather than a fixture: it asserts the
property for all 5,000 seeds, which a golden file of names could not.

The fish4 goldens needed no refresh: names are not in the pixel prints.

### 1.5 Eye stamps 7 and 8

- In `src/v3/fish/draw.js`, add 7 and 8 px stamps to `EYES`, used only when `detail: 'v4'` passes
  a cap above 6 (`eyeCap` in the existing `detailScale` pass-through). The default cap stays 6.
- **Test:** fish3 goldens unchanged. A giant fish4 fish's eye is 7 px or more.
- Look at a growth ladder (studio M5 or a `cli/forge.mjs` sheet) to make sure the bigger eyes
  read well.

**DONE**, with one deviation the plan did not foresee: this is the first phase that changes
*painting* rather than *rolling*, and `test/fixtures/fish4-codes.json` promises that a stored code
paints the same pixels for ever. Lifting the cap on `detail: 'v4'` would have broken that promise
for every giant already saved. So the cap rides a **new `detail` choice, `v4e`** ("Scaled detail,
big eyes"), appended to the field in `genome.js` — the append-only discipline the format is built
on. `v4` still draws a 6 px eye; `ecotype.js` now rolls `v4e`, so new fish get the big eye and old
ones keep their faces. The codes fixture passes untouched (md5 `91e51aa0…` before and after); only
`fish4-golden.json` was refreshed, and the only field that moved in all 112 changed codes is
`detail: v4 -> v4e`.

There were two caps, not one:

- `phenotype.js` had `eyeSize = min(6, …)` baked in. It now also returns **`eyeWant`**, the size
  before the cap. fish3 reads only `eyeSize`, so nothing of fish3's moves.
- `draw.js`'s `eye()` clamped to 6 again. It now reads `ctx.eyeCap` (default 6) and `ctx.eyeGrow`
  (default 0), so with no generator setting them the arithmetic is exactly fish3's.

`frame.js` sets both from the same `detailScale` measure the texture uses:
`eyeCap = min(8, 6 + round((d - 1) * 2))`, `eyeGrow = eyeCap - 6`. The ladder, over five seeds
(tiny → giant):

| seed  | v4e              | v4 / fish3       |
| ----- | ---------------- | ---------------- |
| eye-1 | 3 3 4 5 **6 8**  | 3 3 4 5 5 6      |
| eye-2 | 2 2 2 3 **4 6**  | 2 2 2 3 3 4      |
| eye-3 | 2 2 3 4 **5 7**  | 2 2 3 4 4 5      |
| eye-4 | 3 3 4 5 **6 8**  | 3 3 4 5 5 6      |
| eye-5 | 2 2 2 3 **4 6**  | 2 2 2 3 3 4      |

Nothing below `huge` moves a pixel, and a small-eyed fish stays small-eyed — `eye-2` tops out at
6, where a big-eyed fish reaches 8. The growth is still monotonic, which it was not before: fish3
flattens at huge→giant because both clamp to 6.

Looking at the renders turned up one real problem the stamps alone did not cause. A **derpy** fish
repaints its whole stamp as sclera and drops two pupil pixels in the bottom corner; at 8 px that
is 2 pixels in 64, and the eye read as a flat dark disc with nothing in it. The pupil now grows
with the stamp (`pw = size >= 4 ? max(2, size - 4) : 1`, two rows at 7+), which is **exactly the
two pixels fish3 has always drawn** at 6 px and under. The other styles needed nothing: 7 px and
8 px round and sparkle eyes read with a clear sclera, pupil and glint.

**Test:** `'eye stamps: a fish4 giant looks you in the eye, and nothing smaller changes'` in
`test/fish4.test.mjs`. Every stamp is square and uses only `SPHh.`; 7 and 8 exist; tiny, small and
medium fish paint **byte-identical** frames under `v4` and `v4e`; and a giant's two frames differ
in a single blob at least 7×7 across — the texture is the same either way, so whatever moved is
the eye. `EYES` is exported from `draw.js` for the first half. fish3's goldens pass untouched.

## §2. Game integration (aquarium)

This work happens in `~/Code/aquarium`. Re-vendor after §1. Each item below is a separate PR.

### 2.0 Typed fish4 API and save version 5

- Replace the `Fish3` interface in `src/game/fish.ts` with a `Fish4` interface that adds the
  systems the game is about to use: `characterOf`, `compatibility`, `batch`, `canBreed`,
  `breedClutch`, `reproduction`, `valueOf`, `eggCost`, `statsOf`, `behaviourProfile`,
  `rarityOf`, `RARITY_COLORS`, `TERRAINS`, `REGIONS`.
- `SAVE_VERSION` 5, with a `migrateV5` in `game/state.ts` that adds `broods: 0` to each fish and
  a `regions` unlock list. Codes stay as they are (they already decode).
- **Test:** load a v4 save fixture, migrate, and check every fish renders identical pixels
  before and after.

### 2.1 Breeding and economy through fish4

- `actions.ts` breed: `breedClutch` (clutch size), fertility as a spawn chance, a per-fish
  cooldown from `reproduction`, `eggCost`, and the `broods` counter checked with `canBreed`.
  Show `breedProblem` text when refused.
- `tick.ts`: growth uses `maturationMul`.
- `market.ts`: `priceOf` calls `valueOf`.
- Rarity colours from `RARITY_COLORS` in `ui/theme.ts` (and the tier label in the fish card).

### 2.2 Shop and wild catches as batches

- A shop day is `batch(daySeed, n, P, …, { terrain })`: one terrain and one balanced shoal per
  day. Wild catches use the same with the expedition's region pinned.
- Keep `classic` for colony orders until terrain tanks exist, so orders always fit a biome.

### 2.3 Terrain tanks

- Tanks get a `terrain` (water, lava, sand, coolant). Each has its own backdrop on the dark lab
  with space and a planet behind it.
- `compatibility` returns 0 across terrains, so the UI shows "needs its own tank" when moving a
  fish to the wrong one, and the move is refused.
- Buying a new terrain tank is a progression unlock.

### 2.4 Region discovery

- `REGIONS[...].unlock` and `TERRAINS[...].locked` already gate places. Add expeditions that open
  regions (the Glass Flats, the Cooling Lake first). Aether stays locked until the Mythic arc.
- The save keeps `regions` (from 2.0). The shop and catches only roll unlocked places.

### 2.5 Character in the UI

- Fish card: archetype, traits, quirks and blurb (`characterOf`, `blurbOf`).
- Care sheet (`careLine`, stats): drives tank warnings (temperature, pH, crowding, schooling
  size).
- "Will they get along" hint when adding a fish to a tank, from `compatibility`.

### 2.6 Behaviour models

- The tank scene reads `behaviourProfile` (stats v2): swim speed, zone, schooling, circadian.
- Map terrain stats to visuals: `burrowing` → sand burrowing, `armour` → lava plating,
  `luminosity` → glow at night.
- Expressions: happy, tired and dead anims picked from hunger and stress.

### 2.7 Pacing in hours

- Once 2.1 lands, read the game's real timers into `sim.TIMING` (or pass them in) and run
  `sweep` against them. Studio M4 shows both axes.
- Retune `breeding.cooldownMul` and `maturationMul` so tiers land in play time: Legendary in
  about a week of casual play, Mythic as a long goal. Save the result as the `seedfall` preset.
- **Test:** the sim pacing bands in hours, under the `seedfall` preset.
- **Play check:** an e2e or manual breeding loop that reaches Rare in about 30 minutes.

## §3. Tools

- Studio and species atlas: `01-studio.md` (M3 is the atlas).
- `extend-fish4` skill: `03-extend-fish4-skill.md`.

## §4. Generator features, in order of value

Each feature is added with the `extend-fish4` skill once it exists, which also checks the skill.

1. **Terrain hybrids and bridge crosses** (large).
   - Add bridge regions: the vent shore (lava + water) and the glass lagoon (sand + water). A
     bridge region has `terrains: [a, b]`.
   - Bridge fish carry a dual medium; `compatibility` and `breedProblem` accept either side.
   - Children of a bridge fish carry a new `bridge` locus (fresh salt). Two high-`bridge`
     parents from different terrains can cross; the child takes one parent's terrain by hash.
   - Rarity: crosses add surprisal. Tests: bridge breeding is deterministic, ordinary cross-
     terrain breeding is still refused, no fish ends up with an invalid medium.
2. **Sand gait** (medium). A `sandSwim` motion in `src/v4/fish/motions.js`: the body under a sand
   line with only the dorsal and eyes showing, a sand plume behind, and periodic leaps for the
   sandskipper. Needs a mask channel in `frame.js` to clip below the sand line. Window test at
   every size.
3. **Stronger links** (small to medium). Add `links.speciesStrength`, applied when the prototype
   is built, and links that read loci (bold → bright colours, shy → countershading). Measure the
   effect with the clustering readout before and after.
4. **Glow for nuclear fish** (small). Lift v1's `glow` rare-only gate by terrain: nuclear and
   lava may roll glow at common tiers. This is a fish4 `weightOf` change, not a v1 edit. Test
   that nuclear commons can glow and that v1 output is unchanged.
5. **Character params** (small). `character.axes`, `character.archetypes`,
   `character.quirks.extra` and `character.thresholds` in params and `PARAM_SCHEMA`. Ship a
   `cozy` preset with fewer Bruisers. Test the archetype distribution moves with the params.
6. **Haiku text pass**: `02-haiku-text.md`.
7. **Mimicry** (medium). A clade-level link to a "model" prototype in the same region: a
   harmless species takes a venomous species' pattern and colours. A `mimic` fact for text and
   a quirk ("is mistaken for a lionfish and enjoys it").
8. **Juvenile colour phases** (medium). Stage-gated paint pass with per-species data: spots that
   fade, or a bright juvenile that darkens. Applied in `frame.js` from `stage`. Check on the
   growth ladder.
9. **More dimorphism** (small to medium). Per-niche dimorphism tables (males with sails or
   crests, females larger), applied after the individual roll with a fixed salt.

## §5. Later, if a body plan needs it

Radial, segmented and multi-bodied painter modes. Do not start these until a concrete creature
needs one (for example, void jellies for the Mythic arc). When one does, it gets its own plan.
The rule from the roadmap stands: new modes are fish4 forms, so the genome, breeding, stats and
character stay shared.

## Order

1. Step 0 (green baseline).
2. §1.1 freeze `f4`, together with the skill prerequisite.
3. §1.2–1.5 (each small, one commit each).
4. Studio M1–M2, then the skill (they are faster to build than to do without).
5. §2.0 → 2.1 → 2.5 → 2.2 → 2.7 (core game loop on fish4, then pacing).
6. §4.4, 4.5, 4.3 (small wins), then 2.3 and 2.4 with §4.1 and §4.2 (terrains as a feature set).
7. Haiku text pass, once there are enough places and characters to write for.
8. §4.7–4.9.

## Done when

- `f4` is frozen and guarded.
- Care and diet follow region and niche.
- The game breeds, prices and shows fish through fish4 systems, with terrain tanks and region
  progression.
- Pacing is tuned in play hours.
- Each §4 feature has landed through the skill with tests.

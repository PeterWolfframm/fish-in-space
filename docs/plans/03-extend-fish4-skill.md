# Plan: the `extend-fish4` skill

Phase 7b of the PixGen V4 plan, updated with the recipe list from the roadmap (§3). `loci.js`
already points readers to `.claude/skills/extend-fish4`, which does not exist yet.

## Goal

An agent (or a person) can run `/extend-fish4 <kind> <id> [description]` and add one thing to
fish4 without breaking stored codes, golden prints or determinism. The skill gives the exact
files to touch, the append-only rules, the tests to run, and a visual check, then ends with a
short report.

## Prerequisite: freeze `f4` first (roadmap §1.1) — DONE 2026-10-30

The skill's main promise is "old codes and pixels survive", and nothing enforces that for `f4`
yet. Do this before writing the skill, or the skill will describe rules the tests do not check.

All four items landed; see `04-fish4-roadmap.md` §1.1 for what each one does. The skill can now
tell an agent to run `node scripts/fish4-salts.mjs --check`, `node --test test/fish4-fields.test.mjs`
and `node --test test/fish4-golden.test.mjs`, and those checks will actually hold it to the rules.

1. **Golden codes test** (`test/fish4-golden.test.mjs`): a fixed list of seeds × presets
   (`classic`, `ecotype`/default, `vivid`, `wild`, `curated`, `seedfall`) → code strings and
   frame hashes for `swim` frame 0 and `dead` frame 0. Fixtures written by
   `scripts/make-goldens.mjs` (extend it with a `fish4` target).
2. **Field-order lint** (`test/fish4-fields.test.mjs`): a committed snapshot of
   `fish4Traits.fields` (`id`, `salt`, choice ids in order). The test fails if a field moves, a
   salt changes or is reused, or a choice is removed or reordered. Appending passes; the test
   prints the snapshot line to add.
3. **Salt map script** (`scripts/fish4-salts.mjs`): prints every salt in use (fish3 fields,
   fish4 fields from 2048, loci from 2064 in steps of 32, feature fields, `roller` salts used
   by `ecotype.js`, `batch.js`, `text.js` and others found by grep), and the next free salt in
   each range. `--check` fails on a collision. The skill tells the agent to run this, rather than
   pasting a table that will go stale.
4. Bump `algo` to `ecotype-1`, as the roadmap says.

## Files

```
.claude/skills/extend-fish4/
  SKILL.md               frontmatter, hard rules, the common steps, the kind table
  recipes/
    form.md              a new body form (fish4 NEW_FORMS)
    place.md             a region or a niche
    terrain.md           a terrain
    locus.md             a quantitative locus
    link.md              a link, a breeding kit or a guard constraint
    feature.md           a feature module (defineFeature)
    look.md              a pattern, colour, pigment, allele, jaw, tail, dorsal or marking
    character.md         a quirk, like, fear or archetype
    rule.md              a stat rule
    text.md              text library entries (hands off to the Haiku workflow)
    stat.md              a new stat (bumps STATS_VERSION)
```

Splitting the recipes keeps `SKILL.md` short. The agent reads only the recipe for its kind.

## `SKILL.md` contents

**Frontmatter**, in the style of `add-animation`, `fish-keys` and `write-lore`:

```yaml
name: extend-fish4
description: Add a body form, region, niche, terrain, locus, link, guard, feature module, look,
  quirk, archetype, rule, stat or text to the fish4 generator without breaking stored codes or
  golden prints, e.g. "/extend-fish4 form glassray" or "add a coral reef niche".
argument-hint: <kind> <id> [description]
```

**Hard rules** (each one with the test that enforces it):

- Never edit `src/gen/**` (v1, frozen) or `src/pixel/**` (vendored). Enforced by `v1-frozen`,
  `parity` and `vendor` tests.
- fish3 is append-only and pixel-identical: never reorder or remove choices, never change a
  salt. Enforced by `fish3-golden` and `fish3` tests.
- fish4 fields and choices are append-only, with an explicit fresh salt from
  `scripts/fish4-salts.mjs`. Enforced by `fish4-fields`.
- `NEW_FORMS` order is the `form` digit in the code: append only.
- Deterministic: no `Math.random`, no `Date`, no iteration over object keys whose order could
  change. Rolls use `roller` or `hash01` with a salt.
- Edit `src/` only, then run `node aquarium/scripts/vendor-forge.mjs`. Never edit
  `aquarium/forge` directly.
- Text follows `docs/lore-writing-guide.md` (Seedfall tone; nuclear fish are harmless).

**Common steps** for every kind:

1. Parse `$ARGUMENTS`. Map the user's words to a kind using the table below. If an item with
   that id exists, ask whether to change it or add a variant.
2. Read the recipe for the kind, and the files it lists, before editing.
3. Run `node scripts/fish4-salts.mjs` if the kind needs a salt.
4. Make the edits.
5. Run `npm test`. All fish3, fish4, golden and field tests must pass. If a golden changes, stop:
   the change was not append-only. Fix it rather than regenerating goldens, unless the user
   explicitly asks for a breaking change.
6. Run `node aquarium/scripts/vendor-forge.mjs`, then `--check`.
7. **Look at it.** Render a check sheet with `node cli/forge.mjs` (sizes × stages × anims for
   the new item, using pinned seeds or place pins that show it) and open the PNG. If the studio
   is running, give the studio URL with the right hash instead.
8. Check coverage: `node scripts/text-coverage.mjs --missing` (once it exists) for text gaps the
   new item opened. Offer `/write-lore` or the Haiku text pass to fill them.
9. Report: what changed (files), which salts were used, the seeds or place pins that show the
   item, and any text gaps left.

**Kind table:** kind → recipe file → one-line summary.

## Recipe contents (one example in full, the rest in outline)

### `form.md` (a new body form)

1. Pick the terrain file in `src/v4/fish/bodies/` (`water`, `lava`, `sand`, `nuclear`).
2. Append a record: `{ id, label, terrain, kin, weight, arch, habitat, taxon, family, anatomy,
   leanings, pigments? }`. `kin` is the nearest fish3 body: the painter draws through it.
3. Add the family in `taxonomy-data.js` if it is new, with stat priors.
4. Add the form to niche body lists in `data/terrains.js` where it lives.
5. Add name words and a Latin root (names data), so `namesOf4` can name it.
6. Optional: a link kit in `data/links.js` and anatomy parts in `parts/anatomy.js`.
7. Tests: add the form to the "every form draws in its window at every size × anim" sweep if it
   is not picked up automatically, and a test that a pinned place rolls it.
8. Check sheet: the form in each of its regions × niches.

### Outlines for the others

- **place.md:** region (`REGIONS`: label, terrain, bodies, weights, palette, sports, loci shifts,
  mutation, unlock) or niche (`NICHES`: weights, loci, diet odds once roadmap §1.3 lands). Add
  origin text. Check clustering numbers do not drop (the atlas readout or the fish4 cluster
  test).
- **terrain.md:** `TERRAINS` record (medium, temperature band, pigments, foods), guards for it,
  regions, at least two forms, `compatibility` across terrains, and whether it is locked. The
  largest recipe; it links to `form.md` and `place.md`.
- **locus.md:** append to `LOCI` (salt from the script, 32 apart for A and B), the bell weights,
  its stat contributions in `stats.js` with `because`, and niche or region shifts. Bump
  `STATS_VERSION` if `behaviourProfile` changes shape. Imported fish get it from the latent
  roll, so check an f3 import still draws identically.
- **link.md:** `data/links.js` (links, kits) or `data/constraints.js` (guards). Run the guard
  test over 2,000 seeds and check the violation rate.
- **feature.md:** `features/<id>.js` with `defineFeature` (field with explicit salt, `when` /
  `excludes` / `requires`, `influences`, `params`, `layer`, `draw`), one line in
  `features/registry.js`, a draw test at every size, and lore keys. Use `helmet.js` as the
  template.
- **look.md:** fish3 visual choices (pattern, jaw, tail, dorsal, marking, allele): append the
  choice, add the painter branch, name words and `PATTERN_PARTS`. This touches `src/v3`, so the
  fish3 golden must still pass: new choices must have weight 0 under `classic`, or be fish4-only
  through params.
- **character.md:** `data/character.js` (axes, archetype centres, quirks, likes, fears) and
  matching text. Check the archetype distribution stays balanced over 2,000 seeds.
- **rule.md:** `data/rules.js` with the DSL, a `note`, and a test that it fires on a known seed.
  Preview in the studio Rules panel.
- **text.md:** points to the Haiku plan's workflow and the lint. Hand entries go in
  `data/text-library.js`.
- **stat.md:** the `STATS` registry entry, its composition step, docs in `docs/fish4-stats.md`
  and the `STATS_VERSION` bump.

## How to test the skill itself

Use the `skill-creator` skill's eval loop:

1. Three eval prompts of increasing size: a `rule` (small), a `form` (medium), a `place` (a new
   region with two forms, large).
2. Run each in a fresh worktree with the skill and without it.
3. Grade on: tests green, no golden changes, salts fresh, vendored copy in sync, a check sheet
   produced, a report given. Note what the agent got wrong and fix the recipe text.
4. Tune the `description` so that "add a new fish body" and "new region for fish" trigger it,
   and fish3-only or v1 requests do not.

## Order and size

1. Freeze `f4` (prerequisite): about a day.
2. `SKILL.md` and the `form`, `feature`, `rule`, `locus` recipes: half a day.
3. Evals and fixes: half a day.
4. The remaining recipes, each written the first time that kind is actually added (for example,
   `place.md` with the roadmap's bridge regions). Each is validated by real use.

## Done when

`/extend-fish4 form <id>` in a fresh session adds a form that draws at every size, passes all
tests with no golden changes, is vendored, and is shown in a check sheet, without the user
pointing at any file.

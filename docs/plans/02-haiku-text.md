# Plan: Haiku text matching (Phase 7)

Phase 7 of the PixGen V4 plan, merged with roadmap item §4.6 ("Haiku text pass").

## What already exists

- `src/v4/fish/text.js`: `textFor(set, pool)` and `textOf(set)`. It matches library entries
  against the fish's character `look` with `rules.js` `test`, sorts by `priority` then
  `specificity`, picks an entry and a line by the fish's key, fills `{tokens}`, and falls back
  to fish3's `loreOf`.
- `src/v4/fish/data/text-library.js`: about 52 hand-written entries in 5 pools (`tagline`,
  `origin`, `codex`, `care`, `quote`). Each entry is `{ id, pool, when, priority?, lines[] }`.
- `params.text`: `{ voices: { scientific, playful, legend }, humour, library }`. **None of these
  are read yet.**
- `docs/lore-writing-guide.md` and `scripts/lore-coverage.mjs` (fish3 keys only).

So matching works. What is missing is voices, review status, a way to generate lines in bulk,
a way to see gaps, and checks that keep generated text on tone.

## Hard rules

- **The game stays deterministic.** Haiku runs only at authoring time, in the studio or a CLI
  script. Its output is committed as data. Nothing calls an LLM at runtime.
- **The API key never reaches the browser.** The call goes through the studio's dev-server
  middleware, which reads `ANTHROPIC_API_KEY` from the shell env.
- **Only approved lines ship.** Drafts live in the same file but `textFor` skips them.
- **Tone:** Seedfall (hopeful, warm, a little cheeky, Star Trek-like utopia, never grim). Nuclear
  fish are radiant and harmless.

## Step 1. Extend the entry format (generator, no LLM yet)

New optional fields on each entry:

| Field | Values | Default |
|---|---|---|
| `voice` | `scientific`, `playful`, `legend` | none (fits any voice) |
| `status` | `draft`, `approved`, `rejected` | `approved` (so hand-written entries need no edit) |
| `source` | `hand`, `haiku` | `hand` |
| `model` | model id that wrote it | none |
| `tiers` | list of tier ids | none (any tier) |

Changes to `text.js`:

- Filter out entries whose `status` is not `approved`.
- **Voice choice:** pick the fish's voice once per pool with `hash01(key + ':voice:' + pool)`
  over `params.text.voices` weights. Among the best-matching entries, prefer ones with that voice
  or with no voice. If none exist, use any voice, so a missing voice never yields no text.
- **Humour:** `params.text.humour` (0..1) scales the weight of `playful` before the voice roll.
  Keep it a weight change, not a filter.
- `params.text.library` picks a library by id. `default` is the current one. This allows an
  alternative library (for example a kids' mode) without code changes.
- Keep `textFor`'s return shape and add `voice` to it.

**Stability note:** adding entries can change which line an existing fish shows, because the
pick is a hash over the set of best matches. That is acceptable, since text is derived, never
stored. Document it in `text.js`, and make sure the game never saves rendered text.

Tests (`test/fish4.test.mjs`):

- Drafts and rejected entries never appear.
- The voice roll is deterministic and follows the weights over 2,000 seeds (within a tolerance).
- With `voices: { legend: 0 }`, no legend lines appear when other lines match.
- Old outputs for hand-written entries are unchanged under the default params (golden over 50
  seeds). This needs the default voice roll to leave hand-written entries alone, which holds
  because they have no `voice`.

## Step 2. Facts catalogue and token list

Haiku and the studio both need to know what a condition can test and which tokens exist.

- `rules.js`: export `factsCatalogue(sample?)`. It lists every testable key (facts, stats, loci,
  fields, features, tier, size), with its type, range or possible values, and, from a sample of
  fish, how often each value occurs.
- `text.js`: export `TOKENS` (the keys of `tokensOf`) with a one-line description each.
- A test that every `{token}` used in the library is in `TOKENS`, and every `fact` used in a
  `when` is in the catalogue.

## Step 3. Split the library: hand file plus generated file

- Keep `data/text-library.js` for hand-written entries.
- Add `data/text-library.studio.json` for generated and studio-edited entries, merged by the
  `.js` module (the same pattern as in the studio plan). The studio and the CLI write only this
  file.
- Generated ids are stable: `h-<pool>-<8-char hash of when + first line>`. Re-generating the
  same text never duplicates an entry.

## Step 4. The lint (`src/v4/fish/text-lint.js`)

A pure function `lintEntry(entry, catalogue)` → `{ errors, warnings }`. It runs in tests, in
the studio and on every Haiku candidate before a person sees it.

- **Errors:** unknown token, unknown fact or value in `when`, empty lines, a line over the pool's
  length cap (tagline ≤ 60 characters, codex and care ≤ 160, quote ≤ 140), a duplicate line.
- **Tone warnings:** a word list from the lore guide (death, kill, toxic, poison, radiation
  sickness, meltdown, …). For `terrain: nuclear` lines, a stricter list (harm, danger, sick).
  A quote without an attribution style the guide allows.
- **Style warnings:** "the camera" (an existing fish3 test bans it), second person in codex
  lines, exclamation marks over one per line.
- A test runs `lintEntry` over the whole approved library with zero errors.

## Step 5. The generation endpoint (`POST /api/textgen`)

Before writing it, load the `claude-api` skill and follow its current guidance for the model id,
structured outputs and prompt caching.

- **Model:** Haiku 4.5 (`claude-haiku-4-5-20251001`).
- **System prompt** (cached, because it is the same for every call): the full
  `docs/lore-writing-guide.md`, the `TOKENS` list, the Seedfall tone notes, the per-pool length
  caps, and two or three approved entries per pool as examples.
- **Request body from the studio:**
  `{ pool, voice, when, count, examples: [fish facts…], avoid: [existing lines for this when] }`.
  The server builds the user message from `when` (as a readable sentence plus the JSON) and the
  example fish's facts (from `characterOf`), so Haiku writes for real fish, not for a guess.
- **Output:** a JSON schema for `{ candidates: [{ text, voice, note }] }`, enforced with
  structured outputs.
- **Server-side:** run `lintEntry` on each candidate, drop ones with errors, attach warnings,
  and return the rest as `status: 'draft'`, `source: 'haiku'`, with the model id.
- **Limits:** cap `count` at 12 per call and a per-session total. Return the token usage, so the
  studio can show a running cost.
- **No key:** return 503 with "set ANTHROPIC_API_KEY and restart `npm run studio`". The studio
  shows that instead of a stack trace.

Also add `scripts/textgen.mjs` in pixelforge, which reuses the same prompt builder for a
headless "fill gaps" run. For a large fill, it can use the Message Batches API, which is
cheaper and fine for offline work. Shared code goes in `scripts/textgen-core.mjs`, so the
endpoint and the CLI build identical prompts.

## Step 6. Coverage (`scripts/text-coverage.mjs`)

The fish4 counterpart of `lore-coverage.mjs`:

- Sample 4,000 fish across terrains with `batch` and the default params.
- For each key that matters (terrain, region, niche, archetype, role, top quirks, tier, feature)
  × pool × voice, count how many fish carry it and how many approved entries can match them.
- Report the share of fish that fall back to fish3 lore per pool (the main health number).
- `--missing` lists the gaps, ranked by how many fish they affect. `--json` is for the studio.

## Step 7. Studio panel: Text library

Builds on the studio plan (`01-studio.md`), as panel 8.

- A table of every entry: pool, voice, status, source, `when` as a readable sentence, its lines,
  and lint warnings. Filters by each column.
- **Coverage heatmap:** key × pool, coloured by entries per thousand fish, from
  `text-coverage.mjs --json` run in the worker.
- **Generate for gaps:** pick heatmap cells, set voice and count, and queue batches against
  `/api/textgen`. Results go into a review queue.
- **Review queue:** for each candidate, show it filled in for three real example fish (so tokens
  read naturally), then approve, edit or reject. Keyboard shortcuts `a`, `e`, `r`.
- **Save** writes `text-library.studio.json` and re-runs the text tests.
- **Preview:** for the selected fish, show `textOf` with each line's entry id and voice, and a
  "why this line" list of all matching entries with their specificity.

## Order and size

1. Steps 1–2 (format, voices, catalogue, tests): about half a day. No studio needed.
2. Steps 3–4 (split file, lint): half a day.
3. Step 6 (coverage script): half a day. Useful on its own for hand writing.
4. Step 5 (endpoint and CLI): a day, including prompt iteration on 20–30 sample gaps.
5. Step 7 (studio panel): one to two days, after studio M1–M2 exist.

Steps 1–4 and 6 do not depend on the studio, so they can land first.

## Done when

- The fallback share is below 5% for every pool under the default params.
- Every pool has lines in all three voices for each terrain.
- The approved library lints clean.
- The text tests are deterministic.
- A Haiku batch for a gap goes from the heatmap to approved, committed JSON without touching
  code.

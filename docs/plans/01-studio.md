# Plan: PixGen Engine Studio (`studio.html`)

Phase 6 of the PixGen V4 plan (`~/.claude/plans/robust-imagining-alpaca.md`), updated for what
fish4 has since grown (terrains, ecotypes, character, batches, links, guard, `PARAM_SCHEMA`) and
for the roadmap's "species atlas" (`docs/fish4-roadmap.md` §3).

## Goal

A dev-only page for looking at, tuning and saving everything fish4 can do, without editing code
by hand. Every control is generated from a registry the generator already exports
(`PARAM_SCHEMA`, `FEATURES`, `STATS`, `LOCI`, `TERRAINS`, `REGIONS`, `NICHES`, `TIERS`, the
text library), so adding something to fish4 makes it show up in the studio with no studio code
changes.

## Where it lives

**The canonical game repo, `~/Code/aquarium`, as a second Vite entry.** Two reasons:

1. The "My aquarium" panel reads the game save from IndexedDB, which is only visible on the same
   origin. Serving the studio from the game's own dev server gives it that origin for free.
2. The game already imports fish4 through `@forge/v4/fish` (`src/game/fish.ts`), and its
   `Fish3` type already describes the generator.

**The problem:** the studio writes generator data, and the generator's source lives in
`~/Code/pixelforge/src`. Also, `scripts/vendor-forge.mjs` only works when `../src` exists, which
is true for `pixelforge/aquarium` but not for the standalone checkout.

**The fix:**

- Add a `--src <dir>` flag (and a `PIXELFORGE_SRC` env var) to `scripts/vendor-forge.mjs`, which
  overrides `PARENT_SRC`.
- In the studio's Vite config, resolve the pixelforge source in this order:
  1. `PIXELFORGE_SRC`
  2. `../src`, if `../src/v4/fish` exists
  3. `~/Code/pixelforge/src`, if it exists
- Alias `@studio-forge` to that source, so the studio sees live source with HMR. Fall back to the
  vendored `./forge` (read-only mode, with a banner) when no source is found.
- The game itself keeps importing `@forge`, the vendored copy. Shipping a change to the game is
  then an explicit "Vendor to game" button, not a side effect of tuning.

## Setup (milestone 0)

- `studio.html` at the repo root, next to `index.html`. It mounts `studio/main.tsx`.
- `package.json`: add `"studio": "vite --open /studio.html"`.
- `vite.config.ts`:
  - Keep `build.rollupOptions.input` as `index.html` only, so `vite build` and the PWA never
    include the studio. Add a test (or a check in `npm run build` output) that `dist/` has no
    `studio` file.
  - Register `studio/vite-plugin-studio.ts` with `apply: 'serve'`.
  - Add the `@studio-forge` alias described above.
- `studio/vite-plugin-studio.ts` adds `configureServer` middleware. It only listens on
  localhost, and it checks `Origin` against the dev server's own origin.
  - `GET /api/studio/info`: the source path, whether it is writable, and the git branch and
    dirty state of pixelforge.
  - `POST /api/studio/save`: `{ file, content }`. It writes only into an allowlist of data files
    under `src/v4/fish/data/` (see "Saving" below), and rejects any path that escapes the
    allowlist.
  - `POST /api/studio/vendor`: runs `vendor-forge.mjs --src <src>` and returns its output.
  - `POST /api/studio/test`: runs `node --test test/fish4.test.mjs` in pixelforge and streams
    its output (so a save can be checked without leaving the page).
  - `POST /api/textgen`: added by the Haiku plan (`02-haiku-text.md`).
- Stack: Preact + `@preact/signals` (both already dependencies), plain CSS that reuses the game's
  tokens from `src/ui/theme.css`. No new UI library.
- Heavy work runs in a Web Worker (`studio/worker.ts`) behind a small RPC: `simulate`, `sweep`,
  1,000-seed histograms, atlas grids and batch rolls. The UI thread only draws.

### Shared pieces

- `studio/state.ts`: signals for `seed`, `algo` (`v1 | v3 | v4`), `params` (a full params object,
  not only a preset id), `place` pins, the selected fish code, and the zoom.
  URL hash sync (`#seed=…&preset=…&p=<base64 params diff>`), so any view can be linked or
  bookmarked.
- `studio/sprite.tsx`: `<Sprite code anim frame zoom />`. It calls the generator's
  `frame(g, anim, i)` → `{ w, h, data, palette }` and paints it to a canvas with
  `imageSmoothingEnabled = false`. An `<Anim>` wrapper loops frames at the anim's `fpsOf`.
  A cache keyed by `code + anim + i + paramsHash` keeps grids fast.
- `studio/params-form.tsx`: renders any `PARAM_SCHEMA` entries as controls by `type`
  (`number`/`int` → slider plus input, `bool` → toggle, `enum` → select, `map` → a slider per
  key, `choiceWeights` → a field → choice table, `tuple` → N inputs, `list` → multi-select).
  It groups by `PARAM_GROUPS`, runs `validateParams` on every change and shows errors and
  warnings inline. Edits go through `setParam`, so the form never builds params by hand.
- `studio/evidence.tsx`: renders any `{ value, display, because[] }` stat the same way.

## Panels

Built in this order. Each milestone ends usable and committed.

### M1. Forge

- Seed input with "random", "previous" and "next" (seed + 1) buttons.
- Algorithm switch: V1 (`fish`), V3 (`fish3`), V4 (`fish4`), through `src/gen/registry.js`.
- Preset picker (`PRESETS`) and the full params form. A "changed from preset" diff list with a
  reset per path.
- Place pins: terrain, region, niche and clade selects. Locked terrains (aether) are shown
  disabled, with the unlock condition.
- Live preview of every anim (`ANIMS`, including `happy`, `tired`, `dead`) at 1–8× zoom, on the
  dark lab background and on a light background.
- Shows the code, a "copy code" button, and the params hash.
- Shows guard `violations` for the current fish, if any.

### M2. Inspector and Compare

**Inspector** (for the selected fish):

- Every genome field, editable (selects from `traits.fields`). Editing re-encodes the code.
- Loci: both alleles and the expressed value, as small bars.
- `statsOf` with `because` evidence, grouped as in `docs/fish4-stats.md`.
- `behaviourProfile` as a raw vector with `STATS_VERSION`.
- Taxonomy (order → family → genus → species → var.), names (`namesOf4`), character (archetype,
  traits, quirks, likes, fears, blurb), care line and text (`textOf`, each line with the entry
  id that produced it).
- Rarity: tier, within-tier fraction and points per source.
- Reproduction (`clutch`, cooldown, maturation, `broodLimit`) and `valueOf`.

**Compare** (three grid modes):

- One seed × N presets.
- N seeds × one preset.
- V1 | V3 | V4 for one seed.

Clicking any cell makes it the selected fish.

### M3. Species atlas (roadmap §3)

- A grid of terrain × region × niche × clade. Each cell is the prototype (`protoOf`) drawn as a
  sprite. Empty cells are greyed and show why (terrain locked, niche has no bodies there).
- Click a cell to see ten individuals of that species (`fromSeed` with the place pinned).
- Sidebar: the clustering params (`clusters.*`, stick per group, Zipf, palette strength,
  mutation, link strength, guards, pyramid), from `PARAM_SCHEMA` group filters.
- Readouts, computed in the worker over a fixed sample:
  - live species count
  - "how clustered": within-clade vs between-clade agreement, using the same measure as the
    tests in `test/fish4.test.mjs` (move that measure into an exported helper first, so the
    test and the studio share one function)
- A batch view: `batch(seed, n, P)` as one shoal, with trophic levels (`LEVEL_OF_DIET`).

### M4. Breeding lab

- Pick two parents (from the selected fish, a pasted code, or the aquarium panel), then breed.
  Shows the egg seed, the clutch, `breedProblem` if refused, the events, each child's tier and
  its `mythicChance`.
- A family tree of everything bred in this session, kept in a signal and saved to
  `localStorage` (per-viewer convenience only).
- `canBreed` against a broods-used counter, to show the brood limit in action.
- **Simulator** (in the worker):
  - `simulate` per strategy (`STRATEGIES`): generations to each tier, and credits per hour.
  - A tier-pacing chart against the target bands from the V4 plan's pacing table.
  - The strategy credits-per-hour table, with the "no strategy over 1.5× the next" check
    highlighted.
- **Scenario sweep**: pick two numeric params (default `breeding.broodLimit` 2…12 ×
  `mythic.maxChance` 4…20%) and get a heatmap. Each cell shows median time to first Mythic,
  Mythics per 10 h and best-strategy credits per hour. Cells inside the pacing targets with no
  dominant strategy get a "fun band" outline. "Export cell as preset" writes a params object.
- Both a "generations" axis and an "hours" axis, using `sim.TIMING` and, once the game timers
  are known, the game's timers (roadmap §2 "Pacing in hours").

### M5. Growth and features

**Growth:** stage (fry → elder) × size (tiny → giant) ladder for the selected fish, in one anim
or all of them, with a toggle between `detail: 'v3'` and `'v4'` to check scaled detail at giant.

**Features editor:**

- The `FEATURES` list. For each module: its field choices and weights, `when` / `excludes` /
  `requires`, `influences`, and its `params` schema rendered with the params form.
- Per-layer toggles over the `PARTS` order, to hide one layer and see what is under it.
- A zoomed pixel view with a grid and a hover readout (layer and palette index under the cursor).
  This needs a debug hook in `frame.js` that returns the layer per pixel. Add it as an opt-in
  option so normal frames do not pay for it.
- The stamp painter for module masks is deferred. It is only worth building once a second
  feature module needs hand-drawn masks.

### M6. Rules

- The rule list from `data/rules.js`, each with a form editor and a raw JSON editor for its
  `when` and `then`.
- A "facts catalogue" picker for conditions: every fact, stat, field, feature, tier and size a
  condition can test, with its possible values. Export this catalogue from `rules.js` (the Haiku
  plan needs it too).
- Live preview over 1,000 seeds (worker): how often the rule fires, a strip of fish it fires on,
  and before / after histograms of every stat it touches.
- Rule determinism is checked by re-running the sample with the same params and comparing.

### M7. My aquarium and discovery

- Read the save with `idb-keyval` `get('seedfall-v3')` (the key from `src/store/backend.ts`).
  Read-only: the studio never writes the save.
- Render every owned fish, grouped by tank, with a click-through to the Inspector.
- **Discovery grid** for any owned fish's species: morph alleles × patterns × signature / helmet
  × stages × expressions. Variants the player has owned are in colour; the rest are
  silhouettes. "Owned" comes from the save's fish list (and its history, if the save keeps one).
- Gracefully handles an empty or missing save (it shows a hint to run `npm run dev` and play
  first).

### M8. Export, import and saving

- Export and import as JSON: params presets, rules, feature config, the text library and fish
  lists. Every export embeds `STATS_VERSION`, `paramsHash`, the generator id and version, and
  the pixelforge git commit (from `/api/studio/info`).
- **Saving to source:** today the editable data is JS modules with comments
  (`data/rules.js`, `data/text-library.js`, presets in `params.js`). Overwriting them would drop
  the comments. Instead:
  - Hand-written data stays in the `.js` files.
  - The studio writes companion `.json` files: `data/presets.studio.json`,
    `data/rules.studio.json`, `data/text-library.studio.json`.
  - Each `.js` module imports its `.json` companion and appends it, so entries from both sources
    merge, and the studio never touches hand-written code.
  - JSON is written with sorted keys and 2-space indent, so diffs stay small.
- After a save, the page runs the fish4 tests through `/api/studio/test` and shows the result.
- "Vendor to game" runs the vendor endpoint, then `vendor-forge.mjs --check`.

## Tests and checks

- Vitest for pure studio helpers (params diff, URL hash round-trip, sprite cache key).
- Playwright smoke in `e2e/studio.spec.ts`, run only when `STUDIO=1` (it needs the dev server):
  open the studio, change the seed, see a sprite canvas with non-empty pixels, switch to V3.
- `npm run build` must not emit any studio file (a script check after build).
- `npm run typecheck` covers `studio/`.

## Risks

- **Two aquarium copies.** `pixelforge/aquarium` is a synced nested copy. Build the studio in
  `~/Code/aquarium` only and let the existing sync carry it over, or the copies will drift.
- **Performance.** 1,000-seed histograms and sweeps can take seconds. Keep them in the worker,
  show progress, and cancel on new input.
- **Uncommitted game work.** `~/Code/aquarium` has uncommitted bridge work in `src/`. The
  studio only adds new files plus small edits to `vite.config.ts` and `package.json`, so it can
  go on its own branch without touching that work.

## Done when

`npm run studio` opens the page. A fixed seed renders identically to `cli/forge.mjs`. Every
`PARAM_SCHEMA` entry has a control. The atlas, breeding lab and sweep run. Saving a preset
writes a JSON companion file that the fish4 tests accept. The production build has no studio in
it.

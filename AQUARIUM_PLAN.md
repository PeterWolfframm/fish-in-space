# The Living Archive — Aquarium game plan

## The new premise

The old seas did not end all at once. They faded behind poisoned rivers, salt blown inland,
warm currents, broken dams, and long quiet years. You are the field ichthyologist of a small
restoration station. Every fish in your care is a living record: an old-world lineage, a new
adaptation, or a hybrid that may thrive where its ancestors could not.

The player is rebuilding connected refuges for freshwater, brackish, coastal and deep-water life.
Care, observation, compatible breeding and responsible release earn **Karma**: a measure of
trust earned from living systems, never a currency for buying life. The tone is hopeful and tender.
The world is wounded, but the game is about patient repair, curious fish and small recoveries.

**Name:** The Living Archive (working title). **Player role:** field ichthyologist / keeper of the
last field station. **Primary loop:** observe → learn a fish's needs → restore its habitat → breed
new lineages → release suitable offspring → record what returns.

## Product goals

- A calm, genuinely playable aquarium on desktop and touch screens.
- Pixel art rendered from the existing Fish v3 generator, with genome codes as fish identity.
- A living tank with readable fish, gentle motion, tactile feeding, inspection and breeding.
- A restoration story that makes ecology and compatibility part of the play, without punishing
  players for taking a break.
- Offline-first progress. No account or server required to start playing.
- Fast loading and a lean implementation that can grow into the larger simulation later.

## Stack recommendation

For the first playable release, keep the existing repository and static ES modules. Use **Canvas
2D** for the tank, direct `fish3.frame()` sprites with nearest-neighbour rendering, and localStorage
for the save. This reuses the strongest existing asset pipeline, avoids bundling and framework
startup cost, and makes `/aquarium/` deployable through the current static server immediately.

If the game grows past this slice, the recommended next stack is **Vite + TypeScript + PixiJS v8**
for the scene renderer, with a pure deterministic simulation module in a Web Worker. Keep React
optional for menus and non-game screens; it is not needed in the real-time tank. Use IndexedDB for
larger offline saves, and PocketBase only when cloud sync or shared features become real needs.
Avoid adding a backend, multiplayer, trading, or a heavy state framework before the solo loop is
proven fun. A sprite worker / OffscreenCanvas is a later optimization, not a launch requirement.

## First playable slice (implemented under `/aquarium/`)

1. **Arrival:** a field station with a healthy, populated starter refuge; no network wait.
2. **Observe:** animated fish3 sprites swim in a responsive tank. Tap a fish to read its generated
   name, genome, temperament, diet, salinity and temperature needs.
3. **Feed:** touch or click the tank to scatter food; a small daily action rewards care.
4. **Pair:** select two fish and use fish3's deterministic `breedDetailed()` to create a fry with
   inherited traits. Karma is awarded for a successful new lineage.
5. **Restore:** switch the field site between refuge environments, inspect the story log and release
   a fish into an appropriate restored habitat for Karma and a record entry.
6. **Persist:** save fish codes, Karma and restoration records locally; restore on next visit.

### Voice and naming

The aquarium is called **The Living Archive**; the field station is **Morrow Station**. The current
water is **Morrow Basin**, an estuary refuge at the edge of a drowned city. Use plain, intimate field
notes rather than grimdark proclamations. The fish generator supplies species names and lore; the
game supplies short ecological context. Keep all story original and avoid implying that real fish
are extinct or that care is guaranteed by matching one trait.

## Technical shape

- Runtime: plain ES modules, Canvas 2D, Fish v3 API, no new dependencies.
- Genome codes are the saved identity; UI and animation state are derived.
- A small scene loop draws the tank at device pixel ratio, capped to a reasonable canvas scale,
  with cached sprite frames, nearest-neighbour scaling, simple bounded swim motion and culling.
- Input: pointer events for fish inspection, feeding, selection and buttons; controls have generous
  touch targets and no hover-only actions.
- Save schema is versioned and validated on load. If a save is malformed, safely seed a new station.
- Pause expensive animation when the page is hidden or reduced motion is requested.
- Keep the simulation local and forgiving. Future time simulation must use deterministic inputs,
  cap catch-up and never make offline absence fatal.

## Later roadmap

### Fieldwork

- More refuge sites: alpine lake, floodplain river, salt marsh, kelp shelf, twilight trench.
- Site parameters affect which fish can thrive; show the generated ecology behind every suggestion.
- Water quality as readable, forgiving trends (temperature, salinity, oxygen, clarity), not a
  chemistry spreadsheet in the first session.
- Plants, driftwood, shelter and flow as habitat tools. Add plant v3 / waterplant generators only
  when their assets suit the aquatic renderer.

### Life and genetics

- Nursery tank, clutches, juvenile/adult stages, parentage and lineage records.
- Careful species compatibility, with clear warning before pairing or release.
- Heritable genes, hybrids, rare sports and fish3 line purity surfaced through the field journal.
- Population goals per refuge and a gentle stewardship score.

### Long-term possibilities

- A deterministic simulation package and worker once fish populations make main-thread work visible.
- PixiJS for larger scenes, culling, filters and multiple parallax layers.
- IndexedDB, export/import and optional cloud sync; server authority only for shared-world play.
- Research expeditions and shared restoration projects. Competitive trading is deliberately not a
  core premise: lineage provenance and release records matter more than market value.

## Acceptance for the first slice

- `/aquarium/` loads from the existing static server, including on a narrow mobile viewport.
- Fish are real Fish v3 generated sprites, animated at pixel-perfect scale.
- A player can inspect, feed, select two fish, breed a fry, release a fish and see Karma change.
- Refresh preserves the player-created fish and restoration progress.
- Every control works by touch and keyboard where practical; reduced motion is respected.
- No changes to fish-in-space's generator implementation are required.

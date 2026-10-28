# SEEDFALL — breed the fish a new world needs

> Plan v2. Supersedes `AQUARIUM_PLAN.md` ("The Living Archive"), which stays in the repo for
> reference. The first playable build lives in `/aquarium/`.

## The pitch in one breath

Humanity has left Earth's cradle and is settling worlds that had water but no life. Terraforming
engines can make oceans; they cannot make fish. You are the **Hatchery Ichthyologist** aboard the
orbital hatchery **Minnow**, parked above the young planet **Mirelle**. You collect cryo-roe from
the Earth Ark Vault, breed lineages in your tank, and drop them to the surface in seed pods to fill
Mirelle's lakes, rivers, deltas, reefs and trenches.

The twist: **Mirelle is alive in the slow way planets are.** It reacts to what you seed. Lakes
thaw and then warm, rivers carve new runs, the sea turns brackish and then salty, the deep wakes
up last. Each change means the planet needs *different* fish, at *different* times. The colonies
below place requests for the fish their new water needs. Fill them, earn credits, and watch a
grey rock turn blue and green.

The tone is cosy sci-fi: cute pixel fish, a chirpy survey drone, gentle timers, no fail state.

## Setting and names

| Thing | Name | Notes |
| --- | --- | --- |
| Game | **Seedfall** | The programme that "drops life like seeds". |
| Player | Hatchery Ichthyologist | Unnamed "you"; the drone calls you "Doc". |
| Station | Orbital Hatchery *Minnow* | A small ring station; the tank is its heart. |
| Companion | **PIP** (Planetary Integration Probe) | Survey drone. Writes the log, reports planet shifts, a bit too excited about mud. |
| Planet | **Mirelle** | Second terraform target of the Accord. Starts grey with ice caps. |
| Fish bank | Earth Ark Vault | Frozen roe from Earth's seed banks; the shop. |
| Buyers | The Colony Accord | Settlements that post **Seeding Requests** and run the **Exchange**. |
| Currency | Credits (◎) | Earned from requests and the Exchange; spent at the Vault and on the station. |
| Progress | **Bloom** | Planet-wide life score. Bloom unlocks the next terraform phase. |
| Delivery | Seed pod | A fish leaves the tank in a little pod and splashes down. |

### Mirelle's terraform phases

Each phase opens a biome, and shifts the conditions of the ones before it. PIP warns a phase
ahead ("forecast"), so planning a breeding line for the *next* season is the strategy layer.

| # | Phase | Bloom needed | Opens | Planet shift |
| --- | --- | --- | --- | --- |
| 0 | First Thaw | 0 | **Meltwater Lakes** (fresh, cold) | Ice caps crack, grey world. |
| 1 | Rivers Run | 120 | **Glassrun Rivers** (fresh, temperate) | Lakes stay cold. |
| 2 | Brine Rising | 300 | **Brinemouth Delta** (brackish) | Meltwater lakes **warm to temperate**. |
| 3 | Warm Seas | 540 | **Coral Nursery** (marine, tropical) | Rivers warm to tropical; delta warms. |
| 4 | The Deep Wakes | 840 | **Lanternfall Trench** (marine, cold, twilight/abyss) | Delta turns marine-ish. |
| 5 | Living World | 1200 | — | Endless: requests from every biome, rarer genes. |

## Core loop

1. **Collect** — buy cryo-roe from the Ark Vault, themed by biome (it hatches as a juvenile fit
   for that water), or a cheap wildcard roe.
2. **Care** — tap water to drop feed; fed fish grow faster (fry → juvenile → adult). Fish show
   hearts when they eat, sleep when the tank dims, and school by temperament.
3. **Read** — tap a fish to open its dossier: name, binomial, sex, genotype (two alleles),
   ecology (salinity, temperature, depth, diet, level, sociality) and its fish3 lore line.
   Ecology is *derived from the body*, so the player learns to read a fish.
4. **Breed** — pair two adults of opposite sex. fish3's `breedDetailed()` makes the child: blended
   proportions, Mendelian alleles, overlay patterns, hybrids, sports, line purity. Eggs sit on the
   sand and hatch after a short wait.
5. **Seed** — Seeding Requests ask for combinations ("fresh + cold + herbivore, carries the
   albino allele, hatchery-bred"). A matching fish goes down in a pod for credits and Bloom.
   Any fish that fits a biome can also be seeded freely for a little Bloom.
6. **Trade** — the Exchange buys any fish. Prices drift with colony demand (an algae crisis on a
   settlement makes grazers spike), so checking the board is the second way to earn.
7. **Grow the station** — credits buy tank capacity and better roe; Bloom unlocks phases.

### Why requests feel fair

Requests are generated from fish that can actually exist: the game samples a real fish that fits
the biome and copies a few of its traits as the requirement, and gene requirements only name
alleles that already exist in the player's tank. Every request can be filled with what you own or
can breed. Requests expire, but nothing is lost: a new one arrives.

### Request requirement kinds

- **Water** (always): salinity and temperature of the biome right now (and depth in the trench).
- **Role** (phase ≥ 1): diet, tank level or sociality the colony ecologists want ("the lakebed
  silt needs stirring: send a bottom-dweller").
- **Genetic material** (phase ≥ 2): "carries the *X* allele", e.g. ghost genes for low-light
  caves, melanistic for UV-bright shallows. Pushes the player into breeding carriers.
- **Hatchery-bred** (phase ≥ 1): generation ≥ 1, "for disease-resilient stock".

## Tech stack: what we use, and what to change

### Shipped now (fastest path to live)

- **Plain ES modules, no build step**, served by the existing static server (`npm run app:static`
  → `/aquarium/`). It imports fish3 straight from `src/v3/fish`, so generator improvements show
  up in the game for free.
- **Canvas 2D at a low internal resolution** (~360 px wide), upscaled by an integer factor with
  smoothing off. This gives crisp pixels on any phone, and it is much cheaper than drawing at device
  resolution.
- **Sprite baking in a module Web Worker.** fish3 frames cost about 3 ms each (25 ms for a fish's
  first frame). The worker bakes each fish into a frame strip, transfers the RGBA buffer, and the main
  thread turns it into an `ImageBitmap`. The tank never stalls; there is a main-thread fallback if
  workers are blocked.
- **localStorage save**, versioned and validated, with offline catch-up (eggs hatch, fry grow,
  orders roll) capped so a long break is never punishing.
- **Bun** only as an optional bundler to produce a single-folder build for hosting elsewhere.

### Recommended changes as it grows

| Today (old plan / repo) | Suggest instead | Why |
| --- | --- | --- |
| Fly.io machine + PocketBase for everything | **Cloudflare Pages** (or any static host) for the game; add **Workers + D1** or a **Durable Object** only when there is shared state | The game is 100 % static. A CDN serves it faster, for free, and with no machine to keep alive. |
| React for UI (considered) | **Preact + Signals** or **Svelte 5** for panels, *if* the DOM UI grows | ~4 KB vs ~45 KB, and fine-grained updates suit timers and ticking prices. The tank stays raw canvas. |
| PixiJS v8 as the next renderer | Keep Canvas 2D until ~150 on-screen fish; then PixiJS (or raw WebGL2 instancing) | Low-res Canvas 2D already holds 60 fps with dozens of fish on mid-range phones. |
| localStorage | **IndexedDB via `idb-keyval`** once saves exceed ~1 MB (lineage trees, planet history) | It's async, has a bigger quota and doesn't block the main thread. |
| Plain JS | **TypeScript (JSDoc types first)**, Vite for dev | Types for save schema and order logic, without a build-step tax on day one. |
| Web only | **PWA** (manifest + service worker) now, **Capacitor** later for the App Store / Play | Installable, offline, home-screen icon; Capacitor wraps the same build. |
| No audio | Tiny **WebAudio** synth blips (shipped), later **Howler.js** for music | Zero asset weight to start. |
| — | **Playwright** mobile-viewport smoke test in CI | Catches touch/layout regressions on every push. |

## First playable (in `/aquarium/`)

- Intro transmission from PIP, starter tank of five vault fish, 150 ◎.
- Tank: low-res pixel water, light shafts, sand, swaying weed, bubbles, feed pellets, eggs, hearts,
  pod launches; fish swim in their ecological level and mirror direction.
- Tabs: **Tank** (roster), **Requests**, **Exchange**, **Vault** (shop + upgrades), **Mirelle**
  (planet globe, phases, biomes, forecast), **Log**.
- Fish dossier as a bottom sheet on phones, side panel on desktop.
- Breeding with sex, adulthood and cooldowns; eggs → fry → juvenile → adult with feeding speedup.
- Requests with live matching ("2 of your fish fit"), launch animation, Bloom and phase advance.
- Exchange with drifting, time-based demand and news headlines.
- Save/restore, offline catch-up, reduced-motion support, mute toggle.

## Roadmap

1. **Lineage book** — family tree per line, line purity badges, "breeds true" stamps.
2. **Planet surface view** — tap a biome on Mirelle and watch the fish you seeded living there
   (reuses the tank renderer with biome palettes; populations grow from what you sent).
3. **More worlds** — after Mirelle reaches Living World, a second planet with stranger chemistry
   (volcanic vents, polar brine, ammonia lakes). fish3's special ecology values (`volcanic`,
   `polar`, `void`, `any`) become the late game.
4. **Planet events** — algae blooms, cold snaps, a predator boom. Each one is a timed request chain.
5. **Decor and habitat tools** — plants (plant v3), rocks, lights that change fish mood.
6. **Cloud save + gifting** — share a fish by its genome code; a friend's hatchery can hatch it.
7. **Seasonal Accord contracts** — weekly global goals ("the Accord needs 10 000 grazers").

## Acceptance for this slice

- `/aquarium/` loads on a 360 px wide phone and on desktop. It is fully playable by touch, with no
  hover-only actions.
- Fish are real fish3 sprites, animated, baked off the main thread.
- A new player can: feed, read a dossier, breed, hatch, grow, fill a request, sell, buy roe, and see
  Mirelle reach phase 1 within roughly 10–15 minutes.
- Refresh keeps everything; a malformed save starts a fresh station instead of crashing.
- `npm test` covers the world rules: request feasibility, matching, pricing and save validation.

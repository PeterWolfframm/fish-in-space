# SECOND TIDE (working title): design and build brief for an aquarium game on pixelforge

> **Who this is for:** a coding LLM that will build this game from scratch. You have not seen the
> two existing repos. Everything you need about them is in here, with file paths so you can check.
> Read sections 0–2 in full before writing any code.

---

## 0. Context and ground rules

**Why this exists.** The owner had an aquarium app called *myaquarium*: repo `~/Code/fish.`,
remote `github.com/PeterWolfframm/myaquarium`, React + TypeScript + PixiJS + Supabase. All the
pixel art has since moved into **pixelforge** (`~/Code/pixelforge`), a procedural pixel-art
generator. It draws fish (fish3: 32 bodies plus hybrids, six size classes, a modelled swim,
Mendelian genes, names, lore, and an ecology derived from the body), tank plants (waterplant2)
and garden plants (plant3). myaquarium's own simulation is thin: random wandering plus a
size-scale tween. The decision is to stop developing myaquarium and build a new, much deeper game
that uses pixelforge for every sprite.

**Goal.** First reach feature parity with myaquarium, then go well beyond it. The result should be
a living aquarium sim with real fish behaviour, water chemistry, breeding, a post-apocalyptic
story, and online trading, a shared world and competitions.

**Ground rules for the implementer**
1. **Never edit pixelforge from the game.** It is a library that other things depend on. Its v1
   generators are frozen, with pixel-for-pixel tests. If the game needs a new animation (for
   example `flare`, `jump`, `sleep` or `dead`), write it down as a separate pixelforge task. The
   repo has an `/add-animation` skill for that. Do not patch pixelforge inline.
2. **Keep every milestone playable** (section 12). Never leave a milestone with a blank screen
   or a half-wired system.
3. **The sim is pure and deterministic:** no DOM, no `Math.random`, no `Date.now()` inside it.
   Time and RNG are passed in.
4. **The code is the fish.** A fish's genome code (e.g. `f3.…`) is its heritable identity.
   Everything else about a fish (age, hunger, wounds, position) is *state*, stored next to the
   code and never folded into it.
5. **Text written in the game's voice** follows `pixelforge/docs/lore-writing-guide.md`:
   grimdark-archive gravity applied to small fish, never winking, no borrowed IP.
6. If a decision in this brief turns out to be wrong once you are in the code, stop and say so.
   Don't silently work around it.

---

## 1. What exists today

### 1.1 pixelforge: the art and genetics engine (`~/Code/pixelforge`)

Plain ES modules, no build step, no DOM in `src/` (except `src/pixel/blit.js`). Read `README.md`.

```js
import { GENERATORS, generator, fromCode, sizeOf } from 'pixelforge/registry'; // src/gen/registry.js
const fish3 = generator('fish3');
```

The fish3 generator object (`src/v3/fish/index.js`, default export) gives you:

| Member | What it gives the game |
|---|---|
| `fromSeed(seed)` / `fromCode(code)` / `traits.encode(genome)` | roll a fish, decode/encode its code (`fromCode` also reads v1 `f…` codes) |
| `normalize(genome)` | forces an impossible combination back to legal values |
| `frame(genome, animId, i)` → `{w,h,data,palette}` | one indexed sprite frame, cropped to the fish's shared window |
| `anims` | `swim`(8f), `sprint`(8), `glide`(12), `idle`(12), `turn`(12), `eat`(8), `grow`(4, no loop: fry→elder) |
| `fpsOf(genome, anim)` | tail-beat fps; small fish beat faster |
| `sizeOf(genome)`, `sizes`, `anchor:'center'` | canvas size at constant pixel density (a giant really is bigger) |
| `breed(a,b,seed)` / `breedDetailed(a,b,seed)` → `{child, events}` | polygenic proportions, OKLab colour blending, pattern overlays, Mendelian alleles (`geneA/geneB`), hybrids (`bodies.js HYBRIDS`, some sterile), sports, lines and purity (purity 5 breeds true) |
| `ecology(genome)` (`ecologyOf`) | **the sim's input**: diet, feeding style, level, temperament, sociality, activity, depth, salinity, temperature, current, hardness. Each fact comes with a `because` naming the traits behind it. Deterministic, no RNG. |
| `name(genome)`, `names`, `lore(genome)`, `describe`, `signatureOf`, `rarity` | common name, binomial and title; codex, quote, edict and legend; gene description; rarity |

The ecology scales (`src/v3/fish/ecology-data.js`) are the vocabulary of the sim:
```
diet:        piscivore carnivore durophage omnivore herbivore detritivore planktivore (+carrion)
feeding:     pursuit ambush lure grazing sifting picking
level:       top mid bottom (+above)          temperament: skittish peaceful territorial aggressive apex
sociality:   school pair solitary (+warband retinue)
activity:    diurnal crepuscular nocturnal (+sleepless)
depth:       shallows reef open twilight abyss (+void)
salinity:    fresh brackish marine (+any)    temp: cold temperate tropical (+volcanic polar)
current:     still gentle strong torrent     hardness: soft medium hard
SIZE_CARE:   tiny 3cm/20L · small 6/40 · medium 12/110 · large 25/300 · huge 50/900 · giant 110/4000
TEMP_C:      cold 10–18 · temperate 16–24 · tropical 24–30 · volcanic 31–38 · polar 2–8
PH:          soft 6–7 · medium 6.8–7.6 · hard 7.6–8.4 · marine 8.1–8.4
```
Genome fields you will read at runtime (`src/v3/fish/genome.js`): `size`, `sex` (f/m), `stage`
(fry/juvenile/adult/elder; not a "look" field, so it doesn't change the name), `damage`
(none/warts/scar/notched), `glow`, `mood`, `geneA/geneB`, `hybrid`, `generation`, `lineA/lineB`,
`purity`, `chaos`, `signature`, `relic`.

Other generators for the tank: `waterplant2` (anims `sway`, `gust`; four size classes) for tank
plants, and `plant3` (16 species; `idle`, `wind`, `gust`, `rustle`, `bloom`, `glow`, `grow`,
`seasons`) for shore and terrarium plants.

pixelforge also runs **PocketBase** (`pb_migrations/`, `scripts/run-app.mjs`), a Node trainer
service (`server/trainer.mjs`) and a Fly.io deploy (`fly.toml`). Reuse those patterns. It has
**pixelgen** (`src/pixelgen/`), a small net trained on swipes that scores how good a sprite
looks. It can act as an aesthetic judge (section 9.4).

### 1.2 myaquarium: what to keep from the old architecture (`~/Code/fish.`)

These ideas are good. Carry them forward:

| Idea | Where | Why it matters |
|---|---|---|
| **The code is the identity.** Only genome codes are stored, never a second copy of the fish. | `src/fish/keep.ts` | No drift between "the fish" and "its picture". Trading, saving and sharing are just strings. |
| **The renderer is pure; a separate adapter makes textures** | `src/fish/draw.ts` → `src/fish/texture.ts` | The same pixels feed the tank, the gallery and PNG export. pixelforge now plays `draw.ts`'s role. |
| **Offline-first boot**: the tank fills with fish synchronously, before any network reply | `EntityManager.spawnSchool` (comment explains why) | The old app used to sit blank waiting on a database. Never again. |
| **Interaction is a pure state machine**, testable without Pixi | `src/fish/tankInteraction.ts` (`afterTap`, `offspringCode`) | Tap a fish to inspect it. "Breed" then waits for a second fish, and stray taps don't cancel. Keep this exact UX. |
| **Photo → fish**: Claude reads a photo and fills in the *genome*. It doesn't pixelate the photo. The schema is built from the trait fields, and `normalize` repairs impossible fish. | `src/fish/vision.ts`, `src/lab/PhotoToFish.tsx` | A great hook. Port it to fish3 fields. |
| **Layered Pixi scene**: background / objects / grid / highlight / entities, with `pixi-viewport` zoom and pan, culling, a resize coordinator, and handling for lost WebGL context | `src/classes/Stage.ts`, `managers/LayerManager.ts`, `ViewportManager.ts`, `CullingCoordinator.ts` | The right shape for a big zoomable tank. Re-implement it more leanly (see the anti-patterns below). |
| **Grid placement** for static "foundation" entities | `managers/GridManager.ts` | Becomes the decor and hardscape grid. |
| **Several environments** per user (types Generic/Simulation/Sandbox/Experimental), each with its own background and settings | `StageSettings.tsx`, `StageManagementService.ts`, `BackgroundPicker.tsx` | Becomes several tanks: main, quarantine, breeding, sandbox. |
| **Debug overlays**: entity labels, view-distance circles, grid | `StageSettings.tsx`, `DebugEntityManager.ts` | Perception circles are essential once behaviour exists. |
| **Ambient moods** Work / Pause / Lunch (speed ×1 / ×0.3 / ×2) | `src/constants/index.ts MOODS` | Shows the app was meant as a calm second-screen aquarium. Keep that use case: **Ambient mode** (section 10). |
| **Draggable panels that remember their position**; login and account cards; guest play | `stores/panelPositionStore.ts`, `LoginCard.tsx`, `UserAccountOverview.tsx` | Keep the UX, at much smaller code size. |
| **Optional backend**: the app runs fully without one. A sync queue retries writes when back online. | `config/supabase.ts`, `services/offlineSyncQueue.ts` | Keep offline-first. Server actions queue up. |
| **Engineering hygiene**: golden-code tests, a coverage floor for the fish pipeline, CI, lint, a dev-only `debug()` helper | `src/fish/__tests__/golden.test.ts`, `utils/debug.ts` | Keep all of it. |

**Anti-patterns to avoid** (from that repo's own history):
- A behaviour state machine fetched over the network per entity on construction. When the fetch
  failed, the fish stayed frozen forever.
- Manager sprawl: 10 or more coordinators and managers for one scene, a "universal game state"
  table, a performance-instrumentation estate, a mockup UI.
- Growth as a smooth sprite **scale** (0.5→1.0). Scaling blurs pixel art. Use pixelforge's
  `stage` field and size classes instead.
- An invisible 30-day lifespan that nothing in the UI shows.

---

## 2. Target architecture and tech stack

**Repo:** a new sibling repo, e.g. `~/Code/secondtide`, set up as a pnpm workspace. pixelforge is
linked as `"pixelforge": "link:../pixelforge"`, the same way it already links `@keypad/ui`.

```
secondtide/
  packages/
    sim/        pure TS: world model, needs, behaviour, steering, water, life cycle. No DOM, no Pixi.
    shared/     types, zod schemas, constants, ecology→number tables, deterministic RNG
    content/    story scripts, world map data, quests, codex glue (reads pixelforge lore)
  apps/
    web/        Vite + React 19 + Zustand + PixiJS v8 + pixi-viewport + @keypad/ui
    warden/     Node service: authoritative actions, wild-world ticks, competitions (pattern: pixelforge server/trainer.mjs)
  pb_migrations/   PocketBase schema
```

- **TypeScript strict**, Vitest, ESLint, Playwright for smoke and screenshots. pixelforge is plain
  JS, so write a small `pixelforge.d.ts` covering just the surface you use.
- **Threads:** the UI runs on the main thread. The **sim runs in a Web Worker** and posts snapshots
  (positions, headings, anim ids and frames as transferable `Float32Array`/`Uint16Array`). A
  **sprite worker** calls `generator.frame()` and turns indexed frames into RGBA `ImageBitmap`s
  (OffscreenCanvas). The main thread only draws and handles input.
- **Backend:** PocketBase, as in pixelforge, deployed as its own Fly app. The `warden` Node
  service talks to PocketBase as superuser and imports `packages/sim`, so the server runs the same
  rules as the client.

### 2.1 Rendering spec
- **World units = sprite pixels.** A tank is, say, 640×360 world px. Zoom levels are integers
  (1×–8×) with nearest-neighbour filtering, and the camera snaps to whole pixels. Don't scale
  sprites to show growth.
- **Sprite cache:** key = `renderCode + animId` (renderCode is section 4.6). Value = an atlas of
  all frames plus `fpsOf`. LRU of about 300 entries. Warm the cache for fish about to appear. Face
  left or right by flipping (`scale.x = -1`). The `turn` anim plays as a gate when the heading
  reverses.
- **Layers, back to front:** sky and light gradient → far backdrop (procedural rock or silhouette)
  → back plants (waterplant2, parallax 0.9) → hardscape and decor (grid) → **fish** (sorted by
  depth band, then y) → front plants → particles (bubbles, food, waste, eggs) → water overlay
  (caustics, algae tint, turbidity) → night pass (multiply dark, **then add an emissive layer for
  `glow` fish and lure lights**) → UI highlights and debug overlays.
- **Day and night:** the lights schedule drives a palette shift. At night only glowing fish and
  moonlight remain, which is the showcase moment for bioluminescent genes.
- **Budget:** 200 fish plus 60 plants at 60 fps on an M1 laptop. Sim worker ≤ 4 ms per tick.
  Cull fish off-screen (sim keeps running, render skips them).

### 2.2 Simulation loop spec
- Fixed timestep: **steering at 30 Hz**, **behaviour decisions at 5 Hz** (each fish staggered into
  a different slot), **water and needs at 1 Hz in sim time**. Render interpolates between snapshots.
- **Time scale:** 1 real second = 1 sim second while watching, adjustable ×1, ×10 and ×60 in the
  lab. A sim day = 24 sim hours, but the day/night cycle can be compressed (default: a full day in
  2 real hours) so players actually see night.
- **Catch-up:** on load, fast-forward the time away using the **macro sim** only: needs, water,
  growth, hatching and deaths at 1-minute steps, with no steering. Cap it at 72 sim hours. Then
  show a "While you were away" journal. Deaths while away are rare by design: the macro sim gives
  a grace buffer so a weekend away doesn't wipe the tank.
- **RNG:** one seeded PRNG stream per tank (mulberry32/sfc32, in `shared/`). Fork child streams per
  fish by hashing `tankSeed + fishId`. pixelforge's own seeds are strings; pass `${tankId}:${clutchNo}`
  style strings to `breedDetailed`.
- **Spatial index:** a uniform grid hash with cell = 32 world px, for neighbour queries.

---

## 3. Data model (sim, `packages/shared`)

```ts
type Code = string;                       // pixelforge genome code, e.g. "f3.…"
interface Specimen {                      // a real fish (server record once online)
  id: string; code: Code; ownerId: string;
  bornAt: SimTime; parents?: [string, string]; clutchId?: string;
  provenance: 'vault' | 'bred' | 'wild' | 'trade' | 'sandbox' | 'photo';
  state: 'tank' | 'released' | 'listed' | 'dead';
}
interface FishState {                     // lives only in the sim, saved with the tank
  specimenId: string; code: Code;
  eco: EcoProfile;                         // cached numbers derived from ecology(genome), see 4.1
  pos: Vec2; vel: Vec2; heading: 1 | -1;
  stage: 'egg'|'fry'|'juvenile'|'adult'|'elder'; ageH: number;
  needs: { hunger: number; energy: number; stress: number; social: number; breed: number }; // 0..1
  health: number; wounds: number;         // wounds ≥ thresholds → damage overlay
  activity: ActivityId; activityT: number; target?: EntityRef;
  memory: { feedSpot?: Vec2; feedHour?: number; threats: string[]; home?: Vec2; mate?: string };
  anim: { id: AnimId; frame: number; t: number };
}
interface Tank {
  id: string; name: string; kind: 'main'|'quarantine'|'breeding'|'sandbox';
  litres: number; dims: { w: number; h: number };           // world px; litres scales with w·h·depth
  water: WaterState; equipment: Equipment; substrate: Substrate;
  decor: Decor[]; plants: PlantState[]; fish: FishState[];
  food: FoodParticle[]; eggs: EggClutch[]; waste: number; algae: number;
  lights: { on: number; off: number }; seed: string; simTime: SimTime;
}
interface WaterState { tempC: number; pH: number; kH: number; salinityPpt: number; o2: number;
  nh3: number; no2: number; no3: number; bacteria: number; turbidity: number; current: number; }
```

---

## 4. Fish behaviour model

### 4.1 From ecology to numbers (`EcoProfile`)
Compute this once per fish from `ecology(genome)`, the phenotype and the size class:

| Number | Derived from |
|---|---|
| `cruise`, `burst` speed (px/s) | size class length (`SIZE_CARE.cm`), gait (thunniform/carangiform fast; ostraciiform/labriform/amiiform slow), tail (lunate/fork fast; veil/round slow), chonk |
| `turnRate`, `accel` | body: eels turn tight, molas turn slowly, discs pivot |
| `levelBand` [y0,y1] | `level` top/mid/bottom (+ `above` = can breach the surface) |
| `tempRange`, `pHRange`, `salinity`, `currentPref` | TEMP_C, PH/MARINE_PH, salinity, current |
| `perception` radius, `nightVision` | eye size/mount, activity |
| `aggression` 0..1, `boldness` | temperament step 0..4, armament (ARMED_* tables) |
| `schoolAffinity`, `schoolKey` | sociality; schoolKey = body (+ hybrid), so tetras school with tetras |
| `mouthGape` | jaw type × size: decides which fish this fish *can* eat (prey length ≤ 0.5 × predator length, and ≤ 0.35 for non-gape jaws) |
| `circadian` | diurnal/crepuscular/nocturnal → activity curve over 24 h |
| `bioload` | size class → waste and O₂ use per hour |

### 4.2 Needs (0 = fine, 1 = critical), updated at 1 Hz
- **hunger** rises with metabolism (size, temperature: warmer water means faster metabolism) and
  falls when the fish eats. Above 0.95 for a long time it costs health.
- **energy** follows the circadian curve. Sleep pressure peaks in the off-hours.
- **stress** rises with: water outside the comfort ranges (distance measured in range-widths),
  crowding (bioload / litres), nearby threats, no cover for skittish fish, a schooler with
  fewer than 5 of its kind, bright light for nocturnal fish, and sudden changes (Δtemp > 2 °C/h).
  It decays when conditions are good. Sustained stress → health loss → susceptibility to
  disease events.
- **social** applies to schooling and pairing fish: it rises when alone and falls near their group or mate.
- **breed** rises in adults with health > 0.7, stress < 0.3, hunger < 0.4. It is boosted by a
  trigger (a cooler water change counts as "rain" for many fresh bodies, longer days for others).

### 4.3 Decisions: utility AI with inertia
Every 0.2 s (staggered), score each available **activity**. The current activity gets +0.15
inertia so fish don't twitch between activities. The highest score wins.

| Activity | Utility (sketch) | Steering | Anim |
|---|---|---|---|
| `wander` | 0.2 baseline × awake | wander + level spring + current drift | swim / glide |
| `school` | social × schoolAffinity | boids: separation, alignment, cohesion (same `schoolKey`) | swim |
| `forage` | hunger × food visible (diet-matched) | arrive at nearest edible food, then bite | sprint → eat |
| `graze` / `sift` / `pick` | hunger × algae / substrate waste / plankton | slow arrive on surfaces / bottom / mid-water | idle + eat |
| `hunt` (pursuit) | hunger × prey in gape range × aggression | pursue with prediction; gives up after N s | sprint, eat on catch |
| `ambush` | hunger × cover nearby × ambush feeder | hold near cover, strike in a short burst when prey < r | idle → sprint |
| `lure` | hunger × darkness × lure feeder | hold still, emit light, strike at r | idle (glow) |
| `flee` | threat proximity × (1−boldness) | flee + seek cover; startle spreads to neighbours | sprint |
| `hide` | stress × cover available | arrive at cave/plant, hold | idle |
| `guard` | territorial × intruder in territory | chase the intruder to the edge, return home | sprint / turn |
| `display` | territorial × same-sex rival nearby | face the rival and hold (later: a `flare` anim from pixelforge) | idle |
| `court` / `spawn` / `tend` | breed × mate present / eggs present | follow mate, circle, lay; pair-guard and fan eggs | swim / idle |
| `rest` / `sleep` | energy × circadian off-hours | settle at the level band floor or in cover, speed ≈ 0 | idle (slowed fps) |
| `beg` | hunger × keeper present × learned feedSpot | go to the feed spot near the surface | swim |
| `breach` | `level=above` or glider × startled | burst upward out of the water and land (needs a lid or it's gone) | sprint |

**Steering** (Reynolds-style, summed with weights, then clamped by `accel`/`turnRate`/speed):
seek, arrive, flee, pursue, evade, wander, separation, alignment, cohesion, obstacle avoidance
(decor AABBs, walls, surface, substrate), a level-band spring, and a current flow field (pump
position → a 2D vector field).

**Choosing animations:** speed < 10% of cruise → `idle`; burst → `sprint`; burst then coast (if
the body's gait burst-coasts) → `glide`; heading reversal → play `turn` and lock steering for its
duration; bite → `eat`. Scale the anim fps by `speed / cruise`, so a lazy fish beats slowly.

**Learning (small, but players notice):** each fish remembers the feed spot and hour (exponential
average), threats that chased it, and its home cover. Fed at the same spot every morning, fish
gather there before the lights come on.

### 4.4 Example behaviours (each should come out of the system, not be scripted)
1. **Glass-tetra school** (tetra, tiny, stripe → school, skittish, mid). Twenty fish move as one
   ribbon. A barracuda turns toward them, the nearest three flee, and the startle spreads
   neighbour-to-neighbour in about 0.3 s, so the whole school flashes away. With only 3 tetras,
   stress climbs and they hide in plants all day.
2. **Barbel catfish** (barbels → bottom, detritivore, nocturnal). By day it sleeps under the
   driftwood cave. At lights-off it sifts the substrate, eats the sunken pellets the top feeders
   missed, and visibly lowers the waste meter. Players learn that catfish clean tanks.
3. **Betta-like territorial top fish** (betta, territorial, top, solitary). It claims a territory
   around a floating plant, chases any fish of similar size out of it, and holds a display in
   front of a same-sex rival. Two males in a small tank → wounds → `damage: notched` shows up on
   the sprite (section 4.6).
4. **Piranha frenzy** (piranha jaw, school, aggressive, crepuscular). It ignores flakes at noon.
   At dusk, when hungry, the school speeds up. A wounded or fry fish within gape range starts a
   frenzy: one bites, and nearby school members switch to `hunt` on the same target.
5. **Abyss angler** (lure, ambush, abyss, nocturnal). It sits motionless on the bottom in the
   dark. At night its lure glows (emissive layer). Small curious planktivores drift toward the
   light because a "curiosity" term in `wander` pulls them to light sources at night. Strike.
6. **Hatchet glider** (glider pectorals → top, skittish). When startled (glass tap, predator,
   sudden light change), it *breaches*. Without a lid it lands on the carpet and is gone, with a
   journal entry about it. Equipment matters.
7. **Clown pair** (pair, territorial). Two adults bond (`memory.mate`), pick a rock as home, spawn
   eggs on it, then take turns fanning the clutch and chasing off anything that comes near.
8. **Puffer vs snail plague.** Overfeeding grows a pest-snail population on the glass (a sprite
   particle). Durophages (beak jaw) eat snails. It's a natural fix players can discover.
9. **Koi beggars** (koi, cold, school, omnivore). When the keeper's cursor hovers near the surface,
   they crowd it with mouths up. Overfeed them and the nitrate climbs.
10. **Mola sunbather** (mola, giant, top, planktivore). In a tank under 4000 L it is stressed and
    sickly. In the right tank it drifts at the surface, turning at the speed of a ship.

### 4.5 Life cycle
- **Stages** (genome field `stage`): egg (sim only) → fry → juvenile → adult → elder. Durations
  scale with size class. Defaults are in sim hours and tunable: tiny fish reach adult in ~24 h,
  giants in ~10 days. Elder fish slow down and stop breeding. Death comes from old age (it shows:
  the elder sprite), starvation, predation or water collapse.
- **Spawning modes**, from body and sociality: *egg scatterers* (schools release eggs; anything
  eats them), *substrate spawners / pair guarders* (pairs tend a clutch), *livebearers*
  (guppy-like bodies drop a few free-swimming fry), *mouthbrooders* (optional, later).
- **Clutch size** by size class: tiny ~20, small ~12, medium ~6, large ~3, huge/giant 1–2.
  Hatch time 6–24 sim h. Fry are prey for anything with a gape big enough. A breeding box or a
  separate breeding tank protects them, and that's the core trade-off.
- **Offspring:** `breedDetailed(a, b, seed)` per egg, with `seed = clutchSeed + ':' + eggIndex`.
  The child's `stage` is set to `fry`. Show `events` in the journal ("A sport: veil tail!",
  "Line ka breeds true", "This hybrid is sterile").
- **Compatibility:** two fish can spawn if they share a body, or if `hybridOf(bodyA, bodyB)`
  (`src/v3/fish/bodies.js`) gives a hybrid. Sterile hybrids (`HYBRIDS[x].sterile`) can't breed.

### 4.6 Render genome vs heritable genome
The sprite is drawn from a **render genome** = the heritable genome + overrides from the fish's
state: `stage` (from age), `damage` (from wounds: scar/notched; warts from chronic stress), and
optionally `mood` (grumpy when stressed, happy when thriving). Breeding always uses the
**heritable** genome, never these overrides. Check in `breeding.js` whether `damage` and `mood`
are inherited, and strip the overrides before breeding either way. The renderCode for the sprite
cache is `traits.encode(renderGenome)`.

---

## 5. Water, plants and equipment

### 5.1 Water model (1 Hz sim, values per litre where it applies)
- **Temperature** relaxes toward room temperature (story-driven: the lab gets colder in winter)
  unless a heater or chiller holds its setpoint. Changes faster than 2 °C/h stress every fish.
- **Nitrogen cycle, the heart of the game:** fish eat → **ammonia** (∝ food eaten × bioload).
  Uneaten food and dead matter decay → ammonia. Filter bacteria (a population that grows over
  days, capped by filter capacity) convert NH₃ → **NO₂** → **NO₃**. Ammonia and nitrite are toxic;
  nitrate is mildly toxic. Plants and algae take up nitrate. **Water changes** dilute everything
  and also shift temperature, pH and salinity toward the new water's values. *New tank syndrome*
  (no bacteria yet) is the first lesson of the game.
- **O₂:** + surface agitation (filter, air stone), + plants in light, − fish (bioload), − decay.
  Saturation falls with temperature, so a hot tank is an oxygen trap. Low O₂ → fish gasp at the
  surface. That's visible behaviour, not just a number.
- **pH and kH:** kH buffers pH. In soft water, nitrate buildup slowly acidifies. Additives raise or
  lower it.
- **Salinity:** 0 fresh, 5–18 brackish, 30–35 marine. Evaporation raises it unless topped off.
- **Algae** grows with light hours × nitrate and is eaten by grazers. It shows as a green tint on
  the glass and on decor, and the glass can be scrubbed.
- **Comfort:** for each fish, compare temp, pH, salinity and current to its ranges. 0 inside the
  range, then linear up to 1 at one range-width outside it. Each term feeds stress (4.2).
- **The tank planner** warns *before* you add a fish: no overlap in water ranges, a predator whose
  gape fits a tankmate, a schooler bought alone, a giant in a small tank. It explains each warning
  with ecology's `because` ("its fangs make it a piscivore").

### 5.2 Plants (waterplant2 in tanks)
Plants take up nitrate, give off O₂ in light, serve as cover for `hide`/`ambush`, and are food for
herbivores (bitten plants shrink; overgrazing kills them). They sway with the current (`sway`, and
`gust` near the pump). They grow in steps between waterplant2's size classes, never by scaling.

### 5.3 Equipment and decor (unlocked through the story and research)
Heater, chiller, filter (sets bacteria cap and flow), air stone, wave pump (current), lights
(intensity and schedule), CO₂ (plant growth), **lid** (stops breaches), breeding box,
quarantine tank, salt mix, buffers, auto-feeder, test kits (each kit *reveals* one water number;
without a kit you only see symptoms). That's the game layer: knowledge has to be earned. Decor
(rocks, caves, driftwood, ruins of the old world) goes on the grid (old GridManager idea). Caves
and plants are cover.

---

## 6. Feeding

| Food | Behaviour in water | Best for |
|---|---|---|
| Flakes | float, then slowly sink | top and mid omnivores and planktivores |
| Pellets | sink fast | mid and bottom omnivores and carnivores |
| Algae wafers | sink, stay put | herbivores, grazers |
| Live brine (sim particles that dart away) | triggers `hunt` | carnivores, pursuit feeders |
| Frozen worms | sink, high nutrition | carnivores, durophages (slowly) |
| Plankton dose | spreads mid-water, invisible-ish | planktivores, filter feeders |

The keeper drops food where they click (the old tap model gets a "feed" tool). Each food has a
diet-match table: a fish only `forage`s for food that matches its diet, with a reduced value for
partial matches. Uneaten food → waste → ammonia. Overfeeding is the most common mistake, and
the game should teach that gently through visible cloudiness.

---

## 7. The story: *Second Tide*

### 7.1 Premise
The old world ended in **the Boil**: the seas cooked, then dried, and the rivers died in their
beds. Before the end, the old world built the **Geoformers**, machines meant to re-carve and
refill the planet. They kept working for centuries after their makers were gone. Now the planet
has water again: new lakes in old craters, rivers through glass deserts, a warm shallow sea over a
drowned city, a trench nobody ordered. All of it is clean, mineral-perfect and **completely
lifeless**.

You wake in an **Ark**: a sealed research vault run by **the Archive** (the same institution that
writes the fish codex in pixelforge's lore guide). You are its last **Keeper-Biologist**. The
Archive's gene vault survived, mostly. Its records are damaged, low-resolution, simple.
**Diegetic hook:** the old v1 fish codes (`f…`) are those damaged pre-collapse samples. When you
open one in the game it is upgraded to a full v3 fish (pixelforge does this through `fromCode`),
so "restoring the vault" means literally growing simple old fish into rich new ones.

Your mandate: **re-seed every body of water on the planet** with fish that can survive there and
form a stable food web. To do it you have to breed and raise them in the lab, fit them to each
water body, and release them.

### 7.2 Tone
The Archive speaks in the codex voice: solemn, bureaucratic, faintly doom-laden, totally serious
about tiny fish ("Specimen 4471 has consumed its sibling. The Archive notes this without
judgement."). The planet is beautiful and quiet. The Keeper is never mocked. Humour comes from the
gap between the gravity and the guppies. No gore, no real-world religions or politics.

### 7.3 Cast
- **The Archive (VESSEL-index)**: the Ark's caretaker intelligence. It speaks in catalogue
  numbers and redactions (`▇▇▇`), and slowly warms up to you.
- **Warden Ossa Lenk**: a voice on the radio from another Ark, gruff, a predator specialist. Can
  be voiced by real online players' Arks later (section 9: the radio is the multiplayer layer).
- **The Choirs**: Orders of keepers with doctrines, one per temperament (names invented, checked
  for trademarks): e.g. *Choir of the Still Shoal* (peaceful schools), *Conclave of the Fang*
  (apex predators), *Order of the Silt* (bottom-dwellers and cleaners), *the Lanternwake*
  (nocturnal and glowing), *the Tidewright Synod* (strong-current swimmers). In online seasons
  these become the factions.
- **The Geoformers**: never speak. Their logs, found as decor relics, tell the backstory.

### 7.4 Acts (the campaign also works as the progression and tutorial)
| Act | Waters unlocked | What you learn | Story beat |
|---|---|---|---|
| **I · The Cradle** | one lab tank → *Pond Zero* (shallow, fresh, still, temperate) | nitrogen cycle, feeding, test kits, first breeding, first release | Wake up. Revive three vault samples. The first fry hatch. The Archive logs "Life: 1" on the planet counter. |
| **II · The Rivers** | *Glassrun River* (strong current, cold), *Oxbow Marsh* (soft, tropical, still) | current, schooling, compatibility, quarantine, predators in balance | A river only holds fish that can swim against it, so you breed for tails and gaits. First radio contact from another Ark. |
| **III · The Brackish Gate** | *Saltwind Estuary* (brackish) → *the Drowned Shelf* (reef, marine) | salinity, acclimatisation, hybrids and sterile mules, lines and purity | Marine water needs marine fish, and the vault has almost none. You have to *breed toward* them through brackish bridges (and rare `runes` = salinity any). |
| **IV · The Twilight** | *Lantern Trench* (twilight), *the Abyssal Choir* (abyss, cold, dark) | night cycles, glow, lure ecology, keeping things cold and dark | Geoformer logs say the trench was dug "for the ones who come after". Fish released here start showing myth-tier sports. |
| **V · The Void** | *Eclipse Basin* (`depth: void`) | myth relics (`eclipse`, `revenant`), endgame breeding projects | Something already lives in the Void. It wasn't seeded by anyone. Ending: the Geoformers were the *previous* Archive's attempt. The loop is the point. (Keep it ambiguous. The codex should never fully explain.) |

### 7.5 Release and restoration
- Every water body has a profile using the same scales as fish ecology (temp, salinity, current,
  depth, hardness) plus **niche slots**, a target food web, e.g. Pond Zero: 3 planktivore, 2
  omnivore, 1 herbivore, 1 detritivore, 0–1 piscivore.
- **Releasing** a specimen takes it out of your collection for good. It goes into the world.
  Its fit score = water match × niche need × health × genetic diversity (penalty for releasing 20
  clones of one line).
- **Restoration %** per water body = filled niches × stability over time (the wild sim, section 9.3)
  × biodiversity. Restoring water bodies unlocks the next acts, equipment and lore.
- The planet map is a pixel-art world map (procedural from the water-body list). Water bodies
  light up and come alive as they're restored, with your released fish visible in a "dive" view.

### 7.6 Progression and economy (single player)
- **Research points** come from the **codex**: the first time you see each ecology key, trait key,
  hybrid, morph, sport, signature or relic unlocks its entry (text from pixelforge `lore`). The
  codex *is* the collection book.
- **Supplies** (food, salts, equipment) come from restoration milestones and, online, from the
  market.
- **Vault samples**: a daily or weekly ration of revived old codes keeps fresh genetics coming in.
  You can't hand-edit genomes in story mode. That's what the Sandbox is for.

---

## 8. Lab, Sequencer, Sandbox, Photo → fish
- **Sequencer** (story-safe, read-only): the dossier for any specimen. Name, binomial, codex,
  ecology chips with "because", visible traits, *known* alleles (unknown ones show as `?` until a
  test cross reveals them), lineage tree, generation, purity. A **cross predictor** runs
  `breedDetailed` N=200 times with throwaway seeds and shows outcome odds (albino 25%, hybrid
  chance, sterility). That's the planning tool for serious breeders.
- **Sandbox tank** (= the old Lab): free roll, edit and breed, like myaquarium's `/lab` and
  pixelforge's Forge. Sandbox fish are tagged `provenance: 'sandbox'` and can never be traded,
  released or entered in competitions.
- **Photo → fish** (port `fish./src/fish/vision.ts` to fish3 fields): in the Sandbox it's
  unlimited with the player's own API key (kept in localStorage, as now). In story mode it's a
  **"Field reconstruction"**: once a day, through the warden (server-side key, rate-limited, model
  `claude-opus-5-5` or `claude-sonnet-5`), it produces a real specimen with `provenance: 'photo'`.

---

## 9. Online play

### 9.1 Trust model (decide this before building online features)
- **Codes are public blueprints. Specimens are server records.** Anyone can paste a code into the
  Sandbox, but only specimens the server knows about (ids in PocketBase) can be traded, released or
  entered in competitions.
- **Births are authoritative on the server.** When a clutch is laid in a tank, the client asks
  the warden to register it: `POST /clutch {tankId, parentA, parentB, clutchNo}`. The warden checks
  ownership, adult stage, compatibility and a cooldown. It derives
  `seed = HMAC(serverSecret, parentA|parentB|clutchNo)`, runs `breedDetailed` itself and returns
  the children. The client can't pick seeds, so it can't fish for sports.
- **Offline:** eggs "await sequencing" and hatch when the warden confirms. Diegetically, the
  Archive must verify the genome. A fully offline player can keep playing; their unverified fry
  are `sandbox` until synced.
- Tank sims stay client-side (it's your private tank). The server only checks things that create
  value: births, deaths that release slots, trades, releases, entries. Checks are sanity limits
  (age, cooldowns, counts), not full replays.

### 9.2 Exchanges ("the Radio")
The multiplayer layer is framed as the radio network between surviving Arks.
1. **Direct trade**: offer specimens and supplies to another Ark. Both confirm. Escrow in the warden.
2. **Market (the Exchange)**: fixed-price listings and short auctions in **scrip**. There's a fee
   sink to fight inflation. Listings show the full dossier, and the planner shows compatibility
   with *your* tank.
3. **Stud book**: list a specimen as a breeding partner. Another player pays a stud fee, the
   warden breeds *their* fish with yours, and they get the clutch while you keep your fish. It's
   the best way for rare lines to spread without being sold.
4. **Drift bottles**: put a specimen into the current and get a random one from a stranger in
   return (matched by rarity band). Low-stakes, delightful, good for new players.
5. **Visits**: see any Ark's public tanks live (their latest snapshot replayed through the sim).
   Leave one gift (a food drop, a plant cutting) and sign the guestbook. "Wishlist" fish appear on
   your public profile.
6. **Lineage**: every specimen's ancestry is public. "Descended from Ossa's Ember-tailed line,
   gen 14" is social proof and status.

### 9.3 The shared world (all players restore one planet)
- Each **water body is a shared region**. All players' releases land in the same wild population.
- **The wild sim** runs in the warden every 15 real minutes per water body. It is a *macro*
  population model by guild (planktivore, herbivore, … , piscivore), Lotka–Volterra style, with
  carrying capacity from the water body, plus a set of individual **notable** specimens (released
  ones and their descendants).
- **Wild breeding:** notable fish of compatible bodies in the same water body breed through
  `breedDetailed` with server seeds. The result is **wild hybrids across players' lines** that
  nobody bred on purpose.
- **Surveys:** players can send a limited number of daily survey dives to catch wild fish (a weighted
  draw from that population). That's how wild genetics flow back into labs, and the main source
  of surprise.
- **Collective goals:** "Saltwind Estuary needs 500 detritivores by Sunday." A global progress
  bar, with rewards for every contributor. Restoration % per region is shown on everyone's world map.
- **Ecological consequences are shared:** if everyone dumps piscivores into Pond Zero, its forage
  fish collapse for everyone. The map shows it, and the Archive issues an edict. Balance is the
  social puzzle.

### 9.4 Competitions
| Format | How it's judged | Why it's fun |
|---|---|---|
| **Shows** (weekly themes: "Best galaxy-morph disc", "Ugliest beloved blobfish") | pairwise swipe voting by players (Elo/TrueSkill). Votes weighted 1/√(votes cast), like pixelforge's trainer. pixelgen public model score as a tiebreaker only. | Uses pixelforge's swipe infrastructure. Beauty breeding becomes a meta. |
| **Breeding bounties** ("register a verified-born albino koi-line fish with purity ≥ 5 and stripe pattern") | first N verified births that match the spec; constraints checked by the warden on the genome | Pure genetics puzzles; the cross predictor gets used heavily |
| **Current trials** (sprint, endurance-in-torrent, gauntlet past a predator) | deterministic, closed-form course sim on the warden from EcoProfile speeds plus a seed; replay shown in the client | Turns gait, tail and size into competitive stats |
| **Restoration league** (season, ~6 weeks) | Choirs (factions) compete on restoration % contributed in assigned water bodies, weighted by fit and diversity | Big cooperative-competitive goal; the story advances each season |
| **Tank of the season** | votes, gated by health: tanks below a stability threshold can't enter | Aesthetic play without rewarding cruelty |

Deliberately out of scope: fish fighting arenas (real-world cruelty overtones). Territorial
behaviour stays inside the sim.

### 9.5 PocketBase collections (first cut)
`users` (built-in; guest → account like pixelforge) · `arks` (profile, faction, scrip) ·
`specimens` (code, owner, parents, provenance, state, bornAt) · `tanks` (owner, kind, snapshot
JSON, simTime, public) · `clutches` · `waters` (world regions, restoration, macro populations) ·
`releases` · `surveys` · `listings` · `trades` · `studs` · `bottles` · `competitions` ·
`entries` · `votes` · `journal` (events, for "while you were away" and feeds). Access rules: an
owner reads and writes their own tanks. Specimen ownership changes **only** through the warden.

---

## 10. Modes and UX
- **Tank view** (main): the zoomable tank. Toolbar: feed (food picker), net (move fish between
  tanks), test kit, water change, decorate (grid), lights, inspect. Tap a fish to open its dossier
  card, which has a "Breed with…" action (old `afterTap` flow).
- **Ambient mode** (from the old Work/Pause/Lunch moods): fullscreen, no UI, the day/night cycle
  synced to real time. Works as a second-screen or desktop aquarium. This was the original reason
  the app existed. Make it beautiful.
- **Lab**: Sequencer, cross predictor, Sandbox, Photo → fish.
- **World map**: water bodies, restoration, releases, surveys, collective goals.
- **Radio**: market, trades, stud book, bottles, visits, competitions, faction.
- **Codex**: collection book with lore.
- **Journal**: births, deaths, sports, story beats, while-you-were-away.
- **Debug overlay** (dev, toggle): perception circles, current activity labels, need bars, flow
  field, spatial grid.

---

## 11. Parity checklist with myaquarium (must all be ✅ at milestone M1)
| myaquarium feature | In Second Tide |
|---|---|
| Pixi tank with zoom/pan viewport | ✅ keep (integer zoom) |
| Fish generated from genomes, swimming | ✅ fish3 via pixelforge |
| School spawned at boot, offline | ✅ keep (vault starter school) |
| Kept fish list (codes) synced across devices | → `specimens` in PocketBase, local-first |
| Click to inspect, click-to-breed flow | ✅ keep the state machine; richer dossier |
| Lab: roll / tweak / breed | → Sandbox |
| Photo → fish | ✅ ported to fish3 |
| Multiple environments with types and settings | → multiple tanks with kinds |
| Background picker / per-stage background | → biome backdrops + decor; custom image backgrounds optional |
| Grid + tile highlight, foundation entities | → decor grid |
| Entity labels, view distances, grid toggles | → debug overlay |
| Moods (speed multipliers) | → Ambient mode + time scale |
| Draggable persisted panels | ✅ lightweight |
| Guest → account auth, account overview | ✅ PocketBase, same as pixelforge |
| Offline indicator + sync queue | ✅ keep |
| Growth (scale tween) and 30-day lifespan | → replaced by stages, visible ageing |
| Calm/active swim-rest rhythm | → replaced by needs + utility AI |
| Golden tests, coverage floor, CI, lint | ✅ keep |

---

## 12. Milestones (each ends playable and tested)
- **M0 Skeleton:** workspace, pixelforge link, the `.d.ts`, sprite worker + cache, one Pixi tank
  with viewport, 30 fish3 swimming with the plain wander rule. Debug overlay stub.
- **M1 Parity:** everything in section 11, with local persistence first, then PocketBase.
- **M2 Living tank:** EcoProfile, needs, utility AI, steering, schooling, levels, day/night,
  feeding tools, the anim selection rules. Example behaviours 1, 2, 3, 9 from 4.4 work.
- **M3 Water:** chemistry + nitrogen cycle, equipment, test kits, plants (waterplant2), algae,
  stress/health/death, tank planner warnings. Behaviours 5, 6, 8, 10.
- **M4 Life cycle:** stages, render-genome overrides, courtship, spawning modes, eggs, fry,
  `breedDetailed` events in the journal, Sequencer + cross predictor, codex. Behaviours 4, 7.
- **M5 Story Act I + world map + local release** to Pond Zero (local wild sim stub).
- **M6 Online I:** warden service, server-authoritative clutches, specimens, trade, market, stud
  book, bottles, visits, lineage.
- **M7 Online II:** shared waters, wild macro sim, wild breeding, surveys, collective goals, Acts II–III.
- **M8 Competitions:** shows (swipe voting), bounties, trials, factions, seasons, Acts IV–V.
- **M9 Shore and terrarium:** a paludarium tank kind on the same engine with a land half
  (plant3 plants, `wind`/`seasons` anims; land creatures later, as a new pixelforge kind).
- **M10 Polish:** audio (bubbles, filter hum, Archive voice blips), mobile touch, accessibility,
  performance pass.

---

## 13. Verification
- **Sim unit tests (Vitest, seeded):** the same seed + inputs → the same state after 10 sim
  minutes (golden snapshot hash).
- **Behaviour scenario tests:** each example from 4.4 is a test. Build the tank, run N sim
  seconds, assert the outcome. For example: tetra school mean nearest-neighbour distance < 12 px;
  a hungry piranha catches a fry within 60 s; the catfish's mean y is in the bottom band at night
  and it's resting under cover by day; a hatchet without a lid is gone after a startle; a lone tetra's
  stress is > 0.6 after 1 h.
- **Water tests:** a new tank cycles (NH₃ peak → NO₂ peak → NO₃ only) within the target sim days.
  A heater failure drops the temperature at the expected rate.
- **Breeding tests:** server clutch derivation is deterministic. A client can't choose seeds.
  Sterile hybrids are refused. Sandbox specimens are refused by every warden endpoint.
- **Perf benchmark:** 200 fish + 60 plants. Sim tick ≤ 4 ms in the worker. 60 fps render (Playwright
  + a performance trace).
- **Visual check:** Playwright screenshots of the tank at day and night, with the debug overlay on,
  and the dossier card. Look at them; don't just assert.
- **End-to-end online:** two test accounts. A trades with B, B uses a stud, the clutch is
  verified, a fish is released, a survey returns a wild fish with mixed lineage.
- **Parity:** go through section 11 by hand in the running app at the end of M1.

## 14. Open questions for the owner (ask before the milestone where it matters)
1. Game name (Second Tide is a placeholder; check trademarks).
2. Real-time pacing: how many real hours to an adult medium fish? (Default: about 2 days.)
3. Monetisation, if any (affects the economy design in 9.2). Default: none, with scrip only earned in play.
4. Do v1 `f…` codes from myaquarium users migrate as vault samples? (Default: yes.)

ADDITIONAL TASK ONCE EVERYTHING IS DONE
using 
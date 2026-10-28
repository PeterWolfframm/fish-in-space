# SEEDFALL v3: cozy space work

> *"Every sea starts as somebody's shift."*
> — sign above the hatch on Orbital Hatchery *Minnow*

V3 keeps the setting from `AQUARIUM_PLAN_V2.md` (the *Minnow* station, PIP, the planet Mirelle, Bloom, the Colony Accord) and rebuilds the game on a new stack. Three things change:

1. **It should feel like a job in orbit.** You work shifts and take radio calls. You get launch windows, briefings, mission patches and a logbook.
2. **It should look spacey and cozy.** Cold space outside, a warm cabin inside, a glowing tank in the middle.
3. **There is more story and more fun.** A Professor runs the mission. Colonists call in over comic-style comms. You get to name the planet's regions.

The current vanilla build (`aquarium/`) stays as the reference until v3 matches it, then it is removed.

---

## 1. What changes since v2

| Area | v2 (vanilla, live now) | v3 |
| --- | --- | --- |
| Rendering | Canvas 2D | **PixiJS v8** (WebGL, WebGPU when available) |
| UI | Hand-written DOM strings | **Preact + Signals** components |
| Language and build | Plain ES modules, Bun bundle | **TypeScript + Vite** |
| Save | localStorage | **IndexedDB** (idb-keyval) behind a `Backend` interface |
| Auth and DB | none | **still none.** `LocalBackend` now; PocketBase gets plugged in later (see §11) |
| Shop | "Vault" tab | **The Roe Counter**: a real shop with rotating stock, crates and cuttings |
| Plants | Hand-drawn swaying lines | **pixelforge plants** (`plant3`, `waterplant2`) baked and drawn in Pixi |
| Planet | 96 px rotating globe | **Procgen surface** per planet, with regions you deliver to and name |
| Story | Intro modal and log lines | **The Professor**, plus a comic comms system with a cast of callers |
| Feel | A tank with tabs | **A station with rooms**: Hatchery, Bridge, Roe Counter, Comms, Lab |

---

## 2. Art direction: "space outside, kitchen-warm inside"

The hatchery should feel like a small, lived-in research module in orbit. The cold is out the window. Inside you have warm lamps, plants, a mug on the console, and the tank glowing at the centre.

**Palette** (tokens in `src/ui/theme.css`; Pixi reads the same values from `theme.ts`):

| Token | Hex | Used for |
| --- | --- | --- |
| `void` | `#0b0e1f` | Deep space, the page background |
| `hull` | `#1b2140` | Station panels and frames |
| `hull-hi` | `#2c3563` | Panel bevels and hover states |
| `lamp` | `#ffb86b` | Warm cabin light, highlights, credits |
| `tank` | `#3fc6c9` | Water glow, active states |
| `bloom` | `#9be37a` | Life, Bloom, planet greening |
| `signal` | `#ff7aa8` | Comms, hearts, notifications |
| `ink` | `#f3ead8` | Text, warm off-white rather than cold white |

**Type:**
- *Pixelify Sans* for station labels and readouts.
- *Nunito* for dialogue and body text. It is soft and readable at small sizes.
- *VT323* for comms timestamps, telemetry and countdowns.

**Spacey and cozy, concretely:**

- **The window.** Behind the tank is a porthole onto space: a parallax starfield in three depths, with Mirelle slowly turning below. On the Bridge, the planet lighting matches the station's orbit, so you see a terminator line drift across the surface.
- **The cabin.** A thin frame of warm lamp light runs around the tank. There are tiny details at the edges: a blinking console LED, a steam curl from a mug, a pinned photo of Earth that changes once per chapter.
- **The water.** It gets a soft caustics filter, god rays from the "grow lamp" above, bubbles from a pixel airstone, and a gentle vignette.
- **Day and night.** The station has an orbit cycle (one orbit is about 12 real minutes). On the night side the cabin lamps warm up, the tank glows, bioluminescent fish light up, and stars brighten. On the day side, sunlight floods in through the porthole.
- **Sound.** WebAudio keeps the synth effects and adds a quiet ambient loop: hull hum, a soft pad and distant radio chatter. Every comms message gets a "click-hiss" radio blip.
- **Motion.** One orchestrated moment per action instead of constant effects:
  - A pod launch runs a countdown, the pod drops out of the tank floor into an airlock, and a trail streaks across the porthole to the planet.
  - A hatch makes a soft pop with sparkles.
  - Everything else is quiet. `prefers-reduced-motion` turns off parallax and screen shake.

---

## 3. The cast

All portraits use the **pilot generator** for now (`src/v2/pilot`, framing `portrait`, with animations `idle`, `talk`, `blink`, `grin`, `alarm`, `calm`). The old `src/gen/pilot-pixel.js` also has a `tutor` figure that fits the Professor.

Every character is a seed string, so a face never changes. Sprites go through `CharacterArt.get(id, anim)`, so a dedicated character generator can replace the pilot one without touching game code. **Marked as WILL BE REPLACED.**

| Character | Role | Voice |
| --- | --- | --- |
| **Professor Wren Halloway** ("the Prof") | Mission lead and your mentor. Runs the briefings, explains the systems and tells the story. | Warm and nerdy, slightly scatterbrained, loves a bad pun, very proud of you. |
| **PIP** | Planetary Integration Probe drone in your cabin. Gives hints, checklists and countdowns. | Short, literal, accidentally funny. Draws as a small bespoke sprite, not a pilot. |
| **Marshal Teo Banerjee-Voss** | Colony Accord liaison who issues the big requests. | Dry, busy, secretly delighted by fish. |
| **Dot Okafor (age 9)** | Kid at Saltmother Camp who writes in about your fish. | Asks the questions players actually have. |
| **Cook Ahiga** | Runs the *Minnow* galley. Gossip, recipes, morale. | Treats feeding the fish as a cooking show. |
| **Archivist Sel** | Keeps the Earth Ark Vault and the Roe Counter. | Speaks in catalogue numbers and old Earth trivia. |

### 3.1 The Professor's job in the game

- **Onboarding (Chapter 0).** About ten short beats spread over the first session, each triggered by the player doing the thing, never a wall of text:
  - "Tap a fish."
  - "That one's hungry."
  - "Let's pair them."
  - "Here's your first request."
  - "Look out the window."
- **Briefings.** At every phase change the Professor opens a full-screen briefing: the planet on the left, the Prof on the right, three bullet points saying what changed and what to breed next. This replaces v2's phase modal.
- **The "Ask the Prof" button.** It is always in the HUD. It picks the most useful hint for the current state: a hungry tank, an unfillable request, the tank nearly full, or a forecast about to hit.
- **Field Notes.** The Prof keeps a notebook of everything you have discovered: species, alleles, regions, story fragments. It works as the collection book and the achievement list in one.

---

## 4. Comms: comic chat that pops up

The comms system carries the storytelling and the moments of personality.

**UI:**
- Comic panels slide up from the bottom (mobile) or from the right (desktop).
- Each panel has an animated pixel portrait (`talk` while text types, `idle` after), a speech bubble with a tail, the speaker's name tag in their colour, and a VT323 timestamp ("ORBIT 14 · 06:12").
- Text types out at a readable pace. Tap to finish the line, tap again to dismiss.
- Multi-line conversations show as a short strip of two to four panels. Two speakers alternate sides, like a comic page.
- Panels with a choice show two small reply buttons. Choices only colour the next line or give a tiny reward; they never block progress.
- Everything said lands in the **Comms** room, a scrollable radio log grouped by orbit.

**When messages appear:**
- **Story beats:** tutorial steps, phase changes, a region being named, a first-of-a-kind hatch.
- **Ambient chatter:** a weighted random pick at most once every three to six minutes of active play, never during a pairing or a launch, and never twice from the same caller in a row.
  - Pool tags: `lore`, `planet`, `fish`, `galley`, `kid`.
  - Ambient entries can require a phase or a discovered biome, so they stay relevant.
- **Reactions:** short one-liners when something notable happens: a rare hatch, a perfect-fit delivery, a sale above 200 ◎, a fish growing old.

**Data format** (`src/content/comms/*.ts`; plain data, easy to write and translate):

```ts
export const entry: CommsEntry = {
  id: 'lore-salt-forgetting',
  tags: ['lore'],
  when: { minPhase: 1 },
  weight: 1,
  panels: [
    { who: 'prof', mood: 'talk', text: '…' },
    { who: 'dot', mood: 'grin', text: '…', side: 'right' },
  ],
  choices: [{ label: 'Tell me more', next: 'lore-salt-2' }],
};
```

### 4.1 Five example entries: "how humanity got here"

**1. The Long Quiet** (`lore-long-quiet`, the Prof, phase 0+)
> **PROF:** Fun fact. For two hundred years after the Ark ships left Earth, nobody talked to anybody. Ship to ship, I mean.
> **PROF:** Not out of rudeness! Light lag. You'd say "hello" and your grandkids got the reply.
> **PROF:** So every ship learned to fix its own problems. That's why we're all a little bit stubborn. And why the *Minnow* has eleven different kinds of duct tape.
> **PIP:** Correction: twelve.
> **PROF:** …Twelve.

**2. Salt Memory** (`lore-salt-memory`, the Prof and Dot, phase 1+)
> **DOT:** Prof, why do people cry salty?
> **PROF:** Ooh. Because a long, long time ago, all our ancestors lived in the sea. We left, but we took a little sea with us. In our blood, in our tears.
> **PROF:** So when you seed Mirelle's oceans, you're kind of… giving the sea back.
> **DOT:** That's beautiful. Also, can fish cry?
> **PROF:** Field Notes says "unclear." I'm putting you down as co-author.

**3. The Gardener Generation** (`lore-gardeners`, Archivist Sel, phase 2+)
> **SEL:** Ark log 4471-B. Around year 300 of the voyage, a whole generation chose to train as gardeners instead of engineers.
> **SEL:** The engineers called them "the soft hands." Then the hydroponics failed on the *Juniper*, and the soft hands kept nine thousand people fed for six years.
> **SEL:** Every terraforming school is still named after them. Including yours, Ichthyologist.
> **SEL:** Catalogue note: their seed bank is what the Roe Counter sells from. You're shopping in their pantry.

**4. Two Kinds of Tall** (`lore-two-tall`, Cook Ahiga, phase 1+)
> **COOK:** You notice the folks born on the colony ships are tall? Like, ceiling-tile tall?
> **COOK:** Low spin gravity, couple of generations. Bones get long. Meanwhile the people from the Ceres mines are short and strong as a cargo winch.
> **COOK:** Anyway, I make two sizes of soup bowl now. The Accord calls it "cultural accommodation." I call it "my shoulder hurts."
> **COOK:** Your fish eat better than both groups, by the way.

**5. The First Word on Mirelle** (`lore-first-word`, Marshal Teo and the Prof, phase 3+)
> **TEO:** Halloway. I just read the survey. The first word anybody said when they landed on Mirelle was… "squelch"?
> **PROF:** Ha! Yes. Ensign Paloma stepped right into the first algae mat. Our algae. Seeded from this very hatchery.
> **PROF:** Humanity's been leaving footprints for three million years, Teo. That was the first one that went *squelch* on a planet we woke up ourselves.
> **TEO:** …I'm putting it on the colony crest.
> **PROF:** You absolutely are not.
> **TEO:** I absolutely am.

---

## 5. The station: rooms, not tabs

The game is one Pixi stage with a Preact UI on top. You move between **rooms**. On mobile a bottom dock holds five big icon buttons; on desktop the rooms appear as a side rail. Each room is a Pixi scene plus a Preact panel, and switching rooms keeps the tank alive in the background (it is the heart of the station).

| Room | Pixi scene | Preact panel | Job |
| --- | --- | --- | --- |
| **Hatchery** | Tank, porthole, cabin frame | Roster, fish dossier sheet, Feed, PIP hint strip | Look after, breed, select |
| **Bridge** | Procgen planet surface, region map, pod trajectories | Requests board, region detail with naming poll, forecast | Choose where to deliver, see the planet change |
| **Roe Counter** | Shop counter with cryo-drawers that open, Archivist Sel | Stock, crates, cuttings, upgrades | Spend credits |
| **Comms** | Radio console with a scope sweep | Comics log, Exchange headlines and demand ticker | Story and the market |
| **Lab** | Two-fish Punnett view, the DNA strand as pixel beads | Genetics, Field Notes collection | Plan pairings, discover alleles |

The **HUD** is always visible:
- Orbit clock with a day/night dial.
- Bloom bar and phase name.
- Credits.
- The Ask the Prof button.
- A comms light that blinks when a message is waiting.

---

## 6. The planet: procgen surface and regions

### 6.1 Generation

Each planet is a seed (`mirelle`, and later `kessa`, `oru`). `planet/gen.ts` is pure and deterministic, runs in a worker, and is unit tested.

1. **Heightmap.**
   - fBm value noise on a sphere: sample 3D noise at unit-sphere points, so there are no seams at the poles.
   - An equirectangular map of 256×128 cells.
   - A continent mask from low-frequency noise. A ridge term creates the trench later.
2. **Climate.**
   - Temperature comes from latitude, minus height, plus noise.
   - Moisture comes from distance to water plus noise.
   - Both are offset by the **terraform phase**, so the planet actually warms and wets over time, which matches the v2 biome condition shifts.
3. **Water bodies.**
   - Flood fill below sea level gives ocean basins and lakes.
   - Rivers are traced downhill from high, wet cells.
   - Deltas are where rivers meet the ocean.
   - Trench cells are the deepest ridge-term cells.
4. **Regions.**
   - Pick 12–18 seed points per planet using Poisson-disc sampling over water cells only.
   - Grow regions across water by priority flood (a Voronoi on water).
   - Classify each region into a biome by its dominant cells: lake → `melt`, river → `river`, delta → `delta`, warm shallow ocean → `reef`, deep → `trench`.
   - Each region gets a centroid, an area, a biome and an `opensAtPhase`. The biome table from v2 still sets the conditions, but now each region carries them.

### 6.2 Rendering (Pixi)

- **Orbit view on the Bridge.**
  - A 192 px pixel globe drawn by projecting the equirect map, as in v2 but bigger.
  - Rendered to a texture once per terraform state change, then rotated by offsetting UVs in a small shader.
  - Ice caps shrink, seas spread and land greens as Bloom rises.
  - Clouds are a second, slowly drifting layer.
  - A terminator shadow follows the orbit cycle.
- **Surface view.**
  - Tap the globe to flatten to a 2:1 pixel map with region borders as dotted coastline-coloured lines and each region's name label.
  - Locked regions are dimmed with a small padlock and "Opens in Phase N".
  - Pan with drag. Pinch zoom stops at 2× and 3× integer steps.
- **Region life.** Each region shows a life meter as a small leaf icon that fills. Delivered fish appear on the map as tiny one-pixel sparkles in that region that slowly increase. You can see *your* fish out there.

### 6.3 Delivering to a region

- Requests now come **from regions**. A request card names its region ("Brinemouth Delta · Saltmother Camp"), and a tap on the card highlights the region on the map.
- **Free seeding** (v2's "release") now asks you to pick a region on the map. Only open regions whose conditions the fish fits are tappable, and the others shake with a short reason ("too warm for a cold-water fish").
- Every delivery adds to the region's **Life** (0–100) and to global Bloom.
- **Launch windows.** Each region passes under the station once per orbit. A delivery during its window (shown as a glowing arc on the orbit dial) earns +25% Life and a "Clean drop!" from PIP. You don't need to wait for a window; it just feels like space work.
- **Pod animation.** A countdown runs (3…2…1), the pod drops through the airlock, and the scene cuts to the Bridge, where a trail arcs to the region and makes a little splash ring. The cut is skippable, and on later deliveries it is shortened automatically.

### 6.4 Naming regions: the live poll

- When a region **opens**, the Colony Accord posts three **fantasy names** for it, generated from a syllable grammar tuned per biome:
  - Lakes: soft vowels ("Lake Ilvenna", "Moorwell Glass", "The Quiet Oyl").
  - Rivers: running consonants ("Tasselrun", "Vey-Arrow", "Brannock Reach").
  - Delta: salty ("Saltmother Mouth", "Kerrowbrine", "The Lisp").
  - Reef: bright ("Coralune", "Pinkwater Steps", "Ambermantle").
  - Trench: ominous but cozy ("Lanternfall", "The Long Hush", "Oldlight Deep").
  - The grammar lives in `content/names.ts`, is seeded by planet and region id, and never repeats on one planet.
- The **poll is live while the region is being seeded** (Life 0–100). The region panel shows the three names with vote bars.
- **The player's votes.** Every delivery to that region gives one vote token, and a perfect-fit delivery gives two. Spend them by tapping a name, which gives a small heart burst.
- **The other colonists** (simulated for now, see §11). An NPC vote stream is derived deterministically from region seed and time, so the bars move on their own and the poll feels alive. A comms line sometimes comments ("Dot voted for 'The Quiet Oyl'. Obviously.").
- **Closing.** When Life reaches 100 the poll closes with a short ceremony:
  - A Professor panel announces the name.
  - The label stamps onto the map with a pixel "ink" effect.
  - The Field Notes entry is written, and you get a mission patch.
  - Ties go to the player's pick.
- **The backend seam.** Votes go through `backend.polls.vote(regionId, nameId)` and `backend.polls.watch(regionId)`. Today `LocalBackend` adds the player's votes to the simulated stream. Later, PocketBase makes the poll truly multiplayer without touching UI code.

---

## 7. The Roe Counter: the fish store

The Earth Ark seed bank, run by Archivist Sel. It replaces the v2 Vault.

- **Rotating stock.**
  - Six cryo-drawers restock every orbit (about 12 min). The restock moment shows a quick "Restocked" comms ping.
  - Stock is weighted toward currently open biomes and the **next** forecast. The Prof hints "Sel just got some warm-water roe in" before a phase that needs it.
  - Each drawer shows the fish's animated pixel preview (baked from its genome, juvenile stage), its name, its water needs as chips, its rarity, and its price.
- **Sorts of roe:**
  - *Biome roe*: a guaranteed fit for one biome. This is the v2 `rollForBiome`.
  - *Wildcard roe*: anything goes, cheap.
  - *Heritage roe*: rare and expensive. It carries a named allele the player hasn't discovered yet. It is the main way new genetics enter the tank.
  - *Mystery crate* (3 roe, one at least rare): a weekly-feeling treat. The crate opens on the counter with a little crank animation.
- **Cuttings:** decorative tank plants (from `waterplant2` and `plant3` seeds) for the tank. They are cosmetic for now, with a small happiness bonus later.
- **Upgrades:** tank extensions (more berths), a better feeder (auto-feed once per orbit), a heated tank zone (keeps tropical fish happy while the tank sits in a cold phase), and a second tank (late game).
- **Buyback:** sell fish here too, at Exchange prices, with demand arrows (▲▼) beside each fish.
- **Price feel:** v2 prices stay as the baseline (`priceOf`, `demand`). Shop items show the price in lamp-amber, and you get a coin-drop sound when you buy.

---

## 8. Plants on the canvas

- **Sources:**
  - `src/v2/waterplant` (`waterplant2`: kelp and other forms, size classes, animations `sway` and `gust`).
  - `src/v3/plant` (`plant3`: 16 species, animations `idle`, `wind`, `gust`, `bloom`, `glow`).
  - Both expose `fromSeed`, `fromCode`, `frame(genome, anim, i)` and `sizeOf`, the same shape as the fish generator.
- **Pipeline.** Plants go through the same worker baker as fish (§9.3). Each animation becomes a horizontal strip, then a Pixi `Texture` with frames, then an `AnimatedSprite`.
- **Placement.**
  - The tank has a back plant row and a front row, both anchored to the sand at the generator's `anchor: 'bottom'`.
  - Players place plants from Cuttings into slots by tapping a slot.
  - Starter tank: three kelp and two land-style plants on the "dry ledge" behind the glass, for coziness.
- **Sizes.** As you said, the generators' sizes don't match the tank scale yet, and **we don't touch the algorithms now**. Instead:
  - A `PLANT_SCALE` table maps generator size classes to an integer display scale and a max height in tank pixels.
  - Sprites are scaled by integers only, or clamped by cropping from the top, never by blurry fractional scaling.
  - A debug toggle (`?plants=debug`) draws each plant's bounding box and size class, so the size fix is easy to tune when the generator work happens.
- **Plants on the planet.** As regions gain Life, the surface map scatters tiny 1–3 px "flora" dots. Real plant sprites only appear in the region detail card (a little diorama of the region: water, two plants from the region's seed, and fish delivered there).

---

## 9. Tech stack and architecture

### 9.1 Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Build | **Vite 6 + TypeScript (strict)** | Fast dev, module workers out of the box, easy PWA |
| Renderer | **PixiJS v8** | WebGL batching for many sprites, filters (caustics, glow, CRT), AnimatedSprite, ParticleContainer, WebGPU path |
| UI | **Preact + @preact/signals** | About 4 kB, React-like, signals make HUD and live polls cheap to re-render |
| Styling | Plain CSS with tokens (one file per component, CSS modules) | No framework needed; pixel UI is custom anyway |
| Storage | **idb-keyval** behind `Backend` | Async, larger quota than localStorage, same API later for PocketBase |
| Workers | Vite `?worker` module workers | Sprite baking and planet generation off the main thread |
| Audio | WebAudio synth (kept) and one ambient loop | No asset pipeline needed; Howler only if music files arrive |
| Tests | **Vitest** for rules, planet gen and comms; **Playwright** for smoke tests on a phone viewport | Rules stay pure and fast to test |
| PWA | vite-plugin-pwa | Installable, offline after the first load |
| Hosting | Cloudflare Pages (static), or the Artifact build for previews | Static output; nothing server-side yet |
| Later | PocketBase (auth, saves, polls, leaderboards) | Plugs into `Backend` (§11) |

### 9.2 Layout

The new app lives in `aquarium/` as its own Vite project. The current vanilla build moves to `aquarium/_v2/` until parity, then is deleted.

```
aquarium/
  package.json            # vite, typescript, pixi.js, preact, @preact/signals, idb-keyval, vitest, playwright
  vite.config.ts          # alias @forge → ../src ; worker format 'es'
  index.html
  src/
    main.tsx              # boot: load save, start Pixi, mount UI
    game/                 # PURE rules (ported from v2 world.js, split up, typed)
      constants.ts  biomes.ts  fish.ts  requests.ts  market.ts  breeding.ts
      regions.ts    polls.ts   orbit.ts story.ts    shop.ts     state.ts  tick.ts
    planet/
      gen.ts  noise.ts  regions.ts  names.ts  planet.worker.ts
    art/
      bake.worker.ts      # generic: { family, code, anim } → RGBA strip (fish3 | waterplant2 | plant3 | pilot2)
      atlas.ts            # strips → Pixi textures, LRU, ref counts
      characters.ts       # CharacterArt.get(id, mood); pilot-backed now, replaceable
    scenes/
      stage.ts            # Pixi Application, integer pixel scaling, resize, room switching
      hatchery/  tank.ts fish.ts plants.ts food.ts bubbles.ts porthole.ts cabin.ts filters.ts
      bridge/    globe.ts surfaceMap.ts pods.ts
      counter/   counter.ts
      comms/     radio.ts
      lab/       strand.ts
    ui/
      App.tsx  Hud.tsx  Dock.tsx  Sheet.tsx  Toasts.tsx
      rooms/   Hatchery.tsx Bridge.tsx Counter.tsx Comms.tsx Lab.tsx
      comic/   ComicStrip.tsx Bubble.tsx Portrait.tsx
      briefing/ Briefing.tsx
      theme.css
    store/
      signals.ts          # game state as signals; actions call pure rules then commit
      backend.ts          # Backend interface + LocalBackend (idb-keyval) + SimPolls
    content/
      comms/*.ts  story.ts  names.ts  patches.ts
    audio/sfx.ts  ambient.ts
  test/
    rules.test.ts  planet.test.ts  polls.test.ts  comms.test.ts  save.test.ts
  e2e/smoke.spec.ts
```

### 9.3 Rendering details (performance budget: 60 fps on a mid-range phone with 30 fish, 12 plants and 200 particles)

- **Pixel-perfect scaling.**
  - The game world renders into a low-res `RenderTexture` (about 360 px wide, like v2), which is then drawn to the screen at integer scale S with `scaleMode: 'nearest'`.
  - Letterbox gaps are filled by the cabin frame art, so they look intentional.
  - **The lesson from the v2 bug:** the canvas element is `position:absolute; inset:0` inside a sized container. Pixi's `resizeTo` targets that container, never the window, and never sets a CSS size larger than its parent.
- **Sprites.**
  - The bake worker returns strips, and the main thread makes `Texture.from(ImageBitmap)` and slices frames.
  - Strips are cached in an LRU keyed by `family|code|anim`, and textures are destroyed on eviction.
  - Fish use `AnimatedSprite` with per-fish speed, mirrored by `scale.x = -1`.
- **Batching.** Fish, plants and food sit in one container. Bubbles and sparkles use `ParticleContainer`. Text is HTML (Preact) or Pixi `BitmapText` for in-tank callouts.
- **Filters**, all optional and switched off by a "Battery saver" setting and on low-end detection (fps under 45 for 3 s):
  - Caustics (a small displacement filter with a tiled noise texture).
  - God rays (additive gradient sprites, not a filter).
  - Glow for bioluminescent fish at night.
  - A slight CRT scanline on the comms screen only.
- **Backgrounds.** The parallax starfield is three `TilingSprite`s. The porthole planet is a mask over the Bridge globe texture, reused. The cabin frame is a 9-slice sprite.
- **Lifecycle.** Pause the ticker when the tab is hidden, run the catch-up tick on return (capped at 6 h, as in v2), and render at 30 fps on the Bridge when nothing moves.

### 9.4 Game state and rules

- Port `aquarium/js/world.js` into `src/game/*` with types, keeping its behaviour and constants. Port the 9 existing tests in `test/aquarium.test.mjs` to Vitest first, so the port is verified.
- **New state:**
  - `regions` (id, biome, life, opened, name, poll)
  - `orbit` (epoch, so the cycle is derived from `now`)
  - `story` (seen beats, chapter, flags)
  - `comms` (log, cooldowns)
  - `shop` (stock seed, last restock)
  - `decor` (plant slots)
  - `fieldNotes`
  - `patches`
  - `settings`
- Rules stay **pure functions of `(state, now, seed)`**. The signals store is the only place that mutates. Each action calls a rule, gets `{ state, events }`, commits, and dispatches events to scenes (pod launch, hatch pop), comms (reactions) and audio.
- **Save:** versioned, with a `migrate(v1 → v3)` that imports a current Seedfall localStorage save if one is found. Fish, credits and Bloom carry over, and each v2 biome becomes its first region.

---

## 10. Story structure: "the mission"

The game is a series of **Chapters** that map onto the v2 phases. Each has a Professor briefing, a mission patch and a few scripted comms beats. Between beats, the ambient pool fills the quiet.

| Ch. | Phase | Title | The Prof's mission | Beat that ends it |
| --- | --- | --- | --- | --- |
| 0 | First Thaw | **Wake-up Shift** | "Keep five fish alive and send one to the lakes. That's literally the whole job today." | The first pod lands; Dot writes in. |
| 1 | Rivers Run | **Moving Water** | "The meltwater's running downhill. Rivers want strong swimmers." | The first region is named by poll. |
| 2 | Brine Rising | **Salt in the Wound** | "Mirelle's getting salty. Literally. We need fish that can handle both." | The delta flips brackish, and a comms crisis follows: a fish die-off rumor that turns out to be a misread sensor. |
| 3 | Warm Seas | **Coral Weather** | "Reef season! Colour is a feature, not a bug." | The first squelch (entry 5); the colony crest. |
| 4 | The Deep Wakes | **Lanternfall** | "Something down there is glowing back at us. I love this job." | The deep trench lights up on the night side of the globe. |
| 5 | Living World | **Hand-off** | "You don't need me anymore. I'm going to cry in the galley." | Mirelle is declared living. The epilogue sets up the next planet. |

**Side work.** Short optional "work orders" from the cast, each with a small reward and a story line:
- Cook wants a fish "the colour of a ripe mango".
- Dot wants a fish with a funny name.
- Sel wants an old Earth allele brought back.

---

## 11. Backend seam (no auth, no DB now)

```ts
interface Backend {
  save: { load(): Promise<Save | null>; store(s: Save): Promise<void> };
  polls: {
    watch(regionId: string, cb: (tally: Tally) => void): () => void;
    vote(regionId: string, nameId: string, weight: number): Promise<void>;
  };
  market?: { headlines(now: number): Promise<Headline[]> }; // later: shared economy events
}
```

- **Now:** `LocalBackend` uses idb-keyval for saves and **SimPolls** for polls (a deterministic NPC vote stream plus the player's votes, persisted locally).
- **Later:** `PocketBaseBackend` adds anonymous or OAuth auth, a `saves` collection, `polls` and `votes` collections with realtime subscriptions (so the bars move with real players), and an optional server-driven Exchange. The repo already has `npm run pb` and `pb_migrations/` to build on. Nothing in game code imports PocketBase directly.

---

## 12. Milestones

Each milestone is playable and verified on desktop and on a 390 px phone viewport before the next one starts.

1. **M1 — Foundation.**
   - Vite + TS + Preact + Pixi scaffold, with the `@forge` alias importing the fish generator (`src/v3/fish`).
   - Port the rules from `world.js` and the 9 tests.
   - Generic bake worker and atlas.
   - Pixi tank with fish, food, bubbles and pixel scaling, plus the Hatchery room at feature parity with v2's tank, roster and dossier.
2. **M2 — Cozy space look.**
   - Theme, cabin frame, porthole starfield, orbit clock and day/night, caustics and god rays, the ambient loop.
   - Plants in the tank from `waterplant2`/`plant3`, with `PLANT_SCALE` and the debug view.
3. **M3 — Professor and comms.**
   - `CharacterArt` (pilot-backed), the comic strip UI, the briefing screen, Chapter 0 onboarding, the 5 lore entries plus about 15 ambient and reaction lines, and Ask the Prof.
4. **M4 — Planet.**
   - Procgen planet worker, regions, globe and surface map on the Bridge.
   - Requests tied to regions, region picking for releases, launch windows, the pod animation.
5. **M5 — Polls.**
   - Name grammar, SimPolls, vote tokens, the region panel, the naming ceremony, Field Notes and patches.
6. **M6 — Roe Counter.**
   - Rotating stock, heritage roe, crates, cuttings, upgrades, buyback with demand arrows.
7. **M7 — Lab and polish.**
   - Punnett view, Chapters 1–5 scripted beats, battery saver, PWA, Playwright smoke test, save migration from v2.
8. **M8 — Ship it.**
   - Cloudflare Pages deploy (once you approve), plus the private Artifact build for quick previews.

---

## 13. Acceptance criteria

- A first session goes through Chapter 0 with no dead ends. A new player feeds, pairs, hatches and delivers within 5 minutes, guided only by the Prof and PIP.
- 60 fps on a mid-range phone with 30 fish and 12 plants. No layout shift, and no horizontal scroll at 360–430 px.
- The planet is identical for the same seed (a snapshot test), and every open region is reachable by at least one fish the shop can sell (a feasibility test, as in v2).
- A region poll always closes with exactly one name, and that name never repeats on the planet.
- Comms never interrupt a pairing, a launch or a briefing, and never show the same ambient entry twice within 30 minutes.
- Save and reload preserve everything, including poll tallies and the comms log. A junk save starts a new game instead of crashing.
- No game file imports a backend SDK. Swapping `LocalBackend` for a stub in tests needs no other changes.

---

## 14. Open decisions (with defaults I'll use unless you say otherwise)

- **Second planet.** Kessa, an ice moon (cold, deep, little light), after the Mirelle epilogue. The default is to design for it in data but not build it in v3.
- **Pilot portraits.** The default is the `pilot2` portrait framing at 2× in the comic panels, with a `figure: 'tutor'` variant from `pilot-pixel.js` if it reads better for the Prof.
- **Deploy.** The default is the private Artifact preview per milestone, and Cloudflare Pages only after you approve.

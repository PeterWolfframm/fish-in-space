# FISH IN SPACE

Procedural pixel art — for some reason, specialised in fish!

Procedural pixel art for pilots, fish, and plants. Each family has a frozen v1 and a lit v2 remaster. The app look is the local Keypad kit (`@keypad/ui`), with a light and a dark theme.

- **v1**: the historic generators in `src/gen/`. They are **frozen**: that tree never changes,
  and `test/parity.test.mjs` plus `test/v1-frozen.test.mjs` hold them pixel for pixel.
- **v2**: the lit remasters in `src/v2/`. Shapes are shaded like solids, detail scales with
  the pixel budget, and a pose rig drives the animation.

| kind | v1 | v2 |
|---|---|---|
| Pilots (Burn-Through) | `pilot` 32×32 | `pilot2` framings |
| Fish (fish.) | `fish` 48×32 | `fish2` six classes |
| Tank plants (fish.) | `waterplant` 32×48 | `waterplant2` four classes |
| Garden plants (plantasia) | `plant` 16×16, `plant32` 32×32 | `plant2` five heights |

**Fish v3** (`fish3`, the app's "v3" button) grows v1's cute fish up. v1 stays frozen.
- 32 bodies plus bred hybrids, including piranha teeth, triggerfish belly fins, eels and molas.
- Six size classes at constant density, from tiny to giant.
- A modelled swim: a body wave whose gait comes from the body. It has three looks, picked with
  `--set swim=raised|side|cartoon`.
- Mendelian colour genes, pattern overlays, lines that breed true, sterile mules and sports.
- A name for every fish.
It also opens v1 `f…` codes as the same fish. Code lives in `src/v3/fish/`. To fix single
frames by hand, use the `fish-keys` skill.

```sh
node cli/forge.mjs fish3 --count 12 --contact --set swim=cartoon
node cli/forge.mjs fish3 --count 6 --anim turn --contact --set body=piranha
```

**Garden plants v3** (`plant3`, the "v3" button under Garden plants) grows v1's plants the same
way. v1 stays frozen. Tank plants are a different subject and stay as they are.
- 16 species on nine bend habits: the nine v1 forms, plus reed, fern, succulent, willow, palm,
  conifer and ivy. A species owns the silhouette. Rolls only nudge it.
- Five heights at constant density, from a 16px herb to a giant. Veins and bark appear as the
  plant gets taller.
- A rooted cantilever. The habit sets who moves (a grass whips, a cactus barely does, a tree's
  crown follows its trunk). The pose only sets the wind. Three looks, picked with
  `--set look=garden|breeze|cartoon`.
- Mendelian leaf pigment, a few named crosses, and a name for every plant.
It also opens v1 `g…` codes as the same plant. Code lives in `src/v3/plant/`.

```sh
node cli/forge.mjs plant3 --count 9 --contact --scale 4
node cli/forge.mjs plant3 --anim wind --count 4 --size all --contact
```

v2 sizes are listed for a typical body. The real canvas follows the genome (`sizeOf(gen, genome)`):
eels and sharks come out wider than they are tall, sprawling plants come out wide, and columnar
plants come out narrow. **Constant density** means 1 px is the same size in every class. A giant
fish is not an upscaled small one: it gets a bigger canvas and more drawn detail (scales, fin
rays, lateral line, bark, leaf veins). The pilot framings are crops of one 64×48 scene, so the
face is the same pixels in every framing.

Each kind is a **genome**: a kit `defineTraits` field list. It drives rolling from a seed, the
editor, breeding and a short shareable code. v1 codes are `c…` pilot, `f…` fish, `w…` tank
plant, and `g…` plant. v2 codes add a dot (`c.…`, `f.…`, `w.…`, `g.…`). v3 codes are `f3.`
and `g3.`. v2 keeps v1's fields in order and appends size and style, and the same seed rolls
the same creature.

## Use it

```sh
npm run app                     # http://localhost:8017/app/: roll, edit, lock, breed, export
npm run forge -- list           # the generators
node cli/forge.mjs plant --count 24 --anim stages --contact --scale 4
node cli/forge.mjs fish --code f1a2b3… --sheet
node cli/forge.mjs pilot --seed "MAGIC 1" --anim talk --sheet --scale 8
node cli/forge.mjs fish2 --count 12 --size all --contact   # every size class of each fish
node cli/forge.mjs plant2 --size giant --anim wind --sheet
npm test
```

The Seedfall aquarium game runs on its own Vite server:

```sh
cd aquarium
npm ci
npm run dev                     # http://localhost:5173/
```

To open it through the Fish in Space site instead, build it with `npm run build` in `aquarium/`,
then start the app server and visit `http://localhost:8017/aquarium/`. The landing page is at
`http://localhost:8017/`; Fish in Space is at `/app/#forge`.

The CLI writes PNGs plus `manifest.json` (seed → code → size → files) into `out/<kind>/`.
`--size <class|all>` works on v2 kinds only. Contact sheets pad mixed sizes on the generator's
anchor (bottom for plants and pilots).

In the app, each family has **v1** and **v2** (fish and garden plants also have **v3**). Switching version keeps
the creature: the v2 generator reads that family's v1 code. The **Size**
menu forces a class onto the preview and the gallery. The **Look** menu does the same for the
v2 render style: `lit` (shaded solids), `comic` (cel bands, tinted ink outline, fewer tones and
less texture: v1's simple charm on v2 shapes) or `clean` (in between).

## pixelgen: swipes teach the procgen

pixelgen is a small neural network (`src/pixelgen/`) that learns from swipes what makes these
sprites look good. It does not learn "the ideal fish". The content of a roll (species, body,
form, …) stays exactly as the seed made it. The model only picks the **style genome** (light,
contrast, hue shift, saturation, palette harmony, dither, outline, rim light, look), so every
creature is rendered at its best and the variety stays as it is.

`npm run app` starts three things:

- **PocketBase** on :8090. On first run it is downloaded into `.pocketbase/`, the migrations
  are applied, and a superuser is created and saved in `.pocketbase/superuser.json`. The
  dashboard is at `:8090/_/` (and at the app's own `/_/`, which is the same server proxied).
- **The trainer**, which retrains the public model on everyone's swipes when new ones come in.
- **The app**, on `APP_PORT` (default 8017). It serves the files and proxies PocketBase
  (`/api` and `/_/`), so the page talks to its own origin. Set `HOST=0.0.0.0` when something
  outside this machine must reach it.

`npm run pb` and `npm run trainer` run the first two on their own. To use your own superuser,
set `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD`. To use a different server, set `PB_URL`.

The app's tabs:

- **Forge** is public. Every generator can be rolled, edited and exported with no account.
- **Swipe**, **Tank**, **Likes**, **Breed** and **Home** need a member account. There is no public
  sign-up. Create accounts with `npm run pixelgen:user <email> <password> [name]` while PocketBase
  is running, or from the dashboard at `/_/`.
- **Swipe**: an animated deck of every kind.
  - Drag or fling a card, or use ← / →. **U** undoes the last swipe.
  - **N** (or dragging up) opens notes: flag traits, pick what a trait should be *instead*,
    say it looks like a different kind, or write free text.
  - Each card shows the **Public** and **You** scores.
  - The deck mode picks how cards are made: random rolls, or rolls polished by the public
    model, the personal model, or a blend of both.
- **My likes**: what you approved. From here you can open a like in the Forge, download it, or
  remove the like.
- **Forge**: **Beautify** (off · public · personal · blend) polishes the rolls and the gallery.
  Style fields you have locked are kept.
- **Admin**: everyone's swipes with filters and CSV export, plus per-person counts. It also
  shows the public model's held-out accuracy and what raises or lowers its score, and has a
  button to retrain it now.

How accounts and the models work:

- **Accounts**: the Forge works signed out, including when PocketBase is down. Swipes belong to
  member accounts only. The public API cannot create users.
- **Admin**: `npm run pixelgen:admin <email>` makes an account admin. Reload the page afterwards.
- **Public model**: trained by the trainer on everyone's swipes. Each person's weight is
  1/√(their swipe count), so one heavy swiper does not define public taste.
- **Personal model**: fine-tuned from the public one in a browser worker a moment after each
  swipe, and saved to PocketBase.

From the CLI:

```sh
node cli/forge.mjs fish2 --count 24 --contact --beautify public       # polished by the public model
node cli/forge.mjs plant2 --count 24 --contact --beautify blend:<userId>
node cli/forge.mjs pilot2 --count 12 --contact --look comic
node cli/forge.mjs fish2 --count 24 --contact --model model.json --look clean
```

`--beautify` takes `public`, `personal:<userId>` or `blend:<userId>`, and reads the model from
PocketBase. `--model` reads it from a file instead: either a model record or bare net JSON.
`--look` forces a look, and Beautify then leaves it alone. All three flags work on v2 kinds only.

## Deploy on Fly.io

One Machine serves the app and proxies PocketBase on the same HTTPS origin. SQLite lives on a
volume mounted at `/data`, so keep a single Machine. `fly deploy` would otherwise start two,
and two machines cannot share the database file.

`app/built.css` is already built and goes in the image. The image does not install npm packages
or the local Keypad kit. Build on Fly's remote builder (the default). A local `--local-only`
build on Apple Silicon would still be fine: the Dockerfile downloads the linux/amd64 PocketBase
binary.

```sh
brew install flyctl          # or https://fly.io/docs/flyctl/install/
fly auth login

fly apps create fish-in-space   # if that name is taken, change `app` in fly.toml to match
fly secrets set PB_SUPERUSER_EMAIL=you@example.com PB_SUPERUSER_PASSWORD='…'
fly deploy --ha=false        # first deploy also creates the 1GB pb_data volume
```

Change `primary_region` in `fly.toml` before the first deploy if Frankfurt is the wrong region.

- Landing page: `https://fish-in-space.fly.dev/`
- Fish in Space: `https://fish-in-space.fly.dev/app/#forge`
- Seedfall aquarium: `https://fish-in-space.fly.dev/aquarium/`
- PocketBase dashboard: `https://fish-in-space.fly.dev/_/` (the superuser from the secrets above)
- A member, so they can swipe: `fly ssh console -C "node /app/scripts/pixelgen-user.mjs you@example.com 'a long password' Ada"`
- Admin, for someone who already has an account: `fly ssh console -C "node /app/scripts/pixelgen-admin.mjs you@example.com"`, then reload

Redeploy with `fly deploy --ha=false`. Do not `fly scale count 2`.

Fly keeps volume snapshots for five days. That is not a backup. SMTP is optional; members sign in
with the email and password you created, and the app does not send mail. After the first boot, in
the PocketBase dashboard (Settings → Application): turn the rate limiter on, and set the user IP
proxy header to `X-Forwarded-For`.

## Adding an animation

v2 animations are data: a list of loop-safe *motions* (`src/v2/anim/motions.js`) that set pose
channels (`src/v2/anim/rig.js`), which the renderer draws. The project skill
`.claude/skills/add-animation` walks Claude Code through adding one:

```
/add-animation fish2 eat
/add-animation plant2 "storm: a hard gust that bends the tree and settles"
```

It reuses or writes motions, adds a channel only when it has to (rest value = today's drawing),
registers the anim, runs the tests (every anim × size draws, loops close, loops move) and renders
a check sheet at every size. It never touches v1.

## As a library

Everything under `src/` is plain ES modules with no build step and no DOM, except
`src/pixel/blit.js`. A generator is:

```js
{ id, label, game, version: 1 | 2 | 3, family, size: {w, h}, bg, traits,
  fromSeed(seed, opts) → genome,
  anims: [{ id, frames, fps, loop?, continuous? }],
  frame(genome, animId, i) → {w, h, data, palette},
  at?(genome, t), breed?(a, b, seed),
  // v2 only:
  sizes: [{id, w, h}], sizeField, sizeOf(genome) → {w, h}, fromCode(code), anchor }
```

`import { GENERATORS, generator, fromCode, sizeOf } from 'fish-in-space/registry'`. `sizeOf(gen,
genome)` works for every version. v2 modules are importable directly as `fish-in-space/v2/...`.

The narrower exports are still there:
- `pilotSpec`/`pilotFrame` (src/gen/pilot-pixel.js)
- `drawFish`/`fishFromSeed`/`breed` (src/gen/fish.js)
- `drawWaterplant` (src/gen/waterplant.js)
- `drawPlant(genome, t, size)`/`plantStages` (src/gen/plant.js)

## Where the code comes from

- `src/pixel/` is vendored from the pixel kit (`yeswar/kit/web/pixel`). Update it with
  `npm run vendor:pixel`; the test fails if it drifts.
- `src/gen/pilot-pixel.js` and `src/gen/pilot-avatar/` are ports of yeswar's `web/pilot-pixel.js`
  and `web/pilot/avatar-*.js`. The game glue stays in the game: crew overrides, the voxel bust
  and the channel table.
- `src/gen/fish/` is a port of fish.'s `src/fish/{genome,draw,palettes}.ts`, with the types stripped.
- `test/fixtures/` holds fingerprints rendered once from the original game code
  (`npm run goldens:pilot`, `npm run goldens:fish`). `test/parity.test.mjs` holds the ports to
  them pixel for pixel.

  `npm run goldens:v1` rendered `waterplant` and `plant` once, and `test/v1-frozen.test.mjs`
  holds them to it.

`waterplant`, `plant` and all of `src/v2/` are new here. v2 reuses the vendored kit and imports
v1 helpers (stroke walking, leaf shapes, palettes, seed rolls), but it never edits them.

# pixelforge

Procedural pixel art for three games, from one place. Every kind exists twice:

- **v1**: the historic generators. They are **frozen**: `src/gen/**` never changes, and
  `test/parity.test.mjs` plus `test/v1-frozen.test.mjs` hold them pixel for pixel. Their ids
  (`pilot`, `fish`, …) and codes keep working forever.
- **v2**: the new procgen in `src/v2/`. Shapes are lit like solids with hue-shifted ramps, there
  are no black ink outlines, detail scales with the pixel budget, and there are size classes and
  a pose rig for animation. Every v2 kind reads v1 codes too, as remasters of the same creature.

| kind | v1 (frozen) | v2 size classes (constant pixel density) | v2 anims |
|---|---|---|---|
| Pilots (Burn-Through) | `pilot` 32×32 | `pilot2` framings: icon 16×16 · portrait 32×32 · bust 48×48 · cockpit 64×40 | idle, talk, blink, strain, alarm, grin, calm, eject, scope, glance, shake |
| Fish (fish.) | `fish` 48×32 | `fish2` tiny 24×20 · small 32×24 · medium 48×32 · large 64×40 · huge 92×56 · giant 124×72 | swim, idle, dart, turn, eat |
| Tank plants (fish.) | `waterplant` 32×48 | `waterplant2` small 20×32 · medium 32×48 · large 52×80 · huge 80×128 | sway, gust |
| Garden plants (plantasia) | `plant` 16×16, `plant32` 32×32 | `plant2` herb 16 · shrub 32 · tall 48 · tree 64 · giant 96 px tall | stages, grow, wind |

v2 sizes are listed for a typical body. The real canvas follows the genome (`sizeOf(gen, genome)`):
eels and sharks come out wider than they are tall, sprawling plants come out wide, and columnar
plants come out narrow. **Constant density** means 1 px is the same size in every class. A giant
fish is not an upscaled small one: it gets a bigger canvas and more drawn detail (scales, fin
rays, lateral line, bark, leaf veins). The pilot framings are crops of one 64×48 scene, so the
face is the same pixels in every framing.

Each kind is a **genome**: a kit `defineTraits` field list. It drives rolling from a seed, the
editor, breeding and a short shareable code. v1 codes are `c…` pilot, `f…` fish, `w…` tank plant
and `g…` plant. v2 codes add a dot (`c.…`, `f.…`, `w.…`, `g.…`), so the two never collide. v2
keeps v1's fields in v1's order and appends new ones (size class, helmet style, scales, barbels,
conifer form, …). The same seed therefore rolls the same creature in both, and the size class is
part of the code: you can lock it, breed it and share it.

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

The CLI writes PNGs plus `manifest.json` (seed → code → size → files) into `out/<kind>/`.
`--size <class|all>` works on v2 kinds only. Contact sheets pad mixed sizes on the generator's
anchor (bottom for plants and pilots).

In the app, each family has a **v1 | v2** toggle. Switching keeps the creature. The **Size**
menu forces a class onto the preview and the gallery.

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
{ id, label, game, version: 1 | 2, family, size: {w, h}, bg, traits,
  fromSeed(seed, opts) → genome,
  anims: [{ id, frames, fps, loop?, continuous? }],
  frame(genome, animId, i) → {w, h, data, palette},
  at?(genome, t), breed?(a, b, seed),
  // v2 only:
  sizes: [{id, w, h}], sizeField, sizeOf(genome) → {w, h}, fromCode(code), anchor }
```

`import { GENERATORS, generator, fromCode, sizeOf } from 'pixelforge/registry'`. `sizeOf(gen,
genome)` works for both versions. v2 modules are importable directly as `pixelforge/v2/...`.

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

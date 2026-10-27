# pixelforge

Procedural pixel art for three games, from one place:

| kind | game | size | anims |
|---|---|---|---|
| `pilot` | Burn-Through (yeswar) | 32×32 | talk, blink, strain, alarm, grin, calm, eject, scope sweep |
| `fish` | fish. | 48×32 | 6-frame swim |
| `waterplant` | fish. tank plants | 32×48 | 8-frame sway loop |
| `plant` / `plant32` | plantasia | 16×16 / 32×32 | 4 growth stages, 16-frame timelapse, any growth `t` |

Each kind is a **genome**: a kit `defineTraits` field list. It drives rolling from a seed, the
editor, breeding and a short shareable code (`c…` pilot, `f…` fish, `w…` tank plant, `g…` plant).
A code always draws the same sprite.

## Use it

```sh
npm run app                     # http://localhost:8017/app/: roll, edit, lock, breed, export
npm run forge -- list           # the generators
node cli/forge.mjs plant --count 24 --anim stages --contact --scale 4
node cli/forge.mjs fish --code f1a2b3… --sheet
node cli/forge.mjs pilot --seed "MAGIC 1" --anim talk --sheet --scale 8
npm test
```

The CLI writes PNGs plus `manifest.json` (seed → code → files) into `out/<kind>/`.

## As a library

Everything under `src/` is plain ES modules with no build step and no DOM, except
`src/pixel/blit.js`. A generator is:

```js
{ id, label, game, size: {w, h}, bg, traits,
  fromSeed(seed, opts) → genome,
  anims: [{ id, frames, fps, continuous? }],
  frame(genome, animId, i) → {w, h, data, palette},
  at?(genome, t), breed?(a, b, seed) }
```

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

`waterplant` and `plant` are new here.

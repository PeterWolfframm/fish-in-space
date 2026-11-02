---
name: add-animation
description: Add a named animation to a PixelForge asset (a v2 generator) — e.g. "/add-animation fish2 eat" or "add a wave anim to the tank plants". Picks or writes loop-safe motions, adds pose channels if needed, registers the anim, tests it and renders a check sheet at every size.
argument-hint: <asset> <animation> [description]
---

# Add an animation to an asset

`$ARGUMENTS` = `<asset> <animation> [what it should look like]`.

In PixelForge v2 an animation is **data**: a list of motions that set pose channels over a phase.
The renderer reads only the pose. Adding an anim is usually one line in a generator, plus maybe
one motion. Only touch the renderer when a channel does not exist yet.

## Hard rules

- **Never edit `src/gen/**`.** That is v1. It is frozen, and goldens hold it byte for byte
  (`test/parity.test.mjs`, `test/v1-frozen.test.mjs`). Never edit `src/pixel/**`: it is vendored.
- **v2 only.** If the asset names a v1 generator (`fish`, `pilot`, `waterplant`, `plant`,
  `plant32`), do not add the anim there. Say it is frozen and offer the current generator
  (`fish2` or `fish3`, `pilot2`, `waterplant2`, `plant3`). `plant2` is the lit remaster.
- **Loops close.** In a looping anim, phase `p` runs over [0, 1) and frame `frames` must equal
  frame 0. Use `sin/cos(2π·p·n)` with whole `n`, `bump(p)`, `during(p, at, len)`, or advance a
  phase channel (`wave`, `wind`, `flutter`, `bubbles`, `sheen`, `sweep`, `phase`) by whole
  cycles. If a motion keys off the frame index `i` (like `talk`'s mouth table or the pilot
  `beat`), pick a frame count that is a multiple of that table's period.
  One-shots (`{ loop: false }`) run p from 0 to 1 inclusive and need not close.
- **Constant density.** Motion amounts are in pixels or normalised units, not in "percent of
  canvas". The renderer scales by body size where that is the right thing (fish `amp`, plant
  sway). An anim must look right at every size class, from the smallest to the biggest, so check them all.
- Motions are pure functions of `(p, ctx, pose)`. Do not use `Math.random`; use the genome or `ctx.i`.

## Where things live

| asset | generator | family | renderer reads pose in |
|---|---|---|---|
| fish | `src/v2/fish/index.js` (`fish2`) | `fish` | `src/v2/fish/draw.js` |
| tank plants | `src/v2/waterplant/index.js` (`waterplant2`) | `plant` | `src/v2/waterplant/draw.js` |
| garden plants | `src/v2/plant/index.js` (`plant2`) | `plant` | `src/v2/plant/draw.js` |
| pilots | `src/v2/pilot/index.js` (`pilot2`) | `pilot` | `src/v2/pilot/draw.js` |
| fish v3 | `src/v3/fish/index.js` (`fish3`) | `fish3` | `src/v3/fish/draw.js` (motions in `src/v3/fish/motions.js`; per-frame fixes via the `fish-keys` skill) |
| garden plants v3 | `src/v3/plant/index.js` (`plant3`) | `plant3` | `src/v3/plant/draw.js` (motions in `src/v3/plant/motions.js`; a bad frame is a row in `src/v3/plant/keys.js`) |

- Channels (name, rest value, meaning): `CHANNELS` in `src/v2/anim/rig.js`. **Read it first.**
- Motions: `src/v2/anim/motions.js`. Fish: `swim hover dart turnRound blink pulse sheen bob eat`.
  Plants: `sway gust flutter bubbles bloomBreath grow stages pulse`. Pilots:
  `expression talk shake blinkAt glance scopeSweep`.
- An anim entry: `anim(id, frames, fps, [motion(opts), …], { loop?, label?, continuous? })`.
  Motions apply in order, and a later motion overwrites a channel set by an earlier one.

## Steps

1. **Resolve the asset.** Map the user's words to one v2 generator from the table. Read its
   `index.js` and look at the existing `ANIMS`. If an anim with that id exists, ask whether to
   change it or to add a variant with a new id.
2. **Design it in channels.** Write down which channels move and how over p ∈ [0, 1).
   Combine existing motions when you can. A fish `eat` is a hover plus a mouth snap.
3. **Reuse or write motions** in `motions.js`, in the family's section, with a one-line doc
   comment. Keep them parameterised (`({ at = 0.4, … } = {}) => (p, ctx, pose) => ({ … })`).
4. **New channel?** Only if nothing in `CHANNELS` can express it:
   - add it to `CHANNELS[family]` in `rig.js` with a rest value that draws exactly as today, so
     every existing anim is unchanged;
   - make the renderer honour it in the family's `draw.js` (every generator of that family, so
     both plant renderers for a `plant` channel), drawing nothing different at the rest value;
   - run `npm test` right away to prove that existing output did not move.
5. **Register** the anim in the generator's `ANIMS`. Choose `frames` and `fps` like the
   neighbours: 6–12 frames, 6–12 fps for action, 4–6 fps for idles. Add `label` if the menu should
   show a different name.
6. **Test:** `npm test`. The v2 suite automatically checks that every anim × every size draws at
   `sizeOf`, that loops close, that looping anims actually move, and that there are no orphan
   pixels. If the anim has a property worth pinning (e.g. "mouth is open on frame k"), add a small
   assertion in `test/v2.test.mjs`.
7. **Look at it.** Render a contact sheet at every size and read the PNG:
   ```sh
   node cli/forge.mjs <gen> --anim <id> --count 4 --size all --contact --scale 4 --bg \
     --out /tmp/anim-check
   ```
   Then `Read` `/tmp/anim-check/contact.png` (or the scratchpad, if there is one). Each row is a genome at
   a size, and each column is a frame. Check that the motion reads at the smallest size and does not
   jitter or clip at the biggest, and that the last frame flows back into the first. Small
   features (mouth, lids, glints) are hard to judge on a contact sheet. Render a `--sheet` at
   `--scale 8` for one genome, or crop the region with `crop()` from `src/v2/kit/sizes.js`, and
   compare the rest frame with the key frame. If a channel barely shows, it is fine to make the
   renderer draw it more clearly, as long as the rest value still draws exactly as before.
   Fingerprint the other anims' frames before and after the change to prove that.
   Tune and repeat.
8. **Report:** say which motion(s) and channel(s) you used or added, the anim's frames/fps, what the
   sheet showed, and the test result. The app picks the anim up automatically (Anim menu).

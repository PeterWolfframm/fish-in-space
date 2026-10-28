---
name: fish-keys
description: Hand-key fish3 animation frames — e.g. "/fish-keys mola swim frame 3 fin looks stuck" or "the piranha sprint tail clips on frame 5". Lays per-frame pose overrides over the modelled swim for one body, hybrid or every fish, without touching the physics, then renders a before/after sheet and tests.
argument-hint: <body|hybrid|*> <anim> [frame(s)] [what looks wrong]
---

# Hand-key fish3 frames

`$ARGUMENTS` = `<body | hybrid | *> <anim> [frames] [what is wrong / what it should do]`.

fish3 swims by a model (`src/v3/fish/kinematics.js`): the gait (the body's wave, amplitude
envelope, and fins) comes from the body, and the motions in `src/v3/fish/motions.js` drive the pose
channels over phase. When the model gets one frame of one body wrong, **don't bend the physics
for every fish. Key the frame.** Keys live in `src/v3/fish/keys.js`:

```js
export const KEYS = {
  mola:   { swim:  { 3: { fin: 1 }, 7: { fin: -1 } } },   // one body
  chompball: { eat: { 2: { mouth: 1 } } },               // a hybrid (its id wins over its body)
  '*':    { turn:  { 6: { bend: 0 } } },                  // every fish
};
```

`keyed(pose, body, anim, i)` runs after the motions. `'*'` applies first and then the body's
own keys, and each value **replaces** the channel. Frames are 0-based. A fish's key target is
its hybrid id if it has one, otherwise its body id (`poseOf` in `src/v3/fish/index.js`).

## Hard rules

- Never edit `src/gen/**` (frozen v1) or `src/pixel/**` (vendored).
- Keep loops closed. Frame `frames` is frame 0 again. If you key frame 0, the loop seam
  changes, so check that the last frame still flows into it. Keep neighbouring frames
  continuous: when you key frame k, check k−1 and k+1, and key them too (with halfway values)
  if the jump shows.
- Change only the frames you need to. Prefer one channel per fix.
- Prefer keys over code: a key fixes one body, while a change in the motions moves every
  fish. Reach for a motion or gait change only if the same fix would be keyed on many bodies.

## Channels (`CHANNELS.fish3` in `src/v2/anim/rig.js`, rest values in brackets)

| channel | meaning |
|---|---|
| `wave` [0] | phase of the body wave, in cycles. Holding it freezes the undulation |
| `amp` [1] | wave amplitude multiplier. 0 means rigid, and above 1.3 gets wild |
| `coast` [0] | 0..1, the glide fraction. It damps the wave toward a straight body |
| `fin` [0] | pectoral beat, from −1 to 1 (below −0.5 the fin is tucked) |
| `ripple` [0] | dorsal/anal ripple phase in turns, for ribbon swimmers like knifefish and triggerfish |
| `pelvic` [0] | pelvic/belly fin flutter, −1..1 |
| `mouth` [0] | 0 is shut and 1 is wide open (shows the teeth on piranha jaws) |
| `gill` [0] | gill-cover flare, 0..1 |
| `lid` [0] | 0 is open and 1 is shut (blink) |
| `glance` [0] | eye look, from −1 (back) to 1 (forward) |
| `turn` [0] | turn round, 0..1 is a full turn (0.25 is head-on and thinnest, 0.5 faces left) |
| `bend` [0] | C-bend of the body, −1..1 (a turn) |
| `bob` [0] | vertical offset in px |
| `lean` [0] | nose up (+) or down (−), −1..1 |
| `glow` [0.5] | photophore and lure brightness, 0..1 |
| `sheen` [0] | position of the highlight sweep, 0..1 |
| `stage` [−1] | life stage override. −1 is the genome's own, 0..3 is fry → elder |

Anims (`ANIMS` in `index.js`): `swim` 8, `sprint` 8, `glide` 12, `idle` 12, `turn` 12, `eat` 8,
and `grow` 4 (a one-shot).

## Steps

1. **Find a fish that shows it.** Use the user's code, or force the body:
   ```sh
   node cli/forge.mjs fish3 --count 3 --seed key --set body=<body> --anim <anim> \
     --contact --scale 6 --out $SCRATCH/keys-before
   ```
   Try every look the problem might be in (`--set swim=raised|side|cartoon`) and a couple of
   sizes (`--set size=small` and `--set size=giant`). Keys apply to all of them.
2. **Read the poses** to see what the model produced on the bad frames:
   ```sh
   node -e "import('./src/v3/fish/index.js').then(async m=>{const {poseAt}=await import('./src/v2/anim/rig.js');
     const g=m.default.fromSeed('key-0');const a=m.ANIMS.find(x=>x.id==='<anim>');
     for(let i=0;i<a.frames;i++)console.log(i,JSON.stringify(poseAt('fish3',a,i,g)))})"
   ```
3. **Key it** in `KEYS`, with the smallest set of channels and frames that fixes it. Add a short
   comment on why (`// mola fins never pass vertical`).
4. **Look again.** Render the same command into `keys-after` and `Read` both PNGs. Check the keyed
   frame and its neighbours, and the seam from the last frame back to frame 0.
5. **Test:** run `npm test`. `test/fish3.test.mjs` checks that loops close, that frames move,
   and that nothing paints the window edge for every body × anim. A key can grow the window,
   and that is fine; `windowOf` re-measures it.
6. **Report:** list the keys added (body, anim, frames, channels), what the before/after sheets
   showed, and the test result.

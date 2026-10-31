// `f4` is frozen. Two different promises, so two fixtures:
//
//   fish4-codes.json   a stored code paints the same pixels, for ever. This is the promise the
//                      format makes to a save file, and it is why fields and choices may only be
//                      APPENDED. It is never refreshed: a failure here is a bug, not a decision.
//   fish4-golden.json  a seed under a preset rolls the same fish. The roll is allowed to move
//                      (a niche gains a diet lean, a region gains a thermal shift), so this one
//                      is refreshed on purpose:
//                        UPDATE_GOLDENS=1 node --test test/fish4-golden.test.mjs
//                      Say in the commit which fish changed and why, and if fish are already
//                      stored under the current roll, land the change as a new `algo` version
//                      instead (see `isEcotype` in params.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import gen4, { fish4Traits as T, fromSeed, frame, PRESETS } from '../src/v4/fish/index.js';

const FIXTURE = new URL('./fixtures/fish4-golden.json', import.meta.url);
/** Never refreshed: every code fish4 has ever written must keep painting these pixels. */
const CODES = new URL('./fixtures/fish4-codes.json', import.meta.url);
/** Every preset ships with the generator; a new one is appended here on purpose. */
const SETS = ['classic', 'ecotype', 'vivid', 'wild', 'curated', 'seedfall', 'water', 'frontier'];
const SEEDS = Array.from({ length: 16 }, (_, i) => `f4-gold-${i}`);

const print = (img) =>
  createHash('sha1')
    .update(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength))
    .update(img.palette.map((c) => c.join(',')).join(';'))
    .update(`${img.w}x${img.h}`)
    .digest('hex')
    .slice(0, 16);

/** `swim` is the fish as you meet it; `dead` is the far end of the pose pipeline. */
const ANIMS = ['swim', 'dead'];

function sweep() {
  const out = {};
  for (const preset of SETS) {
    for (const seed of SEEDS) {
      const set = fromSeed(seed, preset);
      const row = { code: T.encode(set) };
      for (const a of ANIMS) row[a] = print(frame(set, a, 0));
      out[`${preset}|${seed}`] = row;
    }
  }
  return out;
}

test('fish4 golden: every preset rolls the same codes and paints the same pixels', () => {
  const now = sweep();
  if (process.env.UPDATE_GOLDENS || !existsSync(FIXTURE)) writeFileSync(FIXTURE, `${JSON.stringify(now, null, 0)}\n`);
  const golden = JSON.parse(readFileSync(FIXTURE, 'utf8'));

  const missing = Object.keys(golden).filter((k) => !now[k]);
  assert.deepEqual(missing, [], 'a golden case disappeared: a preset or seed was removed');

  const codes = Object.keys(golden).filter((k) => now[k].code !== golden[k].code);
  assert.deepEqual(codes.slice(0, 5), [], `${codes.length} codes changed: stored fish would decode as other fish`);

  const pixels = Object.keys(golden).flatMap((k) => ANIMS.filter((a) => now[k][a] !== golden[k][a]).map((a) => `${k}|${a}`));
  assert.deepEqual(pixels.slice(0, 5), [], `${pixels.length} frames changed: stored fish would look different`);
});

test('fish4 frozen codes: a stored code still opens as the fish it was', () => {
  const frozen = JSON.parse(readFileSync(CODES, 'utf8'));
  assert.ok(Object.keys(frozen).length > 50, 'the frozen code set went missing');
  for (const [code, want] of Object.entries(frozen)) {
    const set = T.normalize(T.decode(code));
    // Fields may be appended: a stored code re-encodes as itself plus the new fields' defaults.
    const re = T.encode(set);
    const tail = T.encode(T.defaults()).slice(code.length);
    assert.equal(re, code + tail, `${code} does not round-trip`);
    for (const a of ANIMS) assert.equal(print(gen4.frame(set, a, 0)), want[a], `${code} paints a different ${a} than it used to`);
  }
});

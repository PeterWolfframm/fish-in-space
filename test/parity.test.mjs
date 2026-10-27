// The ports draw exactly what the games draw: fingerprints against goldens rendered once from
// the original code (scripts/make-goldens.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fingerprint, PILOT_CASES, pilotKey, AVATAR_SEEDS, FISH_SEEDS } from './golden-cases.mjs';
import { pilotSpec, pilotFrame } from '../src/gen/pilot-pixel.js';
import pilot, { pilotFromSeed } from '../src/gen/pilot.js';
import { avatarFromSeed, encodeAvatar } from '../src/gen/pilot-avatar/avatar-spec.js';
import { pixelTraits } from '../src/gen/pilot-avatar/avatar-pixel.js';
import { fishTraits, fishFromSeed, breed, drawFishFrames } from '../src/gen/fish.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

test('pilot portraits match Burn-Through', () => {
  const { images } = fixture('pilot');
  let bad = 0;
  for (const c of PILOT_CASES) if (fingerprint(pilotFrame(pilotSpec(c.seed, c), c.expr, c.frame)) !== images[pilotKey(c)]) bad++;
  assert.equal(bad, 0, `${bad}/${PILOT_CASES.length} portraits differ`);
});

test('pilot genome round-trips through the trait system without changing the face', () => {
  const { images } = fixture('pilot');
  for (const c of PILOT_CASES.filter((c) => c.frame === 1 && c.figure !== 'boss')) {
    const g = pilotFromSeed(c.seed, c);
    const back = { ...pilot.traits.decode(pilot.traits.encode(g)), seed: c.seed };
    assert.equal(fingerprint(pilot.frame(back, c.expr, c.frame)), images[pilotKey(c)], pilotKey(c));
  }
});

test('avatar codes dress the crew exactly like the crew room', () => {
  const { avatars } = fixture('pilot');
  for (const seed of AVATAR_SEEDS) {
    const spec = avatarFromSeed(seed);
    assert.equal(encodeAvatar(spec), avatars[seed].code);
    assert.equal(fingerprint(pilotFrame({ ...pilotSpec(seed), ...pixelTraits(spec) }, 'idle', 0)), avatars[seed].image, seed);
    const g = pilotFromSeed(seed, { avatar: avatars[seed].code });
    assert.equal(fingerprint(pilot.frame(g, 'idle', 0)), avatars[seed].image, `${seed} via genome`);
  }
});

test('fish match fish.', () => {
  const golden = fixture('fish');
  for (const seed of FISH_SEEDS) {
    const g = fishFromSeed(seed);
    assert.equal(fishTraits.encode(g), golden[seed].code, `${seed} code`);
    assert.equal(fishTraits.encode(breed(g, fishFromSeed(`${seed}b`), `${seed}:egg`)), golden[seed].bred, `${seed} bred`);
    assert.deepEqual(drawFishFrames(g).map(fingerprint), golden[seed].frames, `${seed} frames`);
  }
});

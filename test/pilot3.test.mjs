// Pilots v3 (people): every choice of every field paints, a v1 crew code reopens as the same
// face in a flight suit and helmet, and the roll's little sense holds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import gen, { pilot3Traits as T, fromV1Code } from '../src/v3/pilot/index.js';
import { pilotTraits, pilotFromSeed } from '../src/gen/pilot.js';
import { fingerprint } from './golden-cases.mjs';

const drawn = (img) => img.data.reduce((n, v) => n + (v ? 1 : 0), 0);

test('pilot3 is a v3 pilot generator', () => {
  assert.equal(gen.version, 3);
  assert.equal(gen.family, 'pilot');
  assert.ok(T.decode(T.encode(gen.fromSeed('x'))));
});

test('every choice of every field paints, in every anim', () => {
  for (const f of T.fields) {
    for (const c of f.choices) {
      const g = T.normalize({ ...gen.fromSeed(`${f.id}-${c.id}`), [f.id]: c.id });
      for (const a of gen.anims) {
        for (let i = 0; i < a.frames; i++) {
          const img = gen.frame(g, a.id, i);
          assert.equal(img.w, 32);
          assert.ok(drawn(img) > 200, `${f.id}=${c.id} ${a.id}[${i}]`);
        }
      }
    }
  }
});

test('same code, same portrait; anims move', () => {
  for (let i = 0; i < 20; i++) {
    const g = gen.fromSeed(`p-${i}`);
    const back = gen.fromCode(T.encode(g));
    assert.equal(fingerprint(gen.frame(back, 'talk', 1)), fingerprint(gen.frame(g, 'talk', 1)));
    assert.notEqual(fingerprint(gen.frame(g, 'talk', 0)), fingerprint(gen.frame(g, 'talk', 1)));
  }
});

test('a v1 crew code opens as a helmeted pilot', () => {
  for (let i = 0; i < 10; i++) {
    const v1 = pilotFromSeed(`MAGIC ${i}`);
    const p = fromV1Code(pilotTraits.encode(v1));
    assert.ok(p);
    assert.equal(p.outfit, 'flightsuit');
    assert.equal(p.headwear, 'helmet');
    assert.equal(p.facialHair, v1.mustache === 'yes' ? 'mustache' : 'none');
  }
});

test('kids never have facial hair; most elders are grey', () => {
  let elders = 0;
  let grey = 0;
  for (let i = 0; i < 400; i++) {
    const g = gen.fromSeed(`age-${i}`);
    if (g.age === 'kid') assert.equal(g.facialHair, 'none');
    if (g.age === 'elder') {
      elders++;
      if (['958f88', '828282', 'e7e5e0', 'e6d9b8'].includes(g.hairColor)) grey++;
    }
  }
  assert.ok(grey / elders > 0.5, `${grey}/${elders}`);
});

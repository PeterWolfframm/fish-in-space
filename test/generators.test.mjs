// Every generator keeps the contract the app and CLI rely on, and the new plants keep their
// promises: same code → same sprite, a sway that loops, growth that only ever adds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, generator, breedWith, fromCode } from '../src/gen/registry.js';
import { fingerprint } from './golden-cases.mjs';
import { drawWaterplant, SWAY_FRAMES, waterplantTraits } from '../src/gen/waterplant.js';
import { drawPlant, plantStages, plantTraits, STAGE_T } from '../src/gen/plant.js';

const SEEDS = Array.from({ length: 40 }, (_, i) => `t-${i}`);
const drawn = (img) => img.data.reduce((n, v) => n + (v ? 1 : 0), 0);

test('every generator draws every anim at its declared size, from seed and from code', () => {
  for (const gen of GENERATORS) {
    for (const seed of SEEDS.slice(0, 8)) {
      const g = gen.fromSeed(seed);
      const back = fromCode(gen, gen.traits.encode(g));
      assert.ok(back, `${gen.id} code decodes`);
      assert.equal(gen.traits.encode(back), gen.traits.encode(g), `${gen.id} code round-trips`);
      for (const anim of gen.anims) {
        for (let i = 0; i < anim.frames; i++) {
          const img = gen.frame(g, anim.id, i);
          assert.equal(img.w, gen.size.w, `${gen.id} width`);
          assert.equal(img.h, gen.size.h, `${gen.id} height`);
          assert.ok(drawn(img) > 0, `${gen.id} ${anim.id}[${i}] draws something`);
        }
      }
    }
  }
});

test('breeding gives a valid genome for every generator', () => {
  for (const gen of GENERATORS) {
    const child = breedWith(gen, gen.fromSeed('a'), gen.fromSeed('b'), 'egg');
    assert.ok(gen.traits.isCode(gen.traits.encode(child)), gen.id);
    assert.ok(drawn(gen.frame(child, gen.anims[0].id, 0)) > 0, gen.id);
  }
});

test('tank plants: a code is the sprite, and every form sways in a closed loop', () => {
  for (const seed of SEEDS) {
    const g = waterplantTraits.fromSeed(seed);
    const again = waterplantTraits.decode(waterplantTraits.encode(g));
    assert.equal(fingerprint(drawWaterplant(again, 3)), fingerprint(drawWaterplant(g, 3)), seed);
    assert.equal(fingerprint(drawWaterplant(g, SWAY_FRAMES)), fingerprint(drawWaterplant(g, 0)), `${seed} loops`);
  }
  for (const form of waterplantTraits.fieldById('form').choices.map((c) => c.id)) {
    const g = { ...waterplantTraits.fromSeed(form), form };
    const frames = Array.from({ length: SWAY_FRAMES }, (_, i) => fingerprint(drawWaterplant(g, i)));
    assert.ok(new Set(frames).size > 1, `${form} moves`);
  }
});

test('garden plants only grow: no part ever disappears as t rises', () => {
  for (const seed of SEEDS) {
    const g = plantTraits.fromSeed(seed);
    let prev = -1;
    for (let t = 0.15; t <= 1.0001; t += 0.05) {
      const n = drawn(drawPlant(g, t));
      assert.ok(n >= prev - 1, `${seed} shrank at t=${t.toFixed(2)} (${prev} → ${n})`);
      prev = n;
    }
  }
});

test('garden plant stages are the plant at STAGE_T, the last one fully grown', () => {
  for (const seed of SEEDS.slice(0, 10)) {
    const g = plantTraits.fromSeed(seed);
    const stages = plantStages(g);
    assert.equal(stages.length, 4);
    stages.forEach((img, i) => assert.equal(fingerprint(img), fingerprint(drawPlant(g, STAGE_T[i]))));
    assert.equal(fingerprint(stages[3]), fingerprint(generator('plant').at(g, 1)));
    assert.ok(drawn(stages[3]) > drawn(stages[0]), `${seed} grows`);
  }
});

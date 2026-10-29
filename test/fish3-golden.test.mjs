// fish3 draws exactly what it drew before fish4 started threading options through its painter
// (phenotype `ext`, paintFish options, detail scaling): every body at sizes and seeds across every
// fish3 anim, fingerprinted. fish4's import path is held to the same prints. Refresh the fixture
// only on purpose: UPDATE_GOLDENS=1 node --test test/fish3-golden.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { generator, fromCode } from '../src/gen/registry.js';
import { fish3Traits as T3, NEW_BODIES, HYBRID_IDS } from '../src/v3/fish/genome.js';

const gen3 = generator('fish3');
const gen4 = generator('fish4');
const FIXTURE = new URL('./fixtures/fish3-golden.json', import.meta.url);
const SIZES = ['tiny', 'small', 'medium', 'large', 'huge', 'giant'];

const print = (img) => createHash('sha1').update(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength)).update(img.palette.map((c) => c.join(',')).join(';')).update(`${img.w}x${img.h}`).digest('hex').slice(0, 16);

/** The cases: every body at two sizes, hybrids, and plain seeds; frame 0 and a middle frame. */
function cases() {
  const out = [];
  const bodies = T3.fieldById('body').choices.map((c) => c.id);
  bodies.forEach((body, i) => {
    for (const size of [SIZES[i % 6], SIZES[(i + 3) % 6]]) out.push([`${body}/${size}`, T3.normalize({ ...gen3.fromSeed(`gold-${body}`), body, size, hybrid: 'none' })]);
  });
  HYBRID_IDS.forEach((h, i) => out.push([`hybrid:${h}`, T3.normalize({ ...gen3.fromSeed(`gold-h${i}`), hybrid: h })]));
  for (let i = 0; i < 24; i++) out.push([`seed:${i}`, gen3.fromSeed(`gold-seed-${i}`)]);
  assert.ok(NEW_BODIES.length > 0);
  return out;
}

function render(frameOf) {
  const prints = {};
  for (const [id, set] of cases()) {
    for (const a of gen3.anims) {
      for (const i of new Set([0, Math.floor(a.frames / 2)])) prints[`${id}|${a.id}|${i}`] = print(frameOf(set, a.id, i));
    }
  }
  return prints;
}

test('fish3 draws exactly what it always drew', () => {
  const now = render((set, a, i) => gen3.frame(set, a, i));
  if (process.env.UPDATE_GOLDENS || !existsSync(FIXTURE)) writeFileSync(FIXTURE, `${JSON.stringify(now, null, 0)}\n`);
  const golden = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const bad = Object.keys(golden).filter((k) => now[k] !== golden[k]);
  assert.equal(Object.keys(now).length, Object.keys(golden).length, 'same cases');
  assert.equal(bad.length, 0, `${bad.length} frames differ, e.g. ${bad.slice(0, 3).join(', ')}`);
});

test('fish4 draws imported fish3 codes with the same prints', () => {
  const golden = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const now = render((set, a, i) => gen4.frame(fromCode(gen4, T3.encode(set)), a, i));
  const bad = Object.keys(golden).filter((k) => now[k] !== golden[k]);
  assert.equal(bad.length, 0, `${bad.length} frames differ, e.g. ${bad.slice(0, 3).join(', ')}`);
});

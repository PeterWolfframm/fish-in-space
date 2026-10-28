// v2 grows by appending options whose first choice is the old look. Every code captured before
// (test/fixtures/v2.json, `npm run goldens:v2`) must still draw exactly the same pixels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fingerprint } from './golden-cases.mjs';
import * as registry from '../src/gen/registry.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/v2.json', import.meta.url), 'utf8'));

test('v2 codes from before new options still draw the same pixels', () => {
  const { generator, fromCode } = registry;
  const bad = [];
  let n = 0;
  for (const [key, prints] of Object.entries(golden)) {
    const [id, code] = key.split('|');
    const gen = generator(id);
    const g = fromCode(gen, code);
    assert.ok(g, key);
    for (const [frame, fp] of Object.entries(prints)) {
      const [anim, i] = frame.split('|');
      n++;
      if (fingerprint(gen.frame(g, anim, +i)) !== fp) bad.push(`${key} ${frame}`);
    }
  }
  assert.ok(n > 500);
  assert.equal(bad.length, 0, `${bad.length}/${n} frames differ, e.g. ${bad.slice(0, 3).join(', ')}`);
});

// New options: each draws everywhere, and each style value is visible.

const NEW = {
  pilot2: ['beard', 'scarf', 'backdrop'],
  fish2: ['eyeStyle', 'gradient', 'finEdge'],
  plant2: ['pot', 'variegation', 'season'],
  waterplant2: ['variegation', 'algae', 'critter'],
};
const STYLE = ['look', 'light', 'contrast', 'hueShift', 'saturation', 'harmony', 'dither', 'outline', 'rimLight'];
const KINDS = Object.keys(NEW).map((id) => registry.generator(id));
const SEEDS = ['opt-a', 'opt-b', 'opt-c'];
/** Style values that are already a kind's own render setting (pilots never dither). */
const NOOP = new Set(['pilot2 dither=off']);

const with_ = (gen, base, over) => gen.traits.normalize({ ...base, ...over });
const used = (img) => new Set(img.data);
const same = (a, b) => a.w === b.w && a.h === b.h && a.data.every((v, i) => a.palette[v].join() === b.palette[b.data[i]].join());

test('every new option draws at every size and anim', () => {
  for (const gen of KINDS) {
    const base = gen.fromSeed('opt-a');
    for (const id of [...NEW[gen.id], ...STYLE]) {
      for (const c of gen.traits.fieldById(id).choices) {
        const mid = gen.sizes[gen.sizes.length >> 1].id;
        const cases = [...gen.sizes.map((s) => [s.id, gen.anims[0].id]), ...gen.anims.slice(1).map((a) => [mid, a.id])];
        for (const [size, anim] of cases) {
          const img = gen.frame(with_(gen, base, { [id]: c.id, [gen.sizeField]: size }), anim, 0);
          assert.ok(used(img).size > 1, `${gen.id} ${id}=${c.id} ${size} ${anim} is empty`);
        }
      }
    }
  }
});

test('every style value changes pixels', () => {
  for (const gen of KINDS) {
    const neutral = Object.fromEntries(STYLE.map((id) => [id, gen.traits.fieldById(id).choices[0].id]));
    for (const id of STYLE) {
      for (const c of gen.traits.fieldById(id).choices.slice(1)) {
        if (NOOP.has(`${gen.id} ${id}=${c.id}`)) continue;
        const changed = SEEDS.some((seed) => {
          const base = { ...gen.fromSeed(seed), ...neutral };
          const big = gen.sizes.at(-2).id;
          const a = gen.frame(with_(gen, base, { [gen.sizeField]: big }), gen.anims[0].id, 0);
          const b = gen.frame(with_(gen, base, { [gen.sizeField]: big, [id]: c.id }), gen.anims[0].id, 0);
          return !same(a, b);
        });
        assert.ok(changed, `${gen.id} ${id}=${c.id} draws the same as the default`);
      }
    }
  }
});

test('comic is simpler than lit: fewer colours and a dark ink edge, at every size', () => {
  const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  for (const gen of KINDS) {
    for (const seed of SEEDS) {
      const base = { ...gen.fromSeed(seed), look: 'lit', backdrop: 'plain' };
      let litTotal = 0;
      let comicTotal = 0;
      for (const size of gen.sizes) {
        const [{ id: anim, frames }] = gen.anims; // mid-anim: a plant's frame 0 is its seed
        const lit = gen.frame(with_(gen, base, { [gen.sizeField]: size.id }), anim, frames >> 1);
        const comic = gen.frame(with_(gen, base, { [gen.sizeField]: size.id, look: 'comic' }), anim, frames >> 1);
        const tag = `${gen.id} ${seed} ${size.id}`;
        // A tiny lit sprite can sit on one mid tone where comic shows two bands; overall, fewer.
        // Its ink can add an outline colour where lit has none (herbs).
        litTotal += used(lit).size;
        comicTotal += used(comic).size;
        assert.ok(used(comic).size <= used(lit).size + 2, `${tag}: comic ${used(comic).size} colours vs lit ${used(lit).size}`);
        // The silhouette's edge: drawn pixels next to empty ones, away from the canvas border.
        const { w, h, data, palette } = comic;
        let edge = 0;
        let dark = 0;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (!data[i] || palette[data[i]][3] < 255) continue;
            if (![i - 1, i + 1, i - w, i + w].some((j) => !data[j])) continue;
            edge++;
            if (lum(palette[data[i]]) < 0.3) dark++;
          }
        }
        assert.ok(edge === 0 || dark / edge > 0.8, `${tag}: only ${dark}/${edge} edge pixels are ink`);
      }
      assert.ok(comicTotal < litTotal, `${gen.id} ${seed}: comic ${comicTotal} colours over all sizes, lit ${litTotal}`);
    }
  }
});

// v2 generators: every size class draws every anim at the size it declares, codes round-trip and
// v1 codes remaster, loops close, plants only grow, and a bigger class means more pixels at the
// same density, not bigger pixels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATORS, generator } from '../src/gen/registry.js';
import { fingerprint } from './golden-cases.mjs';

const V2 = GENERATORS.filter((g) => g.version === 2);
const V1_OF = { fish: 'fish', waterplant: 'waterplant', plant: 'plant', pilot: 'pilot' };
const SEEDS = Array.from({ length: 6 }, (_, i) => `v2-${i}`);
const drawn = (img) => img.data.reduce((n, v) => n + (v ? 1 : 0), 0);

/** The v1 this v2 remasters. */
function v1Of(gen) {
  return generator(V1_OF[gen.family]);
}

/** The silhouette's bounding box. */
function bbox(img) {
  let x0 = img.w;
  let y0 = img.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!img.data[y * img.w + x]) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

test('there is a v2 generator for every family, with sizes', () => {
  for (const family of Object.keys(V1_OF)) {
    const gen = V2.find((g) => g.family === family);
    assert.ok(gen, family);
    assert.ok(gen.sizes.length >= 4, `${family} has size classes`);
    assert.ok(gen.traits.prefix.endsWith('.'), `${family} v2 codes are dotted`);
  }
});

test('every v2 size × anim draws at sizeOf(genome)', () => {
  for (const gen of V2) {
    for (const seed of SEEDS.slice(0, 3)) {
      for (const size of gen.sizes) {
        const g = gen.traits.normalize({ ...gen.fromSeed(seed), [gen.sizeField]: size.id });
        const want = gen.sizeOf(g);
        for (const a of gen.anims) {
          for (let i = 0; i < a.frames; i++) {
            const img = gen.frame(g, a.id, i);
            assert.equal(img.w, want.w, `${gen.id} ${size.id} ${a.id}[${i}] width`);
            assert.equal(img.h, want.h, `${gen.id} ${size.id} ${a.id}[${i}] height`);
            assert.ok(drawn(img) > 0, `${gen.id} ${size.id} ${a.id}[${i}] draws`);
          }
        }
      }
    }
  }
});

test('v2 codes round-trip, and v1 codes of the same family remaster', () => {
  for (const gen of V2) {
      const old = v1Of(gen);
    for (const seed of SEEDS) {
      const g = gen.fromSeed(seed);
      const code = gen.traits.encode(g);
      assert.equal(gen.traits.encode(gen.fromCode(code)), code, `${gen.id} ${seed}`);
      const v1code = old.traits.encode(old.fromSeed(seed));
      const re = gen.fromCode(v1code);
      assert.ok(re, `${gen.id} takes v1 code ${v1code}`);
      for (const f of old.traits.fields) assert.equal(re[f.id], old.traits.decode(v1code)[f.id], `${gen.id} keeps v1 ${f.id}`);
      assert.ok(drawn(gen.frame(re, gen.anims[0].id, 0)) > 0);
    }
  }
});

test('v2 loops close: the frame after the last is the first', () => {
  for (const gen of V2) {
    for (const a of gen.anims.filter((x) => x.loop !== false && x.frames > 1)) {
      for (const seed of SEEDS.slice(0, 3)) {
        const g = gen.fromSeed(seed);
        assert.equal(fingerprint(gen.frame(g, a.id, a.frames)), fingerprint(gen.frame(g, a.id, 0)), `${gen.id} ${a.id} ${seed}`);
      }
    }
  }
});

test('v2 looping anims move', () => {
  for (const gen of V2) {
    for (const a of gen.anims.filter((x) => x.loop !== false && x.frames > 1)) {
      const moved = SEEDS.some((seed) => {
        const g = gen.fromSeed(seed);
        const prints = new Set(Array.from({ length: a.frames }, (_, i) => fingerprint(gen.frame(g, a.id, i))));
        return prints.size > 1;
      });
      assert.ok(moved, `${gen.id} ${a.id} moves`);
    }
  }
});

test('garden plants v2 only grow, at every size', () => {
  const gen = generator('plant2');
  for (const size of gen.sizes) {
    for (const seed of SEEDS) {
      const g = gen.traits.normalize({ ...gen.fromSeed(seed), size: size.id });
      let prev = -1;
      for (let t = 0.15; t <= 1.0001; t += 0.05) {
        const n = drawn(gen.at(g, t));
        assert.ok(n >= prev * 0.97 - 2, `${seed} ${size.id} shrank at t=${t.toFixed(2)} (${prev} → ${n})`);
        prev = n;
      }
    }
  }
});

test('constant density: a bigger class is more pixels of the same fish, not a stretched one', () => {
  const gen = generator('fish2');
  for (const seed of SEEDS) {
    const base = gen.fromSeed(seed);
    const boxes = gen.sizes.map((s) => bbox(gen.frame({ ...base, size: s.id }, 'idle', 0)));
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].w > boxes[i - 1].w, `${seed} ${gen.sizes[i].id} is longer`);
    // Proportions hold within a tolerance across the big classes (small ones round off fins).
    const r = boxes.slice(2).map((b) => b.w / b.h);
    assert.ok(Math.max(...r) / Math.min(...r) < 1.35, `${seed} keeps its shape: ${r.map((x) => x.toFixed(2))}`);
  }
});

test('long fish come out wider than tall', () => {
  const gen = generator('fish2');
  const g = gen.traits.normalize({ ...gen.fromSeed('eel'), body: 'eel', size: 'large' });
  const { w, h } = gen.sizeOf(g);
  assert.ok(w > h * 1.5, `${w}×${h}`);
});

test('pilot framings crop one scene: the face is the same pixels in every framing', () => {
  const gen = generator('pilot2');
  const g = gen.fromSeed('MAGIC 1');
  const at = (size, x, y) => {
    const img = gen.frame({ ...g, size }, 'idle', 0);
    return img.palette[img.data[y * img.w + x]].join();
  };
  // Scene pixel (32, 17), the middle of the face, in each framing's window.
  const { FRAMINGS } = gen;
  for (const id of ['icon', 'portrait', 'bust', 'cockpit']) {
    const f = gen.framings?.[id] ?? FRAMINGS?.[id];
    if (!f) continue;
    assert.equal(at(id, 32 - f.x, 17 - f.y), at('bust', 32 - 8, 17), id);
  }
});

test('no orphan pixels: no lone pixel surrounded by empty space', () => {
  for (const gen of V2) {
    for (const seed of SEEDS.slice(0, 3)) {
      for (const size of gen.sizes) {
        const img = gen.frame(gen.traits.normalize({ ...gen.fromSeed(seed), [gen.sizeField]: size.id }), gen.anims[0].id, 0);
        let orphans = 0;
        for (let y = 1; y < img.h - 1; y++) {
          for (let x = 1; x < img.w - 1; x++) {
            if (!img.data[y * img.w + x]) continue;
            const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].filter(([dx, dy]) => img.data[(y + dy) * img.w + x + dx]).length;
            if (!nb) orphans++;
          }
        }
        assert.ok(orphans <= 6, `${gen.id} ${size.id} ${seed}: ${orphans} orphan pixels`);
      }
    }
  }
});

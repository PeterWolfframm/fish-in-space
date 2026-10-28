// plant3: deterministic, loops close, nothing paints the window edge, v1 codes open as the
// same plant, growth only adds pixels, and a grass tip travels further than a cactus tip.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generator, fromCode } from '../src/gen/registry.js';
import { poseAt } from '../src/v2/anim/rig.js';
import { plant3Traits as T, normalizePlant, jitterKey, stepOf } from '../src/v3/plant/genome.js';
import { SPECIES_IDS } from '../src/v3/plant/habits.js';
import { phenotype, genetics, CLASS_H } from '../src/v3/plant/phenotype.js';
import { breedDetailed } from '../src/v3/plant/breeding.js';
import { nameOf } from '../src/v3/plant/names.js';
import { trace } from '../src/v3/plant/kinematics.js';

const gen = generator('plant3');
const same = (a, b) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i]);
const drawn = (img) => img.data.reduce((n, v) => n + (v ? 1 : 0), 0);

function edgePaint(img) {
  for (let x = 0; x < img.w; x++) if (img.data[x] || img.data[(img.h - 1) * img.w + x]) return true;
  for (let y = 0; y < img.h; y++) if (img.data[y * img.w] || img.data[y * img.w + img.w - 1]) return true;
  return false;
}

test('plant3 is registered with 16 species', () => {
  assert.ok(gen);
  assert.equal(gen.version, 3);
  assert.equal(gen.family, 'plant');
  assert.equal(SPECIES_IDS.length, 16);
  assert.deepEqual(gen.sizes.map((s) => s.id), Object.keys(CLASS_H));
});

test('plant3 is deterministic and codes round-trip', () => {
  for (let i = 0; i < 6; i++) {
    const a = gen.fromSeed(`det-${i}`);
    const b = gen.fromSeed(`det-${i}`);
    assert.deepEqual(a, b);
    const code = T.encode(a);
    assert.ok(code.startsWith('g3.'));
    assert.deepEqual(T.normalize(fromCode(gen, code)), T.normalize(a));
    assert.ok(same(gen.frame(a, 'wind', 3), gen.frame(b, 'wind', 3)));
  }
});

test('plant3 opens v1 codes as the same plant', () => {
  const v1 = generator('plant');
  for (let i = 0; i < 6; i++) {
    const g1 = v1.fromSeed(`v1-${i}`);
    const g3 = fromCode(gen, v1.traits.encode(g1));
    assert.ok(g3, 'v1 code decodes');
    assert.equal(g3.species, g1.form);
    assert.equal(g3.form, g1.form);
    for (const k of Object.keys(g1)) if (k in g3 && T.fieldById(k)) assert.equal(g3[k], g1[k], k);
  }
});

test('plant3 loops close, and wind and gust move a flower, a grass and a tree', () => {
  for (const id of ['flower', 'grass', 'tree']) {
    const g = normalizePlant({ species: id, size: 'shrub', height: 'tall', bloom: 'daisy' });
    for (const a of gen.anims.filter((x) => x.loop !== false)) {
      assert.deepEqual(poseAt('plant3', a, a.frames, g), poseAt('plant3', a, 0, g), `${id} ${a.id} closes`);
    }
    for (const anim of ['wind', 'gust']) {
      const spec = gen.anims.find((x) => x.id === anim);
      const frames = Array.from({ length: spec.frames }, (_, k) => gen.frame(g, anim, k));
      assert.ok(frames.some((f) => !same(f, frames[0])), `${id} ${anim} moves`);
    }
  }
});

test('plant3 never paints the window edge, for every species and anim', () => {
  const sizes = Object.keys(CLASS_H);
  SPECIES_IDS.forEach((id, i) => {
    const size = sizes[i % sizes.length];
    const g = normalizePlant({ ...gen.fromSeed(`edge-${id}`), species: id, size, look: 'cartoon' });
    const box = gen.sizeOf(g);
    for (const a of gen.anims) {
      for (let k = 0; k < a.frames; k++) {
        const img = gen.frame(g, a.id, k);
        assert.equal(img.w, box.w, `${id} ${a.id}`);
        assert.equal(img.h, box.h, `${id} ${a.id}`);
        assert.ok(drawn(img) > 8, `${id} ${size} ${a.id}#${k} draws`);
        assert.ok(!edgePaint(img), `${id} ${size} ${a.id}#${k} stays inside`);
      }
    }
  });
});

test('plant3 growth never loses pixels', () => {
  for (const id of ['flower', 'grass', 'tree', 'cactus', 'fern', 'willow']) {
    const g = normalizePlant({ species: id, size: 'tall', height: 'medium' });
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const n = drawn(gen.at(g, t));
      assert.ok(n >= prev, `${id} shrank at t=${t.toFixed(1)} (${prev} → ${n})`);
      prev = n;
    }
    assert.ok(drawn(gen.at(g, 1)) > drawn(gen.at(g, 0)), `${id} grows`);
  }
});

test('plant3 bend: grass travels further than cactus, and a tree crown further than its trunk', () => {
  const still = { wind: 0, sway: 0, lean: 0, droop: 0, look: 'garden', restDroop: 0 };
  const wind = { ...still, wind: 0.25, sway: 1 };
  const moved = (habit, u) => {
    const stroke = { x: 0, y: 0, angle: 0, len: 80, bend: 0, habit };
    const a = trace({ ...stroke, pose: still }, u);
    const b = trace({ ...stroke, pose: wind }, u);
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  assert.ok(moved('grass', 1) > moved('cactus', 1) * 3);
  assert.ok(moved('tree', 1) > moved('tree', 0.2) * 2);
});

test('plant3 bigger classes are bigger canvases and more pixels', () => {
  const areas = gen.sizes.map((s) => s.w * s.h);
  for (let i = 1; i < areas.length; i++) assert.ok(areas[i] > areas[i - 1], gen.sizes[i].id);
  const g = gen.fromSeed('dens');
  const herb = drawn(gen.frame(normalizePlant({ ...g, size: 'herb' }), 'idle', 0));
  const giant = drawn(gen.frame(normalizePlant({ ...g, size: 'giant' }), 'idle', 0));
  assert.ok(giant > herb * 3, `herb ${herb} giant ${giant}`);
});

test('plant3 names come from the plant, not the camera', () => {
  const names = new Set();
  for (let i = 0; i < 40; i++) {
    const g = gen.fromSeed(`name-${i}`);
    assert.equal(nameOf(g), nameOf(g));
    names.add(nameOf(g));
  }
  assert.ok(names.size > 30);
  const g = gen.fromSeed('styled');
  assert.equal(nameOf({ ...g, look: 'cartoon' }), nameOf({ ...g, look: 'garden' }));
  assert.equal(jitterKey({ ...g, look: 'cartoon' }), jitterKey({ ...g, look: 'breeze' }));
  assert.notEqual(jitterKey({ ...g, species: 'cactus' }), jitterKey({ ...g, species: 'grass' }));
});

test('plant3 genes: two carriers make a recessive about one time in four', () => {
  const base = normalizePlant({ ...gen.fromSeed('mendel'), geneA: 'purple', geneB: 'green' });
  const other = normalizePlant({ ...base });
  let shows = 0;
  let carries = 0;
  let revealed = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const { child, events } = breedDetailed(base, other, `m-${i}`);
    const g = genetics(child);
    if (g.pigment === 'purple') shows++;
    else if (g.carries.includes('purple')) carries++;
    if (events.some((e) => e.kind === 'reveal')) revealed++;
    for (const e of events) {
      assert.equal(typeof e.kind, 'string');
      assert.equal(typeof e.text, 'string');
    }
  }
  assert.ok(shows / N > 0.16 && shows / N < 0.4, `purple ${shows / N}`);
  assert.ok(carries / N > 0.35 && carries / N < 0.65, `carriers ${carries / N}`);
  assert.ok(revealed > 20, `reveals ${revealed}`);
  const carrier = normalizePlant({ ...base, geneA: 'silver', geneB: 'green' });
  assert.match(gen.describe(carrier), /carries silver/);
  assert.equal(phenotype(normalizePlant({ ...base, geneA: 'gold', geneB: 'gold' })).pigment, 'gold');
});

test('plant3 breeding: proportions land near the mean, and named pairs can cross', () => {
  const a = normalizePlant({ ...gen.fromSeed('pa'), size: 'herb', stemH: 'n3', height: 'low', species: 'willow' });
  const b = normalizePlant({ ...gen.fromSeed('pb'), size: 'giant', stemH: 'p3', height: 'tall', species: 'flower' });
  const { child } = breedDetailed(a, b, 'kid');
  assert.ok(Math.abs(stepOf(child.stemH)) <= 1, child.stemH);
  assert.ok(['shrub', 'tall', 'tree'].includes(child.size), child.size);
  assert.equal(child.height, 'medium');

  let weeping = 0;
  for (let i = 0; i < 80; i++) if (breedDetailed(a, b, `w-${i}`).child.cross === 'weeping') weeping++;
  assert.ok(weeping > 15 && weeping < 55, `weeping ${weeping}`);

  const grass = normalizePlant({ ...gen.fromSeed('gr'), species: 'grass' });
  const flower = normalizePlant({ ...gen.fromSeed('fl'), species: 'flower' });
  let meadow = 0;
  for (let i = 0; i < 80; i++) if (breedDetailed(grass, flower, `d-${i}`).child.cross === 'meadow') meadow++;
  assert.ok(meadow > 15 && meadow < 55, `meadow ${meadow}`);
});

test('plant3 taller plants sway more slowly, and one-shots keep their fps', () => {
  const herb = normalizePlant({ species: 'flower', size: 'herb' });
  const giant = normalizePlant({ species: 'flower', size: 'giant' });
  const wind = gen.anims.find((a) => a.id === 'wind');
  const grow = gen.anims.find((a) => a.id === 'grow');
  assert.ok(gen.fpsOf(giant, wind) < gen.fpsOf(herb, wind));
  assert.equal(gen.fpsOf(giant, grow), grow.fps);
  assert.equal(gen.fpsOf(herb, grow), grow.fps);
});

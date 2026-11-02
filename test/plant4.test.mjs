// plant4: one engine for farm, wild and water plants. Every form draws at every size and never
// touches the window edge, codes round-trip, the roll keeps realm → region → form consistent,
// breeding keeps the kind, growth only adds, and a batch reads as one place.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generator, fromCode } from '../src/gen/registry.js';
import { poseAt } from '../src/v2/anim/rig.js';
import { plant4Traits as T, normalizePlant, FARM_FORMS, WILD_FORMS, WATER_FORMS, REALM_OF, SIZE_IDS } from '../src/v4/plant/genome.js';
import { FORMS } from '../src/v4/plant/forms.js';
import { REGIONS } from '../src/v4/plant/data/places.js';
import { validateParams, PRESETS, resolveParams } from '../src/v4/plant/params.js';

const gen = generator('plant4');
const same = (a, b) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i]);
const drawn = (img) => img.data.reduce((n, v) => n + (v ? 1 : 0), 0);
const ALL = [...FARM_FORMS, ...WILD_FORMS, ...WATER_FORMS];

function edgePaint(img) {
  for (let x = 0; x < img.w; x++) if (img.data[x]) return true;
  for (let y = 0; y < img.h; y++) if (img.data[y * img.w] || img.data[y * img.w + img.w - 1]) return true;
  return false;
}

test('plant4 is registered with 50 forms in three realms, none shared', () => {
  assert.ok(gen);
  assert.equal(gen.version, 4);
  assert.equal(gen.family, 'plant');
  assert.equal(ALL.length, 50);
  assert.equal(new Set(ALL).size, ALL.length);
  for (const id of ALL) assert.ok(FORMS[id], `${id} has a form`);
  for (const f of T.fields) assert.ok(f.choices.length <= 36, `${f.id} fits one code digit`);
  assert.deepEqual(gen.sizes.map((s) => s.id), SIZE_IDS);
});

test('plant4 is deterministic and codes round-trip', () => {
  for (let i = 0; i < 12; i++) {
    const a = gen.fromSeed(`det-${i}`);
    assert.deepEqual(gen.fromSeed(`det-${i}`), a);
    const code = T.encode(a);
    assert.ok(code.startsWith('p4.'));
    assert.deepEqual(fromCode(gen, code), normalizePlant(a));
    assert.ok(same(gen.frame(a, 'wind', 3), gen.frame(fromCode(gen, code), 'wind', 3)));
  }
});

test('plant4 rolls keep realm, region and form consistent', () => {
  for (let i = 0; i < 200; i++) {
    const g = gen.fromSeed(`roll-${i}`);
    assert.equal(REALM_OF[g.form], g.realm, `${g.form} in ${g.realm}`);
    assert.equal(REGIONS[g.region].realm, g.realm, `${g.region} in ${g.realm}`);
  }
  const water = gen.fromSeed('pin', null, { realm: 'water' });
  assert.equal(water.realm, 'water');
  const oak = gen.fromSeed('pin', null, { form: 'oak' });
  assert.equal(oak.form, 'oak');
});

test('plant4 draws every form at every size, inside its window', () => {
  ALL.forEach((form, i) => {
    for (const size of SIZE_IDS) {
      const g = normalizePlant({ ...gen.fromSeed(`edge-${form}`, null, { form }), size });
      const box = gen.sizeOf(g);
      const anims = i % 5 === 0 ? gen.anims : gen.anims.filter((a) => ['idle', 'gust', 'grow'].includes(a.id));
      for (const a of anims) {
        for (let k = 0; k < a.frames; k += 3) {
          const img = gen.frame(g, a.id, k);
          assert.equal(img.w, box.w, `${form} ${size} ${a.id} width`);
          assert.equal(img.h, box.h, `${form} ${size} ${a.id} height`);
          if (a.id !== 'grow' || k > 0) assert.ok(drawn(img) > 0, `${form} ${size} ${a.id}[${k}] draws`);
          assert.ok(!edgePaint(img), `${form} ${size} ${a.id}[${k}] touches the edge`);
        }
      }
    }
  });
});

test('plant4 loops close, and wind moves a crop, a tree and a water plant', () => {
  for (const form of ['wheat', 'oak', 'kelp']) {
    const g = normalizePlant({ form, size: 'tall' });
    for (const a of gen.anims.filter((x) => x.loop !== false)) {
      assert.deepEqual(poseAt('plant4', a, a.frames, g), poseAt('plant4', a, 0, g), `${form} ${a.id} closes`);
    }
    const spec = gen.anims.find((x) => x.id === 'wind');
    const frames = Array.from({ length: spec.frames }, (_, k) => gen.frame(g, 'wind', k));
    assert.ok(frames.some((f) => !same(f, frames[0])), `${form} wind moves`);
  }
});

test('plant4 growth only adds, and the grown plant is the at(1) plant', () => {
  for (const form of ['tomato', 'oak', 'sunflower', 'kelp', 'carrot']) {
    const g = normalizePlant({ form, size: 'shrub' });
    let prev = 0;
    for (let t = 0.1; t <= 1.0001; t += 0.1) {
      const n = drawn(gen.at(g, t));
      assert.ok(n >= prev * 0.97 - 2, `${form} shrank at t=${t.toFixed(1)} (${prev} → ${n})`);
      prev = n;
    }
    assert.ok(drawn(gen.at(g, 1)) > drawn(gen.at(g, 0.2)), `${form} grows`);
  }
});

test('plant4 seasons: a deciduous tree goes bare in winter, an evergreen keeps its needles', () => {
  const oak = normalizePlant({ form: 'oak', size: 'tree' });
  const spruce = normalizePlant({ form: 'spruce', size: 'tree' });
  const summer = (g) => drawn(gen.frame(g, 'seasons', 1));
  const winter = (g) => drawn(gen.frame(g, 'seasons', 3));
  assert.ok(winter(oak) < summer(oak) * 0.7, 'oak drops its leaves');
  assert.ok(winter(spruce) > summer(spruce) * 0.7, 'spruce keeps its needles');
});

test('plant4 breeding keeps the kind: the child is one parent\'s form, whole', () => {
  for (let i = 0; i < 20; i++) {
    const a = gen.fromSeed(`ma-${i}`);
    const b = gen.fromSeed(`pa-${i}`);
    const { child, name } = gen.breedDetailed(a, b, `egg-${i}`);
    assert.ok([a.form, b.form].includes(child.form), `${child.form} from ${a.form} × ${b.form}`);
    assert.equal(REALM_OF[child.form], child.realm);
    assert.ok(T.isCode(T.encode(child)));
    assert.ok(name.includes(FORMS[child.form].label));
  }
});

test('plant4 batch is one realm, its forms come from their regions, and counts add up', () => {
  for (const n of [1, 7, 24]) {
    const b = gen.batch(`batch-${n}`, n);
    assert.equal(b.plants.length, n);
    for (const p of b.plants) {
      assert.equal(p.set.realm, b.place.realm);
      assert.ok(b.place.regions.includes(p.set.region));
      assert.equal(p.set.form, p.species);
    }
  }
  const water = gen.batch('aq', 12, 'aquarium');
  assert.equal(water.place.realm, 'water');
});

test('plant4 params: every preset validates, bad values are refused', () => {
  for (const id of Object.keys(PRESETS)) assert.ok(validateParams(resolveParams(id)).ok, id);
  assert.equal(validateParams({ ...resolveParams('ecotype'), rare: -1 }).ok, false);
});

test('plant4 farm stats and names read like a seed catalogue', () => {
  for (let i = 0; i < 20; i++) {
    const g = gen.fromSeed(`farm-${i}`);
    const s = gen.stats(g);
    assert.ok(s.days > 0, `${g.form} has a grow time`);
    if (s.kind === 'crop') assert.ok(s.sell > 0, `${g.form} sells`);
    assert.ok(gen.rarity(g) >= 0 && gen.rarity(g) <= 1);
    assert.match(gen.name(g), /'[A-Z][a-z]+'$/);
  }
});

// fish3: deterministic, loops close, nothing paints off the canvas edge for any body, size or
// anim, v1 codes open as the same fish, names are stable, and breeding follows its rules (two
// carriers make a recessive about a quarter of the time, mules don't pass genes, lines purify).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generator, fromCode } from '../src/gen/registry.js';
import { poseAt } from '../src/v2/anim/rig.js';
import { fish3Traits as T, NEW_BODIES } from '../src/v3/fish/genome.js';
import { BODIES, HYBRIDS } from '../src/v3/fish/bodies.js';
import { phenotype, genetics, CLASS_LEN } from '../src/v3/fish/phenotype.js';
import { breedDetailed } from '../src/v3/fish/breeding.js';
import { nameOf } from '../src/v3/fish/names.js';
import { bioOf } from '../src/v3/fish/bio.js';

const gen = generator('fish3');
const same = (a, b) => a.w === b.w && a.h === b.h && a.data.every((v, i) => v === b.data[i]);
const drawn = (img) => img.data.reduce((n, v) => n + (v ? 1 : 0), 0);

function edgePaint(img) {
  for (let x = 0; x < img.w; x++) if (img.data[x] || img.data[(img.h - 1) * img.w + x]) return true;
  for (let y = 0; y < img.h; y++) if (img.data[y * img.w] || img.data[y * img.w + img.w - 1]) return true;
  return false;
}

test('fish3 is registered with every body', () => {
  assert.ok(gen);
  assert.equal(gen.version, 3);
  assert.equal(Object.keys(BODIES).length, 8 + NEW_BODIES.length);
  for (const [id] of NEW_BODIES) assert.ok(BODIES[id], id);
  for (const h of Object.values(HYBRIDS)) assert.ok(BODIES[h.a] && BODIES[h.b], `${h.a} × ${h.b}`);
});

test('fish3 is deterministic and codes round-trip', () => {
  for (let i = 0; i < 6; i++) {
    const a = gen.fromSeed(`det-${i}`);
    const b = gen.fromSeed(`det-${i}`);
    assert.deepEqual(a, b);
    const code = T.encode(a);
    assert.ok(code.startsWith('f3.'));
    assert.deepEqual(T.normalize(fromCode(gen, code)), T.normalize(a));
    assert.ok(same(gen.frame(a, 'swim', 3), gen.frame(b, 'swim', 3)));
  }
});

test('fish3 opens v1 codes as the same fish', () => {
  const v1 = generator('fish');
  for (let i = 0; i < 4; i++) {
    const g1 = v1.fromSeed(`v1-${i}`);
    const g3 = fromCode(gen, v1.traits.encode(g1));
    assert.ok(g3, 'v1 code decodes');
    for (const k of Object.keys(g1)) if (k in g3 && T.fieldById(k)) assert.equal(g3[k], g1[k], k);
  }
});

test('fish3 loops close and move', () => {
  for (let i = 0; i < 3; i++) {
    const g = gen.fromSeed(`loop-${i}`);
    for (const a of gen.anims.filter((x) => x.loop !== false)) {
      assert.deepEqual(poseAt('fish3', a, a.frames, g), poseAt('fish3', a, 0, g), `${a.id} closes`);
      const frames = Array.from({ length: a.frames }, (_, k) => gen.frame(g, a.id, k));
      assert.ok(frames.some((f) => !same(f, frames[0])), `${a.id} moves`);
    }
  }
});

test('fish3 never paints the window edge, for any body × size × anim', () => {
  const bodies = Object.keys(BODIES);
  const sizes = Object.keys(CLASS_LEN);
  bodies.forEach((body, bi) => {
    const size = sizes[bi % sizes.length];
    const g = T.normalize({ ...gen.fromSeed(`edge-${body}`), body, size });
    const box = gen.sizeOf(g);
    for (const a of gen.anims) {
      for (let k = 0; k < a.frames; k++) {
        const img = gen.frame(g, a.id, k);
        assert.equal(img.w, box.w);
        assert.equal(img.h, box.h);
        assert.ok(drawn(img) > 10, `${body} ${size} ${a.id}#${k} draws`);
        assert.ok(!edgePaint(img), `${body} ${size} ${a.id}#${k} stays inside`);
      }
    }
  });
});

test('fish3 hybrids and morphs draw at every size', () => {
  const morphs = ['galaxy', 'neon', 'chrome', 'ombre', 'split'];
  const genes = ['albino', 'leucistic', 'melanistic', 'axanthic', 'ghost', 'koi', 'xanthic', 'bubble', 'longfin'];
  Object.keys(CLASS_LEN).forEach((size, si) => {
    for (const [hi, hybrid] of Object.keys(HYBRIDS).entries()) {
      if (hi % 6 !== si) continue;
      const g = T.normalize({ ...gen.fromSeed(`hyb-${hybrid}`), body: HYBRIDS[hybrid].a, hybrid, size, rarity: 'rare' });
      assert.ok(drawn(gen.frame(g, 'swim', 0)) > 10, hybrid);
    }
    const morph = morphs[si % morphs.length];
    const gene = genes[si];
    const g = T.normalize({ ...gen.fromSeed(`morph-${size}`), size, rarity: 'rare', morph, geneA: gene, geneB: gene });
    assert.equal(phenotype(g).morph, morph);
    assert.ok(!edgePaint(gen.frame(g, 'idle', 0)));
  });
});

test('fish3 bigger classes are bigger canvases at the same density', () => {
  const areas = gen.sizes.map((s) => s.w * s.h);
  for (let i = 1; i < areas.length; i++) assert.ok(areas[i] > areas[i - 1], gen.sizes[i].id);
  const g = gen.fromSeed('dens');
  const small = drawn(gen.frame(T.normalize({ ...g, size: 'small' }), 'swim', 0));
  const huge = drawn(gen.frame(T.normalize({ ...g, size: 'huge' }), 'swim', 0));
  assert.ok(huge > small * 3);
});

test('fish3 names are stable, varied and styled', () => {
  const names = new Set();
  for (let i = 0; i < 60; i++) {
    const g = gen.fromSeed(`name-${i}`);
    assert.equal(nameOf(g), nameOf(g));
    names.add(nameOf(g));
  }
  assert.ok(names.size > 50);
  const g = gen.fromSeed('styled');
  assert.match(nameOf(g, 'repo'), /^[a-z0-9]+(-[a-z0-9]+)+$/);
  assert.match(nameOf(g, 'guide'), /^[A-Z]/);
  // Looks-only changes keep the name: the camera is not the fish.
  assert.equal(nameOf({ ...g, swim: 'cartoon' }), nameOf({ ...g, swim: 'side' }));
});

test('fish3 bios are stable, varied and not the camera', () => {
  const bios = new Set();
  for (let i = 0; i < 60; i++) {
    const g = gen.fromSeed(`bio-${i}`);
    assert.equal(bioOf(g), bioOf(g));
    const bio = bioOf(g);
    assert.ok(bio.length > 0);
    assert.ok(bio.split('\n').length >= 2);
    bios.add(bio);
  }
  assert.ok(bios.size > 50);
  const g = gen.fromSeed('bio-styled');
  assert.equal(bioOf({ ...g, swim: 'cartoon' }), bioOf({ ...g, swim: 'side' }));
});

test('fish3 genes: two carriers make a recessive about one time in four', () => {
  const base = { ...gen.fromSeed('mendel'), rarity: 'common', morph: 'auto', geneA: 'albino', geneB: 'wild', chaos: 'stable' };
  const a = T.normalize({ ...base, lineA: 'l1', lineB: 'l2' });
  const b = T.normalize({ ...base, lineA: 'l3', lineB: 'l4', sex: 'm' });
  let shows = 0;
  let carries = 0;
  const N = 800;
  for (let i = 0; i < N; i++) {
    const { child } = breedDetailed(a, b, `m-${i}`);
    const g = genetics(child);
    if (g.morph === 'albino') shows++;
    else if (g.carries.includes('albino')) carries++;
  }
  assert.ok(shows / N > 0.18 && shows / N < 0.32, `albino ${shows / N}`);
  assert.ok(carries / N > 0.4 && carries / N < 0.6, `carriers ${carries / N}`);
});

test('fish3 breeding: polygenic sizes, lines, generations, mules', () => {
  const a = T.normalize({ ...gen.fromSeed('pa'), size: 'tiny', length: 'n3', lineA: 'l5', lineB: 'l6', purity: 'p4', generation: 'g3' });
  const b = T.normalize({ ...gen.fromSeed('pb'), size: 'huge', length: 'p3', lineA: 'l5', lineB: 'l6', purity: 'p2', generation: 'g7' });
  const { child, events } = breedDetailed(a, b, 'kid');
  assert.equal(child.generation, 'g8');
  assert.equal(child.stage, 'fry');
  assert.equal(child.purity, 'p5');
  assert.ok(events.some((e) => e.kind === 'line'));
  // A true-breeding line lands on the mean.
  assert.equal(child.length, '0');
  assert.ok(['medium', 'small', 'large'].includes(child.size), child.size);

  const mule = T.normalize({ ...gen.fromSeed('mule'), body: 'mola', hybrid: 'moonblob', rarity: 'rare' });
  const r = breedDetailed(mule, a, 'mule-kid');
  assert.ok(r.events.some((e) => e.kind === 'sterile'));
  assert.equal(r.child.hybrid, 'none');
});

test('fish3 breeding: the right bodies sometimes make a hybrid', () => {
  const a = T.normalize({ ...gen.fromSeed('h1'), body: 'piranha', chaos: 'chaotic', lineA: 'l1' });
  const b = T.normalize({ ...gen.fromSeed('h2'), body: 'pufferish', chaos: 'chaotic', lineA: 'l2' });
  let hybrids = 0;
  for (let i = 0; i < 300; i++) if (breedDetailed(a, b, `h-${i}`).child.hybrid === 'chompball') hybrids++;
  assert.ok(hybrids > 10 && hybrids < 80, `hybrids ${hybrids}`);
});

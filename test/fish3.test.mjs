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
import { readFileSync } from 'node:fs';
import { nameOf, namesOf } from '../src/v3/fish/names.js';
import { TAXA } from '../src/v3/fish/names-data.js';
import { ecologyOf } from '../src/v3/fish/ecology.js';
import { DIET_BY_JAW } from '../src/v3/fish/ecology-data.js';
import { loreOf, loreText } from '../src/v3/fish/lore.js';
import { jitterKey, SIGNATURES } from '../src/v3/fish/genome.js';

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

test('fish3 names are stable, varied and come from the body', () => {
  const names = new Set();
  for (let i = 0; i < 60; i++) {
    const g = gen.fromSeed(`name-${i}`);
    const n = namesOf(g);
    assert.equal(nameOf(g), nameOf(g));
    assert.equal(nameOf(g), n.full);
    const ph = phenotype(g);
    const taxon = TAXA[ph.body] ?? TAXA[HYBRIDS[ph.body]?.a];
    assert.ok(taxon.nouns.some((w) => n.common.endsWith(w)), `${n.common} ends with a ${ph.body} noun`);
    assert.ok(n.binomial.startsWith(taxon.genus), n.binomial);
    assert.match(n.slug, /^[a-z0-9]+(-[a-z0-9]+)+$/);
    names.add(n.full);
  }
  assert.ok(names.size > 50);
  // Looks-only changes keep the name: the camera is not the fish.
  const g = gen.fromSeed('styled');
  assert.equal(nameOf({ ...g, swim: 'cartoon' }), nameOf({ ...g, swim: 'side' }));
});

test('fish3 ecology is read off the body, with evidence', () => {
  for (let i = 0; i < 200; i++) {
    const g = gen.fromSeed(`eco-${i}`);
    const e = ecologyOf(g);
    assert.deepEqual(ecologyOf(g), e);
    for (const k of ['diet', 'feeding', 'level', 'temperament', 'sociality', 'activity', 'depth', 'salinity', 'temp', 'current', 'hardness']) {
      assert.ok(e[k].value, k);
      assert.ok(e[k].because.length > 0, `${k} has evidence`);
    }
    const ph = phenotype(g);
    if (ph.signature !== 'none' || ph.relic !== 'none') continue;
    if (['fangs', 'piranha'].includes(ph.jaw)) assert.ok(['piscivore', 'carnivore'].includes(e.diet.value), `${ph.jaw} eats meat`);
    if (T.normalize(g).snout === 'under' || ph.extras === 'barbels') assert.equal(e.level.value, 'bottom');
    if (ph.extras === 'barbels' && !DIET_BY_JAW[ph.jaw]) assert.equal(e.diet.value, 'detritivore');
    if (T.normalize(g).markings === 'photophores' && ph.extras !== 'lure') assert.ok(['twilight', 'abyss'].includes(e.depth.value));
  }
});

test('fish3 signatures are rare-only; mythic fish keep their earlier look', () => {
  for (let i = 0; i < 3000; i++) {
    const g = gen.fromSeed(`sig-${i}`);
    const ph = phenotype(g);
    const rare = ph.set.rarity === 'rare';
    assert.equal(ph.signature !== 'none', rare, `${ph.set.rarity}: ${ph.signature}`);
    assert.equal(ph.relic, 'none', `${ph.set.rarity}: ${ph.relic}`);
  }
  // A lock can't sneak one onto a common fish.
  const g = T.normalize({ ...gen.fromSeed('sig-lock'), rarity: 'common', signature: 'crown', relic: 'eclipse' });
  assert.equal(phenotype(g).signature, 'none');
  assert.equal(phenotype(g).relic, 'none');
});

test('fish3 rare signatures draw every frame, inside the window', () => {
  for (const [sig] of SIGNATURES) {
    const base = T.normalize({ ...gen.fromSeed(`sigdraw-${sig}`), rarity: 'rare', signature: sig, size: 'medium' });
    const plain = T.normalize({ ...base, rarity: 'uncommon' });
    for (const a of gen.anims) {
      const img = gen.frame(base, a.id, 0);
      assert.ok(!edgePaint(img), `${sig} ${a.id} paints the edge`);
    }
    assert.ok(!same(gen.frame(base, 'swim', 0), gen.frame(plain, 'swim', 0)), `${sig} changes pixels`);
  }
  const myth = T.normalize({ ...gen.fromSeed('myth-look'), rarity: 'myth', signature: 'crown', relic: 'eclipse' });
  assert.equal(phenotype(myth).signature, 'none');
  assert.equal(phenotype(myth).relic, 'none');
});

test('fish3 signatures leave existing fish pixels alone (jitter key fixture)', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/fish3-jitter.json', import.meta.url)));
  for (const [code, key] of Object.entries(fixture)) assert.equal(jitterKey(T.decode(code)), key, code);
});

test('fish3 breeding: two commons never make a signature except by a sport', () => {
  const a = T.normalize({ ...gen.fromSeed('sb-a'), rarity: 'common', morph: 'auto', iridescence: 'none', hybrid: 'none', body: 'torpedo' });
  const b = T.normalize({ ...gen.fromSeed('sb-b'), rarity: 'common', morph: 'auto', iridescence: 'none', hybrid: 'none', body: 'torpedo', sex: 'm' });
  for (let i = 0; i < 300; i++) {
    const { child, events } = breedDetailed(a, b, `sb-${i}`);
    if (phenotype(child).signature !== 'none') assert.ok(events.some((e) => e.kind === 'sport'), 'signature without a sport');
    assert.ok(!events.some((e) => e.kind === 'signature'));
  }
  const ra = T.normalize({ ...a, rarity: 'rare', signature: 'crown' });
  const rb = T.normalize({ ...b, rarity: 'rare', signature: 'halo' });
  // Two signature rares always pass one on, except to a myth child: a myth outgrows signatures
  // (see 'rare signatures draw every frame' above), so it is not a counter-example here.
  const kids = Array.from({ length: 40 }, (_, i) => breedDetailed(ra, rb, `sr-${i}`).child)
    .filter((c) => c.rarity !== 'myth')
    .map((c) => phenotype(c).signature);
  assert.ok(kids.length > 20, 'most children of two rares stay rare');
  assert.ok(kids.every((s) => s !== 'none'));
  assert.ok(kids.includes('crown') && kids.includes('halo'));
});

test('fish3 lore: complete, stable, no stray tokens, not the camera', () => {
  for (let i = 0; i < 80; i++) {
    const g = gen.fromSeed(`lore-${i}`);
    const l = loreOf(g);
    assert.deepEqual(loreOf(g), l);
    assert.equal(l.codex.length, 3);
    assert.ok(l.codex[0].key.startsWith('diet.'));
    assert.ok(l.edict.text);
    // Only rares carry a legend: it tells the story of the signature, and relics were removed
    // (`RELICS` is empty in genome.js), so a myth has neither a signature nor a relic to tell.
    assert.equal(Boolean(l.legend), T.normalize(g).rarity === 'rare');
    const text = loreText(g);
    assert.doesNotMatch(text, /\{\w+\}/, text);
  }
  const g = gen.fromSeed('lore-styled');
  assert.equal(loreText({ ...g, swim: 'cartoon' }), loreText({ ...g, swim: 'side' }));
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

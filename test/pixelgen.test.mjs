// pixelgen: features, the network, swipes → rows, and the procgen hooks, on synthetic taste.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generator } from '../src/gen/registry.js';
import { featurize, aesthetics, layout, schema, AESTHETIC, still } from '../src/pixelgen/features.js';
import { Net, train } from '../src/pixelgen/net.js';
import { toRows, fit, evaluate, newNet } from '../src/pixelgen/dataset.js';
import { beautify, qualityFloor, score, blend, insights } from '../src/pixelgen/beautify.js';
import { STYLE_IDS } from '../src/v2/kit/style.js';

const KINDS = ['fish2', 'pilot2', 'plant2', 'waterplant2'].map(generator);
const SD = AESTHETIC.indexOf('lumSd');

/** A mixed-kind sample of sprites and their feature vectors. */
const sample = (n, tag = 's') =>
  Array.from({ length: n }, (_, i) => {
    const gen = KINDS[i % KINDS.length];
    const genome = gen.fromSeed(`${tag}-${i}`);
    return { gen, genome, code: gen.traits.encode(genome), x: featurize(gen, genome) };
  });

test('features: deterministic, laid out in blocks, kind slots one-hot', () => {
  const gen = generator('fish2');
  const g = gen.fromSeed('feat');
  const a = featurize(gen, g);
  const b = featurize(gen, g);
  const L = layout();
  assert.equal(a.length, L.dim);
  assert.deepEqual(Array.from(a), Array.from(b));
  for (let i = 0; i < AESTHETIC.length; i++) assert.ok(a[i] >= 0 && a[i] <= 1, `${AESTHETIC[i]} = ${a[i]}`);
  const styleOnes = a.slice(L.style[0], L.style[0] + L.style[1]).reduce((s, v) => s + v, 0);
  assert.equal(styleOnes, STYLE_IDS.length);
  const kindOnes = a.slice(L.kindAt, L.kindAt + Object.keys(L.kinds).length);
  assert.equal(kindOnes.reduce((s, v) => s + v, 0), 1);
  // A v1 kind has no style block.
  const v1 = generator('fish');
  const c = featurize(v1, v1.fromSeed('feat'));
  assert.equal(c.slice(L.style[0], L.style[0] + L.style[1]).reduce((s, v) => s + v, 0), 0);
  assert.match(schema(), /^[0-9a-z]+$/);
});

test('aesthetics see what changed: comic has fewer colours, punchy more contrast', () => {
  const gen = generator('fish2');
  const base = { ...gen.fromSeed('aes'), size: 'large', look: 'lit', contrast: 'normal' };
  const f = (over) => aesthetics(still(gen, gen.traits.normalize({ ...base, ...over })), gen.bg);
  const C = AESTHETIC.indexOf('colors');
  assert.ok(f({ look: 'comic' })[C] < f({})[C]);
  assert.ok(f({ contrast: 'punchy' })[SD] > f({ contrast: 'soft' })[SD]);
});

test('the net learns an image aesthetic across mixed kinds (held out > 90%)', () => {
  // Taste with a margin: the middle fifth by contrast is left out, as nobody judges on a knife edge.
  const items = sample(240, 'learn');
  const sds = items.map((s) => s.x[SD]).sort((a, b) => a - b);
  const [lo, hi] = [sds[96], sds[144]];
  const rows = items.filter((s) => s.x[SD] <= lo || s.x[SD] >= hi).map((s) => ({ x: s.x, y: s.x[SD] >= hi ? 1 : 0 }));
  const { accuracy } = evaluate(rows, (r) => fit(r, { epochs: 40 }), { k: 4 });
  assert.ok(accuracy > 0.9, `held-out accuracy ${accuracy}`);
});

test('the fix head learns which field notes flag', () => {
  const items = sample(80, 'fix');
  const L = layout();
  const target = L.fix.indexOf('contrast');
  const rows = items.map((s) => {
    const flag = s.genome.contrast === 'soft' ? 1 : 0;
    const fix = new Float32Array(L.fix.length);
    fix[target] = flag;
    return { x: s.x, y: 1 - flag, fix, fixMask: new Float32Array(L.fix.length).fill(1) };
  });
  const net = newNet();
  train(net, rows, { epochs: 80 });
  const soft = rows.filter((r) => r.fix[target]);
  const other = rows.filter((r) => !r.fix[target]);
  assert.ok(soft.length > 3 && other.length > 3);
  const mean = (rs) => rs.reduce((s, r) => s + net.predict(r.x).fix[target], 0) / rs.length;
  assert.ok(mean(soft) > 0.6 && mean(other) < 0.4, `soft ${mean(soft)} other ${mean(other)}`);
});

test('JSON round-trip predicts the same', () => {
  const net = new Net({ dim: 12, fix: 3, seed: 'rt' });
  train(net, [{ x: Float32Array.from({ length: 12 }, (_, i) => i / 12), y: 1 }], { epochs: 3 });
  const back = Net.fromJSON(JSON.parse(JSON.stringify(net.toJSON())));
  const x = Float32Array.from({ length: 12 }, (_, i) => (i % 3) / 2);
  assert.ok(Math.abs(back.predict(x).beauty - net.predict(x).beauty) < 1e-4);
});

test('swipes → rows: labels, counterfactuals at half weight, 1/√n user weighting', () => {
  const gen = generator('fish2');
  const code = (s) => gen.traits.encode(gen.fromSeed(s));
  const swipes = [
    { user: 'a', kind: 'fish2', code: code('r1'), verdict: 'approve' },
    { user: 'a', kind: 'fish2', code: code('r2'), verdict: 'pass', fix: ['contrast'], instead: { contrast: 'punchy' } },
    { user: 'a', kind: 'fish2', code: code('r3'), verdict: 'pass' },
    { user: 'a', kind: 'fish2', code: code('r4'), verdict: 'pass' },
    { user: 'b', kind: 'pilot2', code: generator('pilot2').traits.encode(generator('pilot2').fromSeed('p')), verdict: 'approve' },
    { user: 'b', kind: 'nope', code: 'x', verdict: 'approve' },
  ];
  const rows = toRows(swipes, { scope: 'public' });
  assert.equal(rows.length, 6); // 5 real + 1 counterfactual, the unknown kind skipped
  const cf = rows.find((r) => r.counterfactual);
  assert.equal(cf.y, 1);
  assert.equal(cf.w, 0.5 * (1 / 2));
  assert.equal(rows.find((r) => r.user === 'b').w, 1 / Math.sqrt(2));
  assert.equal(rows.filter((r) => r.user === 'a' && !r.counterfactual)[0].w, 1 / 2);
  const flagged = rows.find((r) => r.fix);
  assert.equal(flagged.fix[layout().fix.indexOf('contrast')], 1);
  const personal = toRows(swipes, { scope: 'personal' });
  assert.ok(personal.filter((r) => !r.counterfactual).every((r) => r.w === 1));
});

/** A model that likes punchy contrast and bold outlines, trained on synthetic swipes. */
function tasteModel() {
  const items = sample(160, 'taste');
  const swipes = items.map((s, i) => ({
    user: `u${i % 5}`,
    kind: s.gen.id,
    code: s.code,
    verdict: s.genome.contrast === 'punchy' || s.genome.outline === 'bold' ? 'approve' : 'pass',
  }));
  return fit(toRows(swipes), { epochs: 50 });
}

test('beautify keeps content, changes only style, and raises the score', () => {
  const model = tasteModel();
  for (const gen of KINDS) {
    const g = gen.fromSeed('beauty');
    const { genome, beauty, before } = beautify(gen, { ...g, contrast: 'soft', outline: 'none' }, model, { rounds: 1 });
    for (const f of gen.traits.fields) if (!STYLE_IDS.includes(f.id)) assert.equal(genome[f.id], g[f.id], `${gen.id}.${f.id} changed`);
    assert.ok(beauty >= before, `${gen.id}: ${before} → ${beauty}`);
    assert.ok(genome.contrast === 'punchy' || genome.outline === 'bold', `${gen.id}: ${genome.contrast}/${genome.outline}`);
  }
  // A forced look stays put.
  const gen = KINDS[0];
  assert.equal(beautify(gen, gen.fromSeed('x'), model, { fixed: { look: 'comic' }, rounds: 1 }).genome.look, 'comic');
});

test('qualityFloor raises the score but keeps content as varied as plain rolls', () => {
  const model = tasteModel();
  const gen = generator('fish2');
  const n = 60;
  const plain = Array.from({ length: n }, (_, i) => gen.fromSeed(`qf:${i}~0`));
  const good = qualityFloor(gen, model, { n, seed: 'qf', pool: 4, floor: 0.5 });
  const mean = (gs) => gs.reduce((s, g) => s + score(gen, g, model), 0) / gs.length;
  assert.ok(mean(good) > mean(plain), `${mean(plain)} → ${mean(good)}`);
  // Content diversity: the body types seen stay close in number.
  const kinds = (gs) => new Set(gs.map((g) => g.body)).size;
  assert.ok(kinds(good) >= kinds(plain) - 1, `bodies ${kinds(plain)} → ${kinds(good)}`);
});

test('blend mixes two models and insights read the taste back', () => {
  const model = tasteModel();
  const flat = { predict: () => ({ beauty: 0.5, fix: new Float64Array(layout().fix.length) }) };
  const x = featurize(KINDS[0], KINDS[0].fromSeed('b'));
  const m = blend(flat, model, 0.5).predict(x).beauty;
  assert.ok(Math.abs(m - (0.5 + model.predict(x).beauty) / 2) < 1e-9);
  const { up } = insights(model, KINDS.slice(0, 2), { probes: 2, top: 8 });
  assert.ok(up.some((e) => /Contrast: Punchy|Outline: Bold/.test(e.label)), JSON.stringify(up));
});

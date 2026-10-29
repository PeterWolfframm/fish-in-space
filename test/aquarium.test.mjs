// FISH IN SPACE! (aquarium/) world rules: requests are always fillable, matching, pricing, the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../aquarium/_v2/js/world.js';
import fish from '../src/v3/fish/index.js';

const T0 = 1_800_000_000_000;

test('a new game has a breedable pair of lake fish and money', () => {
  const s = W.newGame(T0, 'test');
  assert.equal(s.fish.length, 5);
  assert.equal(s.credits, W.START_CREDITS);
  const lake = s.fish.filter((f) => W.fitsBiome(f.code, W.BIOMES[0], 0));
  assert.ok(lake.length >= 4);
  const sexes = new Set(lake.map((f) => W.genomeOf(f.code).sex));
  assert.deepEqual([...sexes].sort(), ['f', 'm']);
  assert.ok(s.fish.every(W.isAdult));
});

test('the first request is a tutorial a starter fish can fill', () => {
  const s = W.newGame(T0, 'tut');
  const ev = W.tick(s, T0 + 5_000);
  const o = ev.find((e) => e.kind === 'order').order;
  assert.equal(o.reqs.length, 2);
  const f = s.fish.find((x) => W.meetsAll(x.code, o.reqs));
  assert.ok(f, 'some starter meets it');
  const r = W.fulfil(s, o.id, f.id, T0 + 6_000);
  assert.ok(!r.error);
  assert.equal(s.credits, W.START_CREDITS + o.reward);
  assert.equal(s.bloom, o.bloom);
});

test('every biome, in every phase, has a fish that fits it in the vault', () => {
  for (let phase = 0; phase < W.PHASES.length; phase++) {
    for (const b of W.openBiomes(phase)) {
      const code = W.rollForBiome(b, phase, `vault:${b.id}:${phase}`);
      assert.ok(W.fitsBiome(code, b, phase), `${b.id} @ phase ${phase}`);
    }
  }
});

test('eco requirements in requests are met together by a real fish', () => {
  for (let phase = 0; phase < W.PHASES.length; phase++) {
    const s = W.newGame(T0, `feas${phase}`);
    s.phase = phase;
    s.stats.orders = 1;
    for (let i = 0; i < 12; i++) {
      const o = W.makeOrder(s, T0, `ord:${phase}:${i}`);
      const eco = o.reqs.filter((q) => q.kind === 'eco');
      const sample = W.rollForBiome(W.biomeById(o.biome), phase, `ord:${phase}:${i}:sample`);
      assert.ok(W.meetsAll(sample, eco), `phase ${phase} ${JSON.stringify(eco)}`);
    }
  }
});

test('breeding needs adults of both sexes, lays an egg that hatches into a fry', () => {
  const s = W.newGame(T0, 'breed');
  const m = s.fish.find((f) => W.genomeOf(f.code).sex === 'm');
  const f = s.fish.find((x) => W.genomeOf(x.code).sex === 'f');
  const m2 = s.fish.find((x) => x !== m && W.genomeOf(x.code).sex === 'm');
  assert.match(W.breedProblem(s, m, m2, T0), /male and a female/);
  const r = W.breed(s, m.id, f.id, T0);
  assert.ok(r.egg);
  assert.match(W.breedProblem(s, m, f, T0 + 1000), /resting/);
  const ev = W.tick(s, T0 + W.EGG_HATCH + 1);
  const hatched = ev.find((e) => e.kind === 'hatched');
  assert.ok(hatched);
  assert.equal(W.stageOf(hatched.fish.code), 'fry');
  assert.equal(W.generationOf(W.genomeOf(hatched.fish.code)), 1);
  W.tick(s, T0 + W.EGG_HATCH + 1 + W.GROW.adult * 1000);
  assert.equal(W.stageOf(hatched.fish.code), 'adult');
});

test('prices are positive and follow demand', () => {
  const code = W.rollWild('price');
  for (let t = 0; t < 20; t++) assert.ok(W.priceOf(code, T0 + t * 97_000) >= 3);
  const h = W.headlines(T0);
  assert.equal(h.length, W.MARKET_TAGS.length);
  assert.ok(h[0].mult >= h.at(-1).mult);
});

test('bloom advances phases and opens biomes', () => {
  const s = W.newGame(T0, 'bloom');
  s.orders.push({ id: 'ox', biome: 'melt', colony: 'x', flavor: '', reqs: [], reward: 10, bloom: 130, expires: T0 + 1e6 });
  const r = W.fulfil(s, 'ox', s.fish[0].id, T0);
  assert.equal(s.phase, 1);
  assert.ok(r.events.some((e) => e.kind === 'phase'));
  assert.equal(W.openBiomes(s.phase).length, 2);
});

test('saves round-trip, and junk saves are refused', () => {
  const s = W.newGame(T0, 'save');
  W.tick(s, T0 + 10_000);
  const back = W.restore(JSON.stringify(s));
  assert.deepEqual(back.fish.map((f) => f.code), s.fish.map((f) => f.code));
  assert.equal(W.restore('{nope'), null);
  assert.equal(W.restore({ v: 99 }), null);
  const broken = JSON.parse(JSON.stringify(s));
  broken.fish[0].code = 'not-a-fish';
  assert.equal(W.restore(broken).fish.length, s.fish.length - 1);
});

test('vault roe thaws into a juvenile that fits its biome', () => {
  const s = W.newGame(T0, 'vault');
  const r = W.buy(s, 'roe:melt', T0);
  assert.ok(r.egg);
  assert.ok(W.fitsBiome(r.egg.code, W.BIOMES[0], 0));
  assert.equal(fish.normalize(fish.fromCode(r.egg.code)).stage, 'juvenile');
});

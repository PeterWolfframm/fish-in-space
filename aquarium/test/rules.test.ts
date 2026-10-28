// Seedfall v3 rules: ported from the v2 suite, plus regions, windows, polls and the shop.
import { describe, expect, test } from 'vitest';
import * as W from '../src/game';

const T0 = 1_800_000_000_000;

describe('v2 rules, ported', () => {
  test('a new game has a breedable pair of lake fish and money', () => {
    const s = W.newGame(T0, 'test');
    expect(s.fish.length).toBe(5);
    expect(s.credits).toBe(W.START_CREDITS);
    const lake = s.fish.filter((f) => W.fitsBiome(f.code, W.BIOMES[0], 0));
    expect(lake.length).toBeGreaterThanOrEqual(4);
    expect([...new Set(lake.map((f) => W.genomeOf(f.code).sex))].sort()).toEqual(['f', 'm']);
    expect(s.fish.every(W.isAdult)).toBe(true);
  });

  test('the first request is a tutorial a starter fish can fill', () => {
    const s = W.newGame(T0, 'tut');
    const ev = W.tick(s, T0 + 5_000);
    const o = (ev.find((e) => e.kind === 'order') as { order: W.Order }).order;
    expect(o.reqs.length).toBe(2);
    expect(W.regionById(s, o.region)?.opened).toBe(true);
    const f = s.fish.find((x) => W.meetsAll(x.code, o.reqs))!;
    expect(f).toBeTruthy();
    const r = W.fulfil(s, o.id, f.id, T0 + 6_000);
    expect(r.error).toBeUndefined();
    expect(s.credits).toBe(W.START_CREDITS + o.reward);
    expect(s.bloom).toBe(o.bloom);
  });

  test('every biome, in every phase, has a fish that fits it', () => {
    for (let phase = 0; phase < W.PHASES.length; phase++)
      for (const b of W.openBiomes(phase)) expect(W.fitsBiome(W.rollForBiome(b, phase, `vault:${b.id}:${phase}`), b, phase)).toBe(true);
  });

  test('eco requirements in requests are met together by a real fish', () => {
    for (let phase = 0; phase < W.PHASES.length; phase++) {
      const s = W.newGame(T0, `feas${phase}`);
      s.phase = phase;
      W.openRegions(s, T0);
      s.stats.orders = 1;
      for (let i = 0; i < 12; i++) {
        const o = W.makeOrder(s, T0, `ord:${phase}:${i}`);
        const eco = o.reqs.filter((q) => q.kind === 'eco');
        const sample = W.rollForBiome(W.biomeById(o.biome)!, phase, `ord:${phase}:${i}:sample`);
        expect(W.meetsAll(sample, eco), `phase ${phase} ${JSON.stringify(eco)}`).toBe(true);
        expect(W.regionById(s, o.region)!.opensAt).toBeLessThanOrEqual(phase);
      }
    }
  });

  test('breeding needs adults of both sexes, lays an egg that hatches into a fry', () => {
    const s = W.newGame(T0, 'breed');
    const m = s.fish.find((f) => W.genomeOf(f.code).sex === 'm')!;
    const f = s.fish.find((x) => W.genomeOf(x.code).sex === 'f')!;
    const m2 = s.fish.find((x) => x !== m && W.genomeOf(x.code).sex === 'm')!;
    expect(W.breedProblem(s, m, m2, T0)).toMatch(/male and a female/);
    const r = W.breed(s, m.id, f.id, T0);
    expect('egg' in r && r.egg).toBeTruthy();
    expect(W.breedProblem(s, m, f, T0 + 1000)).toMatch(/resting/);
    const ev = W.tick(s, T0 + W.EGG_HATCH + 1);
    const hatched = ev.find((e) => e.kind === 'hatched') as { fish: W.Fish };
    expect(W.stageOf(hatched.fish.code)).toBe('fry');
    expect(W.generationOf(W.genomeOf(hatched.fish.code))).toBe(1);
    W.tick(s, T0 + W.EGG_HATCH + 1 + W.GROW.adult * 1000);
    expect(W.stageOf(hatched.fish.code)).toBe('adult');
  });

  test('prices are positive and follow demand', () => {
    const code = W.rollWild('price');
    for (let t = 0; t < 20; t++) expect(W.priceOf(code, T0 + t * 97_000)).toBeGreaterThanOrEqual(3);
    const h = W.headlines(T0);
    expect(h.length).toBe(W.MARKET_TAGS.length);
    expect(h[0].mult).toBeGreaterThanOrEqual(h.at(-1)!.mult);
  });

  test('bloom advances phases and opens regions', () => {
    const s = W.newGame(T0, 'bloom');
    const region = s.regions.find((r) => r.opened)!;
    s.orders.push({ id: 'ox', region: region.id, biome: region.biome, colony: 'x', flavor: '', reqs: [], reward: 10, bloom: 130, expires: T0 + 1e6 });
    const r = W.fulfil(s, 'ox', s.fish[0].id, T0);
    expect(s.phase).toBe(1);
    expect('events' in r && r.events.some((e) => e.kind === 'phase')).toBe(true);
    expect('events' in r && r.events.some((e) => e.kind === 'regionOpened')).toBe(true);
    expect(s.regions.filter((x) => x.opened).every((x) => x.opensAt <= 1)).toBe(true);
  });

  test('saves round-trip, and junk saves are refused', () => {
    const s = W.newGame(T0, 'save');
    W.tick(s, T0 + 10_000);
    const back = W.restore(JSON.stringify(s), T0)!;
    expect(back.fish.map((f) => f.code)).toEqual(s.fish.map((f) => f.code));
    expect(back.regions.length).toBe(s.regions.length);
    expect(W.restore('{nope')).toBeNull();
    expect(W.restore({ v: 99 })).toBeNull();
    const broken = JSON.parse(JSON.stringify(s));
    broken.fish[0].code = 'not-a-fish';
    expect(W.restore(broken)!.fish.length).toBe(s.fish.length - 1);
  });

  test('biome roe thaws into a juvenile that fits its biome', () => {
    const s = W.newGame(T0, 'vault');
    const d = W.stock(s, T0).find((x) => x.kind === 'biome' && x.biome === 'melt')!;
    const r = W.buyDrawer(s, d.index, T0);
    expect('egg' in r).toBe(true);
    if ('egg' in r && r.egg) {
      expect(W.fitsBiome(r.egg.code, W.BIOMES[0], 0)).toBe(true);
      expect(W.stageOf(r.egg.code)).toBe('juvenile');
    }
  });
});

describe('regions, windows, polls', () => {
  test('a v1 save migrates: each old biome becomes its first region', () => {
    const v1 = { v: 1, seed: 'old', nextId: 50, credits: 999, phase: 2, bloom: 320, biomeBloom: { melt: 200, river: 100, delta: 20 }, capacity: 14,
      fish: W.newGame(T0, 'x').fish, eggs: [], orders: [{ id: 'o1', biome: 'melt', reqs: [] }], log: [], stats: { orders: 9, bred: 3, sold: 1, seeded: 9, hatched: 3 }, lastTick: T0 };
    const s = W.restore(v1, T0)!;
    expect(s.v).toBe(W.SAVE_VERSION);
    expect(s.credits).toBe(999);
    expect(s.capacity).toBe(14);
    expect(s.orders).toEqual([]);
    const firstMelt = s.regions.find((r) => r.biome === 'melt' && r.opened)!;
    expect(firstMelt.life).toBeGreaterThan(0);
    expect(s.regions.filter((r) => r.opened).every((r) => r.opensAt <= 2)).toBe(true);
  });

  test('a delivery inside the launch window earns +25% life', () => {
    const s = W.newGame(T0, 'win');
    const region = s.regions.find((r) => r.opened)!;
    const f = s.fish.find((x) => !W.misfit(x.code, region.biome, 0))!;
    const g = s.fish.find((x) => x !== f && !W.misfit(x.code, region.biome, 0))!;
    const inside = T0 + region.lon * W.ORBIT_MS;
    const outside = T0 + ((region.lon + 0.5) % 1) * W.ORBIT_MS;
    const a = W.seedFree(s, f.id, region.id, inside);
    const b = W.seedFree(s, g.id, region.id, outside);
    expect('drop' in a && a.drop.clean).toBe(true);
    expect('drop' in b && b.drop.clean).toBe(false);
    if ('drop' in a && 'drop' in b) expect(a.drop.life).toBeGreaterThan(b.drop.life);
  });

  test('free seeding refuses misfits with a reason', () => {
    const s = W.newGame(T0, 'misfit');
    s.phase = 5;
    W.openRegions(s, T0);
    const reef = s.regions.find((r) => r.biome === 'reef')!;
    const cold = s.fish.find((x) => W.ecoOf(x.code).temp === 'cold')!;
    const r = W.seedFree(s, cold.id, reef.id, T0);
    expect(r.error).toMatch(/too|water/);
  });

  test('regions get three unique names, and polls close to the top vote with ties to the player', () => {
    const s = W.newGame(T0, 'poll');
    s.phase = 5;
    W.openRegions(s, T0);
    const all = s.regions.flatMap((r) => r.poll!.options.map((o) => o.name));
    expect(all.length).toBe(s.regions.length * 3);
    expect(new Set(all).size).toBe(all.length);
    const r = s.regions[0];
    const [a, b] = r.poll!.options;
    r.poll!.tokens = 2;
    expect(W.vote(s, r.id, b.id).error).toBeUndefined();
    expect(W.closePoll(s, r.id, T0).error).toMatch(/ready/);
    r.life = W.LIFE_MAX;
    const res = W.closePoll(s, r.id, T0, { [a.id]: 5, [b.id]: 5 });
    expect('name' in res && res.name).toBe(b.name);
    expect(r.name).toBe(b.name);
    expect(s.fieldNotes.regions).toContain(r.id);
  });

  test('simulated poll votes are deterministic and grow over time', () => {
    const ids = ['a', 'b', 'c'];
    expect(W.simTally('r1', ids, T0, T0 + 600_000)).toEqual(W.simTally('r1', ids, T0, T0 + 600_000));
    const early = Object.values(W.simTally('r1', ids, T0, T0 + 60_000)).reduce((x, y) => x + y, 0);
    const late = Object.values(W.simTally('r1', ids, T0, T0 + 3_600_000)).reduce((x, y) => x + y, 0);
    expect(late).toBeGreaterThan(early);
  });

  test('the shop restocks each orbit and crates hold a rare', () => {
    const s = W.newGame(T0, 'shop');
    const a = W.drawers(s, 1).map((d) => d.code);
    const b = W.drawers(s, 2).map((d) => d.code);
    expect(a.length).toBe(W.DRAWERS);
    expect(a).not.toEqual(b);
    expect(W.drawers(s, 1).map((d) => d.code)).toEqual(a);
    expect(W.crateContents(s, 4).some((c) => ['rare', 'myth'].includes(W.genomeOf(c).rarity))).toBe(true);
    const ev = W.tick(s, T0 + W.ORBIT_MS + 10);
    expect(ev.some((e) => e.kind === 'restock')).toBe(true);
  });
});

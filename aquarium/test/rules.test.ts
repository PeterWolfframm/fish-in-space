// FISH IN SPACE! v3 rules: ported from the v2 suite, plus regions, windows, polls and the shop.
import { describe, expect, test } from 'vitest';
import * as W from '../src/game';

const T0 = 1_800_000_000_000;

describe('v2 rules, ported', () => {
  test('a new game has a breedable pair of lake fish and money', () => {
    const s = W.newGame(T0, 'test');
    expect(s.fish.length).toBe(6); // 5 in T1, plus Jerry alone in T2
    expect(s.credits).toBe(W.START_CREDITS);
    const lake = s.fish.filter((f) => W.fitsBiome(f.code, W.BIOMES[0], 0));
    expect(lake.length).toBeGreaterThanOrEqual(4);
    expect([...new Set(lake.map((f) => W.genomeOf(f.code).sex))].sort()).toEqual(['f', 'm']);
    expect(s.fish.every(W.isAdult)).toBe(true);
  });

  test('new game has a second tank holding exactly one fish named Jerry', () => {
    const s = W.newGame(T0, 'jerry');
    expect(s.tanks.map((t) => t.id)).toEqual(['T1', 'T2']);
    const t2 = s.fish.filter((f) => f.tank === 'T2');
    expect(t2.length).toBe(1);
    expect(t2[0].name).toBe('Jerry');
    expect(W.fishName(t2[0])).toBe('Jerry');
    expect(s.fish.filter((f) => f.tank === 'T1').length).toBe(5);
  });

  test('tank capacity is derived from shape, and T1 alone gets annex/extend bonuses', () => {
    const s = W.newGame(T0, 'cap');
    expect(W.tankCapacity(s, 'T1')).toBe(10); // 1x2
    expect(W.tankCapacity(s, 'T2')).toBe(6); // 1x1
    s.upgrades.extendBerths += 4;
    expect(W.tankCapacity(s, 'T1')).toBe(14);
    expect(W.tankCapacity(s, 'T2')).toBe(6); // unaffected
    s.upgrades.annex = true;
    expect(W.tankCapacity(s, 'T1')).toBe(14 + 8);
  });

  test('buyTank prices by shape and packs tanks first-fit on the wall grid', () => {
    const s = W.newGame(T0, 'buytank');
    s.credits = 10_000;
    const before = s.tanks.length;
    const r = W.buyTank(s, '2x1', T0);
    expect('tank' in r && r.tank).toBeTruthy();
    expect(s.tanks.length).toBe(before + 1);
    if ('tank' in r && r.tank) expect(r.tank.shape).toBe('2x1');
    // T1 is 1x2 at (0,0) (occupies (0,0),(0,1)); T2 is 1x1 at (1,0). A 2x1 needs two free
    // adjacent columns in one row, which isn't free at y=0, so it should land at y=1.
    const packed = W.packTanks(s.tanks);
    for (const t of s.tanks) {
      const { w, h } = { '1x1': { w: 1, h: 1 }, '2x1': { w: 2, h: 1 }, '1x2': { w: 1, h: 2 }, '2x2': { w: 2, h: 2 }, '3x1': { w: 3, h: 1 } }[t.shape];
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) expect(packed.has(`${t.slot.x + dx},${t.slot.y + dy}`)).toBe(true);
    }
    expect(W.TANK_PRICE['1x1']).toBe(200);
    expect(W.TANK_PRICE['2x1']).toBe(380);
    expect(W.TANK_PRICE['1x2']).toBe(380);
    expect(W.TANK_PRICE['2x2']).toBe(700);
    expect(W.TANK_PRICE['3x1']).toBe(560);
    const poor = W.newGame(T0, 'poor');
    poor.credits = 0;
    expect(W.buyTank(poor, '1x1', T0).error).toBeTruthy();
  });

  test('uiScale defaults to 1 on a new game', () => {
    const s = W.newGame(T0, 'scale');
    expect(s.settings.uiScale).toBe(1);
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

  test('a v3 save migrates to v4: everything lands in tank T1, and settings/upgrades fill in', () => {
    const v3fresh = W.newGame(T0, 'v3src');
    const v3 = { ...JSON.parse(JSON.stringify(v3fresh)), v: 3, capacity: 18, upgrades: { feeder: true, heater: false, annex: true, feederOrbit: 0 } };
    delete (v3 as Record<string, unknown>).tanks;
    for (const f of v3.fish) delete (f as Record<string, unknown>).tank;
    for (const e of v3.eggs) delete (e as Record<string, unknown>).tank;
    for (const d of v3.decor) delete (d as Record<string, unknown>).tank;
    delete (v3 as Record<string, unknown>).settings;
    const s = W.restore(v3, T0)!;
    expect(s.v).toBe(W.SAVE_VERSION);
    expect(s.tanks).toEqual([{ id: 'T1', name: 'Tank One', shape: '1x2', slot: { x: 0, y: 0 } }]);
    expect(s.fish.every((f) => f.tank === 'T1')).toBe(true);
    expect(s.eggs.every((e) => e.tank === 'T1')).toBe(true);
    expect(s.decor.every((d) => d.tank === 'T1')).toBe(true);
    expect(s.upgrades.annex).toBe(true);
    expect(s.settings.uiScale).toBe(1);
    // old capacity 18 = 1x2(10) + annex(8) + extendBerths(0)
    expect(s.upgrades.extendBerths).toBe(0);
    expect(s.capacity).toBe(18);
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

describe('PIP advice', () => {
  test('recommends only launches the rules accept, and never Jerry', () => {
    const s = W.newGame(T0, 'advice');
    const cards = W.advise(s);
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      if (c.kind === 'none') continue;
      expect(c.fish.name).toBeUndefined();
      if (c.kind === 'order') expect(W.meetsAll(c.fish.code, c.order.reqs)).toBe(true);
      else expect(W.seedProblem(s, c.fish, c.region)).toBeNull();
    }
  });

  test('never suggests the last adult of a sex', () => {
    const s = W.newGame(T0, 'last');
    const keep = s.fish.find((f) => W.isAdult(f) && !f.name)!;
    const sex = W.genomeOf(keep.code).sex;
    s.fish = s.fish.filter((f) => f === keep || f.name || W.genomeOf(f.code).sex !== sex);
    expect(W.advise(s, 9).some((c) => c.kind !== 'none' && c.fish.id === keep.id)).toBe(false);
  });

  test('an empty station gets the negative card', () => {
    const s = W.newGame(T0, 'empty');
    s.fish = [];
    expect(W.advise(s)).toEqual([{ kind: 'none', why: 'empty' }]);
  });
});

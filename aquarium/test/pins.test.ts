// Pins on the glass, and PIP's breeding plan.
import { describe, expect, test } from 'vitest';
import * as W from '../src/game';

const T0 = 1_800_000_000_000;
const note = (ref: string): W.PinDraft => ({ ref, kind: 'note', source: 'news', title: 'Herbivore ×1.80', text: 'Algae blooms', fish: [], tone: 'bloom' });

describe('pins', () => {
  test('a pin sticks to the tank it was pinned to, inside the glass', () => {
    const s = W.newGame(T0, 'pins');
    const r = W.addPin(s, note('news:herbivore'), 'T2', T0);
    if ('error' in r) throw new Error(r.error);
    expect(r.fresh).toBe(true);
    expect(r.pin.tank).toBe('T2');
    expect(W.pinsOn(s, 'T2')).toHaveLength(1);
    expect(W.pinsOn(s, 'T1')).toHaveLength(0);
    expect(r.pin.x).toBeGreaterThan(0);
    expect(r.pin.x).toBeLessThan(1);
  });

  test('pinning the same thing twice to one tank keeps one pin; another tank gets its own', () => {
    const s = W.newGame(T0, 'dupe');
    W.addPin(s, note('news:herbivore'), 'T1', T0);
    const again = W.addPin(s, note('news:herbivore'), 'T1', T0);
    expect('error' in again ? null : again.fresh).toBe(false);
    W.addPin(s, note('news:herbivore'), 'T2', T0);
    expect(s.pins).toHaveLength(2);
  });

  test('moving clamps to the glass and brings the pin to the top; a full glass refuses more', () => {
    const s = W.newGame(T0, 'move');
    for (let i = 0; i < W.PIN_MAX; i++) W.addPin(s, note(`n${i}`), 'T1', T0);
    expect('error' in W.addPin(s, note('one-too-many'), 'T1', T0)).toBe(true);
    const first = s.pins[0];
    W.movePin(s, first.id, -3, 9);
    expect(s.pins.at(-1)!.id).toBe(first.id);
    expect(first.x).toBeGreaterThan(0);
    expect(first.y).toBeLessThan(1);
  });

  test('repin moves a pin between tanks; unpin removes it', () => {
    const s = W.newGame(T0, 'repin');
    const r = W.addPin(s, note('x'), 'T1', T0);
    if ('error' in r) throw new Error(r.error);
    expect(W.repin(s, r.pin.id, 'T2')).toBeNull();
    expect(r.pin.tank).toBe('T2');
    W.unpin(s, r.pin.id);
    expect(s.pins).toHaveLength(0);
  });

  test('pins survive a save; orphans and junk are dropped; old saves get none', () => {
    const s = W.newGame(T0, 'save-pins');
    const fish = s.fish[0];
    W.addPin(s, { ref: `fish:${fish.id}`, kind: 'portrait', source: 'lab', title: 'Breed this', text: '', fish: [{ id: fish.id, code: fish.code, name: W.fishName(fish) }], tone: 'lilac' }, 'T1', T0);
    const raw = structuredClone(s) as W.State;
    raw.pins.push({ ...raw.pins[0], id: 'ghost', ref: 'ghost', tank: 'T9' });
    (raw.pins as unknown[]).push({ nonsense: true });
    const back = W.restore(JSON.stringify(raw), T0)!;
    expect(back.pins).toHaveLength(1);
    expect(back.pins[0].kind).toBe('portrait');
    expect(back.pins[0].fish[0].code).toBe(fish.code);
    const old = structuredClone(s) as Partial<W.State>;
    delete old.pins;
    expect(W.restore(old, T0)!.pins).toEqual([]);
  });
});

describe('breeding plan', () => {
  test('a region needs its water, and its requests add their asks', () => {
    const s = W.newGame(T0, 'needs');
    const region = W.planTarget(s)!;
    expect(region.opened).toBe(true);
    const t = W.needsOf(s, region);
    expect(t.needs.filter((n) => n.source === 'water').map((n) => n.id)).toEqual(['water:salinity', 'water:temp']);
    s.orders.push({ id: 'o1', region: region.id, biome: region.biome, colony: 'New Wren', flavor: '', reward: 90, bloom: 20, expires: T0 + 1e6,
      reqs: [{ kind: 'eco', key: 'salinity', value: 'fresh' }, { kind: 'eco', key: 'temp', value: 'cold' }, { kind: 'eco', key: 'diet', value: 'herbivore' }, { kind: 'bred' }] });
    const asked = W.needsOf(s, region).needs.filter((n) => n.source === 'order');
    expect(asked.map((n) => n.label)).toEqual(['Grazer', 'Hatchery-bred']);
    expect(asked[0].why).toContain('New Wren');
  });

  test('the starter lake fish make a plan for the first lake, with reasons and honest odds', () => {
    const s = W.newGame(T0, 'plan');
    const plan = W.breedPlan(s, W.planTarget(s)!, T0);
    expect(plan.pairs.length).toBeGreaterThan(0);
    const p = plan.pairs[0];
    expect(p.a.tank).toBe(p.b.tank);
    expect(W.genomeOf(p.a.code).sex).not.toBe(W.genomeOf(p.b.code).sex);
    expect(p.water).toBeGreaterThan(0);
    expect(p.water).toBeLessThanOrEqual(100);
    expect(p.reasons[0]).toMatch(/%/);
    // A fish leads at most one card.
    const ids = plan.pairs.flatMap((x) => [x.a.id, x.b.id]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('with no adults aboard, PIP says what to look for instead', () => {
    const s = W.newGame(T0, 'empty');
    s.fish = [];
    const plan = W.breedPlan(s, W.planTarget(s)!, T0);
    expect(plan.pairs).toEqual([]);
    expect(plan.seek?.text).toMatch(/Interchange/);
  });
});

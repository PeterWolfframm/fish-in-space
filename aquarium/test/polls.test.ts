// Naming polls: the NPC stream is deterministic, grows over time, and the player's votes stack on top.
import { describe, expect, test } from 'vitest';
import * as W from '../src/game';
import { SimPolls } from '../src/store/backend';

const T0 = 1_800_000_000_000;
const MIN = 60_000;

describe('polls', () => {
  test('the NPC stream is the same on every device and only grows (roughly)', () => {
    const a = W.simTally('r1', ['x', 'y', 'z'], T0, T0 + 10 * MIN);
    const b = W.simTally('r1', ['x', 'y', 'z'], T0, T0 + 10 * MIN);
    expect(a).toEqual(b);
    const later = W.simTally('r1', ['x', 'y', 'z'], T0, T0 + 60 * MIN);
    const sum = (t: Record<string, number>) => Object.values(t).reduce((s, v) => s + v, 0);
    expect(sum(later)).toBeGreaterThan(sum(a));
  });

  test('share sums to one and handles an empty tally', () => {
    const t = { a: 3, b: 1 };
    expect(W.share(t, 'a') + W.share(t, 'b')).toBeCloseTo(1);
    expect(W.share({}, 'a')).toBe(0);
  });

  test('SimPolls adds the player’s votes on top of the stream and persists them', async () => {
    let now = T0 + 5 * MIN;
    const saved: unknown[] = [];
    const p = new SimPolls({ now: () => now, persist: (v) => saved.push(structuredClone(v)) });
    p.open('r1', { optionIds: ['x', 'y'], openedAt: T0 });
    const base = p.tally('r1');
    await p.vote('r1', 'y', 3);
    const after = p.tally('r1');
    expect(after.y).toBe((base.y ?? 0) + 3);
    expect(after.x).toBe(base.x);
    expect(saved.length).toBeGreaterThan(0);
    now += MIN;
    expect(p.tally('unknown')).toEqual({});
  });

  test('votes need tokens and a live ballot', () => {
    const s = W.newGame(T0, 'vote');
    const r = s.regions.find((x) => x.poll)!;
    r.poll!.tokens = 1;
    const opt = r.poll!.options[0].id;
    expect(W.failed(W.vote(s, r.id, 'nope'))).toBe(true);
    expect(W.failed(W.vote(s, r.id, opt))).toBe(false);
    expect(W.failed(W.vote(s, r.id, opt))).toBe(true);
    expect(r.poll!.spent[opt]).toBe(1);
  });
});

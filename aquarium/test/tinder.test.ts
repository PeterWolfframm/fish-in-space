import { describe, it, expect } from 'vitest';
import * as T from '../src/game/tinder';

const sw = (code: string, verdict: T.Verdict, extra: Partial<T.TinderSwipe> = {}): T.TinderSwipe => ({ id: code + verdict, code, seed: code, verdict, at: 0, ...extra });

describe('fish tinder', () => {
  it('rolls the same fish for the same seed, different fish for different seeds', () => {
    expect(T.roll('abc').code).toBe(T.roll('abc').code);
    const codes = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => T.roll(s).code));
    expect(codes.size).toBeGreaterThan(4);
  });

  it('reads a full profile off a roll', () => {
    for (const seed of ['x1', 'x2', 'x3', 'x4', 'x5']) {
      const p = T.profileOf(T.roll(seed).code);
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.age).toBeGreaterThan(0);
      expect(p.bio.length).toBeGreaterThan(0);
      expect(p.distance).toMatch(/km below/);
      expect(p.prompt.a.length).toBeGreaterThan(0);
      expect(p.interests.length).toBeGreaterThan(0);
    }
  });

  it('likes back by code, and always on a super like', () => {
    const c = T.roll('m1').code;
    expect(T.likesBack(c)).toBe(T.likesBack(c));
    expect(T.likesBack(c, true)).toBe(true);
  });

  it('pours likes into the pool, super likes into S, and drops passes and unlikes', () => {
    let t = T.syncTiers(T.emptyTiers(), [sw('a', 'approve'), sw('b', 'pass'), sw('c', 'approve', { superlike: true }), sw('d', 'approve')]);
    expect(t.S).toEqual(['c']);
    expect(t.pool).toEqual(['d', 'a']);
    t = T.moveTier(t, 'a', 'B');
    t = T.syncTiers(t, [sw('a', 'approve'), sw('c', 'approve', { superlike: true })]);
    expect(t.B).toEqual(['a']);
    expect(t.pool).toEqual([]);
    expect(T.rankOf(t, 'a')).toBe('B');
    expect(T.rankOf(t, 'd')).toBeNull();
  });

  it('moves a fish between rows and in front of another', () => {
    let t = { ...T.emptyTiers(), pool: ['a', 'b', 'c'] };
    t = T.moveTier(t, 'a', 'S');
    t = T.moveTier(t, 'b', 'S');
    t = T.moveTier(t, 'c', 'S', 'a');
    expect(t.S).toEqual(['c', 'a', 'b']);
    expect(t.pool).toEqual([]);
    expect(T.moveTier(t, 'zzz', 'A')).toBe(t);
  });
});

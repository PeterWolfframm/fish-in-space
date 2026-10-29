import { describe, it, expect } from 'vitest';
import * as T from '../src/game/tinder';
import { fish, genomeOf } from '../src/game/fish';

const sw = (code: string, verdict: T.Verdict, extra: Partial<T.TinderSwipe> = {}): T.TinderSwipe => ({ id: code + verdict, code, seed: code, verdict, at: 0, ...extra });

describe('fish-der', () => {
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

  it('shows the profile, then the life stages two at a time, then every animation', () => {
    const code = T.roll('ph1').code;
    const ph = T.photosOf(code);
    expect(ph[0].shots).toEqual([{ code, anim: 'swim' }]);
    const pairs = ph.slice(1, 3);
    expect(pairs.every((p) => p.shots.length === 2)).toBe(true);
    expect(pairs.flatMap((p) => p.shots.map((s) => genomeOf(s.code).stage))).toEqual(['fry', 'juvenile', 'adult', 'elder']);
    expect(ph.slice(3).map((p) => p.shots[0].anim)).toEqual(fish.anims.map((a) => a.id));
    expect(ph.slice(3).every((p) => p.shots.length === 1 && p.shots[0].code === code)).toBe(true);
  });

  it('lays the full dossier out in sections with no empty rows', () => {
    for (const seed of ['f1', 'f2', 'f3']) {
      const f = T.factsOf(T.roll(seed).code);
      const by = Object.fromEntries(f.map((s) => [s.title, s.rows]));
      for (const t of ['Identity', 'Lifestyle', 'Habitat', 'Care', 'Genes']) expect(by[t]?.length).toBeGreaterThan(0);
      expect(f.flatMap((s) => s.rows).every(([k, v]) => k && v && !v.includes('undefined'))).toBe(true);
      expect(by.Habitat.find(([k]) => k === 'Temperature')?.[1]).toMatch(/°C/);
    }
  });

  it('tallies what you like per trait, a super like counting twice', () => {
    const codes = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((s) => T.roll(s).code);
    const sws = [sw(codes[0], 'approve', { superlike: true }), sw(codes[1], 'approve'), sw(codes[2], 'pass'), sw(codes[3], 'pass'), sw(codes[4], 'approve'), sw(codes[5], 'pass')];
    const sex = T.preferences(sws, 1).find((p) => p.trait === 'Sex')!;
    expect(sex.rows.reduce((n, r) => n + r.total, 0)).toBe(7);
    expect(sex.rows.reduce((n, r) => n + r.likes, 0)).toBe(4);
    for (let i = 1; i < sex.rows.length; i++) expect(sex.rows[i - 1].likes / sex.rows[i - 1].total).toBeGreaterThanOrEqual(sex.rows[i].likes / sex.rows[i].total);
    expect(T.preferences([sw(codes[0], 'approve')], 2)).toEqual([]);
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

  it('joins feedback the way the swiper stores it, and keeps a legacy super like out of the note', () => {
    const fb = { ...T.emptyFeedback(), canned: ['Love it', 'Colors off'], note: 'fins' };
    expect(T.feedbackNote(fb)).toBe('Love it, Colors off — fins');
    expect(T.feedbackCount(fb)).toBe(3);
    expect(T.readCloudSwipe({ note: 'super like' })).toMatchObject({ superlike: true, feedback: undefined });
    const read = T.readCloudSwipe({ note: 'Love it — fins', fix: ['tail'], instead: { tail: 'fan' }, asKind: 'plant', scores: { personal: 0.4, superlike: true } });
    expect(read.superlike).toBe(true);
    expect(read.score).toBe(0.4);
    expect(read.feedback).toMatchObject({ note: 'Love it — fins', fix: ['tail'], instead: { tail: 'fan' }, asKind: 'plant' });
  });

  it('likes you back on a seeded roll; super likes always match', () => {
    const code = T.roll('match-me').code;
    expect(typeof T.likesBack(code)).toBe('boolean');
    expect(T.likesBack(code, true)).toBe(true);
  });
});

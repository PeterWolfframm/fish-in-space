import { describe, it, expect } from 'vitest';
import fishV1, { fishTraits } from '@forge/gen/fish.js';
import fish2, { fish2Traits } from '@forge/v2/fish/index.js';
import * as T from '../src/game/tinder';
import { codeOf, genomeOf, stageOf, withSize, withStage } from '../src/game/fish';
import { bake } from '../src/art/bake';

const ink = (img: { w: number; h: number; data: ArrayLike<number>; palette: number[][] }) => {
  let n = 0;
  for (let i = 0; i < img.w * img.h; i++) if (img.palette[img.data[i]]?.[3]) n++;
  return n;
};

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

  it('names every stage, the age pair, the sizes, and both older painters', () => {
    expect(T.PHOTOS.map((p) => p.id)).toEqual(['rolled', 'fry', 'juvenile', 'grown', 'elder', 'ages', 'sizes', 'v1', 'v2']);
    const code = T.roll('photos').code;
    const ages = T.spritesOf(code, T.PHOTOS[5]);
    expect(ages.map((s) => stageOf(s.code))).toEqual(['juvenile', 'adult']);
    expect(ages.every((s) => !s.animate)).toBe(true);
    expect(T.spritesOf(code, T.PHOTOS[6]).map((s) => genomeOf(s.code).size)).toEqual(T.SIZES);
  });

  it('round-trips stage and size, and v1 and v2 still draw a v3-only body', () => {
    const code = codeOf({ ...genomeOf(T.roll('proj').code), body: 'piranha', hybrid: 'none' });
    expect(stageOf(withStage(code, 'fry'))).toBe('fry');
    expect(stageOf(withStage(code, 'elder'))).toBe('elder');
    expect(genomeOf(withSize(code, 'tiny')).size).toBe('tiny');
    expect(genomeOf(withSize(code, 'giant')).size).toBe('giant');
    for (const painter of ['fish', 'fish2'] as const) {
      const projected = T.projectCode(code, painter);
      const traits = painter === 'fish' ? fishTraits : fish2Traits;
      const g = traits.decode(projected);
      expect(g).toBeTruthy();
      expect(g!.body).not.toBe('piranha');
      const img = (painter === 'fish' ? fishV1 : fish2).frame(traits.normalize(g), 'swim', 0);
      expect(img.w).toBeGreaterThan(0);
      expect(ink(img)).toBeGreaterThan(0);
      const strip = bake(painter, projected, 'swim');
      expect(strip.n).toBeGreaterThan(0);
      expect(strip.rgba.some((b) => b > 0)).toBe(true);
    }
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
});

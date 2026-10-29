import { describe, it, expect } from 'vitest';
import { bake } from '../src/art/bake';
import { newGame } from '../src/game/state';

describe('bake', () => {
  it('bakes every family into a padded strip', () => {
    const g = newGame(1000, 'bake');
    const jobs: [Parameters<typeof bake>[0], string, string][] = [
      ['fish4', g.fish[0].code, 'swim'],
      ...g.decor.map((p) => [p.family, p.code, p.family === 'plant3' ? 'idle' : 'sway'] as [any, string, string]),
      ['pilot2', 'wren-halloway|tutor', 'talk'],
    ];
    for (const [fam, code, anim] of jobs) {
      const s = bake(fam, code, anim);
      expect(s.n).toBeGreaterThan(0);
      expect(s.rgba.length).toBe(s.w * s.n * s.h * 4);
      let opaque = 0;
      for (let i = 3; i < s.rgba.length; i += 4) if (s.rgba[i]) opaque++;
      expect(opaque).toBeGreaterThan(20);
      console.log(fam, anim, s.w, s.h, s.n, s.fps);
    }
  });
});

import { describe, expect, test } from 'vitest';
import { generatePlanet, planetRegions } from '../src/planet/gen';

describe('planet generation', () => {
  test('Mirelle is deterministic', () => {
    const a = generatePlanet('mirelle');
    const b = generatePlanet('mirelle');
    expect(Array.from(a.cls)).toEqual(Array.from(b.cls));
    expect(a.regions).toEqual(b.regions);
  });

  test('Mirelle has 12–18 regions covering every biome, with a phase-0 lake', () => {
    const rs = planetRegions('mirelle');
    expect(rs.length).toBeGreaterThanOrEqual(12);
    expect(rs.length).toBeLessThanOrEqual(18);
    expect(new Set(rs.map((r) => r.biome))).toEqual(new Set(['melt', 'river', 'delta', 'reef', 'trench']));
    expect(rs.some((r) => r.biome === 'melt' && r.opensAt === 0)).toBe(true);
    for (const r of rs) expect(r.area).toBeGreaterThan(0);
  });

  test('other seeds are feasible too', () => {
    for (const seed of ['kessa', 'oru', 'test-1']) {
      const rs = planetRegions(seed);
      expect(rs.length).toBeGreaterThanOrEqual(8);
      expect(rs.some((r) => r.opensAt === 0)).toBe(true);
    }
  });
});

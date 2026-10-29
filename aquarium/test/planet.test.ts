import { describe, expect, test } from 'vitest';
import { generatePlanet, planetRegions } from '../src/planet/gen';

describe('planet generation', () => {
  test('Mirelle is deterministic', () => {
    const a = generatePlanet('mirelle');
    const b = generatePlanet('mirelle');
    expect(Array.from(a.cls)).toEqual(Array.from(b.cls));
    expect(a.regions).toEqual(b.regions);
  });

  test('Mirelle has 12–21 regions covering every biome, with a phase-0 lake', () => {
    const rs = planetRegions('mirelle');
    expect(rs.length).toBeGreaterThanOrEqual(12);
    expect(rs.length).toBeLessThanOrEqual(21);
    expect(new Set(rs.map((r) => r.biome))).toEqual(new Set(['melt', 'river', 'delta', 'reef', 'trench', 'sea']));
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

  test('Open Sea: Mirelle and a couple of other seeds get 3–6 deterministic sea regions, appended after the rest', () => {
    for (const seed of ['mirelle', 'seedfall', 'fish']) {
      const a = generatePlanet(seed);
      const b = generatePlanet(seed);
      expect(a.regions).toEqual(b.regions); // deterministic
      const rest = a.regions.filter((r) => r.biome !== 'sea');
      const seas = a.regions.filter((r) => r.biome === 'sea');
      expect(seas.length).toBeGreaterThanOrEqual(3);
      expect(seas.length).toBeLessThanOrEqual(6);
      // existing regions keep their ids, indices and biomes; sea regions are appended after them.
      rest.forEach((r, i) => expect(r.index).toBe(i));
      seas.forEach((r) => expect(r.index).toBeGreaterThanOrEqual(rest.length));
      expect(new Set(seas.map((r) => r.id)).size).toBe(seas.length);
      for (const r of seas) expect(r.area).toBeGreaterThan(0);
    }
  });
});

// Mirelle's phases and its five biomes. A biome's water changes as the planet terraforms.

import type { BiomeId, Salinity, Temp } from './types';

export const PLANET = 'Mirelle';

export interface Phase {
  name: string;
  bloom: number;
  story: string;
}

export const PHASES: Phase[] = [
  { name: 'First Thaw', bloom: 0, story: 'The ice caps of Mirelle have cracked. Meltwater is pooling in the northern basins: clean, cold, and completely empty.' },
  { name: 'Rivers Run', bloom: 120, story: 'The lakes overflowed overnight. Meltwater is carving rivers down the valleys. Running water wants strong swimmers.' },
  { name: 'Brine Rising', bloom: 300, story: 'Rivers met the old salt flats and made a delta. Brackish water! The lakes are warming, too.' },
  { name: 'Warm Seas', bloom: 540, story: 'The equatorial basin filled. Mirelle has a sea, and coral scaffolds are taking hold. Rivers and delta are warming up.' },
  { name: 'The Deep Wakes', bloom: 840, story: 'Something is glowing in the deep trench. The deep needs fish that can see in the dark. Upwelling is chilling the delta.' },
  { name: 'Living World', bloom: 1200, story: 'The Accord has declared Mirelle a living world. Every biome is open, and every colony wants something.' },
];

export interface Cond {
  from: number;
  salinity: Exclude<Salinity, 'any'>;
  temp: Temp;
  depth?: string[];
}

export interface Biome {
  id: BiomeId;
  name: string;
  kind: string; // what a region of this biome is called
  icon: string;
  color: string;
  opens: number;
  blurb: string;
  conds: Cond[];
}

export const BIOMES: Biome[] = [
  { id: 'melt', name: 'Meltwater Lakes', kind: 'Lake', icon: '❄', color: '#8fd8ee', opens: 0, blurb: 'Glacial basins in the north, clear as glass.',
    conds: [{ from: 0, salinity: 'fresh', temp: 'cold' }, { from: 2, salinity: 'fresh', temp: 'temperate' }] },
  { id: 'river', name: 'Glassrun Rivers', kind: 'River', icon: '≋', color: '#6fc3a8', opens: 1, blurb: 'Fast valleys carved by the overflowing lakes.',
    conds: [{ from: 1, salinity: 'fresh', temp: 'temperate' }, { from: 3, salinity: 'fresh', temp: 'tropical' }] },
  { id: 'delta', name: 'Brinemouth Delta', kind: 'Delta', icon: '☘', color: '#c9b46a', opens: 2, blurb: 'Where river silt meets the salt flats.',
    conds: [{ from: 2, salinity: 'brackish', temp: 'temperate' }, { from: 3, salinity: 'brackish', temp: 'tropical' }, { from: 4, salinity: 'brackish', temp: 'cold' }] },
  { id: 'reef', name: 'Coral Nursery', kind: 'Reef', icon: '❁', color: '#f08fa8', opens: 3, blurb: 'Warm equatorial shallows on engine-grown coral.',
    conds: [{ from: 3, salinity: 'marine', temp: 'tropical' }] },
  { id: 'trench', name: 'Lanternfall Trench', kind: 'Deep', icon: '✦', color: '#8b7cf0', opens: 4, blurb: 'A cold, deep scar lit by glowing minerals.',
    conds: [{ from: 4, salinity: 'marine', temp: 'cold', depth: ['twilight', 'abyss'] }] },
];

export const biomeById = (id: string): Biome | undefined => BIOMES.find((b) => b.id === id);
export const openBiomes = (phase: number) => BIOMES.filter((b) => b.opens <= phase);

export function condOf(biome: Biome, phase: number): Cond {
  return biome.conds.filter((c) => c.from <= Math.max(phase, biome.opens)).at(-1)!;
}

export const condWords = (c: Cond) => [c.salinity, c.temp, c.depth && 'deep'].filter(Boolean).join(', ');

/** What changes at the next phase, for the forecast. */
export function forecast(phase: number): string[] {
  if (!PHASES[phase + 1]) return [];
  const out: string[] = [];
  for (const b of BIOMES) {
    if (b.opens === phase + 1) out.push(`${b.name} opens (${condWords(condOf(b, phase + 1))})`);
    else if (b.opens <= phase) {
      const now = condOf(b, phase);
      const then = condOf(b, phase + 1);
      if (now !== then) out.push(`${b.name}: ${condWords(now)} → ${condWords(then)}`);
    }
  }
  return out;
}

/** The water the next phase will want that it doesn't want now, for shop weighting and hints. */
export function nextNeeds(phase: number): Cond[] {
  if (!PHASES[phase + 1]) return [];
  const out: Cond[] = [];
  for (const b of BIOMES) {
    if (b.opens > phase + 1) continue;
    const then = condOf(b, phase + 1);
    if (b.opens === phase + 1 || then !== condOf(b, phase)) out.push(then);
  }
  return out;
}

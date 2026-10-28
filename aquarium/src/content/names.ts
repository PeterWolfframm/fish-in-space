// Fantasy names the Colony Accord proposes for a region, from a small syllable grammar per biome.
// Seeded by planet and region id; no name repeats on one planet.

import { rng, pick } from '../game/rng';
import type { BiomeId } from '../game/types';

interface Grammar {
  starts: string[];
  ends: string[];
  words: string[]; // whole made-up nouns for "The X" names
  forms: ((root: string, word: string) => string)[];
}

const G: Record<BiomeId, Grammar> = {
  melt: {
    starts: ['Il', 'Moor', 'Ae', 'Lume', 'Oy', 'Sil', 'Ven', 'Ula', 'Mae', 'Elo'],
    ends: ['venna', 'well', 'lia', 'mere', 'oa', 'ane', 'ola', 'elle', 'iun'],
    words: ['Oyl', 'Hollow', 'Stillness', 'Pale', 'Mirror', 'Hush'],
    forms: [(r) => `Lake ${r}`, (r) => `${r} Glass`, (_, w) => `The Quiet ${w}`, (r) => `${r} Tarn`, (r) => `${r} Basin`],
  },
  river: {
    starts: ['Tass', 'Brann', 'Vey', 'Kett', 'Rook', 'Dask', 'Tarr', 'Skel', 'Wick', 'Fenn'],
    ends: ['elrun', 'ock', 'arrow', 'ford', 'rill', 'ett', 'brook', 'ask', 'ern'],
    words: ['Arrow', 'Tumble', 'Rush', 'Ribbon', 'Spill', 'Chase'],
    forms: [(r) => r, (r) => `${r} Reach`, (_, w) => `The ${w}`, (r) => `${r} Run`, (r) => `Vey-${r}`],
  },
  delta: {
    starts: ['Kerr', 'Salt', 'Brin', 'Marr', 'Silt', 'Gull', 'Sedge', 'Wrack', 'Tamm'],
    ends: ['owbrine', 'mother', 'ey', 'ow', 'mouth', 'ing', 'wash', 'flat', 'ock'],
    words: ['Lisp', 'Murmur', 'Spread', 'Fan', 'Muddle', 'Braid'],
    forms: [(r) => r, (r) => `${r} Mouth`, (_, w) => `The ${w}`, (r) => `${r} Flats`, (r) => `${r} Fan`],
  },
  reef: {
    starts: ['Coral', 'Amber', 'Pink', 'Sunn', 'Opal', 'Glim', 'Rose', 'Tide', 'Bright', 'Peach'],
    ends: ['une', 'mantle', 'water', 'ella', 'ary', 'spire', 'glow', 'lace', 'ira'],
    words: ['Steps', 'Garden', 'Fringe', 'Lantern', 'Bouquet', 'Shelf'],
    forms: [(r) => r, (r) => `${r} Steps`, (r, w) => `${r} ${w}`, (r) => `${r} Shallows`, (r) => `${r} Shoals`],
  },
  trench: {
    starts: ['Lantern', 'Old', 'Mourn', 'Umber', 'Dun', 'Grave', 'Hollow', 'Night', 'Ember'],
    ends: ['fall', 'light', 'deep', 'well', 'hush', 'mark', 'vault', 'sink', 'dim'],
    words: ['Long Hush', 'Lamp', 'Slow Dark', 'Underhum', 'Kindly Deep', 'Lantern'],
    forms: [(r) => r, (r) => `${r} Deep`, (_, w) => `The ${w}`, (r) => `${r} Rift`, (r) => `${r} Hollow`],
  },
};

/** One candidate name. Roots fuse a start and an end, so "Coral" + "une" is "Coralune". */
function nameFor(biome: BiomeId, r: () => number): string {
  const g = G[biome];
  const root = pick(r, g.starts) + pick(r, g.ends);
  return pick(r, g.forms)(root.charAt(0).toUpperCase() + root.slice(1), pick(r, g.words));
}

/** Three names for every region, unique across the planet, in region order. */
export function regionNames(planet: string, regions: { id: string; biome: BiomeId }[]): Record<string, string[]> {
  const used = new Set<string>();
  const out: Record<string, string[]> = {};
  for (const reg of regions) {
    const r = rng(`names:${planet}:${reg.id}`);
    const three: string[] = [];
    for (let tries = 0; three.length < 3 && tries < 500; tries++) {
      const n = nameFor(reg.biome, r);
      if (used.has(n)) continue;
      used.add(n);
      three.push(n);
    }
    out[reg.id] = three;
  }
  return out;
}

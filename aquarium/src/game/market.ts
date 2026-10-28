// The Exchange: colony demand per trait drifts over time, the same for everyone, and sets prices.

import { hash } from './rng';
import { genomeOf, ecoOf, generationOf } from './fish';

const DIETS = ['herbivore', 'detritivore', 'planktivore', 'omnivore', 'carnivore', 'piscivore', 'durophage'];
const TEMPS = ['cold', 'temperate', 'tropical'];
const SALTS = ['fresh', 'brackish', 'marine'];
export const MARKET_TAGS = [...DIETS, ...TEMPS, ...SALTS];

const WHY: Record<string, string> = {
  herbivore: 'Algae blooms are clogging colony reservoirs',
  detritivore: 'Settler fish farms need tank cleaners',
  planktivore: 'Hydroponic plankton is overgrowing the vats',
  omnivore: 'Colony aquaponics want hardy all-rounders',
  carnivore: 'Larval pests in the irrigation canals',
  piscivore: 'Feeder-fish booms in the colony ponds',
  durophage: 'Snail plagues in the terraced paddies',
  cold: 'A cold front over the polar settlements',
  temperate: 'Mild spring in the valley colonies',
  tropical: 'Equatorial domes are heating up',
  fresh: 'New freshwater reservoirs opened',
  brackish: 'Estuary farms are expanding',
  marine: 'Sea-farms launched on the coast',
};

const MARKET_SLOT = 12 * 60_000;

/** How badly the colonies want a trait right now: 0.5 (glut) .. 2.4 (crisis). */
export function demand(tag: string, now: number): number {
  const h = hash(tag);
  const period = (8 + (h % 9)) * 60_000;
  let v = 1 + 0.5 * Math.sin((2 * Math.PI * now) / period + (h % 628) / 100);
  const slot = Math.floor(now / MARKET_SLOT);
  if (MARKET_TAGS[hash(`spike:${slot}`) % MARKET_TAGS.length] === tag) v += 0.9;
  return Math.max(0.5, Math.min(2.4, v));
}

export interface Headline {
  tag: string;
  mult: number;
  why: string;
}

export function headlines(now: number): Headline[] {
  return MARKET_TAGS.map((tag) => ({ tag, mult: demand(tag, now), why: WHY[tag] })).sort((a, b) => b.mult - a.mult);
}

/** ▲ rising, ▼ falling, • flat: compares demand now with a minute ago. */
export function trend(code: string, now: number): 'up' | 'down' | 'flat' {
  const a = priceOf(code, now);
  const b = priceOf(code, now - 60_000);
  return a > b ? 'up' : a < b ? 'down' : 'flat';
}

const RARITY_PRICE: Record<string, number> = { common: 18, uncommon: 30, rare: 60, myth: 140 };
const SIZE_PRICE: Record<string, number> = { tiny: 0.8, small: 0.9, medium: 1, large: 1.2, huge: 1.4, giant: 1.6 };
const STAGE_PRICE: Record<string, number> = { fry: 0.35, juvenile: 0.65, adult: 1, elder: 0.9 };

export function priceOf(code: string, now: number): number {
  const g = genomeOf(code);
  const e = ecoOf(code);
  let p = (RARITY_PRICE[g.rarity] ?? 18) * (SIZE_PRICE[g.size] ?? 1) * (STAGE_PRICE[g.stage] ?? 1);
  p *= 1 + 0.1 * Math.min(10, generationOf(g));
  if (g.hybrid !== 'none') p *= 1.5;
  p *= 1.1 ** [g.geneA, g.geneB].filter((a) => a !== 'wild').length;
  const tags = [e.diet, e.temp, e.salinity].filter((t) => MARKET_TAGS.includes(t));
  const mult = tags.length ? tags.reduce((s, t) => s + demand(t, now), 0) / tags.length : 1;
  return Math.max(3, Math.round(p * mult));
}

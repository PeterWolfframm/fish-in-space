// Facts about a fish, read off its fish3 code and cached by code.

import fish3 from '@forge/v3/fish/index.js';
import { biomeById, condOf, type Biome } from './biomes';
import type { Req, Stage } from './types';

export const fish = fish3 as Fish3;

export interface Fish3 {
  traits: { encode(g: unknown): string; decode(c: string): Genome | null; fieldById(id: string): { choices: { id: string; label: string }[]; default?: string } };
  normalize(g: unknown): Genome;
  fromCode(c: string): Genome;
  fromSeed(s: string): Genome;
  breedDetailed(a: Genome, b: Genome, seed: string): { child: Genome; events: { text: string }[] };
  name(g: Genome): string;
  names(g: Genome): { common?: string; binomial?: string; title?: string | null };
  ecology(g: Genome): Record<string, { value: string }> & { care: { tempC: [number, number] } };
  lore(g: Genome): { quote: string | null; codex?: { key: string; text: string }[] };
  anims: { id: string; frames: number; fps: number }[];
  fpsOf(g: Genome, a: unknown): number;
  frame(g: Genome, anim: string, i: number): { w: number; h: number; data: Uint8Array | number[]; palette: number[][] };
}

export interface Genome {
  sex: 'm' | 'f';
  stage: Stage;
  rarity: 'common' | 'uncommon' | 'rare' | 'myth';
  size: string;
  body: string;
  hybrid: string;
  geneA: string;
  geneB: string;
  generation: string;
  [k: string]: unknown;
}

export interface Eco {
  salinity: string;
  temp: string;
  depth: string;
  diet: string;
  level: string;
  sociality: string;
  temperament: string;
  activity: string;
  care: { tempC: [number, number] };
}

const genomeCache = new Map<string, Genome>();
const ecoCache = new Map<string, Eco>();
function remember<V>(map: Map<string, V>, k: string, v: V): V {
  if (map.size > 600) map.clear();
  map.set(k, v);
  return v;
}

export const genomeOf = (code: string): Genome => genomeCache.get(code) ?? remember(genomeCache, code, fish.normalize(fish.fromCode(code)));
export const codeOf = (g: unknown): string => fish.traits.encode(fish.normalize(g));

const NORM: Record<string, Record<string, string>> = { temp: { polar: 'cold', volcanic: 'tropical' }, depth: { void: 'abyss' } };

/** The ecology values the game plays with, flattened. */
export function ecoOf(code: string): Eco {
  const hit = ecoCache.get(code);
  if (hit) return hit;
  const e = fish.ecology(genomeOf(code));
  const v = (k: string) => NORM[k]?.[e[k].value] ?? e[k].value;
  return remember(ecoCache, code, {
    salinity: v('salinity'), temp: v('temp'), depth: v('depth'), diet: v('diet'), level: v('level'),
    sociality: v('sociality'), temperament: v('temperament'), activity: v('activity'), care: e.care,
  });
}

export const nameOf = (code: string) => fish.name(genomeOf(code));
export const generationOf = (g: Genome) => Number(String(g.generation).slice(1)) || 0;
export const allelesOf = (code: string) => {
  const g = genomeOf(code);
  return [g.geneA, g.geneB];
};
export const stageOf = (code: string): Stage => genomeOf(code).stage;
export const withStage = (code: string, stage: Stage) => codeOf({ ...genomeOf(code), stage });
export const ALLELES = fish.traits.fieldById('geneA').choices.map((c) => c.id).filter((a) => a !== 'wild');

export function fitsBiome(code: string, biome: Biome, phase: number): boolean {
  const c = condOf(biome, phase);
  const e = ecoOf(code);
  return (e.salinity === 'any' || e.salinity === c.salinity) && e.temp === c.temp && (!c.depth || c.depth.includes(e.depth));
}

/** Why a fish can't live in a biome, in a few words, or null if it can. */
export function misfit(code: string, biomeId: string, phase: number): string | null {
  const b = biomeById(biomeId);
  if (!b) return 'nowhere to go';
  const c = condOf(b, phase);
  const e = ecoOf(code);
  if (e.salinity !== 'any' && e.salinity !== c.salinity) return `${c.salinity} water, but it's a ${e.salinity}-water fish`;
  if (e.temp !== c.temp) {
    const order = ['cold', 'temperate', 'tropical'];
    return order.indexOf(c.temp) > order.indexOf(e.temp) ? `too warm for a ${e.temp}-water fish` : `too cold for a ${e.temp}-water fish`;
  }
  if (c.depth && !c.depth.includes(e.depth)) return 'too deep and dark for it';
  return null;
}

/** Does this fish meet one requirement? */
export function meets(code: string, req: Req): boolean {
  if (req.kind === 'eco') {
    const v = (ecoOf(code) as unknown as Record<string, string>)[req.key];
    if (req.key === 'salinity' && v === 'any') return true;
    return Array.isArray(req.value) ? req.value.includes(v) : v === req.value;
  }
  if (req.kind === 'gene') return allelesOf(code).includes(req.allele);
  if (req.kind === 'bred') return generationOf(genomeOf(code)) >= 1;
  if (req.kind === 'adult') return ['adult', 'elder'].includes(stageOf(code));
  return false;
}
export const meetsAll = (code: string, reqs: Req[]) => reqs.every((q) => meets(code, q));
export const score = (code: string, reqs: Req[]) => reqs.filter((q) => meets(code, q)).length;

/** A real fish that suits the biome, from a seed. Tries a few hundred seeds before settling. */
export function rollForBiome(biome: Biome, phase: number, seed: string, stage: Stage = 'juvenile'): string {
  let last = '';
  for (let i = 0; i < 400; i++) {
    const g = fish.fromSeed(`${seed}:${i}`);
    last = codeOf({ ...g, stage });
    if (fitsBiome(last, biome, phase)) return last;
  }
  return last;
}
export const rollWild = (seed: string, stage: Stage = 'juvenile') => codeOf({ ...fish.fromSeed(seed), stage });

export const WORD: Record<string, string> = {
  fresh: 'Fresh', brackish: 'Brackish', marine: 'Marine', cold: 'Cold', temperate: 'Temperate', tropical: 'Tropical',
  twilight: 'Twilight', abyss: 'Abyss', bottom: 'Bottom-dweller', top: 'Surface', mid: 'Midwater', above: 'Leaper',
  school: 'Schooling', pair: 'Pairing', solitary: 'Solitary', warband: 'Warband', retinue: 'Leader',
};
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function reqLabel(q: Req): string {
  if (q.kind === 'gene') return `Carries ${q.allele}`;
  if (q.kind === 'bred') return 'Hatchery-bred';
  if (q.kind === 'adult') return 'Adult';
  if (Array.isArray(q.value)) return 'Deep-water';
  return WORD[q.value] ?? cap(q.value);
}

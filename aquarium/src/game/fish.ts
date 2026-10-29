// Facts about a fish, read off its fish4 code (f4., f3., or v1) and cached by code.

import fish4 from '@forge/v4/fish/index.js';
import { extOf } from '@forge/v4/fish/bodies/index.js';
import { toFish3 } from '@forge/v4/fish/genome.js';
import { phenotype } from '@forge/v3/fish/phenotype.js';
import { biomeById, condOf, type Biome } from './biomes';
import type { Req, Stage } from './types';

/** Pin ecotype rolls to Mirelle's aquarium water (still full fish4 species clustering). */
export const WATER_PLACE = { terrain: 'water' } as const;
/** Colony orders and shop stock: classic fish4 rolls that always fit a biome's water. */
export const BIOME_ROLL = 'classic';

export const fish = fish4 as Fish3;

/** Whether a string is a fish code this build understands. */
export const decodes = (c: unknown) => typeof c === 'string' && Boolean(fish.fromCode(c));

export interface Fish3 {
  traits: {
    fields: { id: string; label?: string; group?: string; choices: { id: string; label?: string }[] }[];
    encode(g: unknown): string;
    decode(c: string): Genome | null;
    fieldById(id: string): { choices: { id: string; label: string }[]; default?: string };
  };
  normalize(g: unknown): Genome;
  fromCode(c: string): Genome;
  fromSeed(s: string, params?: string, place?: Record<string, string>): Genome;
  breedDetailed(a: Genome, b: Genome, seed: string): { child: Genome | null; events: { kind?: string; text: string }[]; problem?: string };
  name(g: Genome): string;
  names(g: Genome): { common: string; binomial: string; title: string | null; full: string };
  ecology(g: Genome): FishEcology;
  lore(g: Genome): FishLore;
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

export interface EcoFact {
  value: string;
}

/** Keeper numbers from the generator: length, tank, temperature, acidity. */
export interface FishCare {
  cm: number;
  group: number;
  litres: number;
  tempC: [number, number];
  pH: [number, number];
}

/** One ecology fact per trait the body decides, plus the care numbers and any signature. */
export interface FishEcology {
  diet: EcoFact;
  feeding: EcoFact;
  level: EcoFact;
  temperament: EcoFact;
  sociality: EcoFact;
  activity: EcoFact;
  depth: EcoFact;
  salinity: EcoFact;
  temp: EcoFact;
  current: EcoFact;
  hardness: EcoFact;
  care: FishCare;
  signature: string;
  relic: string;
  rarity: string;
}

export interface LoreBit {
  key: string;
  text: string;
}

/** The catalogue entry: designation, a quote, three codex lines, a keeper rule, and a legend for the rare. */
export interface FishLore {
  name: string;
  binomial: string;
  designation: string;
  quote: { text: string; by: string; key: string } | null;
  codex: LoreBit[];
  edict: LoreBit;
  legend: LoreBit | null;
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
  const v = (k: 'salinity' | 'temp' | 'depth' | 'diet' | 'level' | 'sociality' | 'temperament' | 'activity') => NORM[k]?.[e[k].value] ?? e[k].value;
  return remember(ecoCache, code, {
    salinity: v('salinity'), temp: v('temp'), depth: v('depth'), diet: v('diet'), level: v('level'),
    sociality: v('sociality'), temperament: v('temperament'), activity: v('activity'), care: e.care,
  });
}

export const nameOf = (code: string) => fish.name(genomeOf(code));

/** Signature / relic label for UI copy (Fish Tinder, dossiers). */
export function signatureLabel(code: string): string {
  const set = fish.normalize(genomeOf(code));
  const ph = phenotype(toFish3(set), extOf(set));
  const label = (field: string, id: string) => fish.traits.fieldById(field).choices.find((c) => c.id === id)?.label ?? id;
  return [ph.relic !== 'none' && label('relic', ph.relic), ph.signature !== 'none' && label('signature', ph.signature)].filter(Boolean).join(' · ');
}
export const generationOf = (g: Genome) => Number(String(g.generation).slice(1)) || 0;
export const allelesOf = (code: string) => {
  const g = genomeOf(code);
  return [g.geneA, g.geneB];
};
export const stageOf = (code: string): Stage => genomeOf(code).stage;
export const withStage = (code: string, stage: Stage) => codeOf({ ...genomeOf(code), stage });
export const withSize = (code: string, size: string) => codeOf({ ...genomeOf(code), size });
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
    const g = fish.fromSeed(`${seed}:${i}`, BIOME_ROLL);
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

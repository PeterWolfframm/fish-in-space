// Generator adapter for the Studio UI — imports live generator source from this repo's src/.

import { GENERATORS, sizeOf, breedWith, fromCode } from '@studio-forge/gen/registry.js';

export type StudioKind = 'fish' | 'plant' | 'pilot' | 'waterplant';

export interface StudioGen {
  id: string;
  label: string;
  game: string;
  family?: string;
  version?: number;
  generation?: string;
  kind: StudioKind;
  bg: string;
  traits: any;
  sizes: { id: string; w: number; h: number }[];
  sizeOf?: (genome: any) => { w: number; h: number };
  anims: { id: string; frames: number; fps: number; continuous?: boolean; label?: string }[];
  options?: any;
  params?: { presets?: Record<string, { id: string; label?: string }>; schema: any[]; groups?: any[]; validate: (p: any) => any; set: (p: any, path: string, v: unknown) => any; resolve: (p?: any) => any; hash: (p: any) => string };
  layers?: { ids: string[]; labelOf?: (id: string) => string };
  fromSeed: (seed: string | number, ...rest: any[]) => any;
  fromCode?: (code: string) => any | null;
  normalize?: (g: any) => any;
  frame: (genome: any, animId: string, i?: number, opts?: any) => any;
  at?: (genome: any, t: number) => any;
  breed?: (a: any, b: any, seed: string | number) => any;
  rarity?: (genome: any) => number;
  fpsOf?: (genome: any, anim: any) => number;
}

const kindOf = (id: string): StudioKind => {
  if (id.startsWith('pilot')) return 'pilot';
  if (id.startsWith('waterplant')) return 'waterplant';
  if (id.startsWith('plant')) return 'plant';
  return 'fish';
};

function adapt(gen: any): StudioGen {
  return { ...gen, sizes: gen.sizes ?? [{ id: 'one', w: gen.size.w, h: gen.size.h }], kind: kindOf(gen.id) };
}

/** Every generator the registry knows, Studio-shaped. */
export const GENS: StudioGen[] = GENERATORS.map(adapt);

export const genById = (id: string): StudioGen | null => GENS.find((g) => g.id === id) ?? null;

export { sizeOf, breedWith, fromCode };

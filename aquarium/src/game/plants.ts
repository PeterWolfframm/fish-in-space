// Tank plants (cosmetic): codes for cuttings and the starter tank. The generators stay untouched.

import waterplant2 from '@forge/v2/waterplant/index.js';
import plant3 from '@forge/v3/plant/index.js';

export type PlantFamily = 'waterplant2' | 'plant3';
interface Gen {
  traits: { encode(g: unknown): string };
  fromSeed(s: string): Record<string, unknown>;
  fromCode(c: string): Record<string, unknown>;
  name?: (g: unknown) => string;
}
export const PLANT_GEN: Record<PlantFamily, Gen> = { waterplant2, plant3 };

export const plantCode = (family: PlantFamily, seed: string, over: Record<string, unknown> = {}) => {
  const gen = PLANT_GEN[family];
  return gen.traits.encode({ ...gen.fromSeed(seed), ...over });
};

export function plantName(family: PlantFamily, code: string): string {
  const gen = PLANT_GEN[family];
  const g = gen.fromCode(code);
  if (gen.name) return gen.name(g);
  const form = String(g.form ?? 'plant');
  return form.charAt(0).toUpperCase() + form.slice(1);
}

export const plantSize = (family: PlantFamily, code: string) => String(PLANT_GEN[family].fromCode(code).size ?? 'medium');

/** Three kelp in the water and two land plants on the dry ledge. */
export function starterPlants(seed: string) {
  return [
    plantCode('waterplant2', `${seed}:kelp0`, { form: 'kelp', size: 'large' }),
    plantCode('waterplant2', `${seed}:kelp1`, { form: 'kelp', size: 'medium' }),
    plantCode('waterplant2', `${seed}:kelp2`, { form: 'kelp', size: 'large' }),
    plantCode('plant3', `${seed}:ledge0`, { size: 'herb' }),
    plantCode('plant3', `${seed}:ledge1`, { size: 'shrub' }),
  ];
}

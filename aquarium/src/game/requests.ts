// Seeding requests. Each comes from a region on Mirelle and is always fillable by a real fish.

import { rng, pick, hash } from './rng';
import { biomeById, condOf } from './biomes';
import { rollForBiome, ecoOf, allelesOf } from './fish';
import type { Order, Region, Req, State } from './types';

export const COLONIES = ['Port Halcyon', 'Tessaly Dome', 'Kettle Hollow', 'Vesper Landing', 'Ardent Reach', 'New Wren', 'Lowmarsh', 'Saltmother Camp'];

/** The colony that sits on a region's shore. */
export const colonyOf = (regionId: string) => COLONIES[hash(`colony:${regionId}`) % COLONIES.length];

const ROLE: Record<string, Record<string, string>> = {
  diet: {
    herbivore: 'Algae mats are smothering the water. Send a grazer.',
    detritivore: 'Dead moss is piling up on the bed. Send a sifter.',
    planktivore: 'A plankton bloom is clouding everything. Send a filter-feeder.',
    piscivore: 'Little fish are booming out of control. The water needs a hunter.',
    carnivore: 'Worm swarms in the silt need eating.',
    omnivore: 'The food web has gaps. Send a generalist.',
    durophage: 'Snails are overrunning the rocks. Send a shell-cracker.',
  },
  level: {
    bottom: 'The bed silt needs stirring.',
    top: 'Surface midges are biting the settlers.',
    mid: 'The open water column is still empty.',
    above: 'Something that can leap the falls is needed.',
  },
  sociality: {
    school: 'Settler kids are asking for a real school of fish.',
    pair: 'The biologists want a nesting pair line.',
    solitary: 'A lone sentinel species is needed for water monitoring.',
    warband: 'Something tough enough to hold territory.',
    retinue: 'A fish that leads others.',
  },
};
const GENE: Record<string, string> = {
  albino: 'Cave lakes have no light: pigment-free genes wanted.',
  leucistic: 'Pale genes for the bright glacier shallows.',
  melanistic: 'UV is still harsh up top. Dark pigment protects.',
  axanthic: 'Blue-shift genes for the mineral-heavy water.',
  ghost: 'Glass-bodied genes, to hide from the new predators.',
  bubble: 'Bubble-eye genes for the sanctuary ponds.',
  xanthic: 'Golden genes for the Accord’s ornamental pools.',
  longfin: 'Long-fin genes for slow, still water.',
  koi: 'Koi-white genes for the settlement temple ponds.',
};

export const liveRegions = (state: State) => state.regions.filter((r) => r.opened);
export const regionById = (state: State, id: string) => state.regions.find((r) => r.id === id);
export const regionLabel = (r: Region) => r.name ?? r.survey;

export function makeOrder(state: State, now: number, seed: string): Order {
  const r = rng(seed);
  const open = liveRegions(state);
  const growing = open.filter((x) => x.life < 100);
  const pool = growing.length ? growing : open;
  const newest = pool.reduce((a, b) => (b.opensAt > a.opensAt ? b : a), pool[0]);
  const region = r() < 0.45 ? newest : pick(r, pool);
  const biome = biomeById(region.biome)!;
  const c = condOf(biome, state.phase);
  const reqs: Req[] = [{ kind: 'eco', key: 'salinity', value: c.salinity }, { kind: 'eco', key: 'temp', value: c.temp }];
  if (c.depth) reqs.push({ kind: 'eco', key: 'depth', value: c.depth });
  const tutorial = state.stats.orders === 0;
  let flavor = `${biome.name}: this water needs its first residents.`;
  if (!tutorial && (state.phase >= 1 || r() < 0.5)) {
    const sample = rollForBiome(biome, state.phase, `${seed}:sample`);
    const key = pick(r, ['diet', 'diet', 'level', 'sociality']);
    const value = (ecoOf(sample) as unknown as Record<string, string>)[key];
    reqs.push({ kind: 'eco', key, value });
    flavor = ROLE[key]?.[value] ?? flavor;
  }
  if (!tutorial && state.phase >= 1 && r() < 0.35) reqs.push({ kind: 'bred' });
  if (!tutorial && state.phase >= 2 && r() < 0.5) {
    const carried = [...new Set(state.fish.flatMap((f) => allelesOf(f.code)).filter((a) => a !== 'wild'))].sort();
    if (carried.length) {
      const allele = pick(r, carried);
      reqs.push({ kind: 'gene', allele });
      flavor = GENE[allele] ?? flavor;
    }
  }
  const extra = reqs.length - 2;
  return {
    id: `o${state.nextId++}`,
    region: region.id,
    biome: region.biome,
    colony: colonyOf(region.id),
    flavor,
    reqs,
    reward: Math.round(45 + 40 * extra + 18 * state.phase + r() * 20),
    bloom: 18 + 14 * extra + 4 * state.phase,
    expires: now + (10 + Math.floor(r() * 10)) * 60_000,
  };
}

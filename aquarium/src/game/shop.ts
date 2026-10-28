// The Roe Counter. Six cryo-drawers restock every orbit, weighted toward open biomes and the next
// forecast. Stock is derived from seed and orbit, so it needs no saving beyond what was bought.

import { DRAWERS, CRATE_EVERY, ROE_THAW, MAX_CAPACITY, ANNEX_BERTHS } from './constants';
import { BIOMES, biomeById, nextNeeds, openBiomes, type Biome } from './biomes';
import { ALLELES, codeOf, genomeOf, rollForBiome, rollWild } from './fish';
import { rng, pick, weighted } from './rng';
import { priceOf } from './market';
import { orbitAt } from './orbit';
import { plantCode, plantName, type PlantFamily } from './plants';
import { addLog, hasRoom, occupied } from './state';
import type { Egg, State } from './types';
import type { Result } from './actions';

export type DrawerKind = 'biome' | 'wild' | 'heritage';
export interface Drawer {
  index: number;
  kind: DrawerKind;
  code: string;
  biome?: string;
  allele?: string;
  cost: number;
  tag: string; // short line Sel says about it
}

const forCond = (c: Biome['conds'][number]): Biome => ({ ...BIOMES[0], id: 'melt', conds: [{ ...c, from: 0 }], opens: 0 });

export function drawers(state: State, orbit: number): Drawer[] {
  const r = rng(`${state.seed}:shop:${orbit}`);
  const open = openBiomes(state.phase);
  const next = nextNeeds(state.phase);
  const undiscovered = ALLELES.filter((a) => !state.fieldNotes.alleles.includes(a));
  const out: Drawer[] = [];
  for (let i = 0; i < DRAWERS; i++) {
    const seed = `${state.seed}:shop:${orbit}:${i}`;
    const kind = weighted(r, ['biome', 'next', 'wild', 'heritage'] as const, (k) =>
      k === 'biome' ? 5 : k === 'next' ? (next.length ? 2 : 0) : k === 'wild' ? 2 : undiscovered.length && state.phase >= 1 ? 1 : 0,
    )!;
    if (kind === 'heritage') {
      const allele = pick(r, undiscovered);
      const b = pick(r, open);
      const code = codeOf({ ...genomeOf(rollForBiome(b, state.phase, seed)), geneA: allele, rarity: 'rare' });
      out.push({ index: i, kind, code, biome: b.id, allele, cost: Math.max(120, priceOf(code, 0) * 2), tag: `Heritage stock. Carries ${allele}; you haven't logged that one.` });
    } else if (kind === 'wild') {
      const code = rollWild(seed);
      out.push({ index: i, kind, code, cost: 15 + 5 * state.phase, tag: 'Unsorted roe from the bottom shelf. Anything goes.' });
    } else {
      const fromNext = kind === 'next';
      const b = fromNext ? forCond(pick(r, next)) : pick(r, open);
      const code = rollForBiome(b, fromNext ? state.phase + 1 : state.phase, seed);
      out.push({
        index: i, kind: 'biome', code, biome: fromNext ? undefined : b.id, cost: 30 + 10 * state.phase,
        tag: fromNext ? 'For what’s coming next phase. The Prof asked me to set some aside.' : `Guaranteed for ${b.name}.`,
      });
    }
  }
  return out;
}

export const currentOrbit = (state: State, now: number) => orbitAt(state.orbitEpoch, now).n;
export const stock = (state: State, now: number) => drawers(state, currentOrbit(state, now)).filter((d) => !(state.shop.orbit === currentOrbit(state, now) && state.shop.sold.includes(d.index)));

function lay(state: State, code: string, now: number, kind: Egg['kind']): Egg {
  const r = rng(`${state.seed}:roe${state.nextId}`);
  const egg: Egg = { id: `e${state.nextId++}`, code, hatchAt: now + ROE_THAW, x: 0.15 + r() * 0.7, laid: now, roe: true, kind };
  state.eggs.push(egg);
  return egg;
}

function syncShop(state: State, now: number) {
  const n = currentOrbit(state, now);
  if (state.shop.orbit !== n) state.shop = { ...state.shop, orbit: n, sold: [], cuttingsSold: [] };
}

export function buyDrawer(state: State, index: number, now: number): Result<{ egg: Egg; drawer: Drawer }> {
  syncShop(state, now);
  const d = drawers(state, state.shop.orbit)[index];
  if (!d || state.shop.sold.includes(index)) return { error: 'That drawer is empty.' };
  if (state.credits < d.cost) return { error: 'Not enough credits.' };
  if (!hasRoom(state)) return { error: 'The tank is full.' };
  state.credits -= d.cost;
  state.shop.sold.push(index);
  return { egg: lay(state, d.code, now, d.kind === 'heritage' ? 'heritage' : 'roe'), drawer: d };
}

// --- mystery crate ---------------------------------------------------------------------------------

export const CRATE_COST = 140;
export const crateReady = (state: State, now: number) => currentOrbit(state, now) - state.shop.crateOrbit >= CRATE_EVERY;

/** Three roe for open biomes, at least one of them rare or better. */
export function crateContents(state: State, orbit: number): string[] {
  const open = openBiomes(state.phase);
  const r = rng(`${state.seed}:crate:${orbit}`);
  const codes = [0, 1, 2].map((i) => rollForBiome(pick(r, open), state.phase, `${state.seed}:crate:${orbit}:${i}`));
  if (!codes.some((c) => ['rare', 'myth'].includes(genomeOf(c).rarity))) codes[0] = codeOf({ ...genomeOf(codes[0]), rarity: 'rare' });
  return codes;
}

export function buyCrate(state: State, now: number): Result<{ eggs: Egg[] }> {
  syncShop(state, now);
  if (!crateReady(state, now)) return { error: 'Sel is still packing the next crate.' };
  if (state.credits < CRATE_COST) return { error: 'Not enough credits.' };
  if (occupied(state) + 3 > state.capacity) return { error: 'You need three free berths.' };
  state.credits -= CRATE_COST;
  state.shop.crateOrbit = state.shop.orbit;
  const eggs = crateContents(state, state.shop.orbit).map((c) => lay(state, c, now, 'crate'));
  addLog(state, now, '▣', 'Cranked open a mystery crate: three roe.');
  return { eggs };
}

// --- cuttings ----------------------------------------------------------------------------------------

export interface Cutting {
  index: number;
  family: PlantFamily;
  code: string;
  name: string;
  cost: number;
}

export function cuttings(state: State, orbit: number): Cutting[] {
  return [0, 1, 2].map((i) => {
    const family: PlantFamily = i < 2 ? 'waterplant2' : 'plant3';
    const code = plantCode(family, `${state.seed}:cutting:${orbit}:${i}`);
    return { index: i, family, code, name: plantName(family, code), cost: 25 };
  });
}

export function buyCutting(state: State, index: number, now: number): Result<{ cutting: Cutting }> {
  syncShop(state, now);
  const c = cuttings(state, state.shop.orbit)[index];
  if (!c || state.shop.cuttingsSold.includes(index)) return { error: 'Sold out.' };
  if (state.credits < c.cost) return { error: 'Not enough credits.' };
  state.credits -= c.cost;
  state.shop.cuttingsSold.push(index);
  state.ownedCuttings.push({ family: c.family, code: c.code });
  return { cutting: c };
}

/** Put an owned cutting into a decor slot (the old plant goes back to the shelf). */
export function plant(state: State, cuttingIndex: number, slot: number): Result<{ slot: number }> {
  const c = state.ownedCuttings[cuttingIndex];
  if (!c) return { error: 'No such cutting.' };
  const ledge = slot >= 6;
  if (ledge !== (c.family === 'plant3')) return { error: ledge ? 'Only land plants go on the ledge.' : 'Only water plants go in the tank.' };
  state.ownedCuttings.splice(cuttingIndex, 1);
  const old = state.decor.find((d) => d.slot === slot);
  if (old) {
    state.ownedCuttings.push({ family: old.family, code: old.code });
    state.decor.splice(state.decor.indexOf(old), 1);
  }
  state.decor.push({ slot, family: c.family, code: c.code });
  return { slot };
}

// --- upgrades ----------------------------------------------------------------------------------------

export type UpgradeId = 'extend' | 'feeder' | 'heater' | 'annex';
export interface Upgrade {
  id: UpgradeId;
  name: string;
  blurb: string;
  cost: number;
  available: boolean;
  owned: boolean;
}

export function upgrades(state: State): Upgrade[] {
  const u = state.upgrades;
  const room = MAX_CAPACITY - (state.capacity - (u.annex ? ANNEX_BERTHS : 0));
  return [
    { id: 'extend', name: 'Tank extension', blurb: '+4 berths.', cost: 120 + 30 * Math.max(0, state.capacity - 10), available: room > 0, owned: room <= 0 },
    { id: 'feeder', name: 'Auto-feeder', blurb: 'Feeds the whole tank once per orbit.', cost: 220, available: !u.feeder, owned: u.feeder },
    { id: 'heater', name: 'Heated zone', blurb: 'Tropical fish keep growing at full speed even when hungry.', cost: 260, available: !u.heater && state.phase >= 2, owned: u.heater },
    { id: 'annex', name: 'Annex tank', blurb: `A second tank: +${ANNEX_BERTHS} berths.`, cost: 600, available: !u.annex && state.phase >= 4, owned: u.annex },
  ];
}

export function buyUpgrade(state: State, id: UpgradeId, now: number): Result<{ upgrade: Upgrade }> {
  const up = upgrades(state).find((x) => x.id === id);
  if (!up || !up.available) return { error: 'Not available.' };
  if (state.credits < up.cost) return { error: 'Not enough credits.' };
  state.credits -= up.cost;
  if (id === 'extend') state.capacity += 4;
  if (id === 'feeder') state.upgrades.feeder = true;
  if (id === 'heater') state.upgrades.heater = true;
  if (id === 'annex') {
    state.upgrades.annex = true;
    state.capacity += ANNEX_BERTHS;
  }
  addLog(state, now, '⚒', `${up.name} installed.`);
  return { upgrade: up };
}

export const biomeName = (id?: string) => (id ? biomeById(id)?.name ?? id : 'Any water');

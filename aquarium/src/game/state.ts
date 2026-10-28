// A new game, the save format and its migrations. Plain functions over plain JSON.

import { BASE_CAPACITY, GROW, SAVE_VERSION, START_CREDITS, MAX_CAPACITY, AMBIENT_MIN } from './constants';
import { BIOMES, PHASES, PLANET, biomeById } from './biomes';
import { codeOf, fish, genomeOf, rollForBiome, rollWild, stageOf, allelesOf } from './fish';
import { rng } from './rng';
import { planetRegions } from '../planet/gen';
import { regionNames } from '../content/names';
import { starterPlants } from './plants';
import type { Fish, Region, State, Stage } from './types';

/** Plant slots: 0..5 sit on the sand inside the tank, 6..7 on the dry ledge behind the glass. */
export const WATER_SLOTS = [0, 1, 2, 3, 4, 5];
export const LEDGE_SLOTS = [6, 7];

export const PLANET_SEED = 'mirelle';
export const LEGACY_SAVE_KEY = 'seedfall-save-v1';

export function addLog(state: State, now: number, icon: string, text: string) {
  state.log.unshift({ t: now, icon, text });
  if (state.log.length > 80) state.log.length = 80;
}

export const occupied = (state: State) => state.fish.length + state.eggs.length;
export const hasRoom = (state: State) => occupied(state) < state.capacity;
export const isAdult = (f: Fish) => ['adult', 'elder'].includes(stageOf(f.code));

const STAGE_GROWTH: Record<Stage, number> = { fry: 0, juvenile: GROW.juvenile, adult: GROW.adult, elder: GROW.elder };

export function newFish(state: State, code: string, now: number, extra: Partial<Fish> = {}): Fish {
  return { id: `f${state.nextId++}`, code, growth: STAGE_GROWTH[stageOf(code)], hunger: 0.3, spawnReadyAt: now, born: now, ...extra };
}

/** Write what this fish shows into the Field Notes. Returns what was new. */
export function noteFish(state: State, code: string): { what: 'allele' | 'species'; id: string }[] {
  const g = genomeOf(code);
  const out: { what: 'allele' | 'species'; id: string }[] = [];
  const species = fish.names(g).common ?? g.body;
  const n = state.fieldNotes;
  if (!n.species.includes(species)) {
    n.species.push(species);
    out.push({ what: 'species', id: species });
  }
  if (!n.bodies.includes(g.body)) n.bodies.push(g.body);
  for (const a of allelesOf(code)) {
    if (a === 'wild' || n.alleles.includes(a)) continue;
    n.alleles.push(a);
    out.push({ what: 'allele', id: a });
  }
  return out;
}

/** The planet's regions as game state, all closed and lifeless. */
export function freshRegions(planet = PLANET_SEED): Region[] {
  return planetRegions(planet).map((r) => ({
    id: r.id, biome: r.biome, opensAt: r.opensAt, lon: r.lon, lat: r.lat, area: r.area, survey: r.survey,
    opened: false, life: 0, delivered: 0, name: null, poll: null,
  }));
}

export const namesOf = (state: State): Record<string, string[]> => regionNames(state.planet, state.regions);

/** Open every region whose phase has come. Returns the newly opened. */
export function openRegions(state: State, now: number): Region[] {
  const names = namesOf(state);
  const opened: Region[] = [];
  for (const r of state.regions) {
    if (r.opened || r.opensAt > state.phase) continue;
    r.opened = true;
    r.poll = { options: (names[r.id] ?? []).map((name, i) => ({ id: `${r.id}:n${i}`, name })), openedAt: now, tokens: 0, spent: {} };
    opened.push(r);
  }
  return opened;
}

export function newGame(now: number, seed = String(now)): State {
  const state: State = {
    v: SAVE_VERSION, seed, planet: PLANET_SEED, nextId: 1, credits: START_CREDITS, phase: 0, bloom: 0, biomeBloom: {},
    capacity: BASE_CAPACITY, fish: [], eggs: [], orders: [], nextOrderAt: now + 4_000, log: [],
    stats: { orders: 0, bred: 0, sold: 0, seeded: 0, hatched: 0, cleanDrops: 0 },
    lastTick: now, playMs: 0, orbitEpoch: now,
    regions: freshRegions(),
    story: { chapter: 0, seen: [], flags: {}, work: null },
    comms: { log: [], recent: {}, lastCaller: null, nextAmbientAt: AMBIENT_MIN, lastAmbientId: null },
    shop: { orbit: 1, sold: [], crateOrbit: -99, cuttingsSold: [] },
    decor: starterPlants(seed).map((code, i) => ({ slot: [1, 3, 5, LEDGE_SLOTS[0], LEDGE_SLOTS[1]][i], family: i < 3 ? 'waterplant2' : 'plant3', code })),
    ownedCuttings: [],
    upgrades: { feeder: false, heater: false, annex: false, feederOrbit: 0 },
    fieldNotes: { species: [], bodies: [], alleles: [], regions: [], lore: [] },
    patches: [],
    settings: { muted: false, batterySaver: false, shortPods: false },
  };
  const melt = BIOMES[0];
  // Two lake fish of each sex so the first pairing is possible, plus one wildcard.
  (['m', 'f', 'm', 'f'] as const).forEach((sex, i) => {
    const code = rollForBiome(melt, 0, `${seed}:start${i}`, 'adult');
    state.fish.push(newFish(state, codeOf({ ...genomeOf(code), sex }), now));
  });
  state.fish.push(newFish(state, rollWild(`${seed}:start-wild`, 'adult'), now));
  for (const f of state.fish) noteFish(state, f.code);
  openRegions(state, now);
  addLog(state, now, '✦', PHASES[0].story);
  return state;
}

// --- save -----------------------------------------------------------------------------------------

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const decodes = (c: unknown) => {
  try {
    return typeof c === 'string' && Boolean(fish.traits.decode(c));
  } catch {
    return false;
  }
};

/** A v1 (v2 vanilla build) save brought forward: each old biome's bloom goes to its first region. */
function migrateV1(s: Json, now: number): Json {
  const fresh = newGame(num(s.lastTick) ? s.lastTick : now, typeof s.seed === 'string' ? s.seed : String(now));
  const biomeBloom = isObj(s.biomeBloom) ? (s.biomeBloom as Record<string, number>) : {};
  const out: State = {
    ...fresh,
    credits: s.credits as number,
    phase: s.phase as number,
    bloom: num(s.bloom) ? s.bloom : 0,
    biomeBloom,
    capacity: num(s.capacity) ? s.capacity : BASE_CAPACITY,
    fish: s.fish as Fish[],
    eggs: s.eggs as State['eggs'],
    orders: [],
    nextOrderAt: now,
    log: Array.isArray(s.log) ? (s.log as State['log']) : [],
    stats: { ...fresh.stats, ...(isObj(s.stats) ? s.stats : {}) },
    nextId: num(s.nextId) ? s.nextId : fresh.nextId,
  };
  out.phase = Math.max(0, Math.min(PHASES.length - 1, Math.floor(out.phase)));
  out.regions.forEach((r) => (r.opened = false));
  openRegions(out, now);
  for (const b of BIOMES) {
    const first = out.regions.find((r) => r.biome === b.id && r.opened);
    if (first && biomeBloom[b.id]) first.life = Math.min(99, Math.round(biomeBloom[b.id] * 0.6));
  }
  out.fieldNotes = { species: [], bodies: [], alleles: [], regions: [], lore: [] };
  for (const f of out.fish) if (decodes(f.code)) noteFish(out, f.code);
  out.story.chapter = out.phase;
  out.story.seen = ['intro', 'onboard-done'];
  return out as unknown as Json;
}

/** A saved state if it is sound (migrating old versions), else null. Drops fish whose codes no longer decode. */
export function restore(raw: unknown, now = Date.now()): State | null {
  let s: unknown;
  try {
    s = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!isObj(s) || !num(s.credits) || !num(s.phase) || !Array.isArray(s.fish)) return null;
  if (!Array.isArray(s.eggs) || !Array.isArray(s.orders) || !isObj(s.stats) || !num(s.lastTick)) return null;
  s = structuredClone(s) as Json;
  if ((s as Json).v === 1) s = migrateV1(s as Json, now);
  const st = s as unknown as State;
  if (st.v !== SAVE_VERSION || !Array.isArray(st.regions)) return null;
  st.fish = st.fish.filter((f) => isObj(f) && decodes(f.code) && num(f.growth));
  st.eggs = st.eggs.filter((e) => isObj(e) && decodes(e.code) && num(e.hatchAt));
  st.orders = st.orders.filter((o) => isObj(o) && Array.isArray(o.reqs) && biomeById(o.biome) && st.regions.some((r) => r.id === o.region));
  st.phase = Math.max(0, Math.min(PHASES.length - 1, Math.floor(st.phase)));
  st.capacity = Math.max(1, Math.min(MAX_CAPACITY + 8, num(st.capacity) ? st.capacity : BASE_CAPACITY));
  st.log = Array.isArray(st.log) ? st.log.slice(0, 80) : [];
  st.planet ||= PLANET_SEED;
  return st;
}

export const PLANET_NAME = PLANET;
export const seedRng = (state: State, tag: string) => rng(`${state.seed}:${tag}:${state.nextId}`);

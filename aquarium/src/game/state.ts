// A new game, the save format and its migrations. Plain functions over plain JSON.

import { BASE_CAPACITY, GROW, SAVE_VERSION, START_CREDITS, AMBIENT_MIN, ANNEX_BERTHS, TANK_CAPACITY } from './constants';
import { BIOMES, PHASES, PLANET, biomeById } from './biomes';
import { codeOf, ecoOf, fish, genomeOf, nameOf, rollForBiome, rollWild, stageOf, allelesOf } from './fish';
import { rng } from './rng';
import { planetRegions } from '../planet/gen';
import { regionNames } from '../content/names';
import { plantCode, starterPlants } from './plants';
import { sanePins } from './pins';
import type { DecorSlot, Fish, Region, State, Stage, Tank } from './types';

/** Plant slots: 0..5 sit on the sand inside the tank, 6..9 on the lit shelf behind the glass. */
export const WATER_SLOTS = [0, 1, 2, 3, 4, 5];
export const SHELF_SLOTS = [6, 7, 8, 9];
/** @deprecated use SHELF_SLOTS; kept so older imports still compile. */
export const LEDGE_SLOTS = SHELF_SLOTS;

export const PLANET_SEED = 'mirelle';
export const LEGACY_SAVE_KEY = 'seedfall-save-v1';

export function addLog(state: State, now: number, icon: string, text: string) {
  state.log.unshift({ t: now, icon, text });
  if (state.log.length > 80) state.log.length = 80;
}

/** How many berths a tank has: its shape's base, plus (tank 1 only) bought extensions. */
export function tankCapacity(state: State, tankId: string): number {
  const t = state.tanks.find((x) => x.id === tankId);
  if (!t) return 0;
  const u = state.upgrades;
  const bonus = tankId === 'T1' ? (u.annex ? ANNEX_BERTHS : 0) + u.extendBerths : 0;
  return TANK_CAPACITY[t.shape] + bonus;
}
export const totalCapacity = (state: State) => state.tanks.reduce((sum, t) => sum + tankCapacity(state, t.id), 0);

/** Fish and eggs in a tank (or everywhere, with no tankId). */
export const occupied = (state: State, tankId?: string) =>
  tankId == null
    ? state.fish.length + state.eggs.length
    : state.fish.filter((f) => f.tank === tankId).length + state.eggs.filter((e) => e.tank === tankId).length;
export const hasRoom = (state: State, tankId?: string) =>
  tankId == null ? occupied(state) < state.capacity : occupied(state, tankId) < tankCapacity(state, tankId);
export const isAdult = (f: Fish) => ['adult', 'elder'].includes(stageOf(f.code));

/** A fish's display name: its fixed-name override (e.g. Jerry) if it has one, else its generated name. */
export const fishName = (f: Fish) => f.name ?? nameOf(f.code);

const STAGE_GROWTH: Record<Stage, number> = { fry: 0, juvenile: GROW.juvenile, adult: GROW.adult, elder: GROW.elder };

export function newFish(state: State, code: string, now: number, tank: string, extra: Partial<Omit<Fish, 'tank'>> = {}): Fish {
  return { id: `f${state.nextId++}`, code, tank, growth: STAGE_GROWTH[stageOf(code)], hunger: 0.3, spawnReadyAt: now, born: now, ...extra };
}

/** Roll a wild adult fish, trying a little harder for a solitary temperament (that's Jerry's whole personality). */
function rollSolitary(seed: string): string {
  let last = '';
  for (let i = 0; i < 50; i++) {
    last = rollWild(`${seed}:${i}`, 'adult');
    if (ecoOf(last).sociality === 'solitary') return last;
  }
  return last;
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
  const tanks: Tank[] = [
    { id: 'T1', name: 'Tank One', shape: '1x2', slot: { x: 0, y: 0 } },
    { id: 'T2', name: "Jerry's Tank", shape: '1x1', slot: { x: 1, y: 0 } },
  ];
  const state: State = {
    v: SAVE_VERSION, seed, planet: PLANET_SEED, nextId: 1, credits: START_CREDITS, phase: 0, bloom: 0, biomeBloom: {},
    capacity: 0, tanks, fish: [], eggs: [], orders: [], nextOrderAt: now + 4_000, log: [],
    stats: { orders: 0, bred: 0, sold: 0, seeded: 0, hatched: 0, cleanDrops: 0 },
    lastTick: now, playMs: 0, orbitEpoch: now,
    regions: freshRegions(),
    story: { chapter: 0, seen: [], flags: {}, work: null },
    comms: { log: [], recent: {}, lastCaller: null, nextAmbientAt: AMBIENT_MIN, lastAmbientId: null },
    shop: { orbit: 1, sold: [], crateOrbit: -99, cuttingsSold: [] },
    decor: [
      ...starterPlants(seed).map((code, i): DecorSlot => ({
        slot: [1, 3, 5, SHELF_SLOTS[0], SHELF_SLOTS[1]][i], tank: 'T1', family: i < 3 ? 'waterplant2' : 'plant3', code,
      })),
      { slot: 1, tank: 'T2', family: 'waterplant2', code: plantCode('waterplant2', `${seed}:jerry-plant`, { form: 'kelp', size: 'small' }) },
    ],
    ownedCuttings: [],
    upgrades: { feeder: false, heater: false, annex: false, feederOrbit: 0, extendBerths: 0 },
    fieldNotes: { species: [], bodies: [], alleles: [], regions: [], lore: [] },
    patches: [],
    pins: [],
    settings: { muted: false, batterySaver: false, shortPods: false, uiScale: 1, tankMenuEdge: 'right' },
  };
  state.capacity = totalCapacity(state);
  const melt = BIOMES[0];
  // Two lake fish of each sex so the first pairing is possible, plus one wildcard, all in tank 1.
  (['m', 'f', 'm', 'f'] as const).forEach((sex, i) => {
    const code = rollForBiome(melt, 0, `${seed}:start${i}`, 'adult');
    state.fish.push(newFish(state, codeOf({ ...genomeOf(code), sex }), now, 'T1', { origin: 'starter' }));
  });
  state.fish.push(newFish(state, rollWild(`${seed}:start-wild`, 'adult'), now, 'T1', { origin: 'starter' }));
  // Tank 2 holds just Jerry: a solitary fixed-name fish who likes his own company.
  state.fish.push(newFish(state, rollSolitary(`${seed}:jerry`), now, 'T2', { name: 'Jerry', origin: 'starter' }));
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
    fish: (s.fish as Fish[]).map((f) => ({ ...f, tank: 'T1' })),
    eggs: (s.eggs as State['eggs']).map((e) => ({ ...e, tank: 'T1' })),
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

const UI_SCALES = [1, 1.15, 1.3, 1.5];

/** A v3 save brought forward: everything it had lands in one tank 1 ('1x2'), and any region the planet
 * gained since (e.g. the Open Sea) is appended, closed, so `openRegions` can open it on schedule. */
function migrateV3(s: Json, now: number): Json {
  const annex = isObj(s.upgrades) && Boolean((s.upgrades as Json).annex);
  const oldCapacity = num(s.capacity) ? s.capacity : BASE_CAPACITY;
  const extendBerths = Math.max(0, oldCapacity - TANK_CAPACITY['1x2'] - (annex ? ANNEX_BERTHS : 0));
  const tanks: Tank[] = [{ id: 'T1', name: 'Tank One', shape: '1x2', slot: { x: 0, y: 0 } }];
  const planet = typeof s.planet === 'string' ? s.planet : PLANET_SEED;
  const oldSettings = isObj(s.settings) ? s.settings : {};
  const oldUpgrades = isObj(s.upgrades) ? s.upgrades : {};
  const existingRegionIds = new Set((Array.isArray(s.regions) ? s.regions : []).map((r) => (isObj(r) ? r.id : null)));
  const newRegions = freshRegions(planet).filter((r) => !existingRegionIds.has(r.id));
  const out: Json = {
    ...s,
    v: SAVE_VERSION,
    tanks,
    capacity: TANK_CAPACITY['1x2'] + extendBerths + (annex ? ANNEX_BERTHS : 0),
    fish: (Array.isArray(s.fish) ? s.fish : []).map((f) => ({ ...(f as object), tank: 'T1' })),
    eggs: (Array.isArray(s.eggs) ? s.eggs : []).map((e) => ({ ...(e as object), tank: 'T1' })),
    decor: (Array.isArray(s.decor) ? s.decor : []).map((d) => ({ ...(d as object), tank: 'T1' })),
    upgrades: { feeder: false, heater: false, feederOrbit: 0, ...oldUpgrades, annex, extendBerths },
    settings: { muted: false, batterySaver: false, shortPods: false, uiScale: 1, tankMenuEdge: 'right', ...oldSettings },
    regions: [...(Array.isArray(s.regions) ? s.regions : []), ...newRegions],
  };
  openRegions(out as unknown as State, now);
  return out;
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
  else if ((s as Json).v === 3) s = migrateV3(s as Json, now);
  const st = s as unknown as State;
  if (st.v !== SAVE_VERSION || !Array.isArray(st.regions)) return null;
  st.fish = st.fish.filter((f) => isObj(f) && decodes(f.code) && num(f.growth));
  st.eggs = st.eggs.filter((e) => isObj(e) && decodes(e.code) && num(e.hatchAt));
  st.orders = st.orders.filter((o) => isObj(o) && Array.isArray(o.reqs) && biomeById(o.biome) && st.regions.some((r) => r.id === o.region));
  st.phase = Math.max(0, Math.min(PHASES.length - 1, Math.floor(st.phase)));
  if (!Array.isArray(st.tanks) || !st.tanks.length) st.tanks = [{ id: 'T1', name: 'Tank One', shape: '1x2', slot: { x: 0, y: 0 } }];
  for (const f of st.fish) if (!st.tanks.some((t) => t.id === f.tank)) f.tank = st.tanks[0].id;
  for (const e of st.eggs) if (!st.tanks.some((t) => t.id === e.tank)) e.tank = st.tanks[0].id;
  st.decor = Array.isArray(st.decor) ? st.decor : [];
  for (const d of st.decor) if (!st.tanks.some((t) => t.id === d.tank)) d.tank = st.tanks[0].id;
  st.upgrades.extendBerths ??= 0;
  st.pins = sanePins(st.pins, st.tanks);
  st.capacity = Math.max(1, num(st.capacity) ? st.capacity : totalCapacity(st));
  if (!UI_SCALES.includes(st.settings?.uiScale)) st.settings.uiScale = 1;
  st.log = Array.isArray(st.log) ? st.log.slice(0, 80) : [];
  st.planet ||= PLANET_SEED;
  return st;
}

export const PLANET_NAME = PLANET;
export const seedRng = (state: State, tag: string) => rng(`${state.seed}:${tag}:${state.nextId}`);

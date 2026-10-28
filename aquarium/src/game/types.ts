// The shapes of the saved game. Everything here is plain JSON so it saves, clones and migrates.

export type Salinity = 'fresh' | 'brackish' | 'marine' | 'any';
export type Temp = 'cold' | 'temperate' | 'tropical';
export type BiomeId = 'melt' | 'river' | 'delta' | 'reef' | 'trench';
export type Stage = 'fry' | 'juvenile' | 'adult' | 'elder';

export interface Fish {
  id: string;
  code: string;
  growth: number; // seconds of growth so far
  hunger: number; // 0 fed .. 1 starving
  spawnReadyAt: number;
  born: number;
  x?: number; // where it hatched, 0..1 across the tank
}

export interface Egg {
  id: string;
  code: string;
  hatchAt: number;
  laid: number;
  x: number;
  roe?: boolean;
  kind?: 'roe' | 'heritage' | 'crate';
}

export type Req =
  | { kind: 'eco'; key: string; value: string | string[] }
  | { kind: 'gene'; allele: string }
  | { kind: 'bred' }
  | { kind: 'adult' };

export interface Order {
  id: string;
  region: string;
  biome: BiomeId;
  colony: string;
  flavor: string;
  reqs: Req[];
  reward: number;
  bloom: number;
  expires: number;
  work?: string; // a side work order from the cast
}

export interface PollOption {
  id: string;
  name: string;
}

export interface Poll {
  options: PollOption[];
  openedAt: number;
  tokens: number; // unspent vote tokens the player holds for this region
  spent: Record<string, number>; // the player's votes, by option id (mirrors the backend; used for tie-breaks)
}

export interface Region {
  id: string;
  biome: BiomeId;
  opensAt: number; // phase
  lon: number; // centroid longitude 0..1, for launch windows
  lat: number; // centroid latitude -1..1
  area: number;
  survey: string; // provisional label until it is named
  opened: boolean;
  life: number; // 0..100
  delivered: number;
  name: string | null;
  poll: Poll | null;
}

export interface LogLine {
  t: number;
  icon: string;
  text: string;
}

export interface CommsLogEntry {
  id: string;
  at: number;
  orbit: number;
  panels: Panel[];
  choice?: string;
}

export interface Panel {
  who: string;
  mood?: string;
  text: string;
  side?: 'left' | 'right';
}

export interface ShopState {
  orbit: number; // the orbit the stock belongs to
  sold: number[]; // drawer indices bought this orbit
  crateOrbit: number; // last orbit a crate was bought
  cuttingsSold: number[];
}

export interface DecorSlot {
  slot: number;
  family: 'waterplant2' | 'plant3';
  code: string;
}

export interface Settings {
  muted: boolean;
  batterySaver: boolean;
  shortPods: boolean;
}

export interface Upgrades {
  feeder: boolean;
  heater: boolean;
  annex: boolean;
  feederOrbit: number;
}

export interface FieldNotes {
  species: string[]; // fish common names seen
  bodies: string[];
  alleles: string[];
  regions: string[]; // region ids named
  lore: string[]; // comms entry ids heard
}

export interface State {
  v: number;
  seed: string;
  planet: string;
  nextId: number;
  credits: number;
  phase: number;
  bloom: number;
  biomeBloom: Record<string, number>;
  capacity: number;
  fish: Fish[];
  eggs: Egg[];
  orders: Order[];
  nextOrderAt: number;
  log: LogLine[];
  stats: { orders: number; bred: number; sold: number; seeded: number; hatched: number; cleanDrops: number };
  lastTick: number;
  playMs: number; // active (visible) play time
  orbitEpoch: number;
  regions: Region[];
  story: { chapter: number; seen: string[]; flags: Record<string, boolean | number>; work: string | null };
  comms: { log: CommsLogEntry[]; recent: Record<string, number>; lastCaller: string | null; nextAmbientAt: number; lastAmbientId: string | null };
  shop: ShopState;
  decor: DecorSlot[];
  ownedCuttings: { family: 'waterplant2' | 'plant3'; code: string }[];
  upgrades: Upgrades;
  fieldNotes: FieldNotes;
  patches: string[];
  settings: Settings;
}

export type GameEvent =
  | { kind: 'grew'; fish: Fish; stage: Stage }
  | { kind: 'hatched'; fish: Fish; roe?: boolean; egg: Egg }
  | { kind: 'order'; order: Order }
  | { kind: 'expired'; order: Order }
  | { kind: 'phase'; phase: number }
  | { kind: 'regionOpened'; region: Region }
  | { kind: 'regionReady'; region: Region }
  | { kind: 'regionNamed'; region: Region; name: string }
  | { kind: 'restock'; orbit: number }
  | { kind: 'autofed'; n: number }
  | { kind: 'discovered'; what: 'allele' | 'species'; id: string };

// The backend seam. Game code talks to `Backend` only; LocalBackend (idb-keyval + SimPolls) is the
// one in use. A PocketBase backend can replace it later without touching UI or rules.

import { get, set } from 'idb-keyval';
import { simTally } from '../game/polls';
import { headlines, type Headline } from '../game/market';
import type { State } from '../game/types';

export type Tally = Record<string, number>;

export interface PollInfo {
  optionIds: string[];
  openedAt: number;
}

export interface Backend {
  save: { load(): Promise<unknown | null>; store(s: State): Promise<void>; legacy?(): unknown | null; clear?(): Promise<void> };
  polls: {
    /** Announce a poll so the backend can tally it (the region opened). */
    open(regionId: string, info: PollInfo): void;
    watch(regionId: string, cb: (tally: Tally) => void): () => void;
    vote(regionId: string, nameId: string, weight: number): Promise<void>;
  };
  market?: { headlines(now: number): Promise<Headline[]> };
}

const SAVE_KEY = 'seedfall-v3';
const VOTES_KEY = 'seedfall-v3-votes';
const LEGACY_KEY = 'seedfall-save-v1';

/** NPC stream plus the player's own votes (persisted). Ticks watchers every few seconds. */
export class SimPolls {
  private info = new Map<string, PollInfo>();
  private mine: Record<string, Tally> = {};
  private watchers = new Map<string, Set<(t: Tally) => void>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private now: () => number;
  private persist: (v: Record<string, Tally>) => void;

  constructor(opts: { now?: () => number; mine?: Record<string, Tally>; persist?: (v: Record<string, Tally>) => void } = {}) {
    this.now = opts.now ?? Date.now;
    this.mine = opts.mine ?? {};
    this.persist = opts.persist ?? (() => {});
  }

  load(mine: Record<string, Tally>) {
    this.mine = { ...mine, ...this.mine };
  }

  open(regionId: string, info: PollInfo) {
    this.info.set(regionId, info);
  }

  tally(regionId: string): Tally {
    const info = this.info.get(regionId);
    if (!info) return {};
    const t = simTally(regionId, info.optionIds, info.openedAt, this.now());
    for (const [id, n] of Object.entries(this.mine[regionId] ?? {})) t[id] = (t[id] ?? 0) + n;
    return t;
  }

  watch(regionId: string, cb: (t: Tally) => void): () => void {
    let set = this.watchers.get(regionId);
    if (!set) this.watchers.set(regionId, (set = new Set()));
    set.add(cb);
    queueMicrotask(() => cb(this.tally(regionId)));
    if (!this.timer && typeof setInterval !== 'undefined') this.timer = setInterval(() => this.emit(), 3000);
    return () => {
      set!.delete(cb);
      if (![...this.watchers.values()].some((s) => s.size) && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  async vote(regionId: string, nameId: string, weight: number) {
    const r = (this.mine[regionId] ??= {});
    r[nameId] = (r[nameId] ?? 0) + weight;
    this.persist(this.mine);
    this.emit(regionId);
  }

  private emit(only?: string) {
    for (const [id, set] of this.watchers) if (!only || only === id) for (const cb of set) cb(this.tally(id));
  }
}

export class LocalBackend implements Backend {
  private sim = new SimPolls({ persist: (v) => void set(VOTES_KEY, v).catch(() => {}) });
  save = {
    load: async () => {
      const [s, votes] = await Promise.all([get(SAVE_KEY), get(VOTES_KEY)]);
      if (votes) this.sim.load(votes as Record<string, Tally>);
      return s ?? null;
    },
    store: (s: State) => set(SAVE_KEY, s),
    legacy: () => {
      try {
        return localStorage.getItem(LEGACY_KEY);
      } catch {
        return null;
      }
    },
    clear: async () => {
      await set(SAVE_KEY, undefined);
      await set(VOTES_KEY, undefined);
    },
  };
  polls = {
    open: (id: string, info: PollInfo) => this.sim.open(id, info),
    watch: (id: string, cb: (t: Tally) => void) => this.sim.watch(id, cb),
    vote: (id: string, nameId: string, weight: number) => this.sim.vote(id, nameId, weight),
  };
  market = { headlines: async (now: number) => headlines(now) };
}

/** An in-memory backend for tests: same interface, no IndexedDB. */
export class MemoryBackend implements Backend {
  stored: State | null = null;
  sim: SimPolls;
  constructor(now: () => number = Date.now) {
    this.sim = new SimPolls({ now });
  }
  save = {
    load: async () => (this.stored ? structuredClone(this.stored) : null),
    store: async (s: State) => void (this.stored = structuredClone(s)),
  };
  polls = {
    open: (id: string, info: PollInfo) => this.sim.open(id, info),
    watch: (id: string, cb: (t: Tally) => void) => this.sim.watch(id, cb),
    vote: (id: string, nameId: string, weight: number) => this.sim.vote(id, nameId, weight),
  };
}

/** Read a tally once. */
export const tallyOnce = (b: Backend, regionId: string) =>
  new Promise<Tally>((resolve) => {
    const stop = b.polls.watch(regionId, (t) => {
      queueMicrotask(() => stop());
      resolve(t);
    });
  });

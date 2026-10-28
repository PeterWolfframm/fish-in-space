// When comms speak. Ambient chatter is paced by active play time; reactions and beats are immediate.

import { AMBIENT_MAX, AMBIENT_MIN, AMBIENT_REPEAT } from './constants';
import { rng, weighted } from './rng';
import { orbitAt } from './orbit';
import type { CommsLogEntry, State } from './types';
import type { CommsEntry, CommsPanel } from '../content/comms/types';
import { LORE } from '../content/comms/lore';
import { AMBIENT } from '../content/comms/ambient';

export const AMBIENT_POOL: CommsEntry[] = [...LORE, ...AMBIENT];

export const caller = (e: { panels: CommsPanel[] }) => e.panels[0]?.who ?? null;

const eligible = (state: State, e: CommsEntry) =>
  (e.when?.minPhase ?? 0) <= state.phase &&
  (e.when?.maxPhase ?? 99) >= state.phase &&
  (!e.when?.biome || state.regions.some((r) => r.opened && r.biome === e.when!.biome));

/**
 * The ambient entry to play now, or null. `busy` is true during a pairing, launch or briefing.
 * Never the same caller twice in a row, never the same entry within 30 minutes of play.
 */
export function pickAmbient(state: State, busy: boolean, pool = AMBIENT_POOL): CommsEntry | null {
  const c = state.comms;
  if (busy || state.playMs < c.nextAmbientAt) return null;
  const options = pool.filter(
    (e) => eligible(state, e) && caller(e) !== c.lastCaller && (c.recent[e.id] === undefined || state.playMs - c.recent[e.id] >= AMBIENT_REPEAT),
  );
  const r = rng(`${state.seed}:amb:${Math.floor(state.playMs / 1000)}`);
  // Unheard lore first, gently.
  return weighted(r, options, (e) => (e.weight ?? 1) * (e.tags.includes('lore') && !state.fieldNotes.lore.includes(e.id) ? 2 : 1)) ?? null;
}

/** Note that an entry played: log it, set cooldowns. */
export function heard(state: State, e: { id: string; panels: CommsPanel[]; tags?: string[] }, now: number, ambient = false): CommsLogEntry {
  const c = state.comms;
  const entry: CommsLogEntry = { id: e.id, at: now, orbit: orbitAt(state.orbitEpoch, now).n, panels: e.panels };
  c.log.push(entry);
  if (c.log.length > 200) c.log.splice(0, c.log.length - 200);
  if (ambient) {
    c.recent[e.id] = state.playMs;
    c.lastCaller = caller(e);
    c.lastAmbientId = e.id;
    const r = rng(`${state.seed}:gap:${state.playMs}`);
    c.nextAmbientAt = state.playMs + AMBIENT_MIN + Math.floor(r() * (AMBIENT_MAX - AMBIENT_MIN));
  }
  if (e.tags?.includes('lore') && !state.fieldNotes.lore.includes(e.id)) state.fieldNotes.lore.push(e.id);
  return entry;
}

/** The radio log grouped by orbit, newest orbit first. */
export function logByOrbit(state: State): { orbit: number; entries: CommsLogEntry[] }[] {
  const groups = new Map<number, CommsLogEntry[]>();
  for (const e of state.comms.log) groups.set(e.orbit, [...(groups.get(e.orbit) ?? []), e]);
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([orbit, entries]) => ({ orbit, entries }));
}

// Things the player does. Each takes the state draft and returns what happened (or an error).

import { EGG_HATCH, SPAWN_COOLDOWN, WINDOW_BONUS, LIFE_MAX } from './constants';
import { PHASES } from './biomes';
import { codeOf, fish, genomeOf, meetsAll, misfit, nameOf } from './fish';
import { rng } from './rng';
import { priceOf } from './market';
import { orbitAt, inWindow } from './orbit';
import { localTally, winner } from './polls';
import { regionById, regionLabel } from './requests';
import { addLog, hasRoom, isAdult, openRegions } from './state';
import type { Egg, Fish, GameEvent, Order, Region, State } from './types';

export type Result<T> = ({ error?: undefined } & T) | { error: string };
export const failed = (r: { error?: string }): r is { error: string } => typeof r.error === 'string';

export function feed(state: State, fishId: string, amount = 0.25) {
  const f = state.fish.find((x) => x.id === fishId);
  if (f) f.hunger = Math.max(0, f.hunger - amount);
}

export function feedAll(state: State, amount = 0.25) {
  for (const f of state.fish) f.hunger = Math.max(0, f.hunger - amount);
}

/** Why these two can't breed, or null if they can. */
export function breedProblem(state: State, a: Fish | undefined, b: Fish | undefined, now: number): string | null {
  if (!a || !b || a === b) return 'Pick two different fish.';
  if (!isAdult(a) || !isAdult(b)) return 'Both fish need to be adults.';
  if (genomeOf(a.code).sex === genomeOf(b.code).sex) return 'They need to be a male and a female.';
  if (a.spawnReadyAt > now || b.spawnReadyAt > now) return 'One of them is still resting from the last spawn.';
  if (!hasRoom(state)) return 'The tank is full. Sell, seed, or extend the tank.';
  return null;
}

export function breed(state: State, aId: string, bId: string, now: number): Result<{ egg: Egg; events: { text: string }[] }> {
  const a = state.fish.find((f) => f.id === aId);
  const b = state.fish.find((f) => f.id === bId);
  const problem = breedProblem(state, a, b, now);
  if (problem || !a || !b) return { error: problem ?? 'Pick two fish.' };
  const { child, events } = fish.breedDetailed(genomeOf(a.code), genomeOf(b.code), `${state.seed}:brood${state.nextId}`);
  const code = codeOf({ ...child, stage: 'fry' });
  const r = rng(`${state.seed}:egg${state.nextId}`);
  const egg: Egg = { id: `e${state.nextId++}`, code, hatchAt: now + EGG_HATCH, x: 0.15 + r() * 0.7, laid: now };
  state.eggs.push(egg);
  a.spawnReadyAt = b.spawnReadyAt = now + SPAWN_COOLDOWN;
  state.stats.bred++;
  addLog(state, now, '♡', `${nameOf(a.code)} × ${nameOf(b.code)} spawned.${events.length ? ` ${events.map((e) => e.text).join('; ')}.` : ''}`);
  return { egg, events };
}

/** Add bloom; advance phases and open their regions. */
export function bloomUp(state: State, now: number, biomeId: string, amount: number): GameEvent[] {
  state.bloom += amount;
  state.biomeBloom[biomeId] = (state.biomeBloom[biomeId] ?? 0) + amount;
  const out: GameEvent[] = [];
  while (PHASES[state.phase + 1] && state.bloom >= PHASES[state.phase + 1].bloom) {
    state.phase++;
    addLog(state, now, '✷', `Phase ${state.phase}: ${PHASES[state.phase].name}. ${PHASES[state.phase].story}`);
    out.push({ kind: 'phase', phase: state.phase });
    state.nextOrderAt = Math.min(state.nextOrderAt, now);
    for (const r of openRegions(state, now)) out.push({ kind: 'regionOpened', region: r });
  }
  return out;
}

export interface Drop {
  region: Region;
  life: number;
  clean: boolean;
  tokens: number;
  perfect: boolean;
}

/** Life and vote tokens for a delivery to a region. A launch-window drop earns +25% life. */
function drop(state: State, region: Region, baseLife: number, perfect: boolean, now: number, events: GameEvent[]): Drop {
  const clean = inWindow(region.lon, orbitAt(state.orbitEpoch, now).f);
  const life = Math.round(baseLife * (clean ? WINDOW_BONUS : 1));
  const was = region.life;
  region.life = Math.min(LIFE_MAX, region.life + life);
  region.delivered++;
  const tokens = region.name ? 0 : perfect ? 2 : 1;
  if (region.poll && !region.name) region.poll.tokens += tokens;
  if (clean) state.stats.cleanDrops++;
  if (was < LIFE_MAX && region.life >= LIFE_MAX && !region.name) events.push({ kind: 'regionReady', region });
  return { region, life, clean, tokens, perfect };
}

export function fulfil(state: State, orderId: string, fishId: string, now: number): Result<{ order: Order; fish: Fish; drop: Drop; events: GameEvent[] }> {
  const o = state.orders.find((x) => x.id === orderId);
  const f = state.fish.find((x) => x.id === fishId);
  if (!o || !f) return { error: 'That request or fish is gone.' };
  if (!meetsAll(f.code, o.reqs)) return { error: 'This fish doesn’t meet every requirement.' };
  const region = regionById(state, o.region);
  if (!region) return { error: 'That region is gone.' };
  state.orders.splice(state.orders.indexOf(o), 1);
  state.fish.splice(state.fish.indexOf(f), 1);
  state.credits += o.reward;
  state.stats.orders++;
  state.stats.seeded++;
  const events: GameEvent[] = [];
  const d = drop(state, region, Math.round(o.bloom * 0.8), o.reqs.length >= 3, now, events);
  addLog(state, now, '☄', `${nameOf(f.code)} dropped into ${regionLabel(region)} for ${o.colony}. +${o.reward} ◎, +${o.bloom} bloom.${d.clean ? ' Clean drop!' : ''}`);
  events.push(...bloomUp(state, now, o.biome, o.bloom));
  return { order: o, fish: f, drop: d, events };
}

/** Why a fish can't go to this region right now, or null. */
export function seedProblem(state: State, f: Fish | undefined, region: Region | undefined): string | null {
  if (!f) return 'That fish is gone.';
  if (!region || !region.opened) return 'That region hasn’t opened yet.';
  return misfit(f.code, region.biome, state.phase);
}

export function seedFree(state: State, fishId: string, regionId: string, now: number): Result<{ fish: Fish; bloom: number; drop: Drop; events: GameEvent[] }> {
  const f = state.fish.find((x) => x.id === fishId);
  const region = regionById(state, regionId);
  const problem = seedProblem(state, f, region);
  if (problem || !f || !region) return { error: problem ?? 'Nowhere to send it.' };
  state.fish.splice(state.fish.indexOf(f), 1);
  const bloom = isAdult(f) ? 8 : 4;
  state.credits += 6;
  state.stats.seeded++;
  const events: GameEvent[] = [];
  const d = drop(state, region, Math.round(bloom * 1.5), false, now, events);
  addLog(state, now, '☄', `${nameOf(f.code)} seeded into ${regionLabel(region)}. +${bloom} bloom.${d.clean ? ' Clean drop!' : ''}`);
  events.push(...bloomUp(state, now, region.biome, bloom));
  return { fish: f, bloom, drop: d, events };
}

/** Spend one of the region's vote tokens on a name. The backend gets the same vote. */
export function vote(state: State, regionId: string, optionId: string): Result<{ region: Region }> {
  const r = regionById(state, regionId);
  const p = r?.poll;
  if (!r || !p || r.name) return { error: 'That poll is closed.' };
  if (p.tokens <= 0) return { error: 'Deliver a fish here to earn a vote.' };
  if (!p.options.some((o) => o.id === optionId)) return { error: 'Not on the ballot.' };
  p.tokens--;
  p.spent[optionId] = (p.spent[optionId] ?? 0) + 1;
  return { region: r };
}

/** Close a ready region's poll and stamp its name. `tally` comes from the backend (local by default). */
export function closePoll(state: State, regionId: string, now: number, tally?: Record<string, number>): Result<{ region: Region; name: string; events: GameEvent[] }> {
  const r = regionById(state, regionId);
  if (!r || !r.poll || r.name) return { error: 'Nothing to close.' };
  if (r.life < LIFE_MAX) return { error: 'The region isn’t ready yet.' };
  const id = winner(r, tally ?? localTally(r, now));
  const name = r.poll.options.find((o) => o.id === id)?.name ?? r.survey;
  r.name = name;
  if (!state.fieldNotes.regions.includes(r.id)) state.fieldNotes.regions.push(r.id);
  const patch = `named:${r.id}`;
  if (!state.patches.includes(patch)) state.patches.push(patch);
  addLog(state, now, '✎', `${r.survey} is now ${name}, by vote of the Colony Accord.`);
  return { region: r, name, events: [{ kind: 'regionNamed', region: r, name }] };
}

export function sell(state: State, fishId: string, now: number): Result<{ fish: Fish; price: number }> {
  const f = state.fish.find((x) => x.id === fishId);
  if (!f) return { error: 'That fish is gone.' };
  const price = priceOf(f.code, now);
  state.fish.splice(state.fish.indexOf(f), 1);
  state.credits += price;
  state.stats.sold++;
  addLog(state, now, '◎', `Sold ${nameOf(f.code)} to the Roe Counter for ${price} ◎.`);
  return { fish: f, price };
}

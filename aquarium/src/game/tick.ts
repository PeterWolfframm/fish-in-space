// Time passing: growth, hunger, hatching, requests, restocks and the auto-feeder.

import { GROW, HUNGER_PER_S, MAX_ORDERS, OFFLINE_CAP, ORDER_EVERY } from './constants';
import { ecoOf, stageOf, withStage } from './fish';
import { orbitAt } from './orbit';
import { makeOrder } from './requests';
import { newFish, noteFish } from './state';
import type { GameEvent, Stage, State } from './types';

const STAGES: Stage[] = ['fry', 'juvenile', 'adult', 'elder'];
const stageFor = (growth: number): Stage =>
  growth >= GROW.elder ? 'elder' : growth >= GROW.adult ? 'adult' : growth >= GROW.juvenile ? 'juvenile' : 'fry';

/** Advance time. `active` is true while the player is looking (it drives ambient comms pacing). */
export function tick(state: State, now: number, active = false): GameEvent[] {
  const events: GameEvent[] = [];
  const ms = Math.max(0, Math.min(OFFLINE_CAP, now - state.lastTick));
  const dt = ms / 1000;
  state.lastTick = now;
  if (active) state.playMs += Math.min(ms, 5_000);

  const orbit = orbitAt(state.orbitEpoch, now).n;
  if (state.upgrades.feeder && orbit > state.upgrades.feederOrbit) {
    state.upgrades.feederOrbit = orbit;
    for (const f of state.fish) f.hunger = Math.min(f.hunger, 0.1);
    if (state.fish.length) events.push({ kind: 'autofed', n: state.fish.length });
  }
  if (orbit !== state.shop.orbit) {
    state.shop = { ...state.shop, orbit, sold: [], cuttingsSold: [] };
    events.push({ kind: 'restock', orbit });
  }

  for (const f of state.fish) {
    const warm = state.upgrades.heater && ecoOf(f.code).temp === 'tropical';
    const fed = f.hunger < 0.6 || warm;
    f.growth += dt * (fed ? 2 : 1);
    f.hunger = Math.min(1, f.hunger + dt * HUNGER_PER_S);
    const want = stageFor(f.growth);
    if (STAGES.indexOf(want) > STAGES.indexOf(stageOf(f.code))) {
      f.code = withStage(f.code, want);
      events.push({ kind: 'grew', fish: f, stage: want });
    }
  }

  for (const egg of [...state.eggs]) {
    if (egg.hatchAt > now) continue;
    state.eggs.splice(state.eggs.indexOf(egg), 1);
    const origin = egg.parents ? 'bred' : (egg.kind ?? 'roe');
    const f = newFish(state, egg.code, now, egg.tank, { x: egg.x, origin, ...(egg.parents && { parents: egg.parents }) });
    state.fish.push(f);
    state.stats.hatched++;
    events.push({ kind: 'hatched', fish: f, roe: egg.roe, egg });
    for (const d of noteFish(state, f.code)) events.push({ kind: 'discovered', ...d });
  }

  for (const o of [...state.orders]) {
    if (o.expires > now) continue;
    state.orders.splice(state.orders.indexOf(o), 1);
    events.push({ kind: 'expired', order: o });
  }
  if (state.orders.length < MAX_ORDERS && now >= state.nextOrderAt) {
    const o = makeOrder(state, now, `${state.seed}:order${state.nextId}`);
    state.orders.push(o);
    state.nextOrderAt = now + ORDER_EVERY;
    events.push({ kind: 'order', order: o });
  }
  return events;
}

// PIP's advice: which fish to send where, ranked. Pure and rule-based: it only ever recommends what
// the launch rules would accept. Requests come first (they pay), then free seeding into the open
// region that needs life the most. PIP's "confidence" is decorative and deliberately unhinged.

import type { Fish, Order, Region, State } from './types';
import { genomeOf, meetsAll } from './fish';
import { seedProblem } from './actions';
import { isAdult } from './state';
import { liveRegions, regionById } from './requests';
import { rng } from './rng';
import { LIFE_MAX } from './constants';

export type Advice =
  | { kind: 'order'; fish: Fish; region: Region; order: Order; reward: number; sure: number }
  | { kind: 'seed'; fish: Fish; region: Region; reward: number; sure: number }
  | { kind: 'none'; why: 'empty' | 'nofit' };

/** Seed rewards, mirroring seedFree. */
const SEED_CREDITS = 6;

/** Fish PIP is willing to suggest: no pets with a fixed name, and never the last breeder of a sex
 *  (pets don't count as breeders: Jerry is not available for that either). */
function spareable(state: State): Fish[] {
  const adults = (sex: string) => state.fish.filter((f) => !f.name && isAdult(f) && genomeOf(f.code).sex === sex).length;
  return state.fish.filter((f) => {
    if (f.name) return false; // PIP will not recommend Jerry.
    return !isAdult(f) || adults(genomeOf(f.code).sex) > 1;
  });
}

const confidence = (seed: string, lo: number, hi: number) => Math.round(lo + rng(seed)() * (hi - lo));

/** Up to `max` recommendations, best first; or a single 'none' card explaining why nothing can go. */
export function advise(state: State, max = 3): Advice[] {
  if (!state.fish.length) return [{ kind: 'none', why: 'empty' }];
  const pool = spareable(state);
  const used = new Set<string>();
  const out: Advice[] = [];

  // Requests: highest reward first, each filled by the least valuable-looking fit (the youngest).
  for (const o of [...state.orders].sort((a, b) => b.reward - a.reward)) {
    const region = regionById(state, o.region);
    if (!region) continue;
    const fit = pool.filter((f) => !used.has(f.id) && meetsAll(f.code, o.reqs)).sort((a, b) => a.born - b.born).at(-1);
    if (!fit) continue;
    used.add(fit.id);
    out.push({ kind: 'order', fish: fit, region, order: o, reward: o.reward, sure: confidence(`${o.id}:${fit.id}`, 78, 113) });
  }

  // Free seeding: the emptiest open regions first, one fish each.
  const regions = liveRegions(state)
    .filter((r) => r.life < LIFE_MAX)
    .sort((a, b) => a.life - b.life);
  for (const r of regions) {
    if (out.length >= max) break;
    const fit = pool.find((f) => !used.has(f.id) && !seedProblem(state, f, r));
    if (!fit) continue;
    used.add(fit.id);
    out.push({ kind: 'seed', fish: fit, region: r, reward: SEED_CREDITS, sure: confidence(`${r.id}:${fit.id}`, 51, 97) });
  }

  return out.length ? out.slice(0, max) : [{ kind: 'none', why: 'nofit' }];
}

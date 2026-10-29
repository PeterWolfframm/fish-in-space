// PIP's breeding plan: what a region on Mirelle needs right now, and which pairs aboard would hatch
// fish that meet those needs. The odds are honest: PIP test-breeds each pair through the same genetics
// the Lab uses (a few simulated clutches, not the real brood seed) and counts the eggs that fit.

import type { Fish, Order, Region, Req, State } from './types';
import { BIOMES, PHASES, biomeById, condOf, condWords, type Biome } from './biomes';
import { fish, genomeOf, codeOf, meets, reqLabel, cap } from './fish';
import { isAdult, fishName } from './state';
import { liveRegions, regionById, regionLabel, ROLE, GENE } from './requests';
import { breedProblem } from './actions';
import { LIFE_MAX } from './constants';

export interface Need {
  id: string; // stable key, e.g. 'water:temp' or 'o12:diet'
  req: Req;
  label: string;
  why: string;
  weight: number;
  source: 'water' | 'order';
  orderId?: string;
}

export interface RegionNeeds {
  region: Region;
  biome: Biome;
  needs: Need[];
  orders: Order[];
  /** Fish aboard that already fit the water: send these, breed for the rest. */
  ready: Fish[];
  /** What the next phase does to this water, if anything. */
  upcoming: string | null;
}

export interface PairPlan {
  a: Fish;
  b: Fish;
  odds: { need: Need; pct: number }[];
  water: number; // % of test eggs that could live in the region
  orders: { order: Order; pct: number }[]; // % of test eggs that would fill each request outright
  score: number;
  problem: string | null; // why they can't pair this minute, if they can't
  reasons: string[];
}

export interface BreedPlan {
  target: RegionNeeds;
  pairs: PairPlan[];
  /** When nothing aboard breeds well for this water: what to look for at the Interchange. */
  seek: { wants: Need[]; text: string } | null;
  sims: number;
}

/** Test clutches per pair, and how many parents of each sex per tank PIP bothers to try. */
export const PLAN_SIMS = 8;
const PLAN_PARENTS = 5;

const WATER_KEYS = ['salinity', 'temp', 'depth'];
export const ROLE_WORD: Record<string, string> = {
  herbivore: 'grazer', detritivore: 'sifter', planktivore: 'filter-feeder', piscivore: 'hunter', carnivore: 'worm-eater',
  omnivore: 'generalist', durophage: 'shell-cracker', bottom: 'bottom-dweller', top: 'surface fish', mid: 'midwater swimmer',
  above: 'leaper', school: 'schooling fish', pair: 'pairing fish', solitary: 'loner', warband: 'territorial fish', retinue: 'leader',
};
const needLabel = (q: Req) => (q.kind === 'eco' && !Array.isArray(q.value) && ROLE_WORD[q.value] ? cap(ROLE_WORD[q.value]) : reqLabel(q));
const sameReq = (a: Req, b: Req) => JSON.stringify(a) === JSON.stringify(b);

/** The region PIP should plan for: the one you asked about, else the best-paying request, else the emptiest water. */
export function planTarget(state: State, preferred?: string | null): Region | undefined {
  const live = liveRegions(state);
  const want = preferred ? live.find((r) => r.id === preferred) : undefined;
  if (want) return want;
  const order = [...state.orders].sort((a, b) => b.reward - a.reward).find((o) => live.some((r) => r.id === o.region));
  if (order) return regionById(state, order.region);
  return [...live].sort((a, b) => (a.life >= LIFE_MAX ? 1 : 0) - (b.life >= LIFE_MAX ? 1 : 0) || a.life - b.life)[0];
}

/** Regions worth planning for, best first: any with a request, then the ones still short of life. */
export function planRegions(state: State): Region[] {
  const asked = new Set(state.orders.map((o) => o.region));
  return liveRegions(state)
    .filter((r) => asked.has(r.id) || r.life < LIFE_MAX)
    .sort((a, b) => Number(asked.has(b.id)) - Number(asked.has(a.id)) || a.life - b.life);
}

/** Everything a region wants from its residents: its water, and whatever its colony has asked for. */
export function needsOf(state: State, region: Region): RegionNeeds {
  const biome = biomeById(region.biome) ?? BIOMES[0];
  const c = condOf(biome, state.phase);
  const place = regionLabel(region);
  const needs: Need[] = [
    { id: 'water:salinity', req: { kind: 'eco', key: 'salinity', value: c.salinity }, label: cap(c.salinity), why: `${place} is ${c.salinity} water.`, weight: 3, source: 'water' },
    { id: 'water:temp', req: { kind: 'eco', key: 'temp', value: c.temp }, label: cap(c.temp), why: `${place} runs ${c.temp}.`, weight: 3, source: 'water' },
  ];
  if (c.depth) needs.push({ id: 'water:depth', req: { kind: 'eco', key: 'depth', value: c.depth }, label: 'Deep-water', why: `${place} is deep and dark.`, weight: 3, source: 'water' });
  const orders = state.orders.filter((o) => o.region === region.id).sort((a, b) => b.reward - a.reward);
  for (const o of orders)
    for (const q of o.reqs) {
      if (q.kind === 'adult' || (q.kind === 'eco' && WATER_KEYS.includes(q.key))) continue;
      if (needs.some((n) => sameReq(n.req, q))) continue;
      const why =
        q.kind === 'eco' ? (ROLE[q.key]?.[q.value as string] ?? o.flavor)
        : q.kind === 'gene' ? (GENE[q.allele] ?? o.flavor)
        : `${o.colony} only takes hatchery-bred fish. Every egg you hatch counts.`;
      needs.push({ id: `${o.id}:${q.kind === 'eco' ? q.key : q.kind}`, req: q, label: needLabel(q), why: `${o.colony}: ${why}`, weight: 2, source: 'order', orderId: o.id });
    }
  const water = needs.filter((n) => n.source === 'water');
  const ready = state.fish.filter((f) => water.every((n) => meets(f.code, n.req)));
  const next = PHASES[state.phase + 1] && biome.opens <= state.phase + 1 ? condOf(biome, state.phase + 1) : null;
  const upcoming = next && next !== c ? `From ${PHASES[state.phase + 1].name}, ${place} turns ${condWords(next)}.` : null;
  return { region, biome, needs, orders, ready, upcoming };
}

// Test clutches, cached by the parents' codes: the same pair always tests the same.
const clutchCache = new Map<string, string[]>();
function clutch(a: string, b: string, n: number): string[] {
  const k = `${a}|${b}|${n}`;
  const hit = clutchCache.get(k);
  if (hit) return hit;
  const ga = genomeOf(a);
  const gb = genomeOf(b);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(codeOf({ ...fish.breedDetailed(ga, gb, `plan:${a}:${b}:${i}`).child, stage: 'fry' }));
  if (clutchCache.size > 400) clutchCache.clear();
  clutchCache.set(k, out);
  return out;
}

const pctOf = (codes: string[], ok: (c: string) => boolean) => Math.round((100 * codes.filter(ok).length) / Math.max(1, codes.length));

/** Why this pair, in PIP's words: who carries what, and what the eggs did in the test tube. */
function explain(t: RegionNeeds, a: Fish, b: Fish, water: number, odds: PairPlan['odds'], orders: PairPlan['orders']): string[] {
  const place = regionLabel(t.region);
  const waterNeeds = t.needs.filter((n) => n.source === 'water');
  const fits = (f: Fish) => waterNeeds.every((n) => meets(f.code, n.req));
  const words = waterNeeds.map((n) => n.label.toLowerCase()).join(', ');
  const out: string[] = [];
  const both = fits(a) && fits(b);
  const one = fits(a) ? a : fits(b) ? b : null;
  if (both) out.push(`Both are ${words} fish, so ${water}% of test eggs could live in ${place}.`);
  else if (one) out.push(`Only ${fishName(one)} suits ${place}'s ${words} water; ${water}% of test eggs did.`);
  else if (water > 0) out.push(`Neither parent suits ${place}, but genes mix: ${water}% of test eggs did.`);
  else out.push(`No test egg could live in ${place}'s ${words} water.`);
  for (const { need, pct } of odds) {
    if (need.source === 'water' || pct === 0) continue;
    const carriers = [a, b].filter((f) => meets(f.code, need.req)).map(fishName);
    const who = carriers.length === 2 ? 'Both parents have it' : carriers.length ? `${carriers[0]} has it` : 'Neither parent shows it';
    out.push(`${need.label}: ${pct}% of eggs. ${who}.`);
  }
  for (const { order, pct } of orders) if (pct > 0) out.push(`${pct}% of eggs would fill ${order.colony}'s request (+${order.reward} ◎) once grown.`);
  return out;
}

/** What to breed for a region: the best pairs aboard, ranked by how many of its needs their eggs meet. */
export function breedPlan(state: State, region: Region, now: number, max = 3): BreedPlan {
  const t = needsOf(state, region);
  const weightSum = t.needs.reduce((s, n) => s + n.weight, 0);
  const own = (f: Fish) => t.needs.reduce((s, n) => s + (meets(f.code, n.req) ? n.weight : 0), 0);
  const pairs: PairPlan[] = [];
  for (const tank of state.tanks) {
    const adults = state.fish.filter((f) => f.tank === tank.id && isAdult(f));
    const best = (sex: string) => adults.filter((f) => genomeOf(f.code).sex === sex).sort((x, y) => own(y) - own(x)).slice(0, PLAN_PARENTS);
    for (const a of best('f'))
      for (const b of best('m')) {
        const eggs = clutch(a.code, b.code, PLAN_SIMS);
        const odds = t.needs.map((need) => ({ need, pct: pctOf(eggs, (c) => meets(c, need.req)) }));
        const water = pctOf(eggs, (c) => t.needs.every((n) => n.source !== 'water' || meets(c, n.req)));
        const orders = t.orders.map((order) => ({ order, pct: pctOf(eggs, (c) => order.reqs.every((q) => q.kind === 'adult' || meets(c, q))) }));
        const fill = orders.reduce((m, o) => Math.max(m, o.pct), 0);
        const score = odds.reduce((s, o) => s + o.need.weight * o.pct, 0) / Math.max(1, weightSum) + water * 0.5 + fill * 0.5;
        pairs.push({ a, b, odds, water, orders, score, problem: breedProblem(state, a, b, now), reasons: explain(t, a, b, water, odds, orders) });
      }
  }
  pairs.sort((x, y) => y.score - x.score);
  // Variety: a fish leads at most one recommendation, so three cards aren't the same star parent.
  const used = new Set<string>();
  const picked: PairPlan[] = [];
  for (const p of pairs) {
    if (picked.length >= max) break;
    if (p.water === 0 || used.has(p.a.id) || used.has(p.b.id)) continue;
    used.add(p.a.id).add(p.b.id);
    picked.push(p);
  }
  const top = picked[0];
  let seek: BreedPlan['seek'] = null;
  if (!top || top.water < 40) {
    const wants = t.needs.filter((n) => n.source === 'water' || !top || (top.odds.find((o) => o.need === n)?.pct ?? 0) === 0).slice(0, 5);
    const words = wants.map((n) => n.label.toLowerCase()).join(', ');
    seek = { wants, text: `Nothing aboard breeds well for ${regionLabel(region)}. Look for a ${words} fish at the Interchange, ideally a pair.` };
  }
  return { target: t, pairs: picked, seek, sims: PLAN_SIMS };
}

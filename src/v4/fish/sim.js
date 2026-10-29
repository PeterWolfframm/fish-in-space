// A deterministic breeding simulator, for balancing `params` (breeding, mythic, economy) against
// the pacing targets: how many generations and hours a reasonably smart player needs to reach each
// tier, and what each way of playing earns. No randomness beyond the seed.
//
//   simulate({ strategy, seed, params?, generations?, tank?, terrain? })
//     → { strategy, firsts: { tier: { gen, hours } }, generations, hours, credits, worth, perHour, mythics }
//
// Strategies:
//   greedy    breed the two highest-scoring fish, keep the highest scorers
//   line      breed within the founding line (purity rises, the line fixes), keep the line's best
//   spam      breed the most fertile pair, keep breeders, sell everything else
//   outcross  breed the best pair of different bodies (hybrids), keep scorers and hybrids
//
// Timing follows the game (aquarium/src/game/constants.ts): eggs hatch in 20 s, a fry is adult
// after 150 s × its maturation, a spawn rests 90 s × its cooldown; one generation takes the longer.

import { roller } from '../../pixel/rng.js';
import { fromSeed } from './index.js';
import { breedClutch } from './breeding.js';
import { rarityOf } from './rarity.js';
import { reproduction, paramsOf } from './reproduction.js';
import { valueOf, eggCost, genusOf } from './economy.js';
import { TIERS, tierRank } from './rules.js';

export const TIMING = { hatch: 20, adult: 150, cooldown: 90 };
export const STRATEGIES = ['greedy', 'line', 'spam', 'outcross'];
const START_CREDITS = 300;
const SHOP_MARKUP = 1.25;

/** One fish in the sim: its genome plus what the sim tracks about it. */
function entry(set, P) {
  const rar = rarityOf(set, P);
  return { set, points: rar.points, tier: rar.tier, rep: reproduction(set, P), broods: 0 };
}

const lineOf = (s) => `${s.lineA}${s.lineB}`;

/** Each strategy: which pair to breed, and how much to want to keep a fish. */
const PLAY = {
  greedy: {
    pair: (fish) => byScore(fish, (f) => f.points).slice(0, 2),
    keep: (f) => f.points,
  },
  line: {
    pair: (fish, st) => {
      const own = byScore(fish.filter((f) => lineOf(f.set) === st.line), (f) => f.points);
      return own.length >= 2 ? own.slice(0, 2) : byScore(fish, (f) => f.points).slice(0, 2);
    },
    keep: (f, st) => f.points + (lineOf(f.set) === st.line ? 8 : 0),
  },
  spam: {
    pair: (fish) => byScore(fish, (f) => f.rep.spawnChance * f.rep.clutch).slice(0, 2),
    keep: (f) => f.rep.spawnChance * f.rep.clutch * 10 + (f.rep.broodLimit - f.broods),
  },
  outcross: {
    pair: (fish) => {
      const best = byScore(fish, (f) => f.points);
      const a = best[0];
      const b = best.find((f) => f !== a && f.set.body !== a?.set.body) ?? best[1];
      return [a, b];
    },
    keep: (f) => f.points + (f.set.hybrid !== 'none' ? 6 : 0),
  },
};

const byScore = (fish, score) => [...fish].sort((x, y) => score(y) - score(x) || (x.set.code ?? '').localeCompare(y.set.code ?? ''));

/** Run one strategy from a fresh start. */
export function simulate({ strategy = 'greedy', seed = 'sim', params, generations = 60, tank = 8, terrain = 'water' } = {}) {
  const P = paramsOf(params);
  const play = PLAY[strategy];
  const { r } = roller(`${seed}:${strategy}`, 7600);
  const st = { line: null };
  let credits = START_CREDITS;
  let seconds = 0;
  let shopN = 0;
  let mythics = 0;
  const sales = [];
  const firsts = {};

  const shop = () => {
    // The shop sells grown fish of the terrain, mostly commons.
    for (;;) {
      const set = { ...fromSeed(`${seed}:shop:${shopN++}`, P, { terrain }), stage: 'adult' };
      const e = entry(set, P);
      if (tierRank(e.tier) <= 1) {
        credits -= Math.round(valueOf(set, { params: P }).credits * SHOP_MARKUP);
        return e;
      }
    }
  };
  const sell = (f) => {
    credits += valueOf(f.set, { params: P, sales: sales.slice(-10) }).credits;
    sales.push(genusOf(f.set));
  };

  let fish = [shop(), shop(), shop(), shop()];
  st.line = lineOf(fish[0].set);
  const startWorth = credits + fish.reduce((a, f) => a + valueOf(f.set, { params: P }).credits, 0);

  let gen = 0;
  for (; gen < generations; gen++) {
    const able = fish.filter((f) => !f.rep.sterile && f.broods < f.rep.broodLimit);
    if (able.length < 2) {
      fish.push(shop());
      continue;
    }
    const [a, b] = play.pair(able, st);
    a.broods += 1;
    b.broods += 1;
    const rest = TIMING.cooldown * Math.max(a.rep.cooldownMul, b.rep.cooldownMul);
    const spawn = (a.rep.spawnChance + b.rep.spawnChance) / 2;
    if (r(gen) >= spawn) {
      seconds += rest;
      continue;
    }
    const clutch = breedClutch(a.set, b.set, `${seed}:${strategy}:${gen}`, P);
    credits -= eggCost(clutch.children.length, P);
    const kids = clutch.children.map((c) => entry({ ...c, stage: 'adult' }, P));
    const grow = TIMING.hatch + TIMING.adult * Math.max(...kids.map((k) => k.rep.maturationMul), 0);
    seconds += Math.max(rest, grow);
    for (const k of kids) {
      if (k.tier === 'myth') mythics += 1;
      for (const t of TIERS.slice(1)) if (tierRank(k.tier) >= tierRank(t) && !firsts[t]) firsts[t] = { gen: gen + 1, hours: Math.round(seconds / 36) / 100 };
    }
    // Keep the best, sell the rest (spent breeders last of all).
    const pool = byScore([...fish, ...kids], (f) => play.keep(f, st) - (f.broods >= f.rep.broodLimit ? 1000 : 0));
    fish = pool.slice(0, tank);
    for (const f of pool.slice(tank)) sell(f);
  }

  const hours = seconds / 3600;
  const worth = credits + fish.reduce((a, f) => a + valueOf(f.set, { params: P }).credits, 0);
  return {
    strategy,
    firsts,
    generations: gen,
    hours: Math.round(hours * 100) / 100,
    credits: Math.round(credits),
    worth: Math.round(worth),
    perHour: Math.round((worth - startWorth) / Math.max(hours, 0.01)),
    mythics,
    best: Math.max(...fish.map((f) => f.points)),
  };
}

/** Every strategy over several seeds: median first-tier generations and credits per hour. */
export function sweep({ seeds = 4, ...opts } = {}) {
  const out = {};
  for (const strategy of STRATEGIES) {
    const runs = Array.from({ length: seeds }, (_, i) => simulate({ ...opts, strategy, seed: `${opts.seed ?? 'sweep'}:${i}` }));
    const med = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
    out[strategy] = {
      perHour: med(runs.map((x) => x.perHour)),
      mythics: runs.reduce((a, x) => a + x.mythics, 0),
      firsts: Object.fromEntries(TIERS.slice(1).map((t) => {
        const hit = runs.filter((x) => x.firsts[t]);
        return [t, hit.length ? { gen: med(hit.map((x) => x.firsts[t].gen)), hours: med(hit.map((x) => x.firsts[t].hours)), reached: hit.length / runs.length } : null];
      })),
    };
  }
  return out;
}

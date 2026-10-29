// fish4's prices, from the continuous rarity score (never the tier label), size and life stage, a
// premium for slow and shy breeders, the market's demand, and diminishing returns for selling one
// genus over and over in an orbit. Every factor is itemised. `params.economy` holds the numbers.
//
//   valueOf(set, { params?, demand?, sales? }) → { credits, breakdown[] }
//   eggCost(n, params?) → credits for a clutch of n eggs

import { toFish3 } from './genome.js';
import { extOf } from './bodies/index.js';
import { taxonomyOf } from './taxonomy.js';
import { statsOf } from './stats.js';
import { rarityOf } from './rarity.js';
import { paramsOf } from './reproduction.js';

export const SIZE_VALUE = { tiny: 0.7, small: 0.85, medium: 1, large: 1.2, huge: 1.45, giant: 1.75 };
export const STAGE_VALUE = { fry: 0.3, juvenile: 0.6, adult: 1, elder: 0.85 };

const r2 = (x) => Math.round(x * 100) / 100;

/** The genus a fish sells as (saturation counts sales per genus). */
export const genusOf = (set) => taxonomyOf(toFish3(set), extOf(set)).genus;

/**
 * What a fish is worth. `sales`: recent sales in this orbit, as genus names (or `{ genus }`);
 * `demand`: the market's multiplier for this fish (its tags), 1 = none.
 */
export function valueOf(set, opts = {}) {
  const P = paramsOf(opts.params);
  const E = P.economy;
  const rar = opts.rarity ?? rarityOf(set, P);
  const st = opts.stats ?? statsOf(set);
  const breakdown = [];
  let v = E.base + rar.points * E.perPoint;
  breakdown.push({ factor: 'rarity', label: `${rar.points} points (${rar.label})`, value: r2(v) });
  const mul = (factor, label, k) => {
    if (k === 1) return;
    v *= k;
    breakdown.push({ factor, label, mul: r2(k) });
  };
  mul('size', set.size, SIZE_VALUE[set.size] ?? 1);
  mul('stage', set.stage, STAGE_VALUE[set.stage] ?? 1);
  // Scarcity: slow to mature, long rests, few spawns.
  const scarcity = Math.max(0, (st.maturationMul.value + st.breedCooldownMul.value + (1 - st.fertility.value)) / 3 - 0.3);
  mul('scarcity', 'slow, shy breeder', 1 + scarcity * E.scarcity);
  if (opts.demand) mul('demand', 'market demand', opts.demand);
  if (opts.sales?.length) {
    const genus = genusOf(set);
    const n = opts.sales.filter((s) => (s.genus ?? s) === genus).length;
    if (n) mul('saturation', `${n} ${genus} sold here lately`, Math.max(E.floor, 1 - E.saturation * n));
  }
  return { credits: Math.max(1, Math.round(v)), breakdown };
}

/** Credits a clutch costs to lay. */
export const eggCost = (n, params) => Math.round(paramsOf(params).economy.eggCost * n);

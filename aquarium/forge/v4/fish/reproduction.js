// fish4's reproduction numbers, read off the stats: will a spawn take, how many eggs, how long a
// rest after, how long to grow up, and how many broods a fish has in it over its life (a
// simulation input; the game counts broods used). All of it moves with `params.breeding`.
//
//   reproduction(set, P?, stats?) → { spawnChance, clutch, cooldownMul, maturationMul, broodLimit, sterile }
//   canBreed(set, broodsUsed, P?) → { ok, reason? }

import { HYBRIDS } from '../../v3/fish/bodies.js';
import { statsOf } from './stats.js';
import { lociOf } from './loci.js';
import { resolveParams } from './params.js';
import { rarityOf } from './rarity.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r2 = (x) => Math.round(x * 100) / 100;

export const paramsOf = (params) => (typeof params === 'object' && params?.breeding && params?.rarityPoints ? params : resolveParams(params));

/** The breeding numbers for one fish. `stats` may be passed in when already computed. */
export function reproduction(set, params, stats) {
  const P = paramsOf(params);
  const B = P.breeding;
  const st = stats ?? statsOf(set);
  const tier = rarityOf(set, P).tier;
  const fert = lociOf(set).fertility.value;
  const sterile = Boolean(HYBRIDS[set.hybrid]?.sterile);
  const limit = tier === 'myth' && B.mythicBroodLimit != null
    ? B.mythicBroodLimit
    : Math.max(1, Math.round(B.broodLimit * (1 + B.fertilitySpread * (fert * 2 - 1)) * (B.tierMul[tier] ?? 1)));
  return {
    spawnChance: sterile ? 0 : r2(clamp(B.spawnBase * (0.6 + 0.8 * st.fertility.value), 0.05, 0.98)),
    clutch: clamp(Math.round(st.clutchSize.real), B.clutchMin, B.clutchMax),
    cooldownMul: r2(st.breedCooldownMul.real * B.cooldownMul),
    maturationMul: r2(st.maturationMul.real * B.maturationMul),
    broodLimit: sterile ? 0 : limit,
    sterile,
    tier,
  };
}

/** Whether a fish may spawn now, given how many broods it has had. */
export function canBreed(set, broodsUsed = 0, params) {
  if (!['adult', 'elder'].includes(set.stage)) return { ok: false, reason: 'not grown up yet' };
  const rep = reproduction(set, params);
  if (rep.sterile) return { ok: false, reason: 'a sterile hybrid' };
  if (broodsUsed >= rep.broodLimit) return { ok: false, reason: `spent: ${rep.broodLimit} broods in a life` };
  return { ok: true, left: rep.broodLimit - broodsUsed };
}

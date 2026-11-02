// What a plant is worth to a farmer or an aquarist: grow time, regrowth, yield, sell price,
// season, hardiness, water, light, and how rare it is. Read off the form's own numbers, bent by
// the quiet genes (growth, yield, hardiness, thirst, flavour, longevity) and the size.

import { FORMS } from './forms.js';
import { normalizePlant, STEP_IDS, SHAPE_GENES, COLOR_ROLES } from './genome.js';
import { hintsFor, swappable } from './ecotype.js';

const k = (set, id) => STEP_IDS.indexOf(set[id] ?? 'z0') - 3;
const SIZE_SELL = { herb: 0.8, shrub: 1, tall: 1.25, tree: 1.6, giant: 2.2 };
const SIZE_YEARS = { herb: 1, shrub: 3, tall: 8, tree: 40, giant: 120 };

export const TIERS = [
  { id: 'common', label: 'Common', min: 0, sell: 1 },
  { id: 'uncommon', label: 'Uncommon', min: 2, sell: 1.25 },
  { id: 'rare', label: 'Rare', min: 4, sell: 1.6 },
  { id: 'epic', label: 'Epic', min: 7, sell: 2.2 },
  { id: 'legendary', label: 'Legendary', min: 10, sell: 3.5 },
];

/** Rarity points, with what earned each. */
export function rarityOf(genome) {
  const set = normalizePlant(genome);
  const why = [];
  const add = (pts, what) => why.push({ pts, what });
  if (set.variegation !== 'none') add(2, `${set.variegation} variegation`);
  if (set.glow === 'on' && !FORMS[set.form].glow) add(3, 'glows');
  if (set.size === 'giant') add(1, 'giant');
  if (FORMS[set.form].sizes?.[set.size] == null) add(2, `a ${set.size} ${FORMS[set.form].label.toLowerCase()}`);
  for (const g of SHAPE_GENES) if (Math.abs(k(set, g)) === 3) add(1, `extreme ${g}`);
  for (const id of ['leaf', 'bloom', 'fruit']) if (set[id] !== 'auto') add(set[id] === 'none' ? 1 : 2, `${id}: ${set[id]}`);
  let odd = 0;
  for (const [fieldId, role] of Object.entries(COLOR_ROLES)) {
    if (!['leaf', 'petal', 'fruit', 'bark', 'coral'].includes(role)) continue;
    const hints = hintsFor(set.form, set.region, role);
    if (hints.length && !hints.some(([id]) => id === set[fieldId])) odd++;
  }
  if (odd) add(Math.min(3, odd), `${odd} unusual colour${odd > 1 ? 's' : ''}`);
  const points = why.reduce((s, w) => s + w.pts, 0);
  const tier = [...TIERS].reverse().find((t) => points >= t.min);
  return { points, tier: tier.id, label: tier.label, why };
}

/** The farm numbers. */
export function statsOf(genome) {
  const set = normalizePlant(genome);
  const form = FORMS[set.form];
  const S = form.stats ?? {};
  const water = form.medium === 'water';
  const rar = rarityOf(set);
  const tier = TIERS.find((t) => t.id === rar.tier);
  const days = S.days ? Math.max(1, Math.round(S.days * (1 - 0.07 * k(set, 'growth')) * (set.size === 'giant' ? 1.3 : 1))) : null;
  const regrow = S.regrow ? Math.max(1, Math.round(S.regrow * (1 - 0.08 * k(set, 'growth')))) : 0;
  const can = swappable(set.form);
  const harvest = form.crop || can.fruit || form.organs?.some((o) => o.type === 'fruit');
  const yieldN = harvest ? Math.max(1, Math.round((form.yield ?? 1) * (1 + 0.15 * k(set, 'yield')) * (set.size === 'tree' || set.size === 'giant' ? 3 : 1))) : 0;
  const sell = S.sell ? Math.round(S.sell * (1 + 0.08 * k(set, 'flavour')) * SIZE_SELL[set.size] * tier.sell) : 0;
  return {
    form: set.form,
    label: form.label,
    realm: set.realm,
    kind: water ? (form.organs?.some((o) => o.type === 'polyp') ? 'coral' : 'aquatic') : form.crop ? 'crop' : form.tree ? 'tree' : 'plant',
    season: S.season ?? 'any',
    days,
    regrow,
    yield: yieldN,
    sell,
    hardiness: Math.max(0, Math.min(1, 0.5 + 0.13 * k(set, 'hardiness') + (form.deciduous || form.tree ? 0.15 : 0))),
    waterEvery: water ? null : Math.max(1, 2 + k(set, 'thirst') * -0.5 + (/desert|savanna/.test(set.region) ? 3 : 0)) | 0,
    light: water ? S.light ?? 'medium' : null,
    years: Math.max(1, Math.round(SIZE_YEARS[set.size] * (1 + 0.2 * k(set, 'longevity')) * (form.crop ? 0.02 : 1))),
    rarity: rar.tier,
  };
}

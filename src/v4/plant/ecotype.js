// The ecotype roll: a seed is a place before it is a plant. Realm → region → form → size, then
// colours that lean on the form's and the region's own swatches, then the rare looks. Everything
// the place does not decide (the shape genes, the quiet genes, the sprout) keeps the trait
// system's own independent roll, so it stays bell-shaped and heritable.

import { roller } from '../../pixel/rng.js';
import { FORMS } from './forms.js';
import { roleId } from './palettes.js';
import { REGIONS, regionsOf, REALM_IDS } from './data/places.js';
import { plant4Traits as T, normalizePlant, FORM_FIELD, REALM_OF, SIZE_IDS, COLOR_ROLES, VARIEGATION, LEAF_KINDS, BLOOM_KINDS, FRUIT_KINDS, SHAPE_GENES, STEP_IDS } from './genome.js';
import { resolveParams } from './params.js';

const BLOOM_SWAP = new Set(['cup', 'bell', 'spike', 'umbel', 'puff', 'daisy', 'star', 'rose', 'blossom', 'composite']);
const FRUIT_SWAP = new Set(['pome', 'citrus', 'tomato', 'berry', 'pod', 'pepper', 'strawberry']);

/** What a form grows that the organ genes can swap: { leaf, bloom, fruit } as booleans. */
export function swappable(formId) {
  const organs = FORMS[formId]?.organs ?? [];
  return {
    leaf: organs.some((o) => o.type === 'leaf' && !['needle', 'strap', 'kelp'].includes(o.kind)),
    bloom: organs.some((o) => o.type === 'bloom' && BLOOM_SWAP.has(o.kind ?? 'daisy')),
    fruit: organs.some((o) => o.type === 'fruit' && FRUIT_SWAP.has(o.kind ?? 'pome')),
  };
}

/** The swatch hints for one colour role, form first, then region; weights favour the form's first. */
export function hintsFor(formId, regionId, role) {
  const form = FORMS[formId];
  const own = role === 'fruit' && form?.colors?.cap ? form.colors.cap : form?.colors?.[role] ?? [];
  const out = [];
  own.forEach((name, i) => {
    const id = roleId(role, name);
    if (id) out.push([id, i === 0 ? 4 : 2]);
  });
  for (const name of REGIONS[regionId]?.tint?.[role] ?? []) {
    const id = roleId(role, name);
    if (id && !out.some(([x]) => x === id)) out.push([id, 1]);
  }
  return out;
}

const weighted = (r, pairs, salt) => {
  const total = pairs.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (!(total > 0)) return pairs[0]?.[0];
  let x = r.r(salt) * total;
  for (const [id, w] of pairs) {
    x -= Math.max(0, w);
    if (x < 0) return id;
  }
  return pairs.at(-1)[0];
};

/** The sizes a form comes in, leaning toward its region's. */
export function sizeWeights(formId, regionId) {
  const f = FORMS[formId]?.sizes ?? { shrub: 1 };
  const reg = REGIONS[regionId]?.sizes ?? {};
  return SIZE_IDS.filter((s) => f[s] > 0).map((s) => [s, f[s] * (1 + (reg[s] ?? 0) * 0.5)]);
}

/**
 * A fresh plant. `params`: a preset id or params object. `pin`: place fields to hold
 * ({ realm, region, farmForm|wildForm|waterForm, form }).
 */
export function fromSeed(seed, params, pin = {}) {
  const P = resolveParams(params);
  const base = T.fromSeed(seed);
  const r = roller(seed, 4100);
  const realmPin = pin.realm ?? (pin.form ? REALM_OF[pin.form] : null) ?? (pin.region ? REGIONS[pin.region]?.realm : null)
    ?? REALM_IDS.find((id) => pin[FORM_FIELD[id]]);
  const realm = realmPin ?? weighted(r, REALM_IDS.map((id) => [id, P.realms[id] ?? 0]), 1);

  if (P.algo === 'classic') {
    const set = { ...base, ...pin, realm };
    return normalizePlant(set);
  }

  const region = pin.region && REGIONS[pin.region]?.realm === realm ? pin.region
    : weighted(r, regionsOf(realm).map((id) => [id, 1 * (P.regions[id] ?? 1)]), 2);
  const R = REGIONS[region];
  const form = pin.form ?? pin[FORM_FIELD[realm]] ?? weighted(r, Object.entries(R.forms).filter(([id]) => REALM_OF[id] === realm), 3);
  const set = { ...base, realm, region, [FORM_FIELD[realm]]: form };

  if (r.chance(P.sizePrefer, 4)) set.size = weighted(r, sizeWeights(form, region), 5);

  for (const [fieldId, role] of Object.entries(COLOR_ROLES)) {
    const hints = hintsFor(form, region, role);
    if (hints.length && r.chance(P.formColors, 10 + fieldId.length)) set[fieldId] = weighted(r, hints, 40 + fieldId.length * 3);
  }

  // shape spread: pull the bell in, or push it out
  if (P.shapeSpread !== 1) {
    for (const g of SHAPE_GENES) {
      const k = STEP_IDS.indexOf(set[g]) - 3;
      set[g] = STEP_IDS[Math.max(0, Math.min(6, Math.round(k * P.shapeSpread) + 3))];
    }
  }

  // the rare looks
  const rare = P.rare;
  set.variegation = r.chance(Math.min(0.9, 0.07 * rare), 60) ? r.pick(VARIEGATION.slice(1), 61) : 'none';
  set.glow = r.chance(Math.min(0.95, (R.glow ?? 0) + 0.015 * rare), 62) ? 'on' : 'off';
  const can = swappable(form);
  set.leaf = can.leaf && r.chance(Math.min(0.8, 0.04 * rare), 63) ? r.pick(LEAF_KINDS, 64) : 'auto';
  set.bloom = can.bloom && r.chance(Math.min(0.8, 0.06 * rare), 65) ? r.pick(BLOOM_KINDS, 66) : 'auto';
  set.fruit = can.fruit && r.chance(Math.min(0.8, 0.06 * rare), 67) ? r.pick(FRUIT_KINDS, 68) : 'auto';
  set.bed = R.bed && r.chance(0.4, 69) ? r.pick(R.bed, 70) : 'auto';
  set.look = base.look;
  return normalizePlant(set);
}

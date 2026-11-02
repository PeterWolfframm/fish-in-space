// A balanced batch: one realm, a few of its regions, a few forms per region, and lines within a
// form that share their colours (a seed packet of one variety), so a batch reads as a place.

import { roller } from '../../pixel/rng.js';
import { REGIONS, regionsOf, REALM_IDS } from './data/places.js';
import { REALM_OF, COLOR_ROLES, normalizePlant } from './genome.js';
import { fromSeed } from './ecotype.js';
import { resolveParams } from './params.js';

export function batch(seed, n, params, pin = {}) {
  const P = resolveParams(params);
  const r = roller(seed, 6100);
  const realm = pin.realm ?? (pin.region ? REGIONS[pin.region]?.realm : null)
    ?? r.weighted(REALM_IDS.map((id) => [id, P.realms[id] ?? 0]), 1);
  const pool = regionsOf(realm).filter((id) => (P.regions[id] ?? 1) > 0);
  const regions = pin.region ? [pin.region] : [];
  for (let i = 0; regions.length < Math.min(P.batch.regions, pool.length) && i < 40; i++) {
    const id = r.weighted(pool.map((x) => [x, P.regions[x] ?? 1]), 10 + i);
    if (!regions.includes(id)) regions.push(id);
  }
  // forms per region, weighted by the region's own odds
  const slots = [];
  for (const region of regions) {
    const forms = Object.entries(REGIONS[region].forms).filter(([id, w]) => w > 0 && REALM_OF[id] === realm);
    const picked = [];
    for (let i = 0; picked.length < Math.min(P.batch.formsPerRegion, forms.length) && i < 60; i++) {
      const id = r.weighted(forms, 100 + slots.length * 7 + i);
      if (!picked.includes(id)) picked.push(id);
    }
    for (const form of picked) slots.push({ region, form, weight: REGIONS[region].forms[form] });
  }
  // share n out by weight, at least one each while there is room
  const total = slots.reduce((s, x) => s + x.weight, 0);
  const counts = slots.map((s) => Math.max(1, Math.floor((n * s.weight) / total)));
  while (counts.reduce((a, b) => a + b, 0) > n && counts.some((c) => c > 1)) counts[counts.indexOf(Math.max(...counts))]--;
  for (let i = 0; counts.reduce((a, b) => a + b, 0) < n; i++) counts[i % counts.length]++;

  const plants = [];
  slots.forEach((slot, si) => {
    let founder = null;
    for (let k = 0; k < counts[si] && plants.length < n; k++) {
      const s = `${seed}-${slot.form}-${k}`;
      let set = fromSeed(s, P, { realm, region: slot.region, form: slot.form });
      if (!founder) founder = set;
      else if (r.chance(P.batch.cohesion, 500 + plants.length)) {
        set = normalizePlant({ ...set, ...Object.fromEntries(Object.keys(COLOR_ROLES).map((f) => [f, founder[f]])), variegation: founder.variegation, look: founder.look });
      }
      plants.push({ set, species: slot.form, school: si, region: slot.region });
    }
  });
  return {
    place: { terrain: realm, realm, regions },
    pyramid: counts,
    species: slots.length,
    plants,
    fish: plants,
  };
}

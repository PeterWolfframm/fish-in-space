// Breeding plant4. A child is one of its parents' kind: realm, region and form come together from
// one parent (a lettuce crossed with an oak is a lettuce or an oak, not a lettuce-oak), unless the
// params allow cross-realm grafts, and even then the form is whole. Shape genes land near the
// parents' mean, the quiet genes likewise; colours and rare looks are inherited field by field,
// then a light mutation re-rolls a few, never the form.

import { roller } from '../../pixel/rng.js';
import { plant4Traits as T, normalizePlant, STEP_IDS, SHAPE_GENES, QUIET_GENES, SIZE_IDS, FORM_FIELD } from './genome.js';
import { resolveParams } from './params.js';
import { namesOf } from './names.js';

const PLACE = ['realm', 'region', 'farmForm', 'wildForm', 'waterForm'];

export function breedDetailed(a, b, seed = 'breed', params) {
  const P = resolveParams(params);
  const A = normalizePlant(a);
  const B = normalizePlant(b);
  const r = roller(seed, 5200);
  const events = [];
  let child = T.combine(A, B, seed, 5300);

  // place and form, whole, from one parent
  const from = r.chance(0.5, 1) ? A : B;
  for (const f of PLACE) child[f] = from[f];
  if (A.form !== B.form) events.push(`took the ${from.form} form`);

  // size: between the parents, a step either way
  const ia = SIZE_IDS.indexOf(A.size);
  const ib = SIZE_IDS.indexOf(B.size);
  child.size = SIZE_IDS[Math.max(0, Math.min(4, Math.round((ia + ib) / 2 + r.range(-0.6, 0.6, 2))))];

  // proportions and quiet genes: the mean, with a little drift
  [...SHAPE_GENES, ...QUIET_GENES].forEach((g, i) => {
    const m = (STEP_IDS.indexOf(A[g]) + STEP_IDS.indexOf(B[g])) / 2 + r.range(-0.9, 0.9, 10 + i);
    child[g] = STEP_IDS[Math.max(0, Math.min(6, Math.round(m)))];
  });

  // mutation, then put the form back: a sport changes looks, not species
  const keep = Object.fromEntries(PLACE.map((f) => [f, child[f]]));
  const mutated = T.vary(child, P.breeding.mutation, seed, 5400);
  for (const f of Object.keys(mutated)) if (mutated[f] !== child[f] && !PLACE.includes(f) && f !== 'sprout' && f !== 'twist') events.push(`sport: ${f} → ${mutated[f]}`);
  child = { ...mutated, ...keep };
  if (P.breeding.crossRealm && A.realm !== B.realm && r.chance(0.1, 30)) {
    const other = from === A ? B : A;
    child.region = other.region;
    events.push('grafted into the other parent’s region');
  }
  child = normalizePlant(child);
  child[FORM_FIELD[child.realm]] = child.form;
  return { child, events, name: namesOf(child).full };
}

export const breed = (a, b, seed, params) => breedDetailed(a, b, seed, params).child;

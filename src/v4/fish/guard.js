// The aesthetic guard (data/constraints.js): vetoes combinations that read badly or break the
// setting. A tripped guard re-rolls its `fix` field without the current value, at salt
// `101 × k` (k = 1..4), then falls back. Deterministic.
//
//   guard(set, P, reroll) → { set, fixed[] }   reroll(fieldId, exclude[], salt) → choice id
//   violations(set, P) → ids of the guards a fish trips (for tests and the studio)

import { test, setLook } from './rules.js';
import CONSTRAINTS from './data/constraints.js';

export { CONSTRAINTS };

const guardsOf = (P) => {
  const G = P.guard ?? {};
  if (G.enabled === false) return [];
  const off = new Set(G.off ?? []);
  return (Array.isArray(G.list) ? G.list : CONSTRAINTS).filter((c) => !off.has(c.id));
};

/** The guards a fish trips. */
export function violations(set, P) {
  const look = setLook(set);
  return guardsOf(P).filter((c) => test(c.when, look, '')).map((c) => c.id);
}

export function guard(set, P, reroll) {
  const out = { ...set };
  const fixed = [];
  for (const c of guardsOf(P)) {
    if (!test(c.when, setLook(out), '')) continue;
    const tried = [out[c.fix]];
    let ok = false;
    for (let k = 1; k <= 4 && !ok; k++) {
      out[c.fix] = reroll(c.fix, tried, 101 * k);
      tried.push(out[c.fix]);
      ok = !test(c.when, setLook(out), '');
    }
    if (!ok && c.fallback != null) out[c.fix] = c.fallback;
    fixed.push(c.id);
  }
  return { set: out, fixed };
}

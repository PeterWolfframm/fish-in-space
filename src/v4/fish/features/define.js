// A visual feature module: one object that is a genome field, a compatibility rule, a painter,
// stat influences and a slider schema for the studio, so adding a feature is one file plus one
// line in registry.js.
//
//   defineFeature({
//     id, label, group,
//     field: { choices: [[id, label], …], weights, salt, dominance?, volatility?, tierBoost? },
//     when?,      a rules.js condition: false forces the field to its first choice ('none')
//     excludes?,  { field: [values] } that rule this feature out (e.g. { eyeMount: ['tubular'] })
//     layer,      'after:<part id>' or 'before:<part id>' in v3 draw.js PARTS
//     draw(ctx, value, params),   paints on the v3 painter ctx (ctx.v4 is the fish4 set)
//     influences?: { stats: { [stat]: { [choice | '*']: delta } }, keys: { [choice]: [salience keys] } },
//     params?: { [name]: { label, min, max, step, default } },   tunable look, edited live in the studio
//     behind?: { layer, draw(ctx, value, params) },   a second painter at another layer (fins and
//                 spines that grow out from behind the body)
//     points?,    rarity points when worn (default: params rarityPoints.feature)
//     distinctFrom?: [feature ids]   slots sharing one table: a value another slot already wears
//                 falls back to 'none', so a fish never wears the same thing twice
//   })
//
// `field.boost(set)`: an extra multiplier on every non-none weight, read off the rest of the fish
// (a chaotic nuclear fish mutates more).
//
// The salt must be explicit and unique (≥ 3072 for features): it is the field's roll stream, and
// changing it re-rolls every fish's copy of the feature.

import { test, setLook } from '../rules.js';

export function defineFeature(spec) {
  const { id, field, layer } = spec;
  if (!id || !field?.choices?.length || typeof field.salt !== 'number') throw new Error(`feature ${id ?? '?'} needs an id, choices and a salt`);
  for (const l of [layer, ...(spec.behind ? [spec.behind.layer] : [])]) {
    if (!/^(after|before):\w+$/.test(l ?? '')) throw new Error(`feature ${id}: layer must be after:<part> or before:<part>`);
  }
  const choices = field.choices.map(([cid, label]) => ({ id: cid, label }));
  const none = choices[0].id;
  const allowed = (set) => {
    for (const [f, values] of Object.entries(spec.excludes ?? {})) if (values.includes(set[f])) return false;
    for (const f of spec.distinctFrom ?? []) if (set[id] !== none && set[f] === set[id]) return false;
    return spec.when ? test(spec.when, setLook(set)) : true;
  };
  const defaults = Object.fromEntries(Object.entries(spec.params ?? {}).map(([k, p]) => [k, p.default]));
  return {
    ...spec,
    none,
    defaults,
    genomeField: {
      id,
      label: spec.label ?? id,
      group: 'features',
      feature: id,
      choices,
      weights: field.weights,
      salt: field.salt,
      dominance: field.dominance ?? 0.5,
      volatility: field.volatility ?? 0.6,
      default: none,
      when: allowed,
      gateHint: spec.gateHint,
      /** Weights for a fresh roll: rarer fish wear it more often (`tierBoost` per tier). */
      weightsFor(set, mul = 1) {
        const boost = (field.tierBoost?.[set.rarity] ?? 1) * (field.boost?.(set) ?? 1);
        return field.weights.map((w, i) => (i === 0 ? w : w * boost * mul));
      },
    },
  };
}

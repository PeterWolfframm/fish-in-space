// Swipes in, training rows out.
//
// A swipe is `{user, kind, code, verdict: 'approve'|'pass', fix?: [fieldId], instead?: {fieldId:
// choiceId}, asKind?, note?}`: the sprite is re-made from its code, so a row always describes the
// pixels that were judged, under the current renderer.
//
//   verdict        → beauty label (approve 1, pass 0)
//   fix chips      → fix-head targets, masked to the fields that kind has
//   instead picks  → a counterfactual row: the same sprite with that value swapped in, labelled
//                    approve at half weight ("it would be good if …")
//   note, asKind   → kept on the swipe for people to read; not trained on
//
// In the public set every user's rows are weighted 1/√n, so one keen swiper is heard but doesn't
// define "public" taste.

import { generator, fromCode } from '../gen/registry.js';
import { featurize, fixIndex, layout, hasStyle, l2Mask, AESTHETIC } from './features.js';
import { STYLE_IDS } from '../v2/kit/style.js';
import { Net, train } from './net.js';

const normalize = (gen, g) => (gen.normalize ? gen.normalize(g) : gen.traits.normalize(g));

/** The fields a kind can be told to fix: its own, plus the style genome on v2 kinds. */
function fixMaskOf(gen) {
  const L = layout();
  const m = new Float32Array(L.fix.length);
  const ids = [...gen.traits.fields.map((f) => f.id).filter((id) => !STYLE_IDS.includes(id)), ...(hasStyle(gen) ? STYLE_IDS : [])];
  for (const id of ids) {
    const i = fixIndex(gen, id);
    if (i >= 0) m[i] = 1;
  }
  return m;
}

/**
 * Rows from swipes. `scope` 'public' weights users by 1/√n; 'personal' weights all rows alike.
 * `cache` (a Map) reuses feature vectors across calls, keyed by kind and code.
 */
export function toRows(swipes, { scope = 'public', cache = new Map() } = {}) {
  const perUser = new Map();
  for (const s of swipes) perUser.set(s.user, (perUser.get(s.user) ?? 0) + 1);
  const feat = (gen, genome) => {
    const key = `${gen.id}|${gen.traits.encode(genome)}`;
    if (!cache.has(key)) cache.set(key, featurize(gen, genome));
    return cache.get(key);
  };
  const rows = [];
  for (const s of swipes) {
    const gen = generator(s.kind);
    if (!gen) continue;
    const genome = fromCode(gen, s.code);
    if (!genome) continue;
    const w = scope === 'public' ? 1 / Math.sqrt(perUser.get(s.user)) : 1;
    const row = { x: feat(gen, genome), y: s.verdict === 'approve' ? 1 : 0, w, user: s.user, kind: s.kind };
    const flagged = [...(s.fix ?? []), ...Object.keys(s.instead ?? {})];
    if (flagged.length) {
      row.fixMask = fixMaskOf(gen);
      row.fix = new Float32Array(row.fixMask.length);
      for (const id of flagged) {
        const i = fixIndex(gen, id);
        if (i >= 0) row.fix[i] = 1;
      }
    }
    rows.push(row);
    for (const [id, choice] of Object.entries(s.instead ?? {})) {
      const field = gen.traits.fieldById(id);
      if (!field?.choices.some((c) => c.id === choice)) continue;
      const alt = normalize(gen, { ...genome, [id]: choice });
      rows.push({ x: feat(gen, alt), y: 1, w: w * 0.5, user: s.user, kind: s.kind, counterfactual: true });
    }
  }
  return rows;
}

/** A fresh, untrained net shaped for the current layout. */
export function newNet(seed = 'pixelgen') {
  const L = layout();
  return new Net({ dim: L.dim, fix: L.fix.length, seed });
}

/**
 * k-fold accuracy of `fit(rows) → net` on held-out rows (counterfactual rows train but are never
 * scored). Folds are cut by row order after a seeded shuffle.
 */
export function evaluate(rows, fit, { k = 5, seed = 7 } = {}) {
  const real = rows.map((r, i) => i).filter((i) => !rows[i].counterfactual);
  if (real.length < k * 2) return { accuracy: null, n: real.length };
  let a = seed;
  const rnd = () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = real.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [real[i], real[j]] = [real[j], real[i]];
  }
  let right = 0;
  let total = 0;
  for (let f = 0; f < k; f++) {
    const test = new Set(real.filter((_, i) => i % k === f));
    const net = fit(rows.filter((_, i) => !test.has(i)));
    for (const i of test) {
      total++;
      if (net.predict(rows[i].x).beauty >= 0.5 === rows[i].y >= 0.5) right++;
    }
  }
  return { accuracy: right / total, n: real.length };
}

/** Train a model from scratch on rows; the default `fit` for `evaluate` and the trainer. */
export function fit(rows, opts = {}) {
  const net = newNet(opts.seed);
  net.fitNorm(rows, AESTHETIC.length);
  train(net, rows, { l2Mask: l2Mask(), ...opts });
  return net;
}

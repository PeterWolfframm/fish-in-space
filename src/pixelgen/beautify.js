// How the procgen uses a model: to render what it rolled at its best, never to roll one ideal.
//
// - `beautify` keeps every content trait (species, body, form, colours …) as the seed rolled it,
//   and searches only the style genome (light, contrast, palette, dither, outline, look) for the
//   rendering the model likes most.
// - `pickGood` rolls a few candidates and drops the weakest, then picks among the rest by seed.
//   It never takes the best, so a deck or gallery stays as varied as plain rolls.
//
// A "model" is anything with `predict(x) → {beauty, fix}`: a Net, or a `blend` of two.

import { featurize, hasStyle, layout, still, AESTHETIC } from './features.js';
import { STYLE_FIELDS, STYLE_IDS } from '../v2/kit/style.js';
import { hash01 } from '../pixel/rng.js';

const normalize = (gen, g) => (gen.normalize ? gen.normalize(g) : gen.traits.normalize(g));

/** The model's beauty score (0..1) for a sprite. */
export const score = (gen, genome, model) => model.predict(featurize(gen, genome)).beauty;

/** Two models' scores for one sprite, sharing one render; a missing model scores null. */
export function scoreBoth(gen, genome, { public: pub = null, personal = null } = {}) {
  const x = featurize(gen, genome);
  return { public: pub ? pub.predict(x).beauty : null, personal: personal ? personal.predict(x).beauty : null };
}

/** A model whose scores mix `a` (weight 1 − w) and `b` (weight w). */
export function blend(a, b, w = 0.5) {
  if (!a) return b;
  if (!b) return a;
  return {
    predict(x) {
      const p = a.predict(x);
      const q = b.predict(x);
      return { beauty: p.beauty * (1 - w) + q.beauty * w, fix: p.fix.map((v, i) => v * (1 - w) + (q.fix[i] ?? v) * w) };
    },
  };
}

/**
 * The same sprite, re-rendered in the style the model likes best. Coordinate ascent over the
 * style fields, `rounds` times; fields in `fixed` ({look: 'comic'}) are set and never searched.
 * Then one fix-head step: if the model says a style field wants changing (> 0.5), its best
 * alternative is taken unless that costs real beauty. Returns {genome, beauty, before}.
 */
export function beautify(gen, genome, model, { fixed = {}, rounds = 2 } = {}) {
  let best = normalize(gen, { ...genome, ...fixed });
  if (!model || !hasStyle(gen)) return { genome: best, beauty: null, before: null };
  let bestScore = score(gen, best, model);
  const before = bestScore;
  const free = STYLE_FIELDS.filter((f) => !(f.id in fixed));
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    for (const f of free) {
      for (const c of f.choices) {
        if (c.id === best[f.id]) continue;
        const cand = normalize(gen, { ...best, [f.id]: c.id });
        const s = score(gen, cand, model);
        if (s > bestScore + 1e-6) {
          best = cand;
          bestScore = s;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  // The fix head: a style field the model keeps flagging gets its best other value.
  const { fix } = model.predict(featurize(gen, best));
  const L = layout();
  const flagged = free.map((f) => ({ f, p: fix[L.fix.indexOf(f.id)] ?? 0 })).sort((a, b) => b.p - a.p)[0];
  if (flagged && flagged.p > 0.5) {
    let alt = null;
    let altScore = -1;
    for (const c of flagged.f.choices) {
      if (c.id === best[flagged.f.id]) continue;
      const cand = normalize(gen, { ...best, [flagged.f.id]: c.id });
      const s = score(gen, cand, model);
      if (s > altScore) [alt, altScore] = [cand, s];
    }
    if (alt && altScore >= bestScore - 0.02) [best, bestScore] = [alt, altScore];
  }
  return { genome: best, beauty: bestScore, before };
}

/**
 * One roll for `seed` with the weakest of `pool` candidates left out: the bottom `floor` share
 * by score goes, and a seeded pick among the rest comes back. `roll(seed)` makes a genome.
 */
export function pickGood(gen, model, seed, { pool = 4, floor = 0.3, roll = (s) => gen.fromSeed(s) } = {}) {
  const cands = Array.from({ length: pool }, (_, i) => roll(`${seed}~${i}`));
  if (!model) return cands[0];
  const scored = cands.map((g) => ({ g, s: score(gen, g, model) })).sort((a, b) => b.s - a.s);
  const keep = scored.slice(0, Math.max(1, Math.ceil(pool * (1 - floor))));
  return keep[Math.floor(hash01(seed, 911) * keep.length)].g;
}

/** `n` rolls through `pickGood`: a quality floor under a deck or gallery, not an optimiser. */
export function qualityFloor(gen, model, { n = 24, seed = 'deck', ...opts } = {}) {
  return Array.from({ length: n }, (_, i) => pickGood(gen, model, `${seed}:${i}`, opts));
}

/**
 * What drives a model's score, in words people can read: the style values and aesthetics that
 * raise or lower it, averaged over a few probe sprites of the given kinds. Each entry is
 * {label, delta}; `top` of each sign, strongest first.
 */
export function insights(model, gens, { probes = 4, top = 5 } = {}) {
  const effects = new Map();
  const add = (label, d) => {
    const e = effects.get(label) ?? { sum: 0, n: 0 };
    e.sum += d;
    e.n++;
    effects.set(label, e);
  };
  for (const gen of gens) {
    for (let p = 0; p < probes; p++) {
      const base = gen.fromSeed(`insight-${p}`);
      const x = featurize(gen, base);
      const b0 = model.predict(x).beauty;
      // aesthetics: a nudge up on one measure, everything else held
      AESTHETIC.forEach((name, i) => {
        const y = x.slice();
        y[i] = Math.min(1, y[i] + 0.15);
        add(`more ${name}`, model.predict(y).beauty - b0);
      });
      if (!hasStyle(gen)) continue;
      const neutral = normalize(gen, { ...base, ...Object.fromEntries(STYLE_FIELDS.map((f) => [f.id, f.choices[0].id])) });
      const n0 = score(gen, neutral, model);
      for (const f of STYLE_FIELDS) {
        for (const c of f.choices.slice(1)) add(`${f.label}: ${c.label}`, score(gen, normalize(gen, { ...neutral, [f.id]: c.id }), model) - n0);
      }
    }
  }
  const list = [...effects].map(([label, e]) => ({ label, delta: e.sum / e.n }));
  return {
    up: list.filter((e) => e.delta > 0.005).sort((a, b) => b.delta - a.delta).slice(0, top),
    down: list.filter((e) => e.delta < -0.005).sort((a, b) => a.delta - b.delta).slice(0, top),
  };
}

export { still, STYLE_IDS };

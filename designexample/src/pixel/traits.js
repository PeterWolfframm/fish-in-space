// Vendored from the pixel kit — do not edit here.
// Source: kit/web/pixel/traits.js in the Burn-Through repo.
// Run `node scripts/vendor-pixel.mjs` to update, and edit it there.
// A declarative trait schema: one list of fields drives generation, validation, a short shareable
// code, inheritance and an editor UI, so those five can never disagree.
//
// Each field owns a fixed salt, so adding, removing or reordering fields never reshuffles the
// others. Append new fields at the end: old codes must keep decoding.

import { roller } from './rng.js';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Build a trait system.
 *
 * A field is `{ id, choices: [{ id, … }], weights?, salt?, volatility?, dominance?, when? }`:
 * - `weights`   relative likelihoods, one per choice (default: uniform)
 * - `salt`      its own roll stream (default: its position, spaced out)
 * - `volatility` how readily it mutates, relative to the base rate (default 1)
 * - `dominance` how strongly it wins when two sets are combined, 0..1 (default 0.5)
 * - `when(set)` false to force the field to its default — for traits another trait gates
 */
export function defineTraits({ prefix = '', fields }) {
  if (!Array.isArray(fields) || !fields.length) throw new Error('defineTraits needs fields');
  for (const f of fields) {
    if (!f.id || !Array.isArray(f.choices) || !f.choices.length) {
      throw new Error(`field ${f.id ?? '?'} needs an id and at least one choice`);
    }
    if (f.choices.length > DIGITS.length) {
      throw new Error(`field ${f.id} has more than ${DIGITS.length} choices, which a code digit cannot hold`);
    }
  }

  const byId = new Map(fields.map((f) => [f.id, f]));
  // Space salts out so a later field can be given sub-rolls without colliding.
  const saltOf = (f, i) => (f.salt ?? (i + 1) * 16);
  const CODE_MAX = prefix.length + fields.length;

  /** Every field at its first choice, unless the field names a `default`. */
  function defaults() {
    return Object.fromEntries(fields.map((f) => [f.id, f.default ?? f.choices[0].id]));
  }

  /** A set with every field valid: unknown keys dropped, bad values replaced by the default. */
  function normalize(raw) {
    const base = defaults();
    const src = raw && typeof raw === 'object' ? raw : {};
    const out = {};
    for (const f of fields) {
      out[f.id] = f.choices.some((c) => c.id === src[f.id]) ? src[f.id] : base[f.id];
    }
    return applyGates(out, base);
  }

  /** Force gated-off fields to their defaults, so an impossible combination cannot be stored. */
  function applyGates(set, base = defaults()) {
    for (const f of fields) {
      if (f.when && !f.when(set)) set[f.id] = base[f.id];
    }
    return set;
  }

  function encode(set) {
    const s = normalize(set);
    return prefix + fields.map((f) => DIGITS[f.choices.findIndex((c) => c.id === s[f.id])]).join('');
  }

  /** Whether `code` has the right shape — not whether every digit is in range. */
  function isCode(code) {
    return typeof code === 'string'
      && code.length <= CODE_MAX
      && code.startsWith(prefix)
      && /^[0-9a-z]*$/.test(code.slice(prefix.length));
  }

  /**
   * The set a code describes, or null if it is not a code at all.
   *
   * A short code (written before a field existed) and an out-of-range digit both fall back to the
   * default, so saves survive the schema growing.
   */
  function decode(code) {
    const text = String(code ?? '').trim().toLowerCase();
    if (!isCode(text)) return null;
    const digits = text.slice(prefix.length);
    const base = defaults();
    const out = {};
    fields.forEach((f, i) => {
      const v = digits[i] == null ? -1 : DIGITS.indexOf(digits[i]);
      out[f.id] = f.choices[v]?.id ?? base[f.id];
    });
    return applyGates(out, base);
  }

  /** The chosen `choices` entry for a field, with whatever data it carries. */
  function choiceOf(set, fieldId) {
    const f = byId.get(fieldId);
    return f?.choices.find((c) => c.id === set?.[fieldId]) ?? f?.choices[0] ?? null;
  }

  /** Roll a whole set from a seed. Gated-off fields land on their defaults. */
  function fromSeed(seed, band = 0) {
    const { pick, weighted } = roller(seed, band);
    const out = {};
    fields.forEach((f, i) => {
      const salt = saltOf(f, i);
      out[f.id] = f.weights
        ? weighted(f.choices.map((c, ci) => [c.id, f.weights[ci] ?? 1]), salt)
        : pick(f.choices.map((c) => c.id), salt);
    });
    return applyGates(out);
  }

  /**
   * One set from two, field by field. Each field takes a parent's value, biased by the field's
   * `dominance`: a recessive trait needs both parents to carry it to show up reliably.
   */
  function combine(a, b, seed, band = 0) {
    const left = normalize(a);
    const right = normalize(b);
    const { r } = roller(seed, band);
    const out = {};
    fields.forEach((f, i) => {
      if (left[f.id] === right[f.id]) {
        out[f.id] = left[f.id];
        return;
      }
      const bias = typeof f.dominance === 'number' ? f.dominance : 0.5;
      out[f.id] = r(saltOf(f, i) + 7) < bias ? left[f.id] : right[f.id];
    });
    return applyGates(out);
  }

  /** A copy with some fields re-rolled. `rate` is the per-field chance, scaled by volatility. */
  function vary(set, rate, seed, band = 0) {
    const base = normalize(set);
    const { r, pick } = roller(seed, band);
    const out = { ...base };
    fields.forEach((f, i) => {
      const salt = saltOf(f, i) + 11;
      if (r(salt) >= rate * (f.volatility ?? 1)) return;
      // Re-roll among the other choices, so a "mutation" always visibly changes something.
      const others = f.choices.filter((c) => c.id !== base[f.id]).map((c) => c.id);
      if (others.length) out[f.id] = pick(others, salt + 3);
    });
    return applyGates(out);
  }

  return {
    fields,
    prefix,
    codeLength: CODE_MAX,
    defaults,
    normalize,
    encode,
    decode,
    isCode,
    choiceOf,
    fieldById: (id) => byId.get(id) ?? null,
    fromSeed,
    combine,
    vary,
  };
}

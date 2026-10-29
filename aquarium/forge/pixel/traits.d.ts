/** One option a field can take. Carry whatever extra data the renderer needs (hex, size, …). */
export interface TraitChoice {
  id: string;
  [key: string]: unknown;
}

export interface TraitField {
  id: string;
  choices: TraitChoice[];
  /** Relative likelihoods, one per choice. Uniform when absent. */
  weights?: number[];
  /** Its own roll stream. Defaults to its position, spaced out. */
  salt?: number;
  /** How readily it mutates, relative to the base rate. Default 1. */
  volatility?: number;
  /** How strongly it wins when two sets are combined, 0..1. Default 0.5. */
  dominance?: number;
  /** The value used when nothing else applies. Defaults to the first choice. */
  default?: string;
  /** Return false to force the field to its default — for traits another trait gates. */
  when?: (set: TraitSet) => boolean;
  [key: string]: unknown;
}

/** A field id to the id of its chosen option. */
export type TraitSet = Record<string, string>;

export interface TraitSystem {
  readonly fields: TraitField[];
  readonly prefix: string;
  readonly codeLength: number;

  defaults(): TraitSet;
  /** Unknown keys dropped, bad values replaced, gated fields forced to their defaults. */
  normalize(raw: unknown): TraitSet;
  encode(set: TraitSet): string;
  /** Whether it has the right shape — not whether every digit is in range. */
  isCode(code: unknown): boolean;
  /** Null when it is not a code at all; short or out-of-range digits fall back to defaults. */
  decode(code: unknown): TraitSet | null;
  choiceOf(set: TraitSet | null | undefined, fieldId: string): TraitChoice | null;
  fieldById(id: string): TraitField | null;

  fromSeed(seed: string | number, band?: number): TraitSet;
  /** One set from two, field by field, biased by each field's dominance. */
  combine(a: TraitSet, b: TraitSet, seed: string | number, band?: number): TraitSet;
  /** A copy with some fields re-rolled; `rate` is per field, scaled by volatility. */
  vary(set: TraitSet, rate: number, seed: string | number, band?: number): TraitSet;
}

export function defineTraits(spec: { prefix?: string; fields: TraitField[] }): TraitSystem;

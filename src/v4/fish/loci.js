// fish4's quantitative genome: fifteen diploid loci, each two allele fields holding 0..15. A
// child takes one allele from each parent (breeding.js), so selection moves a locus about one
// allele step a generation and a pure line can fix it. What a fish shows is the mean of its two
// alleles (or the higher one, for a dominant-high locus), scaled to 0..1.
//
// Loci never reach the paint: they feed stats.js, rarity.js and reproduction.js. Append new loci
// at the end with fresh salts (see .claude/skills/extend-fish4).

import { roller } from '../../pixel/rng.js';

/** Sixteen allele steps. */
export const ALLELE_STEPS = 16;
export const alleleIds = Array.from({ length: ALLELE_STEPS }, (_, i) => `a${i}`);
const ALLELES = alleleIds.map((id, i) => ({ id, label: String(i) }));

/** A bell over 0..15 centred on 7.5: most fish sit mid-range, the ends are worth chasing. */
const BELL = [1, 2, 4, 7, 11, 15, 18, 20, 20, 18, 15, 11, 7, 4, 2, 1];
/** Skewed low: a trait nearly every fish lacks (aether, the Mythic potential). */
const RARE_HIGH = [520, 200, 90, 45, 24, 13, 8, 5, 3, 2, 1.5, 1, 0.7, 0.5, 0.3, 0.2];

/**
 * The loci, in code order. `low`/`high` name the ends for the UI; `dominantHigh` shows the higher
 * allele mostly (aggression: one hot-headed parent is enough). `stats` lists what it feeds.
 */
export const LOCI = [
  { id: 'metabolism', label: 'Metabolism', low: 'slow', high: 'fast', stats: ['metabolicRate', 'appetite', 'growthRate'] },
  { id: 'vigor', label: 'Vigor', low: 'delicate', high: 'hardy', stats: ['hardiness', 'lifespan'] },
  { id: 'resilience', label: 'Resilience', low: 'skittish', high: 'unflappable', stats: ['stressResistance'] },
  { id: 'boldness', label: 'Boldness', low: 'shy', high: 'bold', stats: ['boldness', 'curiosity'] },
  { id: 'aggression', label: 'Aggression', low: 'placid', high: 'fiery', dominantHigh: 0.35, stats: ['aggression', 'territoriality', 'predatoryDrive'] },
  { id: 'sociability', label: 'Sociability', low: 'loner', high: 'gregarious', stats: ['sociability', 'schooling'] },
  { id: 'thermal', label: 'Thermal set-point', low: 'cool', high: 'warm', stats: ['idealTempC'] },
  { id: 'acidity', label: 'pH set-point', low: 'soft & acid', high: 'hard & alkaline', stats: ['idealPH'] },
  { id: 'zone', label: 'Depth preference', low: 'bottom', high: 'surface', stats: ['verticalPref'] },
  { id: 'energy', label: 'Energy', low: 'languid', high: 'zippy', stats: ['energy', 'stamina', 'swimSpeed'] },
  { id: 'fertility', label: 'Fertility', low: 'shy breeder', high: 'prolific', stats: ['fertility', 'broodLimit'] },
  { id: 'fecundity', label: 'Fecundity', low: 'few eggs', high: 'many eggs', stats: ['clutchSize'] },
  { id: 'maturation', label: 'Maturation', low: 'grows up fast', high: 'slow to mature', stats: ['maturationMul'] },
  { id: 'longevity', label: 'Longevity', low: 'brief', high: 'long-lived', stats: ['lifespan'] },
  { id: 'aether', label: 'Aether', low: 'none', high: 'saturated', weights: RARE_HIGH, stats: ['mythicPotential'] },
];

export const LOCUS_IDS = LOCI.map((l) => l.id);
const BASE_SALT = 2064;

/** The two genome fields of every locus, salts from 2064 up (32 apart: A and B). */
export const LOCUS_FIELDS = LOCI.flatMap((l, k) => ['A', 'B'].map((side, j) => ({
  id: `${l.id}${side}`,
  label: `${l.label}${side === 'B' ? ' ·' : ''}`,
  group: 'loci',
  locus: l.id,
  choices: ALLELES,
  weights: l.weights ?? BELL,
  default: l.weights ? 'a0' : 'a7',
  salt: BASE_SALT + k * 32 + j * 16,
  volatility: 0,
  hidden: true,
})));

export const alleleOf = (id) => Math.max(0, alleleIds.indexOf(id));

/** A locus as shown: 0..1. */
export function locusValue(set, id) {
  const def = LOCI.find((l) => l.id === id);
  const a = alleleOf(set[`${id}A`]);
  const b = alleleOf(set[`${id}B`]);
  const mean = (a + b) / 2;
  const v = def?.dominantHigh ? mean + (Math.max(a, b) - mean) * def.dominantHigh * 2 : mean;
  return v / (ALLELE_STEPS - 1);
}

/** Every locus as shown, plus whether it is homozygous (both alleles the same). */
export function lociOf(set) {
  const out = {};
  for (const l of LOCI) {
    const a = alleleOf(set[`${l.id}A`]);
    const b = alleleOf(set[`${l.id}B`]);
    out[l.id] = { value: locusValue(set, l.id), a, b, homozygous: a === b };
  }
  return out;
}

/**
 * Alleles for a fish that has none stored (a v1 or fish3 code): rolled from its look, so the same
 * fish always gets the same hidden genes. `weightOf(field, ci)` lets params reshape the bells.
 */
export function latentLoci(key, weightOf = (f, ci) => f.weights[ci]) {
  const { weighted } = roller(`latent:${key}`, 0);
  const out = {};
  for (const f of LOCUS_FIELDS) out[f.id] = weighted(f.choices.map((c, ci) => [c.id, weightOf(f, ci)]), f.salt);
  return out;
}

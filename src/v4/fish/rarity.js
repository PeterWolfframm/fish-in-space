// fish4's rarity: a continuous score in points, read off the whole genome, and six tiers as labels
// over it. Points are surprisal: how unlikely the fish's looks are under the params' own odds
// (−log2 p, over the most likely choice), plus what the genes, sports, hybrids, signatures,
// features, terrain, loci and lineage add. Each source is itemised in `breakdown`.
//
//   rarityOf(set, P?) → { points, tier, computed, stored, fraction, shown, breakdown[] }
//
// The shown tier is never below the stored one (`set.rarity`), so an import is never demoted.
// Pure: the same fish and params always give the same score.

import { fish3Traits, NOT_LOOKS } from '../../v3/fish/genome.js';
import { genetics, phenotype } from '../../v3/fish/phenotype.js';
import { HYBRIDS } from '../../v3/fish/bodies.js';
import { fish4Traits, toFish3 } from './genome.js';
import { lociOf, LOCI } from './loci.js';
import { resolveParams, weightOf } from './params.js';
import { bodyOf, extOf } from './bodies/index.js';
import { terrainOf } from './ecology4.js';
import { TIERS, TIER_LABELS, tierRank } from './rules.js';
import { FEATURES } from './features/registry.js';

export { TIERS, TIER_LABELS };

/**
 * Tier colours, WoW-style, checked for contrast on the dark lab background (Rare lifted from
 * #0070dd). Mythic shimmers between `myth` and `mythShimmer`.
 */
export const RARITY_COLORS = {
  common: '#9d9d9d',
  uncommon: '#1eff00',
  rare: '#3b8cff',
  epic: '#a335ee',
  legendary: '#ff8000',
  myth: '#ff3d6e',
  mythShimmer: '#ffd1dc',
};

/** Fields that are not looks, or are scored by their own source below. */
const OWN_SOURCE = new Set([
  ...NOT_LOOKS, 'rarity', 'morph', 'iridescence', 'hybrid', 'signature', 'relic', 'body', 'mood', 'damage', 'chroma',
]);
const LOOK_FIELDS = fish3Traits.fields.filter((f) => !OWN_SOURCE.has(f.id)).map((f) => fish4Traits.fieldById(f.id));

const TERRAIN_POINTS = { water: 0, lava: 3, sand: 3, nuclear: 3, aether: 12 };
const num = (id) => Number(String(id).slice(1)) || 0;
const round = (x) => Math.round(x * 100) / 100;

/** The tier for a score, under the params' thresholds. */
export function tierOf(points, P) {
  const th = P.rarityPoints.thresholds;
  let tier = 'common';
  for (const t of TIERS.slice(1)) if (points >= th[t]) tier = t;
  return tier;
}

/** Where in its tier a score sits, 0..1 (Mythic: how far past the threshold, capped). */
function fractionOf(points, tier, P) {
  const th = { common: 0, ...P.rarityPoints.thresholds };
  const i = TIERS.indexOf(tier);
  const lo = th[tier];
  const hi = i < TIERS.length - 1 ? th[TIERS[i + 1]] : lo * 2;
  return round(Math.max(0, Math.min(1, (points - lo) / (hi - lo))));
}

/** Excess surprisal of one field's value: bits over its most likely choice under P. */
function bitsOf(f, value, P, set) {
  const ws = f.choices.map((_, ci) => weightOf(f, ci, P, set));
  const ci = f.choices.findIndex((c) => c.id === value);
  if (ci < 0) return 0;
  const sum = ws.reduce((a, b) => a + b, 0);
  const max = Math.max(...ws);
  if (!sum || !max) return 0;
  // A choice the params never roll still counts as very rare, not infinite.
  const p = Math.max(ws[ci], max * 1e-3) / sum;
  return Math.max(0, Math.log2(max / sum) - Math.log2(p));
}

/** The score and its itemised sources. `P`: params or a preset id (default: the default preset). */
export function rarityOf(set, params) {
  const P = typeof params === 'object' && params?.rarityPoints ? params : resolveParams(params);
  const R = P.rarityPoints;
  const f3 = toFish3(set);
  const ph = phenotype(f3, -1, extOf(set));
  const g = genetics(f3);
  const breakdown = [];
  const add = (source, label, points) => {
    if (points > 0.005) breakdown.push({ source, label, points: round(points) });
  };

  // --- looks: surprisal over the params' odds -----------------------------------------------------
  for (const f of LOOK_FIELDS) {
    const bits = bitsOf(f, set[f.id], P, set);
    if (bits > R.minBits) add('looks', `${f.label.toLowerCase()}: ${f.choices.find((c) => c.id === set[f.id])?.label ?? set[f.id]}`, (bits - R.minBits) * R.bitPoints);
  }

  // --- genes, morphs, sports --------------------------------------------------------------------------
  const both = set.geneA === set.geneB && set.geneA !== 'wild';
  if (both) add('genes', `homozygous ${set.geneA}`, R.homozygous);
  else if (g.morph !== 'wild') add('genes', `shows ${g.morph}`, R.homozygous / 2);
  for (const c of g.carries) add('genes', `carries ${c}`, R.carrier);
  if (set.morph && set.morph !== 'auto') add('sport', `${set.morph} morph`, R.morph);
  if (set.iridescence && set.iridescence !== 'none') add('sport', `${set.iridescence} iridescence`, R.iridescence);
  if (set.hybrid && set.hybrid !== 'none') add('hybrid', `${set.hybrid} hybrid`, R.hybrid + (HYBRIDS[set.hybrid]?.sterile ? 2 : 0));
  if (ph.signature && ph.signature !== 'none') add('signature', `signature: ${ph.signature}`, R.signature);
  if (ph.relic && ph.relic !== 'none') add('relic', `relic: ${ph.relic}`, R.relic);
  if (num(set.chroma) > 3) add('looks', `vividness ${set.chroma}`, num(set.chroma) - 3);

  // --- features (the helmet, and any later module) -------------------------------------------------
  for (const f of FEATURES) {
    const v = set[f.id];
    if (v && v !== f.none) add('feature', `${f.id}: ${v}`, R.feature);
  }

  // --- where it lives: terrain and form ------------------------------------------------------------
  const terrain = terrainOf(set);
  add('terrain', `${terrain} terrain`, TERRAIN_POINTS[terrain] ?? 0);
  const rec = bodyOf(set);
  if (!rec.fish3 && rec.weight < 1) add('form', `${rec.label} (a scarce form)`, -Math.log2(rec.weight) * 3);

  // --- loci: extreme rolls, and the aether -----------------------------------------------------------
  const loci = lociOf(set);
  for (const l of LOCI) {
    const v = loci[l.id].value;
    if (l.id === 'aether') {
      add('loci', 'aether potential', v * R.aether);
      continue;
    }
    const z = Math.abs(v - 0.5) * 2;
    if (z > R.extremeLocus) add('loci', `extreme ${l.label.toLowerCase()}`, (z - R.extremeLocus) * R.locusPoints);
  }

  // --- lineage -------------------------------------------------------------------------------------
  add('lineage', `generation ${num(set.generation)}`, Math.min(R.generationCap, num(set.generation) * R.perGeneration));
  add('lineage', `line purity ${num(set.purity)}`, num(set.purity) * R.perPurity);

  breakdown.sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));
  const points = round(breakdown.reduce((a, b) => a + b.points, 0));
  const computed = tierOf(points, P);
  const stored = TIERS.includes(set.rarity) ? set.rarity : 'common';
  const shown = tierRank(stored) > tierRank(computed) ? stored : computed;
  return {
    points,
    tier: shown,
    computed,
    stored,
    shown,
    label: TIER_LABELS[shown],
    color: RARITY_COLORS[shown],
    fraction: shown === computed ? fractionOf(points, computed, P) : 0,
    breakdown,
  };
}

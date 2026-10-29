// fish4's stats: every behaviour and husbandry coefficient a fish has, as plain JSON, each with
// the evidence behind it (the same idea as fish3's ecology `because`). Behaviour models read
// `behaviourProfile`, a flat, versioned vector of the same numbers.
//
//   statsOf(set, { rules?, tier? }) → { [stat]: { value 0..1, real?, unit?, display, word, because } }
//
// Order: body baseline (fish3's ecology) → family priors → loci → size, tier → traits →
// features → rules → clamp. Pure: the same fish and rules always give the same numbers.

import { hash01 } from '../../pixel/rng.js';
import { HYBRIDS } from '../../v3/fish/bodies.js';
import { phenotype } from '../../v3/fish/phenotype.js';
import { ecologyOf } from '../../v3/fish/ecology.js';
import { SCALES, PH, MARINE_PH } from '../../v3/fish/ecology-data.js';
import {
  STATS, STAT_IDS, STATS_VERSION, statById, TEMPER_AGGRESSION, PREDATION_BY_DIET, DIET_BREADTH, SOCIAL, LEVEL_Y, CURRENT_ENERGY,
  CIRCADIAN, SALINITY_TOLERANCE, TEMP_TOLERANCE, FLAT_BASE, LOCUS_EFFECTS, SIZE_EFFECTS, TIER_EFFECTS, TRAIT_EFFECTS,
} from './stats-data.js';
import DEFAULT_RULES from './data/rules.js';
import { lociOf } from './loci.js';
import { toFish3, jitterKey } from './genome.js';
import { extOf } from './bodies/index.js';
import { FEATURES } from './features/registry.js';
import { familyOf, FAMILIES } from './taxonomy.js';
import { test, tierRank, SIZE_ORDER } from './rules.js';

export { STATS, STAT_IDS, STATS_VERSION, statById, DEFAULT_RULES };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const toUnit = (s, real) => (real - s.real[0]) / (s.real[1] - s.real[0]);
export const realOf = (s, v) => s.real[0] + v * (s.real[1] - s.real[0]);
const mid = ([a, b]) => (a + b) / 2;
const WORDS = ['very low', 'low', 'moderate', 'high', 'very high'];

/** The rule list for an option: an array as given, 'default' / nothing → the default rules. */
export const rulesFor = (rules) => (Array.isArray(rules) ? rules : DEFAULT_RULES);

/**
 * The facts a condition can ask about: fish3's ecology values plus a few resolved genes. `ext` is
 * the fish4 body or pigment (bodies/index.js extOf), if any.
 */
export function factsOf(f3, ext) {
  const ph = phenotype(f3, -1, ext);
  const eco = ecologyOf(f3, ext);
  const facts = {};
  for (const k of Object.keys(SCALES)) facts[k] = eco[k]?.value;
  Object.assign(facts, {
    morph: ph.morph,
    longfin: ph.longfin,
    bubble: ph.bubble,
    hybrid: Boolean(HYBRIDS[ph.body]),
    sterile: Boolean(HYBRIDS[ph.body]?.sterile),
    male: Boolean(ph.male),
    dimorphic: Boolean(ph.dimorphic),
    signature: ph.signature,
    relic: ph.relic,
  });
  return { ph, eco, facts };
}

/** Everything a condition can look up for one fish, given its stats so far. */
export function lookFor(set, { facts, loci, family, tier, stats }) {
  return (kind, id) => {
    switch (kind) {
      case 'field': return set[id];
      case 'fact': return facts[id];
      case 'stat': return stats?.[id];
      case 'locus': return loci[id]?.value;
      case 'taxon': return id === 'family' ? family : id === 'order' ? FAMILIES[family]?.order : undefined;
      case 'tier': return tier;
      case 'size': return set.size;
      default: return undefined;
    }
  };
}

/**
 * Every stat for a fish4 set. `opts.rules` replaces the default rules (the studio passes its
 * edited list); `opts.tier` is the shown rarity tier (rarity.js), else the stored one.
 */
export function statsOf(set, opts = {}) {
  const f3 = toFish3(set);
  const { ph, eco, facts } = factsOf(f3, extOf(set));
  const loci = lociOf(set);
  const family = familyOf(ph.body);
  const tier = opts.tier ?? set.rarity;
  const key = jitterKey(set);

  const v = {};
  const because = {};
  const add = (stat, delta, source, label) => {
    if (!delta || !(stat in v)) return;
    v[stat] += delta;
    because[stat].push({ source, label, delta: Math.round(delta * 1000) / 1000 });
  };
  const base = (stat, value, label) => {
    v[stat] = value;
    because[stat] = [{ source: 'base', label, value: Math.round(value * 1000) / 1000 }];
  };

  // --- 1. baseline from the body's ecology ------------------------------------------------
  const S = (id) => statById(id);
  const tempC = eco.care.tempC;
  const pH = eco.salinity.value === 'marine' ? MARINE_PH : PH[eco.hardness.value] ?? eco.care.pH;
  const social = SOCIAL[eco.sociality.value] ?? SOCIAL.solitary;
  const temper = SCALES.temperament.indexOf(eco.temperament.value);
  base('idealTempC', toUnit(S('idealTempC'), mid(tempC)), `${eco.temp.value} water (${tempC[0]}–${tempC[1]} °C)`);
  base('tempTolerance', TEMP_TOLERANCE[eco.temp.value] ?? 0.5, `${eco.temp.value} water`);
  base('idealPH', toUnit(S('idealPH'), mid(pH)), `${eco.salinity.value === 'marine' ? 'marine' : `${eco.hardness.value} water`} (pH ${pH[0]}–${pH[1]})`);
  base('phTolerance', eco.salinity.value === 'marine' ? 0.25 : FLAT_BASE.phTolerance, `${eco.salinity.value} water`);
  base('salinityTolerance', SALINITY_TOLERANCE[eco.salinity.value] ?? 0.3, `${eco.salinity.value} water`);
  base('aggression', TEMPER_AGGRESSION[Math.max(0, temper)] ?? 0.3, `${eco.temperament.value} temperament`);
  base('predatoryDrive', PREDATION_BY_DIET[eco.diet.value] ?? 0.3, `${eco.diet.value}`);
  base('territoriality', social.territoriality, `${eco.sociality.value}`);
  base('sociability', social.sociability, `${eco.sociality.value}`);
  base('schooling', social.schooling, `${eco.sociality.value}`);
  base('verticalPref', LEVEL_Y[eco.level.value] ?? 0.5, `${eco.level.value} level`);
  base('energy', CURRENT_ENERGY[eco.current.value] ?? 0.45, `likes ${eco.current.value} water`);
  base('circadian', CIRCADIAN[eco.activity.value] ?? 0.3, eco.activity.value);
  base('dietBreadth', DIET_BREADTH[eco.diet.value] ?? 0.5, eco.diet.value);
  for (const [id, value] of Object.entries(FLAT_BASE)) if (!(id in v)) base(id, value, 'every fish');
  const cur = SCALES.current.indexOf(eco.current.value);
  if (cur > 1) add('stamina', (cur - 1) * 0.08, 'body', `likes ${eco.current.value} water`);
  if (cur > 1) add('swimSpeed', (cur - 1) * 0.1, 'body', `likes ${eco.current.value} water`);
  if (temper === 0) add('boldness', -0.1, 'body', 'skittish kind');

  // --- 2. family priors ---------------------------------------------------------------------
  for (const [stat, d] of Object.entries(FAMILIES[family]?.priors ?? {})) add(stat, d, 'family', family);

  // --- 3. loci --------------------------------------------------------------------------------
  for (const [stat, effects] of Object.entries(LOCUS_EFFECTS)) {
    for (const [locus, w, centre = 0.5] of effects) add(stat, (loci[locus].value - centre) * w, 'locus', locus);
  }

  // --- 4. size and tier -------------------------------------------------------------------------
  const step = SIZE_ORDER.indexOf(set.size) - 2;
  if (step) for (const [stat, d] of Object.entries(SIZE_EFFECTS)) add(stat, d * step, 'size', set.size);
  const rank = tierRank(tier);
  if (rank) for (const [stat, d] of Object.entries(TIER_EFFECTS)) add(stat, d * rank, 'tier', tier);

  // --- 5. traits --------------------------------------------------------------------------------
  const preLook = lookFor(set, { facts, loci, family, tier });
  for (const t of TRAIT_EFFECTS) {
    if (!test(t.when, preLook, key)) continue;
    for (const [stat, d] of Object.entries(t.then)) add(stat, d, 'trait', t.label);
  }

  // --- 6. features ------------------------------------------------------------------------------
  for (const f of FEATURES) {
    const value = set[f.id];
    if (!value || value === f.none) continue;
    for (const [stat, map] of Object.entries(f.influences?.stats ?? {})) add(stat, map[value] ?? map['*'] ?? 0, 'feature', `${f.id}: ${value}`);
  }

  // --- 7. rules (against the stats as they stand now) -------------------------------------------
  const pre = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clamp01(x)]));
  const look = lookFor(set, { facts, loci, family, tier, stats: pre });
  const fired = [];
  for (const rule of rulesFor(opts.rules)) {
    if (!test(rule.when, look, key)) continue;
    fired.push(rule.id);
    for (const op of rule.then ?? []) {
      for (const stat of op.stats ?? [op.stat]) {
        if (!(stat in v)) continue;
        const label = rule.note ? `${rule.id}: ${rule.note}` : rule.id;
        if ('set' in op) add(stat, op.set - v[stat], 'rule', label);
        if ('mul' in op) add(stat, v[stat] * (op.mul - 1), 'rule', label);
        if ('add' in op) add(stat, op.add, 'rule', label);
        if ('jitter' in op) add(stat, (hash01(`${key}:${rule.id}:${stat}`, 4111) * 2 - 1) * op.jitter, 'rule', label);
      }
    }
  }

  // --- 8. clamp and present -----------------------------------------------------------------------
  const out = {};
  for (const s of STATS) {
    const value = clamp01(v[s.id]);
    const word = s.id === 'verticalPref' ? zoneOf(value) : WORDS[Math.min(4, Math.floor(value * 5))];
    const stat = { value: Math.round(value * 1000) / 1000, word, because: because[s.id] };
    if (s.real) {
      const r = realOf(s, value);
      const k = 10 ** s.digits;
      stat.real = Math.round(r * k) / k;
      stat.unit = s.unit;
      stat.display = `${stat.real.toFixed(s.digits)} ${s.unit}`;
    } else stat.display = `${Math.round(value * 100)} · ${word}`;
    out[s.id] = stat;
  }
  out.verticalPref.zone = zoneOf(out.verticalPref.value);
  out.schooling.groupSize = groupSizeOf(out.schooling.value);
  // Not enumerable (the JSON stays plain): which rules fired, and a lookup over the final stats
  // for names, flavour and text matching.
  const finalStats = Object.fromEntries(STATS.map((s) => [s.id, out[s.id].value]));
  Object.defineProperty(out, 'rulesFired', { value: fired, enumerable: false });
  Object.defineProperty(out, 'look', { value: lookFor(set, { facts, loci, family, tier, stats: finalStats }), enumerable: false });
  return out;
}

/** Tank zone from the vertical preference. */
export const zoneOf = (v) => (v >= 0.66 ? 'top' : v <= 0.33 ? 'bottom' : 'mid');
/** How many of its kind it wants around it. */
export const groupSizeOf = (schooling) => 1 + Math.round(Math.max(0, schooling - 0.1) * 12);

/**
 * The flat numeric vector behaviour models read: every stat's 0..1 value, real numbers for the
 * unit stats (`<id>Real`), the zone and group size. `v` is STATS_VERSION.
 */
export function behaviourProfile(set, opts) {
  const st = statsOf(set, opts);
  const out = { v: STATS_VERSION };
  for (const s of STATS) {
    out[s.id] = st[s.id].value;
    if (s.real) out[`${s.id}Real`] = st[s.id].real;
  }
  out.zone = st.verticalPref.zone;
  out.groupSize = st.schooling.groupSize;
  return out;
}

const PERSONALITY = ['aggression', 'boldness', 'territoriality', 'sociability', 'energy', 'curiosity', 'appetite', 'stressResistance'];

/**
 * One plain line that says what the numbers say, so a description always matches the genes:
 * the three most pronounced personality stats, then zone, water and company.
 */
export function summaryOf(stats) {
  const marked = PERSONALITY.map((id) => ({ id, d: stats[id].value - 0.5 }))
    .filter((x) => Math.abs(x.d) >= 0.15)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(({ id, d }) => (d > 0 ? statById(id).high : statById(id).low));
  if (stats.predatoryDrive.value >= 0.7) marked.unshift('a hunter');
  if (stats.circadian.value >= 0.7) marked.push('nocturnal');
  const zone = { top: 'the surface', mid: 'mid-water', bottom: 'the bottom' }[stats.verticalPref.zone];
  const n = stats.schooling.groupSize;
  const company = n >= 4 ? `happiest in a group of ${n}` : n >= 2 ? 'likes a companion' : 'fine on its own';
  const lead = marked.length ? `${marked.join(', ').replace(/^./, (c) => c.toUpperCase())}. ` : 'Even-tempered. ';
  return `${lead}Keeps to ${zone}, ${stats.idealTempC.display} at pH ${stats.idealPH.real.toFixed(1)}; ${company}.`;
}

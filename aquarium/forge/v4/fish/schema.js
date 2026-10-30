// PARAM_SCHEMA: every knob in params.js, with its type, range, label and group, for the studio's
// sliders, the CLI's --param, and validateParams (which catches typos and out-of-range values
// before they quietly roll odd fish).
//
//   PARAM_SCHEMA[i] = { path, type, label, group, min?, max?, choices?, keys?, value?, note?, reserved? }
//     type: number | int | bool | string | enum | list (of choices) | tuple (of numbers, `length`)
//           | map (`keys` → numbers in value.min..value.max) | choiceWeights (field → choice → ×)
//   validateParams(p) → { ok, errors: [{ path, message }], warnings: [{ path, message }] }
//   setParam(p, 'clusters.cohesion', 0.5) → a new params object (for --param and sliders)

import { fish4Traits as T } from './genome.js';
import { PRESETS, resolveParams, isEcotype } from './params.js';
import { STICK, terrainWeights } from './ecotype.js';
import { TERRAIN_IDS, REGIONS, NICHE_IDS } from './data/terrains.js';
import { BODY_RECORDS } from './bodies/index.js';
import { LINKS, KITS } from './data/links.js';
import CONSTRAINTS from './data/constraints.js';
import { TIERS } from './rules.js';

export const PARAM_GROUPS = [
  { id: 'algorithm', label: 'Algorithm' },
  { id: 'places', label: 'Terrains, regions, niches, bodies' },
  { id: 'clusters', label: 'Species and clustering' },
  { id: 'procgen', label: 'Links, guard, palettes, mutation, batches' },
  { id: 'looks', label: 'Odds of looks' },
  { id: 'rarity', label: 'Rarity' },
  { id: 'breeding', label: 'Breeding and Mythics' },
  { id: 'economy', label: 'Economy' },
  { id: 'text', label: 'Names and text' },
];

const REGION_IDS = Object.keys(REGIONS).filter((id) => id !== 'unmapped');
const STICK_GROUPS = Object.keys(STICK);
const weight = { min: 0, max: 100 };
const mul = { min: 0, max: 20 };

export const PARAM_SCHEMA = [
  // algorithm
  { path: 'id', type: 'string', label: 'Preset id', group: 'algorithm' },
  { path: 'label', type: 'string', label: 'Label', group: 'algorithm' },
  { path: 'note', type: 'string', label: 'Note', group: 'algorithm' },
  { path: 'base', type: 'enum', choices: Object.keys(PRESETS), label: 'Built on preset', group: 'algorithm' },
  { path: 'algo', type: 'enum', choices: ['ecotype-1', 'ecotype', 'classic'], label: 'Algorithm', group: 'algorithm', note: 'ecotype-1: places and species; classic: fish3, field by field. Plain `ecotype` means the newest ecotype roll' },
  { path: 'rules', type: 'rules', label: 'Stat rules', group: 'algorithm', note: "'default' or an array of rules (stats-data.js)" },
  // places
  { path: 'terrains', type: 'map', keys: TERRAIN_IDS, value: weight, label: 'Terrain odds', group: 'places', note: 'missing = the terrain’s own weight; locked terrains need `unlocked`' },
  { path: 'unlocked', type: 'list', choices: TERRAIN_IDS, label: 'Unlocked terrains', group: 'places' },
  { path: 'regions', type: 'map', keys: REGION_IDS, value: mul, label: 'Region odds ×', group: 'places' },
  { path: 'niches', type: 'map', keys: NICHE_IDS, value: mul, label: 'Niche odds ×', group: 'places' },
  { path: 'bodies', type: 'map', keys: Object.keys(BODY_RECORDS), value: mul, label: 'Body odds ×', group: 'places' },
  // clusters
  { path: 'clusters.cohesion', type: 'number', min: 0, max: 1, label: 'Cohesion', group: 'clusters', note: 'how much a fish looks like its species' },
  { path: 'clusters.speciesPerNiche', type: 'int', min: 1, max: 8, label: 'Species per niche', group: 'clusters' },
  { path: 'clusters.zipf', type: 'number', min: 0, max: 4, label: 'Dominance (Zipf)', group: 'clusters', note: 'higher: one species dominates its niche' },
  { path: 'clusters.drift', type: 'number', min: 0, max: 4, label: 'Proportion drift', group: 'clusters' },
  { path: 'clusters.lociStrength', type: 'number', min: 0, max: 3, label: 'Niche pull on genes', group: 'clusters' },
  { path: 'clusters.stick', type: 'map', keys: STICK_GROUPS, value: { min: 0, max: 1 }, label: 'Stickiness per group', group: 'clusters' },
  { path: 'bodyPrefer', type: 'number', min: 0, max: 1, label: 'Body’s own looks', group: 'clusters', note: 'fish3: 0.6' },
  // procgen
  { path: 'links.strength', type: 'number', min: 0, max: 4, label: 'Link strength', group: 'procgen', note: '0 = links off' },
  { path: 'links.off', type: 'list', choices: LINKS.map((l) => l.id), label: 'Links off', group: 'procgen' },
  { path: 'links.kitChance', type: 'number', min: 0, max: 1, label: 'Kit inheritance', group: 'procgen', note: `kits: ${KITS.map((k) => k.id).join(', ')}` },
  { path: 'guard.enabled', type: 'bool', label: 'Aesthetic guard', group: 'procgen' },
  { path: 'guard.off', type: 'list', choices: CONSTRAINTS.map((c) => c.id), label: 'Guards off', group: 'procgen' },
  { path: 'palette.strength', type: 'number', min: 0, max: 3, label: 'Biome palette strength', group: 'procgen' },
  { path: 'mutation.strength', type: 'number', min: 0, max: 4, label: 'Mutation pressure', group: 'procgen' },
  { path: 'mutation.sport', type: 'number', min: 0, max: 1, label: 'Sport chance', group: 'procgen' },
  { path: 'batch.pyramid', type: 'tuple', length: 3, min: 0, max: 1, label: 'Trophic shares', group: 'procgen', note: '[base, middle, top]' },
  { path: 'batch.diversity', type: 'number', min: 0, max: 0.95, label: 'Batch diversity', group: 'procgen' },
  { path: 'batch.maxSchool', type: 'int', min: 1, max: 12, label: 'Largest school', group: 'procgen' },
  // looks
  { path: 'weights', type: 'choiceWeights', label: 'Choice odds ×', group: 'looks', note: '{ field: { choice: × } }' },
  { path: 'spread', type: 'number', min: 0.2, max: 4, label: 'Proportion spread', group: 'looks' },
  { path: 'color.vivid', type: 'number', min: 0, max: 1, label: 'Vivid colour', group: 'looks' },
  { path: 'color.chroma', type: 'tuple', length: 7, min: 0, max: 100, label: 'Chroma gene odds', group: 'looks' },
  { path: 'features', type: 'map', keys: T.fields.filter((f) => f.feature).map((f) => f.id), value: mul, label: 'Feature odds ×', group: 'looks' },
  { path: 'loci.spread', type: 'number', min: 0.2, max: 4, label: 'Gene spread', group: 'looks' },
  // rarity
  { path: 'rarity', type: 'map', keys: TIERS, value: weight, label: 'Wild tier odds', group: 'rarity' },
  { path: 'rarityPoints.thresholds', type: 'map', keys: TIERS.slice(1), value: { min: 0, max: 200 }, label: 'Tier thresholds', group: 'rarity' },
  ...['minBits', 'bitPoints', 'homozygous', 'carrier', 'morph', 'iridescence', 'hybrid', 'signature', 'relic', 'feature', 'aether', 'locusPoints', 'perGeneration', 'generationCap', 'perPurity'].map((k) => ({ path: `rarityPoints.${k}`, type: 'number', min: 0, max: 100, label: `Points: ${k}`, group: 'rarity' })),
  { path: 'rarityPoints.extremeLocus', type: 'number', min: 0, max: 1, label: 'Extreme gene from', group: 'rarity' },
  // breeding
  { path: 'breeding.broodLimit', type: 'int', min: 1, max: 100, label: 'Brood limit', group: 'breeding' },
  { path: 'breeding.tierMul', type: 'map', keys: TIERS, value: { min: 0, max: 4 }, label: 'Brood limit × per tier', group: 'breeding' },
  { path: 'breeding.fertilitySpread', type: 'number', min: 0, max: 1, label: 'Fertility spread', group: 'breeding' },
  { path: 'breeding.mythicBroodLimit', type: 'int', min: 0, max: 100, nullable: true, label: 'Mythic brood limit', group: 'breeding' },
  { path: 'breeding.clutchMin', type: 'int', min: 1, max: 20, label: 'Clutch min', group: 'breeding' },
  { path: 'breeding.clutchMax', type: 'int', min: 1, max: 20, label: 'Clutch max', group: 'breeding' },
  { path: 'breeding.cooldownMul', type: 'number', min: 0, max: 10, label: 'Cooldown ×', group: 'breeding' },
  { path: 'breeding.maturationMul', type: 'number', min: 0, max: 10, label: 'Maturation ×', group: 'breeding' },
  { path: 'breeding.spawnBase', type: 'number', min: 0, max: 1, label: 'Spawn chance', group: 'breeding' },
  { path: 'mythic.baseChance', type: 'number', min: 0, max: 1, label: 'Mythic base chance', group: 'breeding' },
  { path: 'mythic.curve', type: 'number', min: 0, max: 10, label: 'Mythic curve', group: 'breeding' },
  { path: 'mythic.threshold', type: 'number', min: 0, max: 200, label: 'Mythic threshold (points)', group: 'breeding' },
  { path: 'mythic.aetherWeight', type: 'number', min: 0, max: 1, label: 'Aether weight', group: 'breeding' },
  { path: 'mythic.purityWeight', type: 'number', min: 0, max: 1, label: 'Purity weight', group: 'breeding' },
  { path: 'mythic.maxChance', type: 'number', min: 0, max: 1, label: 'Mythic cap per egg', group: 'breeding' },
  { path: 'mythic.regression', type: 'number', min: 0, max: 1, label: 'Regression to the mean', group: 'breeding' },
  // economy
  ...[['perPoint', 'Credits per point', 100], ['base', 'Base credits', 10000], ['scarcity', 'Scarcity premium', 10], ['saturation', 'Genus saturation', 1], ['floor', 'Saturation floor', 1], ['eggCost', 'Egg cost', 10000]].map(([k, label, max]) => ({ path: `economy.${k}`, type: 'number', min: 0, max, label, group: 'economy' })),
  // text
  { path: 'text.humour', type: 'number', min: 0, max: 1, label: 'Humour', group: 'text' },
  { path: 'text.voices', type: 'map', keys: ['scientific', 'playful', 'legend'], value: weight, label: 'Voices', group: 'text', reserved: true, note: 'reserved for the Haiku text pass' },
  { path: 'text.library', type: 'string', label: 'Text library', group: 'text', reserved: true },
];

const BY_PATH = new Map(PARAM_SCHEMA.map((s) => [s.path, s]));
const FIELD = new Map(T.fields.map((f) => [f.id, f]));

/** The schema entry for a path, or the map/choiceWeights entry above it. */
export function schemaFor(path) {
  const parts = path.split('.');
  for (let i = parts.length; i > 0; i--) {
    const s = BY_PATH.get(parts.slice(0, i).join('.'));
    if (s && (i === parts.length || s.type === 'map' || s.type === 'choiceWeights')) return s;
  }
  return null;
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function checkValue(s, v, path, err) {
  const range = (x, r, at) => {
    if (!isNum(x)) return err(at, `must be a number, got ${JSON.stringify(x)}`);
    if (r.min != null && x < r.min) err(at, `${x} is below ${r.min}`);
    if (r.max != null && x > r.max) err(at, `${x} is above ${r.max}`);
  };
  if (v === null && s.nullable) return;
  switch (s.type) {
    case 'number':
      return range(v, s, path);
    case 'int':
      if (!Number.isInteger(v)) return err(path, `must be a whole number, got ${JSON.stringify(v)}`);
      return range(v, s, path);
    case 'bool':
      return typeof v === 'boolean' || err(path, 'must be true or false');
    case 'string':
      return typeof v === 'string' || err(path, 'must be text');
    case 'enum':
      return s.choices.includes(v) || err(path, `"${v}" is not one of ${s.choices.join(', ')}`);
    case 'list':
      if (!Array.isArray(v)) return err(path, 'must be a list');
      return v.forEach((x) => s.choices.includes(x) || err(path, `"${x}" is not one of ${s.choices.join(', ')}`));
    case 'tuple':
      if (!Array.isArray(v) || v.length !== s.length) return err(path, `must be ${s.length} numbers`);
      return v.forEach((x, i) => range(x, s, `${path}[${i}]`));
    case 'rules':
      return v === 'default' || Array.isArray(v) || err(path, "must be 'default' or a list of rules");
    case 'map':
      if (!v || typeof v !== 'object' || Array.isArray(v)) return err(path, 'must be an object of numbers');
      for (const [k, x] of Object.entries(v)) {
        if (!s.keys.includes(k)) err(`${path}.${k}`, `unknown key; one of ${s.keys.join(', ')}`);
        else range(x, s.value, `${path}.${k}`);
      }
      return;
    case 'choiceWeights':
      if (!v || typeof v !== 'object') return err(path, 'must be { field: { choice: × } }');
      for (const [fid, m] of Object.entries(v)) {
        const f = FIELD.get(fid);
        if (!f) {
          err(`${path}.${fid}`, 'no such field');
          continue;
        }
        for (const [cid, x] of Object.entries(m ?? {})) {
          if (!f.choices.some((c) => c.id === cid)) err(`${path}.${fid}.${cid}`, `no such choice; one of ${f.choices.map((c) => c.id).join(', ')}`);
          else range(x, mul, `${path}.${fid}.${cid}`);
        }
      }
      return;
    default:
      return err(path, `unknown type ${s.type}`);
  }
}

/** Check a params object (partial or whole) or a preset id. Unknown paths are warnings. */
export function validateParams(p) {
  const errors = [];
  const warnings = [];
  const err = (path, message) => errors.push({ path, message });
  if (p == null) return { ok: true, errors, warnings };
  if (typeof p === 'string') {
    if (!PRESETS[p]) err('', `no preset "${p}"; one of ${Object.keys(PRESETS).join(', ')}`);
    return { ok: !errors.length, errors, warnings };
  }
  const walk = (o, prefix) => {
    for (const [k, v] of Object.entries(o)) {
      const path = prefix ? `${prefix}.${k}` : k;
      const s = BY_PATH.get(path);
      if (s) {
        checkValue(s, v, path, err);
        if (s.reserved) warnings.push({ path, message: 'reserved: nothing reads it yet' });
      } else if (v && typeof v === 'object' && !Array.isArray(v) && PARAM_SCHEMA.some((x) => x.path.startsWith(`${path}.`))) walk(v, path);
      else warnings.push({ path, message: 'unknown param (a typo?)' });
    }
  };
  walk(p, '');
  // Whole-params checks, on the params as they will resolve (over `base` or the default preset).
  if (!errors.length) {
    const R = resolveParams(p);
    if (R.breeding.clutchMin > R.breeding.clutchMax) err('breeding.clutchMin', 'is above clutchMax');
    if (isEcotype(R.algo) && terrainWeights(R).every(([, w]) => !(w > 0))) err('terrains', 'every terrain is off (or locked): no fish can roll');
    if (R.batch.pyramid.every((x) => !(x > 0))) err('batch.pyramid', 'every share is 0');
  }
  return { ok: !errors.length, errors, warnings };
}

/** A copy of `p` with `path` set (a dotted path; creates objects on the way). */
export function setParam(p, path, value) {
  const out = structuredClone(p ?? {});
  const parts = path.split('.');
  let o = out;
  for (const k of parts.slice(0, -1)) o = o[k] && typeof o[k] === 'object' ? o[k] : (o[k] = {});
  o[parts.at(-1)] = value;
  return out;
}

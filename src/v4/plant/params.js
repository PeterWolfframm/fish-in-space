// plant4 generation params: the knobs that steer the procedural roll (not the art). Same shape as
// fish4's: presets, a schema the CLI's --param and the studio's sliders read, validate, set, hash.
//
//   ecotype   realm → region → form → size → colours, each leaning on the last (the default)
//   classic   every field rolls on its own, the way plant3 rolled: anything with anything
//   farm / wild / aquarium   one realm only
//   rare      the rare looks (variegation, glow, swapped organs, odd colours) come up far more

import { hash01 } from '../../pixel/rng.js';
import { REGION_IDS, REALM_IDS } from './data/places.js';

export const BASE_PARAMS = {
  id: 'ecotype',
  label: 'Ecotype',
  algo: 'ecotype',
  realms: { farm: 38, wild: 34, water: 28 },
  regions: {},
  /** How often a colour role takes one of its form's (or region's) own swatches. */
  formColors: 0.82,
  /** ×odds of the rare looks: variegation, glow, swapped organs. */
  rare: 1,
  /** How far the shape genes spread: 1 = the bell, 0 = every plant at its form's centre. */
  shapeSpread: 1,
  /** The size a form prefers, or any size (0). */
  sizePrefer: 0.9,
  breeding: { mutation: 0.05, crossRealm: false },
  batch: { regions: 2, formsPerRegion: 3, cohesion: 0.7 },
};

const merge = (a, b) => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = a?.[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v;
  return out;
};

export const PRESETS = {
  ecotype: BASE_PARAMS,
  classic: merge(BASE_PARAMS, { id: 'classic', label: 'Classic (field by field)', algo: 'classic', formColors: 0, sizePrefer: 0 }),
  farm: merge(BASE_PARAMS, { id: 'farm', label: 'Farm only', realms: { farm: 1, wild: 0, water: 0 } }),
  wild: merge(BASE_PARAMS, { id: 'wild', label: 'Wild only', realms: { farm: 0, wild: 1, water: 0 } }),
  aquarium: merge(BASE_PARAMS, { id: 'aquarium', label: 'Aquarium', realms: { farm: 0, wild: 0, water: 1 } }),
  trees: merge(BASE_PARAMS, { id: 'trees', label: 'Trees', realms: { farm: 0, wild: 1, water: 0 }, regions: { desert: 0.2, savanna: 1.5 }, sizePrefer: 1 }),
  rare: merge(BASE_PARAMS, { id: 'rare', label: 'Rare looks', rare: 8, formColors: 0.55, shapeSpread: 1.4 }),
};
export const DEFAULT_PRESET = 'ecotype';

export function resolveParams(p) {
  if (!p) return PRESETS[DEFAULT_PRESET];
  if (typeof p === 'string') return PRESETS[p] ?? PRESETS[DEFAULT_PRESET];
  const { base, ...rest } = p;
  return merge(PRESETS[base] ?? PRESETS[p.id] ?? PRESETS[DEFAULT_PRESET], rest);
}

export const PARAM_GROUPS = [
  { id: 'algorithm', label: 'Algorithm' },
  { id: 'places', label: 'Realms and regions' },
  { id: 'looks', label: 'Colours, shapes, rare looks' },
  { id: 'breeding', label: 'Breeding' },
  { id: 'batch', label: 'Batches' },
];

const weight = { min: 0, max: 100 };
export const PARAM_SCHEMA = [
  { path: 'id', type: 'string', label: 'Preset id', group: 'algorithm' },
  { path: 'label', type: 'string', label: 'Label', group: 'algorithm' },
  { path: 'base', type: 'enum', choices: Object.keys(PRESETS), label: 'Built on preset', group: 'algorithm' },
  { path: 'algo', type: 'enum', choices: ['ecotype', 'classic'], label: 'Algorithm', group: 'algorithm' },
  { path: 'realms', type: 'map', keys: REALM_IDS, value: weight, label: 'Realm odds', group: 'places' },
  { path: 'regions', type: 'map', keys: REGION_IDS, value: { min: 0, max: 20 }, label: 'Region odds ×', group: 'places' },
  { path: 'formColors', type: 'number', min: 0, max: 1, label: 'Form colours', group: 'looks', note: 'how often a colour is one its form grows' },
  { path: 'rare', type: 'number', min: 0, max: 50, label: 'Rare looks ×', group: 'looks' },
  { path: 'shapeSpread', type: 'number', min: 0, max: 2, label: 'Shape spread', group: 'looks' },
  { path: 'sizePrefer', type: 'number', min: 0, max: 1, label: 'Form’s own sizes', group: 'looks' },
  { path: 'breeding.mutation', type: 'number', min: 0, max: 1, label: 'Mutation rate', group: 'breeding' },
  { path: 'breeding.crossRealm', type: 'bool', label: 'Cross realms', group: 'breeding', note: 'off: a child keeps one parent’s realm and form' },
  { path: 'batch.regions', type: 'int', min: 1, max: 6, label: 'Regions per batch', group: 'batch' },
  { path: 'batch.formsPerRegion', type: 'int', min: 1, max: 12, label: 'Forms per region', group: 'batch' },
  { path: 'batch.cohesion', type: 'number', min: 0, max: 1, label: 'Cohesion', group: 'batch', note: 'how much a batch’s plants of one form share their colours' },
];
const BY_PATH = new Map(PARAM_SCHEMA.map((s) => [s.path, s]));

function checkValue(s, v, path, err) {
  const num = (x, at) => {
    if (typeof x !== 'number' || !Number.isFinite(x)) return err(at, 'must be a number');
    if (s.type === 'int' && !Number.isInteger(x)) return err(at, 'must be a whole number');
    const lo = s.value?.min ?? s.min;
    const hi = s.value?.max ?? s.max;
    if (lo != null && x < lo) err(at, `must be at least ${lo}`);
    if (hi != null && x > hi) err(at, `must be at most ${hi}`);
  };
  switch (s.type) {
    case 'number':
    case 'int':
      return num(v, path);
    case 'bool':
      return typeof v === 'boolean' ? undefined : err(path, 'must be true or false');
    case 'string':
      return typeof v === 'string' ? undefined : err(path, 'must be text');
    case 'enum':
      return s.choices.includes(v) ? undefined : err(path, `must be one of ${s.choices.join(', ')}`);
    case 'map':
      if (!v || typeof v !== 'object' || Array.isArray(v)) return err(path, 'must be an object');
      for (const [k, x] of Object.entries(v)) {
        if (!s.keys.includes(k)) err(`${path}.${k}`, `unknown key; one of ${s.keys.join(', ')}`);
        else num(x, `${path}.${k}`);
      }
      return undefined;
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
      if (s) checkValue(s, v, path, err);
      else if (v && typeof v === 'object' && !Array.isArray(v) && PARAM_SCHEMA.some((x) => x.path.startsWith(`${path}.`))) walk(v, path);
      else warnings.push({ path, message: 'unknown param (a typo?)' });
    }
  };
  walk(p, '');
  if (!errors.length) {
    const R = resolveParams(p);
    if (REALM_IDS.every((id) => !(R.realms[id] > 0))) err('realms', 'every realm is off: no plant can roll');
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

const stableJson = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? `[${v.map(stableJson).join(',')}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`) : JSON.stringify(v));

/** A short id for a params object. */
export const paramsHash = (p) => {
  const text = stableJson(resolveParams(p));
  return [0, 1].map((s) => Math.floor(hash01(text, s) * 2 ** 32).toString(36).padStart(7, '0')).join('');
};

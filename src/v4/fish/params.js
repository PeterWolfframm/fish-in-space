// Generation params: an explicit, plain-JSON input to fish4. Params shape what a seed rolls (how
// likely each choice is) and the numbers breeding, rarity and the economy run on. They never
// change how a finished code draws: the code is the fish, params only decide which fish a seed
// becomes. Every field keeps its salt under any params, so the same seed under two presets gives
// two recognisably related fish (only the odds moved).
//
// The studio edits these, the simulator sweeps them, and exports carry `paramsHash(params)`.

import { hash01 } from '../../pixel/rng.js';
import { oklab } from '../../v3/fish/colors.js';

/** The full shape with fish3's own odds: `classic` is exactly fish3's roll. */
export const BASE_PARAMS = {
  id: 'classic',
  label: 'Classic (fish3)',
  note: 'fish3 rolls exactly, plus fish4 genes and features at their base odds.',
  /** Choice-weight multipliers: `{ fieldId: { choiceId: × } }`. */
  weights: {},
  /** Rarity roll odds per tier (relative). Mythic is mainly bred: see `mythic`. */
  rarity: { common: 70, uncommon: 22, rare: 7, epic: 0, legendary: 0, myth: 1 },
  /** Proportion bells: 1 = fish3, > 1 flatter (wilder shapes), < 1 tighter. */
  spread: 1,
  /** How often a body's own looks win (fish3: 0.6). */
  bodyPrefer: 0.6,
  /** Colour: `vivid` 0..1 favours saturated swatches (v1's colourful look); `chroma` = gene odds c0..c6. */
  color: { vivid: 0, chroma: [1, 0, 0, 0, 0, 0, 0] },
  /** Feature odds multipliers (on every non-`none` choice). */
  features: { helmet: 1 },
  /** Locus bells: 1 = default, > 1 flatter (more extreme fish). */
  loci: { spread: 1 },
  breeding: {
    /** Lifetime spawns for a Common with average fertility. */
    broodLimit: 6,
    /** Brood limit by tier: rarer fish breed fewer times. */
    tierMul: { common: 1, uncommon: 0.95, rare: 0.85, epic: 0.7, legendary: 0.55, myth: 0.4 },
    /** How far the fertility locus moves the limit: ±this fraction at the ends. */
    fertilitySpread: 0.3,
    /** Hard brood limit for Mythics (null = from tierMul). */
    mythicBroodLimit: null,
    clutchMin: 1,
    clutchMax: 5,
    /** Multipliers on the game's SPAWN_COOLDOWN and GROW times. */
    cooldownMul: 1,
    maturationMul: 1,
    /** Base chance a spawn takes at all (fertility moves it). */
    spawnBase: 0.85,
  },
  mythic: {
    /** Per-egg chance when the parents have no rarity at all. */
    baseChance: 0.0004,
    /** How steeply parent rarity raises the chance (per 10 points over the threshold). */
    curve: 1.6,
    /** Rarity points (parent mean) where the curve starts to bite. */
    threshold: 18,
    /** Weight of the aether locus (mean of both parents, 0..1). */
    aetherWeight: 0.06,
    /** Line purity bonus, per purity step. */
    purityWeight: 0.003,
    /** Never more than this per egg, however good the pair. */
    maxChance: 0.12,
    /** How hard children's rarity is pulled back toward the population, 0..1. */
    regression: 0.35,
  },
  economy: {
    /** Credits per rarity point (continuous; tiers are only labels). */
    perPoint: 2.2,
    base: 12,
    /** Premium for slow, shy breeders: × (1 + scarcity × this). */
    scarcity: 0.6,
    /** Each recent sale of the same genus in an orbit takes this off (floored at `floor`). */
    saturation: 0.12,
    floor: 0.45,
    /** Credits per egg laid. */
    eggCost: 4,
  },
  text: { voices: { scientific: 1, playful: 1, legend: 1 }, humour: 0.5, library: 'default' },
  rules: 'default',
};

const merge = (a, b) => {
  if (b == null) return a;
  if (Array.isArray(b) || typeof b !== 'object' || typeof a !== 'object' || Array.isArray(a)) return b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = merge(a?.[k], v);
  return out;
};

export const PRESETS = {
  classic: BASE_PARAMS,
  vivid: merge(BASE_PARAMS, {
    id: 'vivid',
    label: 'Vivid (v1 colour)',
    note: "fish3's shapes with v1's colourful palette: saturated swatches favoured, chroma gene on.",
    color: { vivid: 0.8, chroma: [1, 3, 4, 4, 3, 1, 0.4] },
  }),
  wild: merge(BASE_PARAMS, {
    id: 'wild',
    label: 'Wild',
    note: 'Wider proportions, more odd bits, more mutable fish, more helmets.',
    spread: 1.7,
    bodyPrefer: 0.35,
    weights: { quirk: { wonky: 2.5 }, chaos: { chaotic: 2 }, eyeMount: { telescope: 2, tubular: 2 }, forehead: { wen: 2, crested: 2 }, extras: { horns: 2, nosehorn: 2 } },
    color: { vivid: 0.4, chroma: [3, 2, 2, 1, 1, 0.5, 0.2] },
    features: { helmet: 3 },
    loci: { spread: 1.6 },
  }),
  curated: merge(BASE_PARAMS, {
    id: 'curated',
    label: 'Curated',
    note: 'Fewer wonky ones: tighter proportions, no odd eyes or wear, neat fish favoured.',
    spread: 0.7,
    bodyPrefer: 0.8,
    weights: { quirk: { neat: 2, wonky: 0.2 }, damage: { warts: 0.1, scar: 0.2, notched: 0.2 }, eyeColor2: { jet: 0, amber: 0, copper: 0 }, eyeStyle: { googly: 0.4 } },
    color: { vivid: 0.25, chroma: [3, 2, 1, 0, 0, 0, 0] },
  }),
  seedfall: merge(BASE_PARAMS, {
    id: 'seedfall',
    label: 'Seedfall (game)',
    note: 'The game: a touch more colour, no wild-caught Mythics (they are bred), a few wild Epics.',
    rarity: { common: 70, uncommon: 22, rare: 7, epic: 0.8, legendary: 0, myth: 0 },
    color: { vivid: 0.35, chroma: [4, 3, 2, 1, 0.3, 0, 0] },
  }),
};

/** Params from a preset id, a partial object (over `base` or `classic`), or nothing. */
export function resolveParams(p) {
  if (!p) return PRESETS.classic;
  if (typeof p === 'string') return PRESETS[p] ?? PRESETS.classic;
  const { base, ...rest } = p;
  return merge(PRESETS[base] ?? PRESETS[p.id] ?? BASE_PARAMS, rest);
}

/** Stable JSON: keys sorted, so equal params give equal text. */
export const stableJson = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? `[${v.map(stableJson).join(',')}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableJson(v[k])}`).join(',')}}`) : JSON.stringify(v));

/** A short id for a params object, carried with every export. */
export const paramsHash = (p) => {
  const text = stableJson(resolveParams(p));
  return [0, 1].map((s) => Math.floor(hash01(text, s) * 2 ** 32).toString(36).padStart(7, '0')).join('');
};

const chromaCache = new Map();
/** OKLab chroma of a swatch, 0..~0.32. */
export function chromaOf(hex) {
  let c = chromaCache.get(hex);
  if (c == null) {
    const [, a, b] = oklab(hex);
    c = Math.hypot(a, b);
    chromaCache.set(hex, c);
  }
  return c;
}

/** A bell flattened (spread > 1) or sharpened (< 1). */
export const spreadBell = (weights, spread) => (spread === 1 ? weights : weights.map((w) => (w > 0 ? w ** (1 / spread) : 0)));

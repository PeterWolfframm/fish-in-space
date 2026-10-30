// Generation params: an explicit, plain-JSON input to fish4. Params shape what a seed rolls (how
// likely each choice is) and the numbers breeding, rarity and the economy run on. They never
// change how a finished code draws: the code is the fish, params only decide which fish a seed
// becomes. Every field keeps its salt under any params, so the same seed under two presets gives
// two recognisably related fish (only the odds moved).
//
// The studio edits these, the simulator sweeps them, and exports carry `paramsHash(params)`.

import { hash01 } from '../../pixel/rng.js';
import { oklab } from '../../v3/fish/colors.js';

/** The full shape with fish3's own odds: `classic` is exactly fish3's roll (ecotype builds on it). */
export const BASE_PARAMS = {
  id: 'classic',
  label: 'Classic (fish3)',
  note: 'fish3 rolls exactly, plus fish4 genes and features at their base odds.',
  /** Choice-weight multipliers: `{ fieldId: { choiceId: × } }`. */
  weights: {},
  /**
   * How a seed becomes a fish: `classic` rolls every field on its own (fish3's roll), `ecotype-1`
   * picks a place and a species first (ecotype.js) so fish cluster into kinds.
   *
   * The ecotype roll is versioned. A change to it that moves which fish a seed gives lands as
   * `ecotype-2`, leaving `ecotype-1` to roll what it always rolled, so a stored seed is never
   * silently re-mapped. Plain `ecotype` is kept as an alias for the newest one.
   */
  algo: 'classic',
  /** Terrain odds (ecotype): `{ water, lava, sand, nuclear, aether }`; missing = the terrain's default. */
  terrains: {},
  /** Locked terrains to open (ecotype): `['aether']`. */
  unlocked: [],
  /** Region, niche and body odds multipliers (ecotype): `{ id: × }`. */
  regions: {},
  niches: {},
  bodies: {},
  /**
   * Clustering (ecotype). `cohesion` 0..1: how much a fish looks like its species. `speciesPerNiche`
   * 1..8 clades per niche, Zipf-weighted (`zipf`: higher = one dominant species). `drift`: how far
   * proportions wander. `lociStrength`: how hard the niche shifts the gene bells. `stick`: per-group
   * stickiness overrides (see ecotype.js STICK).
   */
  clusters: { cohesion: 0.9, speciesPerNiche: 4, zipf: 1.1, drift: 1, lociStrength: 1, stick: {} },
  /** Biome palettes (ecotype): how hard a region pulls colours toward its own (0 = not at all). */
  palette: { strength: 1 },
  /** Mutation pressure (ecotype): exponent on each region's pressure, and the base sport chance. */
  mutation: { strength: 1, sport: 0.03 },
  /**
   * Trait linkage (ecotype, data/links.js): `strength` raises every link's × to a power (0 = off),
   * `off` skips link ids. `kitChance`: in breeding, the chance each kit (weapons, fins, face) comes
   * whole from one parent.
   */
  links: { strength: 1, off: [], kitChance: 0.5 },
  /** The aesthetic guard (ecotype, data/constraints.js): `enabled`, and guard ids to skip. */
  guard: { enabled: true, off: [] },
  /** Balanced batches (batch.js): trophic shares [base, middle, top], diversity 0..1, largest school. */
  batch: { pyramid: [0.6, 0.3, 0.1], diversity: 0.6, maxSchool: 6 },
  /** Rarity roll odds per tier (relative). Mythic is mainly bred: see `mythic`. */
  rarity: { common: 70, uncommon: 22, rare: 7, epic: 0, legendary: 0, myth: 1 },
  /** Rarity score (rarity.js): points per source and the tier thresholds over them. */
  rarityPoints: {
    thresholds: { uncommon: 8, rare: 14, epic: 24, legendary: 36, myth: 56 },
    /** Looks: bits of surprisal ignored per field, then points per bit. */
    minBits: 2,
    bitPoints: 0.5,
    homozygous: 5,
    carrier: 1,
    morph: 10,
    iridescence: 6,
    hybrid: 6,
    signature: 8,
    relic: 10,
    feature: 4,
    aether: 18,
    /** Loci further than this from the middle (0..1) score `locusPoints` per unit beyond it. */
    extremeLocus: 0.7,
    locusPoints: 10,
    perGeneration: 0.15,
    generationCap: 4,
    perPurity: 0.3,
  },
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
    baseChance: 0.001,
    /** How steeply parent rarity raises the chance (per 10 points over the threshold). */
    curve: 2,
    /** Rarity points (parent mean) where the curve starts to bite. */
    threshold: 24,
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

/** fish4's own roll: places, species and clustering, with lava, sand and nuclear fish on. */
const ECOTYPE = merge(BASE_PARAMS, {
  id: 'ecotype',
  label: 'Ecotype (fish4)',
  note: 'Fish come from places: terrain, region, niche and species. Lava, sand and nuclear fish included.',
  algo: 'ecotype-1',
});

export const PRESETS = {
  ecotype: ECOTYPE,
  classic: BASE_PARAMS,
  frontier: merge(ECOTYPE, {
    id: 'frontier',
    label: 'Frontier',
    note: 'Ecotype with the void opened: aether fish drift in, mutation runs higher.',
    unlocked: ['aether'],
    terrains: { aether: 6 },
    mutation: { strength: 1.3, sport: 0.05 },
  }),
  water: merge(ECOTYPE, {
    id: 'water',
    label: 'Water only',
    note: 'Ecotype, water terrains only: rivers, reefs, open ocean, the deep, cloud seas, under the ice.',
    terrains: { lava: 0, sand: 0, nuclear: 0 },
  }),
  vivid: merge(ECOTYPE, {
    id: 'vivid',
    label: 'Vivid (v1 colour)',
    note: "Ecotype with v1's colourful palette: saturated swatches favoured, chroma gene on.",
    color: { vivid: 0.8, chroma: [1, 3, 4, 4, 3, 1, 0.4] },
  }),
  wild: merge(ECOTYPE, {
    id: 'wild',
    label: 'Wild',
    note: 'Wider proportions, more odd bits, more mutable fish, more helmets.',
    spread: 1.7,
    bodyPrefer: 0.35,
    clusters: { cohesion: 0.6, speciesPerNiche: 6, drift: 1.6 },
    mutation: { strength: 1.4, sport: 0.06 },
    weights: { quirk: { wonky: 2.5 }, chaos: { chaotic: 2 }, eyeMount: { telescope: 2, tubular: 2 }, forehead: { wen: 2, crested: 2 }, extras: { horns: 2, nosehorn: 2 } },
    color: { vivid: 0.4, chroma: [3, 2, 2, 1, 1, 0.5, 0.2] },
    features: { helmet: 3 },
    loci: { spread: 1.6 },
  }),
  curated: merge(ECOTYPE, {
    id: 'curated',
    label: 'Curated',
    note: 'Fewer wonky ones: tighter proportions, no odd eyes or wear, neat fish favoured.',
    spread: 0.7,
    bodyPrefer: 0.8,
    clusters: { cohesion: 0.95, speciesPerNiche: 3 },
    mutation: { strength: 0.6, sport: 0.01 },
    weights: { quirk: { neat: 2, wonky: 0.2 }, damage: { warts: 0.1, scar: 0.2, notched: 0.2 }, eyeColor2: { jet: 0, amber: 0, copper: 0 }, eyeStyle: { googly: 0.4 } },
    color: { vivid: 0.25, chroma: [3, 2, 1, 0, 0, 0, 0] },
  }),
  seedfall: merge(ECOTYPE, {
    id: 'seedfall',
    label: 'Seedfall (game)',
    note: 'The game: a touch more colour, no wild-caught Mythics (they are bred), a few wild Epics.',
    rarity: { common: 70, uncommon: 22, rare: 7, epic: 0.8, legendary: 0, myth: 0 },
    color: { vivid: 0.35, chroma: [4, 3, 2, 1, 0.3, 0, 0] },
  }),
};

/** The preset a seed rolls under when nothing is said. */
/** Is this the ecotype roll? Matches every version of it, so `ecotype` still means the newest. */
export const isEcotype = (algo) => algo === 'ecotype' || String(algo).startsWith('ecotype-');

export const DEFAULT_PRESET = 'ecotype';

/** Params from a preset id, a partial object (over `base`, else the default preset), or nothing. */
export function resolveParams(p) {
  if (!p) return PRESETS[DEFAULT_PRESET];
  if (typeof p === 'string') return PRESETS[p] ?? PRESETS[DEFAULT_PRESET];
  const { base, ...rest } = p;
  return merge(PRESETS[base] ?? PRESETS[p.id] ?? PRESETS[DEFAULT_PRESET], rest);
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

const COLOUR_FIELDS = new Set(['skin', 'markColor']);

/** A field's weight for choice `ci` under params `P`, given what has been rolled so far. */
export function weightOf(f, ci, P, set = {}) {
  const c = f.choices[ci];
  let w;
  if (f.id === 'rarity') w = P.rarity?.[c.id] ?? 0;
  else if (f.id === 'chroma') w = P.color?.chroma?.[ci] ?? (ci === 0 ? 1 : 0);
  else if (f.feature) w = f.weightsFor(set, P.features?.[f.id] ?? 1)[ci];
  else if (f.locus) w = spreadBell(f.weights, P.loci?.spread ?? 1)[ci];
  else if (f.choices[0].id === 'n3' && f.weights) w = spreadBell(f.weights, P.spread ?? 1)[ci];
  else w = f.weights?.[ci] ?? 1;
  if (COLOUR_FIELDS.has(f.id) && P.color?.vivid && c.hex) w *= Math.exp(P.color.vivid * 10 * (chromaOf(c.hex) - 0.12));
  const mul = P.weights?.[f.id]?.[c.id];
  return mul == null ? w : w * mul;
}

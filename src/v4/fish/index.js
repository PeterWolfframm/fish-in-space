// Fish v4 (fish4): fish3's look, kept pixel for pixel, plus everything a fish keeper needs to
// read off a fish as numbers: a quantitative diploid genome (loci.js), stats with evidence
// (stats.js), a shallow taxonomy, continuous rarity in six tiers, reproduction and value genes,
// feature modules (the space helmet), expressions (happy, tired, dead) and generation params.
//
// Reads f4., f3. and v1 fish codes. Under the `classic` params a seed rolls fish3's fish.

import { roller } from '../../pixel/rng.js';
import { fish3Traits } from '../../v3/fish/genome.js';
import { BODIES } from '../../v3/fish/bodies.js';
import { CLASS_LEN, describeGenes } from '../../v3/fish/phenotype.js';
import { ecologyOf } from '../../v3/fish/ecology.js';
import { loreOf } from '../../v3/fish/lore.js';
import { keyed } from '../../v3/fish/keys.js';
import { ANIMS as ANIMS3 } from '../../v3/fish/index.js';
import { cruise, sheenSweep, glowBreath } from '../../v3/fish/motions.js';
import { anim, poseAt } from '../../v2/anim/rig.js';
import { roundUp, crop } from '../../v2/kit/sizes.js';
import { fish4Traits, toFish3, fromFish3, decodeAny, jitterKey, FISH3_IDS, V4_IDS, FEATURE_IDS } from './genome.js';
import { latentLoci, lociOf, LOCI } from './loci.js';
import { resolveParams, PRESETS, chromaOf, spreadBell, paramsHash } from './params.js';
import { drawFish4, finishFrame, EXPRESSIONS } from './frame.js';
import { expression, wiggle, droop, floatDead } from './motions.js';
import { FEATURES } from './features/registry.js';
import { TIERS, TIER_LABELS } from './rules.js';
import { statsOf, behaviourProfile, summaryOf, STATS, STATS_VERSION, DEFAULT_RULES } from './stats.js';
import { taxonomyOf, ORDERS, FAMILIES } from './taxonomy.js';
import { namesOf4 } from './names.js';

export { statsOf, behaviourProfile, summaryOf, STATS, STATS_VERSION, DEFAULT_RULES, taxonomyOf, ORDERS, FAMILIES, namesOf4 };
export { fish4Traits, toFish3, fromFish3, decodeAny, jitterKey, lociOf, LOCI, PRESETS, resolveParams, paramsHash, FEATURES, EXPRESSIONS, TIERS, TIER_LABELS, FISH3_IDS, V4_IDS, FEATURE_IDS };

const T = fish4Traits;
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

/**
 * A fresh fish. Every field rolls on its own salt (fish3's for fish3's fields), only the odds
 * change with params; bodies then lean toward their own looks, as in fish3. Loci are rolled from
 * the finished look, so a fish rolled here and the same fish imported from fish3 share its genes.
 */
export function fromSeed(seed, params) {
  const P = resolveParams(paramsFromOpts(params));
  const { weighted } = roller(seed, 0);
  const out = {};
  for (const f of T.fields) {
    if (f.locus) continue;
    out[f.id] = weighted(f.choices.map((c, ci) => [c.id, weightOf(f, ci, P, out)]), f.salt);
  }
  let set = T.normalize(out);
  const prefer = BODIES[set.body]?.prefer;
  if (prefer) {
    const { chance } = roller(seed, 3300);
    Object.entries(prefer).forEach(([f, v], i) => {
      if (chance(P.bodyPrefer ?? 0.6, i)) set[f] = v;
    });
  }
  set = T.normalize(set);
  Object.assign(set, latentLoci(jitterKey(set), (f, ci) => weightOf(f, ci, P)));
  return T.normalize(set);
}

/** The forge app passes its option checkboxes; the studio passes params outright. */
function paramsFromOpts(o) {
  if (!o || typeof o === 'string') return o;
  if (o.params) return o.params;
  if (o.id || o.base || o.rarity || o.weights) return o;
  return Object.keys(PRESETS).find((id) => o[id]) ?? null;
}

export const ANIMS = [
  ...ANIMS3,
  anim('happy', 8, 10, [cruise({ beats: 1 }), wiggle(), sheenSweep(), glowBreath(), expression('happy')]),
  anim('tired', 8, 5, [droop(), expression('tired')], { fixedFps: true }),
  anim('dead', 2, 2, [floatDead(), expression('dead')], { fixedFps: true, label: 'dead (belly up)' }),
];
const BASE_ANIMS = new Set(ANIMS3.map((a) => a.id));

const fpsOf = (genome, a) => {
  if (a.id === 'grow' || a.fixedFps) return a.fps;
  const L = CLASS_LEN[T.normalize(genome).size] ?? 27;
  return Math.max(4, Math.min(24, Math.round(a.fps * Math.sqrt(27 / L))));
};

export const poseOf = (set, a, i) => {
  const f3 = toFish3(set);
  return keyed(poseAt('fish3', a, i, f3), f3.hybrid !== 'none' ? f3.hybrid : f3.body, a.id, i);
};

// Fields that never reach the paint (breeding bookkeeping, hidden genes, colour passes after the
// crop): the window cache ignores them.
const NOT_GEOMETRY = ['chaos', 'generation', 'lineA', 'lineB', 'purity', 'chroma', ...LOCI.flatMap((l) => [`${l.id}A`, `${l.id}B`])];
const windowKey = (set, opts) => {
  const plain = { ...set };
  for (const id of NOT_GEOMETRY) plain[id] = T.fieldById(id).default ?? T.fieldById(id).choices[0].id;
  if (plain.rarity === 'epic' || plain.rarity === 'legendary') plain.rarity = 'rare';
  return `${T.encode(plain)}|${opts?.key ?? ''}`;
};

/**
 * Every frame shares one window: fish3's (the union of where its own anims paint), so imported
 * fish crop exactly as before. The new anims and features only widen it if they would not fit.
 */
const boxCache = new Map();
export function windowOf(set, opts) {
  const code = windowKey(set, opts);
  const hit = boxCache.get(code);
  if (hit) return hit;
  const ext = () => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const base = ext();
  const all = ext();
  let W = 0;
  let H = 0;
  for (const a of ANIMS) {
    for (let i = 0; i < a.frames; i++) {
      const { img } = drawFish4(set, poseOf(set, a, i), undefined, opts);
      W = img.w;
      H = img.h;
      const boxes = BASE_ANIMS.has(a.id) ? [base, all] : [all];
      for (let y = 0; y < img.h; y++) {
        for (let x = 0; x < img.w; x++) {
          if (!img.data[y * img.w + x]) continue;
          for (const b of boxes) {
            if (x < b.x0) b.x0 = x;
            if (x > b.x1) b.x1 = x;
            if (y < b.y0) b.y0 = y;
            if (y > b.y1) b.y1 = y;
          }
        }
      }
    }
  }
  const fit = ({ x0, y0, x1, y1 }) => {
    const w = roundUp(x1 - x0 + 3);
    const h = roundUp(y1 - y0 + 3);
    return { x: x0 - 1 - Math.floor((w - (x1 - x0 + 3)) / 2), y: y0 - 1 - Math.floor((h - (y1 - y0 + 3)) / 2), w, h, W, H };
  };
  let box = fit(base);
  // The dead float is flipped after the crop: mirrored, it must fit too.
  const inside = (b) => all.x0 >= b.x && all.x1 < b.x + b.w && all.y0 >= b.y && all.y1 < b.y + b.h;
  if (!inside(box)) box = fit(all);
  if (boxCache.size > 300) boxCache.clear();
  boxCache.set(code, box);
  return box;
}

const SIZES = Object.keys(CLASS_LEN).map((id) => {
  const { w, h } = windowOf(T.normalize({ body: 'torpedo', size: id }));
  return { id, w, h };
});

/** One frame, cropped to the fish's window. `opts`: studio part toggles and feature params. */
export function frame(genome, animId, i = 0, opts) {
  const set = T.normalize(genome);
  const a = ANIMS.find((x) => x.id === animId) ?? ANIMS[0];
  const box = windowOf(set, opts);
  const pose = poseOf(set, a, i);
  const { img } = drawFish4(set, pose, undefined, opts);
  return finishFrame(crop(img, box.x, box.y, box.w, box.h), set, pose);
}

const f3 = (genome) => toFish3(T.normalize(genome));

/** Options for the text side: params (or a preset id) plus optional studio rules / flavour. */
const textOpts = (opts) => {
  const P = resolveParams(paramsFromOpts(opts));
  return { rules: opts?.rules ?? (Array.isArray(P.rules) ? P.rules : undefined), humour: opts?.humour ?? P.text?.humour ?? 0.5, flavour: opts?.flavour, tier: opts?.tier };
};

/** Names with a nickname, which needs the fish's stats. */
export function names(genome, opts) {
  const set = T.normalize(genome);
  const o = textOpts(opts);
  return namesOf4(set, { look: statsOf(set, o).look, humour: o.humour, flavour: o.flavour });
}

/** Everything about a fish as plain JSON: stats, names, taxonomy, ecology, the summary line. */
export function profile(genome, opts) {
  const set = T.normalize(genome);
  const o = textOpts(opts);
  const stats = statsOf(set, o);
  const n = namesOf4(set, { look: stats.look, humour: o.humour, flavour: o.flavour });
  return { code: T.encode(set), names: n, taxonomy: n.taxonomy, stats, rulesFired: stats.rulesFired, summary: summaryOf(stats), loci: lociOf(set), ecology: ecologyOf(toFish3(set)) };
}

export default {
  id: 'fish4',
  version: 4,
  family: 'fish',
  generation: 'old',
  label: 'Fish v4',
  game: 'fish.',
  size: SIZES.find((s) => s.id === 'medium'),
  sizes: SIZES,
  sizeField: 'size',
  sizeOf: (genome) => {
    const { w, h } = windowOf(T.normalize(genome));
    return { w, h };
  },
  anchor: 'center',
  bg: '#1e3c5a',
  traits: T,
  options: Object.values(PRESETS).filter((p) => p.id !== 'classic').map((p) => ({ id: p.id, label: p.label })),
  fromSeed,
  fromCode: decodeAny,
  normalize: T.normalize,
  name: (genome) => namesOf4(T.normalize(genome)).full,
  describe: (genome) => describeGenes(f3(genome)),
  names,
  ecology: (genome) => ecologyOf(f3(genome)),
  lore: (genome) => loreOf(f3(genome)),
  loci: (genome) => lociOf(T.normalize(genome)),
  stats: (genome, opts) => statsOf(T.normalize(genome), textOpts(opts)),
  behaviour: (genome, opts) => behaviourProfile(T.normalize(genome), textOpts(opts)),
  taxonomy: (genome) => namesOf4(T.normalize(genome)).taxonomy,
  summary: (genome, opts) => summaryOf(statsOf(T.normalize(genome), textOpts(opts))),
  profile,
  fpsOf,
  anims: ANIMS,
  frame,
};

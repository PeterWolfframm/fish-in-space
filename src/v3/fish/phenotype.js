// From genome to animal: the genes resolved into what shows (morph, bubble eyes, long fins), the
// `auto` parts filled in from the body, and the body's geometry (length, height scale, the two
// profiles) worked out with the proportions, chonk, quirks, life stage and sex applied.
//
// Pure and cached by code: the painter calls this once per frame.

import { roller } from '../../pixel/rng.js';
import { fish3Traits, stepOf, jitterKey, SIGNATURES, RELICS } from './genome.js';
import { archetypeOf, profileAt } from './bodies.js';
import { paletteOf } from './colors.js';

/** Body length per size class, px. Medium is v1's 27. */
export const CLASS_LEN = { tiny: 14, small: 20, medium: 27, large: 38, huge: 52, giant: 72 };
export const STAGES = ['fry', 'juvenile', 'adult', 'elder'];

const RECESSIVE = ['albino', 'leucistic', 'melanistic', 'axanthic', 'ghost', 'bubble'];
/** Which recessive colour wins when a fish expresses two (only possible for … never, with two
 * slots — but sports and koi are layered on in this order). */
const COLOUR_ORDER = ['ghost', 'albino', 'leucistic', 'melanistic', 'axanthic'];

/** What the two gene slots show. */
export function genetics(set) {
  const a = set.geneA ?? 'wild';
  const b = set.geneB ?? 'wild';
  const both = (x) => a === x && b === x;
  const either = (x) => a === x || b === x;
  let morph = 'wild';
  for (const x of COLOUR_ORDER) if (both(x)) morph = x;
  if (morph === 'wild') {
    if (both('koi')) morph = 'calico';
    else if (either('xanthic')) morph = 'xanthic';
    else if (either('koi')) morph = 'piebald';
  }
  if (set.morph && set.morph !== 'auto') morph = set.morph;
  const carries = RECESSIVE.filter((x) => either(x) && !both(x));
  return { morph, bubble: both('bubble'), longfin: either('longfin'), carries };
}

/** A short line for the editor: what the genes show and hide. */
export function describeGenes(set) {
  const g = genetics(set);
  const bits = [];
  if (g.morph !== 'wild') bits.push(g.morph);
  if (g.bubble) bits.push('bubble eyes');
  if (g.longfin) bits.push('long fins');
  if (g.carries.length) bits.push(`carries ${g.carries.join(', ')}`);
  return bits.join(' · ') || 'wild type';
}

const cache = new Map();

/**
 * Everything the painter needs that does not move. `stageOverride` (0..3) lets the grow anim
 * show other life stages of the same fish.
 */
export function phenotype(genome, stageOverride = -1) {
  const set = fish3Traits.normalize(genome);
  const code = fish3Traits.encode(set);
  const key = `${code}|${stageOverride}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ph = build(set, stageOverride);
  if (cache.size > 400) cache.clear();
  cache.set(key, ph);
  return ph;
}

function build(set, stageOverride) {
  const jkey = jitterKey(set);
  const { r, range } = roller(jkey, 4100);
  const arch = archetypeOf(set.body, set.hybrid);
  const gen = genetics(set);
  const stage = stageOverride >= 0 ? STAGES[Math.min(3, stageOverride)] : set.stage ?? 'adult';

  // --- parts: `auto` means "what this body wears" --------------------------------------------
  const jaw = set.jaw === 'auto' ? arch.jaw ?? (set.snout === 'under' ? 'underbite' : 'plain') : set.jaw;
  const anal = set.anal === 'auto' ? arch.anal3 ?? (arch.anal ? 'normal' : 'none') : set.anal;
  const pelvic = set.pelvic === 'auto' ? arch.pelvic ?? 'small' : set.pelvic;
  const extras = set.extras === 'auto' ? arch.extras ?? 'none' : set.extras;
  const gait = set.gait === 'auto' ? arch.gait ?? 'subcarangiform' : set.gait;
  let tail = set.tail ?? 'fan';
  let tailStub = 1;
  if (arch.tail === 'none') tail = 'none';
  else if (arch.tail === 'tiny') tailStub = 0.6;
  else if (arch.tail === 'crescent' && !['lunate', 'hetero', 'streamer', 'sword', 'double'].includes(tail)) tail = 'crescent';
  else if (arch.tail === 'clavus') tail = 'clavus';
  else if (arch.tail === 'pin') tail = 'pin';
  const dorsal = arch.noDorsal ? 'none' : set.dorsal ?? 'low';

  // --- life stage and sex ---------------------------------------------------------------------
  const male = set.sex === 'm';
  const dimorphic = Boolean(arch.dimorphic);
  let finMul = gen.longfin ? 1.4 : 1;
  let chonkStep = ['lean', 'fit', 'plump', 'round'].indexOf(set.chonk ?? 'fit');
  let saturation = 1;
  if (dimorphic) {
    finMul *= male ? 1.3 : 0.8;
    saturation = male ? 1.25 : 0.85;
    if (!male) chonkStep = Math.min(3, chonkStep + 1);
  }
  const stageLen = { fry: 0.45, juvenile: 0.7, adult: 1, elder: 1.05 }[stage];
  const headMul = { fry: 1.3, juvenile: 1.12, adult: 1, elder: 1 }[stage];
  if (stage === 'fry') finMul *= 0.7;

  // --- size and proportions -------------------------------------------------------------------
  const classLen = CLASS_LEN[set.size] ?? 27;
  const s = Math.max(0.3, (classLen * stageLen) / 27);
  const L = Math.max(8, Math.round(classLen * stageLen * arch.length * (1 + 0.07 * stepOf(set.length))));
  const depth = 1 + 0.08 * stepOf(set.depth);
  const head = (1 + 0.07 * stepOf(set.head)) * headMul;
  const hump = 0.45 * stepOf(set.hump);
  const stalk = 1 + 0.15 * stepOf(set.stalk);
  const chonk = [0.85, 1, 1.15, 1.32][chonkStep];
  const wob = { neat: 0.03, natural: 0.08, wonky: 0.18 }[set.quirk ?? 'natural'];

  const shapeKeys = (keys, side, salt) =>
    keys.map(([t, h], i) => {
      const last = i === keys.length - 1 || i === 0;
      const jt = last ? t : Math.min(0.99, Math.max(0.01, t + (r(salt + i) - 0.5) * wob * 0.5));
      let k = 1 + (r(salt + 40 + i) - 0.5) * 2 * wob;
      if (t < 0.18) k *= stalk;
      if (t > 0.72) k *= head;
      if (side === 'belly' && t > 0.25 && t < 0.85) k *= chonk;
      let hh = h * k * depth;
      if (side === 'back' && t > 0.28 && t < 0.78) hh += hump * Math.sin(Math.PI * ((t - 0.28) / 0.5));
      return [jt, Math.max(0.4, hh)];
    });
  let back = snouted(shapeKeys(arch.back, 'back', 10), set.snout, 'back');
  const belly = snouted(shapeKeys(arch.belly, 'belly', 70), set.snout, 'belly');
  if (set.forehead === 'domed') back = back.map(([t, h]) => [t, t > 0.7 && t < 0.98 ? h + 1.3 * Math.sin(Math.PI * ((t - 0.7) / 0.28)) : h]);
  if (arch.droopy) back = back.map(([t, h]) => [t, t > 0.85 ? h * 0.92 : h]);

  // The snout past the nose: v1's long beak, a bill, a tube.
  const beak = jaw === 'bill' ? Math.round(L * 0.32) : jaw === 'tube' ? Math.max(2, Math.round(L * 0.1)) : set.snout === 'long' ? Math.max(2, Math.round(3 * s)) : 0;
  const beakH = jaw === 'bill' ? 0.9 : jaw === 'tube' ? 0.8 : 1.4;

  const eyeT = Math.min(0.95, 0.82 + 0.015 * stepOf(set.eyePos) + (r(130) - 0.5) * wob * 0.15 + (stage === 'fry' ? 0.02 : 0));
  const eyeUp = 0.55 + 0.06 * stepOf(set.eyePos);

  // Eye stamp: grows with the fish, one step per eye trait, fry get big eyes.
  const eyeBias = { small: -1, normal: 0, big: 1 }[set.eye ?? 'normal'] + (stage === 'fry' ? 1 : 0) + (stage === 'juvenile' ? 0.5 : 0);
  const eyeSize = Math.max(2, Math.min(6, Math.round(3 + Math.log2(s) * 1.3 + eyeBias)));

  const ph = {
    set,
    seed: jkey,
    arch,
    body: set.hybrid && set.hybrid !== 'none' ? set.hybrid : set.body,
    gait,
    jaw,
    anal,
    pelvic,
    extras,
    tail,
    tailStub,
    dorsal,
    pectoral: set.pectoral ?? 'small',
    stage,
    male,
    dimorphic,
    finMul,
    saturation,
    L,
    s,
    classLen,
    beak,
    beakH,
    eyeT,
    eyeUp,
    eyeSize,
    ...gen,
    back: (t) => height(back, t, s, beak, beakH, L),
    belly: (t) => height(belly, t, s, beak, beakH, L),
    rare: set.rarity === 'rare' || set.rarity === 'myth',
    signature: resolved(set.signature, SIGNATURES, set.rarity === 'rare' || set.rarity === 'myth', jkey, 1),
    relic: resolved(set.relic, RELICS, set.rarity === 'myth', jkey, 2),
    jitter: range,
  };
  ph.colors = paletteOf(set, ph);
  return ph;
}

/** A signature or relic: the one set, or for `auto` one picked from the fish's looks. */
function resolved(id, list, allowed, jkey, salt) {
  if (!allowed) return 'none';
  if (id && id !== 'auto') return id;
  return roller(jkey, 6600).pick(list.map(([x]) => x), salt);
}

/** A profile's height at t (t > 1 is the beak past the nose). */
function height(keys, t, s, beak, beakH, L) {
  if (t < 0) return 0;
  if (t <= 1) return profileAt(keys, t) * s;
  if (!beak) return 0;
  const u = ((t - 1) * L) / beak;
  if (u > 1) return 0;
  return Math.max(0.5, beakH * (1 - u * 0.6) * Math.min(1, s + 0.2));
}

/** v1's snout reshaping of the nose and forehead keys. */
function snouted(keys, snout, side) {
  const out = keys.map(([t, h]) => [t, h]);
  const nose = out[out.length - 1];
  const brow = out[out.length - 2];
  switch (snout) {
    case 'pointed':
      nose[1] = Math.min(nose[1], 0.5);
      brow[1] *= 0.8;
      break;
    case 'long':
      nose[1] = Math.min(nose[1], 1.2);
      brow[1] *= 0.85;
      break;
    case 'under':
      if (side === 'belly') nose[1] = Math.max(nose[1], 1.6);
      else nose[1] = Math.min(nose[1], 0.6);
      break;
    default:
      nose[1] = Math.max(nose[1], 2.2);
  }
  return out;
}

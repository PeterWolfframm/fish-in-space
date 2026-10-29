// Breeding fish3: more than "each field from one parent".
//
// - Proportions and size are polygenic: the child lands near the parents' mean, with drift.
// - Colours blend in OKLab (and snap to a swatch), or come from one parent outright.
// - Two patterns can overlay into a third: bars + spots → leopard, stripe + spots → dash-dot …
// - The special genes are Mendelian: each parent passes one of its two alleles, so two carriers of
//   albino make an albino about one time in four. Breeding within a line makes that likelier.
// - The right two bodies can make a hybrid (bodies.js HYBRIDS); some hybrids are sterile mules.
// - Sports: rare spontaneous mutations, a new allele, morph or oddity, likelier in chaotic fish.
// - Lines: breeding within a line raises its purity; at purity 5 a line breeds true.
//
// `breedDetailed` returns the child and a list of events saying what happened, for the UI.

import { roller } from '../../pixel/rng.js';
import { BODY_COLORS, MARK_COLORS } from '../../gen/fish/palettes.js';
import { fish3Traits, STEP_IDS, stepOf, NOT_LOOKS } from './genome.js';
import { HYBRIDS, hybridOf } from './bodies.js';
import { blendSwatch } from './colors.js';
import { genetics, phenotype } from './phenotype.js';

const T = fish3Traits;
const ids = (field) => T.fieldById(field).choices.map((c) => c.id);
const SIZES = ids('size');
const RARITY = ['common', 'uncommon', 'rare', 'myth'];
const CHONK = ['lean', 'fit', 'plump', 'round'];
const PROPORTIONS = ['length', 'depth', 'head', 'hump', 'stalk', 'eyePos'];
const CHAOS_K = { stable: 0.5, normal: 1, chaotic: 2 };
const SPORT_K = { stable: 0.3, normal: 1, chaotic: 3 };

/** Two patterns that make a third when both parents have one each. */
const OVERLAYS = [
  ['bars', 'spots', 'leopard'],
  ['stripe', 'spots', 'dashdot'],
  ['bars', 'stripe', 'reticulate'],
  ['saddle', 'bars', 'tiger'],
  ['mottle', 'spots', 'patches'],
  ['tiger', 'stripe', 'chevron'],
];

const SPORT_MORPHS = ['galaxy', 'neon', 'chrome', 'ombre', 'split'];
const SPORT_ALLELES = ['albino', 'leucistic', 'melanistic', 'axanthic', 'ghost', 'bubble', 'xanthic', 'longfin', 'koi'];
const ODDITIES = [
  ['eyeMount', 'telescope', 'telescope eyes'],
  ['eyeMount', 'tubular', 'tube eyes'],
  ['forehead', 'wen', 'a wen cap'],
  ['eyeColor2', null, 'odd eyes'],
  ['extras', 'horns', 'little horns'],
  ['scales', 'scallops', 'big scallop scales'],
  ['dorsal', 'streamer', 'a streamer fin'],
  ['tail', 'veil', 'a veil tail'],
];

const lineOf = (s) => `${s.lineA}${s.lineB}`;
const num = (id) => Number(String(id).slice(1)) || 0;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sterile = (s) => Boolean(HYBRIDS[s.hybrid]?.sterile);
const labelOf = (field, id) => T.fieldById(field).choices.find((c) => c.id === id)?.label ?? id;

/** The child of `a` and `b`, and what happened. */
export function breedDetailed(a, b, seed) {
  const A = T.normalize(a);
  const B = T.normalize(b);
  const { r, pick, chance, range } = roller(seed, 5200);
  const events = [];
  const say = (kind, text) => events.push({ kind, text });

  // Mules: a sterile hybrid adds nothing, so the clutch is the other parent's alone.
  if (sterile(A) || sterile(B)) {
    const fertile = sterile(A) ? (sterile(B) ? null : B) : A;
    const mule = sterile(A) ? A : B;
    say('sterile', `${labelOf('hybrid', mule.hybrid)} is a sterile hybrid${fertile ? ': the eggs hatched from one parent alone' : ' — nothing hatched but a lookalike'}`);
    const base = fertile ?? A;
    const child = T.vary({ ...base, stage: 'fry', generation: gen(base, base) }, 0.05, `${seed}:clone`);
    return { child: T.normalize({ ...child, sex: chance(0.5, 1) ? 'm' : 'f', stage: 'fry' }), events };
  }

  const same = lineOf(A) === lineOf(B);
  const purity = same ? Math.min(9, Math.max(num(A.purity), num(B.purity)) + 1) : 0;
  const trueBreeding = purity >= 5;
  const chaosOf = (s) => CHAOS_K[s.chaos] ?? 1;
  const chaosK = (chaosOf(A) + chaosOf(B)) / 2 * (trueBreeding ? 0.3 : 1);
  const sportK = ((SPORT_K[A.chaos] ?? 1) + (SPORT_K[B.chaos] ?? 1)) / 2 * (same ? 0.5 : 1);

  const child = T.combine(A, B, seed);

  // --- polygenic: proportions, chonk and size land near the mean -------------------------------
  const drift = (salt) => (trueBreeding ? 0 : (r(salt) + r(salt + 1) - 1) * 1.6 * chaosK);
  PROPORTIONS.forEach((f, i) => {
    const v = Math.round((stepOf(A[f]) + stepOf(B[f])) / 2 + drift(100 + i * 2));
    child[f] = STEP_IDS[clamp(v, -3, 3) + 3];
  });
  child.chonk = CHONK[clamp(Math.round((CHONK.indexOf(A.chonk) + CHONK.indexOf(B.chonk)) / 2 + drift(130) * 0.6), 0, 3)];
  let size = clamp(Math.round((SIZES.indexOf(A.size) + SIZES.indexOf(B.size)) / 2 + drift(140) * 0.5), 0, SIZES.length - 1);

  // --- colour: blended, or one parent's outright ---------------------------------------------
  if (A.skin !== B.skin && r(150) < 0.6) {
    child.skin = blendSwatch(BODY_COLORS, A.skin, B.skin, range(0.3, 0.7, 151));
    if (child.skin !== A.skin && child.skin !== B.skin) say('blend', `skin blended to ${labelOf('skin', child.skin).toLowerCase()}`);
  }
  if (A.markColor !== B.markColor && r(152) < 0.6) child.markColor = blendSwatch(MARK_COLORS, A.markColor, B.markColor, range(0.3, 0.7, 153));

  // --- patterns that overlay -------------------------------------------------------------------
  for (const [x, y, z] of OVERLAYS) {
    if (((A.pattern === x && B.pattern === y) || (A.pattern === y && B.pattern === x)) && chance(0.5, 160)) {
      child.pattern = z;
      say('pattern', `${labelOf('pattern', x).toLowerCase()} + ${labelOf('pattern', y).toLowerCase()} overlaid into ${labelOf('pattern', z).toLowerCase()}`);
      break;
    }
  }

  // --- Mendelian genes -------------------------------------------------------------------------
  const fromA = chance(0.5, 170) ? A.geneA : A.geneB;
  let fromB = chance(0.5, 171) ? B.geneA : B.geneB;
  // Within a line, the partner is likely to carry the very same copy.
  if (same && fromB !== fromA && (B.geneA === fromA || B.geneB === fromA) && chance(0.5, 172)) fromB = fromA;
  child.geneA = fromA;
  child.geneB = fromB;

  // --- hybrids ---------------------------------------------------------------------------------
  const hybridNow = hybridOf(A.body, B.body);
  const parentsHybrid = [A.hybrid, B.hybrid].filter((h) => h !== 'none');
  child.hybrid = 'none';
  if (parentsHybrid.length) {
    const both = A.hybrid === B.hybrid;
    const h = both ? A.hybrid : pick(parentsHybrid, 180);
    if (chance(both ? 0.7 : 0.35, 181)) child.hybrid = h;
  }
  if (child.hybrid === 'none' && hybridNow && chance(0.06 * chaosK * (same ? 0.5 : 1), 182)) {
    child.hybrid = hybridNow;
    say('hybrid', `hybrid! ${labelOf('body', A.body)} × ${labelOf('body', B.body)} made a ${labelOf('hybrid', hybridNow).toLowerCase()}${HYBRIDS[hybridNow].sterile ? ' (sterile)' : ''}`);
  }
  if (child.hybrid !== 'none' && !(A.hybrid === child.hybrid && B.hybrid === child.hybrid) && chance(0.4, 183) && size < SIZES.length - 1) {
    size += 1;
    say('vigour', 'hybrid vigour: grew a size class bigger');
  }
  child.size = SIZES[size];

  // --- mutation: re-roll a few fields, never ones the parents agree on -------------------------
  const keep = new Set([...NOT_LOOKS, ...PROPORTIONS, 'chonk', 'size', 'hybrid', 'rarity', 'morph', 'iridescence', 'signature', 'relic']);
  const varied = T.vary(child, 0.08 * chaosK, `${seed}:mut`);
  for (const f of T.fields) {
    if (keep.has(f.id) || A[f.id] === B[f.id]) continue;
    if (varied[f.id] !== child[f.id]) child[f.id] = varied[f.id];
  }

  // --- sports ----------------------------------------------------------------------------------
  let rarity = Math.max(RARITY.indexOf(A.rarity), RARITY.indexOf(B.rarity));
  if (A.rarity === B.rarity && rarity >= 1 && chance(0.15, 190)) rarity += 1;
  child.morph = A.morph === B.morph ? A.morph : chance(0.5, 191) ? A.morph : B.morph;
  if (chance(0.03 * sportK, 200)) {
    const kind = pick(['allele', 'morph', 'oddity'], 201);
    if (kind === 'allele') {
      const allele = pick(SPORT_ALLELES, 202);
      if (chance(0.5, 203)) child.geneA = allele;
      else child.geneB = allele;
      say('sport', `sport: a new ${labelOf('geneA', allele).toLowerCase()} gene appeared`);
    } else if (kind === 'morph') {
      child.morph = pick(SPORT_MORPHS, 204);
      rarity = Math.max(rarity, 2);
      say('sport', `sport: hatched ${labelOf('morph', child.morph).toLowerCase()}!`);
    } else {
      const [f, v, text] = pick(ODDITIES, 205);
      child[f] = v ?? pick(ids(f).filter((x) => x !== 'same' && x !== child.eyeColor), 206);
      say('sport', `sport: ${text}`);
    }
  }
  if (child.hybrid !== 'none') rarity = Math.max(rarity, 2);
  if (child.morph !== 'auto') rarity = Math.max(rarity, 1);
  if (child.iridescence !== 'none') rarity = Math.max(rarity, 2);
  // A signature is not a gene: it passes only between two parents who both bear one, and is
  // otherwise only ever a sport. A rare child without one gets its own (phenotype's auto pick).
  if (chance(0.01 * sportK, 207)) {
    rarity = Math.max(rarity, 2);
    child.signature = 'auto';
    say('sport', 'sport: hatched with a signature');
  }
  child.rarity = RARITY[clamp(rarity, 0, 3)];
  const pa = phenotype(A);
  const pb = phenotype(B);
  child.signature = 'auto';
  child.relic = 'auto';
  if (pa.signature !== 'none' && pb.signature !== 'none' && rarity >= 2) {
    child.signature = pa.signature === pb.signature ? pa.signature : chance(0.5, 230) ? pa.signature : pb.signature;
    say('signature', `inherited signature: ${labelOf('signature', child.signature).toLowerCase()}`);
  }
  if (pa.relic !== 'none' && pb.relic !== 'none' && rarity >= 3) {
    child.relic = pa.relic === pb.relic ? pa.relic : chance(0.5, 231) ? pa.relic : pb.relic;
    say('relic', `inherited relic: ${labelOf('relic', child.relic).toLowerCase()}`);
  }

  // --- life and lineage ------------------------------------------------------------------------
  child.stage = 'fry';
  child.sex = chance(0.5, 210) ? 'm' : 'f';
  child.generation = gen(A, B);
  child.purity = `p${purity}`;
  if (same) {
    child.lineA = A.lineA;
    child.lineB = A.lineB;
    if (trueBreeding && num(A.purity) < 5 && num(B.purity) < 5) say('line', 'the line now breeds true');
  } else {
    // An outcross starts a new line.
    child.lineA = `l${Math.floor(r(220) * 36)}`;
    child.lineB = `l${Math.floor(r(221) * 36)}`;
  }

  const out = T.normalize(child);
  // A recessive showing up in a child whose parents don't show it.
  const shown = genetics(out).morph;
  if (shown !== 'wild' && shown !== genetics(A).morph && shown !== genetics(B).morph && out.morph === 'auto') {
    say('reveal', `surprise: both parents carried ${shown} — it shows!`);
  }
  if (genetics(out).bubble && !genetics(A).bubble && !genetics(B).bubble) say('reveal', 'surprise: bubble eyes!');
  return { child: out, events };
}

const gen = (A, B) => `g${Math.min(35, Math.max(num(A.generation), num(B.generation)) + 1)}`;

/** The plain breed hook: just the child. */
export const breed = (a, b, seed) => breedDetailed(a, b, seed).child;

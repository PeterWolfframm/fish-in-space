// fish4 breeding: fish3's breeding for fish3's fields (breedDetailed: polygenic proportions, colour
// blends, Mendelian genes, hybrids, sports, lines), plus fish4's own inheritance:
//
//   loci       each parent passes one allele per locus; within a true-breeding line the partner
//              often carries the very same copy, so lines fix
//   identity   terrain is shared (parents of two terrains cannot breed); region, niche, form and
//              pigments come from one parent as a kit; two species make a `wild` clade
//   features   one parent's (the helmet)
//   rarity     the child's own score, plus what the parents pass on (pulled back toward the
//              population by `mythic.regression`), and a Mythic egg roll capped at
//              `mythic.maxChance`: reachable, never on tap
//
//   breed(a, b, seed, P?)          → { child, events, problem? }
//   breedClutch(a, b, seed, P?)    → { children, events, mythicChance, problem? }
//
// Deterministic: the same parents and seed always hatch the same eggs.

import { roller } from '../../pixel/rng.js';
import { inheritKits } from './links.js';
import { breedDetailed } from '../../v3/fish/breeding.js';
import { fish4Traits, toFish3, FISH3_IDS, FEATURE_IDS } from './genome.js';
import { LOCI, alleleIds, ALLELE_STEPS, lociOf } from './loci.js';
import { BODY_RECORDS, bodyOf } from './bodies/index.js';
import { TERRAINS } from './data/terrains.js';
import { terrainOf } from './ecology4.js';
import { rarityOf, tierOf } from './rarity.js';
import { reproduction, paramsOf } from './reproduction.js';
import { tierRank } from './rules.js';

const T = fish4Traits;
const num = (id) => Number(String(id).slice(1)) || 0;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Why two fish cannot breed, or null. */
export function breedProblem(a, b) {
  const A = T.normalize(a);
  const B = T.normalize(b);
  const ta = terrainOf(A);
  const tb = terrainOf(B);
  if (ta !== tb) return `different worlds: one lives in ${TERRAINS[ta].mediumLabel}, the other in ${TERRAINS[tb].mediumLabel}`;
  return null;
}

/** The per-egg Mythic chance for a pair. */
export function mythicChance(A, B, P) {
  const M = P.mythic;
  const pts = (rarityOf(A, P).points + rarityOf(B, P).points) / 2;
  const aether = (lociOf(A).aether.value + lociOf(B).aether.value) / 2;
  const same = `${A.lineA}${A.lineB}` === `${B.lineA}${B.lineB}`;
  const purity = same ? Math.max(num(A.purity), num(B.purity)) : 0;
  const curve = M.baseChance * 2 ** ((Math.max(0, pts - M.threshold) / 10) * M.curve);
  return Math.min(M.maxChance, curve + M.aetherWeight * aether * aether + M.purityWeight * purity);
}

/** One child, with what happened. */
export function breed(a, b, seed, params) {
  const P = paramsOf(params);
  const A = T.normalize(a);
  const B = T.normalize(b);
  const problem = breedProblem(A, B);
  if (problem) return { child: null, events: [{ kind: 'refused', text: problem }], problem };
  return hatch(A, B, String(seed), P, mythicChance(A, B, P));
}

/** A clutch: as many eggs as the parents lay between them, each from `seed:i`. */
export function breedClutch(a, b, seed, params) {
  const P = paramsOf(params);
  const A = T.normalize(a);
  const B = T.normalize(b);
  const problem = breedProblem(A, B);
  if (problem) return { children: [], events: [{ kind: 'refused', text: problem }], mythicChance: 0, problem };
  const ra = reproduction(A, P);
  const rb = reproduction(B, P);
  const { r } = roller(`${seed}:clutch`, 5300);
  const n = clamp(Math.round((ra.clutch + rb.clutch) / 2 + (r(1) - 0.5)), P.breeding.clutchMin, P.breeding.clutchMax);
  const chance = mythicChance(A, B, P);
  const children = [];
  const events = [];
  for (let i = 0; i < n; i++) {
    const out = hatch(A, B, `${seed}:${i}`, P, chance);
    children.push(out.child);
    for (const e of out.events) events.push({ ...e, egg: i });
  }
  return { children, events, mythicChance: chance };
}

function hatch(A, B, seed, P, chanceOfMyth) {
  const { r, chance, pick } = roller(seed, 7000); // clear of v3 breeding's 5200..5431
  const { child: c3, events } = breedDetailed(toFish3(A), toFish3(B), seed);
  const child = { ...c3 };
  const say = (kind, text) => events.push({ kind, text });
  const same = `${A.lineA}${A.lineB}` === `${B.lineA}${B.lineB}`;
  const trueBreeding = same && num(child.purity) >= 5;

  // --- loci: one allele from each parent ---------------------------------------------------------
  LOCI.forEach((l, k) => {
    const salt = 10 + k * 4;
    const fromA = chance(0.5, salt) ? A[`${l.id}A`] : A[`${l.id}B`];
    let fromB = chance(0.5, salt + 1) ? B[`${l.id}A`] : B[`${l.id}B`];
    if (same && fromB !== fromA && (B[`${l.id}A`] === fromA || B[`${l.id}B`] === fromA) && chance(0.5, salt + 2)) fromB = fromA;
    // A rare point mutation: one allele step, never in a true-breeding line.
    if (!trueBreeding && chance(0.02, salt + 3)) {
      const i = alleleIds.indexOf(fromB) + (r(salt + 3.5) < 0.5 ? -1 : 1);
      fromB = alleleIds[clamp(i, 0, ALLELE_STEPS - 1)];
    }
    child[`${l.id}A`] = fromA;
    child[`${l.id}B`] = fromB;
  });

  // --- linkage kits: a weapon kit, a fin kit, a face, each whole from one parent ---------------------
  const kits = inheritKits(child, A, B, P, chance);
  if (kits.length) events.push({ kind: 'kits', text: `inherited whole: ${kits.join(', ')}`, quiet: true });

  // --- identity: a kit from one parent ----------------------------------------------------------------
  const kit = chance(0.5, 100) ? A : B;
  child.terrain = A.terrain;
  child.region = kit.region;
  child.niche = kit.niche;
  child.clade = A.region === B.region && A.niche === B.niche && A.clade === B.clade ? A.clade : 'wild';
  if (child.clade === 'wild' && A.clade !== 'wild' && B.clade !== 'wild') say('species', 'two species crossed: the child belongs to neither');
  child.detail = kit.detail;
  // Form: the same form breeds true; two forms give one parent's, with its kin body.
  const formFrom = A.form === B.form ? A : chance(0.5, 101) ? A : B;
  child.form = formFrom.form;
  if (child.form !== 'fish3') {
    child.body = BODY_RECORDS[child.form].kin;
    child.hybrid = 'none';
    if (A.form !== B.form) say('form', `took after its ${BODY_RECORDS[child.form].label.toLowerCase()} parent`);
  } else if (A.form !== B.form) {
    // A fish3-bodied child of a fish4 form: the fish3 parent's body.
    child.body = (A.form === 'fish3' ? A : B).body;
    child.hybrid = 'none';
  }
  for (const [f, salt] of [['pigment', 102], ['markPigment', 103]]) {
    child[f] = A[f] === B[f] ? A[f] : r(salt) < 0.5 ? A[f] : B[f];
  }
  child.chroma = A.chroma === B.chroma ? A.chroma : pick([A.chroma, B.chroma], 104);
  FEATURE_IDS.forEach((f, i) => {
    child[f] = A[f] === B[f] ? A[f] : chance(0.5, 110 + i) ? A[f] : B[f];
  });

  // --- rarity: the child's own, what the parents pass on, and the Mythic egg ------------------------
  let out = T.normalize(child);
  const own = rarityOf({ ...out, rarity: 'common' }, P);
  const parentPts = (rarityOf(A, P).points + rarityOf(B, P).points) / 2;
  const passed = parentPts * (1 - P.mythic.regression);
  let tier = tierOf(Math.max(own.points, passed), P);
  if (tier === 'myth') tier = 'legendary';
  // Rare parents never hatch a common.
  if (tierRank(A.rarity) >= 2 && tierRank(B.rarity) >= 2 && tierRank(tier) < 1) tier = 'uncommon';
  if (roller(`${seed}:myth`, 5500).r(1) < chanceOfMyth) {
    tier = 'myth';
    say('mythic', 'a Mythic egg!');
  }
  out = T.normalize({ ...out, rarity: tier });
  if (tierRank(tier) > Math.max(tierRank(A.rarity), tierRank(B.rarity)) && tier !== 'myth') say('rarity', `rarer than its parents: ${tier}`);
  return { child: out, events };
}

export { FISH3_IDS, bodyOf };

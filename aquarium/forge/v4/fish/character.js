// fish4's character: everything a keeper would want to know about one fish, read off its genome.
// Pure and deterministic: stats, loci, facts, niche and terrain decide it; the fish's own key
// only breaks ties. Every judgement carries `because` evidence.
//
//   characterOf(set, opts?) → { personality, archetype, traits, quirks, likes, dislikes, fears,
//                               social, care, story, value, voice }
//   compatibility(a, b, opts?) → { score 0..1, verdict, reasons[] }
//   blurbOf(set, opts?) → one line
//
// The tables live in data/character.js.

import { hash01 } from '../../pixel/rng.js';
import { test, specificity, SIZE_ORDER } from './rules.js';
import { statsOf } from './stats.js';
import { ecology4Of } from './ecology4.js';
import { jitterKey } from './genome.js';
import { TERRAINS, REGIONS, NICHES } from './data/terrains.js';
import { namesOf4 } from './names.js';
import { rarityOf } from './rarity.js';
import { reproduction, paramsOf } from './reproduction.js';
import { valueOf } from './economy.js';
import { bodyOf } from './bodies/index.js';
import * as D from './data/character.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const r2 = (x) => Math.round(x * 100) / 100;
const ZONE_WORDS = { top: 'top', mid: 'middle', bottom: 'bottom' };

/** The five axes from the stats (which already carry the body's leanings), plus the niche's nudge. */
function axesOf(stats, set) {
  const out = {};
  const niche = D.NICHE_AXES[set.niche] ?? {};
  for (const [id, a] of Object.entries(D.AXES)) {
    const because = [];
    let v = 0;
    for (const [stat, w] of Object.entries(a.from)) {
      v += stats[stat].value * w;
      because.push({ source: 'stat', label: stat, value: stats[stat].value, weight: w });
    }
    if (niche[id]) {
      v += niche[id];
      because.push({ source: 'niche', label: set.niche, delta: niche[id] });
    }
    v = clamp01(v);
    out[id] = { value: r2(v), word: v >= 0.62 ? a.high : v <= 0.38 ? a.low : `${a.label.toLowerCase()} in the middle`, because };
  }
  return out;
}

/** The nearest archetype; ties (within 0.01) break on the fish's key. */
function archetypeOf(axes, key) {
  const scored = D.ARCHETYPES.map((a) => {
    let d = 0;
    for (const [id, c] of Object.entries(a.centre)) if (c != null) d += (axes[id].value - c) ** 2;
    return { a, d: Math.sqrt(d) };
  }).sort((x, y) => x.d - y.d);
  const near = scored.filter((s) => s.d - scored[0].d < 0.01);
  const pick = near[Math.floor(hash01(key, 8101) * near.length)];
  return { id: pick.a.id, label: pick.a.label, line: pick.a.line, voice: pick.a.voice, distance: r2(pick.d), runnerUp: scored.find((s) => s.a !== pick.a)?.a.id };
}

/** A lookup for conditions: the stats' own, plus the character's facts (axes, archetype, role). */
const lookWith = (look, extra) => (kind, id) => (kind === 'fact' && id in extra ? extra[id] : look(kind, id));

/** Matching entries, most specific first, then by the fish's key. */
function matching(list, look, key, salt) {
  return list
    .filter((e) => test(e.when, look, key))
    .map((e, i) => ({ e, spec: specificity(e.when), h: hash01(`${key}:${e.id ?? i}`, salt) }))
    .sort((a, b) => b.spec - a.spec || a.h - b.h)
    .map((x) => x.e);
}

/** 3–5 adjectives by salience: the extreme axes first, then standout stats. */
function traitsOf(axes, stats) {
  const cands = [];
  for (const [id, a] of Object.entries(axes)) {
    const d = Math.abs(a.value - 0.5);
    if (d >= 0.12) cands.push({ word: a.value > 0.5 ? D.AXES[id].high : D.AXES[id].low, salience: d * 1.2, because: { source: 'axis', label: id, value: a.value } });
  }
  for (const t of D.TRAIT_WORDS) {
    const v = stats[t.stat]?.value;
    if (v == null) continue;
    const word = v >= 0.5 ? t.hi : t.lo;
    if (!word) continue;
    const d = Math.abs(v - 0.5);
    if (d >= 0.15) cands.push({ word, salience: d * t.k, because: { source: 'stat', label: t.stat, value: v } });
  }
  cands.sort((a, b) => b.salience - a.salience || a.word.localeCompare(b.word));
  const seen = new Set();
  const out = [];
  for (const c of cands) {
    if (seen.has(c.word)) continue;
    seen.add(c.word);
    out.push({ ...c, salience: r2(c.salience) });
    if (out.length >= 5) break;
  }
  // Always at least three: fall back to the strongest axis words.
  for (const [id, a] of Object.entries(axes).sort((x, y) => Math.abs(y[1].value - 0.5) - Math.abs(x[1].value - 0.5))) {
    if (out.length >= 3) break;
    const word = a.value >= 0.5 ? D.AXES[id].high : D.AXES[id].low;
    if (!seen.has(word)) {
      seen.add(word);
      out.push({ word, salience: r2(Math.abs(a.value - 0.5)), because: { source: 'axis', label: id, value: a.value } });
    }
  }
  return out;
}

/**
 * The full character. `opts`: `{ params?, stats?, rules?, tier? }` (stats may be passed in when
 * already computed).
 */
export function characterOf(set, opts = {}) {
  const P = paramsOf(opts.params);
  const stats = opts.stats ?? statsOf(set, opts);
  const eco = ecology4Of(set);
  const key = jitterKey(set);
  const axes = axesOf(stats, set);
  const archetype = archetypeOf(axes, key);

  // --- the extra facts conditions can see -------------------------------------------------------
  const extra = Object.fromEntries(Object.entries(axes).map(([id, a]) => [`${id}Axis`, a.value]));
  extra.archetype = archetype.id;
  let look = lookWith(stats.look, extra);
  const role = D.ROLES.find((r) => test(r.when, look, key));
  extra.role = role.id;
  look = lookWith(stats.look, extra);

  // --- traits, quirks, likes ---------------------------------------------------------------------
  const traits = traitsOf(axes, stats);
  const quirkPool = matching(D.QUIRKS, look, key, 8102);
  const nQuirks = 1 + Math.floor(hash01(key, 8103) * 3);
  const chosen = quirkPool.slice(0, nQuirks);
  // A fish from another world always shows one habit of its world.
  const homely = quirkPool.find((q) => q.terrain);
  if (homely && !chosen.some((q) => q.terrain)) chosen[chosen.length - 1] = homely;
  const quirks = chosen.map((q) => ({ id: q.id, text: q.text, because: q.when }));
  const likes = [];
  const dislikes = [];
  const fears = [];
  for (const l of D.LEANINGS) {
    if (!test(l.when, look, key)) continue;
    for (const w of l.likes ?? []) if (!likes.includes(w)) likes.push(w);
    for (const w of l.dislikes ?? []) if (!dislikes.includes(w)) dislikes.push(w);
    for (const w of l.fears ?? []) if (!fears.includes(w)) fears.push(w);
  }

  // --- social ------------------------------------------------------------------------------------
  const social = {
    role: role.id,
    label: role.label,
    schoolSize: stats.schooling.groupSize,
    temperament: eco.temperament.value,
    zone: stats.verticalPref.zone,
    because: [`boldness ${axes.boldness.value}`, `sociability ${axes.sociability.value}`, `territoriality ${stats.territoriality.value}`],
  };

  // --- care sheet --------------------------------------------------------------------------------
  const T = TERRAINS[eco.terrain.value] ?? TERRAINS.water;
  const feedK = clamp01((stats.appetite.value + stats.metabolicRate.value) / 2);
  const care = {
    medium: eco.care.mediumLabel,
    tempC: stats.idealTempC.real,
    tempRange: [r2(stats.idealTempC.real - stats.tempTolerance.real), r2(stats.idealTempC.real + stats.tempTolerance.real)],
    heat: eco.heat.value,
    chemistry: stats.idealPH.applies === false ? null : { label: D.CHEMISTRY[eco.medium.value] ?? 'pH', ideal: stats.idealPH.real },
    radiation: eco.radiance.value > 0 ? { level: r2(eco.radiance.value), note: 'radiant, and harmless: it glows, it does not burn' } : null,
    litres: eco.care.litres ?? null,
    group: stats.schooling.groupSize,
    diet: eco.diet.value,
    feeding: D.FEEDING.find((f) => feedK < f.upTo).text,
    zone: stats.verticalPref.zone,
  };

  // --- life story -------------------------------------------------------------------------------
  const names = namesOf4(set, { look: stats.look, humour: opts.humour ?? P.text?.humour ?? 0.5 });
  const rep = reproduction(set, P, stats);
  const story = {
    terrain: { id: eco.terrain.value, label: T.label },
    region: { id: set.region, label: REGIONS[set.region]?.label ?? 'Unmapped waters' },
    niche: { id: set.niche, label: NICHES[set.niche]?.label ?? 'Unmapped', note: NICHES[set.niche]?.note ?? null },
    clade: set.clade,
    species: names.binomial,
    body: bodyOf(set).label,
    lifespan: stats.lifespan.display,
    maturation: stats.maturationMul.display,
    broods: rep.sterile ? 'sterile' : `${rep.broodLimit} broods of about ${rep.clutch}`,
  };

  // --- value ------------------------------------------------------------------------------------
  const rar = rarityOf(set, P);
  const value = { tier: rar.tier, label: rar.label, points: rar.points, credits: valueOf(set, { params: P, rarity: rar, stats }).credits, top: rar.breakdown.slice(0, 3) };

  // --- voice tags (text matching) ------------------------------------------------------------------
  const voice = [...archetype.voice, eco.terrain.value, role.id, ...traits.slice(0, 2).map((t) => t.word)];

  const out = {
    names: { full: names.full, common: names.common, binomial: names.binomial, nickname: names.nickname?.name ?? null },
    personality: axes,
    archetype,
    traits,
    quirks,
    likes,
    dislikes,
    fears,
    social,
    care,
    story,
    value,
    voice,
    facts: extra,
  };
  // Not enumerable (the JSON stays plain): a condition lookup with the character's facts, for text.
  Object.defineProperty(out, 'look', { value: look, enumerable: false });
  Object.defineProperty(out, 'key', { value: key, enumerable: false });
  return out;
}

/** One line: "A bold, glowing Gossip from the Cooling Lake: hums in the coolant." */
export function blurbOf(set, opts = {}) {
  const c = opts.character ?? characterOf(set, opts);
  const adj = c.traits.slice(0, 2).map((t) => t.word).join(', ');
  const where = c.story.region.id === 'unmapped' ? c.story.terrain.label.toLowerCase() === 'water' ? 'the open water' : c.story.terrain.label : c.story.region.label;
  const article = /^[aeiou]/i.test(adj) ? 'An' : 'A';
  const q = c.quirks[0]?.text ?? c.archetype.line;
  return `${article} ${adj} ${c.archetype.label.toLowerCase()} from ${where.replace(/^The /, 'the ')}; ${q}.`;
}

/**
 * How well two fish would share a tank, 0..1, with reasons. Different terrains: 0, "needs its own
 * tank". `opts` as for characterOf (params).
 */
export function compatibility(a, b, opts = {}) {
  const ea = ecology4Of(a);
  const eb = ecology4Of(b);
  const reasons = [];
  if (ea.terrain.value !== eb.terrain.value) {
    reasons.push({ kind: 'terrain', text: `needs its own tank: ${TERRAINS[ea.terrain.value].mediumLabel} and ${TERRAINS[eb.terrain.value].mediumLabel} do not mix`, mul: 0 });
    return { score: 0, verdict: 'separate tanks', reasons };
  }
  const sa = statsOf(a, opts);
  const sb = statsOf(b, opts);
  let score = 1;
  const mul = (kind, text, k) => {
    if (k >= 0.999) return;
    score *= k;
    reasons.push({ kind, text, mul: r2(k) });
  };
  // Predation: a hungry hunter and a fish two size classes smaller.
  const sizeGap = (x, y) => SIZE_ORDER.indexOf(x.size) - SIZE_ORDER.indexOf(y.size);
  for (const [p, q, sp, label] of [[a, b, sa, 'first'], [b, a, sb, 'second']]) {
    const gap = sizeGap(p, q);
    if (sp.predatoryDrive.value >= 0.5 && gap >= 2) mul('predation', `the ${label} fish sees the other as dinner (${gap} sizes bigger, predatory drive ${sp.predatoryDrive.value})`, Math.max(0.05, 1 - (sp.predatoryDrive.value - 0.3) * (gap - 1) * 0.6));
  }
  // Temper: two hotheads.
  const temper = (s) => s.aggression.value * 0.65 + s.territoriality.value * 0.35;
  const t = temper(sa) * temper(sb);
  if (t > 0.2) mul('temper', `both have a temper (${r2(temper(sa))}, ${r2(temper(sb))})`, Math.max(0.3, 1 - (t - 0.2) * 1.5));
  // Territory: two territorial fish in the same zone.
  if (sa.territoriality.value >= 0.55 && sb.territoriality.value >= 0.55 && sa.verticalPref.zone === sb.verticalPref.zone) mul('territory', `both claim the ${ZONE_WORDS[sa.verticalPref.zone]} of the tank`, 0.65);
  // Temperature: overlap of the comfortable ranges.
  const range = (s) => [s.idealTempC.real - s.tempTolerance.real, s.idealTempC.real + s.tempTolerance.real];
  const [a0, a1] = range(sa);
  const [b0, b1] = range(sb);
  const overlap = Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)) / Math.max(1e-6, Math.min(a1 - a0, b1 - b0));
  if (overlap < 1) mul('temperature', overlap <= 0 ? 'no temperature suits both' : `they agree on temperature only in part (${Math.round(overlap * 100)}%)`, Math.max(0.1, overlap));
  // Shoals: a schooler alone with a loner is fine; two schoolers of one species are better.
  if (a.region === b.region && a.niche === b.niche && a.clade === b.clade && a.clade !== 'wild') reasons.push({ kind: 'kin', text: 'same species: they will school together', mul: 1 });
  score = r2(clamp01(score));
  const verdict = score >= 0.8 ? 'great tankmates' : score >= 0.55 ? 'can share a tank' : score >= 0.3 ? 'risky' : 'keep apart';
  return { score, verdict, reasons };
}

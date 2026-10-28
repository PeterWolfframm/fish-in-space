// Fish lore: a catalogue entry assembled from what the fish is. Every line comes from a pool
// keyed by a fact about this fish -- its ecology (ecology.js), its standout traits (the name's
// salience keys) or its signature -- so the text can exaggerate, but never invent.
//
// Until a pool has lines, a plain factual sentence stands in, so the entry is always complete and
// always true. The voice and the rules for writing lines: docs/lore-writing-guide.md.

import { roller } from '../../pixel/rng.js';
import { fish3Traits } from './genome.js';
import { phenotype } from './phenotype.js';
import { ecologyOf } from './ecology.js';
import { WORDS } from './ecology-data.js';
import { namesOf } from './names.js';
import { CODEX, QUOTES, EDICTS, LEGENDS, CLASSES } from './lore-data.js';

const T = fish3Traits;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** Ecology facts a codex line can be about, in the order they are worth mentioning. */
const CODEX_FACTS = ['diet', 'feeding', 'temperament', 'activity', 'depth', 'level', 'sociality', 'current', 'temp', 'salinity'];
const EDICT_FACTS = ['temperament', 'sociality', 'level'];

/** The lines a pool has for a key at this rarity. */
function linesOf(pool, key, tier) {
  return (pool[key] ?? []).filter((l) => typeof l === 'string' || !l.tiers || l.tiers.includes(tier));
}
const textOf = (l) => (typeof l === 'string' ? l : l.text);

/** Every token a line may use, resolved for this fish. */
function tokensOf(ph, eco, names) {
  const label = (f, v) => T.fieldById(f).choices.find((c) => c.id === v)?.label ?? '';
  const body = ph.body !== ph.set.body ? label('hybrid', ph.body) : label('body', ph.set.body);
  const w = (k) => WORDS[k][eco[k].value] ?? eco[k].value;
  return {
    name: names.common,
    full: names.full,
    binomial: names.binomial,
    genus: names.binomial.split(' ')[0],
    body: body.toLowerCase(),
    Body: body,
    colour: label('skin', ph.set.skin).toLowerCase(),
    signature: ph.signature !== 'none' ? label('signature', ph.signature).toLowerCase() : '',
    relic: ph.relic !== 'none' ? label('relic', ph.relic).toLowerCase() : '',
    diet: w('diet'),
    depth: w('depth'),
    temp: w('temp'),
    current: w('current'),
    cm: String(eco.care.cm),
    litres: String(eco.care.litres),
    tempLo: String(eco.care.tempC[0]),
    tempHi: String(eco.care.tempC[1]),
    group: String(eco.care.group),
  };
}

/** Swap `{token}`s for their values. Unknown tokens are left in, so tests can catch them. */
const fill = (text, tokens) => text.replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));

/** Plain stand-ins, true by construction, for keys with no lines yet. */
const FALLBACK = {
  codex: (fact, eco, t) => {
    const w = WORDS[fact][eco[fact].value] ?? eco[fact].value;
    switch (fact) {
      case 'diet': return `The ${t.name} ${w}.`;
      case 'feeding': return `It ${w}.`;
      case 'temperament': return `Temperament: ${w}.`;
      case 'activity': return `It is ${w}.`;
      case 'depth': return `Found in ${w}.`;
      case 'level': return `It ${w}.`;
      case 'sociality': return `Best kept: ${w.replace(/^keep /, '')}.`;
      case 'current': return `Prefers ${w}.`;
      case 'temp': return `Prefers ${w} water, ${t.tempLo}–${t.tempHi} °C.`;
      default: return `Lives in ${w}.`;
    }
  },
  edict: (eco, t) => `${cap(WORDS.sociality[eco.sociality.value])}; at least ${t.litres} L, ${t.tempLo}–${t.tempHi} °C.`,
  legend: (t) => [t.relic && `Relic: ${t.relic}.`, t.signature && `Signature: ${t.signature}.`].filter(Boolean).join(' '),
};

/** The fish's catalogue entry. */
export function loreOf(genome) {
  const ph = phenotype(genome);
  const tier = ph.set.rarity;
  const eco = ecologyOf(genome);
  const names = namesOf(genome);
  const t = tokensOf(ph, eco, names);
  const { pick, chance } = roller(ph.seed, 9400);

  const ecoKeys = CODEX_FACTS.map((f) => `${f}.${eco[f].value}`);
  const traitKeys = names.keys;
  const allKeys = [...traitKeys, ...ecoKeys, `rarity.${tier}`];

  // --- designation -----------------------------------------------------------------------------
  const cls = pick(CLASSES[tier] ?? CLASSES.common, 1);
  const designation = `${names.binomial} · ${cls} · ${WORDS.depth[eco.depth.value] ?? eco.depth.value}`;

  // --- quote: from any key that has one --------------------------------------------------------
  const quoted = allKeys.flatMap((k) => linesOf(QUOTES, k, tier).map((q) => ({ ...q, key: k })));
  const q = quoted.length ? pick(quoted, 2) : null;
  const quote = q ? { text: fill(q.text, t), by: fill(q.by ?? '', t), key: q.key } : null;

  // --- codex: three facts, the first always the diet; a standout trait may take the last slot --
  const facts = ['diet', ...CODEX_FACTS.slice(1).filter((f, i) => chance(0.45, 10 + i))].slice(0, 3);
  while (facts.length < 3) facts.push(CODEX_FACTS.find((f) => !facts.includes(f)));
  const codex = facts.map((f, i) => {
    const key = `${f}.${eco[f].value}`;
    const lines = linesOf(CODEX, key, tier);
    return { key, text: lines.length ? fill(textOf(pick(lines, 20 + i)), t) : FALLBACK.codex(f, eco, t) };
  });
  const traitLines = traitKeys.flatMap((k) => linesOf(CODEX, k, tier).map((l) => ({ key: k, l })));
  if (traitLines.length && chance(0.6, 30)) {
    const tl = pick(traitLines, 31);
    codex[2] = { key: tl.key, text: fill(textOf(tl.l), t) };
  }

  // --- edict -----------------------------------------------------------------------------------
  const edictKeys = EDICT_FACTS.map((f) => `${f}.${eco[f].value}`);
  const edictLines = edictKeys.flatMap((k) => linesOf(EDICTS, k, tier).map((l) => ({ key: k, l })));
  const e = edictLines.length ? pick(edictLines, 40) : null;
  const edict = e ? { key: e.key, text: fill(textOf(e.l), t) } : { key: 'care', text: FALLBACK.edict(eco, t) };

  // --- legend: rare and myth only ---------------------------------------------------------------
  let legend = null;
  const legendKeys = [ph.relic !== 'none' && `relic.${ph.relic}`, ph.signature !== 'none' && `signature.${ph.signature}`].filter(Boolean);
  if (legendKeys.length) {
    const lines = legendKeys.flatMap((k) => linesOf(LEGENDS, k, tier).map((l) => ({ key: k, l })));
    const l = lines.length ? pick(lines, 50) : null;
    legend = l ? { key: l.key, text: fill(textOf(l.l), t) } : { key: legendKeys[0], text: FALLBACK.legend(t) };
  }

  return { name: names.full, binomial: names.binomial, designation, quote, codex, edict, legend };
}

/** The entry as plain text, one line per beat. */
export function loreText(genome) {
  const l = loreOf(genome);
  return [
    l.designation,
    l.quote && `“${l.quote.text}”${l.quote.by ? ` — ${l.quote.by}` : ''}`,
    ...l.codex.map((c) => c.text),
    l.edict.text,
    l.legend?.text,
  ].filter(Boolean).join('\n');
}

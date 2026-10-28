#!/usr/bin/env node
// Lore coverage: every key a fish3 lore line can hang on, how often fish carry it, and how many
// lines each pool has for it. The writers' to-do list (docs/lore-writing-guide.md).
//   node scripts/lore-coverage.mjs             every key
//   node scripts/lore-coverage.mjs --missing   only keys short of a target
//   node scripts/lore-coverage.mjs --json      machine-readable

import gen from '../src/v3/fish/index.js';
import { phenotype } from '../src/v3/fish/phenotype.js';
import { ecologyOf } from '../src/v3/fish/ecology.js';
import { salienceOf } from '../src/v3/fish/names.js';
import { SCALES, SPECIAL } from '../src/v3/fish/ecology-data.js';
import { MODIFIERS, PATTERN_PARTS, TAXA, TITLES } from '../src/v3/fish/names-data.js';
import { SIGNATURES, RELICS, fish3Traits as T } from '../src/v3/fish/genome.js';
import { BODY_COLORS } from '../src/gen/fish/palettes.js';
import { CODEX, QUOTES, EDICTS, LEGENDS } from '../src/v3/fish/lore-data.js';

const args = process.argv.slice(2);
const SAMPLE = 4000;
/** Lines wanted per key, per pool. */
const TARGET = { codex: 6, quote: 2, edict: 4, legend: 4 };
const CODEX_FACTS = ['diet', 'feeding', 'temperament', 'activity', 'depth', 'level', 'sociality', 'current', 'temp', 'salinity'];
const EDICT_FACTS = ['temperament', 'sociality', 'level'];

// --- the key universe ----------------------------------------------------------------------------
const keys = new Map();
const add = (key, kind, pools) => keys.set(key, { key, kind, pools, seen: 0 });
for (const f of CODEX_FACTS) {
  for (const v of [...SCALES[f], ...(SPECIAL[f] ?? [])]) add(`${f}.${v}`, 'ecology', EDICT_FACTS.includes(f) ? ['codex', 'quote', 'edict'] : ['codex', 'quote']);
}
const traitKeys = [
  ...Object.keys(MODIFIERS).filter((k) => !/^(signature|relic)\./.test(k)),
  ...Object.keys(PATTERN_PARTS).map((p) => `pattern.${p}`),
  ...T.fieldById('eyeMount').choices.filter((c) => c.id !== 'normal').map((c) => `eyes.${c.id}`),
  'eyes.bubble',
  ...BODY_COLORS.map((c) => `skin.${c.id}`),
];
for (const k of new Set(traitKeys)) if (!keys.has(k)) add(k, 'trait', ['codex', 'quote']);
for (const [id] of SIGNATURES) add(`signature.${id}`, 'signature', ['codex', 'quote', 'legend']);
for (const [id] of RELICS) add(`relic.${id}`, 'relic', ['codex', 'quote', 'legend']);
for (const r of ['common', 'uncommon', 'rare', 'myth']) add(`rarity.${r}`, 'rarity', ['quote']);

// --- how often each key turns up on random fish ----------------------------------------------------
for (let i = 0; i < SAMPLE; i++) {
  const g = gen.fromSeed(`coverage-${i}`);
  const ph = phenotype(g);
  const eco = ecologyOf(g);
  const seen = new Set([...salienceOf(ph), ...CODEX_FACTS.map((f) => `${f}.${eco[f].value}`), `rarity.${ph.set.rarity}`]);
  for (const k of seen) if (keys.has(k)) keys.get(k).seen++;
}

const POOLS = { codex: CODEX, quote: QUOTES, edict: EDICTS, legend: LEGENDS };
const rows = [...keys.values()].map((k) => {
  const counts = Object.fromEntries(k.pools.map((p) => [p, (POOLS[p][k.key] ?? []).length]));
  const short = k.pools.filter((p) => counts[p] < TARGET[p]);
  return { key: k.key, kind: k.kind, share: k.seen / SAMPLE, counts, short };
});
const unknown = Object.entries(POOLS).flatMap(([p, pool]) => Object.keys(pool).filter((k) => !keys.has(k)).map((k) => `${p}: ${k}`));

// --- name pools: every body and every signature needs words -------------------------------------
const nameGaps = [
  ...T.fieldById('body').choices.filter((c) => !TAXA[c.id]).map((c) => `TAXA.${c.id}`),
  ...[...SIGNATURES, ...RELICS].filter(([id]) => !TITLES[id]?.length).map(([id]) => `TITLES.${id}`),
];

if (args.includes('--json')) {
  console.log(JSON.stringify({ target: TARGET, rows, unknown, nameGaps }, null, 2));
  process.exit(0);
}

const show = args.includes('--missing') ? rows.filter((r) => r.short.length) : rows;
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('key', 26)}${pad('kind', 11)}${pad('fish', 7)}${Object.keys(TARGET).map((p) => pad(`${p}/${TARGET[p]}`, 10)).join('')}`);
for (const r of show.sort((a, b) => a.kind.localeCompare(b.kind) || b.share - a.share)) {
  const cells = Object.keys(TARGET).map((p) => pad(p in r.counts ? r.counts[p] : '·', 10)).join('');
  const share = r.share ? `${(r.share * 100).toFixed(r.share < 0.01 ? 1 : 0)}%` : 'rare';
  console.log(`${pad(r.key, 26)}${pad(r.kind, 11)}${pad(share, 7)}${cells}`);
}
const need = rows.reduce((n, r) => n + r.short.reduce((m, p) => m + TARGET[p] - r.counts[p], 0), 0);
console.log(`\n${rows.length} keys, ${rows.filter((r) => !r.short.length).length} at target; ${need} lines to write.`);
if (unknown.length) console.log(`Unknown keys (typos? no fish can carry them): ${unknown.join(', ')}`);
if (nameGaps.length) console.log(`Name pools missing: ${nameGaps.join(', ')}`);

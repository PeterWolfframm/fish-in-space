#!/usr/bin/env node
// Every salt fish4 rolls on, and the next free one in each range.
//
//   node scripts/fish4-salts.mjs           print the map
//   node scripts/fish4-salts.mjs --check   exit 1 on a collision (CI, and the extend-fish4 skill)
//
// A salt is what makes a field's roll independent of its neighbours. Two things on one salt roll
// together, which shows up as fish that always pair two traits — so adding anything to fish4
// starts here. `roller(seed, N)` salts are read out of the source, because they are not declared
// anywhere a registry can see.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fish4Traits as T, LOCI, FEATURES } from '../src/v4/fish/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'src');

/** The ranges the salt map is organised into (see docs/fish4.md). */
const RANGES = [
  { id: 'fish3 fields', from: 0, to: 2047 },
  { id: 'chroma', from: 2048, to: 2063 },
  { id: 'loci', from: 2064, to: 2543 },
  { id: 'identity fields', from: 2544, to: 3071 },
  { id: 'feature modules', from: 3072, to: 4095 },
  { id: 'rollers', from: 4096, to: Infinity },
];
const rangeOf = (salt) => RANGES.find((r) => salt >= r.from && salt <= r.to) ?? RANGES.at(-1);

/** Every .js file under src/v3/fish and src/v4/fish. */
function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** `roller(anything, 5200)` → the literal salt and where it is. */
function rollerSalts() {
  const out = [];
  for (const file of [...sources(join(SRC, 'v3', 'fish')), ...sources(join(SRC, 'v4', 'fish'))]) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/roller\((.+?),\s*(\d+)\s*\)/g)) {
        out.push({ salt: Number(m[2]), owner: `roller(${m[1].trim()})`, where: `${relative(ROOT, file)}:${i + 1}` });
      }
    });
  }
  return out;
}

// A feature declares its field, and the genome then carries that same field: one salt, not two.
const featureFields = new Set(FEATURES.map((f) => `${f.id}@${f.field.salt}`));
const fields = T.fields.map((f) => ({
  kind: 'field',
  salt: f.salt,
  owner: `${featureFields.has(`${f.id}@${f.salt}`) ? 'feature' : 'field'} ${f.id}`,
  where: f.locus ? `locus ${f.locus}` : `${f.choices.length} choices`,
}));
const rollers = rollerSalts().map((r) => ({ kind: 'roller', ...r }));
const entries = [...fields, ...rollers].sort((a, b) => a.salt - b.salt || a.owner.localeCompare(b.owner));

const bySalt = new Map();
for (const e of entries) bySalt.set(e.salt, [...(bySalt.get(e.salt) ?? []), e]);

// Two things collide only when the same salt can be handed the same seed:
//   fields   all roll off the genome seed, so a shared salt means they roll together;
//   rollers  are namespaced by their seed string first, so `roller(seed, 7000)` and
//            `roller(ph.seed, 7000)` are independent — only the same seed expression clashes.
// A field salt and a roller salt never meet: fields are sub-salts of `roller(seed, 0)`.
const collisions = [];
const dup = (list, key) => {
  const seen = new Map();
  for (const e of list) {
    const k = key(e);
    if (seen.has(k) && seen.get(k).owner !== e.owner) collisions.push([e.salt, seen.get(k), e]);
    else seen.set(k, e);
  }
};
dup(fields, (e) => e.salt);
dup(rollers, (e) => `${e.salt}|${e.owner}`);

if (process.argv.includes('--check')) {
  for (const [salt, a, b] of collisions) console.error(`salt ${salt}: ${a.owner} (${a.where}) and ${b.owner} (${b.where}) roll together`);
  console.error(collisions.length ? `${collisions.length} salt collision(s)` : `ok: ${entries.length} salts in use, no collisions`);
  process.exit(collisions.length ? 1 : 0);
}

let range = null;
for (const e of entries) {
  const r = rangeOf(e.salt);
  if (r !== range) {
    range = r;
    console.log(`\n── ${r.id} (${r.from}–${r.to === Infinity ? '…' : r.to})`);
  }
  console.log(`  ${String(e.salt).padStart(5)}  ${e.owner.padEnd(34)} ${e.where}`);
}

console.log('\n── next free');
for (const r of RANGES) {
  const used = entries.filter((e) => rangeOf(e.salt) === r).map((e) => e.salt);
  const step = r.id === 'loci' ? 32 : 16;
  let next = used.length ? Math.max(...used) + step - (Math.max(...used) % step) : r.from;
  while (bySalt.has(next)) next += step;
  const note = r.id === 'loci' ? '  (A, then +16 for B)' : '';
  console.log(`  ${r.id.padEnd(18)} ${next > r.to ? 'full — widen the range in docs/fish4.md' : next}${next > r.to ? '' : note}`);
}
console.log(`\n${LOCI.length} loci, ${T.fields.length} fields, ${entries.length} salts, ${collisions.length} collision(s).`);

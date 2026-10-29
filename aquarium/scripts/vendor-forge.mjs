#!/usr/bin/env node
// Copy the procgen + pixelgen tree from the fish-in-space monorepo into aquarium/forge/.
//   node scripts/vendor-forge.mjs [--check]
// Standalone repo: forge/ is committed; re-run from a fish-in-space checkout with parent ../src.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const AQUARIUM = join(HERE, '..');
const DEST = join(AQUARIUM, 'forge');
const PARENT_SRC = join(AQUARIUM, '..', 'src');

/** Paths under src/ to copy (directories recurse). */
const COPY = [
  'pixel',
  'gen',
  'pixelgen',
  'v3/fish',
  'v3/plant',
  'v4/fish',
  'v2/anim',
  'v2/kit',
  'v2/waterplant',
  'v2/pilot',
  'v2/fish',
  'v2/plant',
];

function copyTree(srcRoot, rel) {
  const src = join(srcRoot, rel);
  const out = join(DEST, rel);
  if (!existsSync(src)) throw new Error(`missing source: ${src}`);
  mkdirSync(dirname(out), { recursive: true });
  cpSync(src, out, { recursive: true });
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base));
    else out.push(relative(base, p));
  }
  return out.sort();
}

const check = process.argv.includes('--check');
const srcRoot = existsSync(PARENT_SRC) ? PARENT_SRC : null;

if (!srcRoot) {
  if (existsSync(join(DEST, 'v3/fish/index.js'))) {
    console.log('forge/ present; no parent ../src (standalone repo OK)');
    process.exit(0);
  }
  console.error('No ../src and no forge/ — run from fish-in-space monorepo or commit vendored forge/');
  process.exit(1);
}

if (check) {
  let drift = false;
  for (const rel of COPY) {
    const src = join(srcRoot, rel);
    const dest = join(DEST, rel);
    if (!existsSync(src)) {
      console.error(`missing monorepo: ${rel}`);
      drift = true;
      continue;
    }
    if (!existsSync(dest)) {
      console.error(`missing forge: ${rel}`);
      drift = true;
    }
  }
  process.exit(drift ? 1 : 0);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const rel of COPY) copyTree(srcRoot, rel);
console.log(`vendored forge/ (${COPY.length} roots, ${listFiles(DEST).length} files) from ${srcRoot}`);

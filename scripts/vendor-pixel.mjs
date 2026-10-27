// Copy the game-agnostic pixel-art core out of the kit it lives in and into src/pixel/.
//
// The kit (~/Code/yeswar/kit/web/pixel/) is the single source of truth: edit it there, run this,
// commit the result. test/vendor.test.mjs fails if the copies drift.
//
//   node scripts/vendor-pixel.mjs [--check]
//
// --check reports drift without writing anything.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEST = join(HERE, '..', 'src', 'pixel');
export const SOURCE = process.env.PIXEL_KIT
  ?? join(process.env.HOME ?? '', 'Code', 'yeswar', 'kit', 'web', 'pixel');

const BANNER = `// Vendored from the pixel kit — do not edit here.
// Source: kit/web/pixel/%s in the Burn-Through repo.
// Run \`node scripts/vendor-pixel.mjs\` to update, and edit it there.
`;

/** The kit files this project vendors. Tests stay in the kit. */
export const FILES = ['rng.js', 'color.js', 'grid.js', 'blit.js', 'traits.js'];

/** The vendored text for one kit file, banner included. */
export function vendored(name) {
  return BANNER.replace('%s', name) + readFileSync(join(SOURCE, name), 'utf8');
}

/** Names of vendored files that differ from the kit, plus .js files the kit no longer has. */
export function drift() {
  const drifted = FILES.filter((name) => {
    const path = join(DEST, name);
    return !existsSync(path) || readFileSync(path, 'utf8') !== vendored(name);
  });
  const stale = existsSync(DEST) ? readdirSync(DEST).filter((f) => f.endsWith('.js') && !FILES.includes(f)) : [];
  return { drifted, stale };
}

function main() {
  const check = process.argv.includes('--check');
  if (!existsSync(SOURCE)) {
    console.error(`pixel kit not found at ${SOURCE}; set PIXEL_KIT to its directory`);
    process.exit(2);
  }
  mkdirSync(DEST, { recursive: true });
  const { drifted, stale } = drift();
  if (check) {
    if (!drifted.length && !stale.length) return console.log(`src/pixel/ matches ${SOURCE}`);
    for (const name of drifted) console.error(`drifted: ${name}`);
    for (const name of stale) console.error(`no longer in the kit: ${name}`);
    process.exit(1);
  }
  for (const name of drifted) writeFileSync(join(DEST, name), vendored(name));
  console.log(drifted.length ? `updated: ${drifted.join(', ')}` : 'already up to date');
  for (const name of stale) console.warn(`no longer in the kit, delete it: ${name}`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();

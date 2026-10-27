#!/usr/bin/env node
// Batch-generate sprites from the command line.
//
//   node cli/forge.mjs <kind> [--count 24] [--seed name] [--code <code>] [--anim id] [--scale 4]
//                             [--sheet] [--contact] [--bg] [--avatar] [--out out/<kind>]
//
//   kind       pilot | fish | waterplant | plant | plant32   (`list` prints them)
//   --count    how many genomes, seeded <seed>-0 … <seed>-(n-1)
//   --seed     the seed (or seed prefix with --count > 1); default "forge"
//   --code     render exactly this genome code instead (repeatable)
//   --anim     which animation to export (default: the generator's first)
//   --scale    integer upscale of every PNG (default 4)
//   --sheet    one sprite sheet per genome (all frames of the anim in a row) instead of frame PNGs
//   --contact  one contact sheet: a row per genome, a column per frame
//   --bg       paint the generator's preview background instead of transparency
//   --avatar   pilots: dress them as crew-room avatars rolled from the seed
//
// Writes PNGs and manifest.json (seed → code → files) into --out.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATORS, generator, fromCode } from '../src/gen/registry.js';
import { toSheet } from '../src/pixel/blit.js';
import { imagePNG } from '../src/png.js';

function parse(argv) {
  const args = { _: [], code: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) args._.push(a);
    else if (['sheet', 'contact', 'bg', 'avatar', 'help'].includes(a.slice(2))) args[a.slice(2)] = true;
    else if (a === '--code') args.code.push(argv[++i]);
    else args[a.slice(2)] = argv[++i];
  }
  return args;
}

const args = parse(process.argv.slice(2));
const kind = args._[0];
if (!kind || args.help || kind === 'list') {
  console.log('kinds:');
  for (const g of GENERATORS) console.log(`  ${g.id.padEnd(11)} ${g.label} (${g.game}), ${g.size.w}×${g.size.h}, anims: ${g.anims.map((a) => `${a.id}×${a.frames}`).join(' ')}`);
  console.log('\nusage: node cli/forge.mjs <kind> [--count n] [--seed s] [--code c] [--anim id] [--scale k] [--sheet|--contact] [--bg] [--out dir]');
  process.exit(kind ? 0 : 2);
}
const gen = generator(kind);
if (!gen) {
  console.error(`unknown kind "${kind}"; try: ${GENERATORS.map((g) => g.id).join(', ')}`);
  process.exit(2);
}
const anim = gen.anims.find((a) => a.id === (args.anim ?? gen.anims[0].id));
if (!anim) {
  console.error(`${kind} has no anim "${args.anim}"; it has: ${gen.anims.map((a) => a.id).join(', ')}`);
  process.exit(2);
}
const scale = Math.max(1, Math.round(Number(args.scale ?? 4)));
const bg = args.bg ? gen.bg : null;
const out = args.out ?? join('out', kind);
mkdirSync(out, { recursive: true });

// The genomes: given codes, else count seeds.
const entries = [];
if (args.code.length) {
  for (const code of args.code) {
    const genome = fromCode(gen, code);
    if (!genome) {
      console.error(`"${code}" is not a ${kind} code (they start with "${gen.traits.prefix}")`);
      process.exit(2);
    }
    entries.push({ seed: null, genome });
  }
} else {
  const count = Math.max(1, Number(args.count ?? 1));
  const seed = args.seed ?? 'forge';
  for (let i = 0; i < count; i++) {
    const s = count === 1 ? seed : `${seed}-${i}`;
    entries.push({ seed: s, genome: gen.fromSeed(s, { avatar: args.avatar ?? null }) });
  }
}

const frames = (genome) => Array.from({ length: anim.frames }, (_, i) => gen.frame(genome, anim.id, i));
const manifest = { kind, anim: anim.id, frames: anim.frames, fps: anim.fps, size: gen.size, scale, items: [] };
const safe = (s) => String(s).replace(/[^a-z0-9._-]+/gi, '_');

if (args.contact) {
  const all = entries.flatMap((e) => frames(e.genome));
  const sheet = toSheet(all, { columns: anim.frames });
  const file = `${kind}-${anim.id}-contact.png`;
  writeFileSync(join(out, file), imagePNG(sheet, scale, bg ?? gen.bg));
  for (const [row, e] of entries.entries()) manifest.items.push({ seed: e.seed, code: gen.traits.encode(e.genome), row });
  manifest.contact = file;
} else {
  for (const e of entries) {
    const code = gen.traits.encode(e.genome);
    const name = safe(e.seed ?? code);
    const imgs = frames(e.genome);
    const files = [];
    if (args.sheet || imgs.length === 1) {
      const file = `${name}-${anim.id}.png`;
      writeFileSync(join(out, file), imagePNG(imgs.length === 1 ? imgs[0] : toSheet(imgs), scale, bg));
      files.push(file);
    } else {
      imgs.forEach((img, i) => {
        const file = `${name}-${anim.id}-${String(i).padStart(2, '0')}.png`;
        writeFileSync(join(out, file), imagePNG(img, scale, bg));
        files.push(file);
      });
    }
    manifest.items.push({ seed: e.seed, code, files });
  }
}

writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${entries.length} ${kind} × ${anim.frames} ${anim.id} frame(s) → ${out}/`);

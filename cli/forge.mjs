#!/usr/bin/env node
// Batch-generate sprites from the command line.
//
//   node cli/forge.mjs <kind> [--count 24] [--seed name] [--code <code>] [--anim id] [--scale 4]
//                             [--sheet] [--contact] [--bg] [--avatar] [--out out/<kind>]
//
//   kind       v1: pilot | fish | waterplant | plant | plant32
//              v2: pilot2 | fish2 | waterplant2 | plant2
//              v3: fish3 (tiny … giant, --set swim=raised|side|cartoon)
//              (`list` prints them all)
//   --size     v2: a size class (fish2: tiny … giant), or `all` for every class of each genome
//   --count    how many genomes, seeded <seed>-0 … <seed>-(n-1)
//   --seed     the seed (or seed prefix with --count > 1); default "forge"
//   --code     render exactly this genome code instead (repeatable)
//   --anim     which animation to export (default: the generator's first)
//   --scale    integer upscale of every PNG (default 4)
//   --sheet    one sprite sheet per genome (all frames of the anim in a row) instead of frame PNGs
//   --contact  one contact sheet: a row per genome, a column per frame
//   --bg       paint the generator's preview background instead of transparency
//   --avatar   pilots: dress them as crew-room avatars rolled from the seed
//   --look     v2: lit | comic | clean, forced onto every genome
//   --set      force a trait on every genome, field=value (repeatable), e.g. --set body=piranha
//   --beautify pixelgen: render each genome in the style a model likes best, rolls with the
//              weakest of a few candidates left out. public | personal:<userId> | blend:<userId>,
//              read from PocketBase (PB_URL, superuser as for the trainer), or `file` with --model
//   --model    a model JSON file (a stored model record, or a Net's toJSON) for --beautify
//
// Writes PNGs and manifest.json (seed → code → files) into --out.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATORS, generator, fromCode, sizeOf } from '../src/gen/registry.js';
import { padAll } from '../src/v2/kit/sizes.js';
import { toSheet } from '../src/pixel/blit.js';
import { imagePNG } from '../src/png.js';
import { hasStyle } from '../src/pixelgen/features.js';
import { beautify, pickGood, blend } from '../src/pixelgen/beautify.js';
import { loadModel } from '../src/pixelgen/model.js';
import { Net } from '../src/pixelgen/net.js';

function parse(argv) {
  const args = { _: [], code: [], set: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) args._.push(a);
    else if (['sheet', 'contact', 'bg', 'avatar', 'help'].includes(a.slice(2))) args[a.slice(2)] = true;
    else if (a === '--code') args.code.push(argv[++i]);
    else if (a === '--set') args.set.push(argv[++i]);
    else args[a.slice(2)] = argv[++i];
  }
  return args;
}

const args = parse(process.argv.slice(2));
const kind = args._[0];
if (!kind || args.help || kind === 'list') {
  console.log('kinds:');
  for (const g of GENERATORS) {
    const sizes = g.sizes ? g.sizes.map((s) => `${s.id} ${s.w}×${s.h}`).join(', ') : `${g.size.w}×${g.size.h}`;
    console.log(`  ${g.id.padEnd(14)} v${g.version ?? 1}  ${g.label} (${g.game})\n${' '.repeat(20)}sizes: ${sizes}\n${' '.repeat(20)}anims: ${g.anims.map((a) => `${a.id}×${a.frames}`).join(' ')}`);
  }
  console.log('\nusage: node cli/forge.mjs <kind> [--count n] [--seed s] [--code c] [--anim id] [--size class|all] [--scale k] [--sheet|--contact] [--bg] [--out dir]\n                           [--look lit|comic|clean] [--beautify public|personal:<id>|blend:<id>|file] [--model file.json]');
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

const normalize = (g) => (gen.normalize ? gen.normalize(g) : gen.traits.normalize(g));

// --look: a whole-render look forced onto every v2 genome.
const LOOKS = ['lit', 'comic', 'clean'];
if (args.look && (!LOOKS.includes(args.look) || !hasStyle(gen))) {
  console.error(hasStyle(gen) ? `--look is one of ${LOOKS.join(', ')}` : `${kind} has no looks; try a v2 kind`);
  process.exit(2);
}
const fixed = args.look ? { look: args.look } : {};
for (const kv of args.set) {
  const [field, value] = kv.split('=');
  const f = gen.traits.fieldById?.(field);
  if (!f || !f.choices.some((c) => c.id === value)) {
    console.error(f ? `${field} is one of: ${f.choices.map((c) => c.id).join(' ')}` : `${kind} has no field "${field}"`);
    process.exit(2);
  }
  fixed[field] = value;
}

// --beautify: the model to render for, from a file or PocketBase.
async function readModel(spec) {
  if (args.model) {
    const json = JSON.parse(readFileSync(args.model, 'utf8'));
    return json.weights ? loadModel(json) : Net.fromJSON(json);
  }
  const { adminClient } = await import('../server/pb.mjs');
  const pb = await adminClient();
  const get = (filter) =>
    pb
      .collection('models')
      .getFirstListItem(filter)
      .then(loadModel, () => null);
  const [scope, user] = spec.split(':');
  const pub = scope === 'personal' ? null : await get('scope = "public"');
  const own = user ? await get(pb.filter('scope = "personal" && user = {:user}', { user })) : null;
  if (scope === 'public') return pub;
  if (scope === 'personal') return own;
  if (scope === 'blend') return blend(pub, own, 0.5);
  throw new Error(`--beautify is public, personal:<userId>, blend:<userId> or file (with --model)`);
}
let model = null;
if (args.beautify || args.model) {
  if (!hasStyle(gen)) {
    console.error(`${kind} has no style genome to beautify; try a v2 kind`);
    process.exit(2);
  }
  try {
    model = await readModel(args.beautify ?? 'file');
  } catch (e) {
    console.error(`couldn't load the model: ${e.message}`);
    process.exit(1);
  }
  if (!model) {
    console.error('no such model (yet), or it was trained on an older feature layout: swipe some more and let the trainer run');
    process.exit(1);
  }
}

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
    const roll = (x) => gen.fromSeed(x, { avatar: args.avatar ?? null });
    entries.push({ seed: s, genome: model ? pickGood(gen, model, s, { roll }) : roll(s) });
  }
}

// --size: force a class (or every class) onto each genome; v1 generators have one size.
if (args.size) {
  if (!gen.sizes) {
    console.error(`${kind} is a v1 generator with one size (${gen.size.w}×${gen.size.h}); try ${kind.replace(/32$/, '')}2`);
    process.exit(2);
  }
  const ids = args.size === 'all' ? gen.sizes.map((s) => s.id) : [args.size];
  const bad = ids.find((id) => !gen.sizes.some((s) => s.id === id));
  if (bad) {
    console.error(`${kind} has no size "${bad}"; it has: ${gen.sizes.map((s) => s.id).join(', ')}, all`);
    process.exit(2);
  }
  const sized = entries.flatMap((e) => ids.map((id) => ({ ...e, seed: e.seed && ids.length > 1 ? `${e.seed}-${id}` : e.seed, genome: gen.normalize ? gen.normalize({ ...e.genome, [gen.sizeField]: id }) : gen.traits.normalize({ ...e.genome, [gen.sizeField]: id }) })));
  entries.splice(0, entries.length, ...sized);
}

// The look, then the model's styling (which never changes a forced look).
for (const e of entries) {
  e.genome = normalize({ ...e.genome, ...fixed });
  if (!model) continue;
  const b = beautify(gen, e.genome, model, { fixed });
  e.genome = b.genome;
  e.beauty = b.beauty;
}

const frames = (genome) => Array.from({ length: anim.frames }, (_, i) => gen.frame(genome, anim.id, i));
const manifest = { kind, version: gen.version ?? 1, anim: anim.id, frames: anim.frames, fps: anim.fps, size: gen.size, scale, items: [] };
const safe = (s) => String(s).replace(/[^a-z0-9._-]+/gi, '_');

if (args.contact) {
  // Mixed sizes are padded to the biggest, anchored the way the kind stands (plants on the floor).
  const all = padAll(entries.flatMap((e) => frames(e.genome)), gen.anchor ?? 'center');
  const sheet = toSheet(all, { columns: anim.frames });
  const file = `${kind}-${anim.id}-contact.png`;
  writeFileSync(join(out, file), imagePNG(sheet, scale, bg ?? gen.bg));
  for (const [row, e] of entries.entries()) manifest.items.push({ seed: e.seed, code: gen.traits.encode(e.genome), ...(gen.name ? { name: gen.name(e.genome) } : {}), size: sizeOf(gen, e.genome), row, ...(e.beauty != null ? { beauty: e.beauty } : {}) });
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
    manifest.items.push({ seed: e.seed, code, ...(gen.name ? { name: gen.name(e.genome) } : {}), size: sizeOf(gen, e.genome), files, ...(e.beauty != null ? { beauty: e.beauty } : {}) });
  }
}

writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${entries.length} ${kind} × ${anim.frames} ${anim.id} frame(s) → ${out}/`);

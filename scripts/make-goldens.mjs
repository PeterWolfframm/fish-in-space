// Render the parity cases with the ORIGINAL game code and write test/fixtures/*.json.
//
//   node scripts/make-goldens.mjs pilot          (imports ~/Code/yeswar/web directly)
//   cd ~/Code/fish. && node_modules/.bin/vite-node ~/Code/pixelforge/scripts/make-goldens.mjs fish
//   node scripts/make-goldens.mjs v1             (the frozen v1 plants, from this repo; run once)
//
// Run once when a port is made or re-synced; the parity test then holds the port to it.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprint, PILOT_CASES, pilotKey, AVATAR_SEEDS, FISH_SEEDS } from '../test/golden-cases.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME;
const YESWAR = process.env.YESWAR ?? join(HOME, 'Code', 'yeswar');
const FISH = process.env.FISH ?? join(HOME, 'Code', 'fish.');
const write = (name, data) => {
  writeFileSync(join(HERE, '..', 'test', 'fixtures', `${name}.json`), `${JSON.stringify(data, null, 1)}\n`);
  console.log(`wrote test/fixtures/${name}.json (${Object.keys(data.images ?? data).length} entries)`);
};

const kind = process.argv[2];
if (kind === 'pilot') {
  const px = await import(join(YESWAR, 'web', 'pilot-pixel.js'));
  const av = await import(join(YESWAR, 'web', 'pilot', 'avatar-spec.js'));
  const bridge = await import(join(YESWAR, 'web', 'pilot', 'avatar-pixel.js'));
  const images = {};
  for (const c of PILOT_CASES) images[pilotKey(c)] = fingerprint(px.pilotFrame(px.pilotSpec(c.seed, c), c.expr, c.frame));
  const avatars = {};
  for (const seed of AVATAR_SEEDS) {
    const spec = av.avatarFromSeed(seed);
    const traits = bridge.pixelTraits(spec);
    avatars[seed] = { code: av.encodeAvatar(spec), image: fingerprint(px.pilotFrame({ ...px.pilotSpec(seed), ...traits }, 'idle', 0)) };
  }
  write('pilot', { images, avatars });
} else if (kind === 'fish') {
  const draw = await import(join(FISH, 'src', 'fish', 'draw.ts'));
  const genome = await import(join(FISH, 'src', 'fish', 'genome.ts'));
  const out = {};
  for (const seed of FISH_SEEDS) {
    const g = genome.fishFromSeed(seed);
    const bred = genome.breed(g, genome.fishFromSeed(`${seed}b`), `${seed}:egg`);
    out[seed] = {
      code: genome.encodeFish(g),
      bred: genome.encodeFish(bred),
      frames: draw.drawFishFrames(g).map(fingerprint),
    };
  }
  write('fish', out);
} else if (kind === 'v1') {
  // Not from a game: the frozen v1 generators, rendered from this repo's own src/gen.
  const { waterplantGoldens, plantGoldens } = await import('../test/golden-cases.mjs');
  write('waterplant', waterplantGoldens(await import('../src/gen/waterplant.js')));
  write('plant', plantGoldens(await import('../src/gen/plant.js')));
} else {
  console.error('usage: make-goldens.mjs pilot|fish|v1');
  process.exit(2);
}

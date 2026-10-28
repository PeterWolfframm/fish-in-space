#!/usr/bin/env node
// Write every swipe to a text file (oldest first), or to stdout.
//   npm run export-swipes
//   npm run export-swipes -- -o swipes.txt
//   npm run export-swipes -- swipes.txt
// PocketBase must be running (npm run app / npm run pb). Same superuser as the trainer.

import { writeFileSync } from 'node:fs';
import { adminClient } from '../server/pb.mjs';
import { swipesToTxt } from '../src/pixelgen/swipes-txt.js';

const args = process.argv.slice(2);
const flag = args.indexOf('-o');
const out = flag >= 0 ? args[flag + 1] : args.find((a) => !a.startsWith('-'));
if (flag >= 0 && !out) {
  console.error('export-swipes: -o needs a path');
  process.exit(1);
}

const pb = await adminClient();
const [swipes, users] = await Promise.all([
  pb.collection('swipes').getFullList({ sort: 'created', batch: 500 }),
  pb.collection('users').getFullList({ batch: 500, fields: 'id,name,email,guest' }),
]);
const byId = new Map(users.map((u) => [u.id, u]));
const nameOf = (id) => {
  const u = byId.get(id);
  if (!u) return id;
  return u.guest ? `${u.name || 'guest'} (guest)` : u.name || u.email;
};

const text = swipesToTxt(swipes, { nameOf });
if (out) {
  writeFileSync(out, text);
  console.log(`wrote ${swipes.length} swipes to ${out}`);
} else {
  process.stdout.write(text);
}

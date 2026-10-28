#!/usr/bin/env node
// The public model's trainer: every 30 s it checks for new (or undone) swipes and, when there
// are any, retrains the public model on everyone's swipes and stores it in PocketBase.
//   node server/trainer.mjs [--once] [--every 30]
// Env: PB_URL, PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD (or .pocketbase/superuser.json).

import { adminClient, PB_URL } from './pb.mjs';
import { trainModel, modelRecord } from '../src/pixelgen/model.js';
import { insights } from '../src/pixelgen/beautify.js';
import { schema } from '../src/pixelgen/features.js';
import { generator } from '../src/gen/registry.js';

const args = process.argv.slice(2);
const once = args.includes('--once');
const every = Number(args[args.indexOf('--every') + 1]) || 30;
const MIN_SWIPES = 6;
const cache = new Map(); // feature vectors by kind|code, kept across rounds
const log = (...a) => console.log(`[trainer ${new Date().toLocaleTimeString()}]`, ...a);

/** One round: retrain if the swipes changed since the stored model. Returns what it did. */
export async function round(pb) {
  const swipes = await pb.collection('swipes').getFullList({ sort: 'created', fields: 'id,user,kind,code,verdict,fix,instead,created', batch: 500 });
  const key = `${swipes.length}|${swipes.at(-1)?.created ?? ''}`;
  const current = await pb
    .collection('models')
    .getFirstListItem('scope = "public"', { fields: 'id,schema,stats' })
    .catch(() => null);
  if (current && current.schema === schema() && current.stats?.key === key) return 'unchanged';
  if (swipes.length < MIN_SWIPES) return `waiting (${swipes.length}/${MIN_SWIPES} swipes)`;
  const t = Date.now();
  const out = trainModel(swipes, { scope: 'public', k: swipes.length >= 40 ? 5 : 0, cache });
  if (!out) return 'nothing to learn';
  const kinds = [...new Set(swipes.map((s) => s.kind))].map(generator).filter(Boolean);
  const stats = { ...out.stats, key, insights: insights(out.net, kinds, { probes: 2 }), ms: Date.now() - t };
  const rec = modelRecord('public', out.net, stats);
  if (current) await pb.collection('models').update(current.id, rec);
  else await pb.collection('models').create(rec);
  return `trained on ${swipes.length} swipes from ${stats.users} users${stats.accuracy != null ? `, held-out ${(stats.accuracy * 100).toFixed(0)}%` : ''} (${stats.ms} ms)`;
}

async function main() {
  let pb = null;
  let said = '';
  for (;;) {
    try {
      pb ??= await adminClient();
      const what = await round(pb);
      if ((what !== 'unchanged' && what !== said) || once) log(what);
      said = what;
    } catch (e) {
      log(`error: ${e.message} (${PB_URL})`);
      pb = null;
    }
    if (once) return;
    await new Promise((r) => setTimeout(r, every * 1000));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();

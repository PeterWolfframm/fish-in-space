#!/usr/bin/env node
// Retrain the public pixelgen model from swipes in PocketBase. Only Fish Tinder swipes count (mode
// "fishtinder", kind fish3): fresh procgen rolls judged on their own, never bred fish or other tools'
// swipes. A super like is heard twice.

import { adminClient, PB_URL } from './pb.mjs';
import { trainModel, modelRecord } from '../forge/pixelgen/model.js';
import { insights } from '../forge/pixelgen/beautify.js';
import { schema } from '../forge/pixelgen/features.js';
import { generator } from '../forge/gen/registry.js';

const args = process.argv.slice(2);
const once = args.includes('--once');
const every = Number(args[args.indexOf('--every') + 1]) || 30;
const MIN_SWIPES = 6;
const cache = new Map();
const log = (...a) => console.log(`[trainer ${new Date().toLocaleTimeString()}]`, ...a);

export async function round(pb) {
  const rows = await pb.collection('swipes').getFullList({
    filter: 'mode = "fishtinder" && kind = "fish3"',
    sort: 'created',
    fields: 'id,user,kind,code,verdict,note,created',
    batch: 500,
  });
  const swipes = rows.flatMap((s) => (s.verdict === 'approve' && s.note === 'super like' ? [s, s] : [s]));
  const key = `${rows.length}|${rows.at(-1)?.created ?? ''}`;
  const current = await pb
    .collection('models')
    .getFirstListItem('scope = "public"', { fields: 'id,schema,stats' })
    .catch(() => null);
  if (current && current.schema === schema() && current.stats?.key === key) return 'unchanged';
  if (rows.length < MIN_SWIPES) return `waiting (${rows.length}/${MIN_SWIPES} Fish Tinder swipes)`;
  const t = Date.now();
  const out = trainModel(swipes, { scope: 'public', k: swipes.length >= 40 ? 5 : 0, cache });
  if (!out) return 'nothing to learn';
  const kinds = [...new Set(swipes.map((s) => s.kind))].map(generator).filter(Boolean);
  const stats = { ...out.stats, key, insights: insights(out.net, kinds, { probes: 2 }), ms: Date.now() - t };
  const rec = modelRecord('public', out.net, stats);
  if (current) await pb.collection('models').update(current.id, rec);
  else await pb.collection('models').create(rec);
  return `trained on ${rows.length} Fish Tinder swipes from ${stats.users} users${stats.accuracy != null ? `, held-out ${(stats.accuracy * 100).toFixed(0)}%` : ''} (${stats.ms} ms)`;
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

// The PocketBase backend's rules, on a throwaway server with pb_migrations applied. Skipped when
// the binary isn't there (node scripts/get-pocketbase.mjs fetches it).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { PB_BIN, PB_MIGRATIONS, PocketBase, adminClient } from '../server/pb.mjs';
import { round } from '../server/trainer.mjs';
import { generator } from '../src/gen/registry.js';

const skip = !existsSync(PB_BIN) && 'no PocketBase binary (node scripts/get-pocketbase.mjs)';
const PORT = 8190 + Math.floor(Math.random() * 400);
const URL_ = `http://127.0.0.1:${PORT}`;
const SU = { email: 'su@test.local', password: 'su-password-123' };
let dir;
let server;

before(async () => {
  if (skip) return;
  dir = mkdtempSync(join(tmpdir(), 'pixelgen-pb-'));
  execFileSync(PB_BIN, ['migrate', 'up', '--dir', dir, '--migrationsDir', PB_MIGRATIONS], { stdio: 'ignore' });
  execFileSync(PB_BIN, ['superuser', 'upsert', SU.email, SU.password, '--dir', dir], { stdio: 'ignore' });
  server = spawn(PB_BIN, ['serve', '--http', `127.0.0.1:${PORT}`, '--dir', dir, '--migrationsDir', PB_MIGRATIONS], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${URL_}/api/health`).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('PocketBase did not start');
});

after(() => {
  server?.kill();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** A signed-in user, created by the superuser the way `npm run pixelgen:user` does. */
async function guest(tag) {
  const su = await adminClient(URL_, SU);
  const pb = new PocketBase(URL_);
  pb.autoCancellation(false);
  const email = `guest-${tag}-${Date.now()}@guest.fish-in-space.local`;
  const password = `pw-${tag}-0123456789`;
  await su.collection('users').create({ email, password, passwordConfirm: password, guest: true, name: `Guest ${tag}`, emailVisibility: false });
  await pb.collection('users').authWithPassword(email, password);
  return pb;
}

const fails = async (p) => assert.ok(await p.then(() => false, () => true), 'expected the request to be refused');

const fish = generator('fish2');
const swipe = (pb, i, verdict) => ({ user: pb.authStore.record.id, kind: 'fish2', code: fish.traits.encode(fish.fromSeed(`pb-${i}`)), verdict });

test('guests: own swipes only, no role, can upgrade', { skip }, async () => {
  const a = await guest('a');
  const b = await guest('b');
  const mine = await a.collection('swipes').create(swipe(a, 1, 'approve'));
  await b.collection('swipes').create(swipe(b, 2, 'pass'));

  assert.equal((await a.collection('swipes').getFullList()).length, 1);
  assert.equal((await b.collection('swipes').getFullList()).length, 1);
  await fails(b.collection('swipes').getOne(mine.id));
  await fails(b.collection('swipes').create({ ...swipe(b, 3, 'approve'), user: a.authStore.record.id }));
  await fails(b.collection('swipes').delete(mine.id));
  await fails(a.collection('swipes').update(mine.id, { verdict: 'pass' }));
  await a.collection('swipes').delete(mine.id); // undo

  // the public API cannot create accounts at all
  await fails(new PocketBase(URL_).collection('users').create({ email: 'x@y.z', password: '0123456789', passwordConfirm: '0123456789', role: 'admin' }));
  await fails(new PocketBase(URL_).collection('users').create({ email: 'y@z.w', password: '0123456789', passwordConfirm: '0123456789', name: 'Nope' }));
  await fails(a.collection('users').update(a.authStore.record.id, { role: 'admin' }));
  await fails(a.collection('users').getOne(b.authStore.record.id));

  // a guest becomes a real account and keeps its swipes
  const id = a.authStore.record.id;
  await a.collection('swipes').create(swipe(a, 4, 'approve'));
  await a.collection('users').update(id, { email: 'real-a@test.local', password: 'real-password-1', passwordConfirm: 'real-password-1', guest: false, name: 'Ada' });
  const again = new PocketBase(URL_);
  await again.collection('users').authWithPassword('real-a@test.local', 'real-password-1');
  assert.equal(again.authStore.record.id, id);
  assert.equal((await again.collection('swipes').getFullList()).length, 1);
  // …and, no longer a guest, can't swap its email without verification
  await fails(again.collection('users').update(id, { email: 'other@test.local' }));
});

test('admin sees every swipe; models: public read-only, personal private', { skip }, async () => {
  const su = await adminClient(URL_, SU);
  const c = await guest('c');
  const d = await guest('d');
  for (let i = 0; i < 4; i++) await c.collection('swipes').create(swipe(c, 10 + i, i % 2 ? 'approve' : 'pass'));
  for (let i = 0; i < 4; i++) await d.collection('swipes').create(swipe(d, 20 + i, i % 2 ? 'pass' : 'approve'));
  await su.collection('users').update(c.authStore.record.id, { role: 'admin' });
  await c.collection('users').authRefresh();
  const all = await c.collection('swipes').getFullList();
  assert.ok(all.length >= 8 && all.some((s) => s.user === d.authStore.record.id), `admin sees ${all.length}`);

  // the trainer writes the public model; everyone signed in can read it, nobody else write it
  assert.match(await round(su), /^trained on/);
  assert.equal(await round(su), 'unchanged');
  const pub = await d.collection('models').getFirstListItem('scope = "public"');
  assert.ok(pub.weights?.h1 && pub.stats.swipes >= 8);
  await fails(d.collection('models').update(pub.id, { stats: {} }));
  await fails(d.collection('models').create({ scope: 'public', weights: {}, schema: 'x' }));
  await c.collection('models').update(pub.id, { stats: { ...pub.stats, note: 'admin retrain' } });

  // personal: the owner's, readable by admin, hidden from others
  const own = await d.collection('models').create({ scope: 'personal', user: d.authStore.record.id, weights: { v: 1 }, schema: 'x' });
  await fails(d.collection('models').create({ scope: 'personal', user: c.authStore.record.id, weights: {}, schema: 'x' }));
  const e = await guest('e');
  await fails(e.collection('models').getOne(own.id));
  assert.ok(await c.collection('models').getOne(own.id));
});

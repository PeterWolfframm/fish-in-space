// PocketBase paths, superuser, and an admin client for Node scripts (trainer, pixelgen-user).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import PocketBase from '../vendor/pocketbase.es.mjs';

export const ROOT = new URL('..', import.meta.url).pathname;
export const PB_DIR = join(ROOT, '.pocketbase');
export const PB_BIN = join(PB_DIR, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
export const PB_DATA = process.env.PB_DATA ?? join(PB_DIR, 'pb_data');
export const PB_MIGRATIONS = join(ROOT, 'pb_migrations');
export const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const SU_FILE = join(PB_DIR, 'superuser.json');

export function superuser({ create = false } = {}) {
  if (process.env.PB_SUPERUSER_EMAIL && process.env.PB_SUPERUSER_PASSWORD) {
    return { email: process.env.PB_SUPERUSER_EMAIL, password: process.env.PB_SUPERUSER_PASSWORD };
  }
  if (existsSync(SU_FILE)) return JSON.parse(readFileSync(SU_FILE, 'utf8'));
  if (!create) throw new Error('no superuser: set PB_SUPERUSER_EMAIL/PB_SUPERUSER_PASSWORD or run `npm run app` once');
  const su = { email: 'trainer@seedfall.local', password: randomBytes(18).toString('base64url') };
  mkdirSync(PB_DIR, { recursive: true });
  writeFileSync(SU_FILE, JSON.stringify(su, null, 2), { mode: 0o600 });
  return su;
}

export function upsertSuperuser(su, dir = PB_DATA) {
  execFileSync(PB_BIN, ['superuser', 'upsert', su.email, su.password, '--dir', dir], { stdio: 'ignore' });
}

export async function adminClient(url = PB_URL, su = superuser()) {
  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword(su.email, su.password);
  return pb;
}

export { PocketBase };

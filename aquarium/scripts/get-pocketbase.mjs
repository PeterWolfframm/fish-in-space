#!/usr/bin/env node
// Download the pinned PocketBase release into .pocketbase/ (gitignored).

import { existsSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const PB_VERSION = '0.40.6';
const ROOT = new URL('..', import.meta.url).pathname;
const DIR = join(ROOT, '.pocketbase');
const BIN = join(DIR, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');

const OS = process.env.PB_OS || { darwin: 'darwin', linux: 'linux', win32: 'windows' }[process.platform];
const ARCH = process.env.PB_ARCH || { x64: 'amd64', arm64: 'arm64', arm: 'armv7' }[process.arch];
if (!OS || !ARCH) throw new Error(`no PocketBase build for ${process.platform}/${process.arch}`);

if (existsSync(BIN) && !process.argv.includes('--force')) {
  console.log(`PocketBase already at ${BIN} (--force to re-download)`);
  process.exit(0);
}

const name = `pocketbase_${PB_VERSION}_${OS}_${ARCH}.zip`;
const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${name}`;
console.log(`downloading ${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
mkdirSync(DIR, { recursive: true });
const zip = join(DIR, name);
writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
try {
  execFileSync('unzip', ['-o', zip, '-d', DIR], { stdio: 'ignore' });
} catch {
  execFileSync('tar', ['-xf', zip, '-C', DIR], { stdio: 'ignore' });
}
rmSync(zip);
if (process.platform !== 'win32') chmodSync(BIN, 0o755);
console.log(`PocketBase ${PB_VERSION} → ${BIN}`);

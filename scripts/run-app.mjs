#!/usr/bin/env node
// `npm run app`: PocketBase (PB_URL, default :8090), the static app and the public-model trainer.
// The app proxies /api and /_/ to PocketBase. HOST / APP_PORT (or PORT) choose the public bind.
// Downloads PocketBase on first run. Locally, a superuser is saved in .pocketbase/superuser.json.
// In production (NODE_ENV=production) PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD are required.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { PB_BIN, PB_DATA, PB_MIGRATIONS, PB_URL, ROOT, superuser, upsertSuperuser } from '../server/pb.mjs';
import { serve } from '../server/static.mjs';

if (process.env.NODE_ENV === 'production' && !(process.env.PB_SUPERUSER_EMAIL && process.env.PB_SUPERUSER_PASSWORD)) {
  console.error('production needs PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD');
  process.exit(1);
}

if (!existsSync(PB_BIN)) execFileSync(process.execPath, [new URL('./get-pocketbase.mjs', import.meta.url).pathname], { stdio: 'inherit' });

mkdirSync(PB_DATA, { recursive: true });
const su = superuser({ create: true });
execFileSync(PB_BIN, ['migrate', 'up', '--dir', PB_DATA, '--migrationsDir', PB_MIGRATIONS], { stdio: 'ignore' });
upsertSuperuser(su);

const pbHost = new URL(PB_URL).host;
const kids = [];
const run = (name, cmd, args) => {
  const p = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('exit', (code) => code && console.error(`${name} exited (${code})`));
  kids.push(p);
};
run('pocketbase', PB_BIN, ['serve', '--http', pbHost, '--dir', PB_DATA, '--migrationsDir', PB_MIGRATIONS]);

// The trainer waits for PocketBase to answer before its first round.
for (let i = 0; i < 50; i++) {
  if (await fetch(`${PB_URL}/api/health`).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 200));
}
run('trainer', process.execPath, ['server/trainer.mjs']);
const port = Number(process.env.PORT) || Number(process.env.APP_PORT) || 8017;
const host = process.env.HOST || '127.0.0.1';
await serve(port, host);

const shown = host === '0.0.0.0' ? 'localhost' : host;
console.log(`
  app      http://${shown}:${port}/app/
  backend  ${PB_URL}/_/  (also proxied at http://${shown}:${port}/_/)
  superuser ${su.email}${process.env.PB_SUPERUSER_PASSWORD ? '' : ' (password in .pocketbase/superuser.json)'}
  admin    npm run pixelgen:admin <email>
`);

const stop = () => {
  for (const k of kids) k.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// Static files for the app (the repo root, so the app can import src/ directly), plus a reverse
// proxy so the browser can use PocketBase on the same origin. Fly only publishes one port.
//   node server/static.mjs [port]
// HOST (default 127.0.0.1) and PORT / APP_PORT choose the bind. PB_URL is the upstream.

import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PB_URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade'];

/** PocketBase paths the browser and the dashboard use. Everything else is a file. */
function isBackend(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/') || pathname === '/_' || pathname.startsWith('/_/');
}

function proxyToPocketBase(req, res) {
  const target = new URL(req.url, PB_URL);
  const headers = { ...req.headers, host: target.host };
  for (const h of HOP) delete headers[h];
  const ip = req.socket.remoteAddress ?? '';
  const prior = req.headers['x-forwarded-for'];
  headers['x-forwarded-for'] = prior ? `${prior}, ${ip}` : ip;
  if (!req.headers['x-forwarded-proto']) headers['x-forwarded-proto'] = 'http';
  if (!req.headers['x-forwarded-host'] && req.headers.host) headers['x-forwarded-host'] = req.headers.host;

  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const preq = transport(target, { method: req.method, headers }, (pres) => {
    const out = { ...pres.headers };
    for (const h of HOP) delete out[h];
    res.writeHead(pres.statusCode ?? 502, out);
    pres.pipe(res);
  });
  preq.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' }).end('bad gateway');
    else res.destroy();
  });
  req.on('aborted', () => preq.destroy());
  req.pipe(preq);
}

export function serve(port = Number(process.env.PORT) || Number(process.env.APP_PORT) || 8017, host = process.env.HOST || '127.0.0.1') {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') {
      const ok = await fetch(`${PB_URL}/api/health`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false);
      res.writeHead(ok ? 200 : 503, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end(ok ? 'ok' : 'pocketbase down');
      return;
    }
    if (isBackend(url.pathname)) {
      proxyToPocketBase(req, res);
      return;
    }
    if (url.pathname === '/') {
      res.writeHead(302, { location: '/app/' }).end();
      return;
    }
    let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(ROOT) || /\/\.(pocketbase|git)(\/|$)/.test(path)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  // PocketBase realtime is a long-lived response. Node's default request timeout would cut it.
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.timeout = 0;
  return new Promise((ok) => server.listen(port, host, () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2]) || Number(process.env.PORT) || Number(process.env.APP_PORT) || 8017;
  const host = process.env.HOST || '127.0.0.1';
  await serve(port, host);
  console.log(`app → http://${host}:${port}/app/`);
}

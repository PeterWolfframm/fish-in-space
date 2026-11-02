// Dev-only API the Studio's panels call. `apply: 'serve'` keeps every bit of it out of `vite build`.

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, normalize, relative } from 'node:path';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function isLocal(req: IncomingMessage): boolean {
  const host = req.headers.host ?? '';
  if (!LOCAL_HOST.test(host)) return false;
  const origin = req.headers.origin;
  return !origin || LOCAL_HOST.test(origin.replace(/^https?:\/\//, ''));
}

function gitInfo(dir: string): { branch: string | null; dirty: boolean } {
  try {
    const root = execSync('git rev-parse --show-toplevel', { cwd: dir, encoding: 'utf8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim().length > 0;
    return { branch, dirty };
  } catch {
    return { branch: null, dirty: false };
  }
}

/** `git log` for one generator's source dir, newest first — the Versions mode's history tab. */
function historyOf(sourcePath: string, dir: string): { hash: string; date: string; subject: string }[] {
  try {
    const root = execSync('git rev-parse --show-toplevel', { cwd: sourcePath, encoding: 'utf8' }).trim();
    const target = join(sourcePath, dir);
    const out = execSync(`git log --max-count=30 --date=short --pretty=format:%h%x1f%ad%x1f%s -- ${JSON.stringify(target)}`, { cwd: root, encoding: 'utf8' });
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [hash, date, subject] = line.split('\x1f');
        return { hash, date, subject };
      });
  } catch {
    return [];
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

export function studioPlugin(sourcePath: string): Plugin {
  return {
    name: 'studio-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/studio/info', (req, res) => {
        if (!isLocal(req)) {
          res.statusCode = 403;
          res.end('forbidden');
          return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ sourcePath, writable: true, vendored: false, ...gitInfo(sourcePath) }));
      });

      server.middlewares.use('/api/studio/history', (req, res) => {
        if (!isLocal(req)) {
          res.statusCode = 403;
          res.end('forbidden');
          return;
        }
        const dir = new URL(req.url ?? '', 'http://x').searchParams.get('dir') ?? '';
        sendJson(res, 200, { entries: historyOf(sourcePath, dir) });
      });

      server.middlewares.use('/api/studio/save', (req, res) => {
        if (!isLocal(req) || req.method !== 'POST') {
          res.statusCode = req.method === 'POST' ? 403 : 405;
          res.end(req.method === 'POST' ? 'forbidden' : 'method not allowed');
          return;
        }
        readBody(req)
          .then((raw) => {
            const { file, content, entry } = JSON.parse(raw) as { file?: string; content?: unknown; entry?: unknown };
            if (!file || !/\.studio\.json$/.test(file)) {
              sendJson(res, 400, { error: 'only *.studio.json files may be saved' });
              return;
            }
            const target = normalize(join(sourcePath, file));
            if (relative(sourcePath, target).startsWith('..')) {
              sendJson(res, 400, { error: 'path escapes the source root' });
              return;
            }
            let toWrite = content;
            if (entry !== undefined) {
              let existing: unknown[] = [];
              try {
                const parsed = JSON.parse(readFileSync(target, 'utf8'));
                if (Array.isArray(parsed)) existing = parsed;
              } catch {
                /* missing or empty file — start a fresh array */
              }
              existing.push(entry);
              toWrite = existing;
            }
            writeFileSync(target, JSON.stringify(toWrite, null, 2) + '\n');
            sendJson(res, 200, { ok: true, file });
          })
          .catch((err) => sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) }));
      });
    },
  };
}

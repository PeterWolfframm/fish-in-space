// Baked strips → Pixi textures, cached in an LRU keyed by `family|code|anim`. Textures are destroyed
// on eviction unless something still holds them.

import { Rectangle, Texture, ImageSource } from 'pixi.js';
import type { Family } from './bake';
import BakeWorker from './bake.worker?worker';

export interface Sheet {
  key: string;
  w: number;
  h: number;
  n: number;
  fps: number;
  frames: Texture[];
  source: ImageSource;
  bmp: ImageBitmap | HTMLCanvasElement;
  refs: number;
}

const MAX = 260;
const cache = new Map<string, Sheet>();
const pending = new Map<string, Promise<Sheet | null>>();
const waiting = new Map<number, (r: WorkerReply) => void>();
let worker: Worker | null = null;
let jobId = 1;
let workerFailed = false;
const listeners = new Set<(key: string) => void>();

interface WorkerReply {
  id: number;
  w: number;
  h: number;
  n: number;
  fps: number;
  bmp?: ImageBitmap;
  buf?: ArrayBuffer;
  error?: string;
}

function getWorker(): Worker | null {
  if (worker || workerFailed) return worker;
  try {
    worker = new BakeWorker();
    worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      waiting.get(data.id)?.(data);
      waiting.delete(data.id);
    };
    worker.onerror = () => {
      workerFailed = true;
      worker = null;
      for (const [id, cb] of waiting) cb({ id, w: 0, h: 0, n: 0, fps: 0, error: 'worker failed' });
      waiting.clear();
    };
  } catch {
    workerFailed = true;
  }
  return worker;
}

export const keyOf = (family: Family, code: string, anim: string) => `${family}|${code}|${anim}`;

/** Called whenever a sheet becomes ready, so scenes can swap placeholders. */
export const onSheet = (cb: (key: string) => void) => (listeners.add(cb), () => void listeners.delete(cb));

async function bakeOnMain(family: Family, code: string, anim: string): Promise<WorkerReply> {
  const { bake } = await import('./bake');
  const s = bake(family, code, anim);
  return { id: 0, w: s.w, h: s.h, n: s.n, fps: s.fps, buf: s.rgba.buffer as ArrayBuffer };
}

function toCanvas(buf: ArrayBuffer, W: number, h: number) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(buf), W, h), 0, 0);
  return c;
}

function make(key: string, r: WorkerReply): Sheet {
  const resource = r.bmp ?? toCanvas(r.buf!, r.w * r.n, r.h);
  const source = new ImageSource({ resource, scaleMode: 'nearest' });
  const frames = Array.from({ length: r.n }, (_, i) => new Texture({ source, frame: new Rectangle(i * r.w, 0, r.w, r.h) }));
  return { key, w: r.w, h: r.h, n: r.n, fps: r.fps, frames, source, bmp: resource, refs: 0 };
}

function evict() {
  if (cache.size <= MAX) return;
  for (const [k, s] of cache) {
    if (cache.size <= MAX) break;
    if (s.refs > 0) continue;
    cache.delete(k);
    s.frames.forEach((t) => t.destroy());
    s.source.destroy();
    if ('close' in s.bmp) s.bmp.close();
  }
}

/** The sheet if it's baked (and bumps it in the LRU); otherwise starts baking and returns null. */
export function sheet(family: Family, code: string, anim: string): Sheet | null {
  const key = keyOf(family, code, anim);
  const s = cache.get(key);
  if (s) {
    cache.delete(key);
    cache.set(key, s);
    return s;
  }
  void load(family, code, anim);
  return null;
}

export function load(family: Family, code: string, anim: string): Promise<Sheet | null> {
  const key = keyOf(family, code, anim);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(key);
  if (p) return p;
  const job = new Promise<Sheet | null>((resolve) => {
    const done = (r: WorkerReply) => {
      pending.delete(key);
      if (r.error || !r.n) {
        if (!workerFailed) return resolve(null);
        return void bakeOnMain(family, code, anim).then((m) => done(m), () => resolve(null));
      }
      const s = make(key, r);
      cache.set(key, s);
      evict();
      listeners.forEach((cb) => cb(key));
      resolve(s);
    };
    const w = getWorker();
    if (!w) return void bakeOnMain(family, code, anim).then(done, () => resolve(null));
    const id = jobId++;
    waiting.set(id, done);
    w.postMessage({ id, family, code, anim });
  });
  pending.set(key, job);
  return job;
}

export const retain = (s: Sheet) => void s.refs++;
export const release = (s: Sheet) => void (s.refs = Math.max(0, s.refs - 1));

/** A baked frame drawn onto a small canvas, for HTML portraits and drawer previews. */
export function frameCanvas(s: Sheet, i: number, scale: number, into?: HTMLCanvasElement): HTMLCanvasElement {
  const c = into ?? document.createElement('canvas');
  if (c.width !== s.w * scale || c.height !== s.h * scale) {
    c.width = s.w * scale;
    c.height = s.h * scale;
  }
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(s.bmp, (i % s.n) * s.w, 0, s.w, s.h, 0, 0, s.w * scale, s.h * scale);
  return c;
}

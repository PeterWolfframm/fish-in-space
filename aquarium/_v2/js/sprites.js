// Fish sprite strips, by code and anim. `get` never blocks: it returns the strip when it is ready,
// else null and queues a bake. Bakes run in a worker; if workers are unavailable they run on the
// main thread one at a time between frames.

const cache = new Map(); // key -> { bmp, w, h, n, fps } | 'pending'
const queue = [];
let worker = null;
let busy = false;
let seq = 0;
const waiting = new Map();
const MAX = 160;

try {
  worker = new Worker(new URL('./sprite-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => finish(waiting.get(data.id), data);
  worker.onerror = () => {
    worker = null;
    busy = false;
    for (const key of waiting.values()) cache.delete(key);
    waiting.clear();
    pump();
  };
} catch {
  worker = null;
}

async function finish(key, data) {
  waiting.delete(data.id);
  busy = false;
  if (!key) return pump();
  if (data.error) {
    cache.set(key, 'failed');
    return pump();
  }
  const img = new ImageData(new Uint8ClampedArray(data.buf), data.w * data.n, data.h);
  const bmp = await (window.createImageBitmap ? createImageBitmap(img) : toCanvas(img));
  cache.set(key, { bmp, w: data.w, h: data.h, n: data.n, fps: data.fps });
  if (cache.size > MAX) evict();
  pump();
}

function toCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

function evict() {
  for (const [k, v] of cache) {
    if (cache.size <= MAX * 0.75) break;
    if (v === 'pending') continue;
    v.bmp?.close?.();
    cache.delete(k);
  }
}

let fallback;
async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const { key, code, anim } = queue.shift();
  const id = ++seq;
  waiting.set(id, key);
  if (worker) return worker.postMessage({ id, code, anim });
  fallback ??= import('./bake.js');
  const { bake } = await fallback;
  setTimeout(() => {
    try {
      finish(key, { id, ...bake(code, anim) });
    } catch (e) {
      finish(key, { id, error: String(e) });
    }
  }, 0);
}

export function get(code, anim = 'swim', urgent = false) {
  const key = `${anim}|${code}`;
  const hit = cache.get(key);
  if (hit && hit !== 'pending' && hit !== 'failed') {
    cache.delete(key); // keep recently used at the end for eviction order
    cache.set(key, hit);
    return hit;
  }
  if (!hit) {
    cache.set(key, 'pending');
    queue[urgent ? 'unshift' : 'push']({ key, code, anim });
    pump();
  }
  return null;
}

/** Warm the cache without drawing. */
export const prefetch = (code, anim = 'swim') => void get(code, anim);

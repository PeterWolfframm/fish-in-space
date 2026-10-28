// Every approved fish swims here. Plants and pilots stay in Likes; only the fish family fills the tank.
// The tab itself is members-only; an empty tank is just empty.

import { generator } from '../src/gen/registry.js';
import { swipes, on, call } from './pixelgen.js';
import { Player, fitScale } from './sprites.js';
import { describeCatch } from './catch.js';
import { say } from './toast.js';

const $ = (id) => document.getElementById(id);

/** Approved fish, one per kind and code, in the order they were kept. */
export function tankFish() {
  const seen = new Set();
  const out = [];
  for (const s of swipes()) {
    if (s.verdict !== 'approve') continue;
    if (generator(s.kind)?.family !== 'fish') continue;
    const key = `${s.kind}|${s.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, kind: s.kind, code: s.code });
  }
  return out;
}

const hash01 = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

let visible = false;
let known = null;
const swimmers = new Map();

function syncTab() {
  const n = tankFish().length;
  const count = $('tankCount');
  count.textContent = n ? String(n) : '';
  count.hidden = !n;
}

function paintCopy() {
  const n = tankFish().length;
  $('tankLine').textContent = n === 1 ? '1 resident. Zero rent paid.' : `${n} residents. Zero rent paid.`;
  $('tankEmpty').hidden = n > 0;
}

function ensure(entry) {
  if (swimmers.has(entry.key)) return;
  const el = document.createElement('div');
  el.className = 'tank-fish';
  el.title = describeCatch(entry.kind, entry.code).name;
  const player = new Player();
  el.append(player.canvas);
  $('tankWater').append(el);
  const r = hash01(entry.key);
  const swimmer = {
    el,
    player,
    x: 0,
    y0: 0.12 + hash01(`${entry.key}y`) * 0.62,
    vx: (0.35 + hash01(`${entry.key}v`) * 0.7) * (r < 0.5 ? -1 : 1),
    ph: r * Math.PI * 2,
    w: 48,
    h: 32,
    ready: false,
  };
  swimmers.set(entry.key, swimmer);
  call('frames', { kind: entry.kind, code: entry.code }).then((frames) => {
    if (swimmers.get(entry.key) !== swimmer || !frames?.frames?.length) return;
    const scale = Math.max(2, Math.min(4, fitScale(frames.frames[0], 120)));
    player.set(frames.frames, frames.fps, scale).play();
    swimmer.w = player.canvas.width;
    swimmer.h = player.canvas.height;
    swimmer.ready = true;
    const stage = $('tankStage');
    swimmer.x = r * Math.max(1, stage.clientWidth - swimmer.w);
  }).catch(() => {});
}

function reconcile() {
  const fish = tankFish();
  const keep = new Set(fish.map((f) => f.key));
  for (const [key, swimmer] of swimmers) {
    if (keep.has(key)) continue;
    swimmer.player.stop();
    swimmer.el.remove();
    swimmers.delete(key);
  }
  for (const entry of fish) ensure(entry);
  paintCopy();
  syncTab();
}

function step() {
  requestAnimationFrame(step);
  if (!visible) return;
  const stage = $('tankStage');
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const t = performance.now() / 1000;
  for (const f of swimmers.values()) {
    if (!f.ready) continue;
    f.x += f.vx;
    if (f.x < -4) {
      f.x = -4;
      f.vx = Math.abs(f.vx);
    }
    if (f.x > W - f.w + 4) {
      f.x = W - f.w + 4;
      f.vx = -Math.abs(f.vx);
    }
    const y = Math.min(H - f.h - 28, Math.max(8, f.y0 * (H - f.h - 36) + Math.sin(t * 0.8 + f.ph) * 8));
    f.el.style.transform = `translate(${f.x.toFixed(1)}px, ${y.toFixed(1)}px) scaleX(${f.vx < 0 ? -1 : 1})`;
  }
}

export function mountTank() {
  on('swipes', () => {
    const n = tankFish().length;
    if (known != null && n > known) say('Added to the aquarium.');
    known = n;
    reconcile();
  });
  syncTab();
  requestAnimationFrame(step);
}

export function showTank(v) {
  visible = v;
  if (v) reconcile();
}

// Sprites on canvases for the app's views: one shared animation clock, and thumbnails that render
// lazily in the pixelgen worker (so a long list of likes or swipes never blocks the page) and play
// their loop while hovered.

import { toCanvas } from '../src/pixel/blit.js';
import { generator } from '../src/gen/registry.js';
import { call } from './pixelgen.js';

/** An image on a canvas at `scale`, optionally on a background colour. */
export function canvasOf(img, scale, bg = null) {
  const art = toCanvas(img, scale);
  if (!bg) return art;
  const out = document.createElement('canvas');
  out.width = art.width;
  out.height = art.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(art, 0, 0);
  return out;
}

/** The biggest whole-pixel scale at which `img` fits a `box`-pixel square. */
export const fitScale = (img, box) => Math.max(1, Math.floor(box / Math.max(img.w, img.h)));

const playing = new Set();
const loop = (now) => {
  requestAnimationFrame(loop);
  for (const p of playing) p.draw(now);
};
requestAnimationFrame(loop);

/** Plays a list of frames on a canvas at a whole-pixel scale. */
export class Player {
  constructor(canvas = document.createElement('canvas')) {
    this.canvas = canvas;
    this.frames = [];
    this.fps = 1;
    this.i = -1;
  }

  /** New frames ({w, h, data, palette} images) at `scale`; draws the first at once. */
  set(frames, fps, scale) {
    this.frames = frames.map((f) => toCanvas(f, 1));
    this.fps = fps || 1;
    this.canvas.width = frames[0].w * scale;
    this.canvas.height = frames[0].h * scale;
    this.i = -1;
    this.draw(0, 0);
    return this;
  }

  draw(now, force) {
    if (!this.frames.length) return;
    const i = force ?? Math.floor((now / 1000) * this.fps) % this.frames.length;
    if (i === this.i) return;
    this.i = i;
    const ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.frames[i], 0, 0, this.canvas.width, this.canvas.height);
  }

  play() {
    if (this.frames.length > 1) playing.add(this);
    return this;
  }

  stop() {
    playing.delete(this);
    this.draw(0, 0);
    return this;
  }
}

const seen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      seen.unobserve(e.target);
      e.target.load?.();
    }
  },
  { rootMargin: '200px' },
);

/**
 * A thumbnail of a stored code: a box on the kind's background that renders its still once
 * scrolled near, and loads and plays the loop while hovered.
 */
export function thumb(kind, code, box = 96) {
  const gen = generator(kind);
  const el = document.createElement('div');
  el.className = 'thumb';
  el.style.background = gen?.bg ?? '#000';
  const player = new Player();
  el.append(player.canvas);
  let anim = null;
  el.load = async () => {
    const r = await call('frames', { kind, code, animate: false }).catch(() => null);
    if (r) player.set(r.frames, 1, fitScale(r.frames[0], box));
  };
  el.addEventListener('pointerenter', async () => {
    anim ??= call('frames', { kind, code }).catch(() => null);
    const r = await anim;
    if (r && r.frames.length > 1 && el.matches(':hover')) player.set(r.frames, r.fps, fitScale(r.frames[0], box)).play();
  });
  el.addEventListener('pointerleave', () => player.stop());
  seen.observe(el);
  return el;
}

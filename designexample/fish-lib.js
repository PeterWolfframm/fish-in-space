// Thin bridge from the real fish3 generator to the redesign: profiles, variants, breeding, and
// two web components (<pf-fish>, <pf-tank>) that play sprites on a shared clock.
import gen from './src/v3/fish/index.js';
import { toCanvas } from './src/pixel/blit.js';

const T = gen.traits;
export const BG = gen.bg;

const SHORT = { swim: { raised: 'Raised cam', side: 'Side-on', cartoon: 'Cartoon' } };
const labelOf = (field, id) => {
  if (SHORT[field]?.[id]) return SHORT[field][id];
  const f = T.fieldById(field);
  return f?.choices?.find((c) => c.id === id)?.label ?? String(id ?? '');
};
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };

export function profile(code) {
  const g = gen.fromCode(code);
  let name = gen.name(g);
  if (name && typeof name === 'object') name = name.name ?? name.full ?? JSON.stringify(name);
  const bio = String(gen.bio(g) || '').split('\n').filter(Boolean);
  const pct = (salt) => Math.round(35 + hash(code + salt) * 62);
  return {
    code,
    name: String(name || 'Unnamed fish'),
    bio,
    body: labelOf('body', g.hybrid && g.hybrid !== 'none' ? g.body : g.body),
    hybrid: g.hybrid && g.hybrid !== 'none' ? labelOf('hybrid', g.hybrid) : '',
    size: labelOf('size', g.size),
    pattern: labelOf('pattern', g.pattern),
    mood: labelOf('mood', g.mood),
    rarity: labelOf('rarity', g.rarity),
    rarityId: g.rarity,
    pixels: 1 + Math.floor(hash(code + 'px') * 40),
    pub: pct('pub'),
    you: pct('you'),
  };
}

export function roll(seed) {
  return T.encode(gen.fromSeed(String(seed)));
}

/** The choices an axis can show: [{id, label}], with the fish's own value first. */
export function variants(code, axis, count) {
  const g = gen.fromCode(code);
  const f = T.fieldById(axis);
  if (!f?.choices) return [{ code, label: 'as rolled' }];
  const own = g[axis];
  const others = f.choices.filter((c) => c.id !== own);
  // spread picks across the list rather than taking neighbours
  const step = Math.max(1, Math.floor(others.length / Math.max(1, count - 1)));
  const out = [{ code, label: labelOf(axis, own) || 'as rolled' }];
  for (let i = 0; out.length < count && i < others.length * 2; i += step) {
    const c = others[i % others.length];
    const vc = T.encode(gen.normalize({ ...g, [axis]: c.id }));
    if (!out.some((o) => o.code === vc)) out.push({ code: vc, label: labelOf(axis, c.id) });
  }
  return out;
}

export function breed(a, b, seed) {
  const child = gen.breed(gen.fromCode(a), gen.fromCode(b), String(seed));
  return T.encode(gen.normalize(child));
}

const cache = new Map();
export function framesOf(code, animId = 'swim') {
  const key = code + '|' + animId;
  if (cache.has(key)) return cache.get(key);
  const g = gen.fromCode(code);
  const a = gen.anims.find((x) => x.id === animId) ?? gen.anims[0];
  const frames = [];
  for (let i = 0; i < a.frames; i++) frames.push(toCanvas(gen.frame(g, a.id, i), 1));
  const r = { frames, fps: gen.fpsOf ? gen.fpsOf(g, a) : a.fps };
  if (cache.size > 400) cache.clear();
  cache.set(key, r);
  return r;
}

const playing = new Set();
const loop = (now) => { requestAnimationFrame(loop); for (const p of playing) p.draw(now); };
requestAnimationFrame(loop);

class PfFish extends HTMLElement {
  static observedAttributes = ['code', 'anim', 'still'];
  connectedCallback() {
    this.style.position ||= 'relative';
    this.style.display = 'block';
    if (!this.c) {
      this.c = document.createElement('canvas');
      this.c.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);image-rendering:pixelated;pointer-events:none;';
      this.append(this.c);
    }
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this);
    this.load();
  }
  disconnectedCallback() { playing.delete(this); this.ro?.disconnect(); }
  attributeChangedCallback() { if (this.c) this.load(); }
  load() {
    const code = this.getAttribute('code');
    if (!code) return;
    const anim = this.getAttribute('anim') || 'swim';
    const token = (this.token = code + anim);
    setTimeout(() => {
      if (token !== this.token) return;
      try { this.f = framesOf(code, anim); } catch (e) { console.warn('pf-fish', e); return; }
      this.fit();
      if (this.hasAttribute('still')) playing.delete(this); else playing.add(this);
    }, 0);
  }
  fit() {
    if (!this.f) return;
    const { width: w, height: h } = this.f.frames[0];
    const max = +this.getAttribute('max-scale') || 99;
    const s = Math.max(1, Math.min(max, Math.floor(Math.min(this.clientWidth / w, this.clientHeight / h))));
    this.c.width = w * s;
    this.c.height = h * s;
    this.i = -1;
    this.draw(performance.now(), this.hasAttribute('still') ? 0 : undefined);
  }
  draw(now, force) {
    if (!this.f) return;
    const n = this.f.frames.length;
    const i = force ?? Math.floor((now / 1000) * this.f.fps) % n;
    if (i === this.i) return;
    this.i = i;
    const ctx = this.c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.c.width, this.c.height);
    ctx.drawImage(this.f.frames[i], 0, 0, this.c.width, this.c.height);
  }
}
if (!customElements.get('pf-fish')) customElements.define('pf-fish', PfFish);

class PfTank extends HTMLElement {
  static observedAttributes = ['codes', 'anim'];
  connectedCallback() {
    this.style.position ||= 'relative';
    this.style.display = 'block';
    this.style.overflow = 'hidden';
    this.build();
    const tick = () => { this.raf = requestAnimationFrame(tick); this.step(); };
    this.raf = requestAnimationFrame(tick);
  }
  disconnectedCallback() { cancelAnimationFrame(this.raf); }
  attributeChangedCallback(name) {
    if (!this.isConnected) return;
    if (name === 'anim') for (const f of this.fish ?? []) f.el.setAttribute('anim', this.getAttribute('anim') || 'swim');
    else this.build();
  }
  build() {
    const codes = (this.getAttribute('codes') || '').split(',').filter(Boolean);
    const old = new Map((this.fish ?? []).map((f) => [f.code, f]));
    const anim = this.getAttribute('anim') || 'swim';
    const W = this.clientWidth || 360;
    const H = this.clientHeight || 480;
    this.fish = codes.map((code, i) => {
      if (old.has(code)) { const f = old.get(code); old.delete(code); return f; }
      let fr;
      try { fr = framesOf(code, 'swim'); } catch { return null; }
      const big = Math.max(fr.frames[0].width, fr.frames[0].height);
      const s = Math.max(2, Math.min(4, Math.floor(Math.min(W, 520) / 5 / big)));
      const w = fr.frames[0].width * s;
      const h = fr.frames[0].height * s;
      const el = document.createElement('pf-fish');
      el.setAttribute('code', code);
      el.setAttribute('anim', anim);
      el.setAttribute('max-scale', String(s));
      el.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;will-change:transform;`;
      this.append(el);
      const r = hash(code + i);
      return { code, el, w, h, x: r * Math.max(1, W - w), y0: 0.08 + hash(code + 'y') * 0.7, vx: (0.25 + hash(code + 'v') * 0.6) * (r < 0.5 ? -1 : 1), ph: r * 6.28 };
    }).filter(Boolean);
    for (const f of old.values()) f.el.remove();
  }
  step() {
    const W = this.clientWidth;
    const H = this.clientHeight;
    const t = performance.now() / 1000;
    const slow = this.getAttribute('anim') === 'eat' ? 0.15 : 1;
    for (const f of this.fish) {
      f.x += f.vx * slow;
      if (f.x < -4) { f.x = -4; f.vx = Math.abs(f.vx); }
      if (f.x > W - f.w + 4) { f.x = W - f.w + 4; f.vx = -Math.abs(f.vx); }
      const y = Math.min(H - f.h - 28, Math.max(4, f.y0 * (H - f.h - 28) + Math.sin(t * 0.8 + f.ph) * 8));
      f.el.style.transform = `translate(${f.x.toFixed(1)}px, ${y.toFixed(1)}px) scaleX(${f.vx < 0 ? -1 : 1})`;
    }
  }
}
if (!customElements.get('pf-tank')) customElements.define('pf-tank', PfTank);

export default { BG, profile, roll, variants, breed, framesOf };

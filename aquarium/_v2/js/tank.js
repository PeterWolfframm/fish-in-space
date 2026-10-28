// The hatchery tank: a low-resolution pixel scene (about 360 px across) drawn at an integer scale.
// Fish are actors that follow the world's fish list; everything else here is decoration and
// effects. The world is the source of truth: the tank only reads it and reports taps and bites.

import * as sprites from './sprites.js';
import { ecoOf, stageOf } from './world.js';

const TARGET_W = 360;
const SAND = 14;
const HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];
const SPARK = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '..X..'];
const ARROW = ['XXXXX', '.XXX.', '..X..'];
const BAND = { top: [0.1, 0.38], mid: [0.25, 0.68], bottom: [0.6, 0.86], above: [0.06, 0.3] };

export function createTank(canvas, hooks) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let W = TARGET_W;
  let H = 200;
  let S = 2;
  let bg = null;
  let plants = [];
  let time = 0;
  let last = performance.now();
  const actors = new Map();
  let food = [];
  let bubbles = [];
  let fx = [];
  let pods = [];

  // --- size ---------------------------------------------------------------------------------------
  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const bw = Math.max(1, Math.round(box.width * dpr));
    const bh = Math.max(1, Math.round(box.height * dpr));
    S = Math.max(1, Math.round(bw / TARGET_W));
    W = Math.max(1, Math.floor(bw / S));
    H = Math.max(1, Math.floor(bh / S));
    canvas.width = W * S;
    canvas.height = H * S;
    canvas.style.width = `${(W * S) / dpr}px`;
    canvas.style.height = `${(H * S) / dpr}px`;
    bg = paintBackground(W, H);
    plants = makePlants(W, H);
    for (const a of actors.values()) {
      a.x = Math.min(a.x, W - 10);
      a.y = Math.min(a.y, H - SAND - 6);
    }
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();

  // --- input --------------------------------------------------------------------------------------
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const hit = fishAt(x, y);
    if (hit) return hooks.onFish(hit.id);
    const egg = hooks.state().eggs.find((g) => Math.abs(g.x * W - x) < 8 && y > H - SAND - 12);
    if (egg) return hooks.onEgg(egg);
    hooks.onWater(x, y);
  });

  function fishAt(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const a of actors.values()) {
      const s = a.sprite;
      const hw = (s?.w ?? 16) * 0.45 + 3;
      const hh = (s?.h ?? 10) * 0.45 + 3;
      const dx = Math.abs(x - a.x);
      const dy = Math.abs(y - a.y);
      if (dx < hw && dy < hh && dx + dy < bestD) (best = a), (bestD = dx + dy);
    }
    return best;
  }

  // --- actors ---------------------------------------------------------------------------------
  function sync() {
    const st = hooks.state();
    const live = new Set();
    for (const f of st.fish) {
      live.add(f.id);
      let a = actors.get(f.id);
      if (!a) {
        const band = BAND[ecoOf(f.code).level] ?? BAND.mid;
        const y = H * (band[0] + Math.random() * (band[1] - band[0]));
        a = {
          id: f.id, x: f.x != null ? f.x * W : 20 + Math.random() * (W - 40), y: f.x != null ? H - SAND - 8 : y,
          vx: 0, vy: 0, dir: Math.random() < 0.5 ? 1 : -1, t: Math.random() * 8, tx: 0, ty: 0, pause: 0, eatUntil: 0,
          band, sprite: null, code: '', speed: 14,
        };
        pickTarget(a);
        actors.set(f.id, a);
      }
      if (a.code !== f.code) {
        a.code = f.code;
        a.band = BAND[ecoOf(f.code).level] ?? BAND.mid;
        const stage = stageOf(f.code);
        a.speed = stage === 'fry' ? 20 : 12 + Math.random() * 8;
        sprites.prefetch(f.code, 'swim');
      }
      a.fish = f;
    }
    for (const id of actors.keys()) if (!live.has(id)) actors.delete(id);
  }

  function pickTarget(a) {
    a.tx = 12 + Math.random() * (W - 24);
    a.ty = H * (a.band[0] + Math.random() * (a.band[1] - a.band[0]));
    a.ty = Math.min(a.ty, H - SAND - 6);
  }

  function steer(a, dt) {
    const hungry = a.fish.hunger > 0.12;
    let target = null;
    if (hungry && food.length) {
      let d = Infinity;
      for (const p of food) {
        const dd = Math.hypot(p.x - a.x, p.y - a.y);
        if (dd < d && !p.eaten) (d = dd), (target = p);
      }
      if (target && d < 4) {
        target.eaten = true;
        a.eatUntil = time + 0.9;
        hooks.onBite(a.id);
        burst(a.x, a.y - (a.sprite?.h ?? 10) / 2, 'heart', 1);
        target = null;
      }
    }
    let speed = a.speed;
    let tx = a.tx;
    let ty = a.ty;
    if (target) (tx = target.x), (ty = target.y), (speed *= 2.1);
    else if (a.pause > 0) {
      a.pause -= dt;
      a.vx *= 0.95;
      a.vy *= 0.95;
      return;
    } else if (Math.hypot(tx - a.x, ty - a.y) < 6) {
      pickTarget(a);
      if (Math.random() < 0.4) a.pause = 0.8 + Math.random() * 2.5;
    }
    const dx = tx - a.x;
    const dy = ty - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, dt * 2.2);
    a.vx += ((dx / d) * speed - a.vx) * k;
    a.vy += ((dy / d) * speed * 0.6 - a.vy) * k;
  }

  // --- effects --------------------------------------------------------------------------------------
  function burst(x, y, kind, n = 6) {
    for (let i = 0; i < n; i++) {
      fx.push({ kind, x: x + (Math.random() - 0.5) * (n > 1 ? 14 : 0), y, vx: (Math.random() - 0.5) * (n > 1 ? 20 : 4), vy: -10 - Math.random() * 12, life: 1.2, max: 1.2 });
    }
  }
  function text(x, y, label, color = '#fff6c9') {
    fx.push({ kind: 'text', x, y, vx: 0, vy: -9, life: 1.6, max: 1.6, label, color });
  }

  const api = {
    dropFood(x, y, n = 4) {
      for (let i = 0; i < n; i++) food.push({ x: Math.max(4, Math.min(W - 4, x + (Math.random() - 0.5) * 16)), y: Math.max(2, y - Math.random() * 6), vy: 6 + Math.random() * 4, age: 0 });
      if (food.length > 60) food = food.slice(-60);
    },
    feedAll() {
      for (let i = 0; i < 6; i++) api.dropFood(20 + Math.random() * (W - 40), 4, 3);
    },
    toLow(xFrac) {
      return xFrac * W;
    },
    width: () => W,
    launch(fishId, code) {
      const a = actors.get(fishId);
      pods.push({ x: a?.x ?? W / 2, y: a?.y ?? H / 2, vy: -4, code, dir: a?.dir ?? 1, t: 0 });
      actors.delete(fishId);
    },
    sold(fishId) {
      const a = actors.get(fishId);
      if (a) burst(a.x, a.y, 'spark', 8);
      actors.delete(fishId);
    },
    hatch(x) {
      burst(x * W, H - SAND - 4, 'spark', 8);
      for (let i = 0; i < 6; i++) bubbles.push({ x: x * W + (Math.random() - 0.5) * 8, y: H - SAND - 2, r: Math.random() < 0.3 ? 2 : 1, ph: Math.random() * 6 });
    },
    heartsOn(fishId, n = 5) {
      const a = actors.get(fishId);
      if (a) burst(a.x, a.y - 6, 'heart', n);
    },
    say(fishId, label, color) {
      const a = actors.get(fishId);
      if (a) text(a.x, a.y - (a.sprite?.h ?? 10) / 2 - 4, label, color);
    },
    positionOf(fishId) {
      const a = actors.get(fishId);
      return a && { x: a.x / W, y: a.y / H };
    },
  };

  // --- loop -----------------------------------------------------------------------------------------
  function frame(nowMs) {
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    time += dt;
    sync();
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function update(dt) {
    for (const a of actors.values()) {
      steer(a, dt);
      a.x = Math.max(6, Math.min(W - 6, a.x + a.vx * dt));
      a.y = Math.max(8, Math.min(H - SAND - 4, a.y + a.vy * dt));
      if (a.vx > 3) a.dir = 1;
      else if (a.vx < -3) a.dir = -1;
      const eating = a.eatUntil > time;
      const sp = sprites.get(a.code, eating ? 'eat' : 'swim') ?? sprites.get(a.code, 'swim');
      if (sp) a.sprite = sp;
      const pace = a.pause > 0 ? 0.45 : 0.6 + Math.min(1, Math.hypot(a.vx, a.vy) / 25);
      a.t += dt * (a.sprite?.fps ?? 10) * pace;
    }
    for (const p of food) {
      p.age += dt;
      if (p.y < H - SAND + 2) p.y += p.vy * dt;
      p.x += Math.sin(p.age * 2 + p.vy) * dt * 3;
    }
    food = food.filter((p) => !p.eaten && p.age < 25);
    if (!reduce.matches && Math.random() < dt * 2.2) bubbles.push({ x: W - 22 + Math.random() * 4, y: H - SAND, r: Math.random() < 0.25 ? 2 : 1, ph: Math.random() * 6 });
    for (const b of bubbles) (b.y -= (14 + b.r * 6) * dt), (b.x += Math.sin(time * 3 + b.ph) * dt * 4);
    bubbles = bubbles.filter((b) => b.y > -4);
    for (const f of fx) (f.x += f.vx * dt), (f.y += f.vy * dt), (f.vy *= 0.97), (f.life -= dt);
    fx = fx.filter((f) => f.life > 0);
    for (const p of pods) (p.t += dt), (p.vy -= 70 * dt), (p.y += p.vy * dt);
    pods = pods.filter((p) => p.y > -40);
  }

  // --- drawing --------------------------------------------------------------------------------------
  function px(pattern, x, y, color) {
    ctx.fillStyle = color;
    pattern.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === 'X') ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
    });
  }

  function draw() {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0);
    const calm = reduce.matches ? 0.25 : 1;

    // light shafts
    ctx.fillStyle = 'rgba(255,255,230,0.07)';
    for (let i = 0; i < 4; i++) {
      const x0 = ((i * W) / 4 + Math.sin(time * 0.15 * calm + i * 1.7) * 18 + W * 0.08) | 0;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + 16 + i * 3, 0);
      ctx.lineTo(x0 + 46 + i * 5, H - SAND);
      ctx.lineTo(x0 + 22, H - SAND);
      ctx.fill();
    }

    // plants behind fish
    drawPlants(plants.filter((p) => p.back), calm);

    // eggs and roe on the sand
    const st = hooks.state();
    const now = Date.now();
    for (const egg of st.eggs) {
      const x = Math.round(egg.x * W);
      const y = H - SAND - 2;
      const left = Math.max(0, egg.hatchAt - now);
      const wob = left < 3000 ? Math.round(Math.sin(time * 18)) : 0;
      if (egg.roe) {
        ctx.fillStyle = '#d9f6ff';
        ctx.fillRect(x - 4 + wob, y - 5, 8, 6);
        ctx.fillStyle = '#7fd0ea';
        ctx.fillRect(x - 3 + wob, y - 4, 6, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 2 + wob, y - 4, 2, 1);
      } else {
        for (const [ex, ey] of [[-3, 0], [0, -1], [3, 0], [-1, -3], [2, -3]]) {
          ctx.fillStyle = '#ffd9a8';
          ctx.fillRect(x + ex + wob, y + ey - 1, 2, 2);
          ctx.fillStyle = '#ff9e6e';
          ctx.fillRect(x + ex + wob + 1, y + ey - 1, 1, 1);
        }
      }
      const total = egg.roe ? 5000 : 20000;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - 5, y - 9, 10, 2);
      ctx.fillStyle = '#ffe680';
      ctx.fillRect(x - 5, y - 9, Math.round(10 * (1 - left / total)), 2);
    }

    // food
    for (const p of food) {
      ctx.fillStyle = '#b8743a';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      ctx.fillStyle = '#e8a860';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }

    // fish, small ones on top
    const sel = hooks.selection();
    const list = [...actors.values()].sort((a, b) => (b.sprite?.w ?? 0) - (a.sprite?.w ?? 0));
    for (const a of list) {
      const sp = a.sprite;
      const bob = Math.round(Math.sin(time * 2 + a.t * 0.3) * (a.pause > 0 ? 1 : 0.5));
      if (!sp) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(Math.round(a.x) - 3, Math.round(a.y) - 2 + bob, 6, 4);
        continue;
      }
      const f = Math.floor(a.t) % sp.n;
      const x = Math.round(a.x - sp.w / 2);
      const y = Math.round(a.y - sp.h / 2) + bob;
      if (a.dir < 0) {
        ctx.save();
        ctx.translate(x + sp.w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(sp.bmp, f * sp.w, 0, sp.w, sp.h, 0, 0, sp.w, sp.h);
        ctx.restore();
      } else ctx.drawImage(sp.bmp, f * sp.w, 0, sp.w, sp.h, x, y, sp.w, sp.h);
      const mark = sel.marks.get(a.id);
      if (mark) {
        const ay = y - 6 + Math.round(Math.sin(time * 5) * 1.5);
        if (mark === 'heart') px(HEART, a.x - 2, ay - 2, '#ff7aa8');
        else px(ARROW, a.x - 2, ay, mark === 'pair' ? '#ff7aa8' : '#ffe14d');
      }
    }

    // pods carrying fish up to the planet
    for (const p of pods) {
      const sp = sprites.get(p.code, 'swim');
      const w = Math.max(14, (sp?.w ?? 16) + 6);
      const h = Math.max(10, (sp?.h ?? 10) + 6);
      const x = Math.round(p.x - w / 2);
      const y = Math.round(p.y - h / 2);
      ctx.fillStyle = 'rgba(200,245,255,0.35)';
      ctx.fillRect(x + 1, y, w - 2, h);
      ctx.fillRect(x, y + 1, w, h - 2);
      if (sp) ctx.drawImage(sp.bmp, 0, 0, sp.w, sp.h, x + 3, y + 3, sp.w, sp.h);
      ctx.fillStyle = '#e8fbff';
      ctx.fillRect(x + 1, y, w - 2, 1);
      ctx.fillRect(x + 2, y + 1, 3, 1);
      if (p.t > 0.3) {
        ctx.fillStyle = Math.floor(time * 20) % 2 ? '#ffd166' : '#ff8c42';
        ctx.fillRect(Math.round(p.x) - 2, y + h, 4, 3 + Math.floor(Math.random() * 3));
      }
    }

    // plants in front
    drawPlants(plants.filter((p) => !p.back), calm);

    // bubbles
    ctx.fillStyle = 'rgba(235,252,255,0.75)';
    for (const b of bubbles) {
      ctx.fillRect(Math.round(b.x), Math.round(b.y), b.r, b.r);
    }

    // particles
    for (const f of fx) {
      if (f.kind === 'text') continue;
      ctx.globalAlpha = Math.min(1, f.life / (f.max * 0.4));
      px(f.kind === 'heart' ? HEART : SPARK, f.x - 2, f.y - 2, f.kind === 'heart' ? '#ff7aa8' : '#fff3a0');
      ctx.globalAlpha = 1;
    }

    // glass glint
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(4, 4, 2, H * 0.4);
    ctx.fillRect(8, 4, 1, H * 0.25);

    // text at device resolution, so it stays readable
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = 'center';
    ctx.font = `600 ${7 * S}px "Pixelify Sans", ui-monospace, monospace`;
    for (const f of fx) {
      if (f.kind !== 'text') continue;
      ctx.globalAlpha = Math.min(1, f.life / (f.max * 0.4));
      ctx.fillStyle = 'rgba(10,30,50,0.8)';
      ctx.fillText(f.label, f.x * S + S, f.y * S + S);
      ctx.fillStyle = f.color;
      ctx.fillText(f.label, f.x * S, f.y * S);
      ctx.globalAlpha = 1;
    }
  }

  function drawPlants(list, calm) {
    for (const p of list) {
      for (let j = 0; j < p.h; j++) {
        const k = j / p.h;
        const sway = Math.round(Math.sin(time * p.speed * calm + p.ph - j * 0.18) * p.amp * k * k);
        ctx.fillStyle = j % 5 === 0 ? p.light : p.color;
        ctx.fillRect(p.x + sway, H - SAND + 2 - j, p.w, 1);
        if (p.leaf && j > 3 && j % 6 === 3) {
          ctx.fillStyle = p.light;
          ctx.fillRect(p.x + sway + (j % 12 === 3 ? -2 : p.w), H - SAND + 2 - j, 2, 1);
        }
      }
    }
  }

  requestAnimationFrame(frame);
  return api;
}

// --- static layers -----------------------------------------------------------------------------------

function paintBackground(W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  // water, banded for a pixel-art gradient
  const top = [150, 228, 236];
  const bot = [34, 92, 140];
  const bands = 14;
  for (let i = 0; i < bands; i++) {
    const k = i / (bands - 1);
    const col = top.map((v, j) => Math.round(v + (bot[j] - v) * k));
    g.fillStyle = `rgb(${col})`;
    g.fillRect(0, Math.floor((i * H) / bands), W, Math.ceil(H / bands) + 1);
  }
  // distant rocks
  const rock = (x, w, h, col) => {
    g.fillStyle = col;
    for (let i = 0; i < w; i++) {
      const k = i / w;
      const hh = Math.round(h * Math.sin(Math.PI * k) ** 0.6 + (i % 7 === 0 ? 1 : 0));
      g.fillRect(x + i, H - SAND - hh + 2, 1, hh);
    }
  };
  rock(W * 0.05, 70, 26, 'rgba(30,70,110,0.45)');
  rock(W * 0.55, 90, 34, 'rgba(30,70,110,0.45)');
  rock(W * 0.3, 50, 16, 'rgba(40,90,120,0.55)');
  rock(W * 0.78, 40, 20, 'rgba(40,90,120,0.55)');
  // sand
  g.fillStyle = '#f0d49a';
  g.fillRect(0, H - SAND, W, SAND);
  g.fillStyle = '#fbe6b8';
  g.fillRect(0, H - SAND, W, 1);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < W * 1.4; i++) {
    g.fillStyle = r() < 0.5 ? '#ddb979' : '#f8dfab';
    g.fillRect(Math.floor(r() * W), H - SAND + 1 + Math.floor(r() * (SAND - 1)), 1, 1);
  }
  for (let i = 0; i < W / 30; i++) {
    const x = Math.floor(r() * W);
    g.fillStyle = ['#a7a2b5', '#c98f7a', '#8fb3a7'][i % 3];
    g.fillRect(x, H - SAND + 2 + Math.floor(r() * 6), 3, 2);
    g.fillRect(x + 1, H - SAND + 1 + Math.floor(r() * 6), 1, 1);
  }
  // bubbler stone
  g.fillStyle = '#7d8aa0';
  g.fillRect(W - 25, H - SAND - 2, 9, 4);
  g.fillStyle = '#a4b2c6';
  g.fillRect(W - 24, H - SAND - 2, 7, 1);
  return c;
}

function makePlants(W, H) {
  const out = [];
  const greens = [['#3f9e6a', '#79d18d'], ['#2f7f5c', '#5fbf7f'], ['#5fae4a', '#a5e07a'], ['#2e8a7a', '#6fd3b5']];
  const n = Math.max(5, Math.round(W / 34));
  for (let i = 0; i < n; i++) {
    const [color, light] = greens[i % greens.length];
    const x = Math.round(((i + 0.5) / n) * W + (Math.sin(i * 12.9) * W) / (n * 2.5));
    if (x > W - 30 && x < W - 12) continue;
    out.push({ x, w: i % 3 === 0 ? 2 : 1, h: Math.round(H * (0.18 + ((i * 37) % 23) / 60)), color, light, amp: 2 + (i % 3), speed: 0.9 + (i % 4) * 0.2, ph: i * 1.3, leaf: i % 2 === 0, back: i % 3 !== 1 });
  }
  return out;
}

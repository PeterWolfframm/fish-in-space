import { GENERATORS } from '../src/gen/registry.js';
import { toCanvas } from '../src/pixel/blit.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const animations = new WeakMap();

const FAMILY_LABEL = {
  pilot: 'Pilots',
  fish: 'Fish',
  waterplant: 'Tank plants',
  plant: 'Garden plants',
};

let globalSeed = 'pixelforge';

function pickAnim(gen) {
  const prefer = ['swim', 'idle', 'wind', 'grow', 'talk'];
  for (const id of prefer) {
    const hit = gen.anims?.find((a) => a.id === id);
    if (hit) return hit;
  }
  return gen.anims?.[0] ?? { id: 'idle', frames: 1, fps: 4 };
}

function seedFor(genId) {
  return `${globalSeed}-${genId}`;
}

function mountSprite(canvas, gen, seed) {
  cancelAnimationFrame(animations.get(canvas));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let genome;
  try {
    genome = gen.fromSeed(seed, {});
  } catch {
    try {
      genome = gen.fromSeed(seed);
    } catch {
      ctx.fillStyle = '#f5ebe3';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
  }

  const anim = pickAnim(gen);
  let frame = 0;
  let last = 0;
  const fps = anim.fps || 6;
  const bg = gen.bg || '#fffaf3';

  function paint(time = 0) {
    if (time - last > 1000 / fps || !last) {
      last = time;
      let image;
      try {
        if (gen.at && anim.continuous) {
          const t = (frame % Math.max(anim.frames, 1)) / Math.max(anim.frames - 1, 1);
          image = gen.at(genome, t);
        } else {
          image = gen.frame(genome, anim.id, frame % Math.max(anim.frames, 1));
        }
      } catch {
        frame++;
        if (!reducedMotion) animations.set(canvas, requestAnimationFrame(paint));
        return;
      }
      const sprite = toCanvas(image);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.w, canvas.height / image.h) * 0.82;
      const w = image.w * scale;
      const h = image.h * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      frame++;
    }
    if (!reducedMotion) animations.set(canvas, requestAnimationFrame(paint));
  }
  paint();
}

function forgeHref(genId) {
  return `/app/#${encodeURIComponent(genId)}`;
}

function versionBadge(gen) {
  const v = gen.version ?? 1;
  if (gen.generation === 'old' && v === 1) return 'v1 frozen';
  if (gen.generation === 'old') return `v${v} classic`;
  return `v${v}`;
}

function buildFamilies(root) {
  root.replaceChildren();
  const byFamily = new Map();
  for (const gen of GENERATORS) {
    const family = gen.family ?? gen.id;
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(gen);
  }

  for (const [family, gens] of byFamily) {
    const section = document.createElement('section');
    section.className = 'gen-family';
    section.innerHTML = `<h3 class="gen-family-title">${FAMILY_LABEL[family] ?? family}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'gen-grid';

    for (const gen of gens) {
      const card = document.createElement('article');
      card.className = 'gen-card';
      card.dataset.genId = gen.id;
      card.innerHTML = `
        <div class="gen-card-stage"><canvas width="120" height="96" aria-label="${gen.label} preview"></canvas></div>
        <div class="gen-card-body">
          <div class="gen-card-head">
            <strong>${gen.label}</strong>
            <span class="gen-badge">${versionBadge(gen)}</span>
          </div>
          <code class="gen-id">${gen.id}</code>
          <div class="gen-card-actions">
            <button type="button" class="gen-reroll">↻</button>
            <a class="gen-open" href="${forgeHref(gen.id)}">Forge</a>
          </div>
        </div>`;
      grid.appendChild(card);
    }
    section.appendChild(grid);
    root.appendChild(section);
  }
}

function paintAll() {
  document.querySelectorAll('[data-gen-demo]').forEach((canvas) => {
    const id = canvas.dataset.genDemo;
    const gen = GENERATORS.find((g) => g.id === id);
    if (gen) mountSprite(canvas, gen, seedFor(id));
  });

  document.querySelectorAll('.gen-card').forEach((card) => {
    const id = card.dataset.genId;
    const gen = GENERATORS.find((g) => g.id === id);
    const canvas = card.querySelector('canvas');
    if (gen && canvas) mountSprite(canvas, gen, seedFor(id));
  });
}

function setSeed(next) {
  globalSeed = next;
  const seedEl = document.querySelector('[data-seed]');
  if (seedEl) seedEl.textContent = globalSeed;
  paintAll();
}

const familiesRoot = document.getElementById('genFamilies');
if (familiesRoot) {
  buildFamilies(familiesRoot);
  paintAll();

  familiesRoot.addEventListener('click', (e) => {
    const btn = e.target.closest('.gen-reroll');
    if (!btn) return;
    const card = btn.closest('.gen-card');
    const id = card?.dataset.genId;
    if (!id) return;
    globalSeed = Math.random().toString(36).slice(2, 10);
    setSeed(globalSeed);
  });
}

document.querySelector('[data-reroll-all]')?.addEventListener('click', () => {
  setSeed(Math.random().toString(36).slice(2, 10));
});

const heroForge = document.querySelector('[data-hero-forge]');
if (heroForge) {
  heroForge.href = forgeHref('fish3');
}

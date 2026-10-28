import { generator } from '../src/gen/registry.js';
import { toCanvas } from '../src/pixel/blit.js';

const fish = generator('fish3');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const animations = new WeakMap();

function mountSprite(canvas, seed) {
  cancelAnimationFrame(animations.get(canvas));
  const ctx = canvas.getContext('2d');
  const genome = fish.fromSeed(seed);
  let frame = 0;
  let last = 0;
  const fps = aquarium ? 7 : 6;
  function paint(time = 0) {
    if (time - last > 1000 / fps || !last) {
      last = time;
      const image = fish.frame(genome, 'swim', frame++ % 8);
      const sprite = toCanvas(image);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.w, canvas.height / image.h) * 0.84;
      const w = image.w * scale;
      const h = image.h * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    }
    if (!reducedMotion) animations.set(canvas, requestAnimationFrame(paint));
  }
  paint();
}

document.querySelectorAll('[data-fish-demo]').forEach((canvas) => {
  mountSprite(canvas, canvas.dataset.fishDemo);
});

document.querySelectorAll('[data-tank-fish]').forEach((canvas) => {
  mountSprite(canvas, canvas.dataset.tankFish);
});

const reroll = document.querySelector('[data-reroll]');
if (reroll) {
  reroll.addEventListener('click', () => {
    const canvas = document.querySelector('[data-fish-demo="hero"]');
    if (!canvas) return;
    canvas.dataset.fishDemo = Math.random().toString(36).slice(2, 10);
    mountSprite(canvas, canvas.dataset.fishDemo);
    const seed = document.querySelector('[data-seed]');
    if (seed) seed.textContent = canvas.dataset.fishDemo;
  });
}

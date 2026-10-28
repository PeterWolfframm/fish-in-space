// Mirelle as a small rotating pixel globe. Sea level, ice and green all follow Bloom, so the planet
// visibly comes alive as the player seeds it. Drawn per pixel into a 96x96 ImageData at ~12 fps,
// only while it is on screen.

const MW = 128;
const MH = 64;
const R = 44;
const SIZE = 96;

function heightMap() {
  let s = 1337;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const grid = (n) => Array.from({ length: n * (n >> 1) }, rnd);
  const octaves = [[8, 0.5], [16, 0.28], [32, 0.15], [64, 0.07]].map(([n, amp]) => ({ n, amp, g: grid(n) }));
  const map = new Float32Array(MW * MH);
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      let v = 0;
      for (const { n, amp, g } of octaves) {
        const gw = n;
        const gh = n >> 1;
        const fx = (x / MW) * gw;
        const fy = (y / MH) * (gh - 1);
        const x0 = Math.floor(fx) % gw;
        const y0 = Math.floor(fy);
        const x1 = (x0 + 1) % gw;
        const y1 = Math.min(gh - 1, y0 + 1);
        const tx = fx - Math.floor(fx);
        const ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const a = g[y0 * gw + x0] + (g[y0 * gw + x1] - g[y0 * gw + x0]) * sx;
        const b = g[y1 * gw + x0] + (g[y1 * gw + x1] - g[y1 * gw + x0]) * sx;
        v += (a + (b - a) * sy) * amp;
      }
      map[y * MW + x] = v;
    }
  }
  return map;
}

const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

export function createPlanet(canvas) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  const map = heightMap();
  let life = 0;
  let rot = 0;
  let raf = 0;
  let lastDraw = 0;
  const stars = Array.from({ length: 26 }, (_, i) => [(i * 37) % SIZE, (i * 61 + 7) % SIZE, i % 3]);

  function render() {
    const d = img.data;
    d.fill(0);
    for (const [x, y, b] of stars) {
      const o = (y * SIZE + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = 140 + b * 50;
      d[o + 3] = 255;
    }
    const sea = 0.36 + life * 0.2;
    const ice = 0.92 - life * 0.22;
    const rock = mix([132, 122, 118], [108, 140, 92], Math.min(1, life * 1.3));
    const high = mix([170, 160, 150], [150, 170, 120], life);
    const deep = mix([70, 80, 96], [30, 70, 150], Math.min(1, life * 2));
    const shallow = mix([110, 120, 130], [70, 170, 200], Math.min(1, life * 2));
    const c = SIZE / 2;
    for (let py = -R; py <= R; py++) {
      for (let px = -R; px <= R; px++) {
        const r2 = px * px + py * py;
        if (r2 > R * R) continue;
        const nx = px / R;
        const ny = py / R;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lat = Math.asin(ny);
        const lon = Math.atan2(nx, nz) + rot;
        const u = ((((lon / (2 * Math.PI)) % 1) + 1) % 1) * MW;
        const v = (lat / Math.PI + 0.5) * (MH - 1);
        const h = map[Math.floor(v) * MW + (Math.floor(u) % MW)];
        const polar = Math.abs(ny);
        let col;
        if (polar + h * 0.15 > ice) col = [236, 244, 250];
        else if (h < sea - 0.08) col = deep;
        else if (h < sea) col = shallow;
        else if (h > 0.72) col = high;
        else col = rock;
        const light = 0.45 + 0.6 * Math.max(0, nx * -0.55 + ny * -0.45 + nz * 0.7);
        const o = ((c + py) * SIZE + (c + px)) * 4;
        d[o] = Math.min(255, col[0] * light);
        d[o + 1] = Math.min(255, col[1] * light);
        d[o + 2] = Math.min(255, col[2] * light);
        d[o + 3] = 255;
      }
    }
    // atmosphere rim, thicker and bluer as life grows
    const atm = mix([170, 170, 190], [120, 210, 255], life);
    for (let a = 0; a < 360; a += 1) {
      const t = (a * Math.PI) / 180;
      for (let k = 0; k < 1 + Math.round(life * 2); k++) {
        const x = Math.round(c + Math.cos(t) * (R + 1 + k));
        const y = Math.round(c + Math.sin(t) * (R + 1 + k));
        const o = (y * SIZE + x) * 4;
        d[o] = atm[0];
        d[o + 1] = atm[1];
        d[o + 2] = atm[2];
        d[o + 3] = 120 - k * 40;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (t - lastDraw < 80) return;
    lastDraw = t;
    rot += 0.03;
    render();
  }

  return {
    set(lifeFraction) {
      life = Math.max(0, Math.min(1, lifeFraction));
      render();
    },
    start() {
      if (!raf && !matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(loop);
      render();
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

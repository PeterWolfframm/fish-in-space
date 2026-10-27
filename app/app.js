// The pixelforge app: pick a generator, roll or edit a genome, watch it animate, breed from a
// gallery, export PNGs, sheets and JSON. Written once against the generator contract in
// src/gen/registry.js, so a new generator shows up here without touching this file.
//
// Generators are grouped by family with a v1 | v2 switch (v1 is the frozen historic version);
// v2 sprites have size classes, so every canvas is sized from the image it shows.

import { GENERATORS, generator, breedWith, fromCode, sizeOf } from '../src/gen/registry.js';
import { toCanvas, toSheet } from '../src/pixel/blit.js';

const $ = (id) => document.getElementById(id);
const GALLERY = 24;

const state = {
  gen: GENERATORS[0],
  seed: '',
  genome: null,
  opts: {},
  locks: new Set(),
  anim: null,
  frame: 0,
  playing: true,
  growth: null, // a fixed t while the growth slider is held
  gallery: [],
  selected: -1,
  parents: [],
  forceSize: null, // a v2 size class forced onto every roll, or null for the rolled one
};

const FAMILY_LABEL = { pilot: 'Pilots', fish: 'Fish', waterplant: 'Tank plants', plant: 'Garden plants' };

// ---------- helpers ----------

const randomSeed = () => Math.random().toString(36).slice(2, 8);
const codeOf = (genome) => state.gen.traits.encode(genome);
const normalize = (genome) => (state.gen.normalize ? state.gen.normalize(genome) : state.gen.traits.normalize(genome));

/** An image on a canvas at `scale`, optionally on the generator's background colour. */
function canvasOf(img, scale, bg = null) {
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

function frameImage(genome = state.genome, i = state.frame) {
  if (state.growth != null && state.gen.at) return state.gen.at(genome, state.growth);
  return state.gen.frame(genome, state.anim.id, i % state.anim.frames);
}

function download(name, blobOrText, type) {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const pngBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
const fileBase = () => `${state.gen.id}-${codeOf(state.genome)}`;

function writeHash() {
  history.replaceState(null, '', `#${state.gen.id}/${codeOf(state.genome)}`);
}

// ---------- setting the genome ----------

function setGenome(genome, { seed = state.seed, gallery = false } = {}) {
  state.genome = normalize(genome);
  state.seed = seed;
  $('seed').value = seed ?? '';
  $('code').value = codeOf(state.genome);
  writeHash();
  renderTraits();
  renderStrip();
  drawPreview();
  if (gallery) renderGallery();
  else markGallery();
}

/** A genome with the forced size class, if one is forced. */
const sized = (genome) => (state.forceSize && state.gen.sizeField ? { ...genome, [state.gen.sizeField]: state.forceSize } : genome);

/** A fresh genome from `seed`, keeping every locked trait. */
function roll(seed) {
  const fresh = sized(state.gen.fromSeed(seed, state.opts));
  if (state.genome) for (const id of state.locks) fresh[id] = state.genome[id];
  setGenome(fresh, { seed });
}

function selectGenerator(id, { code = null } = {}) {
  state.gen = generator(id) ?? GENERATORS[0];
  state.forceSize = null;
  state.locks.clear();
  state.opts = {};
  state.anim = state.gen.anims[0];
  state.frame = 0;
  state.growth = null;
  state.parents = [];
  state.selected = -1;
  for (const b of $('kinds').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.id === state.gen.id));
  $('previewWrap').style.background = state.gen.bg;
  $('anim').replaceChildren(...state.gen.anims.map((a) => new Option(`${a.label ?? a.id} (${a.frames})`, a.id)));
  $('growWrap').hidden = !state.gen.at;
  $('sizeWrap').hidden = !state.gen.sizes;
  $('size').replaceChildren(new Option('as rolled', ''), ...(state.gen.sizes ?? []).map((s) => new Option(`${s.id} (${s.w}×${s.h})`, s.id)));
  renderOptions();
  state.gallery = gallerySeeds(randomSeed());
  const decoded = code ? fromCode(state.gen, code) : null;
  if (decoded) setGenome(decoded, { seed: code, gallery: true });
  else {
    const g = state.gallery[0];
    setGenome(g.genome, { seed: g.seed, gallery: true });
  }
}

const gallerySeeds = (base) =>
  Array.from({ length: GALLERY }, (_, i) => {
    const seed = `${base}-${i}`;
    return { seed, genome: sized(state.gen.fromSeed(seed, state.opts)) };
  });

// ---------- rendering ----------

/** One group per family: its name, then a button per version (v1 is the frozen original). */
function renderKinds() {
  const families = [...new Set(GENERATORS.map((g) => g.family ?? g.id))];
  $('kinds').replaceChildren(...families.map((family) => {
    const box = document.createElement('div');
    box.className = 'family';
    box.setAttribute('role', 'group');
    const name = document.createElement('span');
    name.textContent = FAMILY_LABEL[family] ?? family;
    box.append(name);
    for (const g of GENERATORS.filter((x) => (x.family ?? x.id) === family)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.id = g.id;
      b.textContent = `v${g.version ?? 1}${g.version === 2 ? '' : g.size.w !== GENERATORS.find((x) => x.family === family).size.w ? ` ${g.size.w}px` : ''}`;
      b.title = `${g.label} (${g.game})${g.version === 1 ? ' — frozen original' : ''}`;
      // Switching version keeps the creature: v2 remasters a v1 code.
      b.addEventListener('click', () => selectGenerator(g.id, { code: state.genome && state.gen.family === g.family ? g.traits.encode(state.genome) : null }));
      box.append(b);
    }
    return box;
  }));
}

function renderOptions() {
  const box = $('options');
  box.replaceChildren(...(state.gen.options ?? []).map((o) => {
    const label = document.createElement('label');
    label.className = 'check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(state.opts[o.id]);
    input.addEventListener('change', () => {
      state.opts[o.id] = input.checked || null;
      state.gallery = gallerySeeds(randomSeed());
      roll(state.seed || randomSeed());
      renderGallery();
    });
    label.append(input, ` ${o.label}`);
    return label;
  }));
  box.hidden = !box.children.length;
}

function previewScale() {
  const { w, h } = sizeOf(state.gen, state.genome);
  return Math.max(1, Math.floor(384 / Math.max(w, h)));
}

function drawPreview() {
  const img = frameImage();
  const canvas = $('preview');
  const scale = previewScale();
  canvas.width = img.w * scale;
  canvas.height = img.h * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(toCanvas(img, 1), 0, 0, canvas.width, canvas.height);
  for (const [i, c] of [...$('strip').children].entries()) c.classList.toggle('on', state.growth == null && i === state.frame % state.anim.frames);
}

function renderStrip() {
  const { w, h } = sizeOf(state.gen, state.genome);
  const scale = Math.max(1, Math.floor(56 / Math.max(w, h)));
  $('strip').replaceChildren(...Array.from({ length: state.anim.frames }, (_, i) => {
    const c = canvasOf(state.gen.frame(state.genome, state.anim.id, i), scale, state.gen.bg);
    c.title = `frame ${i}`;
    c.addEventListener('click', () => {
      state.playing = false;
      state.growth = null;
      state.frame = i;
      $('play').textContent = 'Play';
      drawPreview();
    });
    return c;
  }));
}

function renderTraits() {
  const box = $('traits');
  const { traits } = state.gen;
  const nodes = [];
  let group = null;
  for (const f of traits.fields) {
    if (f.group && f.group !== group) {
      group = f.group;
      const h = document.createElement('div');
      h.className = 'group';
      h.textContent = group;
      nodes.push(h);
    }
    const gated = f.when && !f.when(state.genome);
    const row = document.createElement('div');
    row.className = 'field';
    const name = document.createElement('span');
    name.className = `field-name${gated ? ' gated' : ''}`;
    name.textContent = f.label ?? f.id;
    if (gated && f.gateHint) name.title = f.gateHint;
    const lock = document.createElement('button');
    lock.type = 'button';
    lock.className = 'lock';
    lock.textContent = '🔒';
    lock.title = 'Keep through re-rolls';
    lock.setAttribute('aria-pressed', String(state.locks.has(f.id)));
    lock.addEventListener('click', () => {
      if (state.locks.has(f.id)) state.locks.delete(f.id);
      else state.locks.add(f.id);
      lock.setAttribute('aria-pressed', String(state.locks.has(f.id)));
    });
    row.append(name, lock);

    const set = (value) => setGenome({ ...state.genome, [f.id]: value });
    if (f.colors) {
      const sw = document.createElement('div');
      sw.className = 'swatches';
      for (const c of f.choices) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch';
        b.style.background = c.hex;
        b.title = c.label ?? c.id;
        b.disabled = gated;
        b.setAttribute('aria-pressed', String(state.genome[f.id] === c.id));
        b.addEventListener('click', () => set(c.id));
        sw.append(b);
      }
      row.append(sw);
    } else {
      const sel = document.createElement('select');
      sel.disabled = gated;
      for (const c of f.choices) sel.append(new Option(c.label ?? c.id, c.id, false, state.genome[f.id] === c.id));
      sel.addEventListener('change', () => set(sel.value));
      row.append(sel);
    }
    nodes.push(row);
  }
  box.replaceChildren(...nodes);
}

function renderGallery() {
  const anim = state.gen.anims[0];
  // Plants show grown in the gallery; everything else its first frame.
  const thumbFrame = anim.id === 'stages' ? anim.frames - 1 : 0;
  $('grid').replaceChildren(...state.gallery.map((entry, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.background = state.gen.bg;
    const img = state.gen.frame(entry.genome, anim.id, thumbFrame);
    cell.append(canvasOf(img, Math.max(1, Math.floor(88 / Math.max(img.w, img.h)))));
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = entry.label ?? '';
    cell.append(tag);
    const rarity = entry.genome.rarity;
    if (rarity && rarity !== 'common') {
      const r = document.createElement('span');
      r.className = 'rarity';
      r.textContent = { uncommon: '★', rare: '★★', myth: '★★★' }[rarity] ?? '';
      cell.append(r);
    }
    cell.title = `${entry.seed ?? ''}\n${codeOf(entry.genome)}`;
    cell.addEventListener('click', (e) => {
      if (e.shiftKey) {
        toggleParent(i);
        return;
      }
      state.selected = i;
      setGenome(entry.genome, { seed: entry.seed });
    });
    return cell;
  }));
  markGallery();
}

function markGallery() {
  const code = codeOf(state.genome);
  [...$('grid').children].forEach((cell, i) => {
    cell.classList.toggle('sel', codeOf(state.gallery[i].genome) === code);
    cell.classList.toggle('parent', state.parents.includes(i));
  });
  $('breed').disabled = state.parents.length !== 2;
  $('breedHint').textContent = state.parents.length === 2 ? 'two parents picked' : state.parents.length === 1 ? 'shift-click one more' : 'shift-click two to breed';
}

function toggleParent(i) {
  state.parents = state.parents.includes(i) ? state.parents.filter((p) => p !== i) : [...state.parents, i].slice(-2);
  markGallery();
}

/** Fill the gallery with a litter from the two picked parents (parents kept in front). */
function breedLitter() {
  const [a, b] = state.parents.map((i) => state.gallery[i]);
  const egg = randomSeed();
  const kids = Array.from({ length: GALLERY - 2 }, (_, i) => {
    const seed = `${egg}-${i}`;
    return { seed, genome: breedWith(state.gen, a.genome, b.genome, seed), label: 'kid' };
  });
  state.gallery = [{ ...a, label: 'parent' }, { ...b, label: 'parent' }, ...kids];
  state.parents = [];
  renderGallery();
  setGenome(kids[0].genome, { seed: kids[0].seed });
}

// ---------- events ----------

function wire() {
  $('anim').addEventListener('change', () => {
    state.anim = state.gen.anims.find((a) => a.id === $('anim').value);
    state.frame = 0;
    state.growth = null;
    renderStrip();
    drawPreview();
  });
  $('size').addEventListener('change', () => {
    state.forceSize = $('size').value || null;
    if (state.forceSize) setGenome(sized(state.genome));
    state.gallery = state.gallery.map((e) => ({ ...e, genome: sized(e.genome) }));
    renderGallery();
  });
  $('play').addEventListener('click', () => {
    state.playing = !state.playing;
    if (state.playing) state.growth = null;
    $('play').textContent = state.playing ? 'Pause' : 'Play';
  });
  $('grow').addEventListener('input', () => {
    state.growth = Number($('grow').value);
    state.playing = false;
    $('play').textContent = 'Play';
    $('growOut').textContent = `${Math.round(state.growth * 100)}%`;
    drawPreview();
  });
  $('reroll').addEventListener('click', () => roll(randomSeed()));
  $('seed').addEventListener('change', () => roll($('seed').value.trim() || randomSeed()));
  $('code').addEventListener('change', () => {
    const g = fromCode(state.gen, $('code').value);
    if (g) setGenome(g, { seed: $('code').value.trim() });
    else $('code').value = codeOf(state.genome);
  });
  $('copy').addEventListener('click', () => navigator.clipboard?.writeText(location.href));
  $('shuffle').addEventListener('click', () => {
    state.gallery = gallerySeeds(randomSeed());
    state.parents = [];
    renderGallery();
  });
  $('breed').addEventListener('click', breedLitter);

  const exportScale = () => Number($('scale').value);
  const exportBg = () => ($('bgExport').checked ? state.gen.bg : null);
  $('dlFrame').addEventListener('click', async () => {
    const suffix = state.growth != null ? `t${Math.round(state.growth * 100)}` : `${state.anim.id}-${state.frame % state.anim.frames}`;
    download(`${fileBase()}-${suffix}.png`, await pngBlob(canvasOf(frameImage(), exportScale(), exportBg())));
  });
  $('dlSheet').addEventListener('click', async () => {
    const frames = Array.from({ length: state.anim.frames }, (_, i) => state.gen.frame(state.genome, state.anim.id, i));
    download(`${fileBase()}-${state.anim.id}-sheet.png`, await pngBlob(canvasOf(toSheet(frames), exportScale(), exportBg())));
  });
  $('dlJson').addEventListener('click', () => {
    const data = {
      kind: state.gen.id,
      code: codeOf(state.genome),
      seed: state.seed,
      genome: state.genome,
      version: state.gen.version ?? 1,
      size: sizeOf(state.gen, state.genome),
      anims: state.gen.anims,
    };
    download(`${fileBase()}.json`, JSON.stringify(data, null, 2), 'application/json');
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'r') roll(randomSeed());
    if (e.key === ' ') {
      e.preventDefault();
      $('play').click();
    }
  });
  window.addEventListener('hashchange', fromHash);
}

function fromHash() {
  const [id, code] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (!id || !generator(id)) return false;
  if (id === state.gen.id && code && code === codeOf(state.genome ?? {})) return true;
  selectGenerator(id, { code });
  return true;
}

// The animation clock: each anim runs at its own fps.
let last = 0;
function tick(now) {
  requestAnimationFrame(tick);
  if (!state.playing || !state.anim) return;
  if (now - last < 1000 / (state.anim.fps || 6)) return;
  last = now;
  state.frame = (state.frame + 1) % state.anim.frames;
  if (state.gen.at && state.anim.continuous) {
    const t = state.frame / (state.anim.frames - 1);
    $('grow').value = String(t);
    $('growOut').textContent = `${Math.round(t * 100)}%`;
  }
  drawPreview();
}

renderKinds();
wire();
if (!fromHash()) selectGenerator(GENERATORS[0].id);
requestAnimationFrame(tick);

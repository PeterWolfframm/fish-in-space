// The pixelforge app: pick a generator, roll or edit a genome, watch it animate, breed from a
// gallery, export PNGs, sheets and JSON. Written once against the generator contract in
// src/gen/registry.js, so a new generator shows up here without touching this file.
//
// Generators are grouped by family (frozen v1, lit v2, and fish v3).
// v2 sprites have size classes, so every canvas is sized from the image it shows.
//
// Beside the Forge: Swipe (swipe.js), My likes (likes.js) and Admin (admin.js), the pixelgen
// views that teach models what looks good; the Forge can render its rolls the way they like.

import { GENERATORS, generator, breedWith, fromCode, sizeOf } from '../src/gen/registry.js';
import { toCanvas, toSheet } from '../src/pixel/blit.js';
import { hasStyle } from '../src/pixelgen/features.js';
import { startSession, mountAccount, openAccount, onAuth, isAdmin, isMember } from './auth.js';
import { call, on as onPixelgen, swipes } from './pixelgen.js';
import { canvasOf } from './sprites.js';
import { mountSwipe, showSwipe } from './swipe.js';
import { mountLikes, showLikes } from './likes.js';
import { mountAdmin, showAdmin } from './admin.js';
import { mountHome, showHome } from './home.js';
import { mountBreed, showBreed } from './breed.js';
import { mountTank, showTank } from './tank.js';

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
  look: 'auto', // a v2 look forced onto every roll, or 'auto' for the rolled one
  beautify: 'off', // which model restyles rolls: off | public | personal | blend
  view: 'forge',
};
try {
  Object.assign(state, JSON.parse(localStorage.getItem('pixelforge.forge')) ?? {});
} catch {}
const savePrefs = () => {
  try {
    localStorage.setItem('pixelforge.forge', JSON.stringify({ look: state.look, beautify: state.beautify }));
  } catch {}
};
const VIEWS = { home: showHome, forge: null, swipe: showSwipe, tank: showTank, likes: showLikes, breed: showBreed, admin: showAdmin };

const FAMILY_LABEL = { pilot: 'Pilots', fish: 'Fish', waterplant: 'Tank plants', plant: 'Garden plants' };

/** Button text: `v1`, `v1 32px` (the second plant), `v2`, `v3`. */
function kindButtonLabel(g) {
  if ((g.version ?? 1) === 1) {
    const first = GENERATORS.find((x) => x.family === g.family && (x.version ?? 1) === 1);
    if (first && g.size.w !== first.size.w) return `v1 ${g.size.w}px`;
  }
  return `v${g.version ?? 1}`;
}

// ---------- helpers ----------

const randomSeed = () => Math.random().toString(36).slice(2, 8);
const codeOf = (genome) => state.gen.traits.encode(genome);
const normalize = (genome) => (state.gen.normalize ? state.gen.normalize(genome) : state.gen.traits.normalize(genome));

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
  const hash = `#${state.gen.id}/${codeOf(state.genome)}`;
  document.querySelector('[data-view="forge"]').href = hash;
  if (state.view === 'forge') history.replaceState(null, '', hash);
}

// ---------- setting the genome ----------

function setGenome(genome, { seed = state.seed, gallery = false } = {}) {
  state.genome = normalize(genome);
  state.seed = seed;
  $('seed').value = seed ?? '';
  $('code').value = codeOf(state.genome);
  showName();
  writeHash();
  renderTraits();
  renderStrip();
  drawPreview();
  if (gallery) renderGallery();
  else markGallery();
  showScores();
}

/** Generators that name their creatures (fish3) show the name and what the genes do. */
function showName() {
  const named = Boolean(state.gen.name);
  $('nameRow').hidden = !named;
  if (!named) return;
  $('fishName').textContent = state.gen.name(state.genome);
  $('fishGenes').textContent = state.gen.describe ? state.gen.describe(state.genome) : '';
  const names = state.gen.names?.(state.genome);
  $('fishBinomial').textContent = names?.binomial ?? '';
  const sig = state.gen.signatureOf?.(state.genome);
  $('fishSignature').hidden = !sig?.label;
  $('fishSignature').textContent = sig?.label ?? '';
  $('nameRow').classList.toggle('signed', Boolean(sig?.label));
  showEcology();
  showLore();
}

/** Ecology chips. Each one's tooltip names the traits that decided it, so a fish can be read. */
const ECO_CHIPS = [['diet', 'diet'], ['feeding', 'feeds'], ['level', 'level'], ['temperament', 'temper'], ['sociality', 'kept'], ['activity', 'active'], ['depth', 'depth'], ['salinity', 'water'], ['temp', 'temp'], ['current', 'current']];
function showEcology() {
  const box = $('fishEco');
  const eco = state.gen.ecology?.(state.genome);
  box.hidden = !eco;
  if (!eco) return;
  box.replaceChildren(...ECO_CHIPS.map(([k, label]) => {
    const li = document.createElement('li');
    li.className = 'eco-chip';
    const why = eco[k].because;
    if (why.some((b) => b.field === 'signature' || b.field === 'relic')) li.classList.add('sig');
    li.innerHTML = '<span></span><b></b>';
    li.firstChild.textContent = label;
    li.lastChild.textContent = eco[k].value;
    li.title = `${k}: ${eco[k].value} — ${why.map((b) => b.label).join(', ')}`;
    return li;
  }));
  const care = eco.care;
  const li = document.createElement('li');
  li.className = 'eco-chip';
  li.innerHTML = '<span>tank</span><b></b>';
  li.lastChild.textContent = `${care.litres} L · ${care.tempC[0]}–${care.tempC[1]} °C · pH ${care.pH[0]}–${care.pH[1]}`;
  li.title = `grows to ${care.cm} cm; ${care.group > 1 ? `keep ${care.group}` : 'keep alone'}`;
  box.append(li);
}

/** The catalogue entry, in a collapsible block. */
function showLore() {
  const lore = state.gen.lore?.(state.genome);
  $('fishLore').hidden = !lore;
  if (!lore) return;
  const line = (cls, text) => {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    return p;
  };
  const parts = [line('lore-designation', lore.designation)];
  if (lore.quote) {
    const q = line('lore-quote', `“${lore.quote.text}”`);
    if (lore.quote.by) q.append(Object.assign(document.createElement('cite'), { textContent: ` — ${lore.quote.by}` }));
    parts.push(q);
  }
  for (const c of lore.codex) parts.push(line('lore-codex', c.text));
  parts.push(line('lore-edict', lore.edict.text));
  if (lore.legend) parts.push(line('lore-legend', lore.legend.text));
  $('fishLoreBody').replaceChildren(...parts);
}

/** A genome with the forced size class and look, where forced. */
function sized(genome) {
  const out = state.forceSize && state.gen.sizeField ? { ...genome, [state.gen.sizeField]: state.forceSize } : genome;
  return state.look !== 'auto' && hasStyle(state.gen) ? { ...out, look: state.look } : out;
}

/** A fresh genome from `seed`, keeping every locked trait. */
function roll(seed) {
  const fresh = sized(state.gen.fromSeed(seed, state.opts));
  if (state.genome) for (const id of state.locks) fresh[id] = state.genome[id];
  setGenome(fresh, { seed });
  polish();
}

// ---------- pixelgen: beautify and scores ----------

const beautifying = () => state.beautify !== 'off' && hasStyle(state.gen);
const lockedStyle = () => Object.fromEntries([...state.locks].filter((id) => hasStyle(state.gen) && state.gen.traits.fieldById(id)?.group === 'style').map((id) => [id, state.genome[id]]));
let polishToken = 0;

/** Restyle the current roll the way the chosen model likes it (the creature stays the same). */
async function polish() {
  if (!beautifying()) return;
  const token = ++polishToken;
  const { gen, genome } = state;
  const r = await call('beautifyGenome', { kind: gen.id, genome, mode: state.beautify, look: state.look }).catch(() => null);
  if (!r || token !== polishToken || gen !== state.gen || genome !== state.genome) return;
  setGenome({ ...r.genome, ...lockedStyle() });
  if (r.before != null) $('scores').dataset.lift = `${r.beauty >= r.before ? '+' : ''}${Math.round((r.beauty - r.before) * 100)}`;
}

/** Restyle the whole gallery, then show it again. */
async function polishGallery() {
  if (!beautifying()) return;
  const gallery = state.gallery;
  const gen = state.gen;
  const out = [];
  for (const entry of gallery) {
    const r = await call('beautifyGenome', { kind: gen.id, genome: entry.genome, mode: state.beautify, look: state.look }).catch(() => null);
    if (gallery !== state.gallery) return;
    out.push(r ? { ...entry, genome: r.genome } : entry);
  }
  state.gallery = out;
  renderGallery();
}

let scoreToken = 0;
async function showScores() {
  const token = ++scoreToken;
  const s = await call('score', { kind: state.gen.id, genome: state.genome }).catch(() => null);
  if (token !== scoreToken) return;
  const box = $('scores');
  const bar = (label, v) => (v == null ? '' : `<span class="score"><b>${label}</b><i style="--v:${v}"></i>${Math.round(v * 100)}</span>`);
  box.innerHTML = s ? bar('Public', s.public) + bar('You', s.personal) + (box.dataset.lift && beautifying() ? `<span class="lift">beautified ${box.dataset.lift}</span>` : '') : '';
  delete box.dataset.lift;
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
  $('styleRow').hidden = !hasStyle(state.gen);
  $('size').replaceChildren(new Option('as rolled', ''), ...(state.gen.sizes ?? []).map((s) => new Option(`${s.id} (${s.w}×${s.h})`, s.id)));
  renderOptions();
  state.gallery = gallerySeeds(randomSeed());
  const decoded = code ? fromCode(state.gen, code) : null;
  if (decoded) setGenome(decoded, { seed: code, gallery: true });
  else {
    const g = state.gallery[0];
    setGenome(g.genome, { seed: g.seed, gallery: true });
    polish();
  }
  polishGallery();
}

const gallerySeeds = (base) =>
  Array.from({ length: GALLERY }, (_, i) => {
    const seed = `${base}-${i}`;
    return { seed, genome: sized(state.gen.fromSeed(seed, state.opts)) };
  });

// ---------- rendering ----------

/** One group per family: its name, then a button per generator. */
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
      b.textContent = kindButtonLabel(g);
      const frozen = (g.version ?? 1) === 1;
      b.title = `${g.label} (${g.game})${frozen ? ' — frozen original' : ''}`;
      // Switching version inside a family keeps the creature. Decided at click time: the buttons
      // are built once, while the current generator changes.
      b.addEventListener('click', () => {
        const sameLine = state.genome && state.gen.family === g.family && (state.gen.generation ?? 'old') === (g.generation ?? 'old');
        selectGenerator(g.id, { code: sameLine ? g.traits.encode(state.genome) : null });
      });
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
      polishGallery();
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
    if (f.hidden) continue;
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
    const sig = state.gen.signatureOf?.(entry.genome);
    if (sig?.label) cell.classList.add('signed');
    const named = state.gen.name ? `${state.gen.name(entry.genome)}\n${sig?.label ? `${sig.label}\n` : ''}` : '';
    const events = entry.events?.length ? `\n${entry.events.map((e) => `• ${e.text}`).join('\n')}` : '';
    cell.title = `${named}${entry.seed ?? ''}\n${codeOf(entry.genome)}${events}`;
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
    if (state.gen.breedDetailed) {
      // fish3: say what happened (a hybrid, a sport, a hidden gene showing) on the kid's tag.
      const { child, events } = state.gen.breedDetailed(a.genome, b.genome, seed);
      return { seed, genome: child, label: events.length ? events[0].kind : 'kid', events };
    }
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
  $('look').value = state.look;
  $('look').addEventListener('change', () => {
    state.look = $('look').value;
    savePrefs();
    if (state.look !== 'auto') setGenome(sized(state.genome));
    state.gallery = state.gallery.map((e) => ({ ...e, genome: sized(e.genome) }));
    renderGallery();
  });
  $('beautify').value = state.beautify;
  $('beautify').addEventListener('change', () => {
    state.beautify = $('beautify').value;
    savePrefs();
    polish();
    polishGallery();
  });
  onPixelgen('models', showScores);
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
    polishGallery();
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
    if (state.view !== 'forge' || e.target.closest?.('input, select, textarea')) return;
    if (e.key === 'r') roll(randomSeed());
    if (e.key === ' ') {
      e.preventDefault();
      $('play').click();
    }
  });
  window.addEventListener('hashchange', fromHash);
}

/** Show one view. Forge is public. Everything else needs a member account. */
const MEMBER = new Set(['home', 'swipe', 'tank', 'likes', 'breed', 'admin']);
let pendingHash = null; // a member view asked for before the session was restored
let wantsAdmin = false; // #admin asked for before the session said who this is
function paintMembers() {
  const member = isMember();
  document.body.classList.toggle('member', member);
  for (const a of document.querySelectorAll('[data-member]')) a.hidden = !member;
}
function showView(view) {
  if (MEMBER.has(view) && !isMember()) {
    pendingHash = view;
    openAccount();
    view = 'forge';
  } else if (view === 'admin' && !isAdmin()) {
    wantsAdmin = true;
    pendingHash = null;
    view = 'forge';
  } else {
    pendingHash = null;
    wantsAdmin = false;
  }
  state.view = view;
  for (const v of Object.keys(VIEWS)) {
    $(v).hidden = v !== view;
    const tab = document.querySelector(`[data-view="${v}"]`);
    if (v === view) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  $('kinds').hidden = view !== 'forge';
  for (const [v, show] of Object.entries(VIEWS)) show?.(v === view);
  if (view === 'forge' && state.genome) writeHash();
}

function paintLikeCount() {
  const n = swipes().filter((s) => s.verdict === 'approve').length;
  const el = $('likeCount');
  el.textContent = n ? String(n) : '';
  el.hidden = !n;
}

function fromHash() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash in VIEWS) return showView(hash), true;
  if (!hash) return showView('forge'), true;
  showView('forge');
  const [id, code] = hash.split('/');
  if (!id || !generator(id)) return false;
  if (id === state.gen.id && code && code === codeOf(state.genome ?? {})) return true;
  selectGenerator(id, { code });
  return true;
}

// The animation clock: each anim runs at its own fps.
let last = 0;
function tick(now) {
  requestAnimationFrame(tick);
  if (!state.playing || !state.anim || state.view !== 'forge') return;
  const fps = state.gen.fpsOf ? state.gen.fpsOf(state.genome, state.anim) : state.anim.fps;
  if (now - last < 1000 / (fps || 6)) return;
  last = now;
  state.frame = (state.frame + 1) % state.anim.frames;
  if (state.gen.at && state.anim.continuous) {
    const t = state.frame / (state.anim.frames - 1);
    $('grow').value = String(t);
    $('growOut').textContent = `${Math.round(t * 100)}%`;
  }
  drawPreview();
}

// Light is Keypad's own theme. Dark overrides the same tokens. Nothing saved follows the OS,
// which index.html also applies before first paint.
const THEME_KEY = 'pixelforge.theme';
const themeMedia = matchMedia('(prefers-color-scheme: dark)');
const savedTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
};
const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  $('themeToggle').textContent = theme === 'dark' ? '☀' : '☾';
  $('themeToggle').setAttribute('aria-label', theme === 'dark' ? 'Switch to light' : 'Switch to dark');
};
applyTheme(document.documentElement.dataset.theme || (themeMedia.matches ? 'dark' : 'light'));
$('themeToggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, theme); } catch {}
  applyTheme(theme);
});
themeMedia.addEventListener('change', () => {
  if (!savedTheme()) applyTheme(themeMedia.matches ? 'dark' : 'light');
});

renderKinds();
wire();
mountAccount($('acctChip'), $('acctSheet'));
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.account')) $('acctSheet').hidden = true;
});
mountHome();
mountBreed();
mountTank();
mountSwipe();
mountLikes();
mountAdmin();
onPixelgen('swipes', paintLikeCount);
paintLikeCount();
onAuth(() => {
  paintMembers();
  document.querySelector('[data-view="admin"]').hidden = !isAdmin();
  if (isMember() && pendingHash) {
    const next = pendingHash;
    pendingHash = null;
    if (location.hash.slice(1) !== next) location.hash = next;
    else showView(next);
  } else if (wantsAdmin && isAdmin()) location.hash = 'admin';
  else if (state.view === 'admin' && !isAdmin()) location.hash = 'forge';
});
paintMembers();
fromHash();
if (!state.genome) selectGenerator(GENERATORS[0].id);
requestAnimationFrame(tick);
startSession().catch((e) => console.warn('pixelgen: no session', e));

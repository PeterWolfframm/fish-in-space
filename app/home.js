// Home: the tier list of everything this browser has hooked, plus the sims that open the Forge.
// Drag a tile between rows. A tap opens its profile. The swimming tank is not on this page.

import { generator } from '../src/gen/registry.js';
import { swipes, removeSwipe, on } from './pixelgen.js';
import { thumb } from './sprites.js';
import { describeCatch } from './catch.js';
import { RANKS, snapshot, syncLikes, moveEntry, dropEntry, onTiers } from './tiers.js';
import { say } from './toast.js';

const $ = (id) => document.getElementById(id);

const TIERS = [
  ['S', 'Soulmate', '#FFD66B', 'Nobody. Standards are standards.'],
  ['A', 'Absolute unit', '#FFB48A', 'Vacant.'],
  ['B', 'Bring home to mom', '#9BE0B5', 'Mom is waiting.'],
  ['C', 'Coworker energy', '#8CC8E8', 'Nobody. Yet.'],
  ['D', 'Dinner', '#CDB6F2', 'Nobody’s on the menu.'],
];

const SIMS = [
  ['fish3', 'Fish', 'v3 · LIVE', '32 bodies plus hybrids, six size classes, modelled swim, Mendelian colour genes. A name for every fish.'],
  ['plant3', 'Garden plants', 'v3 · LIVE', '16 species on nine bend habits, five heights, wind-driven sway. Veins and bark as they grow.'],
  ['waterplant2', 'Tank plants', 'v2 · LIVE', 'Four classes of aquarium greenery, shaded and animated for the tank.'],
  ['pilot2', 'Pilots', 'v2 · LIVE', 'Portrait framings cropped from one scene. Same face at every size, talking animations.'],
];

let visible = false;
let drag = null;
let hover = null;
let openKey = null;

const keyOf = (e) => `${e.kind}|${e.code}`;
const approved = () => swipes().filter((s) => s.verdict === 'approve');

function paintStats() {
  const all = swipes();
  const hooked = all.filter((s) => s.verdict === 'approve').length;
  const thrown = all.filter((s) => s.verdict === 'pass').length;
  $('homeStats').textContent = `${all.length} swiped · ${hooked} hooked · ${thrown} thrown back`;
}

function tile(entry) {
  const node = document.createElement('div');
  node.className = 'tile';
  node.dataset.fish = keyOf(entry);
  const profile = describeCatch(entry.kind, entry.code);
  node.title = profile.name;
  const art = thumb(entry.kind, entry.code, 56);
  art.style.background = 'transparent';
  node.append(art);
  return node;
}

function row(rank, label, color, emptyText, entries) {
  const zone = document.createElement('div');
  zone.className = 'tier';
  zone.dataset.tier = rank;
  const badge = document.createElement('div');
  badge.className = 'tier-badge';
  badge.style.background = color;
  badge.innerHTML = `<b></b><span></span>`;
  badge.querySelector('b').textContent = rank;
  badge.querySelector('span').textContent = label;
  const well = document.createElement('div');
  well.className = 'tier-well';
  if (entries.length) well.append(...entries.map(tile));
  else {
    const empty = document.createElement('span');
    empty.className = 'tier-empty';
    empty.textContent = emptyText;
    well.append(empty);
  }
  zone.append(badge, well);
  return zone;
}

function paintHover() {
  for (const el of document.querySelectorAll('#home [data-tier]')) {
    el.classList.toggle('hot', !!(drag && hover?.tier === el.dataset.tier));
  }
  for (const el of document.querySelectorAll('#home [data-fish]')) {
    el.classList.toggle('mark', !!(drag && hover?.before === el.dataset.fish && el.dataset.fish !== drag.key));
    el.style.opacity = drag?.key === el.dataset.fish ? '0.25' : '';
  }
}

function render() {
  if (!visible) return;
  const data = snapshot();
  const rows = $('tierRows');
  rows.replaceChildren(...TIERS.map(([rank, label, color, empty]) => row(rank, label, color, empty, data[rank])));
  $('poolCount').textContent = String(data.pool.length);
  const well = $('poolWell');
  if (data.pool.length) well.replaceChildren(...data.pool.map(tile));
  else {
    const empty = document.createElement('span');
    empty.className = 'tier-empty';
    empty.textContent = 'Empty. Go swipe right on something.';
    well.replaceChildren(empty);
  }
  paintStats();
}

function placeGhost(x, y) {
  const ghost = $('dragGhost');
  ghost.hidden = false;
  ghost.style.left = `${x - 36}px`;
  ghost.style.top = `${y - 36}px`;
}

function endDrag() {
  $('dragGhost').hidden = true;
  $('dragGhost').replaceChildren();
  drag = null;
  hover = null;
}

function onTileDown(e) {
  const tileEl = e.target.closest('[data-fish]');
  if (!tileEl || e.button) return;
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY };
  let started = false;
  const move = (ev) => {
    if (!started && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
    if (!started) {
      started = true;
      drag = { key: tileEl.dataset.fish };
      const canvas = tileEl.querySelector('canvas');
      const ghost = $('dragGhost');
      ghost.replaceChildren();
      if (canvas?.width) {
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        copy.getContext('2d').drawImage(canvas, 0, 0);
        ghost.append(copy);
      }
      paintHover();
    }
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const tierEl = under?.closest('[data-tier]');
    const fishEl = under?.closest('[data-fish]');
    hover = tierEl ? { tier: tierEl.dataset.tier, before: fishEl?.dataset.fish ?? null } : null;
    placeGhost(ev.clientX, ev.clientY);
    paintHover();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (!started) {
      openProfile(tileEl.dataset.fish);
      return;
    }
    const key = drag.key;
    const dest = hover;
    endDrag();
    if (dest) {
      moveEntry(key, dest.tier, dest.before);
      if (dest.tier === 'S') say('Soulmate secured.');
      if (dest.tier === 'D') say('Bon appétit.');
    }
    render();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function findEntry(key) {
  const data = snapshot();
  for (const rank of RANKS) {
    const entry = data[rank].find((e) => keyOf(e) === key);
    if (entry) return entry;
  }
  return null;
}

function openProfile(key) {
  openKey = key;
  const cut = key.indexOf('|');
  const kind = key.slice(0, cut);
  const code = key.slice(cut + 1);
  const entry = findEntry(key);
  const profile = describeCatch(kind, code);
  $('profileName').textContent = profile.name;
  $('profileSub').textContent = [profile.sub, profile.away].filter(Boolean).join(' · ');
  $('profileBio').replaceChildren(...profile.bio.map((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    return p;
  }));
  $('profileChips').replaceChildren(...profile.chips.map((c) => {
    const span = document.createElement('span');
    span.className = 'chip static';
    span.textContent = c;
    return span;
  }));
  const art = $('profileArt');
  art.replaceChildren(thumb(kind, code, 180));
  art.firstChild.style.background = 'transparent';
  const scores = $('profileScores');
  const pub = profile.scores?.public;
  const you = profile.scores?.personal;
  scores.hidden = pub == null && you == null;
  if (!scores.hidden) {
    scores.querySelector('[data-bar="pub"]').style.width = `${Math.round((pub ?? 0) * 100)}%`;
    scores.querySelector('[data-num="pub"]').textContent = pub == null ? '—' : String(Math.round(pub * 100));
    scores.querySelector('[data-bar="you"]').style.width = `${Math.round((you ?? 0) * 100)}%`;
    scores.querySelector('[data-num="you"]').textContent = you == null ? '—' : String(Math.round(you * 100));
  }
  $('profileRelease').hidden = !entry;
  $('sheetBackdrop').hidden = false;
  $('profileSheet').hidden = false;
}

function closeProfile() {
  openKey = null;
  $('sheetBackdrop').hidden = true;
  $('profileSheet').hidden = true;
}

async function release() {
  if (!openKey) return;
  const key = openKey;
  const cut = key.indexOf('|');
  const kind = key.slice(0, cut);
  const code = key.slice(cut + 1);
  const entry = dropEntry(key);
  closeProfile();
  const swipeId = entry?.swipeId ?? swipes().find((s) => s.kind === kind && s.code === code && s.verdict === 'approve')?.id;
  if (swipeId && !entry?.local) await removeSwipe(swipeId);
  say('Swim free, little guy.');
  render();
}

export function mountHome() {
  $('sims').replaceChildren(...SIMS.map(([id, name, tag, text]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sim';
    b.innerHTML = `<span class="sim-top"><span class="sim-name"></span><span class="sim-tag"></span></span><span class="sim-text"></span>`;
    b.querySelector('.sim-name').textContent = name;
    b.querySelector('.sim-tag').textContent = tag;
    b.querySelector('.sim-text').textContent = text;
    b.addEventListener('click', () => {
      const gen = generator(id);
      if (!gen) return say('That sim is not in this build.');
      location.hash = id;
    });
    return b;
  }));
  $('tierRows').addEventListener('pointerdown', onTileDown);
  $('tierPool').addEventListener('pointerdown', onTileDown);
  $('profileClose').addEventListener('click', closeProfile);
  $('sheetBackdrop').addEventListener('click', closeProfile);
  $('profileRelease').addEventListener('click', release);
  on('swipes', () => syncLikes(approved()));
  onTiers(() => { if (visible && !drag) render(); });
}

export function showHome(v) {
  visible = v;
  if (!v) return closeProfile();
  syncLikes(approved());
  render();
}

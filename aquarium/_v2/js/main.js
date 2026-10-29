// FISH IN SPACE!: the page. Owns the state, the clock and the panels; the world module owns the rules and
// the tank draws what the state says.

import fish from '../../../src/v3/fish/index.js';
import * as W from './world.js';
import * as sprites from './sprites.js';
import { createTank } from './tank.js';
import { createPlanet } from './planet.js';
import { sfx, unlock, isMuted, setMuted } from './audio.js';

const SAVE_KEY = 'seedfall-save-v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};

// --- state ---------------------------------------------------------------------------------------

function load() {
  try {
    return W.restore(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {}
}

let state = load() ?? W.newGame(Date.now(), Math.random().toString(36).slice(2, 10));
const ui = { tab: 'tank', selected: null, pairWith: null, fedOnce: state.stats.bred > 0 || state.stats.orders > 0 };

// Catch up on time away, quietly.
{
  const away = Date.now() - state.lastTick;
  const ev = W.tick(state, Date.now());
  const hatched = ev.filter((e) => e.kind === 'hatched').length;
  if (away > 60_000) W.addLog(state, Date.now(), '☾', `Welcome back, Doc. ${hatched ? `${hatched} egg${hatched > 1 ? 's' : ''} hatched while you were away. ` : ''}The tank kept itself ticking.`);
}

// --- tank ------------------------------------------------------------------------------------------

let marksKey = '';
let marks = new Map();
function selection() {
  const key = `${ui.selected}|${ui.pairWith}|${state.fish.length}|${Math.floor(Date.now() / 1000)}`;
  if (key === marksKey) return { marks };
  marksKey = key;
  marks = new Map();
  if (ui.pairWith) {
    const a = state.fish.find((f) => f.id === ui.pairWith);
    marks.set(ui.pairWith, 'pair');
    for (const f of state.fish) if (f !== a && !W.breedProblem(state, a, f, Date.now())) marks.set(f.id, 'heart');
  } else if (ui.selected) marks.set(ui.selected, 'sel');
  return { marks };
}

let lastBite = 0;
const tank = createTank($('#tank'), {
  state: () => state,
  selection,
  onFish(id) {
    unlock();
    if (ui.pairWith) return tryPair(id);
    sfx.select();
    openFish(id);
  },
  onWater(x, y) {
    unlock();
    tank.dropFood(x, y);
    sfx.plip();
    if (!ui.fedOnce) (ui.fedOnce = true), hint();
  },
  onEgg(egg) {
    toast(`${egg.roe ? 'Cryo-roe thawing' : 'Eggs'}: ${mmss(egg.hatchAt - Date.now())} to go`);
  },
  onBite(id) {
    W.feed(state, id);
    if (performance.now() - lastBite > 120) (lastBite = performance.now()), sfx.bite();
  },
});

// --- toasts, modal, hint -----------------------------------------------------------------------------

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  $('#toasts').append(el);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

function modal(html, button, onClose) {
  const m = $('#modal');
  $('#modalBody').innerHTML = html;
  $('#modalGo').textContent = button;
  m.hidden = false;
  $('#modalGo').onclick = () => {
    m.hidden = true;
    unlock();
    onClose?.();
  };
  $('#modalGo').focus();
}

function hint() {
  let text = '';
  if (ui.pairWith) text = 'Tap a ♡ fish to pair · tap the first fish again to cancel';
  else if (!ui.fedOnce) text = 'Tap the water to drop feed';
  else if (state.stats.orders === 0 && state.orders.length) text = 'A colony is asking for fish → Requests';
  else if (state.stats.bred === 0) text = 'Tap a fish, then ♡ Pair to breed';
  $('#hint').textContent = text;
  $('#hint').hidden = !text;
  $('#cancelPair').hidden = !ui.pairWith;
}

// --- fish dossier ------------------------------------------------------------------------------------

let portraitTimer = 0;
function openFish(id) {
  ui.selected = id;
  ui.pairWith = null;
  renderSheet();
  $('#sheet').hidden = false;
  $('#sheet').scrollTop = 0;
  hint();
}
function closeSheet() {
  ui.selected = null;
  $('#sheet').hidden = true;
  clearInterval(portraitTimer);
  hint();
}

const STAGE = { fry: 'Fry', juvenile: 'Juvenile', adult: 'Adult', elder: 'Elder' };
const SEX = { m: '♂ Male', f: '♀ Female' };
const ALLELE_TONE = { wild: 'dim' };

function chip(text, cls = '') {
  return `<span class="chip ${cls}">${esc(text)}</span>`;
}

function renderSheet() {
  const f = state.fish.find((x) => x.id === ui.selected);
  if (!f) return closeSheet();
  const g = W.genomeOf(f.code);
  const e = W.ecoOf(f.code);
  const names = fish.names(g);
  const lore = fish.lore(g);
  const now = Date.now();
  const stage = W.stageOf(f.code);
  const nextAt = stage === 'fry' ? W.GROW.juvenile : stage === 'juvenile' ? W.GROW.adult : null;
  const prevAt = stage === 'fry' ? 0 : stage === 'juvenile' ? W.GROW.juvenile : W.GROW.adult;
  const grow = nextAt ? (f.growth - prevAt) / (nextAt - prevAt) : 1;
  const fits = state.orders.filter((o) => W.meetsAll(f.code, o.reqs));
  const biomes = W.openBiomes(state.phase).filter((b) => W.fitsBiome(f.code, b, state.phase));
  const line = lore.quote ?? lore.codex?.find((c) => c.text)?.text ?? '';
  const price = W.priceOf(f.code, now);
  const resting = f.spawnReadyAt > now;

  $('#sheetBody').innerHTML = `
    <div class="dossier-head">
      <div class="portrait"><canvas id="portrait"></canvas></div>
      <div class="dossier-title">
        <h2>${esc(names.common ?? fish.name(g))}</h2>
        <p class="binomial">${esc(names.binomial ?? '')}</p>
        <div class="chips">${chip(SEX[g.sex] ?? g.sex, g.sex)}${chip(STAGE[stage] ?? stage)}${chip(cap(g.rarity), `r-${g.rarity}`)}${chip(`Gen ${W.generationOf(g)}`)}${g.hybrid !== 'none' ? chip('Hybrid', 'r-rare') : ''}</div>
      </div>
    </div>
    <div class="meters">
      <label>Fed <span class="meter"><i style="width:${Math.round((1 - f.hunger) * 100)}%"></i></span></label>
      <label>${nextAt ? `Growing to ${stage === 'fry' ? 'juvenile' : 'adult'}` : 'Fully grown'} <span class="meter grow"><i style="width:${Math.round(grow * 100)}%"></i></span></label>
    </div>
    <h3>Water it needs</h3>
    <div class="chips">${chip(W.WORD[e.salinity] ?? cap(e.salinity), 'water')}${chip(`${W.WORD[e.temp] ?? cap(e.temp)} ${e.care.tempC[0]}–${e.care.tempC[1]}°C`, 'water')}${chip(cap(e.depth), 'water')}</div>
    <h3>Role in the food web</h3>
    <div class="chips">${chip(cap(e.diet))}${chip(W.WORD[e.level] ?? cap(e.level))}${chip(W.WORD[e.sociality] ?? cap(e.sociality))}${chip(cap(e.temperament))}${chip(cap(e.activity))}</div>
    <h3>Genetic material</h3>
    <div class="chips">${[g.geneA, g.geneB].map((a) => chip(a === 'wild' ? 'wild type' : a, ALLELE_TONE[a] ?? 'gene')).join('')}<span class="note">two alleles; each parent passes one</span></div>
    ${line ? `<p class="lore">“${esc(line)}”</p>` : ''}
    ${fits.length ? `<h3>Fits a request</h3><div class="fit-list">${fits.map((o) => `<button class="btn launch" data-act="launch" data-order="${o.id}" data-fish="${f.id}">☄ Drop to ${esc(W.biomeById(o.biome).name)} <small>${esc(o.colony)} · +${o.reward}◎</small></button>`).join('')}</div>` : ''}
    <div class="actions">
      <button class="btn pair" data-act="pair" ${!W.isAdult(f) || resting ? 'disabled' : ''}>♡ ${!W.isAdult(f) ? 'Too young to pair' : resting ? `Resting ${mmss(f.spawnReadyAt - now)}` : 'Pair…'}</button>
      <button class="btn sell" data-act="sell" data-fish="${f.id}" data-confirm="Sell for ${price}◎?">◎ Sell ${price}</button>
    </div>
    ${biomes.length ? `<div class="seed-row"><span>Or release freely:</span>${biomes.map((b) => `<button class="btn ghost" data-act="seed" data-biome="${b.id}" data-fish="${f.id}" data-confirm="Release into ${esc(b.name)}?">${b.icon} ${esc(b.name)}</button>`).join('')}</div>` : `<p class="note">No open biome on Mirelle suits it yet. Keep it for breeding or sell it.</p>`}
  `;
  clearInterval(portraitTimer);
  let fr = 0;
  const paint = () => {
    const c = $('#portrait');
    const sp = c && sprites.get(f.code, 'swim', true);
    if (!sp) return;
    c.width = sp.w;
    c.height = sp.h;
    const x = c.getContext('2d');
    x.clearRect(0, 0, sp.w, sp.h);
    x.drawImage(sp.bmp, (fr++ % sp.n) * sp.w, 0, sp.w, sp.h, 0, 0, sp.w, sp.h);
  };
  paint();
  portraitTimer = setInterval(paint, 110);
}

// --- actions -----------------------------------------------------------------------------------------

function tryPair(id) {
  if (id === ui.pairWith) {
    ui.pairWith = null;
    hint();
    return;
  }
  const r = W.breed(state, ui.pairWith, id, Date.now());
  if (r.error) {
    sfx.nope();
    toast(r.error, 'warn');
    return;
  }
  sfx.love();
  tank.heartsOn(ui.pairWith, 6);
  tank.heartsOn(id, 6);
  const news = r.events.length ? ` ${cap(r.events[0].text)}!` : '';
  toast(`Eggs laid! They hatch in ${W.EGG_HATCH / 1000}s.${news}`, 'good');
  ui.pairWith = null;
  hint();
  changed();
}

function handle(events) {
  let dirty = false;
  for (const ev of events) {
    dirty = true;
    if (ev.kind === 'hatched') {
      tank.hatch(ev.fish.x ?? 0.5);
      sfx.hatch();
      toast(`${ev.roe ? 'Thawed' : 'Hatched'}: ${W.nameOf(ev.fish.code)}`, 'good');
    } else if (ev.kind === 'grew') {
      tank.say(ev.fish.id, ev.stage === 'adult' ? 'all grown up!' : 'growing!');
    } else if (ev.kind === 'order') {
      toast(`New request from ${ev.order.colony}`, 'info');
    } else if (ev.kind === 'expired') {
      toast(`${ev.order.colony}'s request lapsed. Another will come.`);
    } else if (ev.kind === 'phase') {
      sfx.phase();
      const p = W.PHASES[ev.phase];
      const opened = W.BIOMES.find((b) => b.opens === ev.phase);
      setTimeout(() => modal(`
        <p class="eyebrow">PIP · planetary bulletin</p>
        <h2>Phase ${ev.phase}: ${esc(p.name)}</h2>
        <p>${esc(p.story)}</p>
        ${opened ? `<p class="unlock">${opened.icon} <b>${esc(opened.name)}</b> is open: ${esc(W.condWords(W.condOf(opened, ev.phase)))} water.</p>` : ''}`, 'Back to the tank'), 900);
    }
  }
  if (dirty) changed();
}

function changed() {
  save();
  renderHud();
  renderTab();
  if (ui.selected) renderSheet();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  unlock();
  if (el.dataset.confirm && el.dataset.armed !== '1') {
    el.dataset.armed = '1';
    el.dataset.label = el.innerHTML;
    el.textContent = el.dataset.confirm;
    el.classList.add('armed');
    setTimeout(() => {
      if (!el.isConnected) return;
      el.dataset.armed = '';
      el.innerHTML = el.dataset.label;
      el.classList.remove('armed');
    }, 3000);
    return;
  }
  const now = Date.now();
  const act = el.dataset.act;
  if (act === 'tab') {
    ui.tab = el.dataset.tab;
    renderTab();
  } else if (act === 'close') closeSheet();
  else if (act === 'cancel-pair') (ui.pairWith = null), hint();
  else if (act === 'open-fish') openFish(el.dataset.fish);
  else if (act === 'feed-all') tank.feedAll(), sfx.plip(), (ui.fedOnce = true), hint();
  else if (act === 'pair') {
    ui.pairWith = ui.selected;
    $('#sheet').hidden = true;
    const n = state.fish.filter((f) => f.id !== ui.pairWith && !W.breedProblem(state, state.fish.find((x) => x.id === ui.pairWith), f, now)).length;
    toast(n ? `${n} possible partner${n > 1 ? 's' : ''} marked ♡` : 'No partner is ready: you need an adult of the other sex.', n ? 'info' : 'warn');
    if (!n) ui.pairWith = null;
    hint();
    $('#tank').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else if (act === 'sell') {
    const r = W.sell(state, el.dataset.fish, now);
    if (r.error) return toast(r.error, 'warn');
    tank.say(r.fish.id, `+${r.price}◎`);
    tank.sold(r.fish.id);
    sfx.coin();
    toast(`Sold for ${r.price}◎`, 'good');
    if (ui.selected === r.fish.id) closeSheet();
    changed();
  } else if (act === 'launch') {
    const f = state.fish.find((x) => x.id === el.dataset.fish);
    const r = W.fulfil(state, el.dataset.order, el.dataset.fish, now);
    if (r.error) return toast(r.error, 'warn');
    tank.say(f.id, `+${r.order.reward}◎`);
    tank.launch(f.id, f.code);
    sfx.launch();
    setTimeout(sfx.coin, 600);
    toast(`Seed pod away! +${r.order.reward}◎ · +${r.order.bloom} bloom`, 'good');
    if (ui.selected === f.id) closeSheet();
    handle(r.events);
    changed();
  } else if (act === 'seed') {
    const f = state.fish.find((x) => x.id === el.dataset.fish);
    const r = W.seedFree(state, el.dataset.fish, el.dataset.biome, now);
    if (r.error) return toast(r.error, 'warn');
    tank.launch(f.id, f.code);
    sfx.launch();
    toast(`Released into ${W.biomeById(el.dataset.biome).name}. +${r.bloom} bloom`, 'good');
    closeSheet();
    handle(r.events);
    changed();
  } else if (act === 'buy') {
    const r = W.buy(state, el.dataset.item, now);
    if (r.error) return sfx.nope(), toast(r.error, 'warn');
    sfx.coin();
    toast(r.item.kind === 'upgrade' ? `Tank extended to ${state.capacity} berths` : 'Cryo-roe dropped into the tank. Thawing…', 'good');
    changed();
  } else if (act === 'mute') {
    setMuted(!isMuted());
    if (!isMuted()) unlock();
    renderHud();
  }
});

$('#tank').addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') tank.feedAll();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (ui.pairWith) (ui.pairWith = null), hint();
    else if (!$('#sheet').hidden) closeSheet();
  }
});

// --- panels --------------------------------------------------------------------------------------------

function renderHud() {
  $('#credits').textContent = state.credits;
  const next = W.PHASES[state.phase + 1];
  const prev = W.PHASES[state.phase].bloom;
  $('#phaseName').textContent = W.PHASES[state.phase].name;
  $('#bloomFill').style.width = `${next ? Math.min(100, ((state.bloom - prev) / (next.bloom - prev)) * 100) : 100}%`;
  $('#bloomText').textContent = next ? `${state.bloom}/${next.bloom}` : `${state.bloom}`;
  $('#mute').textContent = isMuted() ? '♪̸' : '♪';
  $('#mute').setAttribute('aria-pressed', String(!isMuted()));
  $('#berths').textContent = `${state.fish.length + state.eggs.length}/${state.capacity} berths`;
  const ready = state.orders.filter((o) => state.fish.some((f) => W.meetsAll(f.code, o.reqs))).length;
  const badge = $('#reqBadge');
  badge.textContent = ready || state.orders.length;
  badge.hidden = !state.orders.length;
  badge.classList.toggle('hot', ready > 0);
}

function thumb(code, cls = '') {
  return `<canvas class="thumb ${cls}" data-thumb="${esc(code)}" width="1" height="1"></canvas>`;
}
function paintThumbs(root = document) {
  let missing = false;
  for (const c of root.querySelectorAll('canvas[data-thumb]')) {
    if (c.dataset.done) continue;
    const sp = sprites.get(c.dataset.thumb, 'swim');
    if (!sp) {
      missing = true;
      continue;
    }
    c.width = sp.w;
    c.height = sp.h;
    c.getContext('2d').drawImage(sp.bmp, 0, 0, sp.w, sp.h, 0, 0, sp.w, sp.h);
    c.dataset.done = '1';
  }
  if (missing) setTimeout(() => paintThumbs(root), 250);
}

const TABS = {
  tank: renderRoster,
  requests: renderRequests,
  exchange: renderExchange,
  vault: renderVault,
  mirelle: renderMirelle,
  log: renderLog,
};

let planet = null;
function renderTab() {
  for (const b of document.querySelectorAll('.tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab));
  for (const p of document.querySelectorAll('.pane')) p.hidden = p.dataset.pane !== ui.tab;
  TABS[ui.tab]();
  if (ui.tab === 'mirelle') planet.start();
  else planet?.stop();
  paintThumbs($(`.pane[data-pane="${ui.tab}"]`));
  hint();
}

function renderRoster() {
  const now = Date.now();
  const fitIds = new Set(state.orders.flatMap((o) => state.fish.filter((f) => W.meetsAll(f.code, o.reqs)).map((f) => f.id)));
  $('#rosterBody').innerHTML = `
    ${state.eggs.length ? `<div class="eggs">${state.eggs.map((g) => `<span class="egg">${g.roe ? '❄ Roe' : '◌ Eggs'} <b data-until="${g.hatchAt}">${mmss(g.hatchAt - now)}</b></span>`).join('')}</div>` : ''}
    <div class="roster">${state.fish.map((f) => {
      const g = W.genomeOf(f.code);
      return `<button class="fish-card ${ui.selected === f.id ? 'on' : ''}" data-act="open-fish" data-fish="${f.id}">
        ${thumb(f.code)}
        <span class="fc-name">${esc(W.nameOf(f.code))}</span>
        <span class="fc-meta"><span class="${g.sex}">${g.sex === 'm' ? '♂' : '♀'}</span> ${STAGE[g.stage]}${f.hunger > 0.7 ? ' · <span class="hungry">hungry</span>' : ''}</span>
        ${fitIds.has(f.id) ? '<span class="fc-star" title="Fits an open request">☄</span>' : ''}
      </button>`;
    }).join('') || '<p class="empty">The tank is empty. The Vault has roe.</p>'}</div>`;
}

function renderRequests() {
  const now = Date.now();
  if (!state.orders.length) {
    $('#requestsBody').innerHTML = `<p class="empty">PIP is listening for colony requests… next in <b data-until="${state.nextOrderAt}">${mmss(state.nextOrderAt - now)}</b></p>`;
    return;
  }
  $('#requestsBody').innerHTML = state.orders.map((o) => {
    const b = W.biomeById(o.biome);
    const ranked = state.fish.map((f) => ({ f, s: W.score(f.code, o.reqs) })).sort((x, y) => y.s - x.s);
    const fits = ranked.filter((x) => x.s === o.reqs.length);
    const close = ranked[0];
    return `<article class="order" style="--biome:${b.color}">
      <header><span class="biome-icon">${b.icon}</span><div><b>${esc(o.colony)}</b><small>${esc(b.name)}</small></div><span class="timer" data-until="${o.expires}">${mmss(o.expires - now)}</span></header>
      <p class="flavor">${esc(o.flavor)}</p>
      <div class="chips">${o.reqs.map((q) => chip(W.reqLabel(q), state.fish.some((f) => W.meets(f.code, q)) ? 'ok' : 'need')).join('')}</div>
      <footer>
        <span class="reward">+${o.reward}◎ <span>+${o.bloom} bloom</span></span>
        ${fits.length ? `<div class="cands">${fits.slice(0, 4).map(({ f }) => `<button class="cand" data-act="launch" data-order="${o.id}" data-fish="${f.id}" title="Drop ${esc(W.nameOf(f.code))}">${thumb(f.code)}<span>Drop ☄</span></button>`).join('')}</div>`
          : close ? `<span class="closest">Closest: ${esc(W.nameOf(close.f.code))} (${close.s}/${o.reqs.length})</span>` : ''}
      </footer>
    </article>`;
  }).join('') + (state.orders.length < W.MAX_ORDERS ? `<p class="note center">Next request in <b data-until="${state.nextOrderAt}">${mmss(state.nextOrderAt - now)}</b></p>` : '');
}

function renderExchange() {
  const now = Date.now();
  const h = W.headlines(now);
  $('#exchangeBody').innerHTML = `
    <div class="news">${h.slice(0, 3).map((x) => `<div class="headline"><b>${cap(x.tag)} ×${x.mult.toFixed(1)}</b><span>${esc(x.why)}</span></div>`).join('')}</div>
    <div class="board">${h.map((x) => `<span class="tick ${x.mult > 1.25 ? 'up' : x.mult < 0.85 ? 'down' : ''}">${x.tag} ${x.mult > 1.25 ? '▲' : x.mult < 0.85 ? '▼' : '•'}${x.mult.toFixed(1)}</span>`).join('')}</div>
    <h3>Your fish at today's prices</h3>
    <div class="price-list">${state.fish.map((f) => ({ f, p: W.priceOf(f.code, now) })).sort((a, b) => b.p - a.p).map(({ f, p }) => `
      <div class="price-row">${thumb(f.code)}<button class="linkish" data-act="open-fish" data-fish="${f.id}">${esc(W.nameOf(f.code))}</button><button class="btn small sell" data-act="sell" data-fish="${f.id}" data-confirm="Sure? ${p}◎">${p}◎</button></div>`).join('') || '<p class="empty">Nothing to sell.</p>'}</div>
    <p class="note">Prices drift with colony demand. Check back: a crisis somewhere can double a price.</p>`;
}

function renderVault() {
  const items = W.vaultItems(state);
  $('#vaultBody').innerHTML = `
    <p class="note">Frozen roe from the Earth Ark Vault. Sorted roe thaws into a juvenile suited to that water.</p>
    <div class="vault">${items.map((i) => `<div class="item ${i.kind}">
      <div><b>${esc(i.name)}</b><small>${esc(i.note)}</small></div>
      <button class="btn" data-act="buy" data-item="${i.id}" ${state.credits < i.cost ? 'disabled' : ''}>${i.cost}◎</button>
    </div>`).join('')}</div>`;
}

function renderMirelle() {
  const next = W.PHASES[state.phase + 1];
  const fc = W.forecast(state.phase);
  planet.set(state.bloom / W.PHASES.at(-1).bloom);
  $('#mirelleBody').innerHTML = `
    <p class="eyebrow">Phase ${state.phase} · ${esc(W.PHASES[state.phase].name)}</p>
    <p class="note">${next ? `${next.bloom - state.bloom} bloom until <b>${esc(next.name)}</b>.` : 'Mirelle is a living world.'}</p>
    <div class="biomes">${W.BIOMES.map((b) => {
      const open = b.opens <= state.phase;
      return `<div class="biome ${open ? '' : 'locked'}" style="--biome:${b.color}"><span class="biome-icon">${open ? b.icon : '•'}</span>
        <div><b>${esc(b.name)}</b><small>${open ? `${esc(W.condWords(W.condOf(b, state.phase)))} · ${esc(b.blurb)}` : `Opens in phase ${b.opens}`}</small></div>
        <span class="bloom">${open ? `${state.biomeBloom[b.id] ?? 0}✿` : ''}</span></div>`;
    }).join('')}</div>
    ${fc.length ? `<div class="forecast"><b>PIP's forecast for ${esc(next.name)}</b><ul>${fc.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><small>Start breeding for it now.</small></div>` : ''}`;
}

function renderLog() {
  const now = Date.now();
  const ago = (t) => {
    const m = Math.floor((now - t) / 60000);
    return m < 1 ? 'now' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
  };
  $('#logBody').innerHTML = `<ol class="log">${state.log.map((l) => `<li><span class="li-icon">${esc(l.icon)}</span><p>${esc(l.text)}</p><time>${ago(l.t)}</time></li>`).join('')}</ol>`;
}

function timers() {
  const now = Date.now();
  for (const el of document.querySelectorAll('[data-until]')) el.textContent = mmss(Number(el.dataset.until) - now);
}

// --- boot ------------------------------------------------------------------------------------------------

planet = createPlanet($('#planet'));
renderHud();
renderTab();
hint();
for (const f of state.fish) sprites.prefetch(f.code);

if (!state.intro) {
  modal(`
    <p class="eyebrow">Incoming transmission · PIP</p>
    <h2>Morning, Doc!</h2>
    <p>Welcome aboard the orbital hatchery <b>Minnow</b>. Below us is <b>Mirelle</b>: oceans on the way, not a single fish in them.</p>
    <p>The colonies down there will ask for fish their new water needs. Breed them, drop them in seed pods, and watch the planet come alive.</p>
    <p>The planet keeps changing as it terraforms, so what they need today won't be what they need tomorrow. I'll keep you posted!</p>`,
  'Open the hatchery', () => {
    state.intro = true;
    save();
  });
}

let ticks = 0;
setInterval(() => {
  const ev = W.tick(state, Date.now());
  handle(ev);
  timers();
  ticks++;
  if (ticks % 5 === 0) save();
  if (ticks % 4 === 0 && ui.selected && !$('#sheet').hidden && !$('#sheet .armed')) renderSheet();
  if (ticks % 10 === 0 && ui.tab === 'exchange' && !$('#exchangeBody .armed')) renderTab();
  if (ticks % 3 === 0) renderHud();
}, 1000);
document.addEventListener('visibilitychange', () => document.hidden && save());
window.addEventListener('pagehide', save);

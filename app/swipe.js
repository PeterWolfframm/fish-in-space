// The swipe deck: one sprite at a time, playing its loop. Drag it right to approve, left to pass
// (or ♥ / ✕, or → / ←), up for notes. Every swipe is stored and teaches the personal model at once
// and the public model on the trainer's next round.
//
// Cards come from the pixelgen worker, rolled for the deck mode: Random is plain rolls; Public,
// Personal and Blend drop the weakest of a few rolls and render the rest in the style the model
// likes best (beautify), so the deck shows the procgen at its best without becoming one sprite.

import { GENERATORS, generator, fromCode } from '../src/gen/registry.js';
import { STYLE_IDS } from '../src/v2/kit/style.js';
import { hasStyle } from '../src/pixelgen/features.js';
import { call, addSwipe, removeSwipe, models, on, swipes } from './pixelgen.js';
import { online } from './auth.js';
import { Player, fitScale } from './sprites.js';

const $ = (id) => document.getElementById(id);
const READY = 4; // cards kept rolled ahead
const SHOWN = 3; // cards in the visible stack
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const MODES = [
  ['random', 'Random', 'Plain rolls'],
  ['public', 'Public', 'Rolled and styled for what everyone likes'],
  ['personal', 'Personal', 'Rolled and styled for your taste'],
  ['blend', 'Blend', 'Half and half'],
];
const LOOKS = [
  ['auto', 'Auto'],
  ['lit', 'Lit'],
  ['comic', 'Comic'],
  ['clean', 'Clean'],
];
// A short, one-tap list of common takes; chosen ones are merged into the free-text note on save.
const CANNED_NOTES = ['Love it', 'Too busy', 'Colors off', 'Looks broken', 'Not this kind', 'Needs more contrast'];

const prefs = (() => {
  try {
    return { kind: 'mix', mode: 'random', look: 'auto', compare: false, ...JSON.parse(localStorage.getItem('pixelgen.deck')) };
  } catch {
    return { kind: 'mix', mode: 'random', look: 'auto', compare: false };
  }
})();
const savePrefs = () => {
  try {
    localStorage.setItem('pixelgen.deck', JSON.stringify(prefs));
  } catch {}
};

const deck = {
  ready: [], // rolled cards waiting
  rolling: 0,
  epoch: 0, // bumps when the settings change, so late rolls are dropped
  stack: [], // card objects on screen, top first
  history: [], // {card, verdict, saved: Promise<record>}
  busy: false,
  active: false,
};

const randomSeed = () => Math.random().toString(36).slice(2, 8);
// Mix: every kind, the v2 remasters three times as often as the frozen originals.
const MIX = GENERATORS.flatMap((g) => (g.version === 2 ? [g.id, g.id, g.id] : [g.id]));
const FAMILIES = [...new Set(GENERATORS.map((g) => g.family))];
const familyFor = (kind) => (kind === 'mix' ? FAMILIES[Math.floor(Math.random() * FAMILIES.length)] : generator(kind)?.family ?? FAMILIES[0]);

// ---------- rolling ----------

async function rollOne() {
  if (prefs.compare) return rollCompare();
  const epoch = deck.epoch;
  deck.rolling++;
  try {
    const kind = prefs.kind === 'mix' ? MIX[Math.floor(Math.random() * MIX.length)] : prefs.kind;
    const r = await call('card', { kind, seed: randomSeed(), mode: prefs.mode, look: prefs.look });
    if (epoch === deck.epoch) deck.ready.push(r);
  } catch (e) {
    console.warn('pixelgen: rolling a card failed', e);
  } finally {
    deck.rolling--;
  }
  if (epoch === deck.epoch) fill();
}

/** One seed, every algorithm & look of a family, so the best-looking one can be picked directly. */
async function rollCompare() {
  const epoch = deck.epoch;
  deck.rolling++;
  try {
    const family = familyFor(prefs.kind);
    const seed = randomSeed();
    const gens = GENERATORS.filter((g) => g.family === family);
    // Every generator in the family. Styled ones (v2) also get lit, comic and clean.
    const jobs = gens.flatMap((g) => {
      if (!hasStyle(g)) return [{ kind: g.id, look: 'auto', label: g.label }];
      return LOOKS.filter(([id]) => id !== 'auto').map(([id, label]) => ({ kind: g.id, look: id, label: `${g.label} · ${label}` }));
    });
    const variants = await Promise.all(
      jobs.map(({ kind, look, label }) => call('card', { kind, seed, mode: 'random', look }).then((r) => ({ ...r, label }))),
    );
    if (epoch === deck.epoch) deck.ready.push({ compare: true, family, seed, variants });
  } catch (e) {
    console.warn('pixelgen: rolling a compare card failed', e);
  } finally {
    deck.rolling--;
  }
  if (epoch === deck.epoch) fill();
}

/** Keep the stack full and a few cards rolled ahead. */
function fill() {
  while (deck.stack.length < SHOWN && deck.ready.length) {
    const card = makeCard(deck.ready.shift());
    deck.stack.push(card);
    $('deck').prepend(card.el);
  }
  layout();
  if (deck.ready.length + deck.rolling < READY) rollOne();
  $('deckEmpty').hidden = deck.stack.length > 0;
}

function restart() {
  deck.epoch++;
  deck.ready = [];
  for (const c of deck.stack) c.el.remove(), c.player.stop();
  deck.stack = [];
  closeNotes();
  fill();
}

// ---------- cards ----------

const pct = (v) => (v == null ? '—' : String(Math.round(v * 100)));

function makeCard(r) {
  if (r.compare) return makeCompareCard(r);
  const gen = generator(r.kind);
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="card-art"><canvas></canvas></div>
    <span class="stamp like" aria-hidden="true">LIKE</span>
    <span class="stamp nope" aria-hidden="true">NOPE</span>
    <span class="note-badge" hidden>✎</span>
    <footer>
      <div class="card-title"><b></b><span></span></div>
      <p class="card-lore" hidden></p>
      <div class="bars">
        <div class="bar pub" title="What everyone's model thinks"><span>Public</span><i><s></s></i><em></em></div>
        <div class="bar you" title="What your model thinks"><span>You</span><i><s></s></i><em></em></div>
      </div>
    </footer>`;
  el.querySelector('.card-art').style.background = gen.bg;
  el.querySelector('.card-title b').textContent = gen.label;
  const style = gen.sizeField ? [r.genome[gen.sizeField], r.genome.look].filter(Boolean).join(' · ') : 'v1';
  el.querySelector('.card-title span').textContent = style;
  if (gen.name) {
    // Named creatures: the name leads, with one line from its codex entry under it.
    el.querySelector('.card-title b').textContent = gen.name(r.genome);
    const lore = gen.lore?.(r.genome);
    const line = el.querySelector('.card-lore');
    line.textContent = lore?.codex[0]?.text ?? '';
    line.hidden = !line.textContent;
    if (gen.signatureOf?.(r.genome).label) el.classList.add('signed');
  }
  el.title = `${r.kind} ${r.code}`;
  const player = new Player(el.querySelector('canvas'));
  const card = { ...r, gen, el, player, notes: { fix: new Set(), instead: {}, asKind: '', note: '', canned: new Set() } };
  showFrames(card, r.frames, r.fps);
  setScores(card, r.scores);
  drag(card);
  return card;
}

/** A card showing one seed rendered by every algorithm/look of a family: tap the best, then confirm. */
function makeCompareCard(r) {
  const el = document.createElement('article');
  el.className = 'card compare-card';
  el.innerHTML = `
    <p class="compare-hint">Tap the best-looking one, then swipe right (or ♥) to confirm it.</p>
    <div class="compare-grid"></div>
    <span class="stamp like" aria-hidden="true">PICK</span>
    <span class="stamp nope" aria-hidden="true">SKIP</span>`;
  const grid = el.querySelector('.compare-grid');
  const players = r.variants.map((v, i) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'compare-cell';
    cell.setAttribute('aria-pressed', 'false');
    cell.innerHTML = '<canvas></canvas><span class="compare-label"></span>';
    cell.querySelector('.compare-label').textContent = v.label;
    grid.append(cell);
    const player = new Player(cell.querySelector('canvas'));
    player.set(v.frames, v.fps, fitScale(v.frames[0], 160));
    player.play();
    cell.addEventListener('click', () => pickCompare(card, i));
    return { cell, player };
  });
  const card = {
    compare: true,
    kind: null,
    family: r.family,
    seed: r.seed,
    variants: r.variants,
    players,
    picked: -1,
    el,
    player: { play: () => players.forEach((p) => p.player.play()), stop: () => players.forEach((p) => p.player.stop()) },
    notes: { fix: new Set(), instead: {}, asKind: '', note: '', canned: new Set() },
  };
  drag(card);
  return card;
}

function pickCompare(card, i) {
  card.picked = i;
  card.players.forEach((p, idx) => p.cell.setAttribute('aria-pressed', String(idx === i)));
}

function showFrames(card, frames, fps) {
  card.player.set(frames, fps, fitScale(frames[0], 320));
  if (card === deck.stack[0] || !deck.stack.length) card.player.play();
}

function setScores(card, s) {
  card.scores = s;
  for (const [cls, v] of [['pub', s.public], ['you', s.personal]]) {
    const bar = card.el.querySelector(`.bar.${cls}`);
    bar.style.setProperty('--v', v ?? 0);
    bar.classList.toggle('none', v == null);
    bar.querySelector('em').textContent = pct(v);
  }
}

/** Fan the stack: the top card in front, the next ones smaller and lower behind it. */
function layout() {
  deck.stack.forEach((c, i) => {
    c.el.style.setProperty('--depth', i);
    c.el.style.zIndex = String(10 - i);
    c.el.classList.toggle('top', i === 0);
    c.el.setAttribute('aria-hidden', String(i !== 0));
    if (i === 0) c.player.play();
    else c.player.stop();
  });
  const top = deck.stack[0];
  for (const id of ['nope', 'like']) $(id).disabled = !top;
  $('noteBtn').disabled = !top || top.compare;
  $('undo').disabled = !deck.history.length;
}

// ---------- dragging and flinging ----------

const THROW = 110; // px past which a release decides
const FLICK = 0.55; // px/ms that decides however short the drag

function drag(card) {
  const { el } = card;
  let start = null;
  let trail = [];
  const at = (e) => ({ x: e.clientX - start.x, y: e.clientY - start.y, t: e.timeStamp });
  el.addEventListener('pointerdown', (e) => {
    if (card !== deck.stack[0] || deck.busy || e.button) return;
    el.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY };
    trail = [{ x: 0, y: 0, t: e.timeStamp }];
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!start) return;
    const p = at(e);
    trail.push(p);
    if (trail.length > 6) trail.shift();
    pose(card, p.x, p.y);
  });
  const release = (e) => {
    if (!start) return;
    const p = at(e);
    const old = trail.find((q) => p.t - q.t < 120) ?? trail[0];
    const dt = Math.max(1, p.t - old.t);
    const v = { x: (p.x - old.x) / dt, y: (p.y - old.y) / dt };
    start = null;
    el.classList.remove('dragging');
    if (p.x > THROW || (v.x > FLICK && p.x > 20)) decide('approve', { ...p, v });
    else if (p.x < -THROW || (v.x < -FLICK && p.x < -20)) decide('pass', { ...p, v });
    else if (p.y < -THROW && Math.abs(p.x) < THROW) springBack(card), openNotes();
    else springBack(card);
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
}

/** The card under the finger: tilted toward the way it is going, its stamp fading in. */
function pose(card, x, y) {
  card.el.style.transform = `translate(${x}px, ${y}px) rotate(${x / 16}deg)`;
  card.el.style.setProperty('--like', Math.max(0, Math.min(1, x / THROW)));
  card.el.style.setProperty('--nope', Math.max(0, Math.min(1, -x / THROW)));
}

function springBack(card) {
  card.el.classList.add('spring');
  card.el.style.transform = '';
  card.el.style.setProperty('--like', 0);
  card.el.style.setProperty('--nope', 0);
  setTimeout(() => card.el.classList.remove('spring'), 600);
}

const after = (el, ms) => new Promise((r) => setTimeout(r, ms));

/** Throw the top card off to one side, carrying the release's speed. */
async function flingOut(card, dir, from = { x: 0, y: 0, v: { x: 0, y: 0 } }) {
  const { el } = card;
  el.classList.add('flying');
  el.style.setProperty(dir > 0 ? '--like' : '--nope', 1);
  if (reduced.matches) {
    el.style.opacity = '0';
    return after(el, 200);
  }
  if (!from.x) {
    // A button or key: a little wind-up before the throw.
    pose(card, dir * 24, -6);
    await after(el, 90);
  }
  const w = innerWidth / 2 + el.offsetWidth;
  const y = from.y + from.v.y * 220;
  const spin = dir * (22 + Math.min(20, Math.abs(from.v.x) * 12));
  el.style.transform = `translate(${dir * w}px, ${y}px) rotate(${spin}deg)`;
  el.style.opacity = '0';
  return after(el, 420);
}

/** Swipe the top card: store it, throw it out, bring the next up. */
async function decide(verdict, from) {
  const card = deck.stack[0];
  if (!card || deck.busy) return;
  if (card.compare) {
    if (verdict === 'approve') {
      if (card.picked < 0) return springBack(card), toast('Tap a variant first');
      return confirmCompare(card, from);
    }
    return skipCompare(card, from);
  }
  deck.busy = true;
  const n = card.notes;
  const note = [[...n.canned].join(', '), n.note.trim()].filter(Boolean).join(' — ');
  const record = {
    kind: card.kind,
    code: card.code,
    seed: card.seed,
    verdict,
    fix: [...n.fix],
    instead: n.instead,
    asKind: n.asKind,
    note,
    scores: card.scores,
    mode: prefs.mode,
  };
  const saved = addSwipe(record);
  saved.catch((e) => toast(`Not saved: ${e.message}`));
  deck.history.push({ card, verdict, saved });
  if (deck.history.length > 20) deck.history.shift();
  closeNotes();
  // the pre-notes frames, if an "instead" preview was showing
  if (card.original) showFrames(card, ...card.original);
  deck.stack.shift();
  card.player.stop();
  layout();
  await flingOut(card, verdict === 'approve' ? 1 : -1, from);
  card.el.remove();
  deck.busy = false;
  fill();
  layout();
}

/** Confirm the tapped-best variant: approve it, pass the rest, so the models get a direct A/B signal. */
async function confirmCompare(card, from) {
  deck.busy = true;
  const savedList = card.variants.map((v, i) =>
    addSwipe({
      kind: v.kind,
      code: v.code,
      seed: v.seed,
      verdict: i === card.picked ? 'approve' : 'pass',
      fix: [],
      instead: {},
      asKind: '',
      note: '',
      scores: v.scores,
      mode: 'compare',
    }),
  );
  savedList[card.picked].catch((e) => toast(`Not saved: ${e.message}`));
  deck.history.push({ card, verdict: 'compare', savedList });
  if (deck.history.length > 20) deck.history.shift();
  deck.stack.shift();
  card.player.stop();
  layout();
  await flingOut(card, 1, from);
  card.el.remove();
  deck.busy = false;
  fill();
  layout();
}

/** Skip a compare card without recording anything. */
async function skipCompare(card, from) {
  deck.busy = true;
  deck.stack.shift();
  card.player.stop();
  layout();
  await flingOut(card, -1, from);
  card.el.remove();
  deck.busy = false;
  fill();
  layout();
}

/** Bring the last swiped card back and forget its swipe. */
async function undo() {
  const last = deck.history.pop();
  if (!last || deck.busy) return;
  deck.busy = true;
  if (last.savedList) {
    const recs = await Promise.all(last.savedList.map((p) => p.catch(() => null)));
    await Promise.all(recs.filter(Boolean).map((rec) => removeSwipe(rec.id).catch((e) => toast(`Undo failed: ${e.message}`))));
  } else {
    const rec = await last.saved.catch(() => null);
    if (rec) await removeSwipe(rec.id).catch((e) => toast(`Undo failed: ${e.message}`));
  }
  const { card } = last;
  const { el } = card;
  el.className = card.compare ? 'card compare-card' : 'card';
  el.style.opacity = '';
  el.style.setProperty('--like', 0);
  el.style.setProperty('--nope', 0);
  if (card.compare) card.players.forEach((p, idx) => p.cell.setAttribute('aria-pressed', String(idx === card.picked)));
  deck.stack.unshift(card);
  $('deck').append(el);
  // drop the bottom card back into the waiting pile
  if (deck.stack.length > SHOWN) {
    const extra = deck.stack.pop();
    extra.el.remove();
    extra.player.stop();
    deck.ready.unshift(extra);
  }
  const dir = last.verdict === 'pass' ? -1 : 1;
  if (!reduced.matches) {
    el.style.transform = `translate(${dir * (innerWidth / 2 + el.offsetWidth)}px, -40px) rotate(${dir * 30}deg)`;
    el.getBoundingClientRect(); // commit the start before animating back
    el.classList.add('spring');
  }
  el.style.transform = '';
  layout();
  await after(el, 500);
  el.classList.remove('spring');
  deck.busy = false;
}

// ---------- notes ----------

const notesOpen = () => !$('notes').hidden;

function openNotes() {
  const card = deck.stack[0];
  if (!card) return;
  const sheet = $('notes');
  const { gen, notes } = card;
  const genome = fromCode(gen, card.code);
  const groups = new Map();
  for (const f of gen.traits.fields) {
    const g = STYLE_IDS.includes(f.id) ? 'style' : (f.group ?? 'traits');
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(f);
  }
  const families = [...new Set(GENERATORS.map((g) => g.family))].filter((f) => f !== gen.family);
  const famLabel = (f) => GENERATORS.find((g) => g.family === f && g.version === 2)?.label.replace(/ v2$/, '') ?? f;
  sheet.innerHTML = `
    <header><h2>What would make it better?</h2><button class="btn ghost" data-close type="button" aria-label="Close notes">✕</button></header>
    <p class="hint">Flag what's off, and pick what it should be instead to preview it.</p>
    <div class="note-group canned-group"><h3>Quick take</h3><div class="chips">${CANNED_NOTES.map((c) => `<button type="button" class="chip" data-canned="${c}" aria-pressed="${notes.canned.has(c)}">${c}</button>`).join('')}</div></div>
    <div class="note-groups">${[...groups]
      .map(
        ([g, fields]) => `<div class="note-group"><h3>${g}</h3><div class="chips">${fields
          .map((f) => {
            const on = notes.fix.has(f.id);
            const opts = f.choices.filter((c) => c.id !== genome[f.id]).map((c) => `<option value="${c.id}" ${notes.instead[f.id] === c.id ? 'selected' : ''}>${c.label ?? c.id}</option>`).join('');
            return `<span class="chip-wrap"><button type="button" class="chip" data-field="${f.id}" aria-pressed="${on}">${f.label ?? f.id}</button>${on ? `<select data-instead="${f.id}" aria-label="${f.label ?? f.id} instead"><option value="">instead…</option>${opts}</select>` : ''}</span>`;
          })
          .join('')}</div></div>`,
      )
      .join('')}</div>
    <label class="note-row">Looks more like a <select data-askind><option value="">—</option>${families.map((f) => `<option value="${f}" ${notes.asKind === f ? 'selected' : ''}>${famLabel(f)}</option>`).join('')}</select></label>
    <textarea data-note rows="2" placeholder="Anything else? Stored with the swipe.">${notes.note.replace(/</g, '&lt;')}</textarea>
    <footer><button class="btn nope-btn" data-verdict="pass" type="button">✕ Pass</button><button class="btn like-btn" data-verdict="approve" type="button">♥ Like</button></footer>`;
  sheet.hidden = false;
  sheet.parentElement.classList.add('noting');
  requestAnimationFrame(() => sheet.classList.add('open'));
  $('noteBtn').setAttribute('aria-expanded', 'true');
}

function closeNotes() {
  const sheet = $('notes');
  if (sheet.hidden) return;
  sheet.classList.remove('open');
  sheet.parentElement.classList.remove('noting');
  $('noteBtn').setAttribute('aria-expanded', 'false');
  const card = deck.stack[0];
  if (card) markNotes(card);
  setTimeout(() => {
    if (!sheet.classList.contains('open')) sheet.hidden = true;
  }, reduced.matches ? 0 : 260);
}

function markNotes(card) {
  const n = card.notes;
  const count = n.fix.size + n.canned.size + (n.asKind ? 1 : 0) + (n.note.trim() ? 1 : 0);
  const badge = card.el.querySelector('.note-badge');
  badge.hidden = !count;
  badge.textContent = `✎ ${count}`;
}

/** Show the top card as it would look with its "instead" picks, or as rolled without any. */
async function previewInstead(card) {
  const picks = Object.entries(card.notes.instead).filter(([, v]) => v);
  card.original ??= [card.frames, card.fps];
  if (!picks.length) return showFrames(card, ...card.original);
  const genome = fromCode(card.gen, card.code);
  const alt = { ...genome, ...Object.fromEntries(picks) };
  const r = await call('frames', { kind: card.kind, code: card.gen.traits.encode(card.gen.normalize ? card.gen.normalize(alt) : alt) });
  if (r && deck.stack[0] === card) showFrames(card, r.frames, r.fps);
}

function wireNotes() {
  const sheet = $('notes');
  sheet.addEventListener('click', (e) => {
    const card = deck.stack[0];
    if (!card) return;
    if (e.target.closest('[data-close]')) return closeNotes();
    const v = e.target.closest('[data-verdict]');
    if (v) return decide(v.dataset.verdict);
    const canned = e.target.closest('[data-canned]');
    if (canned) {
      const text = canned.dataset.canned;
      if (card.notes.canned.has(text)) card.notes.canned.delete(text);
      else card.notes.canned.add(text);
      canned.setAttribute('aria-pressed', String(card.notes.canned.has(text)));
      return;
    }
    const chip = e.target.closest('[data-field]');
    if (chip) {
      const id = chip.dataset.field;
      if (card.notes.fix.has(id)) {
        card.notes.fix.delete(id);
        delete card.notes.instead[id];
        previewInstead(card);
      } else card.notes.fix.add(id);
      const scroll = sheet.querySelector('.note-groups').scrollTop;
      openNotes();
      sheet.querySelector('.note-groups').scrollTop = scroll;
      sheet.querySelector(`[data-instead="${id}"]`)?.focus();
    }
  });
  sheet.addEventListener('change', (e) => {
    const card = deck.stack[0];
    if (!card) return;
    if (e.target.dataset.instead) {
      card.notes.instead[e.target.dataset.instead] = e.target.value;
      if (!e.target.value) delete card.notes.instead[e.target.dataset.instead];
      previewInstead(card);
    }
    if ('askind' in e.target.dataset) card.notes.asKind = e.target.value;
  });
  sheet.addEventListener('input', (e) => {
    if ('note' in e.target.dataset && deck.stack[0]) deck.stack[0].notes.note = e.target.value;
  });
  // Keep the textarea above the on-screen keyboard on phones.
  sheet.addEventListener('focusin', (e) => {
    if (e.target.matches('[data-note]')) setTimeout(() => e.target.scrollIntoView({ block: 'nearest' }), 80);
  });
}

// ---------- controls and status ----------

function toast(text) {
  const t = $('deckToast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function seg(box, options, value, onPick) {
  box.replaceChildren(
    ...options.map(([id, label, title]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (title) b.title = title;
      b.setAttribute('aria-pressed', String(id === value));
      b.addEventListener('click', () => {
        for (const x of box.children) x.setAttribute('aria-pressed', String(x === b));
        onPick(id);
      });
      return b;
    }),
  );
}

function status() {
  const p = models.public;
  const m = models.personal;
  const n = swipes().length;
  const liked = swipes().filter((s) => s.verdict === 'approve').length;
  const parts = [];
  parts.push(online ? (p ? `Public model: ${p.swipes} swipes from ${p.users} ${p.users === 1 ? 'person' : 'people'}${p.accuracy != null ? `, ${Math.round(p.accuracy * 100)}% right on held-out swipes` : ''}` : 'Public model: waiting for swipes') : 'Offline: swipes stay in this browser');
  parts.push(`You: ${n} swipes, ${liked} liked${m ? ' · your model is trained' : n ? ' · your model trains after 2 swipes' : ''}`);
  $('deckStatus').textContent = parts.join('  ·  ');
  // Modes that need a model say so.
  const [, pub, per, blend] = $('deckMode').children;
  pub.classList.toggle('dim', !p);
  per.classList.toggle('dim', !m && !p);
  blend.classList.toggle('dim', !p || !m);
}

/** New scores on the cards in view, after a model changed. Compare cards show no bars, so skip them. */
async function rescore() {
  for (const card of deck.stack) if (!card.compare) setScores(card, await call('score', { kind: card.kind, code: card.code }));
  // waiting cards get scored when they come up
  for (const r of deck.ready) if (!r.compare) r.scores = await call('score', { kind: r.kind, code: r.code });
}

/** A one-line readout of the current filters, shown next to the Filters button when it's closed. */
function summarize() {
  const kindLabel = prefs.kind === 'mix' ? 'Mix of everything' : generator(prefs.kind)?.label ?? prefs.kind;
  const bits = prefs.compare ? [kindLabel, 'Compare'] : [kindLabel, MODES.find((m) => m[0] === prefs.mode)?.[1], LOOKS.find((l) => l[0] === prefs.look)?.[1]];
  $('deckSummary').textContent = bits.filter(Boolean).join(' · ');
}

const filtersOpen = () => !$('filterSheet').hidden;

function openFilters() {
  $('filterSheet').hidden = false;
  $('filterBackdrop').hidden = false;
  requestAnimationFrame(() => {
    $('filterSheet').classList.add('open');
    $('filterBackdrop').classList.add('open');
  });
  $('filterBtn').setAttribute('aria-expanded', 'true');
}

function closeFilters() {
  const sheet = $('filterSheet');
  if (sheet.hidden) return;
  sheet.classList.remove('open');
  $('filterBackdrop').classList.remove('open');
  $('filterBtn').setAttribute('aria-expanded', 'false');
  setTimeout(() => {
    if (!sheet.classList.contains('open')) (sheet.hidden = true), ($('filterBackdrop').hidden = true);
  }, reduced.matches ? 0 : 220);
}

export function mountSwipe() {
  const kinds = $('deckKind');
  kinds.replaceChildren(new Option('Mix of everything', 'mix'), ...GENERATORS.map((g) => new Option(`${g.label}${g.version === 1 ? ' (v1)' : ''}`, g.id)));
  kinds.value = prefs.kind;
  kinds.addEventListener('change', () => {
    prefs.kind = kinds.value;
    savePrefs();
    summarize();
    restart();
  });
  seg($('deckMode'), MODES, prefs.mode, (id) => {
    prefs.mode = id;
    savePrefs();
    summarize();
    restart();
  });
  seg($('deckLook'), LOOKS, prefs.look, (id) => {
    prefs.look = id;
    savePrefs();
    summarize();
    restart();
  });
  const compareBox = $('deckCompare');
  compareBox.checked = prefs.compare;
  const setCompareUI = (on) => {
    $('deckMode').closest('.filter-row').classList.toggle('dim', on);
    $('deckLook').closest('.filter-row').classList.toggle('dim', on);
  };
  setCompareUI(prefs.compare);
  compareBox.addEventListener('change', () => {
    prefs.compare = compareBox.checked;
    savePrefs();
    summarize();
    setCompareUI(prefs.compare);
    restart();
  });
  $('filterBtn').addEventListener('click', () => (filtersOpen() ? closeFilters() : openFilters()));
  $('filterClose').addEventListener('click', closeFilters);
  $('filterBackdrop').addEventListener('click', closeFilters);
  $('nope').addEventListener('click', () => decide('pass'));
  $('like').addEventListener('click', () => decide('approve'));
  $('undo').addEventListener('click', undo);
  $('noteBtn').addEventListener('click', () => (notesOpen() ? closeNotes() : openNotes()));
  wireNotes();
  document.addEventListener('keydown', (e) => {
    if (!deck.active || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') return filtersOpen() ? closeFilters() : closeNotes();
    if (e.target.closest?.('input, select, textarea')) return;
    const act = { ArrowLeft: () => decide('pass'), ArrowRight: () => decide('approve'), n: () => (notesOpen() ? closeNotes() : openNotes()), u: undo }[e.key];
    if (act) {
      e.preventDefault();
      act();
    }
  });
  let lastModels = '';
  on('models', () => {
    status();
    const key = `${models.public?.trainedAt}|${models.personal?.trainedAt}`;
    if (key !== lastModels) (lastModels = key), rescore();
  });
  on('swipes', status);
  summarize();
  status();
}

/** The Swipe tab became visible (or hidden). */
export function showSwipe(visible) {
  deck.active = visible;
  if (visible && !deck.stack.length && !deck.rolling) fill();
  for (const c of deck.stack) visible && c === deck.stack[0] ? c.player.play() : c.player.stop();
}

// Matchmaker: two catches of the same generator, one child, kept locally in the bucket.

import { generator, fromCode, breedWith } from '../src/gen/registry.js';
import { on } from './pixelgen.js';
import { thumb } from './sprites.js';
import { describeCatch } from './catch.js';
import { flat, addLocal, onTiers } from './tiers.js';
import { say } from './toast.js';

const $ = (id) => document.getElementById(id);
const keyOf = (e) => `${e.kind}|${e.code}`;

let visible = false;
let breedA = null;
let breedB = null;
let baby = null;

const same = (a, b) => a && b && a.kind === b.kind && a.code === b.code;

function singles() {
  const seen = new Set();
  const list = [];
  for (const e of flat()) {
    const k = keyOf(e);
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(e);
  }
  return list;
}

function slot(entry, hint, { babySlot = false } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'breed-slot';
  if (babySlot && entry) b.classList.add('baby');
  if (entry) {
    const art = thumb(entry.kind, entry.code, 120);
    art.style.background = 'transparent';
    b.append(art);
    b.title = describeCatch(entry.kind, entry.code).name;
    if (!babySlot) b.addEventListener('click', () => clearSlot(hint));
  } else {
    const span = document.createElement('span');
    span.textContent = hint;
    b.append(span);
  }
  return b;
}

function clearSlot(hint) {
  if (hint === 'Fish A') breedA = null;
  if (hint === 'Fish B') breedB = null;
  baby = null;
  render();
}

function op(symbol) {
  const s = document.createElement('div');
  s.className = 'breed-op';
  s.textContent = symbol;
  return s;
}

function renderBaby() {
  const card = $('babyCard');
  card.hidden = !baby;
  $('keepBaby').hidden = !baby;
  if (!baby) return;
  const profile = describeCatch(baby.kind, baby.code);
  card.replaceChildren();
  const kicker = document.createElement('div');
  kicker.className = 'kicker';
  kicker.textContent = "It's a fish!";
  const name = document.createElement('div');
  name.className = 'baby-name';
  name.textContent = profile.name;
  const sub = document.createElement('div');
  sub.className = 'profile-sub';
  sub.textContent = profile.sub;
  card.append(kicker, name, sub, ...profile.bio.slice(0, 2).map((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    return p;
  }));
}

function render() {
  if (!visible) return;
  const list = singles();
  $('breedSlots').replaceChildren(
    slot(breedA, 'Fish A'),
    op('+'),
    slot(breedB, 'Fish B'),
    op('='),
    slot(baby, '?', { babySlot: true }),
  );
  const ready = breedA && breedB;
  const go = $('doBreed');
  go.textContent = baby ? 'Again, but weirder' : ready ? 'Make it happen' : 'Pick two fish';
  go.classList.toggle('ready', !!ready);
  go.disabled = false;
  $('singleCount').textContent = String(list.length);
  const grid = $('singles');
  grid.replaceChildren(...list.map((e) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'single';
    const picked = same(e, breedA) || same(e, breedB);
    b.classList.toggle('picked', picked);
    b.title = describeCatch(e.kind, e.code).name;
    const art = thumb(e.kind, e.code, 72);
    art.style.background = 'transparent';
    b.append(art);
    b.addEventListener('click', () => pick(e));
    return b;
  }));
  renderBaby();
}

function pick(e) {
  if (same(e, breedA)) breedA = null;
  else if (same(e, breedB)) breedB = null;
  else if (!breedA) breedA = { kind: e.kind, code: e.code };
  else breedB = { kind: e.kind, code: e.code };
  baby = null;
  render();
}

function doBreed() {
  if (!breedA || !breedB) return say('It takes two.');
  if (breedA.kind !== breedB.kind) return say('They just want to be friends.');
  const gen = generator(breedA.kind);
  const a = gen && fromCode(gen, breedA.code);
  const b = gen && fromCode(gen, breedB.code);
  if (!gen || !a || !b) return say('They just want to be friends.');
  try {
    const seed = Math.random().toString(36).slice(2, 8);
    const child = breedWith(gen, a, b, seed);
    const code = gen.traits.encode(child);
    if (!code) throw new Error('no code');
    baby = { kind: gen.id, code };
    say("It's a fish!");
    render();
  } catch {
    say('They just want to be friends.');
  }
}

function keep() {
  if (!baby) return;
  addLocal(baby.kind, baby.code);
  breedA = null;
  breedB = null;
  baby = null;
  say('Welcome to the bucket.');
  render();
}

export function mountBreed() {
  $('doBreed').addEventListener('click', doBreed);
  $('keepBaby').addEventListener('click', keep);
  on('swipes', () => { if (visible) render(); });
  onTiers(() => { if (visible) render(); });
}

export function showBreed(v) {
  visible = v;
  if (v) render();
}

// My likes: every sprite this user approved, newest first. Hover to play, open one in the Forge,
// download it, or take the like back (which also unteaches it to the models).

import { generator, fromCode } from '../src/gen/registry.js';
import { toSheet } from '../src/pixel/blit.js';
import { swipes, removeSwipe, on } from './pixelgen.js';
import { thumb, canvasOf } from './sprites.js';

const $ = (id) => document.getElementById(id);
let filter = 'all';
let visible = false;
let dirty = true;

function render() {
  if (!visible) return void (dirty = true);
  dirty = false;
  const liked = swipes()
    .filter((s) => s.verdict === 'approve')
    .reverse();
  const kinds = [...new Set(liked.map((s) => s.kind))];
  if (filter !== 'all' && !kinds.includes(filter)) filter = 'all';
  $('likeKinds').replaceChildren(
    ...[['all', `All ${liked.length}`], ...kinds.map((k) => [k, `${generator(k)?.label ?? k} ${liked.filter((s) => s.kind === k).length}`])].map(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-pressed', String(id === filter));
      b.addEventListener('click', () => {
        filter = id;
        render();
      });
      return b;
    }),
  );
  const shown = liked.filter((s) => filter === 'all' || s.kind === filter);
  $('likesEmpty').hidden = shown.length > 0;
  $('likeGrid').replaceChildren(...shown.map(cell));
}

function cell(s) {
  const box = document.createElement('figure');
  box.className = 'like-cell';
  box.append(thumb(s.kind, s.code, 120));
  const cap = document.createElement('figcaption');
  cap.innerHTML = `<span>${generator(s.kind)?.label ?? s.kind}</span>
    <span class="like-acts">
      <button type="button" class="icon" data-act="open" title="Open in Forge">⚒</button>
      <button type="button" class="icon" data-act="png" title="Download the loop as a sheet">⤓</button>
      <button type="button" class="icon" data-act="remove" title="Remove from likes">✕</button>
    </span>`;
  box.append(cap);
  box.title = `${s.code}${s.note ? `\n“${s.note}”` : ''}`;
  cap.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'open') location.hash = `${s.kind}/${s.code}`;
    if (act === 'png') download(s);
    if (act === 'remove') {
      box.classList.add('leaving');
      await removeSwipe(s.id);
    }
  });
  return box;
}

function download(s) {
  const gen = generator(s.kind);
  const genome = gen && fromCode(gen, s.code);
  if (!genome) return;
  const anim = gen.anims.find((a) => a.id === 'wind') ?? gen.anims[0];
  const frames = Array.from({ length: anim.frames }, (_, i) => gen.frame(genome, anim.id, i));
  canvasOf(toSheet(frames), 4).toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.kind}-${s.code}-${anim.id}-sheet.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}

export function mountLikes() {
  on('swipes', render);
}

export function showLikes(v) {
  visible = v;
  if (v && dirty) render();
}

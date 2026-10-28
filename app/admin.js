// Admin: everyone's swipes (PocketBase lets the admin list them all), who swiped how much, and
// the public model: when it was trained, how well it does on held-out swipes, what drives it.
// The admin can also retrain the public model here instead of waiting for the trainer.

import { generator } from '../src/gen/registry.js';
import { swipesToTxt } from '../src/pixelgen/swipes-txt.js';
import { pb, isAdmin } from './auth.js';
import { retrainPublic, publicRecord, on } from './pixelgen.js';
import { thumb } from './sprites.js';

const $ = (id) => document.getElementById(id);
const PAGE = 150;
let all = [];
let users = new Map();
let shown = PAGE;
let loaded = false;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nameOf = (id) => {
  const u = users.get(id);
  return u ? (u.guest ? `${u.name || 'guest'} (guest)` : u.name || u.email) : id;
};
const when = (iso) => new Date(iso.replace(' ', 'T')).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

async function load() {
  $('adminStatus').textContent = 'Loading…';
  const [swipes, us] = await Promise.all([pb.collection('swipes').getFullList({ sort: '-created', batch: 500 }), pb.collection('users').getFullList({ batch: 500, fields: 'id,name,email,guest,role,created' })]);
  all = swipes;
  users = new Map(us.map((u) => [u.id, u]));
  loaded = true;
  fillFilters();
  renderTable();
  renderPeople();
  renderModel();
}

function fillFilters() {
  const keep = (sel, opts) => {
    const v = sel.value;
    sel.replaceChildren(new Option('all', ''), ...opts.map(([id, label]) => new Option(label, id)));
    sel.value = opts.some(([id]) => id === v) ? v : '';
  };
  const counts = new Map();
  for (const s of all) counts.set(s.user, (counts.get(s.user) ?? 0) + 1);
  keep($('fUser'), [...counts].sort((a, b) => b[1] - a[1]).map(([id, n]) => [id, `${nameOf(id)} · ${n}`]));
  keep($('fKind'), [...new Set(all.map((s) => s.kind))].map((k) => [k, generator(k)?.label ?? k]));
}

const filtered = () => {
  const u = $('fUser').value;
  const k = $('fKind').value;
  const v = $('fVerdict').value;
  const notes = $('fNotes').checked;
  return all.filter((s) => (!u || s.user === u) && (!k || s.kind === k) && (!v || s.verdict === v) && (!notes || s.fix?.length || s.note || s.asKind || Object.keys(s.instead ?? {}).length));
};

function renderTable() {
  const rows = filtered();
  $('adminCount').textContent = `${rows.length} of ${all.length} swipes`;
  const body = $('adminRows');
  body.replaceChildren(
    ...rows.slice(0, shown).map((s) => {
      const tr = document.createElement('tr');
      const instead = Object.entries(s.instead ?? {});
      tr.innerHTML = `<td class="t"></td>
        <td><span class="verdict ${s.verdict}">${s.verdict === 'approve' ? '♥' : '✕'}</span></td>
        <td>${esc(nameOf(s.user))}</td>
        <td>${esc(generator(s.kind)?.label ?? s.kind)}<br><code>${esc(s.code)}</code></td>
        <td>${(s.fix ?? []).map((f) => `<span class="mini-chip">${esc(f)}${s.instead?.[f] ? ` → ${esc(s.instead[f])}` : ''}</span>`).join('')}${instead
          .filter(([f]) => !(s.fix ?? []).includes(f))
          .map(([f, c]) => `<span class="mini-chip">${esc(f)} → ${esc(c)}</span>`)
          .join('')}${s.asKind ? `<span class="mini-chip alt">looks like ${esc(s.asKind)}</span>` : ''}${s.note ? `<div class="note">“${esc(s.note)}”</div>` : ''}</td>
        <td class="num">${s.scores?.public != null ? Math.round(s.scores.public * 100) : '—'} / ${s.scores?.personal != null ? Math.round(s.scores.personal * 100) : '—'}<br><small>${esc(s.mode ?? '')}</small></td>
        <td><small>${when(s.created)}</small></td>`;
      tr.querySelector('.t').append(thumb(s.kind, s.code, 56));
      return tr;
    }),
  );
  $('adminMore').hidden = rows.length <= shown;
}

function renderPeople() {
  const per = new Map();
  for (const s of all) {
    const p = per.get(s.user) ?? { n: 0, liked: 0, notes: 0, last: '' };
    p.n++;
    if (s.verdict === 'approve') p.liked++;
    if (s.fix?.length || s.note) p.notes++;
    if (s.created > p.last) p.last = s.created;
    per.set(s.user, p);
  }
  $('adminPeople').innerHTML = [...per]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([id, p]) => `<li><b>${esc(nameOf(id))}${users.get(id)?.role === 'admin' ? ' ★' : ''}</b><span>${p.n} swipes · ${Math.round((p.liked / p.n) * 100)}% liked · ${p.notes} with notes · last ${when(p.last)}</span></li>`)
    .join('') || '<li>No swipes yet.</li>';
}

async function renderModel() {
  const rec = await publicRecord();
  const box = $('adminModel');
  if (!rec) return void (box.innerHTML = '<p>No public model yet: it trains once there are 6 swipes.</p>');
  const s = rec.stats ?? {};
  const list = (xs) => (xs ?? []).map((e) => `<li>${esc(e.label)} <small>${e.delta > 0 ? '+' : ''}${(e.delta * 100).toFixed(1)}</small></li>`).join('') || '<li>—</li>';
  box.innerHTML = `
    <dl>
      <dt>Trained</dt><dd>${when(rec.trainedAt)}</dd>
      <dt>On</dt><dd>${s.swipes} swipes from ${s.users} ${s.users === 1 ? 'person' : 'people'} (${s.rows} training rows, counting “instead” picks)</dd>
      <dt>Approve rate</dt><dd>${Math.round((s.approveRate ?? 0) * 100)}%</dd>
      <dt>Held-out</dt><dd>${s.accuracy != null ? `${Math.round(s.accuracy * 100)}% right (5-fold)` : 'needs 40 swipes'}</dd>
    </dl>
    <div class="insights"><div><h3>Raises the score</h3><ol>${list(s.insights?.up)}</ol></div><div><h3>Lowers it</h3><ol>${list(s.insights?.down)}</ol></div></div>`;
}

function download(name, body, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function csv() {
  const cols = ['created', 'user', 'name', 'kind', 'code', 'verdict', 'fix', 'instead', 'asKind', 'note', 'public', 'personal', 'mode'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = filtered().map((s) => [s.created, s.user, nameOf(s.user), s.kind, s.code, s.verdict, (s.fix ?? []).join(' '), JSON.stringify(s.instead ?? {}), s.asKind, s.note, s.scores?.public, s.scores?.personal, s.mode].map(cell).join(','));
  download(`pixelgen-swipes-${new Date().toISOString().slice(0, 10)}.csv`, [cols.join(','), ...lines].join('\n'), 'text/csv');
}

function txt() {
  download(`pixelgen-swipes-${new Date().toISOString().slice(0, 10)}.txt`, swipesToTxt(filtered(), { nameOf }), 'text/plain');
}

export function mountAdmin() {
  for (const id of ['fUser', 'fKind', 'fVerdict', 'fNotes'])
    $(id).addEventListener('change', () => {
      shown = PAGE;
      renderTable();
    });
  $('adminMore').addEventListener('click', () => {
    shown += PAGE;
    renderTable();
  });
  $('adminReload').addEventListener('click', load);
  $('adminCsv').addEventListener('click', csv);
  $('adminTxt').addEventListener('click', txt);
  $('adminRetrain').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    $('adminStatus').textContent = 'Training on everyone’s swipes…';
    try {
      await load();
      const t = performance.now();
      const stats = await retrainPublic([...all].reverse());
      $('adminStatus').textContent = stats ? `Trained in ${Math.round(performance.now() - t)} ms.` : 'Nothing to learn from yet.';
      renderModel();
    } catch (err) {
      $('adminStatus').textContent = `Retrain failed: ${err.message}`;
    } finally {
      b.disabled = false;
    }
  });
  on('models', () => loaded && isAdmin() && renderModel());
}

export async function showAdmin(v) {
  if (!v || !isAdmin()) return;
  try {
    await load();
    $('adminStatus').textContent = '';
  } catch (e) {
    $('adminStatus').textContent = `Couldn't load: ${e.message}`;
  }
}

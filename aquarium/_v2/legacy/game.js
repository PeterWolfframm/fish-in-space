import { generator } from '../../src/gen/registry.js';
import { toCanvas } from '../../src/pixel/blit.js';

const fishGen = generator('fish3');
const SAVE_KEY = 'living-archive-save-v1';
const sites = [
  { id: 'morrow', name: 'Morrow Basin', kind: 'ESTUARY', tag: 'BRACKISH · GENTLE CURRENT', water: 'brackish water', note: 'The basin is still cloudy after the long dry years. But something small is schooling near the reeds. I left the intake gate open. Let’s see who finds us.', mood: 'A few curious faces in the current', colors: ['#164751', '#0d3840', '#8e9d69'] },
  { id: 'glasslake', name: 'Glass Lake', kind: 'UPLAND LAKE', tag: 'FRESH · COOL & STILL', water: 'cool freshwater', note: 'Up in the old highlands, rain has filled the crater lakes again. The water is cold and clear. A new home is possible here, if we choose its first residents carefully.', mood: 'The high water holds its breath', colors: ['#25536a', '#173a50', '#91b9a2'] },
  { id: 'kelp', name: 'Kelp Nursery', kind: 'COASTAL SHELF', tag: 'MARINE · COOL CURRENT', water: 'cool coastal water', note: 'The kelp has returned in ribbons along the drowned road. Tiny fish shelter in its shade. At dusk, the whole shelf seems to breathe again.', mood: 'Green shadows sway beyond the glass', colors: ['#20504c', '#143938', '#9f9a62'] },
];
const $ = (id) => document.getElementById(id);
const canvas = $('tank');
const ctx = canvas.getContext('2d', { alpha: false });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const spriteCache = new Map();
const members = [];
let karma = 0;
let journal = [];
let activeSite = sites[0];
let selected = [];
let selectedFish = null;
let breedCount = 0;
let recordCount = 0;
let lastFrame = 0;
let lastFeed = '';
let food = [];
let ambient = false;
let width = 800;
let height = 450;
let dpr = 1;
let toastTimer;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const getImage = (specimen, frame) => {
  const key = `${specimen.code}:${frame}`;
  if (!spriteCache.has(key)) {
    const genome = fishGen.fromCode(specimen.code);
    spriteCache.set(key, toCanvas(fishGen.frame(genome, 'swim', frame % 8)));
  }
  return spriteCache.get(key);
};
const genomeOf = (specimen) => fishGen.fromCode(specimen.code);
const nameOf = (specimen) => fishGen.name(genomeOf(specimen));
const ecoOf = (specimen) => fishGen.ecology(genomeOf(specimen));
const codeOf = (genome) => fishGen.traits.encode(genome);
function addJournal(icon, title, detail) {
  journal.unshift({ icon, title, detail, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  journal = journal.slice(0, 12);
  renderJournal();
}
function showToast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
}
function save() {
  const data = { version: 1, codes: members.map((m) => m.code), karma, journal, site: activeSite.id, breedCount, recordCount, lastFeed };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { showToast('This browser could not save the field log.'); }
}
function hydrate() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { saved = null; }
  if (saved?.version === 1 && Array.isArray(saved.codes) && saved.codes.length) {
    for (const code of saved.codes.slice(0, 28)) {
      try { addMember(code); } catch { /* discard unknown or malformed codes */ }
    }
    karma = Number.isFinite(saved.karma) ? saved.karma : 0;
    journal = Array.isArray(saved.journal) ? saved.journal.slice(0, 12) : [];
    activeSite = sites.find((s) => s.id === saved.site) ?? sites[0];
    breedCount = Number(saved.breedCount) || 0; recordCount = Number(saved.recordCount) || 0; lastFeed = saved.lastFeed || '';
    return;
  }
  ['morrow-reed-01', 'morrow-glass-02', 'morrow-cinder-03', 'morrow-silt-04', 'morrow-moon-05'].forEach((seed) => addMember(codeOf(fishGen.fromSeed(seed))));
  addJournal('✦', 'A station comes alive', 'Five residents found their way into the Morrow Basin.');
  save();
}
function addMember(code) {
  const genome = fishGen.fromCode(code);
  if (!genome) throw new Error('Could not read fish genome');
  const index = members.length;
  members.push({ code, x: 0.12 + Math.random() * 0.74, y: 0.18 + Math.random() * 0.58, vx: (Math.random() > .5 ? 1 : -1) * (.12 + Math.random() * .18), vy: (Math.random() - .5) * .08, frame: 0, phase: Math.random() * 6, size: fishGen.sizeOf(genome), id: `resident-${index}-${code.slice(-6)}` });
}
function renderJournal() {
  $('recordCount').textContent = recordCount;
  const host = $('journalEntries');
  host.innerHTML = journal.length ? journal.slice(0, 5).map((e) => `<div class="journal-entry"><i>${esc(e.icon)}</i><div>${esc(e.title)}<small>${esc(e.at)} · ${esc(e.detail)}</small></div></div>`).join('') : '<p class="journal-empty">Your first field observations will be recorded here.</p>';
}
function drawSites() {
  $('sites').innerHTML = sites.map((site) => `<button class="site-option${site.id === activeSite.id ? ' active' : ''}" data-site="${site.id}"><strong>${esc(site.name.replace(/^(\w+) /, ''))}</strong><small>${esc(site.kind)}</small></button>`).join('');
  $('sites').querySelectorAll('[data-site]').forEach((button) => button.addEventListener('click', () => {
    activeSite = sites.find((s) => s.id === button.dataset.site);
    $('fieldNote').textContent = activeSite.note; $('siteTag').textContent = activeSite.tag; $('tankMood').textContent = activeSite.mood;
    drawSites(); save(); showToast(`${activeSite.name} field site selected`);
  }));
}
function drawRoster() {
  $('fishCount').textContent = `${members.length} ${members.length === 1 ? 'resident' : 'residents'}`;
  $('rosterCount').textContent = members.length;
  $('lineCount').textContent = new Set(members.map((m) => { const g = genomeOf(m); return `${g.lineA}${g.lineB}`; })).size;
  $('roster').innerHTML = members.map((m) => {
    const g = genomeOf(m); const checked = selected.includes(m.id); const common = fishGen.name(g);
    return `<button class="fish-row${selectedFish?.id === m.id ? ' selected' : ''}" data-fish="${esc(m.id)}"><span class="fish-avatar"><canvas width="90" height="68" data-avatar="${esc(m.id)}"></canvas></span><span class="fish-meta"><strong>${esc(common)}</strong><small>${esc(g.body.toUpperCase())} · ${esc(g.size.toUpperCase())}</small></span><span class="pair-check">${checked ? '♥' : '+'}</span></button>`;
  }).join('');
  $('roster').querySelectorAll('[data-fish]').forEach((button) => button.addEventListener('click', () => {
    const specimen = members.find((m) => m.id === button.dataset.fish); if (!specimen) return;
    selectedFish = specimen;
    if (selected.includes(specimen.id)) selected = selected.filter((id) => id !== specimen.id);
    else if (selected.length < 2) selected.push(specimen.id);
    else { selected = [selected[1], specimen.id]; }
    renderDossier(specimen); drawRoster(); updateActions();
  }));
  for (const el of $('roster').querySelectorAll('[data-avatar]')) {
    const specimen = members.find((m) => m.id === el.dataset.avatar); if (specimen) drawSprite(el, getImage(specimen, 0), 0.82);
  }
  updateActions();
}
function drawSprite(target, image, fit = 1) {
  const c = target.getContext('2d'); c.clearRect(0, 0, target.width, target.height); c.imageSmoothingEnabled = false;
  const scale = Math.min(target.width / image.width, target.height / image.height) * fit;
  const w = image.width * scale, h = image.height * scale;
  c.drawImage(image, Math.round((target.width - w) / 2), Math.round((target.height - h) / 2), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}
function renderDossier(specimen) {
  const genome = genomeOf(specimen), eco = ecoOf(specimen), img = getImage(specimen, 0);
  const title = fishGen.name(genome); const lore = fishGen.lore(genome);
  const habitat = `${eco.salinity.value} · ${eco.temp.value} · ${eco.depth.value}`;
  $('dossier').innerHTML = `<div class="dossier-content"><div class="dossier-title"><span class="dossier-sprite"><canvas id="dossierSprite" width="130" height="96"></canvas></span><div><h3>${esc(title)}</h3><small>${esc(genome.body)} · ${esc(genome.sex === 'f' ? '♀' : '♂')} · ${esc(genome.stage)}</small></div></div><div class="dossier-tags"><span class="tag">${esc(eco.diet.value)} diet</span><span class="tag">${esc(eco.temperament.value)}</span><span class="tag">${esc(eco.sociality.value)}</span></div><p class="dossier-copy">${esc(lore?.quote || `A ${eco.activity.value} ${genome.body} adapted to ${habitat}.`)}</p><div class="dossier-bottom"><span>${esc(habitat.toUpperCase())}</span><button data-select="${esc(specimen.id)}">${selected.includes(specimen.id) ? '♥ PAIRED' : '♡ PAIR THIS FISH'}</button></div></div>`;
  drawSprite($('dossierSprite'), img, .86);
  $('dossier').querySelector('[data-select]').addEventListener('click', () => { if (selected.includes(specimen.id)) selected = selected.filter((id) => id !== specimen.id); else if (selected.length < 2) selected.push(specimen.id); renderDossier(specimen); drawRoster(); updateActions(); });
}
function updateActions() {
  $('breedButton').disabled = selected.length < 2;
  $('breedSub').textContent = selected.length === 2 ? 'Two residents ready for pairing' : 'Choose two fish to pair';
  $('releaseButton').disabled = !selectedFish;
  $('releaseSub').textContent = selectedFish ? `Release ${nameOf(selectedFish).split(' ').slice(-1)[0]} into ${activeSite.name}` : 'Select a fish to release';
  $('ambientButton').classList.toggle('active', ambient);
}
function render() {
  $('karma').textContent = karma;
  drawSites(); drawRoster(); renderJournal();
  $('fieldNote').textContent = activeSite.note; $('siteTag').textContent = activeSite.tag; $('tankMood').textContent = activeSite.mood;
}
function resize() {
  const rect = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); width = rect.width; height = rect.height;
  canvas.width = Math.max(1, Math.floor(width * dpr)); canvas.height = Math.max(1, Math.floor(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function background(t) {
  const grad = ctx.createLinearGradient(0, 0, 0, height); grad.addColorStop(0, activeSite.colors[0]); grad.addColorStop(.68, activeSite.colors[1]); grad.addColorStop(1, '#102e32'); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
  const sun = ctx.createRadialGradient(width * .24, 0, 5, width * .24, 0, width * .62); sun.addColorStop(0, '#c9e5a522'); sun.addColorStop(1, '#c9e5a500'); ctx.fillStyle = sun; ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = .13; ctx.fillStyle = '#b4e5bc';
  for (let i = 0; i < 5; i++) { const x = width * (.12 + i * .2) + Math.sin(t / 5000 + i) * 24; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 80 + Math.sin(t / 1700 + i) * 18, height * .72); ctx.lineTo(x - 38, height * .72); ctx.fill(); }
  ctx.globalAlpha = 1;
  // Soft distant reed silhouettes.
  for (let i = 0; i < 10; i++) { const x = ((i * 103 + 21) % width); const h = 35 + (i * 29) % 65; ctx.strokeStyle = i % 2 ? '#70a66d44' : '#9db47a33'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, height - 23); ctx.quadraticCurveTo(x - 7 + Math.sin(t / 1600 + i) * 5, height - h, x + 5, height - h - 8); ctx.stroke(); }
  // Sandy bed and stones.
  ctx.fillStyle = '#b8a66b'; ctx.fillRect(0, height - 23, width, 23); ctx.fillStyle = '#d0bd7a';
  for (let i = 0; i < width / 18; i++) { ctx.fillRect(i * 18 + (i % 3) * 2, height - 22 + (i % 4) * 4, 4, 2); }
  ctx.fillStyle = '#667e69'; [[.16,37,20],[.28,49,24],[.72,46,22],[.84,31,17]].forEach(([x,w,h],i)=>{ctx.beginPath();ctx.ellipse(width*x,height-22,w,h,i*.17,Math.PI,Math.PI*2);ctx.fill();});
  // A broken concrete arch: the world beyond the refuge, reclaimed by the water.
  ctx.strokeStyle = '#435d5c77'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(width * .57, height - 23); ctx.quadraticCurveTo(width * .61, height * .67, width * .69, height * .63); ctx.quadraticCurveTo(width * .77, height * .6, width * .8, height - 23); ctx.stroke();
  // Air pearls.
  for (let i = 0; i < 12; i++) { const x = (i * 71 + 30) % width, y = height - ((t / 37 + i * 41) % (height + 15)); ctx.strokeStyle = '#ceead777'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 2 + i % 3, 0, Math.PI * 2); ctx.stroke(); }
}
function loop(time = 0) {
  const dt = Math.min(.05, (time - (lastFrame || time)) / 1000); lastFrame = time;
  if (!document.hidden) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); background(time);
    for (const morsel of food) { morsel.y += morsel.vy * dt; morsel.x += Math.sin(time / 400 + morsel.phase) * 4 * dt; ctx.fillStyle = '#f6d78c'; ctx.fillRect(Math.round(morsel.x), Math.round(morsel.y), 4, 4); }
    food = food.filter((m) => m.y < height - 30);
    members.forEach((specimen, index) => {
      const g = genomeOf(specimen); const natural = g.size === 'giant' ? .72 : g.size === 'huge' ? .85 : g.size === 'large' ? .97 : 1.08;
      specimen.x += specimen.vx * dt * 34; specimen.y += specimen.vy * dt * 24;
      if (specimen.x < .08 || specimen.x > .92) specimen.vx *= -1;
      if (specimen.y < .12 || specimen.y > .78) specimen.vy *= -1;
      if (Math.random() < dt * .18) specimen.vy = (Math.random() - .5) * .13;
      const frame = Math.floor((time / (reducedMotion ? 1200 : 160)) + specimen.phase) % 8;
      const image = getImage(specimen, frame);
      const scale = Math.min(1, width * .23 / image.width, height * .22 / image.height) * natural;
      const w = Math.max(1, Math.round(image.width * scale)), h = Math.max(1, Math.round(image.height * scale));
      const x = Math.round(specimen.x * width - w / 2), y = Math.round(specimen.y * height - h / 2 + Math.sin(time / 440 + specimen.phase) * 4);
      ctx.save(); if (specimen.vx < 0) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(image, 0, y, w, h); } else ctx.drawImage(image, x, y, w, h); ctx.restore();
      if (selectedFish?.id === specimen.id || selected.includes(specimen.id)) { ctx.strokeStyle = '#c1e9b5bb'; ctx.lineWidth = 1; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.ellipse(x+w/2,y+h/2,w*.64,h*.72,0,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
      specimen.hit = { x, y, w, h };
    });
    // Ripples around food give the tank a soft sense of life.
    if (!reducedMotion) { ctx.strokeStyle = '#b3dec426'; for (let i=0;i<4;i++){const x=(time/48+i*width/4)%width;ctx.beginPath();ctx.ellipse(x,height*.26+Math.sin(time/900+i)*20,23,4,0,0,Math.PI*2);ctx.stroke();} }
  }
  requestAnimationFrame(loop);
}
function feedFish() {
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 14; i++) food.push({ x: width * (.25 + Math.random() * .5), y: 22 + Math.random() * 35, vy: 25 + Math.random() * 28, phase: Math.random() * 8 });
  if (today !== lastFeed) { karma += 2; lastFeed = today; addJournal('✿', 'A careful feeding', 'The basin has enough for today.'); showToast('The residents gather. +2 Karma for care'); }
  else showToast('A little snack for the basin residents');
  $('karma').textContent = karma; save();
}
function breedSelected() {
  const pair = selected.map((id) => members.find((m) => m.id === id)).filter(Boolean); if (pair.length !== 2) return;
  const a = genomeOf(pair[0]), b = genomeOf(pair[1]);
  const result = fishGen.breedDetailed(a, b, `morrow-nursery-${++breedCount}`);
  const code = codeOf(result.child); addMember(code); const baby = members.at(-1); baby.x = .5; baby.y = .48; baby.size = fishGen.sizeOf(result.child);
  karma += 25; recordCount++; selected = []; selectedFish = baby;
  const names = pair.map(nameOf); addJournal('♡', 'A new lineage begins', `${names[0]} × ${names[1]}`);
  $('karma').textContent = karma; render(); renderDossier(baby); showOffspring(baby, result.events);
  save();
}
function showOffspring(baby, events = []) {
  $('modalTitle').textContent = 'A new little lineage';
  $('modalCopy').textContent = events[0]?.text ? `The nursery records: ${events[0].text}. A fry has joined the basin.` : 'A tiny fry has arrived, carrying traces of both families. +25 Karma for nurturing a new lineage.';
  $('offspring').innerHTML = '<canvas id="offspringCanvas" width="220" height="150"></canvas>';
  drawSprite($('offspringCanvas'), getImage(baby, 0), .88); $('modal').hidden = false;
}
function releaseSelected() {
  if (!selectedFish) return;
  if (members.length <= 2) { showToast('Keep at least two residents at the station for a future nursery pairing.'); return; }
  const specimen = selectedFish; const name = nameOf(specimen); const eco = ecoOf(specimen);
  const fit = activeSite.id === 'morrow' ? ['brackish','fresh','any'].includes(eco.salinity.value) : activeSite.id === 'glasslake' ? ['fresh','any'].includes(eco.salinity.value) && eco.temp.value !== 'tropical' : ['marine','brackish','any'].includes(eco.salinity.value);
  members.splice(members.indexOf(specimen), 1); spriteCache.forEach((_, key) => { if (key.startsWith(`${specimen.code}:`)) spriteCache.delete(key); });
  karma += fit ? 15 : 5; recordCount++; selectedFish = null; selected = selected.filter((id) => id !== specimen.id);
  addJournal('↗', fit ? 'A fitting release' : 'A brave field trial', `${name} released to ${activeSite.name}.`);
  $('karma').textContent = karma; render(); $('dossier').innerHTML = '<div class="empty-dossier"><span class="dossier-icon">⌕</span><b>Every fish has a story.</b><p>Select a resident to open their field dossier.</p></div>';
  showToast(fit ? `${name} finds a fitting refuge. +15 Karma` : `Field trial recorded. +5 Karma`); save();
}
function discoverFish() {
  if (members.length >= 20) { showToast('The basin is full. Make room before bringing in another resident.'); return; }
  const code = codeOf(fishGen.fromSeed(`field-survey-${Date.now()}-${members.length}`)); addMember(code);
  const specimen = members.at(-1); specimen.x = .5; specimen.y = .3 + Math.random() * .35;
  selectedFish = specimen; selected = []; recordCount++; karma += 3;
  addJournal('⌕', 'A field survey finds a survivor', nameOf(specimen)); $('karma').textContent = karma; render(); renderDossier(specimen); showToast(`A new survivor found. +3 Karma`); save();
}
function handleTankTap(event) {
  const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
  const hit = [...members].reverse().find((m) => m.hit && x >= m.hit.x - 5 && x <= m.hit.x + m.hit.w + 5 && y >= m.hit.y - 5 && y <= m.hit.y + m.hit.h + 5);
  if (hit) { selectedFish = hit; if (!selected.includes(hit.id)) { if (selected.length < 2) selected.push(hit.id); else selected = [selected[1], hit.id]; } renderDossier(hit); drawRoster(); showToast(nameOf(hit)); }
  else { for (let i=0;i<6;i++) food.push({x:x+(Math.random()-.5)*55,y:y+(Math.random()-.5)*22,vy:18+Math.random()*22,phase:Math.random()*8}); showToast('A few morsels drift into the current'); }
}

hydrate(); render(); resize();
new ResizeObserver(resize).observe(canvas);
canvas.addEventListener('pointerdown', handleTankTap);
$('feedButton').addEventListener('click', feedFish);
$('breedButton').addEventListener('click', breedSelected);
$('releaseButton').addEventListener('click', releaseSelected);
$('discoverButton').addEventListener('click', discoverFish);
$('ambientButton').addEventListener('click', () => { ambient = !ambient; showToast(ambient ? 'Ambient mode on — take a quiet moment' : 'Field controls restored'); updateActions(); });
$('resetButton').addEventListener('click', () => { localStorage.removeItem(SAVE_KEY); location.reload(); });
$('modalClose').addEventListener('click', () => { $('modal').hidden = true; });
$('welcomeButton').addEventListener('click', () => { $('modal').hidden = true; });
$('modal').addEventListener('pointerdown', (event) => { if (event.target === $('modal')) $('modal').hidden = true; });
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || $('modal').hidden === false) return;
  if (event.key.toLowerCase() === 'f') feedFish();
  if (event.key.toLowerCase() === 'b') breedSelected();
  if (event.key.toLowerCase() === 'r') releaseSelected();
  if (event.key === 'Escape') { selected = []; selectedFish = null; drawRoster(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) lastFrame = 0; });
requestAnimationFrame(loop);

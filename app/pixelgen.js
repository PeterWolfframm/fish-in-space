// The app's side of pixelgen: the worker that rolls, scores and trains, this user's swipes (in
// PocketBase, or this browser when offline), and the two models.
//
// - The public model is read from PocketBase (the trainer writes it) and re-checked every 30 s.
// - The personal model trains here, in the worker, a moment after each swipe, fine-tuned from the
//   public one, and is saved to PocketBase now and then.

import { pb, online, user, who, onAuth } from './auth.js';

// ---------- the worker ----------

const worker = new Worker(new URL('./pixelgen-worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
let nextId = 1;
worker.onmessage = ({ data: { id, result, error } }) => {
  const p = pending.get(id);
  pending.delete(id);
  if (error) p?.reject(new Error(error));
  else p?.resolve(result);
};
/** Ask the worker for `type` (see pixelgen-worker.js). */
export const call = (type, args = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, ...args });
  });

// ---------- change notifications ----------

const listeners = { swipes: new Set(), models: new Set() };
export const on = (what, fn) => (listeners[what].add(fn), () => listeners[what].delete(fn));
const emit = (what) => listeners[what].forEach((fn) => fn());

// ---------- swipes ----------

const LOCAL_KEY = 'pixelgen.swipes';
const local = {
  read() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? [];
    } catch {
      return [];
    }
  },
  write(list) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    } catch {}
  },
};

let mine = [];
/** This user's swipes, oldest first. */
export const swipes = () => mine;

async function loadSwipes() {
  mine = online && user() ? await pb.collection('swipes').getFullList({ sort: 'created', batch: 500 }) : local.read();
  emit('swipes');
}

/** Store a swipe; returns the stored record (with its id). */
export async function addSwipe(s) {
  const rec = { ...s, user: who() };
  const saved = online && user() ? await pb.collection('swipes').create(rec) : { ...rec, id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, created: new Date().toISOString() };
  mine.push(saved);
  if (!online) local.write(mine);
  emit('swipes');
  schedulePersonal();
  return saved;
}

/** Forget a swipe (undo, or un-liking): the models unlearn it on their next training. */
export async function removeSwipe(id) {
  if (online && user()) await pb.collection('swipes').delete(id);
  mine = mine.filter((s) => s.id !== id);
  if (!online) local.write(mine);
  emit('swipes');
  schedulePersonal();
}

// ---------- models ----------

export const models = { public: null, personal: null }; // stats of the loaded ones, or null
let publicStamp = null;
let personalId = null;
const PERSONAL_KEY = 'pixelgen.personal';

async function loadPublic() {
  if (!online || !user()) return;
  const head = await pb
    .collection('models')
    .getFirstListItem('scope = "public"', { fields: 'id,trainedAt' })
    .catch(() => null);
  if (!head || head.trainedAt === publicStamp) return;
  const rec = await pb.collection('models').getOne(head.id);
  publicStamp = rec.trainedAt;
  const ok = await call('setModels', { public: rec });
  models.public = ok.public ? { ...rec.stats, trainedAt: rec.trainedAt } : null;
  emit('models');
}

async function loadPersonal() {
  personalId = null;
  let rec = null;
  if (online && user()) {
    rec = await pb
      .collection('models')
      .getFirstListItem(pb.filter('scope = "personal" && user = {:id}', { id: user().id }))
      .catch(() => null);
    personalId = rec?.id ?? null;
  } else {
    try {
      rec = JSON.parse(localStorage.getItem(PERSONAL_KEY));
    } catch {}
  }
  const ok = await call('setModels', { personal: rec });
  models.personal = ok.personal ? { ...rec.stats, trainedAt: rec.trainedAt } : null;
  emit('models');
  // Swipes made since it was saved (or a schema change) mean it is due a retrain.
  if (mine.length && (!ok.personal || rec.stats?.swipes !== mine.length)) schedulePersonal(10);
}

let trainTimer = null;
let lastSave = 0;
let saveTimer = null;
export let training = false;

/** Retrain the personal model soon (debounced so a burst of swipes trains once). */
function schedulePersonal(ms = 1200) {
  clearTimeout(trainTimer);
  trainTimer = setTimeout(trainPersonal, ms);
}

async function trainPersonal() {
  if (training) return schedulePersonal();
  training = true;
  emit('models');
  try {
    const rec = await call('train', { scope: 'personal', swipes: mine, user: online ? user()?.id : null });
    models.personal = rec ? { ...rec.stats, trainedAt: rec.trainedAt } : null;
    if (!rec) await call('setModels', { personal: null });
    if (rec) queueSave(rec);
  } finally {
    training = false;
    emit('models');
  }
}

/** The weights are ~1 MB of JSON: save at most every 15 s, always the latest. */
function queueSave(rec) {
  clearTimeout(saveTimer);
  const save = async () => {
    lastSave = Date.now();
    if (!online || !user()) {
      try {
        localStorage.setItem(PERSONAL_KEY, JSON.stringify(rec));
      } catch {}
      return;
    }
    try {
      if (personalId) await pb.collection('models').update(personalId, rec);
      else personalId = (await pb.collection('models').create(rec)).id;
    } catch (e) {
      console.warn('pixelgen: saving the personal model failed', e);
    }
  };
  const wait = Math.max(0, 15000 - (Date.now() - lastSave));
  if (wait) saveTimer = setTimeout(save, wait);
  else save();
}

/** Retrain the public model here and store it (admins only; normally the trainer does this). */
export async function retrainPublic(all) {
  const rec = await call('train', { scope: 'public', swipes: all, withInsights: true });
  if (!rec) return null;
  rec.stats.key = `${all.length}|${all.at(-1)?.created ?? ''}`; // the trainer's "unchanged" key
  const cur = await pb
    .collection('models')
    .getFirstListItem('scope = "public"', { fields: 'id' })
    .catch(() => null);
  const saved = cur ? await pb.collection('models').update(cur.id, rec) : await pb.collection('models').create(rec);
  publicStamp = saved.trainedAt;
  models.public = { ...rec.stats, trainedAt: rec.trainedAt };
  emit('models');
  return rec.stats;
}

/** The public model's full record (stats with insights), or null. */
export const publicRecord = () =>
  online && user()
    ? pb
        .collection('models')
        .getFirstListItem('scope = "public"', { fields: 'id,stats,trainedAt,schema' })
        .catch(() => null)
    : Promise.resolve(null);

// ---------- start ----------

let pollTimer = null;
async function onUser() {
  // Someone else signed in: their swipes and their personal model.
  await call('setModels', { personal: null });
  models.personal = null;
  await loadSwipes();
  await Promise.all([loadPublic().catch(() => {}), loadPersonal().catch(() => {})]);
  clearInterval(pollTimer);
  if (online) pollTimer = setInterval(() => loadPublic().catch(() => {}), 30000);
}

let lastUser;
onAuth((u) => {
  const id = u?.id ?? 'local';
  if (id === lastUser) return;
  lastUser = id;
  onUser();
});

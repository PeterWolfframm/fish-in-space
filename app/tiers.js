// Local ranking of catches. Approved swipes land in the bucket until dragged onto a row.
// A baby kept from the matchmaker is `local` and is not a server like.

const KEY = 'pixelforge.tiers';
export const RANKS = ['S', 'A', 'B', 'C', 'D', 'pool'];

const listeners = new Set();
let tiers = load();

const keyOf = (e) => `${e.kind}|${e.code}`;

function empty() {
  return { S: [], A: [], B: [], C: [], D: [], pool: [] };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    const next = empty();
    if (!saved) return next;
    for (const rank of RANKS) {
      next[rank] = (saved[rank] ?? []).filter((e) => e && e.kind && e.code).map((e) => ({
        kind: e.kind,
        code: e.code,
        ...(e.local ? { local: true } : {}),
        ...(e.swipeId ? { swipeId: e.swipeId } : {}),
      }));
    }
    return next;
  } catch {
    return empty();
  }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(tiers)); } catch {}
}

function emit() {
  persist();
  for (const fn of listeners) fn(tiers);
}

export const onTiers = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export const snapshot = () => RANKS.reduce((acc, rank) => {
  acc[rank] = tiers[rank].map((e) => ({ ...e }));
  return acc;
}, {});

export function flat() {
  return RANKS.flatMap((rank) => tiers[rank].map((e) => ({ ...e, rank })));
}

function take(key) {
  for (const rank of RANKS) {
    const i = tiers[rank].findIndex((e) => keyOf(e) === key);
    if (i >= 0) return tiers[rank].splice(i, 1)[0];
  }
  return null;
}

/** Drop approved likes that were removed, and pour new ones into the bucket. */
export function syncLikes(approved) {
  const byKey = new Map(approved.map((s) => [keyOf(s), s]));
  const seen = new Set();
  let changed = false;
  for (const rank of RANKS) {
    const next = [];
    for (const e of tiers[rank]) {
      const k = keyOf(e);
      if (seen.has(k)) { changed = true; continue; }
      seen.add(k);
      if (e.local) { next.push(e); continue; }
      const swipe = byKey.get(k);
      if (!swipe) { changed = true; continue; }
      if (e.swipeId !== swipe.id) { e.swipeId = swipe.id; changed = true; }
      next.push(e);
    }
    if (next.length !== tiers[rank].length) changed = true;
    tiers[rank] = next;
  }
  for (const s of approved) {
    const k = keyOf(s);
    if (seen.has(k)) continue;
    tiers.pool.unshift({ kind: s.kind, code: s.code, swipeId: s.id });
    seen.add(k);
    changed = true;
  }
  if (changed) emit();
}

/** Move a catch to `rank`, optionally in front of another catch in that row. */
export function moveEntry(key, rank, beforeKey) {
  if (!RANKS.includes(rank)) return;
  const entry = take(key);
  if (!entry) return;
  const list = tiers[rank];
  const at = beforeKey && beforeKey !== key ? list.findIndex((e) => keyOf(e) === beforeKey) : -1;
  if (at >= 0) list.splice(at, 0, entry);
  else list.push(entry);
  emit();
}

/** Remove a catch from every row. Returns the entry, if it was ranked. */
export function dropEntry(key) {
  const entry = take(key);
  if (entry) emit();
  return entry;
}

/** A bred baby joins the bucket. It is not written to the swipe log. */
export function addLocal(kind, code) {
  take(keyOf({ kind, code }));
  tiers.pool.unshift({ kind, code, local: true });
  emit();
}

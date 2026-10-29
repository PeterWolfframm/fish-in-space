// Fish Tinder's state: the deck of fresh rolls, every swipe, the tier list, and the taste net.
//
// Swipes and tiers cache in IndexedDB. For a signed-in member PocketBase is canonical (`swipes`,
// `tinder_state`); the trainer reads only Fish Tinder swipes from `swipes`,
// so Fish Tinder is the one source the pixelgen net learns from. The personal net trains in a worker
// a moment after each swipe and scores the cards in view.

import { signal, computed } from '@preact/signals';
import { get, set } from 'idb-keyval';
import * as T from '../game/tinder';
import { isMember, onAuth, pb, user } from './auth';
import TasteWorker from './tinder.worker?worker';

const KEY = 'seedfall-tinder-v1';
const AHEAD = 4;
const HISTORY = 10;

export const deck = signal<T.Card[]>([]);
export const swipes = signal<T.TinderSwipe[]>([]);
export const tiers = signal<T.Tiers>(T.emptyTiers());
/** The net's score per code; missing until asked, null when there is no model yet. */
export const scores = signal<Record<string, number | null>>({});
export const taste = signal<{ swipes: number; likes: string[]; dislikes: string[]; fromPublic: boolean } | null>(null);
export const training = signal(false);
export const publicModel = signal<{ swipes: number; users: number } | null>(null);
/** The last match, for the "It's a match" screen. */
export const match = signal<T.TinderSwipe | null>(null);

export const liked = computed(() => swipes.value.filter((s) => s.verdict === 'approve').reverse());
export const matches = computed(() => liked.value.filter((s) => s.matched));

let undoable: T.TinderSwipe[] = [];
export const canUndo = signal(false);

// ---------- persistence ----------

let loaded: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let tiersTimer: ReturnType<typeof setTimeout> | undefined;
let tinderStateId: string | null = null;

const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void set(KEY, { swipes: swipes.peek(), tiers: tiers.peek() }).catch(() => {}), 200);
  if (isMember()) {
    clearTimeout(tiersTimer);
    tiersTimer = setTimeout(() => void uploadTiers(), 400);
  }
};

/** Load once, fill the deck, and start syncing with the account. */
export function initTinder() {
  loaded ??= (async () => {
    try {
      const s = (await get(KEY)) as { swipes?: T.TinderSwipe[]; tiers?: T.Tiers } | undefined;
      if (s?.swipes) swipes.value = s.swipes;
      tiers.value = T.syncTiers(s?.tiers ?? T.emptyTiers(), swipes.value);
    } catch {
      /* private window: start empty */
    }
    fill();
    retrain(50);
    onAuth(() => void syncAccount());
    void syncAccount();
  })();
  return loaded;
}

// ---------- the deck ----------

function fill() {
  const d = [...deck.peek()];
  while (d.length < AHEAD + 2) d.push(T.roll(T.randomSeed()));
  deck.value = d;
  void scoreCodes(d.map((c) => c.code));
}

/** Swipe the top card. Returns the stored swipe. Feedback rides along when the sheet held anything. */
export function swipe(verdict: T.Verdict, superlike = false, feedback?: T.Feedback): T.TinderSwipe | null {
  const [card, ...rest] = deck.peek();
  if (!card) return null;
  const s: T.TinderSwipe = {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    code: card.code,
    seed: card.seed,
    verdict,
    ...(superlike ? { superlike: true } : {}),
    ...(feedback && T.feedbackCount(feedback) ? { feedback } : {}),
    matched: verdict === 'approve' && T.likesBack(card.code, superlike),
    at: Date.now(),
    score: scores.peek()[card.code] ?? null,
  };
  deck.value = rest;
  swipes.value = [...swipes.peek(), s];
  tiers.value = T.syncTiers(tiers.peek(), swipes.value);
  undoable = [...undoable, s].slice(-HISTORY);
  canUndo.value = true;
  if (s.matched) match.value = s;
  persist();
  fill();
  retrain();
  void upload(s);
  return s;
}

/** Bring the last swiped card back and forget its swipe (the nets unlearn it). */
export function undo(): T.TinderSwipe | null {
  const s = undoable.pop();
  canUndo.value = undoable.length > 0;
  if (!s) return null;
  forget(s.id);
  deck.value = [{ seed: s.seed, code: s.code }, ...deck.peek()].slice(0, AHEAD + 3);
  return s;
}

/** Take a swipe back, from undo or from un-liking in the list. */
export function forget(id: string) {
  const s = swipes.peek().find((x) => x.id === id);
  if (!s) return;
  swipes.value = swipes.peek().filter((x) => x.id !== id);
  tiers.value = T.syncTiers(tiers.peek(), swipes.value);
  undoable = undoable.filter((x) => x.id !== id);
  canUndo.value = undoable.length > 0;
  persist();
  retrain();
  if (s.remote && isMember()) void pb.collection('swipes').delete(s.remote).catch(() => {});
}

export function moveTo(code: string, rank: T.Rank, before?: string | null) {
  tiers.value = T.moveTier(tiers.peek(), code, rank, before);
  persist();
}

async function uploadTiers() {
  const uid = mine();
  if (!uid) return;
  try {
    const body = { user: uid, tiers: tiers.peek() };
    if (tinderStateId) await pb.collection('tinder_state').update(tinderStateId, body);
    else {
      const rec = await pb.collection('tinder_state').create(body);
      tinderStateId = rec.id;
    }
  } catch {
    /* offline */
  }
}

// ---------- the account ----------

const mine = () => (isMember() ? user()?.id ?? null : null);

async function upload(s: T.TinderSwipe) {
  const uid = mine();
  if (!uid || s.remote) return;
  try {
    const rec = await pb.collection('swipes').create({
      user: uid,
      kind: T.TINDER_KIND,
      code: s.code,
      seed: s.seed,
      verdict: s.verdict,
      note: s.feedback ? T.feedbackNote(s.feedback) : '',
      fix: s.feedback?.fix ?? [],
      instead: s.feedback?.instead ?? {},
      asKind: s.feedback?.asKind ?? '',
      scores: { personal: s.score ?? null, ...(s.superlike ? { superlike: true } : {}) },
      mode: T.TINDER_MODE,
    });
    // It may have been undone while the request was out.
    if (!swipes.peek().some((x) => x.id === s.id)) return void pb.collection('swipes').delete(rec.id).catch(() => {});
    swipes.value = swipes.peek().map((x) => (x.id === s.id ? { ...x, remote: rec.id } : x));
    persist();
  } catch {
    /* offline: uploaded on the next sync */
  }
}

/** Pull Fish Tinder state from PocketBase; push any swipes still local-only. */
async function syncAccount() {
  const uid = mine();
  if (!uid) return;
  try {
    const remote = await pb.collection('swipes').getFullList({
      filter: pb.filter('user = {:u} && mode = {:m}', { u: uid, m: T.TINDER_MODE }),
      sort: 'created',
      fields: 'id,code,seed,verdict,note,fix,instead,asKind,scores,created',
      batch: 500,
    });
    const fromCloud: T.TinderSwipe[] = remote.map((r) => {
      const read = T.readCloudSwipe({ note: r.note as string, fix: r.fix, instead: r.instead, asKind: r.asKind as string, scores: r.scores });
      return {
        id: `r${r.id}`,
        code: String(r.code),
        seed: String(r.seed ?? ''),
        verdict: r.verdict as T.Verdict,
        ...(read.superlike ? { superlike: true } : {}),
        ...(read.feedback ? { feedback: read.feedback } : {}),
        matched: r.verdict === 'approve' && T.likesBack(String(r.code), read.superlike),
        at: Date.parse(String(r.created)) || Date.now(),
        remote: r.id,
        score: read.score,
      };
    });
    const pending = swipes.peek().filter((s) => !s.remote);
    swipes.value = [...fromCloud, ...pending].sort((a, b) => a.at - b.at);

    const stateRec = await pb
      .collection('tinder_state')
      .getFirstListItem(pb.filter('user = {:u}', { u: uid }), { fields: 'id,tiers' })
      .catch(() => null);
    tinderStateId = stateRec?.id ?? null;
    const cloudTiers = (stateRec?.tiers as T.Tiers | undefined) ?? null;
    tiers.value = T.syncTiers(cloudTiers ?? tiers.peek(), swipes.value);
    persist();

    for (const s of swipes.peek()) if (!s.remote) await upload(s);
    if (isMember() && !tinderStateId) await uploadTiers();
    const pub = await pb
      .collection('models')
      .getFirstListItem('scope = "public"')
      .catch(() => null);
    if (pub && (await call('setPublic', { record: pub }))) {
      const st = pub.stats as { swipes?: number; users?: number } | undefined;
      publicModel.value = { swipes: st?.swipes ?? 0, users: st?.users ?? 0 };
    }
    retrain(50);
  } catch {
    /* offline or rules: local swipes stay local */
  }
}

// ---------- the taste net ----------

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (v: unknown) => void>();

function call<R = unknown>(type: string, args: Record<string, unknown> = {}): Promise<R | null> {
  if (!worker) {
    try {
      worker = new TasteWorker();
      worker.onmessage = ({ data }: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
        waiting.get(data.id)?.(data.error ? null : data.result);
        waiting.delete(data.id);
      };
    } catch {
      return Promise.resolve(null);
    }
  }
  const id = nextId++;
  return new Promise((resolve) => {
    waiting.set(id, resolve as (v: unknown) => void);
    worker!.postMessage({ id, type, ...args });
  });
}

let trainTimer: ReturnType<typeof setTimeout> | undefined;
function retrain(ms = 900) {
  clearTimeout(trainTimer);
  trainTimer = setTimeout(async () => {
    if (training.peek()) return retrain();
    training.value = true;
    try {
      // Super likes count twice: the net hears them louder than a plain like.
      const rows = swipes.peek().flatMap((s) => {
        const row = { user: 'me', kind: T.TINDER_KIND, code: s.code, verdict: s.verdict };
        return s.superlike ? [row, row] : [row];
      });
      const out = await call<{ stats: { swipes: number; fromPublic: boolean }; taste: { likes: string[]; dislikes: string[] } }>('train', { swipes: rows });
      taste.value = out ? { swipes: swipes.peek().length, fromPublic: out.stats.fromPublic, ...out.taste } : null;
      scores.value = {};
      await scoreCodes(deck.peek().map((c) => c.code));
    } finally {
      training.value = false;
    }
  }, ms);
}

async function scoreCodes(codes: string[]) {
  const have = scores.peek();
  const todo = codes.filter((c) => !(c in have));
  if (!todo.length) return;
  const out = await call<(number | null)[]>('score', { codes: todo });
  if (!out) return;
  const next = { ...scores.peek() };
  todo.forEach((c, i) => (next[c] = out[i]));
  scores.value = next;
}

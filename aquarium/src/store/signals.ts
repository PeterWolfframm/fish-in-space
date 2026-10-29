// The store: game state as signals. Every action clones the state, runs a pure rule on the draft,
// commits, and dispatches the rule's events to scenes, comms and audio. Nothing else mutates.

import { batch, computed, signal } from '@preact/signals';
import * as W from '../game';
import { BEATS, CHAPTERS, type BeatTrigger } from '../content/story';
import { REACTIONS, type Trigger } from '../content/comms/reactions';
import type { CommsEntry, CommsPanel } from '../content/comms/types';
import { sfx, unlock } from '../audio/sfx';
import { ambientTick, startAmbient } from '../audio/ambient';
import { reducedMotion } from '../ui/theme';
import { LocalBackend, tallyOnce, type Backend, type Tally } from './backend';

// --- state -----------------------------------------------------------------------------------------

export let backend: Backend = new LocalBackend();
export const game = signal<W.State>(W.newGame(Date.now(), 'boot'));
export const now = signal(Date.now());
export const ready = signal(false);

export type Room = 'hatchery' | 'bridge' | 'interchange' | 'pip' | 'lab' | 'tinder';
export const room = signal<Room>('hatchery');
export const selected = signal<string | null>(null); // fish id with the dossier open
export const pairWith = signal<string | null>(null); // first fish of a pairing in progress
export const labPair = signal<[string | null, string | null]>([null, null]);
/** Which of the Lab's two breeding tanks is asking for a fish (tapped in the scene or the panel). */
export const labPick = signal<0 | 1 | null>(null);
/** True while the blanket is over the breeding tanks. */
export const labBusy = signal(false);
export const seeding = signal<string | null>(null); // fish id waiting for a region pick
export const launching = signal<{ orderId?: string; fishId: string; regionId: string; count: number } | null>(null);
export const focusRegion = signal<string | null>(null);
export const surface = signal(false); // Bridge: flat surface map instead of the globe
export const briefing = signal<number | null>(null); // chapter index on screen
export const profOpen = signal<string | null>(null); // Ask the Prof hint text
export const tallies = signal<Record<string, Tally>>({});
export const pollWatch = signal<string | null>(null);
export const placing = signal<number | null>(null); // index into ownedCuttings being placed in the tank
export const activeTank = signal<string>('T1'); // which tank the Hatchery view/actions are aimed at
export function setTank(id: string) {
  activeTank.value = id;
  const s = game.peek();
  if (s.fish.some((f) => f.tank === id && f.name === 'Jerry')) beat('jerry');
}
/** 0..1: how far the camera has panned across the active tank's glass, for the pan-position indicator.
 * null when the tank is no wider than the viewport (nothing to pan). */
export const tankPan = signal<number | null>(null);
export const tankMenuOpen = signal(false); // the popout tank-listing menu
/** A fresh game opens on a slow blink: you've just been woken up. */
export const waking = signal(false);

export const orbit = computed(() => W.orbitAt(game.value.orbitEpoch, now.value));
export const busy = computed(() => Boolean(pairWith.value || launching.value || briefing.value !== null));

// --- comms queue ---------------------------------------------------------------------------------------

export interface Showing {
  key: number;
  id: string;
  panels: CommsPanel[];
  choices?: CommsEntry['choices'];
  at: number;
  orbit: number;
}
export const commsQueue = signal<Showing[]>([]);
export const commsUnread = signal(0);
let commsKey = 1;

function queueComms(e: { id: string; panels: CommsPanel[]; tags?: string[]; choices?: CommsEntry['choices'] }, ambient = false) {
  let entry!: W.CommsLogEntry;
  act((s) => void (entry = W.heard(s, e, Date.now(), ambient)));
  commsQueue.value = [...commsQueue.value, { key: commsKey++, id: e.id, panels: e.panels, choices: e.choices, at: entry.at, orbit: entry.orbit }];
  if (room.value !== 'pip') commsUnread.value++;
  sfx.radio();
}

export function dismissComms(choiceIndex?: number) {
  const [head, ...rest] = commsQueue.value;
  commsQueue.value = rest;
  if (!head || choiceIndex === undefined) return;
  const c = head.choices?.[choiceIndex];
  if (!c) return;
  if (c.credits) act((s) => void (s.credits += c.credits!));
  const last = game.value.comms.log.findLast((l) => l.id === head.id);
  if (last) act((s) => void (s.comms.log.findLast((l) => l.id === head.id)!.choice = c.label));
  if (c.reply) queueComms({ id: `${head.id}:reply`, panels: [c.reply] });
}

/** Play an onboarding or story beat once. */
export function beat(t: BeatTrigger) {
  const e = BEATS[t];
  if (!e || W.seen(game.value, e.id)) return;
  act((s) => W.markSeen(s, e.id));
  queueComms(e);
}

let lastReaction = 0;
function react(t: Trigger, salt = '') {
  if (Date.now() - lastReaction < 20_000 || commsQueue.value.length > 1) return;
  lastReaction = Date.now();
  const list = REACTIONS[t];
  const r = W.rng(`${game.value.seed}:react:${t}:${salt}:${game.value.nextId}`);
  queueComms({ id: `react-${t}`, panels: [W.pick(r, list)] });
}

// --- toasts and the event bus ------------------------------------------------------------------------------

export interface Toast {
  key: number;
  text: string;
  kind?: 'good' | 'bad' | 'gold';
}
export const toasts = signal<Toast[]>([]);
let toastKey = 1;
export function toast(text: string, kind?: Toast['kind']) {
  const t = { key: toastKey++, text, kind };
  toasts.value = [...toasts.value, t].slice(-3);
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x !== t)), 3200);
}

export type SceneEvent =
  | { kind: 'hatched'; fishId: string; x: number }
  | { kind: 'launch'; fishId: string; code: string; regionId: string }
  | { kind: 'splash'; regionId: string; clean: boolean; code: string; gag: number }
  | { kind: 'blanket' }
  | { kind: 'sold'; fishId: string }
  | { kind: 'hearts'; fishId: string }
  | { kind: 'say'; fishId: string; text: string; color?: string }
  | { kind: 'feedAll' }
  | { kind: 'named'; regionId: string }
  | { kind: 'phase'; phase: number };
type Listener = (e: SceneEvent) => void;
const listeners = new Set<Listener>();
export const onScene = (cb: Listener) => (listeners.add(cb), () => void listeners.delete(cb));
const emit = (e: SceneEvent) => listeners.forEach((cb) => cb(e));

// --- commit ------------------------------------------------------------------------------------------

/** Run a rule on a draft and commit it. Returns the rule's own result. */
export function act<T>(rule: (draft: W.State) => T): T {
  const draft = structuredClone(game.value);
  const out = rule(draft);
  if (out && typeof out === 'object' && 'error' in out && (out as { error?: string }).error) return out;
  game.value = draft;
  dirty = true;
  return out;
}

function handle(events: W.GameEvent[]) {
  for (const e of events) {
    switch (e.kind) {
      case 'hatched': {
        emit({ kind: 'hatched', fishId: e.fish.id, x: e.egg.x });
        sfx.hatch();
        const g = W.genomeOf(e.fish.code);
        if (['rare', 'myth'].includes(g.rarity)) react('rare-hatch', e.fish.id);
        if (!e.roe) beat('hatched');
        break;
      }
      case 'discovered':
        if (e.what === 'allele') {
          toast(`New allele logged: ${e.id}`, 'gold');
          react('new-allele', e.id);
        }
        break;
      case 'grew':
        if (e.stage === 'elder') react('elder', e.fish.id);
        if (e.stage === 'adult') emit({ kind: 'say', fishId: e.fish.id, text: 'grown!' });
        break;
      case 'order':
        if (game.value.stats.orders === 0) beat('order');
        else toast(`New request: ${e.order.colony}`);
        break;
      case 'expired':
        toast(`Request from ${e.order.colony} expired`, 'bad');
        break;
      case 'phase': {
        const chapters = act((s) => W.syncChapter(s));
        sfx.phase();
        emit({ kind: 'phase', phase: e.phase });
        if (chapters.length) briefing.value = chapters.at(-1)!;
        if (e.phase === 1) beat('phase-end-0');
        break;
      }
      case 'regionOpened':
        openPoll(e.region);
        break;
      case 'regionReady':
        void closeRegion(e.region.id);
        break;
      case 'restock':
        react('restock', String(e.orbit));
        break;
      case 'autofed':
        toast(`Auto-feeder fed ${e.n} fish`);
        emit({ kind: 'feedAll' });
        break;
      case 'regionNamed':
        break;
    }
  }
}

// --- polls ---------------------------------------------------------------------------------------------

function openPoll(r: W.Region) {
  if (!r.poll) return;
  backend.polls.open(r.id, { optionIds: r.poll.options.map((o) => o.id), openedAt: r.poll.openedAt });
}

let unwatch: (() => void) | null = null;
export function watchPoll(regionId: string | null) {
  unwatch?.();
  unwatch = null;
  pollWatch.value = regionId;
  if (!regionId) return;
  unwatch = backend.polls.watch(regionId, (t) => (tallies.value = { ...tallies.value, [regionId]: t }));
}

export function castVote(regionId: string, optionId: string) {
  const r = act((s) => W.vote(s, regionId, optionId));
  if (W.failed(r)) return toast(r.error, 'bad');
  void backend.polls.vote(regionId, optionId, 1);
  sfx.love();
  if (Math.random() < 0.25) react('vote', regionId);
}

async function closeRegion(regionId: string) {
  const tally = await tallyOnce(backend, regionId);
  const r = act((s) => W.closePoll(s, regionId, Date.now(), tally));
  if (W.failed(r)) return;
  sfx.stamp();
  emit({ kind: 'named', regionId });
  queueComms({ id: `named-${regionId}`, tags: ['story'], panels: [
    { who: 'prof', mood: 'grin', text: `The votes are in! By order of the Colony Accord, ${W.regionById(game.value, regionId)!.survey} is now… ${r.name}!` },
    { who: 'pip', mood: 'calm', text: 'Name stamped on the map. Field Notes updated. Mission patch issued.', side: 'right' },
  ] });
  if (game.value.fieldNotes.regions.length === 1) beat('named-first');
}

// --- actions ---------------------------------------------------------------------------------------------

export function selectFish(id: string | null) {
  unlock();
  startAmbient();
  if (id && pairWith.value) return tryPair(id);
  selected.value = id;
  if (id) {
    sfx.select();
    beat('tapped');
    const f = game.value.fish.find((x) => x.id === id);
    if (f && f.hunger > 0.4) beat('hungry');
  }
}

export function startPair(id: string) {
  selected.value = null;
  pairWith.value = id;
}
export const cancelPair = () => (pairWith.value = null);

export function tryPair(otherId: string) {
  const a = pairWith.value;
  if (!a) return;
  if (a === otherId) return cancelPair();
  const r = act((s) => W.breed(s, a, otherId, Date.now()));
  if (W.failed(r)) {
    sfx.nope();
    return toast(r.error, 'bad');
  }
  pairWith.value = null;
  sfx.love();
  emit({ kind: 'hearts', fishId: a });
  emit({ kind: 'hearts', fishId: otherId });
  toast(r.events.length ? `Eggs laid! ${r.events.map((e) => e.text).join('; ')}` : 'Eggs laid!', 'good');
  beat('paired');
}

export function breedPair(a: string, b: string) {
  pairWith.value = a;
  tryPair(b);
}

/** Pair from the Lab: the blanket drops over both breeding tanks, wiggles, lifts, and then the rule runs. */
export function labSpawn() {
  const [a, b] = labPair.value;
  if (!a || !b || labBusy.value) return;
  const why = W.breedProblem(game.value, game.value.fish.find((f) => f.id === a), game.value.fish.find((f) => f.id === b), Date.now());
  if (why) return toast(why, 'bad');
  labBusy.value = true;
  emit({ kind: 'blanket' });
  setTimeout(() => {
    breedPair(a, b);
    labBusy.value = false;
  }, reducedMotion() ? 300 : 3400);
}

export function biteFish(id: string) {
  act((s) => W.feed(s, id));
  if (!W.seen(game.value, 'ob-fed')) beat('fed');
}

export function feedTank() {
  unlock();
  act((s) => W.feedAll(s, 0.35, activeTank.value));
  emit({ kind: 'feedAll' });
  sfx.plip();
  beat('fed');
}

export function sellFish(id: string) {
  const r = act((s) => W.sell(s, id, Date.now()));
  if (W.failed(r)) return toast(r.error, 'bad');
  emit({ kind: 'sold', fishId: id });
  selected.value = null;
  sfx.coin();
  toast(`Sold for ${r.price} ◎`, 'gold');
  if (r.price > 200) react('big-sale');
}

/** Start a pod launch: a countdown, then the rule, then the trip to the Bridge. */
export function launch(fishId: string, regionId: string, orderId?: string) {
  if (launching.value) return;
  const s = game.value;
  const f = s.fish.find((x) => x.id === fishId);
  if (!f) return;
  if (orderId) {
    const o = s.orders.find((x) => x.id === orderId);
    if (!o || !W.meetsAll(f.code, o.reqs)) return toast('This fish doesn’t meet every requirement.', 'bad');
  } else {
    const why = W.seedProblem(s, f, W.regionById(s, regionId));
    if (why) return toast(why, 'bad');
  }
  const short = s.settings.shortPods || s.stats.seeded >= 3;
  selected.value = null;
  seeding.value = null;
  launching.value = { fishId, regionId, orderId, count: short ? 1 : 3 };
  const step = () => {
    const l = launching.value;
    if (!l) return;
    if (l.count > 0) {
      sfx.blip();
      launching.value = { ...l, count: l.count - 1 };
      setTimeout(step, short ? 350 : 700);
      return;
    }
    fire(l);
  };
  step();
}

export const skipLaunch = () => launching.value && launching.value.count > 0 && fire(launching.value);

function fire(l: NonNullable<typeof launching.value>) {
  const code = game.value.fish.find((x) => x.id === l.fishId)?.code ?? '';
  const r = l.orderId ? act((s) => W.fulfil(s, l.orderId!, l.fishId, Date.now())) : act((s) => W.seedFree(s, l.fishId, l.regionId, Date.now()));
  if (W.failed(r)) {
    launching.value = null;
    return toast(r.error, 'bad');
  }
  launching.value = { ...l, count: -1 };
  sfx.launch();
  emit({ kind: 'launch', fishId: l.fishId, code, regionId: l.regionId });
  const drop = r.drop;
  setTimeout(() => {
    room.value = 'bridge';
    focusRegion.value = l.regionId;
  }, game.value.settings.shortPods ? 200 : 700);
  setTimeout(() => {
    emit({ kind: 'splash', regionId: l.regionId, clean: drop.clean, code, gag: game.value.stats.seeded + game.value.stats.orders });
    sfx.splash();
    launching.value = null;
    const label = W.regionLabel(drop.region);
    if ('order' in r) {
      sfx.coin();
      toast(`+${r.order.reward} ◎ · +${r.order.bloom} bloom · ${label}`, 'gold');
    } else toast(`Seeded into ${label}. +${r.bloom} bloom`, 'good');
    if (drop.tokens) toast(`+${drop.tokens} vote${drop.tokens > 1 ? 's' : ''} for ${label}’s name`);
    if (drop.clean) react('clean-drop', drop.region.id);
    else if (drop.perfect) react('perfect', drop.region.id);
    if (game.value.stats.seeded === 1) {
      beat('landed');
      setTimeout(() => beat('shop'), 9000);
    }
    handle(r.events);
  }, game.value.settings.shortPods ? 700 : 1900);
}

export function buy<T extends { error?: string }>(rule: (s: W.State) => T, done?: (r: T) => void) {
  const r = act(rule);
  if (W.failed(r)) {
    sfx.nope();
    return toast(r.error, 'bad');
  }
  sfx.coin();
  done?.(r);
}

export function handOverWork(fishId: string) {
  const r = act((s) => W.handOver(s, fishId, Date.now()));
  if (W.failed(r)) return toast(r.error, 'bad');
  sfx.coin();
  selected.value = null;
  queueComms({ id: `${r.work.id}:thanks`, panels: [{ who: r.work.who, mood: 'grin', text: r.work.thanks }] });
}

export function askProf() {
  unlock();
  profOpen.value = W.profHint(game.value, Date.now());
}

export function setSetting<K extends keyof W.Settings>(k: K, v: W.Settings[K]) {
  act((s) => void (s.settings[k] = v));
}

export function goRoom(r: Room) {
  room.value = r;
  if (r === 'pip') commsUnread.value = 0;
  if (r === 'bridge' && game.value.stats.orders === 0 && game.value.orders.length) beat('window');
  if (r === 'interchange') beat('shop');
}

/** Put the cutting being placed into a decor slot. */
export function placeCutting(slot: number) {
  const i = placing.value;
  if (i == null) return;
  const r = act((s) => W.plant(s, i, slot, activeTank.value));
  if (W.failed(r)) {
    sfx.nope();
    return toast(r.error, 'bad');
  }
  placing.value = null;
  sfx.plip();
  toast('Planted.', 'good');
}

export function tapEgg(egg: W.Egg) {
  const left = Math.max(0, egg.hatchAt - Date.now());
  const mmss = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  toast(`${egg.roe ? 'Cryo-roe thawing' : 'Eggs'}: ${mmss} to go`);
}

export function closeBriefing() {
  briefing.value = null;
}

export const chapter = computed(() => CHAPTERS[game.value.story.chapter] ?? CHAPTERS[0]);

// --- clock and save -------------------------------------------------------------------------------------

let dirty = false;
let saveTimer: ReturnType<typeof setInterval> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;

export async function save() {
  if (!dirty) return;
  dirty = false;
  try {
    await backend.save.store(game.value);
  } catch {
    dirty = true;
  }
}

function step() {
  const t = Date.now();
  const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
  let events: W.GameEvent[] = [];
  batch(() => {
    now.value = t;
    events = act((s) => W.tick(s, t, visible));
  });
  handle(events);
  ambientTick(orbit.value.light);
  if (!visible) return;
  const amb = W.pickAmbient(game.value, busy.value || commsQueue.value.length > 0);
  if (amb) queueComms(amb, true);
  const work = W.offerWork(structuredClone(game.value));
  if (work) {
    act((s) => W.offerWork(s));
    queueComms({ id: `${work.id}:ask`, tags: ['work'], panels: [{ who: work.who, mood: 'talk', text: work.ask }, { who: 'pip', mood: 'calm', text: `Work order added: ${work.title}. Hand a fish over from its dossier.`, side: 'right' }] });
  }
}

/** Load (or migrate, or start) a game and start the clocks. */
export async function boot(b: Backend = backend) {
  backend = b;
  const t = Date.now();
  let s: W.State | null = null;
  try {
    s = W.restore(await b.save.load(), t);
  } catch {
    s = null;
  }
  let migrated = false;
  if (!s && b.save.legacy) {
    s = W.restore(b.save.legacy(), t);
    migrated = Boolean(s);
  }
  const fresh = !s;
  s ??= W.newGame(t, Math.random().toString(36).slice(2, 10));
  const away = t - s.lastTick;
  game.value = s;
  for (const r of s.regions) if (r.opened) openPoll(r);
  const ev = act((d) => W.tick(d, t));
  const hatched = ev.filter((e) => e.kind === 'hatched').length;
  if (!fresh && away > 60_000) toast(`Welcome back. ${hatched ? `${hatched} egg${hatched > 1 ? 's' : ''} hatched while you were away.` : 'The tank kept itself ticking.'}`);
  if (migrated) toast('Imported your FISH IN SPACE! v2 save', 'gold');
  dirty = true;
  ready.value = true;
  if (fresh) wakeUp();
  tickTimer ??= setInterval(step, 1000);
  saveTimer ??= setInterval(() => void save(), 5000);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void save();
      else step();
    });
    addEventListener('pagehide', () => void save());
  }
}

/** Start over (Settings → New game). */
export async function resetGame() {
  await backend.save.clear?.();
  game.value = W.newGame(Date.now(), Math.random().toString(36).slice(2, 10));
  commsQueue.value = [];
  dirty = true;
  await save();
  activeTank.value = 'T1';
  wakeUp();
}

function wakeUp() {
  waking.value = true;
  setTimeout(() => (waking.value = false), 3200);
  setTimeout(() => (beat('start'), beat('tanks')), 2400);
}

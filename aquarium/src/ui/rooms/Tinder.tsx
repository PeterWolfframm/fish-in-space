// Fish-der. A dating app for fresh procgen fish: the deck, a gallery of every fish you liked, stats on
// what you go for, and the tier board where you rank them S to D, behind its own tab bar. On a phone it
// takes the whole screen; "Return to fish" goes back to the station.
//
// On a card: drag right to like, left to nope (or the buttons, or ← →, Backspace to rewind). A short
// swipe up, the "more" button, Space or I slides the full profile up over the fish. A super like takes
// a long, deliberate swipe up (or the ★ button, or ↑) and puts the fish straight into S tier.

import { useEffect, useRef, useState } from 'preact/hooks';
import * as T from '../../game/tinder';
import { cap } from '../../game/fish';
import { deck, swipe, undo, canUndo, scores, taste, training, publicModel, liked, swipes, tiers, tab, moveTo, forget, initTinder } from '../../store/tinder';
import { isMember } from '../../store/auth';
import { room, goRoom, toast } from '../../store/signals';
import { sfx } from '../../audio/sfx';
import { SpriteArt } from '../Art';
import { reducedMotion } from '../theme';

const THROW = 110; // px past which a sideways release decides
const FLICK = 0.55; // px/ms that decides however short the drag
const INFO_UP = 60; // px up that opens the profile
const SUPER_FLICK = 1.6; // px/ms up that super likes, if the drag is long enough too
const SHOWN = 3;

const pct = (v: number | null | undefined) => (v == null ? null : Math.max(1, Math.min(99, Math.round(v * 100))));
const after = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** How far up a drag has to go to super like: most of the card, never less than 260 px. */
const superAt = (el: HTMLElement) => Math.max(260, el.offsetHeight * 0.55);

type Dir = 'like' | 'nope' | 'super';
type Tab = typeof tab.value;

// ---------------------------------------------------------------- the app shell

export function Fishder() {
  useEffect(() => void initTinder(), []);
  const t = tab.value;
  return (
    <div class={`tinder tab-${t}`}>
      <header class="tinder-top">
        <span class="tinder-logo" aria-hidden="true">
          <i />
        </span>
        <h2>fish-der</h2>
        <NetStatus />
      </header>
      <main class="fd-body">
        {t === 'swipe' && <Deck />}
        {t === 'gallery' && <Gallery />}
        {t === 'stats' && <Stats />}
        {t === 'tiers' && <TierBoard />}
      </main>
      <TabBar />
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: () => preact.JSX.Element }[] = [
  { id: 'swipe', label: 'Swipe', icon: IconFish },
  { id: 'gallery', label: 'Gallery', icon: IconHeart },
  { id: 'stats', label: 'Your stats', icon: IconBars },
  { id: 'tiers', label: 'Tier list', icon: IconTiers },
];

function TabBar() {
  const n = liked.value.length;
  return (
    <nav class="fd-tabs" aria-label="Fish-der">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} class={`fd-tab t-${id}`} aria-label={label} title={label} aria-current={tab.value === id ? 'page' : undefined} onClick={() => (tab.value = id)}>
          <Icon />
          {id === 'gallery' && n > 0 && <span class="fd-count">{n > 99 ? '99+' : n}</span>}
        </button>
      ))}
      <button class="fd-tab back only-mobile" aria-label="Return to fish" title="Return to fish" onClick={() => goRoom('hatchery')}>
        <IconBack />
        <small>fish</small>
      </button>
    </nav>
  );
}

function IconFish() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12c3-4.5 7-6.5 11-6.5 3.2 0 5.6 2 7 6.5-1.4 4.5-3.8 6.5-7 6.5-4 0-8-2-11-6.5zm0 0L1 7.5M2.5 12 1 16.5" />
      <circle cx="16.5" cy="10.5" r="1.1" class="fill" />
    </svg>
  );
}
function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.5s-8-4.8-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.7c0 5.8-8 10.6-8 10.6z" />
    </svg>
  );
}
function IconBars() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h16M6.5 20v-6M11 20V6M15.5 20v-9M20 20v-4" />
    </svg>
  );
}
function IconTiers() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 5.5h3M9 5.5h12M3 12h3M9 12h8M3 18.5h3M9 18.5h5" />
    </svg>
  );
}
function IconBack() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 6 3.5 12l6 6M3.5 12h11a6 6 0 0 1 6 6" />
    </svg>
  );
}

function NetStatus() {
  const t = taste.value;
  const p = publicModel.value;
  const label = training.value ? 'learning your type…' : t ? `taste net · ${t.swipes} swipes${t.fromPublic ? ' + crew' : ''}` : p ? `crew net · ${p.swipes} swipes` : 'taste net wakes after a few likes and nopes';
  return (
    <span class={`net ${training.value ? 'busy' : ''}`} title="The pixelgen net learns only from Fish-der swipes">
      <i aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------- the deck

function Deck() {
  const cards = deck.value.slice(0, SHOWN);
  const topRef = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const [back, setBack] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const infoRef = useRef(info);
  infoRef.current = info;

  /** Throw the top card out, then record the swipe. */
  const decide = async (dir: Dir, from = { x: 0, y: 0, vx: 0, vy: 0 }) => {
    const el = topRef.current;
    if (busy.current || !deck.peek().length) return;
    busy.current = true;
    setInfo(false);
    if (el) {
      el.classList.add('flying');
      el.style.setProperty(`--${dir}`, '1');
      if (reducedMotion()) {
        el.style.opacity = '0';
        await after(160);
      } else {
        if (!from.x && !from.y) {
          // A button or key: a little wind-up before the throw.
          pose(el, dir === 'super' ? 0 : dir === 'like' ? 26 : -26, dir === 'super' ? 18 : -6);
          await after(90);
        }
        const w = innerWidth / 2 + el.offsetWidth;
        const tx = dir === 'super' ? from.x : (dir === 'like' ? 1 : -1) * w;
        const ty = dir === 'super' ? -innerHeight : from.y + from.vy * 220;
        const spin = dir === 'super' ? 0 : (dir === 'like' ? 1 : -1) * (22 + Math.min(20, Math.abs(from.vx) * 12));
        el.style.transform = `translate(${tx}px, ${ty}px) rotate(${spin}deg)`;
        el.style.opacity = '0';
        await after(380);
      }
    }
    if (dir === 'nope') sfx.nope();
    else if (dir === 'super') sfx.phase();
    else sfx.love();
    const s = swipe(dir === 'nope' ? 'pass' : 'approve', dir === 'super');
    busy.current = false;
    if (s?.superlike) toast(`★ ${T.profileOf(s.code).name} went straight to S tier.`, 'good');
  };

  const rewind = () => {
    if (busy.current) return;
    const s = undo();
    if (!s) return;
    sfx.select();
    setInfo(false);
    setBack(s.verdict === 'pass' ? 'from-left' : s.superlike ? 'from-top' : 'from-right');
    setTimeout(() => setBack(null), 520);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (room.peek() !== 'tinder' || tab.peek() !== 'swipe' || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest?.('input, select, textarea')) return;
      if (infoRef.current) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'i') {
          e.preventDefault();
          setInfo(false);
        }
        return;
      }
      const act = {
        ArrowLeft: () => decide('nope'),
        ArrowRight: () => decide('like'),
        ArrowUp: () => decide('super'),
        Backspace: rewind,
        ' ': () => setInfo(true),
        i: () => setInfo(true),
      }[e.key];
      if (act && !(e.key === ' ' && (e.target as HTMLElement)?.closest?.('button'))) {
        e.preventDefault();
        act();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div class="deck" aria-live="polite">
        {cards.length === 0 && <p class="empty">Rolling fresh fish…</p>}
        {cards
          .map((c, i) => (
            <ProfileCard
              key={c.seed + c.code}
              card={c}
              depth={i}
              back={i === 0 ? back : null}
              info={i === 0 && info}
              setInfo={setInfo}
              cardRef={i === 0 ? (el) => (topRef.current = el) : undefined}
              onDecide={i === 0 ? decide : undefined}
            />
          ))
          .reverse()}
      </div>
      <div class="tinder-acts" role="group" aria-label="Swipe">
        <button class="act rewind" title="Rewind (Backspace)" aria-label="Rewind" disabled={!canUndo.value} onClick={rewind}>
          ↺
        </button>
        <button class="act nope big" title="Nope (←)" aria-label="Nope" disabled={!cards.length} onClick={() => decide('nope')}>
          ✕
        </button>
        <button class="act super" title="Super like: straight to S tier (↑)" aria-label="Super like" disabled={!cards.length} onClick={() => decide('super')}>
          ★
        </button>
        <button class="act like big" title="Like (→)" aria-label="Like" disabled={!cards.length} onClick={() => decide('like')}>
          ♥
        </button>
      </div>
    </>
  );
}

/**
 * Lean the card toward where it is going and fade in its stamp. Going up, the "more" hint shows first;
 * past it the super like stamp charges, filling only as the drag nears the super threshold.
 */
function pose(el: HTMLElement, x: number, y: number) {
  el.style.transform = `translate(${x}px, ${y}px) rotate(${x / 16}deg)`;
  const vertical = y < 0 && Math.abs(y) > Math.abs(x);
  const up = vertical ? -y : 0;
  const charge = vertical ? clamp01((up - INFO_UP) / (superAt(el) - INFO_UP)) : 0;
  el.style.setProperty('--like', String(vertical ? 0 : clamp01(x / THROW)));
  el.style.setProperty('--nope', String(vertical ? 0 : clamp01(-x / THROW)));
  el.style.setProperty('--more', String(vertical ? clamp01(up / INFO_UP) * (1 - charge * 1.6) : 0));
  el.style.setProperty('--super', String(charge));
  el.classList.toggle('charged', vertical && up >= superAt(el));
}

function spring(el: HTMLElement) {
  el.classList.add('spring');
  el.classList.remove('charged');
  el.style.transform = '';
  for (const k of ['--like', '--nope', '--super', '--more']) el.style.setProperty(k, '0');
  setTimeout(() => el.classList.remove('spring'), 450);
}

interface CardProps {
  card: T.Card;
  depth: number;
  back: string | null;
  info: boolean;
  setInfo: (v: boolean) => void;
  cardRef?: (el: HTMLElement | null) => void;
  onDecide?: (dir: Dir, from?: { x: number; y: number; vx: number; vy: number }) => void;
}

function ProfileCard({ card, depth, back, info, setInfo, cardRef, onDecide }: CardProps) {
  const p = T.profileOf(card.code);
  const photos = T.photosOf(card.code);
  const [photo, setPhoto] = useState(0);
  const el = useRef<HTMLElement>(null);
  const top = depth === 0;
  const score = pct(scores.value[card.code]);

  useEffect(() => {
    cardRef?.(el.current);
    return () => cardRef?.(null);
  }, [cardRef]);

  // Dragging: the card follows the finger, tilted toward where it is going, its stamp fading in.
  useEffect(() => {
    const node = el.current;
    if (!node || !top || !onDecide) return;
    let start: { x: number; y: number } | null = null;
    let moved = false;
    let charged = false;
    let trail: { x: number; y: number; t: number }[] = [];
    const at = (e: PointerEvent) => ({ x: e.clientX - start!.x, y: e.clientY - start!.y, t: e.timeStamp });
    const down = (e: PointerEvent) => {
      if (e.button || (e.target as HTMLElement).closest('button, .info-sheet')) return;
      start = { x: e.clientX, y: e.clientY };
      moved = false;
      charged = false;
      trail = [{ x: 0, y: 0, t: e.timeStamp }];
      node.setPointerCapture(e.pointerId);
      node.classList.add('dragging');
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const q = at(e);
      if (Math.hypot(q.x, q.y) > 6) moved = true;
      trail.push(q);
      if (trail.length > 6) trail.shift();
      pose(node, q.x, q.y);
      const now = -q.y >= superAt(node) && Math.abs(q.x) < THROW;
      if (now && !charged) navigator.vibrate?.(15);
      charged = now;
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const q = at(e);
      const old = trail.find((r) => q.t - r.t < 120) ?? trail[0];
      const dt = Math.max(1, q.t - old.t);
      const v = { vx: (q.x - old.x) / dt, vy: (q.y - old.y) / dt };
      start = null;
      node.classList.remove('dragging');
      const from = { x: q.x, y: q.y, ...v };
      if (!moved) {
        // A tap on the photo flips through the photos, like the real thing.
        const r = node.querySelector('.photo')?.getBoundingClientRect();
        if (r && e.clientY < r.bottom) setPhoto((i) => (e.clientX < r.left + r.width / 2 ? Math.max(0, i - 1) : Math.min(photos.length - 1, i + 1)));
        return spring(node);
      }
      const sideways = Math.abs(q.x) > Math.abs(q.y) * 0.6;
      if (q.x > THROW || (sideways && v.vx > FLICK && q.x > 20)) onDecide('like', from);
      else if (q.x < -THROW || (sideways && v.vx < -FLICK && q.x < -20)) onDecide('nope', from);
      else if (Math.abs(q.x) < THROW && (-q.y >= superAt(node) || (v.vy < -SUPER_FLICK && q.y < -160))) onDecide('super', from);
      else {
        if (q.y < -INFO_UP && Math.abs(q.y) > Math.abs(q.x) * 1.5) setInfo(true);
        spring(node);
      }
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
    };
  }, [top, onDecide, photos.length]);

  return (
    <article
      ref={el}
      class={`tcard ${top ? 'top' : ''} ${back ?? ''} r-${p.rarity}`}
      style={{ '--depth': depth, zIndex: 10 - depth }}
      aria-hidden={top ? undefined : 'true'}
      aria-label={top ? `${p.name}, ${p.age}` : undefined}
    >
      <PhotoStrip photos={photos} at={top ? photo : 0} live={top} name={p.name}>
        <span class="stamp like" aria-hidden="true">
          LIKE
        </span>
        <span class="stamp nope" aria-hidden="true">
          NOPE
        </span>
        <span class="stamp super" aria-hidden="true">
          SUPER LIKE
        </span>
        <span class="hint-more" aria-hidden="true">
          ▴ more
        </span>
        {score != null && (
          <span class={`compat ${score >= 66 ? 'hot' : score < 34 ? 'cold' : ''}`} title="How much the taste net thinks you'll like this one">
            {score}% your type
          </span>
        )}
      </PhotoStrip>
      <Short p={p} />
      {top && (
        <button class="more" aria-expanded={info} onClick={() => setInfo(true)}>
          more <span aria-hidden="true">▴</span>
        </button>
      )}
      {top && <InfoSheet code={card.code} open={info} onClose={() => setInfo(false)} />}
    </article>
  );
}

/** The photo area: pips, the current page (one fish, or two life stages side by side), its label. */
function PhotoStrip({
  photos,
  at,
  live,
  name,
  onPick,
  children,
}: {
  photos: T.Photo[];
  at: number;
  live: boolean;
  name: string;
  onPick?: (i: number) => void;
  children?: preact.ComponentChildren;
}) {
  const ph = photos[Math.min(at, photos.length - 1)];
  const tap = onPick
    ? (e: MouseEvent) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onPick(e.clientX < r.left + r.width / 2 ? Math.max(0, at - 1) : Math.min(photos.length - 1, at + 1));
      }
    : undefined;
  return (
    <div class="photo" onClick={tap}>
      <div class="pips" aria-hidden="true">
        {photos.map((_, i) => (
          <i key={i} class={i === at ? 'on' : ''} />
        ))}
      </div>
      {at > 0 && (
        <span class="photo-label" aria-hidden="true">
          {ph.label}
        </span>
      )}
      {ph.shots.length === 1 ? (
        <SpriteArt family="fish3" code={ph.shots[0].code} anim={live ? ph.shots[0].anim : 'swim'} scale={4} animate={live} label={live ? `${name}, ${ph.label}` : undefined} />
      ) : (
        <div class="stage-pair">
          {ph.shots.map((s) => (
            <figure key={s.code}>
              <SpriteArt family="fish3" code={s.code} anim={s.anim} scale={6} animate={live} label={`${name} as ${s.caption}`} />
              <figcaption>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/** The short info under the photo: name, age, a line of facts, the bio, three interests. */
function Short({ p }: { p: T.Profile }) {
  return (
    <footer class="who">
      <div class="nameline">
        <h3>
          {p.name}
          <span class="age">{p.age}</span>
        </h3>
        {(p.rarity === 'rare' || p.rarity === 'myth') && (
          <span class="verified" title={`${p.rarity} roll`}>
            ✓
          </span>
        )}
      </div>
      <p class="sub">
        {p.sex === 'f' ? '♀' : '♂'} {p.stage}
        {p.title ? ` · ${p.title}` : ''} · {p.distance}
      </p>
      <p class="bio">{p.bio}</p>
      <div class="chips">
        {p.signature && <span class="chip r-myth">✦ {p.signature}</span>}
        {p.interests.slice(0, 3).map((x) => (
          <span key={x} class="chip">
            {x}
          </span>
        ))}
      </div>
    </footer>
  );
}

/**
 * The full profile, slid up over the fish. Swipe up to read on; swipe up again once at the end (or
 * down from the top, or ▾, or Esc) and it slides away, back to the fish.
 */
function InfoSheet({ code, open, onClose }: { code: string; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (open) ref.current?.scrollTo({ top: 0 });
  }, [open, code]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let start: { y: number; atEnd: boolean; atTop: boolean } | null = null;
    const begin = (y: number) =>
      (start = { y, atEnd: node.scrollTop + node.clientHeight >= node.scrollHeight - 2, atTop: node.scrollTop <= 0 });
    const end = (y: number) => {
      if (!start) return;
      const dy = y - start.y;
      if ((dy < -INFO_UP && start.atEnd) || (dy > INFO_UP && start.atTop)) close.current();
      start = null;
    };
    const ts = (e: TouchEvent) => begin(e.touches[0].clientY);
    const te = (e: TouchEvent) => end(e.changedTouches[0].clientY);
    const pd = (e: PointerEvent) => e.pointerType === 'mouse' && !e.button && !(e.target as HTMLElement).closest('button') && begin(e.clientY);
    const pu = (e: PointerEvent) => e.pointerType === 'mouse' && end(e.clientY);
    node.addEventListener('touchstart', ts, { passive: true });
    node.addEventListener('touchend', te);
    node.addEventListener('pointerdown', pd);
    node.addEventListener('pointerup', pu);
    return () => {
      node.removeEventListener('touchstart', ts);
      node.removeEventListener('touchend', te);
      node.removeEventListener('pointerdown', pd);
      node.removeEventListener('pointerup', pu);
    };
  }, []);

  return (
    <section ref={ref} class={`info-sheet ${open ? 'open' : ''}`} aria-hidden={open ? undefined : 'true'} aria-label="Profile">
      <button class="sheet-close" aria-label="Back to the fish" onClick={onClose}>
        ▾
      </button>
      {open && <InfoBody code={code} />}
      <p class="sheet-end note" aria-hidden="true">
        swipe up again to go back to the fish
      </p>
    </section>
  );
}

function InfoBody({ code }: { code: string }) {
  const p = T.profileOf(code);
  const facts = T.factsOf(code);
  return (
    <div class="info-body">
      <header>
        <h3>
          {p.name}
          <span class="age">{p.age}</span>
        </h3>
        <p class="sub">{p.distance}</p>
      </header>
      <section>
        <h4>About me</h4>
        <p class="bio">{p.bio}</p>
        <div class="prompt">
          <b>{p.prompt.q}</b>
          <p>{p.prompt.a}</p>
        </div>
      </section>
      <section>
        <h4>Looking for</h4>
        <p>{p.lookingFor}</p>
      </section>
      <section>
        <h4>Interests</h4>
        <div class="chips">
          {p.signature && <span class="chip r-myth">✦ {p.signature}</span>}
          {p.interests.map((x) => (
            <span key={x} class="chip">
              {x}
            </span>
          ))}
        </div>
      </section>
      {facts.map((s) => (
        <section key={s.title}>
          <h4>{s.title}</h4>
          <dl class="facts">
            {s.rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {(p.dealbreakers || p.codex.length > 0) && (
        <section>
          <h4>Lore</h4>
          {p.dealbreakers && (
            <p>
              <b>Dealbreakers</b> {p.dealbreakers}
            </p>
          )}
          {p.codex.map((c) => (
            <p key={c} class="note">
              {c}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- gallery

function Gallery() {
  const [view, setView] = useState<string | null>(null);
  const all = liked.value;
  const shown = all.find((s) => s.id === view);
  if (shown) return <LikedProfile key={shown.id} s={shown} onClose={() => setView(null)} />;
  if (!all.length) return <p class="empty fd-empty">No likes yet. Swipe right on a fish you like and it shows up here.</p>;
  return (
    <div class="fd-scroll">
      <div class="section-title">
        <h3>Your likes</h3>
        <span class="note">{all.length} fish · tap one for its profile</span>
      </div>
      <div class="like-grid">
        {all.map((s) => {
          const p = T.profileOf(s.code);
          const rank = T.rankOf(tiers.value, s.code);
          return (
            <button key={s.id} class={`like-cell ${s.superlike ? 'super' : ''}`} onClick={() => setView(s.id)}>
              <SpriteArt family="fish3" code={s.code} anim="swim" scale={2} />
              <span class="nm">
                {p.name}
                <span class="age">{p.age}</span>
              </span>
              <span class="tag">
                {s.superlike && <i class="sl">★</i>}
                {rank && rank !== 'pool' && <i class={`rk t-${rank}`}>{rank}</i>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LikedProfile({ s, onClose }: { s: T.TinderSwipe; onClose: () => void }) {
  const p = T.profileOf(s.code);
  const photos = T.photosOf(s.code);
  const [photo, setPhoto] = useState(0);
  const [info, setInfo] = useState(false);
  const rank = T.rankOf(tiers.value, s.code);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (info) setInfo(false);
      else onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [info]);

  return (
    <div class="liked-view">
      <button class="fd-back" onClick={onClose}>
        ‹ Gallery
      </button>
      <article class={`tcard top still r-${p.rarity}`} aria-label={`${p.name}, ${p.age}`}>
        <PhotoStrip photos={photos} at={photo} live name={p.name} onPick={setPhoto}>
          {s.superlike && <span class="badge-super">★ super like</span>}
        </PhotoStrip>
        <Short p={p} />
        <button class="more" aria-expanded={info} onClick={() => setInfo(true)}>
          more <span aria-hidden="true">▴</span>
        </button>
        <InfoSheet code={s.code} open={info} onClose={() => setInfo(false)} />
      </article>
      <div class="rank-row">
        <span class="note">Rank</span>
        {[...T.RANKS, 'pool' as const].map((r) => (
          <button key={r} class={`btn small ${rank === r ? 'lamp' : 'ghost'} tier-pick t-${r}`} aria-pressed={rank === r} onClick={() => moveTo(s.code, r)}>
            {r === 'pool' ? '–' : r}
          </button>
        ))}
        <button
          class="btn small ghost unlike"
          onClick={() => {
            forget(s.id);
            onClose();
            toast('Unliked. The net forgets it.');
          }}
        >
          Unlike
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- stats

function Stats() {
  const all = swipes.value;
  const likes = all.filter((s) => s.verdict === 'approve');
  const supers = likes.filter((s) => s.superlike).length;
  const prefs = T.preferences(all);
  if (!all.length) return <p class="empty fd-empty">Swipe a few fish and this fills up with what you go for.</p>;
  return (
    <div class="fd-scroll stats">
      <div class="stat-tiles">
        <Tile n={all.length} label="swipes" />
        <Tile n={`${Math.round((likes.length / all.length) * 100)}%`} label="liked" />
        <Tile n={supers} label="super likes" />
        <Tile n={tiers.value.S.length} label="in S tier" />
      </div>
      <YourType />
      <section class="card prefs">
        <h4>What you like</h4>
        <p class="note">Share of each kind of fish you swiped right on. Super likes count twice.</p>
        {prefs.length === 0 && <p class="note">Needs a few more swipes on each kind of fish.</p>}
        {prefs.map((pr) => (
          <div key={pr.trait} class="pref">
            <h5>{pr.trait}</h5>
            {pr.rows.map((r) => {
              const share = r.likes / r.total;
              return (
                <div key={r.value} class="pref-row" title={`${cap(r.value)}: liked ${r.likes} of ${r.total}`}>
                  <span class="k">{cap(r.value)}</span>
                  <span class="bar" aria-hidden="true">
                    <i style={{ width: `${share * 100}%` }} />
                  </span>
                  <span class="v">{Math.round(share * 100)}%</span>
                </div>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
}

function Tile({ n, label }: { n: number | string; label: string }) {
  return (
    <div class="stat-tile">
      <b>{n}</b>
      <small>{label}</small>
    </div>
  );
}

function YourType() {
  const t = taste.value;
  return (
    <section class="card your-type">
      <h4>Your type</h4>
      {!t ? (
        <p class="note">Swipe a few more and the taste net works out what you go for. It learns from Fish-der and nothing else.</p>
      ) : (
        <>
          {t.likes.length > 0 && (
            <p>
              <b class="good">Into</b> {t.likes.join(', ')}
            </p>
          )}
          {t.dislikes.length > 0 && (
            <p>
              <b class="bad">Not into</b> {t.dislikes.join(', ')}
            </p>
          )}
          <p class="note">
            Learnt from your {t.swipes} swipes{t.fromPublic ? ', on top of the whole crew’s' : ''}.{' '}
            {isMember() ? 'Your swipes also train the crew net.' : 'Sign in to send your swipes to the crew net.'}
          </p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- tier list

const TIER_WORDS: Record<T.Rank, string> = { S: 'soulmate', A: 'adore', B: 'cute', C: 'fine', D: 'why', pool: 'unranked' };

/**
 * S to D rows and an unranked pool. Drag a fish onto a row (in front of another to order it), or tap
 * one to pick it up and tap a row to drop it there: the same on a phone and with a mouse.
 */
function TierBoard() {
  const t = tiers.value;
  const [held, setHeld] = useState<string | null>(null);
  const [hot, setHot] = useState<T.Rank | null>(null);
  const ghost = useRef<HTMLElement | null>(null);
  const drag = useRef<{ code: string; x: number; y: number; moved: boolean } | null>(null);

  const targetAt = (x: number, y: number) => {
    const under = document.elementFromPoint(x, y) as HTMLElement | null;
    const row = under?.closest<HTMLElement>('[data-rank]');
    const before = under?.closest<HTMLElement>('[data-code]')?.dataset.code ?? null;
    return { rank: (row?.dataset.rank as T.Rank | undefined) ?? null, before };
  };

  const down = (code: string) => (e: PointerEvent) => {
    if (e.button) return;
    drag.current = { code, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    if (!d.moved) {
      d.moved = true;
      const src = (e.currentTarget as HTMLElement).querySelector('canvas');
      const g = document.createElement('div');
      g.className = 'tier-ghost';
      if (src) {
        const c = document.createElement('canvas');
        c.width = src.width;
        c.height = src.height;
        c.getContext('2d')!.drawImage(src, 0, 0);
        g.append(c);
      }
      document.body.append(g);
      ghost.current = g;
    }
    ghost.current!.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    setHot(targetAt(e.clientX, e.clientY).rank);
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    ghost.current?.remove();
    ghost.current = null;
    setHot(null);
    if (!d) return;
    if (!d.moved) {
      // A tap: pick it up, or put it down again.
      setHeld(held === d.code ? null : d.code);
      return;
    }
    const { rank, before } = targetAt(e.clientX, e.clientY);
    if (rank) {
      moveTo(d.code, rank, before);
      sfx.plip();
    }
    setHeld(null);
  };
  const drop = (rank: T.Rank) => {
    if (!held) return;
    moveTo(held, rank);
    sfx.plip();
    setHeld(null);
  };

  const fishIn = (rank: T.Rank) =>
    t[rank].map((code) => (
      <button
        key={code}
        data-code={code}
        class={`tier-fish ${held === code ? 'held' : ''}`}
        title={T.profileOf(code).name}
        aria-label={`${T.profileOf(code).name}${held === code ? ', picked up' : ''}`}
        aria-pressed={held === code}
        onPointerDown={down(code)}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={(e) => e.stopPropagation()}
      >
        <SpriteArt family="fish3" code={code} anim="swim" scale={2} />
      </button>
    ));

  const total = T.RANKS.reduce((n, r) => n + t[r].length, 0) + t.pool.length;
  if (!total) return <p class="empty fd-empty">Like a few fish and they will wait here to be ranked. Super likes go straight to S.</p>;
  return (
    <div class="fd-scroll stack tier-board">
      <p class="note">{held ? `Tap a row to drop ${T.profileOf(held).name} there.` : 'Drag a fish onto a row, or tap it and then tap a row.'}</p>
      {T.RANKS.map((r) => (
        <div key={r} class={`tier t-${r} ${hot === r ? 'hot' : ''} ${held ? 'armed' : ''}`} data-rank={r} onClick={() => drop(r)}>
          <span class="tier-badge">
            <b>{r}</b>
            <small>{TIER_WORDS[r]}</small>
          </span>
          <div class="tier-well">{t[r].length ? fishIn(r) : <span class="tier-empty">—</span>}</div>
        </div>
      ))}
      <div class={`tier pool ${hot === 'pool' ? 'hot' : ''} ${held ? 'armed' : ''}`} data-rank="pool" onClick={() => drop('pool')}>
        <span class="tier-badge">
          <b>?</b>
          <small>{t.pool.length} unranked</small>
        </span>
        <div class="tier-well">{t.pool.length ? fishIn('pool') : <span class="tier-empty">all ranked ✓</span>}</div>
      </div>
    </div>
  );
}

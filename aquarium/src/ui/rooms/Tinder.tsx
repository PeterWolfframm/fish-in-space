// Fish Tinder. The deck sits where a room's scene would be: one fresh procgen fish per card, and a
// photo for every life stage, the juvenile-and-grown pair, the size lineup, and the v1 and v2
// painters. Drag right to like, left to nope, up to super like (or the buttons, or ← → ↑,
// Backspace to rewind, N for feedback). The panel holds your matches, every fish you liked, and
// the tier board where you rank them S to D.

import { useEffect, useRef, useState } from 'preact/hooks';
import * as T from '../../game/tinder';
import { load } from '../../art/atlas';
import { deck, swipe, undo, canUndo, taste, training, publicModel, match, liked, matches, tiers, moveTo, forget, initTinder } from '../../store/tinder';
import { isMember } from '../../store/auth';
import { room, toast } from '../../store/signals';
import { sfx } from '../../audio/sfx';
import { SpriteArt, Portrait } from '../Art';
import { reducedMotion } from '../theme';

const THROW = 110; // px past which a release decides
const FLICK = 0.55; // px/ms that decides however short the drag
const SHOWN = 3;

const pct = (v: number | null | undefined) => (v == null ? null : Math.max(1, Math.min(99, Math.round(v * 100))));
const after = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Dir = 'like' | 'nope' | 'super';

// ---------------------------------------------------------------- the deck

export function TinderDeck() {
  const cards = deck.value.slice(0, SHOWN);
  const topRef = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const [back, setBack] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [draft, setDraft] = useState<T.Feedback>(T.emptyFeedback());
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const restore = useRef<T.Feedback | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => void initTinder(), []);

  const topSeed = cards[0]?.seed ?? null;
  useEffect(() => {
    if (topSeed === draftFor) return;
    setDraftFor(topSeed);
    setDraft(restore.current ?? T.emptyFeedback());
    restore.current = null;
    setNotesOpen(false);
  }, [topSeed]);

  /** Throw the top card out, then record the swipe. */
  const decide = async (dir: Dir, from = { x: 0, y: 0, vx: 0, vy: 0 }) => {
    const el = topRef.current;
    if (busy.current || !deck.peek().length) return;
    busy.current = true;
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
    const fb = draftRef.current;
    const s = swipe(dir === 'nope' ? 'pass' : 'approve', dir === 'super', T.feedbackCount(fb) ? fb : undefined);
    setDraft(T.emptyFeedback());
    setNotesOpen(false);
    busy.current = false;
    if (s?.matched) sfx.hatch();
  };

  const rewind = () => {
    if (busy.current) return;
    const s = undo();
    if (!s) return;
    restore.current = s.feedback ?? T.emptyFeedback();
    sfx.select();
    setNotesOpen(false);
    setBack(s.verdict === 'pass' ? 'from-left' : s.superlike ? 'from-top' : 'from-right');
    setTimeout(() => setBack(null), 520);
  };

  const toggleNotes = () => {
    if (!deck.peek().length || match.peek()) return;
    setNotesOpen((open) => !open);
    sfx.select();
  };

  const keys = useRef({ decide, rewind, toggleNotes });
  keys.current = { decide, rewind, toggleNotes };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (room.peek() !== 'tinder' || match.peek() || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement)?.closest?.('input, select, textarea')) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        keys.current.toggleNotes();
        return;
      }
      if (e.key === 'Escape') {
        setNotesOpen(false);
        return;
      }
      const act = { ArrowLeft: () => keys.current.decide('nope'), ArrowRight: () => keys.current.decide('like'), ArrowUp: () => keys.current.decide('super'), Backspace: () => keys.current.rewind() }[e.key];
      if (act) {
        e.preventDefault();
        act();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const top = cards[0];
  const preview = notesOpen && top && Object.values(draft.instead).some(Boolean) ? T.withInstead(top.code, draft.instead) : null;

  return (
    <div class="tinder">
      <header class="tinder-top">
        <span class="tinder-logo" aria-hidden="true">
          <i />
        </span>
        <h2>fish tinder</h2>
        <NetStatus />
      </header>
      <div class="deck" aria-live="polite">
        {cards.length === 0 && <p class="empty">Rolling fresh fish…</p>}
        {cards
          .map((c, i) => (
            <ProfileCard
              key={c.seed + c.code}
              card={c}
              artCode={i === 0 && preview ? preview : c.code}
              notes={i === 0 ? T.feedbackCount(draft) : 0}
              depth={i}
              back={i === 0 ? back : null}
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
        <button class="act super" title="Super like (↑)" aria-label="Super like" disabled={!cards.length} onClick={() => decide('super')}>
          ★
        </button>
        <button class="act like big" title="Like (→)" aria-label="Like" disabled={!cards.length} onClick={() => decide('like')}>
          ♥
        </button>
        <button class="act feedback" title="Feedback (N)" aria-label="Feedback" aria-expanded={notesOpen} disabled={!cards.length} onClick={toggleNotes}>
          ✎
        </button>
      </div>
      {notesOpen && top && <FeedbackSheet code={top.code} draft={draft} onChange={setDraft} onClose={() => setNotesOpen(false)} onDecide={(dir) => void decide(dir)} />}
      {match.value && <MatchScreen />}
    </div>
  );
}

function pose(el: HTMLElement, x: number, y: number) {
  el.style.transform = `translate(${x}px, ${y}px) rotate(${x / 16}deg)`;
  const up = y < 0 && Math.abs(y) > Math.abs(x) ? Math.min(1, -y / THROW) : 0;
  el.style.setProperty('--like', String(up ? 0 : Math.max(0, Math.min(1, x / THROW))));
  el.style.setProperty('--nope', String(up ? 0 : Math.max(0, Math.min(1, -x / THROW))));
  el.style.setProperty('--super', String(up));
}

function NetStatus() {
  const t = taste.value;
  const p = publicModel.value;
  const label = training.value ? 'learning your type…' : t ? `taste net · ${t.swipes} swipes${t.fromPublic ? ' + crew' : ''}` : p ? `crew net · ${p.swipes} swipes` : 'taste net wakes after a few likes and nopes';
  return (
    <span class={`net ${training.value ? 'busy' : ''}`} title="The pixelgen net learns only from Fish Tinder swipes">
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

interface CardProps {
  card: T.Card;
  artCode: string;
  notes: number;
  depth: number;
  back: string | null;
  cardRef?: (el: HTMLElement | null) => void;
  onDecide?: (dir: Dir, from?: { x: number; y: number; vx: number; vy: number }) => void;
}

function ProfileCard({ card, artCode, notes, depth, back, cardRef, onDecide }: CardProps) {
  const p = T.profileOf(card.code);
  const [photo, setPhoto] = useState(0);
  const [open, setOpen] = useState(false);
  const el = useRef<HTMLElement>(null);
  const top = depth === 0;

  useEffect(() => {
    cardRef?.(el.current);
    return () => cardRef?.(null);
  }, [cardRef]);

  useEffect(() => {
    if (!top) return;
    for (const photo of T.PHOTOS) for (const s of T.spritesOf(artCode, photo)) void load(s.family, s.code, 'swim');
  }, [top, artCode]);

  // Dragging: the card follows the finger, tilted toward where it is going, its stamp fading in.
  useEffect(() => {
    const node = el.current;
    if (!node || !top || !onDecide) return;
    let start: { x: number; y: number } | null = null;
    let moved = false;
    let trail: { x: number; y: number; t: number }[] = [];
    const at = (e: PointerEvent) => ({ x: e.clientX - start!.x, y: e.clientY - start!.y, t: e.timeStamp });
    const down = (e: PointerEvent) => {
      if (e.button || (e.target as HTMLElement).closest('button, .profile-more')) return;
      start = { x: e.clientX, y: e.clientY };
      moved = false;
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
        if (r && e.clientY < r.bottom) setPhoto((i) => (e.clientX < r.left + r.width / 2 ? Math.max(0, i - 1) : Math.min(T.PHOTOS.length - 1, i + 1)));
        return spring(node);
      }
      if (q.x > THROW || (v.vx > FLICK && q.x > 20)) onDecide('like', from);
      else if (q.x < -THROW || (v.vx < -FLICK && q.x < -20)) onDecide('nope', from);
      else if (q.y < -THROW && Math.abs(q.x) < THROW) onDecide('super', from);
      else spring(node);
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
  }, [top, onDecide]);

  return (
    <article
      ref={el}
      class={`tcard ${top ? 'top' : ''} ${back ?? ''} r-${p.rarity} ${open ? 'open' : ''}`}
      style={{ '--depth': depth, zIndex: 10 - depth }}
      aria-hidden={top ? undefined : 'true'}
      aria-label={top ? `${p.name}, ${p.age}` : undefined}
    >
      <div class="photo">
        <div class="pips" aria-hidden="true">
          {T.PHOTOS.map((spec, i) => (
            <i key={spec.id} class={i === photo ? 'on' : ''} />
          ))}
        </div>
        <CardPhoto code={top ? artCode : card.code} index={top ? photo : 0} animate={top} label={top ? p.name : undefined} />
        {top && notes > 0 && <span class="note-badge">✎ {notes}</span>}
        <span class="photo-label">{(top ? T.PHOTOS[photo] : T.PHOTOS[0]).label}</span>
        <span class="stamp like" aria-hidden="true">
          LIKE
        </span>
        <span class="stamp nope" aria-hidden="true">
          NOPE
        </span>
        <span class="stamp super" aria-hidden="true">
          SUPER LIKE
        </span>
      </div>
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
          <button class="info" aria-expanded={open} aria-label={open ? 'Less about this fish' : 'More about this fish'} onClick={() => setOpen(!open)}>
            {open ? '▾' : 'ⓘ'}
          </button>
        </div>
        <p class="sub">
          {p.sex === 'f' ? '♀' : '♂'} {p.stage}
          {p.title ? ` · ${p.title}` : ''} · {p.distance}
        </p>
        <p class="bio">{p.bio}</p>
        <div class="chips">
          {p.signature && <span class="chip r-myth">✦ {p.signature}</span>}
          {p.interests.slice(0, open ? 9 : 3).map((x) => (
            <span key={x} class="chip">
              {x}
            </span>
          ))}
        </div>
        {open && (
          <div class="profile-more">
            <p class="binomial">{p.binomial}</p>
            <div class="prompt">
              <b>{p.prompt.q}</b>
              <p>{p.prompt.a}</p>
            </div>
            <p>
              <b>Looking for</b> {p.lookingFor}
            </p>
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
          </div>
        )}
      </footer>
    </article>
  );
}

function CardPhoto({ code, index, animate, label }: { code: string; index: number; animate: boolean; label?: string }) {
  const spec = T.PHOTOS[index] ?? T.PHOTOS[0];
  const sprites = T.spritesOf(code, spec);
  if (sprites.length > 1) {
    return (
      <div class={`photo-row ${spec.kind}`}>
        {sprites.map((s) => (
          <figure key={s.caption ?? s.code}>
            <SpriteArt family={s.family} code={s.code} anim="swim" scale={2} animate={false} />
            {s.caption && <figcaption>{s.caption}</figcaption>}
          </figure>
        ))}
      </div>
    );
  }
  const s = sprites[0];
  return <SpriteArt family={s.family} code={s.code} anim="swim" scale={4} animate={animate && s.animate} label={label} />;
}

function FeedbackSheet({ code, draft, onChange, onClose, onDecide }: { code: string; draft: T.Feedback; onChange: (next: T.Feedback) => void; onClose: () => void; onDecide: (dir: Dir) => void }) {
  return (
    <div class="tinder-notes" role="dialog" aria-label="Feedback">
      <header>
        <h2>Notes for the forge</h2>
        <button type="button" class="info" aria-label="Close feedback" onClick={onClose}>
          ✕
        </button>
      </header>
      <p class="note">What's off? Saved with your swipe.</p>
      <div class="note-group">
        <h3>Quick take</h3>
        <div class="chips">
          {T.CANNED_NOTES.map((c) => (
            <button key={c} type="button" class="chip" aria-pressed={draft.canned.includes(c)} onClick={() => onChange({ ...draft, canned: draft.canned.includes(c) ? draft.canned.filter((x) => x !== c) : [...draft.canned, c] })}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div class="note-groups">
        {T.traitGroups().map((g) => (
          <div class="note-group" key={g.group}>
            <h3>{g.group}</h3>
            <div class="chips">
              {g.fields.map((f) => {
                const on = draft.fix.includes(f.id);
                const current = T.fieldValue(code, f.id);
                return (
                  <span class="chip-wrap" key={f.id}>
                    <button
                      type="button"
                      class="chip"
                      aria-pressed={on}
                      onClick={() => {
                        const fix = on ? draft.fix.filter((x) => x !== f.id) : [...draft.fix, f.id];
                        const instead = { ...draft.instead };
                        if (on) delete instead[f.id];
                        onChange({ ...draft, fix, instead });
                      }}
                    >
                      {f.label}
                    </button>
                    {on && (
                      <select
                        aria-label={`${f.label} instead`}
                        value={draft.instead[f.id] ?? ''}
                        onChange={(e) => {
                          const value = (e.target as HTMLSelectElement).value;
                          const instead = { ...draft.instead };
                          if (value) instead[f.id] = value;
                          else delete instead[f.id];
                          onChange({ ...draft, instead });
                        }}
                      >
                        <option value="">instead…</option>
                        {f.choices
                          .filter((c) => c.id !== current)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                      </select>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <label class="note-row">
        Looks more like a{' '}
        <select aria-label="Looks more like" value={draft.asKind} onChange={(e) => onChange({ ...draft, asKind: (e.target as HTMLSelectElement).value })}>
          <option value="">—</option>
          {T.AS_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <textarea rows={2} maxLength={1800} placeholder="Anything else? Stored with the swipe." value={draft.note} onInput={(e) => onChange({ ...draft, note: (e.target as HTMLTextAreaElement).value })} />
      <footer>
        <button type="button" class="btn ghost" onClick={() => onDecide('nope')}>
          ✕ Pass
        </button>
        <button type="button" class="btn bloom" onClick={() => onDecide('like')}>
          ♥ Like
        </button>
      </footer>
    </div>
  );
}

function spring(el: HTMLElement) {
  el.classList.add('spring');
  el.style.transform = '';
  for (const k of ['--like', '--nope', '--super']) el.style.setProperty(k, '0');
  setTimeout(() => el.classList.remove('spring'), 450);
}

function MatchScreen() {
  const m = match.value!;
  const p = T.profileOf(m.code);
  const close = () => (match.value = null);
  const bubble = () => {
    sfx.plip();
    toast(`${p.name.split(' ').pop()} blew a bubble back. 🫧`, 'good');
    close();
  };
  return (
    <div class="match" role="dialog" aria-modal="true" aria-label="It's a match">
      <div class="match-in">
        <h2>{m.superlike ? 'Super Match!' : "It's a Match!"}</h2>
        <p>You and {p.name} like each other.</p>
        <div class="pair">
          <span class="portrait-box">
            <Portrait who="you" mood="grin" />
          </span>
          <span class="heart" aria-hidden="true">
            ♥
          </span>
          <span class="portrait-box fish">
            <SpriteArt family="fish3" code={m.code} anim="swim" scale={3} animate />
          </span>
        </div>
        <button class="btn lamp" onClick={bubble}>
          Blow a bubble 🫧
        </button>
        <button class="btn ghost" onClick={close}>
          Keep swiping
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the panel: likes and tiers

export function TinderPanel() {
  const [tab, setTab] = useState<'liked' | 'tiers'>('liked');
  useEffect(() => void initTinder(), []);
  return (
    <div class="stack tinder-panel">
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'liked'} onClick={() => setTab('liked')}>
          ♥ Liked <b>{liked.value.length}</b>
        </button>
        <button role="tab" aria-selected={tab === 'tiers'} onClick={() => setTab('tiers')}>
          ▤ Tier list
        </button>
      </div>
      {tab === 'liked' ? <Liked /> : <TierBoard />}
      <YourType />
    </div>
  );
}

function Liked() {
  const [view, setView] = useState<string | null>(null);
  const all = liked.value;
  const m = matches.value;
  if (!all.length) return <p class="empty">No likes yet. Swipe right on a fish you like; it lands here, ready to rank.</p>;
  const shown = all.find((s) => s.id === view);
  return (
    <div class="stack">
      {m.length > 0 && (
        <>
          <div class="section-title">
            <h3>Matches</h3>
            <span class="note">{m.length} liked you back</span>
          </div>
          <div class="match-row">
            {m.map((s) => (
              <button key={s.id} class={`mbubble ${s.superlike ? 'super' : ''}`} title={T.profileOf(s.code).name} onClick={() => setView(s.id)}>
                <SpriteArt family="fish3" code={s.code} anim="idle" />
              </button>
            ))}
          </div>
        </>
      )}
      <div class="section-title">
        <h3>Liked</h3>
        <span class="note">tap one for its profile</span>
      </div>
      <div class="like-grid">
        {all.map((s) => {
          const p = T.profileOf(s.code);
          const score = pct(s.score);
          return (
            <button key={s.id} class={`like-cell ${view === s.id ? 'on' : ''}`} aria-pressed={view === s.id} onClick={() => setView(view === s.id ? null : s.id)}>
              <SpriteArt family="fish3" code={s.code} anim="swim" />
              <span class="nm">{p.name}</span>
              {score != null && <span class="odds">When you swiped, likeliness was {score}%</span>}
              <span class="tag">
                {s.superlike ? '★' : ''}
                {s.matched ? '💞' : '♥'}
              </span>
            </button>
          );
        })}
      </div>
      {shown && <LikedProfile s={shown} onClose={() => setView(null)} />}
    </div>
  );
}

function LikedProfile({ s, onClose }: { s: T.TinderSwipe; onClose: () => void }) {
  const p = T.profileOf(s.code);
  const rank = T.rankOf(tiers.value, s.code);
  const score = pct(s.score);
  return (
    <section class="card liked-profile" aria-label={p.name}>
      <div class="row">
        <SpriteArt family="fish3" code={s.code} anim="idle" scale={3} animate class="big" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4>
            {p.name}, {p.age}
          </h4>
          <p class="note">
            {p.binomial} · {s.matched ? 'matched' : 'liked'}
            {s.superlike ? ' · super like' : ''}
          </p>
          <p class="note">{p.bio}</p>
          {score != null && <p class="note">When you swiped, the likeliness you'd like it was {score}%.</p>}
        </div>
      </div>
      <div class="row">
        <span class="note">Rank</span>
        {[...T.RANKS, 'pool' as const].map((r) => (
          <button key={r} class={`btn small ${rank === r ? 'lamp' : 'ghost'} tier-pick t-${r}`} onClick={() => moveTo(s.code, r)}>
            {r === 'pool' ? '–' : r}
          </button>
        ))}
      </div>
      <div class="row">
        <button
          class="btn small ghost"
          onClick={() => {
            forget(s.id);
            onClose();
            toast('Unliked. The net forgets it.');
          }}
        >
          Unlike
        </button>
        <button class="btn small ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}

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
  if (!total) return <p class="empty">Like a few fish and they will wait here to be ranked. Super likes go straight to S.</p>;
  return (
    <div class="stack tier-board">
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

function YourType() {
  const t = taste.value;
  return (
    <section class="card your-type">
      <h4>Your type</h4>
      {!t ? (
        <p class="note">Swipe a few more and the taste net works out what you go for. It learns from Fish Tinder and nothing else.</p>
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

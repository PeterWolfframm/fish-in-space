// Pins on the tank glass: notes and fish portraits you stick there from PIP or the Lab. They sit on the
// glass, not the water, so they pan with it on the wider tanks. Drag one to move it (mouse or finger),
// tap it to open it, arrow keys nudge a focused one.

import { useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { TargetedPointerEvent } from 'preact';
import { game, activeTank, tankPan, openPin, freshPin, movePin, unpinNote, repinTo, planInLab, selectFish, setSetting, pinTo } from '../store/signals';
import { SPAN } from '../scenes/hatchery/layout';
import * as W from '../game';
import { SpriteArt } from './Art';

const SOURCE: Record<W.PinSource, { icon: string; label: string }> = {
  news: { icon: '📰', label: 'PIP · Bulletin' },
  advice: { icon: '🎯', label: 'PIP · Recommendations' },
  call: { icon: '📞', label: 'PIP · Call log' },
  plan: { icon: '🧬', label: 'PIP · Breeding plan' },
  lab: { icon: '💞', label: 'Lab' },
  fish: { icon: '🐟', label: 'Fish post' },
};
const DRAG_PX = 6;
const NUDGE = 0.02;

/** Every pin on the tank in view, plus the opened one as a readable card. */
export function PinBoard() {
  const s = game.value;
  const tank = s.tanks.find((k) => k.id === activeTank.value) ?? s.tanks[0];
  const pins = tank ? W.pinsOn(s, tank.id) : [];
  const pane = useRef<HTMLDivElement>(null);
  if (!tank || !pins.length || s.settings.hidePins) return null;
  // The pane is as wide as the whole glass and slides with the camera, so pins stay where they were stuck.
  const span = SPAN[tank.shape] ?? 1;
  const pan = tankPan.value ?? 0;
  const open = pins.find((p) => p.id === openPin.value);
  return (
    <div class="pin-glass">
      <div ref={pane} class="pin-pane" style={{ width: `${span * 100}%`, transform: `translateX(${(-pan * (span - 1) * 100) / span}%)` }}>
        {pins.map((p) => (
          <PinNote key={p.id} pin={p} pane={pane} />
        ))}
      </div>
      {/* The scene sits under the HUD and roster; the open card goes over everything. */}
      {open && createPortal(<PinSheet pin={open} />, document.body)}
    </div>
  );
}

function PinNote({ pin, pane }: { pin: W.Pin; pane: { current: HTMLDivElement | null } }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const down = useRef<{ px: number; py: number; moved: boolean; id: number } | null>(null);
  const where = (e: PointerEvent) => {
    const d = down.current!;
    const r = pane.current!.getBoundingClientRect();
    return W.clampPin(pin.x + (e.clientX - d.px) / r.width, pin.y + (e.clientY - d.py) / r.height);
  };
  const onDown = (e: TargetedPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !pane.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    down.current = { px: e.clientX, py: e.clientY, moved: false, id: e.pointerId };
  };
  const onMove = (e: TargetedPointerEvent<HTMLButtonElement>) => {
    const d = down.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.px, e.clientY - d.py) < DRAG_PX) return;
    d.moved = true;
    setAt(where(e));
  };
  const onUp = (e: TargetedPointerEvent<HTMLButtonElement>) => {
    const d = down.current;
    if (!d || d.id !== e.pointerId) return;
    if (d.moved) {
      const p = where(e);
      movePin(pin.id, p.x, p.y);
    } else openPin.value = openPin.value === pin.id ? null : pin.id;
    down.current = null;
    setAt(null);
  };
  const onCancel = () => {
    down.current = null;
    setAt(null);
  };
  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, [number, number]> = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] };
    if (step[e.key]) {
      e.preventDefault();
      movePin(pin.id, pin.x + step[e.key][0], pin.y + step[e.key][1]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPin.value = openPin.value === pin.id ? null : pin.id;
    } else if (e.key === 'Escape') openPin.value = null;
  };
  const p = at ?? pin;
  const src = SOURCE[pin.source];
  return (
    <button
      type="button"
      class={`pin ${pin.kind} tone-${pin.tone}${at ? ' dragging' : ''}${openPin.value === pin.id ? ' on' : ''}${freshPin.value === pin.id ? ' fresh' : ''}`}
      style={{ '--x': `${p.x * 100}%`, '--y': `${p.y * 100}%`, '--tilt': `${at ? 0 : pin.tilt}deg` }}
      aria-label={`Pinned note: ${pin.title}. ${pin.text} Drag to move, or press Enter to open; arrow keys move it.`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onKeyDown={onKey}
    >
      <span class="pin-head" aria-hidden="true" />
      {pin.fish.length > 0 && (
        <span class={`pin-fish n${pin.fish.length}`}>
          {pin.fish.map((f) => (
            <SpriteArt key={f.id} family="fish4" code={f.code} anim="swim" />
          ))}
        </span>
      )}
      <b class="pin-title">{pin.title}</b>
      {pin.text && <span class="pin-text">{pin.text}</span>}
      <i class="pin-src" aria-hidden="true">
        {src.icon}
      </i>
    </button>
  );
}

/** An opened pin: everything it says, its fish big, and what you can do with it. */
function PinSheet({ pin }: { pin: W.Pin }) {
  const s = game.value;
  const aboard = pin.fish.filter((f) => s.fish.some((x) => x.id === f.id));
  const breedable = pin.fish.length === 2 && aboard.length > 0;
  const close = () => (openPin.value = null);
  return (
    <>
      <div class="pin-scrim" onClick={close} />
      <div class={`pin-sheet tone-${pin.tone}`} role="dialog" aria-label={pin.title}>
        <div class="pin-sheet-head">
          <span class="pin-src-label">
            {SOURCE[pin.source].icon} {SOURCE[pin.source].label}
          </span>
          <button class="close-x" aria-label="Close" onClick={close}>
            ×
          </button>
        </div>
        {pin.fish.length > 0 && (
          <div class="pin-sheet-fish">
            {pin.fish.map((f, i) => (
              <figure key={f.id}>
                {i > 0 && <span class="heart" aria-hidden="true">♡</span>}
                <SpriteArt family="fish4" code={f.code} anim="swim" animate={!s.settings.batterySaver} />
                <figcaption>
                  {f.name}
                  {!aboard.some((a) => a.id === f.id) && <small> · no longer aboard</small>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <h4>{pin.title}</h4>
        {pin.text && <p>{pin.text}</p>}
        <div class="pin-sheet-actions">
          {breedable && (
            <button class="btn small lamp" onClick={() => (close(), planInLab(pin.fish.map((f) => f.id)))}>
              💞 Set up in the Lab
            </button>
          )}
          {pin.fish.length === 1 && aboard.length === 1 && (
            <button class="btn small tank" onClick={() => (close(), selectFish(aboard[0].id))}>
              🐟 See {aboard[0].name}
            </button>
          )}
          <button class="btn small ghost" onClick={() => unpinNote(pin.id)}>
            Unpin
          </button>
        </div>
        {s.tanks.length > 1 && (
          <div class="pin-move" role="group" aria-label="Move to another tank">
            <span class="note">Move to</span>
            {s.tanks
              .filter((t) => t.id !== pin.tank)
              .map((t) => (
                <button key={t.id} class="chip" onClick={() => repinTo(pin.id, t.id)}>
                  {t.name}
                </button>
              ))}
          </div>
        )}
        <p class="note pin-hint">Drag a pin to move it on the glass.</p>
      </div>
    </>
  );
}

/** Show or hide the pins on the glass; shows how many this tank has. */
export function PinToggle() {
  const s = game.value;
  const n = W.pinsOn(s, activeTank.value).length;
  if (!n) return null;
  const hidden = Boolean(s.settings.hidePins);
  return (
    <button class="pin-toggle" aria-pressed={!hidden} title={hidden ? 'Show pinned notes' : 'Hide pinned notes'} onClick={() => setSetting('hidePins', !hidden)}>
      📌 <b class="numeral">{n}</b>
      <span class="sr">{hidden ? 'Show pinned notes' : 'Hide pinned notes'}</span>
    </button>
  );
}

/** The pin button for anything pinnable: one tap with one tank; with several, pick the glass. */
export function PinButton({ draft, label = 'Pin', compact }: { draft: () => W.PinDraft; label?: string; compact?: boolean }) {
  const tanks = game.value.tanks;
  const [open, setOpen] = useState(false);
  const pinned = tanks.filter((t) => game.value.pins.some((p) => p.tank === t.id && p.ref === draft().ref));
  const go = (id: string) => {
    setOpen(false);
    pinTo(draft(), id);
  };
  return (
    <span class="pin-btn-wrap">
      <button
        type="button"
        class={`pin-btn${compact ? ' compact' : ''}${pinned.length ? ' pinned' : ''}`}
        aria-haspopup={tanks.length > 1 ? 'menu' : undefined}
        aria-expanded={tanks.length > 1 ? open : undefined}
        title={pinned.length ? `Pinned to ${pinned.map((t) => t.name).join(', ')}` : 'Pin to a tank'}
        onClick={() => (tanks.length > 1 ? setOpen(!open) : go(tanks[0].id))}
      >
        📌{!compact && <span>{pinned.length ? 'Pinned' : label}</span>}
        {compact && <span class="sr">{pinned.length ? 'Pinned' : label}</span>}
      </button>
      {open && (
        <>
          <span class="pin-menu-scrim" onClick={() => setOpen(false)} />
          <span class="pin-menu" role="menu" aria-label="Pin to which tank?">
            <b>Pin to…</b>
            {[...tanks]
              .sort((a, b) => Number(b.id === activeTank.value) - Number(a.id === activeTank.value))
              .map((t) => (
                <button key={t.id} role="menuitem" onClick={() => go(t.id)}>
                  {t.name}
                  {pinned.some((x) => x.id === t.id) && <small> ✓</small>}
                </button>
              ))}
          </span>
        </>
      )}
    </span>
  );
}

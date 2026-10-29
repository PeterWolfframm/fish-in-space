// Pins: notes and fish portraits stuck to a tank's glass. Anything PIP or the Lab can show can be
// pinned; every pin belongs to one tank and remembers where on the glass it was dropped.

import type { Pin, State } from './types';
import { rng } from './rng';

/** How many pins one tank's glass holds before it's all paper and no water. */
export const PIN_MAX = 12;
/** Pins stay this far inside the glass, as a fraction of its width and height. */
const EDGE_X = 0.04;
const EDGE_Y = 0.06;

export type PinDraft = Omit<Pin, 'id' | 'tank' | 'x' | 'y' | 'tilt' | 'at'>;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const clampPin = (x: number, y: number) => ({ x: clamp(x, EDGE_X, 1 - EDGE_X), y: clamp(y, EDGE_Y, 1 - EDGE_Y) });

export const pinsOn = (state: State, tankId: string) => state.pins.filter((p) => p.tank === tankId);

/** A free-ish spot for the nth pin: a loose grid across the upper glass, so new pins don't stack. */
function spot(n: number, seed: string, view: [number, number]) {
  const r = rng(seed);
  const col = n % 4;
  const row = Math.floor(n / 4) % 3;
  const fx = 0.16 + col * 0.23 + (r() - 0.5) * 0.06;
  return clampPin(view[0] + fx * (view[1] - view[0]), 0.18 + row * 0.24 + (r() - 0.5) * 0.06);
}

/** Stick a draft to a tank. Re-pinning the same thing to the same tank just returns the pin already there.
 * `view` is the slice of the glass in sight (0..1 across a wide tank), so a new pin lands where you can see it. */
export function addPin(state: State, draft: PinDraft, tankId: string, now: number, view: [number, number] = [0, 1]): { pin: Pin; fresh: boolean } | { error: string } {
  if (!state.tanks.some((t) => t.id === tankId)) return { error: 'That tank is gone.' };
  const there = state.pins.find((p) => p.tank === tankId && p.ref === draft.ref);
  if (there) return { pin: there, fresh: false };
  const on = pinsOn(state, tankId);
  if (on.length >= PIN_MAX) return { error: `The glass is full: ${PIN_MAX} pins. Unpin one first.` };
  const id = `p${state.nextId++}`;
  const { x, y } = spot(on.length, `${state.seed}:${id}`, view);
  const tilt = Math.round((rng(`${state.seed}:tilt:${id}`)() - 0.5) * 10);
  const pin: Pin = { ...draft, fish: draft.fish.map((f) => ({ ...f })), id, tank: tankId, x, y, tilt, at: now };
  state.pins.push(pin);
  return { pin, fresh: true };
}

export function movePin(state: State, id: string, x: number, y: number) {
  const p = state.pins.find((q) => q.id === id);
  if (!p) return;
  Object.assign(p, clampPin(x, y));
  // The pin you just touched sits on top of the others.
  state.pins = [...state.pins.filter((q) => q !== p), p];
}

/** Move a pin to another tank's glass. Keeps its spot unless the other glass already has this ref. */
export function repin(state: State, id: string, tankId: string): string | null {
  const p = state.pins.find((q) => q.id === id);
  if (!p || p.tank === tankId) return null;
  if (!state.tanks.some((t) => t.id === tankId)) return 'That tank is gone.';
  if (state.pins.some((q) => q.tank === tankId && q.ref === p.ref)) return 'Already pinned there.';
  if (pinsOn(state, tankId).length >= PIN_MAX) return 'That glass is full.';
  p.tank = tankId;
  return null;
}

export function unpin(state: State, id: string) {
  state.pins = state.pins.filter((p) => p.id !== id);
}

export function clearPins(state: State, tankId?: string) {
  state.pins = tankId ? state.pins.filter((p) => p.tank !== tankId) : [];
}

const TONES: Pin['tone'][] = ['lamp', 'tank', 'lilac', 'bloom', 'signal', 'sky', 'gold'];
const SOURCES: Pin['source'][] = ['news', 'advice', 'call', 'plan', 'lab', 'fish'];
const str = (v: unknown): v is string => typeof v === 'string';
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Pins from a save: malformed ones dropped, positions clamped, orphans (their tank sold) dropped. */
export function sanePins(raw: unknown, tanks: { id: string }[]): Pin[] {
  if (!Array.isArray(raw)) return [];
  const out: Pin[] = [];
  for (const p of raw as Partial<Pin>[]) {
    if (!p || !str(p.id) || !str(p.ref) || !str(p.tank) || !tanks.some((t) => t.id === p.tank)) continue;
    if (!num(p.x) || !num(p.y) || !str(p.title)) continue;
    const fish = Array.isArray(p.fish) ? p.fish.filter((f) => f && str(f.code) && str(f.name) && str(f.id)) : [];
    out.push({
      id: p.id, ref: p.ref, tank: p.tank, title: p.title, text: str(p.text) ? p.text : '', fish,
      kind: p.kind === 'portrait' && fish.length ? 'portrait' : 'note',
      source: SOURCES.includes(p.source!) ? p.source! : 'news',
      tone: TONES.includes(p.tone!) ? p.tone! : 'lamp',
      ...clampPin(p.x, p.y),
      tilt: num(p.tilt) ? clamp(p.tilt, -12, 12) : 0,
      at: num(p.at) ? p.at : 0,
    });
  }
  return out;
}

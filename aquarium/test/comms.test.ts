import { describe, expect, test } from 'vitest';
import * as W from '../src/game';
import { LORE } from '../src/content/comms/lore';
import { AMBIENT } from '../src/content/comms/ambient';
import { REACTIONS } from '../src/content/comms/reactions';
import { BEATS } from '../src/content/story';

const T0 = 1_800_000_000_000;

describe('comms', () => {
  test('content is well formed: five lore entries, ~15 ambient, unique ids', () => {
    expect(LORE.map((e) => e.id)).toEqual(['lore-long-quiet', 'lore-salt-memory', 'lore-gardeners', 'lore-two-tall', 'lore-first-word']);
    expect(AMBIENT.length).toBeGreaterThanOrEqual(15);
    const ids = [...LORE, ...AMBIENT, ...Object.values(BEATS)].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.values(REACTIONS).every((l) => l.length > 0)).toBe(true);
  });

  test('ambient never plays while busy, before its gap, or from the same caller twice', () => {
    const s = W.newGame(T0, 'comms');
    expect(W.pickAmbient(s, false)).toBeNull(); // no play time yet
    s.playMs = W.AMBIENT_MIN;
    expect(W.pickAmbient(s, true)).toBeNull();
    let last: string | null = null;
    for (let i = 0; i < 40; i++) {
      s.playMs = s.comms.nextAmbientAt;
      const e = W.pickAmbient(s, false)!;
      expect(e).toBeTruthy();
      expect(W.caller(e)).not.toBe(last);
      expect((e.when?.minPhase ?? 0) <= s.phase).toBe(true);
      last = W.caller(e);
      W.heard(s, e, T0, true);
      expect(s.comms.nextAmbientAt - s.playMs).toBeGreaterThanOrEqual(W.AMBIENT_MIN);
      expect(s.comms.nextAmbientAt - s.playMs).toBeLessThanOrEqual(W.AMBIENT_MAX);
    }
  });

  test('the same ambient entry never repeats within 30 minutes of play', () => {
    const s = W.newGame(T0, 'repeat');
    s.phase = 5;
    const when: Record<string, number> = {};
    for (let i = 0; i < 80; i++) {
      s.playMs = s.comms.nextAmbientAt;
      const e = W.pickAmbient(s, false);
      if (!e) continue;
      if (when[e.id] !== undefined) expect(s.playMs - when[e.id]).toBeGreaterThanOrEqual(W.AMBIENT_REPEAT);
      when[e.id] = s.playMs;
      W.heard(s, e, T0, true);
    }
  });

  test('lore heard goes into the Field Notes; log groups by orbit', () => {
    const s = W.newGame(T0, 'notes');
    W.heard(s, LORE[0], T0);
    W.heard(s, AMBIENT[0], T0 + W.ORBIT_MS + 1);
    expect(s.fieldNotes.lore).toContain(LORE[0].id);
    expect(W.logByOrbit(s).map((g) => g.orbit)).toEqual([2, 1]);
  });

  test('Ask the Prof names hunger first', () => {
    const s = W.newGame(T0, 'prof');
    s.fish[0].hunger = 0.9;
    expect(W.profHint(s, T0)).toMatch(/hungry/);
  });
});

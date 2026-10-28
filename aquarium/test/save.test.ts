// Saves: a game survives JSON, bad saves are rejected, and broken fish are dropped rather than crashing.
import { describe, expect, test } from 'vitest';
import * as W from '../src/game';

const T0 = 1_800_000_000_000;

describe('save and restore', () => {
  test('a fresh game round-trips through JSON', () => {
    const s = W.newGame(T0, 'save');
    W.tick(s, T0 + 30_000);
    const back = W.restore(JSON.stringify(s), T0 + 31_000);
    expect(back).not.toBeNull();
    expect(back!.fish.map((f) => f.code)).toEqual(s.fish.map((f) => f.code));
    expect(back!.regions.length).toBe(s.regions.length);
    expect(back!.credits).toBe(s.credits);
  });

  test('garbage and half-saves are rejected', () => {
    expect(W.restore('not json')).toBeNull();
    expect(W.restore({})).toBeNull();
    expect(W.restore({ credits: 1, phase: 0, fish: [] })).toBeNull();
  });

  test('fish with codes that no longer decode are dropped, and the phase is clamped', () => {
    const s = W.newGame(T0, 'bad');
    const raw = structuredClone(s) as W.State;
    raw.fish.push({ ...raw.fish[0], id: 'x', code: '###' });
    raw.phase = 99;
    const back = W.restore(raw, T0)!;
    expect(back.fish.some((f) => f.id === 'x')).toBe(false);
    expect(back.phase).toBe(W.PHASES.length - 1);
  });
});

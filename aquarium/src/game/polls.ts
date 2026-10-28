// Naming polls. The other colonists' votes are a deterministic stream from region seed and time,
// so every device sees the same bars. The player's votes are added on top. Ties go to the player.

import { hash } from './rng';
import type { Region } from './types';

/** NPC votes for each option at time `now`. Each option has its own rate and a gentle wobble. */
export function simTally(regionId: string, optionIds: string[], openedAt: number, now: number): Record<string, number> {
  const min = Math.max(0, now - openedAt) / 60_000;
  const out: Record<string, number> = {};
  for (const id of optionIds) {
    const h = hash(`poll:${regionId}:${id}`);
    const rate = 0.4 + (h % 1000) / 1000 * 1.6; // votes per minute
    const wobble = 1.5 * Math.sin(min / (3 + (h % 5)) + (h % 31));
    out[id] = Math.max(0, Math.floor(rate * min + wobble + (h % 4)));
  }
  return out;
}

export function localTally(region: Region, now: number): Record<string, number> {
  const p = region.poll;
  if (!p) return {};
  const sim = simTally(region.id, p.options.map((o) => o.id), p.openedAt, now);
  for (const id in p.spent) sim[id] = (sim[id] ?? 0) + p.spent[id];
  return sim;
}

/** The winning option id: most votes; ties go to the option the player backed most, then to list order. */
export function winner(region: Region, tally: Record<string, number>): string | null {
  const p = region.poll;
  if (!p || !p.options.length) return null;
  let best = p.options[0].id;
  for (const o of p.options) {
    const a = tally[o.id] ?? 0;
    const b = tally[best] ?? 0;
    if (a > b || (a === b && (p.spent[o.id] ?? 0) > (p.spent[best] ?? 0))) best = o.id;
  }
  return best;
}

export const share = (tally: Record<string, number>, id: string) => {
  const total = Object.values(tally).reduce((s, v) => s + v, 0);
  return total ? (tally[id] ?? 0) / total : 0;
};

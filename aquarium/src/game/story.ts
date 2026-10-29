// The Professor's side of the rules: chapter progress, side work, and Ask the Prof.

import { PHASES, forecast } from './biomes';
import { allelesOf, genomeOf, meetsAll, nameOf } from './fish';
import { liveRegions, regionLabel } from './requests';
import { addLog, isAdult, occupied } from './state';
import type { Result } from './actions';
import type { State } from './types';
import { CHAPTERS, WORKS, type Work } from '../content/story';

/** Chapters follow phases. Returns the chapters newly begun (for briefings and patches). */
export function syncChapter(state: State): number[] {
  const out: number[] = [];
  while (state.story.chapter < state.phase) {
    state.story.chapter++;
    out.push(state.story.chapter);
    const patch = `chapter:${state.story.chapter - 1}`;
    if (!state.patches.includes(patch)) state.patches.push(patch);
  }
  return out;
}

export const chapterOf = (state: State) => CHAPTERS[state.story.chapter] ?? CHAPTERS[0];

export const seen = (state: State, id: string) => state.story.seen.includes(id);
export function markSeen(state: State, id: string) {
  if (!seen(state, id)) state.story.seen.push(id);
}

/** Offer the next side work order, if none is active and one is due. */
export function offerWork(state: State): Work | null {
  if (state.story.work) return null;
  const w = WORKS.find((x) => x.minPhase <= state.phase && !seen(state, x.id) && !seen(state, `${x.id}:offered`));
  if (!w || state.stats.orders < 2) return null;
  state.story.work = w.id;
  markSeen(state, `${w.id}:offered`);
  return w;
}

export const activeWork = (state: State) => WORKS.find((w) => w.id === state.story.work) ?? null;

export function handOver(state: State, fishId: string, now: number): Result<{ work: Work }> {
  const w = activeWork(state);
  const f = state.fish.find((x) => x.id === fishId);
  if (!w || !f) return { error: 'Nothing to hand over.' };
  if (!meetsAll(f.code, w.reqs)) return { error: 'That fish doesn’t fit the work order.' };
  state.fish.splice(state.fish.indexOf(f), 1);
  state.credits += w.reward;
  state.story.work = null;
  markSeen(state, w.id);
  addLog(state, now, '✉', `Work order done: ${w.title}. ${nameOf(f.code)} handed over. +${w.reward} ◎.`);
  return { work: w };
}

/** The single most useful thing the Prof can say right now. */
export function profHint(state: State, now: number): string {
  const hungry = state.fish.filter((f) => f.hunger > 0.6);
  if (hungry.length) return `${hungry.length === 1 ? 'One fish is' : `${hungry.length} fish are`} hungry. Feed them: fed fish grow twice as fast.`;
  if (!state.fish.length && !state.eggs.length) return 'The tank is empty! The X-change has roe that thaws in seconds.';
  for (const o of state.orders) {
    if (state.fish.some((f) => meetsAll(f.code, o.reqs))) continue;
    const gene = o.reqs.find((q) => q.kind === 'gene');
    const left = Math.round((o.expires - now) / 60_000);
    if (gene && gene.kind === 'gene') {
      const carriers = state.fish.filter((f) => allelesOf(f.code).includes(gene.allele));
      if (carriers.length) return `Nobody fills the ${o.colony} request yet. ${nameOf(carriers[0].code)} carries ${gene.allele}; pair it with a fish that fits the water.`;
    }
    return `Nobody in the tank fits the ${o.colony} request (${left} min left). The X-change has roe for that water.`;
  }
  if (occupied(state) >= state.capacity - 1) return 'The tank is nearly full. Seed a fish into a region, sell one, or extend the tank.';
  const ready = liveRegions(state).find((r) => r.poll && r.poll.tokens > 0 && !r.name);
  if (ready) return `You have ${ready.poll!.tokens} vote${ready.poll!.tokens > 1 ? 's' : ''} for ${regionLabel(ready)}. Spend them on the Bridge!`;
  const next = PHASES[state.phase + 1];
  if (next && state.bloom >= next.bloom * 0.8) {
    const f = forecast(state.phase)[0];
    return `We’re close to ${next.name}. ${f ?? ''} Breed for it now.`.trim();
  }
  const adults = state.fish.filter(isAdult);
  const sexes = new Set(adults.map((f) => genomeOf(f.code).sex));
  if (adults.length >= 2 && sexes.size >= 2 && !state.eggs.length) return 'Pairing fish makes hatchery-bred fry, and those mix their parents’ genes. Try a pair in the Lab first.';
  return 'All good! Fill requests on the Bridge to grow Bloom, and keep an eye on the comms.';
}

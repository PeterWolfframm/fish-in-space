// Shared Studio state: which generator, its seed, animation and zoom — synced to the URL hash so
// a link reopens the same fish. One generator is picked at a time; swapping it snaps the
// animation to one the new generator actually has.

import { signal, effect } from '@preact/signals';
import { GENS } from './gens';

function parseHash(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of location.hash.replace(/^#/, '').split('&')) {
    if (!pair) continue;
    const [k, v] = pair.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}

const initial = parseHash();
const randomSeed = () => Math.random().toString(36).slice(2, 10);

export type StudioMode = 'forge' | 'anatomy' | 'growth' | 'versions';
const MODES: StudioMode[] = ['forge', 'anatomy', 'growth', 'versions'];

export const genId = signal(GENS.some((g) => g.id === initial.g) ? initial.g : (GENS[0]?.id ?? ''));
export const seed = signal(initial.seed || randomSeed());
export const animId = signal(initial.anim || '');
export const zoom = signal(Number(initial.zoom) || 4);
export const playing = signal(true);
export const mode = signal<StudioMode>(MODES.includes(initial.mode as StudioMode) ? (initial.mode as StudioMode) : 'forge');

export function newSeed() {
  seed.value = randomSeed();
}

// Keep the animation valid whenever the generator changes (including on first load).
effect(() => {
  const gen = GENS.find((g) => g.id === genId.value);
  if (gen && !gen.anims.some((a) => a.id === animId.value)) animId.value = gen.anims[0]?.id ?? '';
});

effect(() => {
  const parts = [`g=${encodeURIComponent(genId.value)}`, `seed=${encodeURIComponent(seed.value)}`, `anim=${encodeURIComponent(animId.value)}`, `zoom=${zoom.value}`, `mode=${mode.value}`];
  history.replaceState(null, '', `#${parts.join('&')}`);
});

// Shared, bigger building blocks used across every room: a section header with its three emojis, the
// one fish tile used everywhere a fish shows up, a status line, and small numeric readouts.

import { KEEPSAKES } from '../art/keepsakes';
import type { ComponentChildren } from 'preact';
import { now } from '../store/signals';
import * as W from '../game';
import { SpriteArt } from './Art';

export const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
export const regionName = (s: W.State, id: string) => {
  const r = W.regionById(s, id);
  return r ? W.regionLabel(r) : 'Mirelle';
};

export function Heading({ title, emoji, note, action }: { title: string; emoji: string; note?: string; action?: ComponentChildren }) {
  return (
    <div class="section-title">
      <h3>
        {title} <span class="emoji" aria-hidden="true">{emoji}</span>
      </h3>
      {note && <span class="note">{note}</span>}
      {action}
    </div>
  );
}

/** The single most relevant thing to say about a fish right now, in priority order. */
export function statusOf(f: W.Fish, t: number): { text: string; tone: string } {
  const stage = W.stageOf(f.code);
  if (f.hunger > 0.5) return { text: 'Hungry', tone: 'bad' };
  const resting = f.spawnReadyAt > t;
  if (W.isAdult(f) && !resting) return { text: 'Ready to pair', tone: 'lilac' };
  if (resting) return { text: `Resting ${mmss(f.spawnReadyAt - t)}`, tone: 'ink-faint' };
  const nextAt = stage === 'fry' ? W.GROW.juvenile : stage === 'juvenile' ? W.GROW.adult : null;
  const prevAt = stage === 'fry' ? 0 : stage === 'juvenile' ? W.GROW.juvenile : W.GROW.adult;
  if (nextAt) return { text: `Growing ${Math.round(Math.min(1, (f.growth - prevAt) / (nextAt - prevAt)) * 100)}%`, tone: 'bloom' };
  return { text: 'Adult', tone: 'ink-dim' };
}

/** The one fish icon used by the roster, pickers, buyback, Lab and PIP — a big sprite on a rarity glow. */
export function FishTile({
  fish: f,
  size = 'md',
  badge,
  selected,
  ring,
  onClick,
}: {
  fish: W.Fish;
  size?: 'sm' | 'md' | 'lg';
  badge?: string;
  selected?: boolean;
  ring?: 'pairing' | 'best';
  onClick?: () => void;
}) {
  const g = W.genomeOf(f.code);
  const t = now.value;
  const st = statusOf(f, t);
  return (
    <button
      type="button"
      class={`fish-tile ${size} ${ring ?? ''}`}
      aria-pressed={selected}
      onClick={onClick}
      aria-label={`${W.fishName(f)}, ${g.sex === 'f' ? 'female' : 'male'}, ${st.text}`}
    >
      {ring === 'best' && <span class="best-plate">Best fit</span>}
      <span class={`glow r-${g.rarity}`}>
        <SpriteArt family="fish4" code={f.code} anim="swim" animate={size !== 'sm'} />
      </span>
      <span class="nm">
        {g.sex === 'f' ? '♀' : '♂'} {W.fishName(f)}
      </span>
      <span class={`status ${badge ? '' : st.tone}`}>{badge ?? st.text}</span>
    </button>
  );
}

export function Meter({ value, tone }: { value: number; tone?: 'grow' | 'life' }) {
  return (
    <span class={`meter ${tone ?? ''}`}>
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </span>
  );
}

export function Pill({ tone, pulse, children }: { tone?: string; pulse?: boolean; children: ComponentChildren }) {
  return <span class={`pill ${tone ?? ''} ${pulse ? 'pulse' : ''}`}>{children}</span>;
}

export function Stat({ value, label, tone }: { value: ComponentChildren; label: string; tone?: string }) {
  return (
    <div class="stat">
      <b class="numeral" style={tone ? { color: `var(--${tone})` } : undefined}>
        {value}
      </b>
      <span>{label}</span>
    </div>
  );
}

/** A shelf keepsake's pixel art as crisp SVG. */
export function Keepsake({ code }: { code: string }) {
  const p = KEEPSAKES[code];
  if (!p) return null;
  return (
    <svg class="keepsake" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
      {p.rows.flatMap((row, y) => [...row].map((ch, x) => (p.pal[ch] ? <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={p.pal[ch]} /> : null)))}
    </svg>
  );
}

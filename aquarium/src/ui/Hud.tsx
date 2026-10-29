import { game, orbit } from '../store/signals';
import * as W from '../game';

/** A small orbit dial: the station circling the planet, the sunlit half in amber. */
export function OrbitDial({ f }: { f: number }) {
  const a = f * Math.PI * 2 - Math.PI / 2;
  const x = 13 + Math.cos(a) * 10;
  const y = 13 + Math.sin(a) * 10;
  return (
    <svg class="dial" viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="10" fill="none" stroke="#1d263c" stroke-width="2" />
      <path d="M13 3 A10 10 0 0 1 13 23" fill="none" stroke="#f0a24a" stroke-width="2" opacity="0.7" />
      <circle cx="13" cy="13" r="5" fill="#4f8fd8" />
      <path d="M13 8 A5 5 0 0 1 13 18 Z" fill="#8fe39a" opacity="0.7" />
      <rect x={x - 1.5} y={y - 1.5} width="3" height="3" fill="#e6ecfa" />
    </svg>
  );
}

function BloomMeter() {
  const s = game.value;
  const next = W.PHASES[s.phase + 1];
  const prev = W.PHASES[s.phase].bloom;
  const k = next ? (s.bloom - prev) / (next.bloom - prev) : 1;
  const pct = Math.round(Math.min(1, k) * 100);
  return (
    <div class="bloom" title="Bloom: how alive Mirelle is">
      <small>
        ✿ {W.PHASES[s.phase].name}
        {next ? ` · ${Math.floor(s.bloom)}/${next.bloom}` : ' · living world'}
      </small>
      <div class="bar" role="meter" aria-label="Bloom toward the next phase" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Space Karma and bloom, always visible across the top of the playfield. */
export function StatusStrip() {
  const credits = game.value.credits;
  return (
    <div class="status-strip">
      <div class="karma" aria-label={`${credits} space karma`}>
        <b class="numeral">{credits} ◎</b>
        <span>Space Karma</span>
      </div>
      <BloomMeter />
    </div>
  );
}

/** Orbit clock, bloom progress, and the Space Karma total. */
export function ProgressPanel() {
  const s = game.value;
  const o = orbit.value;
  return (
    <div class="progress-panel stack">
      <div class="orbit" title={`Orbit ${o.n}, ${o.night ? 'night side' : 'day side'}`}>
        <OrbitDial f={o.f} />
        <span>
          ORBIT {o.n} · {o.clock}
          <span class="sr"> into orbit {o.n}, {o.night ? 'night side' : 'day side'}</span>
        </span>
      </div>
      <div class="progress-pair">
        <div class="karma">
          <div class="credits numeral sheet-credits" aria-label={`${s.credits} space karma`}>
            {s.credits} ◎
          </div>
          <p class="note">Space Karma. Earn ◎ by filling requests, selling fish, and seeding regions.</p>
        </div>
        <BloomMeter />
      </div>
    </div>
  );
}

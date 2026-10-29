// The Bridge panel: colony requests with their launch windows, the focused region (Life, naming poll,
// free seeding), and the globe/surface toggle.

import { useEffect, useState } from 'preact/hooks';
import { game, now, orbit, focusRegion, surface, tallies, watchPoll, castVote, launch, launching } from '../../store/signals';
import * as W from '../../game';
import { Heading, FishTile, Pill, Stat, mmss } from '../kit';

/**
 * Fish that fit, best first. For a request every fit earns the same, so the best fit is the one worth
 * least at today's valuation; for free seeding adults bring twice the bloom, so they lead.
 */
function FishPick({ fish, onPick, mode }: { fish: W.Fish[]; onPick: (f: W.Fish) => void; mode: 'order' | 'seed' }) {
  const t = now.value;
  if (!fish.length) return <p class="empty">No fish aboard fits yet.</p>;
  const price = (f: W.Fish) => W.priceOf(f.code, t);
  const ranked = [...fish].sort((a, b) => (mode === 'seed' ? Number(W.isAdult(b)) - Number(W.isAdult(a)) : 0) || price(a) - price(b));
  return (
    <div class="pick-grid best" role="group" aria-label="Fish that fit, best first">
      {ranked.map((f, i) => (
        <FishTile
          key={f.id}
          fish={f}
          size="md"
          ring={i === 0 ? 'best' : undefined}
          badge={mode === 'seed' ? `+${W.isAdult(f) ? 8 : 4} ✿ · ${price(f)} ◎` : `worth ${price(f)} ◎`}
          onClick={() => onPick(f)}
        />
      ))}
    </div>
  );
}

function Requests() {
  const s = game.value;
  const t = now.value;
  const f = orbit.value.f;
  const [open, setOpen] = useState<string | null>(null);
  if (!s.orders.length) return <p class="empty">No requests on the wire. The colonies call every few minutes.</p>;
  return (
    <div>
      {s.orders.map((o) => {
        const r = W.regionById(s, o.region);
        const live = r ? W.inWindow(r.lon, f) : false;
        const wait = r ? W.untilWindow(r.lon, s.orbitEpoch, t) : 0;
        const fits = s.fish.filter((x) => W.meetsAll(x.code, o.reqs));
        return (
          <div key={o.id} class={`card req ${live ? 'window' : ''}`}>
            <div class="req-hero">
              <div class="req-reward numeral">
                +{o.reward} ◎ <span class="sm">+{o.bloom} ✿</span>
              </div>
              <Pill tone={live ? 'bloom' : 'ink-faint'} pulse={live}>
                {live ? '● OPEN NOW' : `opens in ${mmss(wait)}`}
              </Pill>
            </div>
            <div class="top">
              <b>
                {o.colony} · <button class="link" onClick={() => (focusRegion.value = o.region)}>{r ? W.regionLabel(r) : '—'}</button>
              </b>
              <span class="due">due {mmss(Math.max(0, o.expires - t))}</span>
            </div>
            <div class="chips">
              {o.reqs.map((q, i) => (
                <span key={i} class="chip">
                  {W.reqLabel(q)}
                </span>
              ))}
            </div>
            <div class="flavor">{o.flavor}</div>
            <button
              class="btn lamp"
              disabled={Boolean(launching.value)}
              aria-expanded={open === o.id}
              onClick={() => setOpen(open === o.id ? null : o.id)}
            >
              {fits.length ? `Send a fish (${fits.length} fit)` : 'Who fits?'}
            </button>
            {open === o.id && <FishPick mode="order" fish={fits} onPick={(x) => launch(x.id, o.region, o.id)} />}
          </div>
        );
      })}
    </div>
  );
}

function RegionPanel({ id }: { id: string }) {
  const s = game.value;
  const t = now.value;
  const r = W.regionById(s, id);
  useEffect(() => {
    watchPoll(r?.poll && !r.name ? id : null);
    return () => watchPoll(null);
  }, [id, Boolean(r?.poll && !r?.name)]);
  const [seed, setSeed] = useState(false);
  if (!r) return null;
  const biome = W.biomeById(r.biome);
  const live = W.inWindow(r.lon, orbit.value.f);
  const wait = W.untilWindow(r.lon, s.orbitEpoch, t);
  const tally = tallies.value[r.id] ?? W.localTally(r, t);
  const can = s.fish.filter((f) => !W.seedProblem(s, f, r));
  return (
    <div class="card stack region-card" style={{ '--k': biome?.color ?? 'var(--sky)' }}>
      <div class="region-head">
        <span class="region-glyph" aria-hidden="true">
          {biome?.icon ?? '◌'}
        </span>
        <h3>{W.regionLabel(r)}</h3>
        {r.opened && (
          <Pill tone={live ? 'bloom' : 'ink-faint'} pulse={live}>
            {live ? '● OPEN NOW' : `opens in ${mmss(wait)}`}
          </Pill>
        )}
        <button class="btn small ghost" onClick={() => (focusRegion.value = null)} aria-label="Close region">
          ✕
        </button>
      </div>
      <div class="chips">
        <span class="chip water">{biome?.name ?? r.biome}</span>
        {biome && <span class="chip">{W.condWords(W.condOf(biome, s.phase))}</span>}
        {!r.opened && <span class="chip">surveying</span>}
      </div>
      {r.opened ? (
        <>
          <div class="life-row">
            <Stat value={`${Math.round(r.life)}%`} label={`life · ${r.delivered} delivered`} tone="bloom" />
            <span class="meter life">
              <i style={{ width: `${Math.min(100, r.life)}%` }} />
            </span>
          </div>
          {r.poll && !r.name && (
            <div class="stack">
              <Heading title="Name this region" emoji="🗳️🌍💫" note={`${r.poll.tokens} vote${r.poll.tokens === 1 ? '' : 's'} to spend`} />
              {r.poll.options.map((o) => {
                const k = W.share(tally, o.id);
                const mine = (r.poll!.spent[o.id] ?? 0) > 0;
                return (
                  <button key={o.id} class={`poll-opt ${mine ? 'mine' : ''}`} disabled={r.poll!.tokens <= 0} onClick={() => castVote(r.id, o.id)}>
                    <span class="nm">{o.name}</span>
                    <span class="pct numeral">{Math.round(k * 100)}%</span>
                    <span class="bar">
                      <i style={{ width: `${k * 100}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <button class="btn tank" aria-expanded={seed} onClick={() => setSeed(!seed)}>
            {seed ? 'Close' : `Seed a fish here · ${can.length} fit`}
          </button>
          {live && seed && <p class="note">The window is open: drops land clean for +25% life.</p>}
          {seed && <FishPick mode="seed" fish={can} onPick={(f) => launch(f.id, r.id)} />}
        </>
      ) : (
        <p class="note">Still surveying. {biome?.name ?? 'This water'} opens in phase {W.PHASES[r.opensAt]?.name ?? r.opensAt}.</p>
      )}
    </div>
  );
}

export function BridgePanel() {
  const s = game.value;
  const focus = focusRegion.value;
  const live = W.liveRegions(s);
  return (
    <div class="stack">
      <div class="section-title">
        <div class="seg" role="group" aria-label="View">
          <button aria-pressed={!surface.value} onClick={() => (surface.value = false)}>
            Globe
          </button>
          <button aria-pressed={surface.value} onClick={() => (surface.value = true)}>
            Surface
          </button>
        </div>
        <span class="note">
          {live.length} region{live.length === 1 ? '' : 's'} open · drag to spin, tap to focus
        </span>
      </div>
      {focus && <RegionPanel id={focus} />}
      <Heading title="Requests" emoji="🪐📡✨" note="launch while the window is open for a bonus" />
      <Requests />
    </div>
  );
}

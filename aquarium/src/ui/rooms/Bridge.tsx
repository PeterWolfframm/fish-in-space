// The Bridge panel: colony requests with their launch windows, the focused region (Life, naming poll,
// free seeding), and the globe/surface toggle.

import { useEffect, useState } from 'preact/hooks';
import { game, now, orbit, focusRegion, surface, tallies, watchPoll, castVote, launch, launching } from '../../store/signals';
import * as W from '../../game';
import { SpriteArt } from '../Art';
import { mmss } from '../Sheet';

function FishPick({ fish, onPick }: { fish: W.Fish[]; onPick: (f: W.Fish) => void }) {
  if (!fish.length) return <p class="empty">No fish in the tank fits yet.</p>;
  return (
    <div class="fish-pick">
      {fish.map((f) => (
        <button key={f.id} class="btn ghost small" disabled={Boolean(launching.value)} onClick={() => onPick(f)}>
          <SpriteArt family="fish3" code={f.code} anim="swim" class="mini" />
          {W.nameOf(f.code)}
        </button>
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
            <div class="top">
              <b>
                {o.colony} · <button class="link" onClick={() => (focusRegion.value = o.region)}>{r ? W.regionLabel(r) : '—'}</button>
              </b>
              <span class="reward">
                {o.reward} ◎ · +{o.bloom}✿
              </span>
            </div>
            <div class="flavor">{o.flavor}</div>
            <div class="chips">
              {o.reqs.map((q, i) => (
                <span key={i} class="chip">
                  {W.reqLabel(q)}
                </span>
              ))}
            </div>
            <div class="top">
              <span class="due">
                {live ? '▲ window open' : `window in ${mmss(wait)}`} · due {mmss(Math.max(0, o.expires - t))}
              </span>
              <button class="btn small lamp" aria-expanded={open === o.id} onClick={() => setOpen(open === o.id ? null : o.id)}>
                {fits.length ? `Send a fish (${fits.length})` : 'Who fits?'}
              </button>
            </div>
            {open === o.id && <FishPick fish={fits} onPick={(x) => launch(x.id, o.region, o.id)} />}
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
    <div class="card stack">
      <div class="region-head">
        <h3>{W.regionLabel(r)}</h3>
        <button class="btn small ghost" onClick={() => (focusRegion.value = null)} aria-label="Close region">
          ✕
        </button>
      </div>
      <div class="chips">
        <span class="chip water">{biome?.name ?? r.biome}</span>
        {biome && <span class="chip">{W.condWords(W.condOf(biome, s.phase))}</span>}
        {r.opened ? <span class="chip">{live ? '▲ window open' : `window in ${mmss(wait)}`}</span> : <span class="chip">surveying</span>}
      </div>
      {r.opened ? (
        <>
          <div>
            <div class="note">
              Life {Math.round(r.life)}/100 · {r.delivered} delivered
            </div>
            <span class="meter grow">
              <i style={{ width: `${Math.min(100, r.life)}%` }} />
            </span>
          </div>
          {r.poll && !r.name && (
            <div class="stack">
              <div class="section-title">
                <h3>Name this region</h3>
                <span class="note">
                  {r.poll.tokens} vote{r.poll.tokens === 1 ? '' : 's'} to spend · closes at Life 100
                </span>
              </div>
              {r.poll.options.map((o) => {
                const k = W.share(tally, o.id);
                const mine = (r.poll!.spent[o.id] ?? 0) > 0;
                return (
                  <div key={o.id} class={`poll-opt ${mine ? 'mine' : ''}`}>
                    <span>
                      {o.name} <span class="note">{Math.round(k * 100)}%</span>
                    </span>
                    <button class="btn small signal" disabled={r.poll!.tokens <= 0} onClick={() => castVote(r.id, o.id)}>
                      Vote
                    </button>
                    <span class="bar">
                      <i style={{ width: `${k * 100}%` }} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div class="row">
            <button class="btn tank small" aria-expanded={seed} onClick={() => setSeed(!seed)}>
              Seed a fish here (free)
            </button>
            <span class="note">{can.length} fit</span>
          </div>
          {seed && <FishPick fish={can} onPick={(f) => launch(f.id, r.id)} />}
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
      <div class="section-title">
        <h3>Requests</h3>
        <span class="note">launch while the window is open for a bonus</span>
      </div>
      <Requests />
    </div>
  );
}

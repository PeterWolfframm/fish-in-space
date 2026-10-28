// Comms: the call log grouped by orbit, the market wire, and the station settings.

import { useState } from 'preact/hooks';
import { game, now, setSetting, resetGame, commsQueue } from '../../store/signals';
import * as W from '../../game';
import { CAST, type Who } from '../../content/comms/types';
import { Portrait } from '../Art';

export function CommsPanel() {
  const s = game.value;
  const t = now.value;
  const groups = W.logByOrbit(s);
  const heads = W.headlines(t);
  const [sure, setSure] = useState(false);
  const top = [...heads.slice(0, 2), ...heads.slice(-1)];
  return (
    <div class="stack">
      {commsQueue.value.length > 0 && <p class="banner">📡 A call is coming in…</p>}
      <div class="section-title">
        <h3>Market wire</h3>
        <span class="note">prices drift every few minutes</span>
      </div>
      <div class="card">
        {top.map((h) => (
          <div key={h.tag} class="headline">
            <span>{h.why}</span>
            <span class={`trend ${h.mult > 1.05 ? 'up' : h.mult < 0.95 ? 'down' : ''}`}>
              {h.tag} ×{h.mult.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div class="section-title">
        <h3>Call log</h3>
        <span class="note">{s.comms.log.length} calls</span>
      </div>
      {groups.length ? (
        groups.map((g) => (
          <div key={g.orbit} class="orbit-group">
            <h4>ORBIT {g.orbit}</h4>
            {g.entries.map((e) => {
              const who = e.panels[0]?.who as Who | undefined;
              const cast = who ? CAST[who] : undefined;
              const d = new Date(e.at);
              return (
                <div key={e.id + e.at} class="log-entry">
                  <span class="t">{`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`}</span>
                  {who && (
                    <span class="portrait-box small">
                      <Portrait who={who} />
                    </span>
                  )}
                  <div>
                    <span class="who" style={{ color: cast?.color }}>
                      {cast?.name ?? who}
                    </span>
                    {e.panels.map((p, i) => (
                      <p key={i}>
                        {p.who !== who && <b style={{ color: CAST[p.who as Who]?.color }}>{CAST[p.who as Who]?.name}: </b>}
                        {p.text}
                      </p>
                    ))}
                    {e.choice && <div class="choice">↳ {e.choice}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      ) : (
        <p class="empty">Quiet on the band.</p>
      )}

      <div class="section-title">
        <h3>Station settings</h3>
      </div>
      <div class="card stack">
        <label class="row">
          <input type="checkbox" checked={s.settings.muted} onChange={(e) => setSetting('muted', e.currentTarget.checked)} /> Mute sound
        </label>
        <label class="row">
          <input type="checkbox" checked={s.settings.batterySaver} onChange={(e) => setSetting('batterySaver', e.currentTarget.checked)} /> Battery saver
          <span class="note">30 fps, no glow or caustics</span>
        </label>
        <label class="row">
          <input type="checkbox" checked={s.settings.shortPods} onChange={(e) => setSetting('shortPods', e.currentTarget.checked)} /> Short pod launches
        </label>
        <div class="row">
          <button class={`btn small ${sure ? 'signal' : 'ghost'}`} onClick={() => (sure ? (setSure(false), void resetGame()) : setSure(true))}>
            {sure ? 'Really start over?' : 'New game'}
          </button>
          {sure && (
            <button class="btn small ghost" onClick={() => setSure(false)}>
              Keep playing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

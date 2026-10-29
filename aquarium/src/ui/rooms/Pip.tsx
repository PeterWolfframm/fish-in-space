// PIP: a conversation, not a menu. You tap a phrase, PIP answers in a bubble, and some answers open
// a folder (call log, archive, statistics, settings) or a set of advice cards right in the chat.

import { useEffect, useRef, useState } from 'preact/hooks';
import { game, now, setSetting, resetGame, commsQueue, launch, goRoom } from '../../store/signals';
import { chat, ask, pipThinking, PHRASES, type Topic } from '../../store/pip';
import * as W from '../../game';
import { CAST, type Who } from '../../content/comms/types';
import { Portrait } from '../Art';
import { FishTile, Pill, Stat } from '../kit';
import { labelOf } from '../genes';

const FOLDER: Record<Topic, { title: string; emoji: string }> = {
  advice: { title: 'Recommendations', emoji: '🤖📊🎯' },
  news: { title: 'Bulletin', emoji: '📰📈📉' },
  archive: { title: 'Archive', emoji: '🗂️📚🔭' },
  log: { title: 'Call log', emoji: '📞🗓️💬' },
  stats: { title: 'Statistics', emoji: '📊🏆🔢' },
  settings: { title: 'Settings', emoji: '⚙️🔊🔋' },
};

export function PipPanel() {
  const msgs = chat.value;
  const log = useRef<HTMLDivElement>(null);
  // Only the newest reply of each kind stays open; older ones fold into a tile you can reopen.
  const latest = new Map<Topic, number>();
  for (const m of msgs) if (m.topic) latest.set(m.topic, m.key);
  // Bring the newest message clear of the pinned phrases (its scroll-margin leaves room for them).
  useEffect(() => log.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), [msgs.length, pipThinking.value]);
  return (
    <div class="stack pip-chat">
      {commsQueue.value.length > 0 && <p class="banner">📡 A call is coming in…</p>}
      <div ref={log} class="chat-log" role="log" aria-live="polite" aria-label="Conversation with PIP">
        {msgs.map((m) => (
          <div key={m.key} class={`chat-msg ${m.from}`}>
            {m.from === 'pip' && (
              <span class="portrait-box chat" style={{ '--who': CAST.pip.color }}>
                <Portrait who="pip" />
              </span>
            )}
            <div class="chat-body">
              <p class="chat-bubble">{m.text}</p>
              {m.topic &&
                (latest.get(m.topic) === m.key ? (
                  <Folder topic={m.topic} />
                ) : (
                  <button class="folder closed" onClick={() => ask(m.topic!)}>
                    ▸ {FOLDER[m.topic].title}
                  </button>
                ))}
            </div>
          </div>
        ))}
        {pipThinking.value && (
          <div class="chat-msg pip">
            <span class="portrait-box chat" style={{ '--who': CAST.pip.color }}>
              <Portrait who="pip" mood="talk" talking />
            </span>
            <p class="chat-bubble thinking" aria-label="PIP is thinking">
              <i />
              <i />
              <i />
            </p>
          </div>
        )}
      </div>
      <div class="phrases" role="group" aria-label="Say to PIP">
        {PHRASES.map((p) => (
          <button key={p.topic} class="btn small ghost phrase" disabled={pipThinking.value} onClick={() => ask(p.topic)}>
            {p.say}
          </button>
        ))}
      </div>
    </div>
  );
}

function Folder({ topic }: { topic: Topic }) {
  const Body = { advice: AdviceCards, news: News, archive: Archive, log: CallLog, stats: Stats, settings: Settings }[topic];
  const { title, emoji } = FOLDER[topic];
  return (
    <section class="folder" aria-label={title}>
      <h4>
        {title} <span class="emoji" aria-hidden="true">{emoji}</span>
      </h4>
      <Body />
    </section>
  );
}

function AdviceCards() {
  const s = game.value;
  const cards = W.advise(s);
  return (
    <div class="stack">
      {cards.map((c) => {
        if (c.kind === 'none')
          return (
            <div key="none" class="advice no">
              <p>
                <b>{c.why === 'empty' ? 'No fish aboard.' : 'No fish can be sent.'}</b> Recommended: requisition adequate roe.
              </p>
              <button class="btn small lamp" onClick={() => goRoom('interchange')}>
                To the Interchange
              </button>
            </div>
          );
        const where = W.regionLabel(c.region);
        return (
          <div key={c.fish.id} class="advice">
            <FishTile fish={c.fish} size="md" />
            <div class="advice-meta">
              <Pill tone="sky">☄ {where}</Pill>
              <span class="advice-reward numeral">+{c.reward} ◎</span>
            </div>
            <p class="note">
              Send <b>{W.fishName(c.fish)}</b> {c.kind === 'order' ? `for ${c.order.colony}'s request` : 'to seed it'}. PIP is {c.sure}% sure.
            </p>
            <button class="btn signal" onClick={() => launch(c.fish.id, c.region.id, c.kind === 'order' ? c.order.id : undefined)}>
              Launch
            </button>
          </div>
        );
      })}
    </div>
  );
}

function News() {
  const heads = W.headlines(now.value);
  const top = [...heads.slice(0, 2), ...heads.slice(-1)];
  return (
    <div>
      {top.map((h) => (
        <div key={h.tag} class="headline">
          <span>{h.why}</span>
          <span class={`trend ${h.mult > 1.05 ? 'up' : h.mult < 0.95 ? 'down' : ''}`}>
            {h.tag} ×{h.mult.toFixed(2)}
          </span>
        </div>
      ))}
      <p class="note">This orbit's research valuations drift every few minutes.</p>
    </div>
  );
}

function Archive() {
  const notes = game.value.fieldNotes;
  return (
    <div class="stack">
      <p class="note">
        {notes.species.length} species · {notes.alleles.length}/{W.ALLELES.length} alleles · {notes.regions.length} named places
      </p>
      <h5>Alleles</h5>
      <div class="notes-grid">
        {W.ALLELES.map((al) => (
          <span key={al} class={`chip ${notes.alleles.includes(al) ? 'r-rare' : ''}`}>
            {notes.alleles.includes(al) ? labelOf(al) : '???'}
          </span>
        ))}
      </div>
      <h5>Species</h5>
      <div class="notes-grid">{notes.species.length ? notes.species.map((n) => <span key={n} class="chip">{n}</span>) : <span class="note">None yet.</span>}</div>
      <h5>Bodies</h5>
      <div class="notes-grid">
        {notes.bodies.map((n) => (
          <span key={n} class="chip">
            {n}
          </span>
        ))}
      </div>
      {notes.regions.length > 0 && (
        <>
          <h5>Named places</h5>
          <div class="notes-grid">
            {notes.regions.map((n) => (
              <span key={n} class="chip water">
                {n}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CallLog() {
  const groups = W.logByOrbit(game.value);
  if (!groups.length) return <p class="empty">Quiet on the band.</p>;
  return (
    <div class="call-log">
      {groups.map((g) => (
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
      ))}
    </div>
  );
}

function Stats() {
  const s = game.value;
  const named = s.regions.filter((r) => r.name).length;
  const tiles: [string, number][] = [
    ['Requests filled', s.stats.orders],
    ['Fish seeded', s.stats.seeded],
    ['Clean drops', s.stats.cleanDrops],
    ['Bred', s.stats.bred],
    ['Hatched', s.stats.hatched],
    ['Places named', named],
  ];
  return (
    <div class="stat-row">
      {tiles.map(([k, v]) => (
        <Stat key={k} value={v} label={k} />
      ))}
    </div>
  );
}

const SCALES: W.Settings['uiScale'][] = [1, 1.15, 1.3, 1.5];

function Settings() {
  const s = game.value;
  const [sure, setSure] = useState(false);
  const i = SCALES.indexOf(s.settings.uiScale);
  return (
    <div class="stack">
      <div class="row settings-row">
        <span>Text size</span>
        <button class="btn small ghost" disabled={i <= 0} aria-label="Smaller text" onClick={() => setSetting('uiScale', SCALES[i - 1])}>
          A−
        </button>
        <b class="scale numeral">{Math.round(s.settings.uiScale * 100)}%</b>
        <button class="btn small ghost" disabled={i >= SCALES.length - 1} aria-label="Larger text" onClick={() => setSetting('uiScale', SCALES[i + 1])}>
          A+
        </button>
      </div>
      <label class="row settings-row">
        <input type="checkbox" checked={s.settings.muted} onChange={(e) => setSetting('muted', e.currentTarget.checked)} /> Mute sound
      </label>
      <label class="row settings-row">
        <input type="checkbox" checked={s.settings.batterySaver} onChange={(e) => setSetting('batterySaver', e.currentTarget.checked)} /> Battery saver
        <span class="note">30 fps, no glow or caustics</span>
      </label>
      <label class="row settings-row">
        <input type="checkbox" checked={s.settings.shortPods} onChange={(e) => setSetting('shortPods', e.currentTarget.checked)} /> Short pod launches
      </label>
      <div class="row settings-row">
        <span>Tanks menu edge</span>
        <div class="seg">
          {(['left', 'top', 'bottom', 'right'] as const).map((edge) => (
            <button key={edge} aria-pressed={s.settings.tankMenuEdge === edge} onClick={() => setSetting('tankMenuEdge', edge)}>
              {edge}
            </button>
          ))}
        </div>
      </div>
      <div class="row settings-row">
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
  );
}

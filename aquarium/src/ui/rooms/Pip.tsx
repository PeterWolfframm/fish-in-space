// PIP: a conversation, not a menu. You tap a phrase, PIP answers in a bubble, and some answers open
// a folder (call log, archive, statistics, settings) or a set of advice cards right in the chat.

import { useEffect, useRef, useState } from 'preact/hooks';
import { game, now, setSetting, resetGame, commsQueue, launch, goRoom, boot, askProf, pipSettingsOpen } from '../../store/signals';
import { attachCloudBackend, bootBackend } from '../../store/backend';
import { isMember, online, onAuth, signIn, signOut, user } from '../../store/auth';
import { chat, ask, pipThinking, PHRASES, type Topic } from '../../store/pip';
import * as W from '../../game';
import { CAST, type Who } from '../../content/comms/types';
import { Portrait } from '../Art';
import { FishTile, Pill, Stat, Heading } from '../kit';
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
  if (pipSettingsOpen.value) {
    return (
      <div class="stack pip-settings-screen">
        <div class="row pip-toolbar">
          <button type="button" class="btn small ghost" onClick={() => (pipSettingsOpen.value = false)}>
            ← PIP
          </button>
          <h3>Settings</h3>
        </div>
        <Settings />
      </div>
    );
  }
  return (
    <div class="pip-chat">
      <header class="pip-chat-head">
        <span class="portrait-box chat" style={{ '--who': CAST.pip.color }}>
          <Portrait who="pip" />
        </span>
        <div class="pip-chat-id">
          <b>PIP</b>
          <span class="note">{pipThinking.value ? 'typing…' : 'on the line'}</span>
        </div>
        <button type="button" class="btn small ghost icon" onClick={askProf} aria-label="Ask the Prof" title="Ask the Prof">
          ?
        </button>
        <button type="button" class="btn small ghost icon" onClick={() => (pipSettingsOpen.value = true)} aria-label="Settings" title="Settings">
          ⚙
        </button>
      </header>
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
                To the X-change
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [member, setMember] = useState(isMember());
  const [serverUp, setServerUp] = useState(online);
  useEffect(() => onAuth(() => (setMember(isMember()), setServerUp(online))), []);
  const i = SCALES.indexOf(s.settings.uiScale);
  const signedIn = member && user();
  return (
    <div class="stack">
      <div class="row settings-row stack">
        <span>{serverUp ? 'Hatchery link up' : 'Offline — playing locally'}</span>
        {signedIn ? (
          <div class="row settings-row">
            <span class="note">{signedIn.email ?? signedIn.name ?? 'Signed in'}</span>
            <button
              class="btn small ghost"
              onClick={() => void (async () => {
                signOut();
                await boot(bootBackend());
              })()}
            >
              Sign out
            </button>
          </div>
        ) : serverUp ? (
          <form
            class="stack"
            onSubmit={(e) => {
              e.preventDefault();
              setAuthErr('');
              void signIn(email.trim(), password)
                .then(async () => boot(await attachCloudBackend()))
                .catch((err: Error) => setAuthErr(err.message || 'Sign-in failed'));
            }}
          >
            <label class="row settings-row">
              Email
              <input type="email" autocomplete="username" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
            </label>
            <label class="row settings-row">
              Password
              <input type="password" autocomplete="current-password" value={password} onInput={(e) => setPassword(e.currentTarget.value)} />
            </label>
            {authErr && <span class="note">{authErr}</span>}
            <button class="btn small" type="submit" disabled={!email.trim() || !password}>
              Sign in
            </button>
            <span class="note">Cloud saves, bridge votes, and Fish Tinder sync when signed in.</span>
          </form>
        ) : (
          <span class="note">Connect to the hatchery server to sign in.</span>
        )}
      </div>
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
        <span>Phone menu side</span>
        <div class="seg" role="group" aria-label="Phone menu side">
          {(['left', 'right'] as const).map((edge) => (
            <button key={edge} type="button" aria-pressed={(s.settings.tankMenuEdge === 'left' ? 'left' : 'right') === edge} onClick={() => setSetting('tankMenuEdge', edge)}>
              {edge}
            </button>
          ))}
        </div>
      </div>
      <Heading title="Station log" emoji="📜🛰️🕰️" />
      <div class="log-list station-log">
        {s.log.length ? (
          [...s.log].reverse().map((l, i) => (
            <div key={i} class="log-list-entry">
              {l.icon} {l.text}
            </div>
          ))
        ) : (
          <p class="empty">Quiet shift so far.</p>
        )}
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

// PIP: a conversation, not a menu. You tap a phrase, PIP answers in a bubble, and some answers open
// a folder (call log, archive, statistics, settings) or a set of advice cards right in the chat.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { game, now, orbit, selectFish, setSetting, resetGame, commsQueue, launch, goRoom, planInLab, clearAllPins } from '../../store/signals';
import { chat, ask, pipThinking, PHRASES, planRegion, planTargetOf, type Topic } from '../../store/pip';
import * as W from '../../game';
import { CAST, type Who } from '../../content/comms/types';
import { Portrait } from '../Art';
import { FishTile, Meter, Pill, Stat } from '../kit';
import { labelOf } from '../genes';
import { PinButton } from '../pins';
import { adviceDraft, callDraft, headlineDraft, planDraft, seekDraft } from '../pindrafts';

const FOLDER: Record<Topic, { title: string; emoji: string }> = {
  plan: { title: 'Breeding plan', emoji: '🧬🗺️💞' },
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
  const Body = { plan: BreedPlan, advice: AdviceCards, news: News, archive: Archive, log: CallLog, stats: Stats, settings: Settings }[topic];
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
              <PinButton compact draft={() => adviceDraft(c)} />
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
          <PinButton compact draft={() => headlineDraft(h, orbit.value.n)} />
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
                <PinButton compact draft={() => callDraft(e)} />
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

/** What the region needs, then the pairs whose test eggs meet it best, each with PIP's reasons. */
function BreedPlan() {
  const s = game.value;
  const region = planTargetOf(s);
  const choices = W.planRegions(s).slice(0, 6);
  // Re-plan only when the fish, the requests, the phase or the target change, not every tick.
  const sig = `${region?.id}|${s.phase}|${s.orders.map((o) => o.id).join()}|${s.fish.map((f) => `${f.id}:${f.code}:${f.tank}`).join()}`;
  const plan = useMemo(() => (region ? W.breedPlan(s, region, Date.now()) : null), [sig]);
  if (!region || !plan) return <p class="empty">No open water to plan for yet.</p>;
  const t = plan.target;
  return (
    <div class="stack plan">
      {choices.length > 1 && (
        <div class="plan-regions" role="group" aria-label="Plan for which water?">
          {choices.map((r) => (
            <button key={r.id} class="chip water" aria-pressed={r.id === region.id} onClick={() => (planRegion.value = r.id)}>
              {W.biomeById(r.biome)?.icon} {W.regionLabel(r)}
            </button>
          ))}
        </div>
      )}
      <div class="plan-needs">
        <div class="plan-place">
          <b>{W.regionLabel(region)}</b>
          <span class="note">
            {t.biome.name} · life {Math.round(region.life)}%
          </span>
        </div>
        <Meter value={region.life / 100} tone="life" />
        <h5>What it needs</h5>
        <ul class="need-list">
          {t.needs.map((n) => (
            <li key={n.id} class={`need ${n.source}`}>
              <b>{n.label}</b>
              <span>{n.why}</span>
            </li>
          ))}
        </ul>
        {t.upcoming && <p class="note">⏳ {t.upcoming}</p>}
        {t.ready.length > 0 && (
          <p class="note">
            {t.ready.length} fish aboard already suit this water. “What should I send where?” has them; breed to grow the line.
          </p>
        )}
      </div>
      {plan.pairs.length > 0 && <h5>Who to pair</h5>}
      {plan.pairs.map((p) => (
        <PairCard key={`${p.a.id}:${p.b.id}`} p={p} target={t} />
      ))}
      {plan.seek && (
        <div class="advice no plan-seek">
          <p>
            <b>Shopping list.</b> {plan.seek.text}
          </p>
          <div class="row">
            <button class="btn small lamp" onClick={() => goRoom('interchange')}>
              To the Interchange
            </button>
            <PinButton draft={() => seekDraft(plan.seek!, region)} label="Pin the list" />
          </div>
        </div>
      )}
      <p class="note">PIP's odds come from {plan.sims} test clutches per pair. Real eggs may disagree. PIP will deny everything.</p>
    </div>
  );
}

function PairCard({ p, target }: { p: W.PairPlan; target: W.RegionNeeds }) {
  const s = game.value;
  const a = s.fish.find((f) => f.id === p.a.id) ?? p.a;
  const b = s.fish.find((f) => f.id === p.b.id) ?? p.b;
  const problem = W.breedProblem(s, a, b, now.value);
  const rows = [{ key: 'water', label: 'Can live there', pct: p.water }, ...p.odds.filter((o) => o.need.source === 'order').map((o) => ({ key: o.need.id, label: o.need.label, pct: o.pct }))];
  return (
    <div class="advice plan-pair">
      <div class="plan-parents">
        <FishTile fish={a} size="sm" onClick={() => selectFish(a.id)} />
        <span class="lab-heart" aria-hidden="true">
          ♡
        </span>
        <FishTile fish={b} size="sm" onClick={() => selectFish(b.id)} />
      </div>
      <div class="odds" aria-label="Test-clutch odds">
        {rows.map((r) => (
          <div key={r.key} class="odds-row">
            <span>{r.label}</span>
            <span class="odds-bar">
              <i style={{ width: `${r.pct}%` }} />
            </span>
            <b class="numeral">{r.pct}%</b>
          </div>
        ))}
      </div>
      <ul class="plan-why">
        {p.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {problem && <p class="note warn">Not this minute: {problem}</p>}
      <div class="row plan-actions">
        <button class="btn small lamp" onClick={() => planInLab([a.id, b.id])}>
          💞 Set up in the Lab
        </button>
        <PinButton draft={() => planDraft(p, target)} />
      </div>
    </div>
  );
}

const SCALES: W.Settings['uiScale'][] = [1, 1.15, 1.3, 1.5];
const EDGES = ['top', 'left', 'right', 'bottom'] as const;

function SetGroup({ title, icon, tone, children }: { title: string; icon: string; tone: string; children: ComponentChildren }) {
  return (
    <section class={`set-group tone-${tone}`} aria-label={title}>
      <h5 class="set-head">
        <span aria-hidden="true">{icon}</span> {title}
      </h5>
      <div class="set-body">{children}</div>
    </section>
  );
}

function SetRow({ label, hint, children }: { label: string; hint?: string; children: ComponentChildren }) {
  return (
    <div class="set-row">
      <span class="set-label">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <span class="set-ctl">{children}</span>
    </div>
  );
}

function Toggle({ label, hint, on, set }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label class="set-row">
      <span class="set-label">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <span class="set-ctl">
        <button type="button" role="switch" class="switch" aria-checked={on} onClick={() => set(!on)}>
          <i />
        </button>
      </span>
    </label>
  );
}

/** A two-tap button for things you can't take back. */
function Confirm({ label, really, onYes }: { label: string; really: string; onYes: () => void }) {
  const [sure, setSure] = useState(false);
  return sure ? (
    <span class="row">
      <button class="btn small signal" onClick={() => (setSure(false), onYes())}>
        {really}
      </button>
      <button class="btn small ghost" onClick={() => setSure(false)}>
        Cancel
      </button>
    </span>
  ) : (
    <button class="btn small ghost danger" onClick={() => setSure(true)}>
      {label}
    </button>
  );
}

function Settings() {
  const s = game.value;
  const st = s.settings;
  const pins = s.pins.length;
  const tanksWithPins = new Set(s.pins.map((p) => p.tank)).size;
  return (
    <div class="settings">
      <SetGroup title="Display" icon="🖥️" tone="sky">
        <SetRow label="Text size" hint="Every label on the station">
          <span class="size-pick" role="radiogroup" aria-label="Text size">
            {SCALES.map((v, i) => (
              <button key={v} role="radio" aria-checked={st.uiScale === v} aria-label={`${Math.round(v * 100)}%`} onClick={() => setSetting('uiScale', v)}>
                <span style={{ fontSize: `${0.8 + i * 0.2}rem` }}>Aa</span>
                <small class="numeral">{Math.round(v * 100)}</small>
              </button>
            ))}
          </span>
        </SetRow>
        <SetRow label="Tanks menu" hint="The edge your tank list slides in from">
          <span class="edge-pick" role="radiogroup" aria-label="Tanks menu edge">
            {EDGES.map((edge) => (
              <button key={edge} class={`e-${edge}`} role="radio" aria-checked={st.tankMenuEdge === edge} aria-label={edge} title={edge} onClick={() => setSetting('tankMenuEdge', edge)} />
            ))}
            <span class="edge-glass" aria-hidden="true">
              {st.tankMenuEdge}
            </span>
          </span>
        </SetRow>
      </SetGroup>

      <SetGroup title="Sound & power" icon="🔊" tone="lamp">
        <Toggle label="Sound" hint="Blips, splashes and the hum of the station" on={!st.muted} set={(v) => setSetting('muted', !v)} />
        <Toggle label="Battery saver" hint="30 fps, no glow or caustics" on={st.batterySaver} set={(v) => setSetting('batterySaver', v)} />
        <Toggle label="Short pod launches" hint="Skip the long fall to Mirelle" on={st.shortPods} set={(v) => setSetting('shortPods', v)} />
      </SetGroup>

      <SetGroup title="Tank glass" icon="📌" tone="tank">
        <Toggle
          label="Show pinned notes"
          hint={pins ? `${pins} pin${pins > 1 ? 's' : ''} on ${tanksWithPins} tank${tanksWithPins > 1 ? 's' : ''}` : 'Pin news, plans and fish from PIP or the Lab'}
          on={!st.hidePins}
          set={(v) => setSetting('hidePins', !v)}
        />
        {pins > 0 && (
          <SetRow label="Clear the glass" hint="Unpins every note on every tank">
            <Confirm label="Clear all" really="Unpin all" onYes={clearAllPins} />
          </SetRow>
        )}
      </SetGroup>

      <SetGroup title="Station" icon="🚀" tone="signal">
        <SetRow label="New game" hint="Wipes this station and wakes you up again. No undo.">
          <Confirm label="New game" really="Really start over" onYes={() => void resetGame()} />
        </SetRow>
      </SetGroup>
    </div>
  );
}

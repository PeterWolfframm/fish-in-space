import { briefing, closeBriefing, profOpen, launching, skipLaunch } from '../../store/signals';
import { CHAPTERS } from '../../content/story';
import { CAST } from '../../content/comms/types';
import { Portrait } from '../Art';
import { Bubble } from '../comic/Bubble';
import { useEffect, useState } from 'preact/hooks';

/** The chapter briefing card: a new phase, what changed, what to breed next. */
export function Briefing() {
  const i = briefing.value;
  if (i === null) return null;
  const c = CHAPTERS[i];
  if (!c) return null;
  return (
    <div class="modal-wrap">
      <section class="modal briefing" role="dialog" aria-label={`Chapter ${i}: ${c.title}`}>
        <div class="kicker">CHAPTER {i} · BRIEFING</div>
        <h2>{c.title}</h2>
        <div class="panel-row">
          <div class="portrait-box" style={{ '--who': CAST.prof.color }}>
            <Portrait who="prof" mood="grin" />
          </div>
          <div class="bubble">
            <span class="who">PROF</span>
            {c.mission}
          </div>
        </div>
        <ul>
          {c.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div class="row" style={{ justifyContent: 'space-between' }}>
          <span class="patch">✦ Patch: {c.patch}</span>
          <button class="btn lamp" onClick={closeBriefing} autoFocus>
            On it
          </button>
        </div>
      </section>
    </div>
  );
}

/** Ask the Prof: one context hint, in her voice. */
export function ProfPop() {
  const text = profOpen.value;
  const [done, setDone] = useState(false);
  useEffect(() => setDone(false), [text]);
  if (!text) return null;
  return (
    <div class="prof-pop">
      <section class="comic" role="dialog" aria-label="The Prof's hint" onClick={() => (profOpen.value = null)}>
        <div class="panel-row">
          <div class="portrait-box" style={{ '--who': CAST.prof.color }}>
            <Portrait who="prof" mood="talk" talking={!done} />
          </div>
          <Bubble name="PROF" color={CAST.prof.color} text={text} skip={false} onDone={() => setDone(true)} />
        </div>
        <div class="tap">tap to close ▸</div>
      </section>
    </div>
  );
}

/** The pod countdown. */
export function Countdown() {
  const l = launching.value;
  if (!l || l.count < 0) return null;
  return (
    <div class="countdown" aria-live="assertive">
      <div class="n" key={l.count}>
        {l.count === 0 ? 'GO' : l.count}
      </div>
      <button class="btn small ghost skip" onClick={skipLaunch}>
        Skip ▸▸
      </button>
    </div>
  );
}

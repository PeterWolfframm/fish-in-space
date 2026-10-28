// The comms comic strip: panels appear one at a time, each bubble types out, then choices.

import { useEffect, useState } from 'preact/hooks';
import { commsQueue, dismissComms } from '../../store/signals';
import { CAST, type Who } from '../../content/comms/types';
import { Portrait } from '../Art';
import { Bubble } from './Bubble';

export function ComicStrip() {
  const head = commsQueue.value[0];
  const [shown, setShown] = useState(1);
  const [typed, setTyped] = useState(0); // how many panels have finished typing
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    setShown(1);
    setTyped(0);
    setSkip(false);
  }, [head?.key]);
  if (!head) return null;
  const panels = head.panels.slice(0, shown);
  const allTyped = typed >= head.panels.length;
  const last = shown >= head.panels.length;
  const advance = () => {
    if (typed < shown) return setSkip(true);
    if (!last) {
      setSkip(false);
      return setShown(shown + 1);
    }
    if (!head.choices?.length) dismissComms();
  };
  const clock = new Date(head.at);
  return (
    <div class="comic-wrap">
      <section
        class="comic"
        role="dialog"
        aria-label="Incoming comms"
        tabIndex={0}
        onClick={advance}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), advance())}
      >
        <div class="strip-head">
          <span>
            <span class="live">●</span> ORBIT {head.orbit} · {String(clock.getHours()).padStart(2, '0')}:{String(clock.getMinutes()).padStart(2, '0')}
          </span>
          <span>{commsQueue.value.length > 1 ? `+${commsQueue.value.length - 1} waiting` : ''}</span>
        </div>
        {panels.map((p, i) => {
          const cast = CAST[p.who as Who] ?? CAST.pip;
          return (
            <div key={i} class={`panel-row ${p.side === 'right' ? 'right' : ''}`}>
              <div class="portrait-box" style={{ '--who': cast.color }}>
                <Portrait who={p.who as Who} mood={p.mood} talking={i === shown - 1 && typed < shown} />
              </div>
              <Bubble name={cast.name} color={cast.color} text={p.text} skip={skip || i < shown - 1} onDone={() => setTyped((t) => Math.max(t, i + 1))} />
            </div>
          );
        })}
        {last && allTyped && head.choices?.length ? (
          <div class="choices">
            {head.choices.map((c, i) => (
              <button
                key={i}
                class="btn small lamp"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissComms(i);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : (
          <div class="tap">{last && allTyped ? 'tap to close ▸' : 'tap ▸'}</div>
        )}
      </section>
    </div>
  );
}

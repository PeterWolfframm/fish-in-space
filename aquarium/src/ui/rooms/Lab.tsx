// The Lab: two breeding tanks (pick a parent for each, here or by tapping the tank in the scene), the
// Punnett square for the pair, the blanket, and the Heritage view of every fish's family and genes.
// (Field Notes moved to PIP's archive.)

import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { game, now, labPair, labPick, labBusy, labSpawn } from '../../store/signals';
import * as W from '../../game';
import { FishTile, Heading } from '../kit';
import { alleleColor, labelOf, shows } from '../genes';
import { Heritage } from '../heritage';

/** The colour of a Punnett cell: what the egg would show, or slate for wild type. */
function cellStyle(x: string, y: string) {
  const s = shows(x, y);
  if (!s.length) return { '--c1': alleleColor('wild'), '--c2': alleleColor('wild') };
  return { '--c1': alleleColor(s[0]), '--c2': alleleColor(s[1] ?? s[0]) };
}
const showsLabel = (x: string, y: string) => shows(x, y).map(labelOf).join(' + ') || 'Wild type';

function Slot({ side, fish }: { side: 0 | 1; fish?: W.Fish }) {
  const pick = labPick.value;
  const open = () => (labPick.value = pick === side ? null : side);
  if (fish) return <FishTile fish={fish} size="lg" selected={pick === side} onClick={open} badge={`Tank ${side + 1} · tap to swap`} />;
  return (
    <button type="button" class={`lab-slot ${pick === side ? 'on' : ''}`} aria-pressed={pick === side} onClick={open}>
      <span class="plus">+</span>
      <span>Choose parent {side + 1}</span>
    </button>
  );
}

function Picker({ side }: { side: 0 | 1 }) {
  const s = game.value;
  const pair = labPair.value;
  const other = pair[1 - side] ? s.fish.find((f) => f.id === pair[1 - side]) : undefined;
  const otherSex = other ? W.genomeOf(other.code).sex : null;
  const adults = s.fish.filter((f) => W.isAdult(f) && f.id !== other?.id && (!otherSex || W.genomeOf(f.code).sex !== otherSex) && (!other || f.tank === other.tank));
  const set = (id: string | null) => {
    const p: [string | null, string | null] = [...pair];
    p[side] = id;
    labPair.value = p;
    labPick.value = !p[0] ? 0 : !p[1] ? 1 : null;
  };
  return (
    <div class="card stack lab-picker">
      <Heading
        title={`Who goes in tank ${side + 1}?`}
        emoji="🐟🫧🔍"
        action={
          <button class="btn ghost small" onClick={() => (labPick.value = null)}>
            Done
          </button>
        }
      />
      {other && <p class="note">Showing adults of the opposite sex that share {W.fishName(other)}’s tank.</p>}
      {adults.length ? (
        <div class="pick-grid">
          {adults.map((f) => (
            <FishTile key={f.id} fish={f} size="md" selected={pair[side] === f.id} onClick={() => set(f.id)} />
          ))}
        </div>
      ) : (
        <p class="empty">No adult fits here yet. Fry grow up in a few minutes.</p>
      )}
      {pair[side] && (
        <button class="btn ghost small" onClick={() => set(null)}>
          Empty tank {side + 1}
        </button>
      )}
    </div>
  );
}

function Breeding() {
  const s = game.value;
  const t = now.value;
  const [a, b] = labPair.value;
  const pick = labPick.value;
  const fa = a ? s.fish.find((f) => f.id === a) : undefined;
  const fb = b ? s.fish.find((f) => f.id === b) : undefined;
  const A = fa ? W.allelesOf(fa.code) : null;
  const B = fb ? W.allelesOf(fb.code) : null;
  const why = fa && fb ? W.breedProblem(s, fa, fb, t) : null;
  // Odds: the four cells folded into what the eggs would look like.
  const odds = new Map<string, number>();
  if (A && B) for (const x of A) for (const y of B) odds.set(showsLabel(x, y), (odds.get(showsLabel(x, y)) ?? 0) + 25);
  return (
    <div class="stack">
      <Heading title="Breeding tanks" emoji="💞🐟🫧" note="tap a tank to choose" />
      <div class="lab-pair">
        <Slot side={0} fish={fa} />
        <span class="lab-heart" aria-hidden="true">
          ♡
        </span>
        <Slot side={1} fish={fb} />
      </div>
      {pick !== null && <Picker side={pick} />}

      {A && B && fa && fb ? (
        <>
          <Heading title="Punnett square" emoji="🧬🔬💞" note="one allele from each parent" />
          <div class="punnett" role="table" aria-label="Possible allele pairs">
            <div class="corner" />
            {B.map((y, j) => (
              <div key={j} class="h" role="columnheader">
                <i style={{ background: alleleColor(y) }} />
                {labelOf(y)}
              </div>
            ))}
            {A.map((x, i) => (
              <Fragment key={i}>
                <div class="h" role="rowheader">
                  <i style={{ background: alleleColor(x) }} />
                  {labelOf(x)}
                </div>
                {B.map((y, j) => (
                  <div key={`${i}${j}`} class="cell" role="cell" style={cellStyle(x, y)}>
                    <span>{showsLabel(x, y)}</span>
                    <b class="numeral">25%</b>
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
          <div class="odds">
            {[...odds.entries()]
              .sort((x, y) => y[1] - x[1])
              .map(([label, pct]) => (
                <div key={label} class="odds-row">
                  <span>{label}</span>
                  <span class="odds-bar">
                    <i style={{ width: `${pct}%` }} />
                  </span>
                  <b class="numeral">{pct}%</b>
                </div>
              ))}
          </div>
          <button class="btn signal lab-go" disabled={Boolean(why) || labBusy.value} onClick={labSpawn}>
            {labBusy.value ? 'Shh… blanket’s down' : '♡ Pair them'}
          </button>
          {why && <p class="note warn">{why}</p>}
          {!why && <p class="note">The eggs are laid in their tank in the Hatchery.</p>}
        </>
      ) : (
        <p class="empty">Put an adult in each tank to see what their eggs can carry.</p>
      )}
    </div>
  );
}

export function LabPanel() {
  const [tab, setTab] = useState<'breed' | 'heritage'>('breed');
  return (
    <div class="stack">
      <div class="tabs-big" role="tablist">
        <button role="tab" aria-selected={tab === 'breed'} onClick={() => setTab('breed')}>
          💞 Breeding
        </button>
        <button role="tab" aria-selected={tab === 'heritage'} onClick={() => setTab('heritage')}>
          🌳 Heritage
        </button>
      </div>
      {tab === 'breed' ? <Breeding /> : <Heritage />}
    </div>
  );
}

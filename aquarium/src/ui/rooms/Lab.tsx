// The Lab sheet is only what the tanks ask for: a fish picker, or the genetics view opened from the
// lineage chart on the wall. Pairing itself is the heart on the helix.

import { Fragment } from 'preact';
import { game, now, labPair, labPick, labSheet, setLabSheet } from '../../store/signals';
import * as W from '../../game';
import { FishTile, Heading } from '../kit';
import { alleleColor, labelOf, shows } from '../genes';
import { Heritage } from '../heritage';
import { PinButton } from '../pins';
import { pairDraft } from '../pindrafts';

/** The colour of a Punnett cell: what the egg would show, or slate for wild type. */
function cellStyle(x: string, y: string) {
  const s = shows(x, y);
  if (!s.length) return { '--c1': alleleColor('wild'), '--c2': alleleColor('wild') };
  return { '--c1': alleleColor(s[0]), '--c2': alleleColor(s[1] ?? s[0]) };
}
const showsLabel = (x: string, y: string) => shows(x, y).map(labelOf).join(' + ') || 'Wild type';

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
    const next = !p[0] ? 0 : !p[1] ? 1 : null;
    setLabSheet(next === null ? null : 'pick', next);
  };
  return (
    <div class="card stack lab-picker">
      <Heading
        title={`Who goes in tank ${side + 1}?`}
        emoji="🐟🫧🔍"
        action={
          <button class="btn ghost small" onClick={() => setLabSheet(null)}>
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

/** Punnett square for the fish currently in the two tanks. Shown inside the genetics sheet. */
function PairPreview() {
  const s = game.value;
  const t = now.value;
  const [a, b] = labPair.value;
  const fa = a ? s.fish.find((f) => f.id === a) : undefined;
  const fb = b ? s.fish.find((f) => f.id === b) : undefined;
  const A = fa ? W.allelesOf(fa.code) : null;
  const B = fb ? W.allelesOf(fb.code) : null;
  if (!A || !B || !fa || !fb) return null;
  const why = W.breedProblem(s, fa, fb, t);
  const odds = new Map<string, number>();
  for (const x of A) for (const y of B) odds.set(showsLabel(x, y), (odds.get(showsLabel(x, y)) ?? 0) + 25);
  return (
    <>
      <Heading title="This pair" emoji="🧬🔬💞" note="one allele from each parent" />
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
      <div class="lab-go-row">
        <PinButton draft={() => pairDraft(fa, fb)} label="Pin goal" />
      </div>
      {why ? <p class="note warn">{why}</p> : <p class="note">Tap the heart between the tanks. The eggs land in their Hatchery tank.</p>}
    </>
  );
}

export function LabPanel() {
  const sheet = labSheet.value;
  const pick = labPick.value;
  if (sheet === 'pick' && pick !== null) return <Picker side={pick} />;
  if (sheet === 'genes')
    return (
      <div class="stack">
        <PairPreview />
        <Heritage />
      </div>
    );
  return null;
}

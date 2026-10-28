// The Lab: pick two adults and see the four allele combinations their eggs can carry, then the Field
// Notes of everything seen so far.

import { Fragment } from 'preact';
import { game, labPair, startPair, goRoom } from '../../store/signals';
import * as W from '../../game';
import { SpriteArt } from '../Art';

const CHOICES = W.fish.traits.fieldById('geneA').choices as { id: string; label: string }[];
const labelOf = (a: string) => CHOICES.find((c) => c.id === a)?.label.replace(/\s*\(.*\)/, '') ?? a;
const modeOf = (a: string) => /\((\w+)\)/.exec(CHOICES.find((c) => c.id === a)?.label ?? '')?.[1] ?? 'wild';

/** What a pair of alleles shows: recessives need both copies; dominant and codominant need one. */
function shows(x: string, y: string): string {
  const out = new Set<string>();
  for (const a of [x, y]) {
    if (a === 'wild') continue;
    if (modeOf(a) === 'recessive' ? x === y : true) out.add(labelOf(a));
  }
  return out.size ? [...out].join(' + ') : 'wild type';
}

function Picker({ side }: { side: 0 | 1 }) {
  const s = game.value;
  const pair = labPair.value;
  const other = pair[1 - side] ? s.fish.find((f) => f.id === pair[1 - side]) : undefined;
  const otherSex = other ? W.genomeOf(other.code).sex : null;
  const adults = s.fish.filter((f) => W.isAdult(f) && (!otherSex || W.genomeOf(f.code).sex !== otherSex));
  const set = (id: string | null) => {
    const p: [string | null, string | null] = [...pair];
    p[side] = id;
    labPair.value = p;
  };
  return (
    <label class="stack" style={{ gap: '4px', flex: 1 }}>
      <span class="note">Parent {side + 1}</span>
      <select value={pair[side] ?? ''} onChange={(e) => set(e.currentTarget.value || null)}>
        <option value="">— pick an adult —</option>
        {adults.map((f) => (
          <option key={f.id} value={f.id}>
            {W.genomeOf(f.code).sex === 'f' ? '♀' : '♂'} {W.nameOf(f.code)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LabPanel() {
  const s = game.value;
  const [a, b] = labPair.value;
  const fa = a ? s.fish.find((f) => f.id === a) : undefined;
  const fb = b ? s.fish.find((f) => f.id === b) : undefined;
  const A = fa ? W.allelesOf(fa.code) : null;
  const B = fb ? W.allelesOf(fb.code) : null;
  const notes = s.fieldNotes;
  return (
    <div class="stack">
      <div class="section-title">
        <h3>Punnett square</h3>
        <span class="note">each egg gets one allele from each parent</span>
      </div>
      <div class="row">
        <Picker side={0} />
        <Picker side={1} />
      </div>
      {A && B ? (
        <>
          <div class="punnett" role="table" aria-label="Possible allele pairs">
            <div class="h" />
            {B.map((y, j) => (
              <div key={j} class="h">
                {labelOf(y)}
              </div>
            ))}
            {A.map((x, i) => (
              <Fragment key={i}>
                <div class="h">
                  {labelOf(x)}
                </div>
                {B.map((y, j) => (
                  <div key={`${i}${j}`}>
                    {shows(x, y)}
                    <br />
                    <span class="note">25%</span>
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
          <div class="row">
            <SpriteArt family="fish3" code={fa!.code} anim="swim" class="mini" />
            <span>♡</span>
            <SpriteArt family="fish3" code={fb!.code} anim="swim" class="mini" />
            <button
              class="btn signal small"
              onClick={() => {
                goRoom('hatchery');
                startPair(fa!.id);
              }}
            >
              Pair them in the tank
            </button>
          </div>
        </>
      ) : (
        <p class="empty">Pick two adults of opposite sex to see what their eggs can carry.</p>
      )}

      <div class="section-title">
        <h3>Field Notes</h3>
        <span class="note">
          {notes.species.length} species · {notes.alleles.length}/{W.ALLELES.length} alleles · {notes.regions.length} named
        </span>
      </div>
      <h4 class="note">Alleles</h4>
      <div class="notes-grid">
        {W.ALLELES.map((al) => (
          <span key={al} class={`chip ${notes.alleles.includes(al) ? 'r-rare' : ''}`}>
            {notes.alleles.includes(al) ? labelOf(al) : '???'}
          </span>
        ))}
      </div>
      <h4 class="note">Species</h4>
      <div class="notes-grid">
        {notes.species.length ? notes.species.map((n) => <span key={n} class="chip">{n}</span>) : <span class="note">None yet.</span>}
      </div>
      <h4 class="note">Bodies</h4>
      <div class="notes-grid">
        {notes.bodies.map((n) => (
          <span key={n} class="chip">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

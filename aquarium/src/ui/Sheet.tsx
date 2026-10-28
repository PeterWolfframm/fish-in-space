// The fish dossier: who it is, what water it needs, its genes, and what you can do with it.

import { useState } from 'preact/hooks';
import { game, now, selected, selectFish, startPair, sellFish, launch, handOverWork } from '../store/signals';
import * as W from '../game';
import { SpriteArt } from './Art';

const SEX: Record<string, string> = { m: '♂ Male', f: '♀ Female' };
const STAGE: Record<string, string> = { fry: 'Fry', juvenile: 'Juvenile', adult: 'Adult', elder: 'Elder' };
const ALLELE_TONE: Record<string, string> = { wild: '' };
export const regionName = (s: W.State, id: string) => {
  const r = W.regionById(s, id);
  return r ? W.regionLabel(r) : 'Mirelle';
};
export const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export function Sheet() {
  const id = selected.value;
  const s = game.value;
  const f = id ? s.fish.find((x) => x.id === id) : undefined;
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!f) return null;
  const t = now.value;
  const g = W.genomeOf(f.code);
  const e = W.ecoOf(f.code);
  const names = W.fish.names(g) as { common?: string; binomial?: string };
  const lore = W.fish.lore(g) as { quote?: string; codex?: { text?: string }[] };
  const stage = W.stageOf(f.code);
  const nextAt = stage === 'fry' ? W.GROW.juvenile : stage === 'juvenile' ? W.GROW.adult : null;
  const prevAt = stage === 'fry' ? 0 : stage === 'juvenile' ? W.GROW.juvenile : W.GROW.adult;
  const grow = nextAt ? (f.growth - prevAt) / (nextAt - prevAt) : 1;
  const fits = s.orders.filter((o) => W.meetsAll(f.code, o.reqs));
  const regions = W.liveRegions(s).filter((r) => !W.seedProblem(s, f, r));
  const line = lore.quote ?? lore.codex?.find((c) => c.text)?.text ?? '';
  const price = W.priceOf(f.code, t);
  const trend = W.trend(f.code, t);
  const resting = f.spawnReadyAt > t;
  const work = W.activeWork(s);
  const workFits = work && W.meetsAll(f.code, work.reqs);
  const ask = (key: string, run: () => void) => (confirm === key ? (setConfirm(null), run()) : setConfirm(key));
  const close = () => (setConfirm(null), selectFish(null));

  return (
    <div class="sheet-wrap" onClick={(ev) => ev.target === ev.currentTarget && close()}>
      <section class="sheet" role="dialog" aria-label={`Dossier: ${names.common ?? W.nameOf(f.code)}`}>
        <div class="grab" />
        <button class="close-x" onClick={close} aria-label="Close dossier">
          ×
        </button>
        <div class="dossier-head">
          <div class="portrait">
            <SpriteArt family="fish3" code={f.code} anim="swim" animate />
          </div>
          <div>
            <h2>{names.common ?? W.nameOf(f.code)}</h2>
            <p class="binomial">{names.binomial ?? ''}</p>
            <div class="chips">
              <span class={`chip ${g.sex}`}>{SEX[g.sex] ?? g.sex}</span>
              <span class="chip">{STAGE[stage] ?? stage}</span>
              <span class={`chip r-${g.rarity}`}>{W.cap(g.rarity)}</span>
              <span class="chip">Gen {W.generationOf(g)}</span>
              {g.hybrid !== 'none' && <span class="chip r-rare">Hybrid</span>}
            </div>
          </div>
        </div>
        <div class="meters">
          <label>
            Fed
            <span class="meter">
              <i style={{ width: `${Math.round((1 - f.hunger) * 100)}%` }} />
            </span>
          </label>
          <label>
            {nextAt ? `Growing to ${stage === 'fry' ? 'juvenile' : 'adult'}` : 'Fully grown'}
            <span class="meter grow">
              <i style={{ width: `${Math.round(Math.min(1, grow) * 100)}%` }} />
            </span>
          </label>
        </div>
        <h3>Water it needs</h3>
        <div class="chips">
          <span class="chip water">{W.WORD[e.salinity] ?? W.cap(e.salinity)}</span>
          <span class="chip water">
            {W.WORD[e.temp] ?? W.cap(e.temp)} {e.care.tempC[0]}–{e.care.tempC[1]}°C
          </span>
          <span class="chip water">{W.cap(e.depth)}</span>
        </div>
        <h3>Role in the food web</h3>
        <div class="chips">
          {[W.cap(e.diet), W.WORD[e.level] ?? W.cap(e.level), W.WORD[e.sociality] ?? W.cap(e.sociality), W.cap(e.temperament), W.cap(e.activity)].map((x) => (
            <span class="chip" key={x}>
              {x}
            </span>
          ))}
        </div>
        <h3>Genetic material</h3>
        <div class="chips">
          {[g.geneA, g.geneB].map((a, i) => (
            <span key={i} class={`chip ${ALLELE_TONE[a] ?? 'gene'}`}>
              {a === 'wild' ? 'wild type' : a}
            </span>
          ))}
          <span class="note">two alleles; each parent passes one</span>
        </div>
        {line && <p class="lore">“{line}”</p>}

        {workFits && (
          <>
            <h3>Work order</h3>
            <button class="btn signal" onClick={() => handOverWork(f.id)}>
              ✉ Hand over for “{work.title}” <small>+{work.reward} ◎</small>
            </button>
          </>
        )}
        {fits.length > 0 && (
          <>
            <h3>Fits a request</h3>
            <div class="stack">
              {fits.map((o) => (
                <button key={o.id} class="btn lamp" onClick={() => launch(f.id, o.region, o.id)}>
                  ☄ Drop to {regionName(s, o.region)}
                  <small>
                    {o.colony} · +{o.reward} ◎
                  </small>
                </button>
              ))}
            </div>
          </>
        )}
        <h3>Actions</h3>
        <div class="row">
          <button class="btn signal" disabled={!W.isAdult(f) || resting} onClick={() => startPair(f.id)}>
            ♡ {!W.isAdult(f) ? 'Too young to pair' : resting ? `Resting ${mmss(f.spawnReadyAt - t)}` : 'Pair…'}
          </button>
          <button class="btn" onClick={() => ask('sell', () => sellFish(f.id))}>
            {confirm === 'sell' ? `Sell for ${price} ◎?` : `◎ Sell ${price}`}
            <span class={`trend ${trend}`} aria-label={`price ${trend}`}>
              {trend === 'up' ? '▲' : trend === 'down' ? '▼' : ''}
            </span>
          </button>
        </div>
        {regions.length ? (
          <>
            <h3>Or release freely</h3>
            <div class="row">
              {regions.map((r) => (
                <button key={r.id} class="btn ghost small" onClick={() => ask(`seed:${r.id}`, () => launch(f.id, r.id))}>
                  {confirm === `seed:${r.id}` ? `Release into ${W.regionLabel(r)}?` : `☄ ${W.regionLabel(r)}`}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p class="note">No open region on Mirelle suits it yet. Keep it for breeding or sell it.</p>
        )}
      </section>
    </div>
  );
}

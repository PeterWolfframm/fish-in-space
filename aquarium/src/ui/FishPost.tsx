// The fish post: a full-screen, swipeable view of one fish in its tank, replacing the old slide-up
// dossier. Logic (fits, regions, price, trend, resting, workFits) is carried over from the old Sheet
// unchanged — only the presentation and navigation are new.

import { useEffect, useRef, useState } from 'preact/hooks';
import { game, now, selected, selectFish, startPair, sellFish, launch, handOverWork, feedTank } from '../store/signals';
import * as W from '../game';
import { SpriteArt } from './Art';
import { Heading, mmss, regionName, statusOf } from './kit';
import { labelOf, modeOf } from './genes';
import { PinButton } from './pins';
import { fishDraft } from './pindrafts';

const STAGE: Record<string, string> = { fry: 'Fry', juvenile: 'Juvenile', adult: 'Adult', elder: 'Elder' };
const RARITY_COLOR: Record<string, string> = { common: 'var(--ink-dim)', uncommon: 'var(--bloom)', rare: 'var(--lilac)', myth: 'var(--gold)' };
const SWIPE_PX = 50;

export function FishPost() {
  const id = selected.value;
  const s = game.value;
  const f = id ? s.fish.find((x) => x.id === id) : undefined;
  const [confirm, setConfirm] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);

  const mates = f ? s.fish.filter((x) => x.tank === f.tank) : [];
  const idx = f ? mates.findIndex((x) => x.id === f.id) : -1;

  const go = (d: number) => {
    if (idx < 0 || mates.length < 2) return;
    setConfirm(null);
    setDetails(false);
    selected.value = mates[(idx + d + mates.length) % mates.length].id;
  };
  const close = () => {
    setConfirm(null);
    selectFish(null);
  };

  useEffect(() => {
    if (!f) return;
    cardRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close();
      else if (ev.key === 'ArrowLeft') go(-1);
      else if (ev.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.id]);

  if (!f) return null;
  const t = now.value;
  const g = W.genomeOf(f.code);
  const e = W.ecoOf(f.code);
  const names = W.fish.names(g) as { common?: string; binomial?: string };
  const lore = W.fish.lore(g) as { quote?: string; codex?: { text?: string }[] };
  const stage = W.stageOf(f.code);
  const nextAt = stage === 'fry' ? W.GROW.juvenile : stage === 'juvenile' ? W.GROW.adult : null;
  const fits = s.orders.filter((o) => W.meetsAll(f.code, o.reqs));
  const regions = W.liveRegions(s).filter((r) => !W.seedProblem(s, f, r));
  const line = lore.quote ?? lore.codex?.find((c) => c.text)?.text ?? '';
  const price = W.priceOf(f.code, t);
  const priceTrend = W.trend(f.code, t);
  const resting = f.spawnReadyAt > t;
  const work = W.activeWork(s);
  const workFits = work && W.meetsAll(f.code, work.reqs);
  const st = statusOf(f, t);
  const ask = (key: string, run: () => void) => (confirm === key ? (setConfirm(null), run()) : setConfirm(key));

  let primary: { label: string; cls: string; onClick: () => void } | null = null;
  if (workFits) primary = { label: `✉ Hand over · +${work.reward} ◎`, cls: 'signal', onClick: () => handOverWork(f.id) };
  else if (fits.length) primary = { label: `☄ Send to ${regionName(s, fits[0].region)} · +${fits[0].reward} ◎`, cls: 'lamp', onClick: () => launch(f.id, fits[0].region, fits[0].id) };
  else if (W.isAdult(f) && !resting) primary = { label: '♡ Find a partner', cls: 'signal', onClick: () => startPair(f.id) };
  else if (f.hunger > 0.5) primary = { label: 'Feed the tank', cls: 'tank', onClick: feedTank };

  const onPointerDown = (ev: PointerEvent) => (dragFrom.current = ev.clientX);
  const onPointerUp = (ev: PointerEvent) => {
    if (dragFrom.current == null) return;
    const dx = ev.clientX - dragFrom.current;
    dragFrom.current = null;
    if (dx > SWIPE_PX) go(-1);
    else if (dx < -SWIPE_PX) go(1);
  };

  return (
    <div class="post-wrap" style={{ '--glow': RARITY_COLOR[g.rarity] }} onClick={(ev) => ev.target === ev.currentTarget && close()}>
      <div class="post" role="dialog" aria-modal="true" aria-label={`Fish post: ${f.name ?? names.common ?? W.nameOf(f.code)}`} ref={cardRef} tabIndex={-1}>
        <button class="close-x post-close" onClick={close} aria-label="Close">
          ×
        </button>
        {mates.length > 1 && (
          <>
            <button class="post-arrow left" onClick={() => go(-1)} aria-label="Previous fish">
              ‹
            </button>
            <button class="post-arrow right" onClick={() => go(1)} aria-label="Next fish">
              ›
            </button>
          </>
        )}
        <div class="post-hero" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          <SpriteArt family="fish3" code={f.code} anim="swim" animate scale={4} class="post-sprite" />
        </div>
        {mates.length > 1 && (
          <div class="post-dots" aria-hidden="true">
            {mates.map((m) => (
              <i key={m.id} class={m.id === f.id ? 'on' : ''} />
            ))}
          </div>
        )}
        <div class="post-body">
          <h2>{f.name ?? names.common ?? W.nameOf(f.code)}</h2>
          <p class="post-meta">
            {g.sex === 'f' ? '♀' : '♂'} {STAGE[stage] ?? stage} · <b style={{ color: RARITY_COLOR[g.rarity] }}>{W.cap(g.rarity)}</b> · Gen {W.generationOf(g)}
            {g.hybrid !== 'none' && (
              <>
                {' '}
                · <b style={{ color: RARITY_COLOR.rare }}>Hybrid</b>
              </>
            )}
          </p>
          <span class={`pill ${st.tone === 'bad' ? 'signal' : st.tone === 'lilac' ? '' : st.tone === 'bloom' ? 'bloom' : 'ink-faint'}`}>{st.text}</span>

          {primary ? (
            <button class={`btn ${primary.cls} post-cta`} onClick={primary.onClick}>
              {primary.label}
            </button>
          ) : (
            <button class="btn ghost post-cta" disabled>
              Growing · {mmss(Math.max(0, (nextAt ?? 0) - f.growth) * 1000)} to {stage === 'fry' ? 'juvenile' : 'adult'}
            </button>
          )}
          {fits.length > 1 && (
            <div class="chips">
              {fits.slice(1).map((o) => (
                <button key={o.id} class="chip link-chip" onClick={() => launch(f.id, o.region, o.id)}>
                  ☄ {regionName(s, o.region)} · +{o.reward} ◎
                </button>
              ))}
            </div>
          )}

          <div class="row post-secondary">
            {primary?.cls !== 'signal' && W.isAdult(f) && (
              <button class="btn ghost small" disabled={resting} onClick={() => startPair(f.id)}>
                ♡ {resting ? `Resting ${mmss(f.spawnReadyAt - t)}` : 'Pair…'}
              </button>
            )}
            <button class="btn ghost small" onClick={() => ask('sell', () => sellFish(f.id))}>
              {confirm === 'sell' ? `Sell for ${price} ◎?` : `◎ Sell ${price}`}
              <span class={`trend ${priceTrend}`} aria-label={`price ${priceTrend}`}>
                {priceTrend === 'up' ? '▲' : priceTrend === 'down' ? '▼' : ''}
              </span>
            </button>
            <PinButton draft={() => fishDraft(f, 'fish')} label="Pin portrait" />
          </div>

          <button class="post-details-toggle" aria-expanded={details} onClick={() => setDetails((v) => !v)}>
            <span class="grab" /> {details ? 'Hide details' : 'Details'}
          </button>
          {details && (
            <div class="post-details">
              <Heading title="Needs" emoji="💧🌡️🌊" />
              <div class="chips">
                <span class="chip water">{W.WORD[e.salinity] ?? W.cap(e.salinity)}</span>
                <span class="chip water">
                  {W.WORD[e.temp] ?? W.cap(e.temp)} {e.care.tempC[0]}–{e.care.tempC[1]}°C
                </span>
                <span class="chip water">{W.cap(e.depth)}</span>
              </div>

              <Heading title="Genes" emoji="🧬🎨🔀" />
              <div class="chips">
                {[g.geneA, g.geneB].map((a, i) => (
                  <span key={i} class="chip gene">
                    {labelOf(a)} <small>({modeOf(a)})</small>
                  </span>
                ))}
              </div>

              <Heading title="Family" emoji="🌳🐟🧬" />
              {f.parents?.length ? (
                <div class="post-family">
                  {f.parents.map((p) => {
                    const here = s.fish.find((x) => x.id === p.id);
                    return (
                      <button key={p.id} type="button" class={`chip family ${here ? '' : 'gone'}`} disabled={!here} onClick={() => here && (selected.value = here.id)}>
                        <SpriteArt family="fish3" code={p.code} anim="swim" class="mini" />
                        {W.genomeOf(p.code).sex === 'f' ? '♀' : '♂'} {p.name}
                        {!here && <small> · departed</small>}
                      </button>
                    );
                  })}
                  <span class="note">
                    Gen {W.generationOf(g)} · hatched here{' '}
                    {s.fish.filter((x) => x.parents?.some((p) => p.id === f.id)).length
                      ? `· ${s.fish.filter((x) => x.parents?.some((p) => p.id === f.id)).length} young aboard`
                      : ''}
                  </span>
                </div>
              ) : (
                <p class="note">
                  {{ roe: 'Thawed from Interchange roe.', heritage: 'Heritage stock from the Interchange archive.', crate: 'Came in a mystery crate.', starter: 'One of the first crew aboard.', bred: 'Hatched here.' }[f.origin ?? 'roe']} The Lab’s Heritage view shows the whole family tree.
                </p>
              )}

              <Heading title="Role in the food web" emoji="🍽️🦐🌿" />
              <div class="chips">
                {[W.cap(e.diet), W.WORD[e.level] ?? W.cap(e.level), W.WORD[e.sociality] ?? W.cap(e.sociality), W.cap(e.temperament), W.cap(e.activity)].map((x) => (
                  <span class="chip" key={x}>
                    {x}
                  </span>
                ))}
              </div>

              {line && <p class="lore">“{line}”</p>}

              <Heading title="Release freely" emoji="🌍☄️🕊️" />
              {regions.length ? (
                <div class="row">
                  {regions.map((r) => (
                    <button key={r.id} class="btn ghost small" onClick={() => ask(`seed:${r.id}`, () => launch(f.id, r.id))}>
                      {confirm === `seed:${r.id}` ? `Release into ${W.regionLabel(r)}?` : `☄ ${W.regionLabel(r)}`}
                    </button>
                  ))}
                </div>
              ) : (
                <p class="note">No open region on Mirelle suits it yet. Keep it for breeding or sell it.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// The fish post: the selected fish's card, sliding up above the dock. The sheet reads like a
// trading card — name and length, a large picture, then the catalogue — with the tank actions
// underneath. Logic (fits, regions, price, trend, resting, workFits) is unchanged.

import { useEffect, useRef, useState } from 'preact/hooks';
import { game, now, selected, recall, selectFish, startPair, sellFish, launch, handOverWork, feedTank } from '../store/signals';
import * as W from '../game';
import { SpriteArt } from './Art';
import { mmss, regionName, statusOf } from './kit';
import { labelOf, shows } from './genes';

const STAGE: Record<string, string> = { fry: 'Fry', juvenile: 'Juvenile', adult: 'Adult', elder: 'Elder' };
const RARITY_COLOR: Record<string, string> = { common: 'var(--ink-dim)', uncommon: 'var(--bloom)', rare: 'var(--lilac)', myth: 'var(--gold)' };
const ATTACK: Record<string, string> = {
  diet: 'Diet',
  feeding: 'Feeding',
  temperament: 'Temperament',
  activity: 'Activity',
  depth: 'Depth',
  level: 'Level',
  sociality: 'Company',
  current: 'Current',
  temp: 'Temperature',
  salinity: 'Water',
};
const ORIGIN: Record<string, string> = {
  roe: 'Thawed from X-change roe.',
  heritage: 'Heritage stock from the X-change archive.',
  crate: 'Came in a mystery crate.',
  starter: 'One of the first crew aboard.',
  bred: 'Hatched here.',
};
const SWIPE_PX = 50;

const traitLabel = (field: string, id: string) => W.fish.traits.fieldById(field).choices.find((c) => c.id === id)?.label ?? W.cap(id);
const attackName = (key: string) => {
  const fact = key.split('.')[0] ?? key;
  return ATTACK[fact] ?? W.cap(fact);
};
const word = (id: string) => W.WORD[id] ?? W.cap(id);

export function FishPost() {
  const id = selected.value;
  const mem = recall.value;
  const s = game.value;
  const live = id ? s.fish.find((x) => x.id === id) : undefined;
  const gone = !live && !!mem;
  const f: W.Fish | undefined =
    live ??
    (mem
      ? { id: mem.id, code: mem.code, name: mem.name, tank: '', growth: W.GROW.adult, hunger: 0, spawnReadyAt: 0, born: 0, origin: 'bred' }
      : undefined);
  const [confirm, setConfirm] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragFrom = useRef<number | null>(null);

  const mates = f ? s.fish.filter((x) => x.tank === f.tank) : [];
  const idx = f ? mates.findIndex((x) => x.id === f.id) : -1;

  const go = (d: number) => {
    if (idx < 0 || mates.length < 2) return;
    setConfirm(null);
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
  const eco = W.fish.ecology(g);
  const names = W.fish.names(g);
  const lore = W.fish.lore(g);
  const stage = W.stageOf(f.code);
  const nextAt = stage === 'fry' ? W.GROW.juvenile : stage === 'juvenile' ? W.GROW.adult : null;
  const fits = s.orders.filter((o) => W.meetsAll(f.code, o.reqs));
  const regions = W.liveRegions(s).filter((r) => !W.seedProblem(s, f, r));
  const price = W.priceOf(f.code, t);
  const priceTrend = W.trend(f.code, t);
  const resting = f.spawnReadyAt > t;
  const work = W.activeWork(s);
  const workFits = work && W.meetsAll(f.code, work.reqs);
  const st = gone ? { text: 'Left the station', tone: 'ink-faint' } : statusOf(f, t);
  const ask = (key: string, run: () => void) => (confirm === key ? (setConfirm(null), run()) : setConfirm(key));
  const display = f.name ?? names.common ?? W.nameOf(f.code);
  const alleles = shows(g.geneA, g.geneB).map(labelOf);
  const signature = eco.signature !== 'none' && eco.signature !== 'auto' ? traitLabel('signature', eco.signature) : null;
  const ability = [signature, ...alleles].filter(Boolean).join(' · ');
  const young = s.fish.filter((x) => x.parents?.some((p) => p.id === f.id)).length;

  let primary: { label: string; cls: string; onClick: () => void } | null = null;
  if (!gone && workFits) primary = { label: `✉ Hand over · +${work.reward} ◎`, cls: 'signal', onClick: () => handOverWork(f.id) };
  else if (!gone && fits.length) primary = { label: `☄ Send to ${regionName(s, fits[0].region)} · +${fits[0].reward} ◎`, cls: 'lamp', onClick: () => launch(f.id, fits[0].region, fits[0].id) };
  else if (!gone && W.isAdult(f) && !resting) primary = { label: '♡ Find a partner', cls: 'signal', onClick: () => startPair(f.id) };
  else if (!gone && f.hunger > 0.5) primary = { label: 'Feed the tank', cls: 'tank', onClick: feedTank };

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
      <div class="post" role="dialog" aria-modal="true" aria-label={`Fish post: ${display}`} ref={cardRef} tabIndex={-1}>
        <header class="post-head">
          <h2 title={display}>{display}</h2>
          <span class="post-hp">
            <b>{eco.care.cm}</b> cm
          </span>
          <button class="close-x post-close" onClick={close} aria-label="Close">
            ×
          </button>
        </header>
        <div class="post-hero" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
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
          <SpriteArt family="fish3" code={f.code} anim="swim" animate scale={8} class="post-sprite" />
        </div>
        {mates.length > 1 && (
          <div class="post-dots" aria-hidden="true">
            {mates.map((m) => (
              <i key={m.id} class={m.id === f.id ? 'on' : ''} />
            ))}
          </div>
        )}
        <div class="post-body">
          <p class="post-meta">
            {g.sex === 'f' ? '♀' : '♂'} {STAGE[stage] ?? stage} · <b style={{ color: RARITY_COLOR[g.rarity] }}>{W.cap(g.rarity)}</b> · Gen {W.generationOf(g)}
            {g.hybrid !== 'none' && (
              <>
                {' '}
                · <b style={{ color: RARITY_COLOR.rare }}>Hybrid</b>
              </>
            )}
            {names.title && <> · {names.title}</>}
          </p>
          <p class="post-designation">{lore.designation}</p>
          <span class={`pill ${st.tone === 'bad' ? 'signal' : st.tone === 'lilac' ? '' : st.tone === 'bloom' ? 'bloom' : 'ink-faint'}`}>{st.text}</span>

          {(ability || lore.legend) && (
            <div class="post-ability">
              {ability && (
                <p class="post-ability-name">
                  <b>Ability</b> {ability}
                </p>
              )}
              {lore.legend && <p>{lore.legend.text}</p>}
            </div>
          )}

          <div class="post-attacks">
            {lore.codex.map((c) => (
              <div class="post-attack" key={c.key + c.text}>
                <b>{attackName(c.key)}</b>
                <p>{c.text}</p>
              </div>
            ))}
          </div>

          {lore.quote && (
            <p class="post-flavor">
              “{lore.quote.text}”{lore.quote.by ? <span> — {lore.quote.by}</span> : null}
            </p>
          )}
          <p class="post-edict">{lore.edict.text}</p>

          <div class="post-stats">
            <span>
              <small>Water</small>
              {word(eco.salinity.value)}
            </span>
            <span>
              <small>Temp</small>
              {eco.care.tempC[0]}–{eco.care.tempC[1]}°C
            </span>
            <span>
              <small>pH</small>
              {eco.care.pH[0]}–{eco.care.pH[1]}
            </span>
            <span>
              <small>Current</small>
              {word(eco.current.value)}
            </span>
            <span>
              <small>Depth</small>
              {word(eco.depth.value)}
            </span>
            <span>
              <small>Tank</small>
              {eco.care.litres} L{eco.care.group > 1 ? ` · ${eco.care.group}` : ''}
            </span>
          </div>

          <div class="post-family">
            {f.parents?.length ? (
              <>
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
                  Gen {W.generationOf(g)} · hatched here{young ? ` · ${young} young aboard` : ''}
                </span>
              </>
            ) : (
              <p class="note">
                {ORIGIN[f.origin ?? 'roe']} The Lab’s Heritage view shows the whole family tree.
              </p>
            )}
          </div>

          {gone ? (
            <p class="note">The fish has left the station. The polaroid on the Lab wall is what remains.</p>
          ) : primary ? (
            <button class={`btn ${primary.cls} post-cta`} onClick={primary.onClick}>
              {primary.label}
            </button>
          ) : (
            <button class="btn ghost post-cta" disabled>
              Growing · {mmss(Math.max(0, (nextAt ?? 0) - f.growth) * 1000)} to {stage === 'fry' ? 'juvenile' : 'adult'}
            </button>
          )}
          {!gone && fits.length > 1 && (
            <div class="chips">
              {fits.slice(1).map((o) => (
                <button key={o.id} class="chip link-chip" onClick={() => launch(f.id, o.region, o.id)}>
                  ☄ {regionName(s, o.region)} · +{o.reward} ◎
                </button>
              ))}
            </div>
          )}

          {!gone && (
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
          </div>
          )}

          {gone ? null : regions.length ? (
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
      </div>
    </div>
  );
}

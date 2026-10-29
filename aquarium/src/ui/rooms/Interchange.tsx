// The Interchange: Sel's drawers of roe (restocked each orbit), the mystery crate, plant cuttings,
// tank upgrades, and the buyback board where fish sell at today's market price.

import { useState } from 'preact/hooks';
import { game, now, orbit, buy, sellFish, goRoom } from '../../store/signals';
import * as W from '../../game';
import { SpriteArt } from '../Art';
import { mmss } from '../Sheet';

const KIND: Record<W.DrawerKind, string> = { biome: 'Biome roe', wild: 'Wild roe', heritage: 'Heritage roe' };
const ARROW = { up: '▲', down: '▼', flat: '•' };

export function InterchangePanel() {
  const s = game.value;
  const t = now.value;
  const o = orbit.value;
  const [confirm, setConfirm] = useState<string | null>(null);
  const n = W.currentOrbit(s, t);
  const all = W.drawers(s, n);
  const sold = s.shop.orbit === n ? s.shop.sold : [];
  const cutSold = s.shop.orbit === n ? s.shop.cuttingsSold : [];
  const restock = W.ORBIT_MS * (1 - o.f);
  const crate = W.crateReady(s, t);
  const ask = (key: string, run: () => void) => (confirm === key ? (setConfirm(null), run()) : setConfirm(key));
  return (
    <div class="stack">
      <div class="section-title">
        <h3>Drawers</h3>
        <span class="note">Sel restocks in {mmss(restock)} · {W.occupied(s)}/{s.capacity} berths</span>
      </div>
      <div class="drawers">
        {all.map((d) => {
          const gone = sold.includes(d.index);
          return (
            <button
              key={d.index}
              id={`drawer-${d.index}`}
              class={`drawer ${d.kind}`}
              disabled={gone}
              onClick={() => buy((x) => W.buyDrawer(x, d.index, Date.now()), () => goRoom('hatchery'))}
            >
              <span class="knob" />
              <span class="kind">{gone ? 'Sold' : KIND[d.kind]}</span>
              <span class="tag">{d.tag}</span>
              <span class="row">
                <span class="chip water">{W.biomeName(d.biome)}</span>
                {d.allele && <span class="chip r-rare">{d.allele}</span>}
              </span>
              <span class="price">{d.cost} ◎</span>
            </button>
          );
        })}
      </div>

      <div class="card row" style={{ justifyContent: 'space-between' }}>
        <span>
          <b>▣ Mystery crate</b>
          <br />
          <span class="note">Three roe, one rare or better. Needs 3 berths.</span>
        </span>
        <button class="btn lamp" disabled={!crate} onClick={() => buy((x) => W.buyCrate(x, Date.now()), () => goRoom('hatchery'))}>
          {crate ? `${W.CRATE_COST} ◎` : 'packing…'}
        </button>
      </div>

      <div class="section-title">
        <h3>Cuttings</h3>
        <span class="note">plant them from the Hatchery</span>
      </div>
      <div class="row">
        {W.cuttings(s, n).map((c) => (
          <button
            key={c.index}
            class="btn ghost small"
            disabled={cutSold.includes(c.index)}
            onClick={() => buy((x) => W.buyCutting(x, c.index, Date.now()))}
            aria-label={`${c.name}, ${c.cost} Allotment`}
          >
            <SpriteArt family={c.family} code={c.code} anim={c.family === 'plant3' ? 'idle' : 'sway'} class="mini" />
            {c.name} · {cutSold.includes(c.index) ? 'sold' : `${c.cost} ◎`}
          </button>
        ))}
      </div>

      <div class="section-title">
        <h3>Upgrades</h3>
      </div>
      {W.upgrades(s)
        .filter((u) => u.available || u.owned)
        .map((u) => (
          <div key={u.id} class="card row" style={{ justifyContent: 'space-between' }}>
            <span>
              <b>{u.name}</b>
              <br />
              <span class="note">{u.blurb}</span>
            </span>
            {u.owned ? (
              <span class="chip">installed</span>
            ) : (
              <button class="btn tank small" onClick={() => buy((x) => W.buyUpgrade(x, u.id, Date.now()))}>
                {u.cost} ◎
              </button>
            )}
          </div>
        ))}

      <div class="section-title">
        <h3>Buyback</h3>
        <span class="note">today’s price · tap twice to sell</span>
      </div>
      {s.fish.length ? (
        s.fish.map((f) => {
          const tr = W.trend(f.code, t);
          const key = `sell:${f.id}`;
          return (
            <div key={f.id} class="row" style={{ justifyContent: 'space-between' }}>
              <span class="row">
                <SpriteArt family="fish3" code={f.code} anim="swim" class="mini" />
                {W.nameOf(f.code)}
              </span>
              <span class="row">
                <span class={`trend ${tr}`} aria-label={`price ${tr}`}>
                  {ARROW[tr]}
                </span>
                <button class={`btn small ${confirm === key ? 'signal' : 'ghost'}`} onClick={() => ask(key, () => sellFish(f.id))}>
                  {confirm === key ? 'Sure?' : `${W.priceOf(f.code, t)} ◎`}
                </button>
              </span>
            </div>
          );
        })
      ) : (
        <p class="empty">Nothing to sell.</p>
      )}
    </div>
  );
}

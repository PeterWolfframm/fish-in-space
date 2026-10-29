// The Interchange: Sel's cryo drawers of roe (restocked each orbit), the mystery crate, cuttings, new
// aquariums for the wall, shelf keepsakes, tank upgrades, and the buyback board where fish return to the
// commons at this orbit's research valuation.

import { useState } from 'preact/hooks';
import { game, now, orbit, buy, sellFish, goRoom } from '../../store/signals';
import * as W from '../../game';
import { SpriteArt } from '../Art';
import { Heading, FishTile, Pill, Keepsake, mmss } from '../kit';

const KIND: Record<W.DrawerKind, string> = { biome: 'Biome sample', wild: 'Wild sample', heritage: 'Heritage sample' };
const ARROW = { up: '▲', down: '▼', flat: '•' };
const SHAPES: { shape: W.TankShape; name: string; blurb: string }[] = [
  { shape: '1x1', name: 'Cube', blurb: 'A tidy starter berth block.' },
  { shape: '2x1', name: 'Long tank', blurb: 'Room to cruise.' },
  { shape: '1x2', name: 'Column', blurb: 'For fish who like depth.' },
  { shape: '3x1', name: 'Panorama', blurb: 'A whole wall of water.' },
  { shape: '2x2', name: 'Grand reef', blurb: 'The big one.' },
];

/** A row of roe pearls in a vial, tinted by the drawer's kind. */
function Vial({ kind, gone }: { kind: W.DrawerKind; gone: boolean }) {
  return (
    <span class={`vial ${kind} ${gone ? 'empty' : ''}`} aria-hidden="true">
      <span class="fluid">
        {!gone && [0, 1, 2, 3, 4].map((i) => <i key={i} style={{ '--i': i }} />)}
      </span>
    </span>
  );
}

/** The tank's footprint on the wall, cell by cell. */
function Footprint({ shape }: { shape: W.TankShape }) {
  const { w, h } = W.TANK_DIMS[shape];
  return (
    <span class="footprint" style={{ gridTemplateColumns: `repeat(${w}, 1fr)`, aspectRatio: `${w} / ${h}` }} aria-hidden="true">
      {Array.from({ length: w * h }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

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
  const owned = (code: string) => s.ownedCuttings.filter((c) => c.code === code).length + s.decor.filter((d) => d.code === code).length;
  return (
    <div class="stack">
      <Heading title="Cryo drawers" emoji="🧊🥚🧬" note={`Sel restocks in ${mmss(restock)} · ${W.occupied(s)}/${s.capacity} berths`} />
      <div class="drawers">
        {all.map((d) => {
          const gone = sold.includes(d.index);
          const short = s.credits < d.cost;
          return (
            <button
              key={d.index}
              id={`drawer-${d.index}`}
              class={`drawer ${d.kind}`}
              disabled={gone}
              onClick={() => buy((x) => W.buyDrawer(x, d.index, Date.now()), () => goRoom('hatchery'))}
              aria-label={`${KIND[d.kind]}, ${W.biomeName(d.biome)}, ${d.cost} Allotment${gone ? ', requisitioned' : ''}`}
            >
              {gone && <span class="stamp">Requisitioned</span>}
              <span class="drawer-top">
                <Vial kind={d.kind} gone={gone} />
                <span class="drawer-id">
                  <span class="kind">{KIND[d.kind]}</span>
                  <span class="bay">Bay {String.fromCharCode(65 + d.index)}</span>
                </span>
              </span>
              <span class={`price numeral ${short ? 'short' : ''}`}>
                {d.cost}
                <small> ◎</small>
              </span>
              <span class="tag">“{d.tag}”</span>
              <span class="row">
                <span class="chip water">{W.biomeName(d.biome)}</span>
                {d.allele && <span class="chip r-rare">🧬 {d.allele}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <Heading title="Mystery crate" emoji="📦🎲🌟" />
      <div id="crate" tabIndex={-1} class={`card crate-hero ${crate ? 'ready' : ''}`}>
        <span class="crate-box" aria-hidden="true">
          <span class="lid" />
          <span class="q">?</span>
          {crate && [0, 1, 2, 3, 4, 5].map((i) => <i key={i} class="spark" style={{ '--i': i }} />)}
        </span>
        <span class="crate-copy">
          {crate ? <Pill tone="gold" pulse>● Packed and sealed</Pill> : <Pill>Sel is packing the next one</Pill>}
          <b>Three roe, at least one rare or better</b>
          <span class="note">Sealed field samples for open biomes. Needs 3 free berths.</span>
          <span class="crate-price numeral">
            {W.CRATE_COST}
            <small> ◎</small>
          </span>
        </span>
        <button class="btn lamp" disabled={!crate} onClick={() => buy((x) => W.buyCrate(x, Date.now()), () => goRoom('hatchery'))}>
          {crate ? 'Crack it open' : 'Packing…'}
        </button>
      </div>

      <Heading title="Cuttings" emoji="🌱🪴✂️" note="plant them from the Hatchery" />
      <div class="shop-tiles">
        {W.cuttings(s, n).map((c) => {
          const gone = cutSold.includes(c.index);
          return (
            <button key={c.index} class="shop-tile" disabled={gone} onClick={() => buy((x) => W.buyCutting(x, c.index, Date.now()))} aria-label={`${c.name}, ${c.cost} Allotment`}>
              {gone && <span class="stamp">Taken</span>}
              <span class="pic">
                <SpriteArt family={c.family} code={c.code} anim={c.family === 'plant3' ? 'idle' : 'sway'} animate />
              </span>
              <span class="nm">{c.name}</span>
              <span class="sub">{c.family === 'plant3' ? 'shelf plant' : 'water plant'}</span>
              <span class="cost numeral">{c.cost} ◎</span>
            </button>
          );
        })}
      </div>

      <Heading title="Aquariums" emoji="🐠🧱✨" note={`${s.tanks.length} on the wall`} />
      <div class="shop-tiles tanks">
        {SHAPES.map(({ shape, name, blurb }) => (
          <button key={shape} class="shop-tile tank-tile" onClick={() => ask(`tank:${shape}`, () => buy((x) => W.buyTank(x, shape, Date.now()), () => goRoom('hatchery')))}>
            <span class="pic">
              <Footprint shape={shape} />
            </span>
            <span class="nm">{name}</span>
            <span class="sub">
              {confirm === `tank:${shape}` ? 'Tap again to install' : `${blurb} +${W.TANK_CAPACITY[shape]} berths`}
            </span>
            <span class={`cost numeral ${s.credits < W.TANK_PRICE[shape] ? 'short' : ''}`}>{W.TANK_PRICE[shape]} ◎</span>
          </button>
        ))}
      </div>

      <Heading title="Shelf keepsakes" emoji="🧑‍🚀🫖💎" note="place them from the Hatchery" />
      <div class="shop-tiles">
        {W.SHELF_DECOR.map((d) => (
          <button key={d.code} class="shop-tile" onClick={() => buy((x) => W.buyDecor(x, d.code))}>
            {owned(d.code) > 0 && <span class="have">×{owned(d.code)}</span>}
            <span class="pic">
              <Keepsake code={d.code} />
            </span>
            <span class="nm">{d.name}</span>
            <span class={`cost numeral ${s.credits < d.cost ? 'short' : ''}`}>{d.cost} ◎</span>
          </button>
        ))}
      </div>

      <Heading title="Upgrades" emoji="🛠️🚀⚙️" />
      <div class="upgrades">
        {W.upgrades(s)
          .filter((u) => u.available || u.owned)
          .map((u) => (
            <div key={u.id} class={`card upgrade ${u.owned ? 'owned' : ''}`}>
              <span>
                <b>{u.name}</b>
                <span class="note">{u.blurb}</span>
              </span>
              {u.owned ? (
                <span class="chip">✓ installed</span>
              ) : (
                <button class="btn tank small" onClick={() => buy((x) => W.buyUpgrade(x, u.id, Date.now()))}>
                  {u.cost} ◎
                </button>
              )}
            </div>
          ))}
      </div>

      <Heading title="Return to the commons" emoji="💰🐟📈" note="this orbit’s research valuation · tap twice" />
      {s.fish.length ? (
        <div class="roster buyback" role="group" aria-label="Fish to return">
          {s.fish.map((f) => {
            const tr = W.trend(f.code, t);
            const selling = confirm === f.id;
            return (
              <FishTile
                key={f.id}
                fish={f}
                size="md"
                selected={selling}
                badge={selling ? 'Sure? tap again' : `${W.priceOf(f.code, t)} ◎ ${ARROW[tr]}`}
                onClick={() => ask(f.id, () => sellFish(f.id))}
              />
            );
          })}
        </div>
      ) : (
        <p class="empty">No fish aboard to return.</p>
      )}
    </div>
  );
}

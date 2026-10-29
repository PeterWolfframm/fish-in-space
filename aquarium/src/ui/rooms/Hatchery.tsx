import { useState } from 'preact/hooks';
import { game, selected, pairWith, placing, selectFish, cancelPair, feedTank, activeTank } from '../../store/signals';
import * as W from '../../game';
import { SpriteArt } from '../Art';
import { Heading, FishTile, Pill, Keepsake } from '../kit';

export function HatcheryPanel() {
  const s = game.value;
  const pair = pairWith.value ? s.fish.find((f) => f.id === pairWith.value) : null;
  const cutting = placing.value != null ? s.ownedCuttings[placing.value] : null;
  const tank = s.tanks.find((k) => k.id === activeTank.value) ?? s.tanks[0];
  const fish = s.fish.filter((f) => f.tank === tank.id);
  const eggs = s.eggs.filter((g) => g.tank === tank.id);
  const hungry = fish.filter((f) => f.hunger > 0.5).length;
  const cap = W.tankCapacity(s, tank.id);
  const [open, setOpen] = useState(fish.length <= 6);
  return (
    <div class={`roster-sheet${open ? ' open' : ''}`}>
      {pair && (
        <div class="banner" role="status">
          <span>♡ Pick a partner for {W.fishName(pair)}: tap a fish of the other sex.</span>
          <button class="btn small ghost" onClick={cancelPair}>
            Cancel
          </button>
        </div>
      )}
      {cutting && (
        <div class="banner plant" role="status">
          <span>✿ Tap a glowing slot in the sand to plant {W.itemName(cutting)}.</span>
          <button class="btn small ghost" onClick={() => (placing.value = null)}>
            Cancel
          </button>
        </div>
      )}
      <div class="tank-head">
        <h3>{tank.name}</h3>
        <span class="count numeral">
          {fish.length}/{cap}
        </span>
        {eggs.length > 0 && <span class="note">{eggs.length} clutch{eggs.length > 1 ? 'es' : ''}</span>}
        {hungry > 0 && <Pill tone="signal">{hungry} hungry</Pill>}
        <button class="btn tank" onClick={feedTank} title="Or tap the water to drop a pinch">
          🍤 Feed
        </button>
        {fish.length > 6 && (
          <button class="btn small ghost roster-toggle" aria-expanded={open} aria-controls="hatchery-roster" onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Fish'}
          </button>
        )}
      </div>
      {open && (
        <div id="hatchery-roster">
          <Heading title="Tank roster" emoji="🐟🐠🫧" />
          {fish.length ? (
            <div class="roster" role="group" aria-label="Fish in the tank">
              {fish.map((f) => (
                <FishTile
                  key={f.id}
                  fish={f}
                  size="md"
                  selected={selected.value === f.id}
                  ring={pairWith.value === f.id ? 'pairing' : undefined}
                  onClick={() => selectFish(f.id)}
                />
              ))}
            </div>
          ) : (
            <p class="empty">The tank is empty. The Interchange has roe to thaw.</p>
          )}
          {s.ownedCuttings.length > 0 && (
            <>
              <Heading title="Cuttings" emoji="🌱🪴✂️" note="tap one, then a slot" />
              <div class="roster cuttings" role="group" aria-label="Cuttings to plant">
                {s.ownedCuttings.map((c, i) => (
                  <button key={i} class="fish-tile md" aria-pressed={placing.value === i} onClick={() => (placing.value = placing.value === i ? null : i)}>
                    <span class="glow">
                      {c.family === 'object' ? (
                        <Keepsake code={c.code} />
                      ) : (
                        <SpriteArt family={c.family} code={c.code} anim={c.family === 'plant3' ? 'idle' : 'sway'} />
                      )}
                    </span>
                    <span class="nm">{W.itemName(c)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <Heading title="Station log" emoji="📜🛰️🕰️" />
          <div class="log-list">
            {s.log.slice(-6).reverse().map((l, i) => (
              <div key={i} class="log-list-entry">
                {l.icon} {l.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { game, selected, pairWith, placing, selectFish, feedTank, activeTank, setTank } from '../../store/signals';
import * as W from '../../game';
import { SpriteArt } from '../Art';
import { Heading, FishTile, Keepsake } from '../kit';
import { ProgressPanel } from '../Hud';

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'tanks', label: 'Tanks' },
  { id: 'manage', label: 'Manage' },
  { id: 'progress', label: 'Progress' },
] as const;

export function HatcheryPanel() {
  const s = game.value;
  const tank = s.tanks.find((k) => k.id === activeTank.value) ?? s.tanks[0];
  const fish = s.fish.filter((f) => f.tank === tank.id);
  const eggs = s.eggs.filter((g) => g.tank === tank.id);
  const cap = W.tankCapacity(s, tank.id);
  const pager = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const scrollTo = (i: number) => {
    const el = pager.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };
  const syncPage = useCallback(() => {
    const el = pager.current;
    if (!el || el.clientWidth <= 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setPage(Math.min(TABS.length - 1, Math.max(0, i)));
  }, []);
  useEffect(() => {
    const el = pager.current;
    if (!el) return;
    el.addEventListener('scroll', syncPage, { passive: true });
    return () => el.removeEventListener('scroll', syncPage);
  }, [syncPage]);

  return (
    <div class="hatchery-sheet">
      <nav class="sheet-tabs" aria-label="Hatchery sections">
        {TABS.map((t, i) => (
          <button key={t.id} type="button" aria-current={page === i ? 'true' : undefined} onClick={() => scrollTo(i)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div ref={pager} class="sheet-pager" role="region" aria-label="Hatchery details">
        <section class="sheet-page">
          <Heading title="Tank roster" emoji="🐟🐠🫧" note={`${tank.name} · ${fish.length}/${cap}${eggs.length ? ` · ${eggs.length} clutch${eggs.length > 1 ? 'es' : ''}` : ''}`} />
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
            <p class="empty">The tank is empty. The X-change has roe to thaw.</p>
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
        </section>
        <section class="sheet-page">
          <Heading title="Tank selection" emoji="🧱🐠✨" note={`${s.tanks.length} on the wall`} />
          <div class="stack">
            {s.tanks.map((k) => (
              <button
                key={k.id}
                class="tank-menu-row"
                aria-current={k.id === tank.id}
                onClick={() => setTank(k.id)}
              >
                <span class="dot" aria-hidden="true" />
                <span class="nm">{k.name}</span>
                <span class="shape">{k.shape}</span>
              </button>
            ))}
          </div>
        </section>
        <section class="sheet-page">
          <Heading title="Tank management" emoji="🌡️🍤🔧" note={tank.name} />
          <div class="stack">
            <button class="btn tank" onClick={feedTank} title="Or tap the water to drop a pinch">
              🍤 Feed tank
            </button>
            <div class="card placeholder-card">
              <h4>Temperature</h4>
              <p class="note">Sensor not installed — placeholder for a future thermostat.</p>
            </div>
            <div class="card placeholder-card">
              <h4>Salinity</h4>
              <p class="note">Sensor not installed — placeholder for brackish tuning.</p>
            </div>
            <div class="card placeholder-card">
              <h4>Grow light</h4>
              <p class="note">Not wired yet — day/night follows orbit for now.</p>
            </div>
          </div>
        </section>
        <section class="sheet-page">
          <Heading title="Progress" emoji="🪐✿📈" />
          <ProgressPanel />
        </section>
      </div>
      <div class="sheet-dots" role="tablist" aria-label="Hatchery pages">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={page === i}
            aria-label={t.label}
            onClick={() => scrollTo(i)}
          />
        ))}
      </div>
    </div>
  );
}

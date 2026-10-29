// The station shell: one persistent Pixi canvas behind every room, the HUD, the dock and the room panel.

import { useEffect, useRef } from 'preact/hooks';
import { game, room, ready, activeTank, setTank, waking, tankPan, tankMenuOpen } from '../store/signals';
import { stage, batterySaver } from '../scenes/stage';
import { HatcheryScene } from '../scenes/hatchery/tank';
import { BridgeScene } from '../scenes/bridge/bridge';
import { InterchangeScene } from '../scenes/interchange/interchange';
import { PipScene } from '../scenes/pip/pip';
import { LabScene } from '../scenes/lab/lab';
import { TinderScene } from '../scenes/tinder/tinder';
import { CharacterArt } from '../art/characters';
import * as W from '../game';
import { Hud } from './Hud';
import { Dock } from './Dock';
import { Toasts } from './Toasts';
import { FishPost } from './FishPost';
import { ComicStrip } from './comic/ComicStrip';
import { Briefing, ProfPop, Countdown } from './briefing/Briefing';
import { HatcheryPanel } from './rooms/Hatchery';
import { BridgePanel } from './rooms/Bridge';
import { InterchangePanel } from './rooms/Interchange';
import { PipPanel } from './rooms/Pip';
import { LabPanel } from './rooms/Lab';
import { TinderPanel, TinderDeck } from './rooms/Tinder';

const PANELS = { hatchery: HatcheryPanel, bridge: BridgePanel, interchange: InterchangePanel, pip: PipPanel, lab: LabPanel, tinder: TinderPanel };

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !host.current) return;
    started.current = true;
    let up = false;
    void stage.init(host.current).then(() => {
      up = true;
      stage.register('hatchery', () => new HatcheryScene());
      stage.register('bridge', () => new BridgeScene());
      stage.register('interchange', () => new InterchangeScene());
      stage.register('pip', () => new PipScene());
      stage.register('lab', () => new LabScene());
      stage.register('tinder', () => new TinderScene());
      stage.show(room.value);
    });
    CharacterArt.preload();
    return room.subscribe((r) => up && stage.show(r));
  }, []);

  batterySaver.value = game.value.settings.batterySaver;
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--ui-scale', String(game.value.settings.uiScale));
  const Panel = PANELS[room.value];
  return (
    <div class={`station room-${room.value}`} data-ready={ready.value ? '1' : '0'}>
      <Hud />
      <div class="scene">
        <div class="scene-host" ref={host} />
        {room.value === 'hatchery' && <TankOverlay />}
        {room.value === 'tinder' && <TinderDeck />}
        {waking.value && (
          <div class="wake" aria-hidden="true">
            <i />
            <i />
          </div>
        )}
      </div>
      <section class="panel" aria-label={`${room.value} controls`}>
        <Panel />
      </section>
      <Dock />
      <FishPost />
      <ComicStrip />
      <Briefing />
      <ProfPop />
      <Countdown />
      <Toasts />
    </div>
  );
}

/** Over the tank: its nameplate, a bigger marker per tank, a pop-out listing, and where the camera
 * sits in the glass (the tank never pans vertically, only sideways on the wider shapes). */
function TankOverlay() {
  const tanks = game.value.tanks;
  const cur = tanks.find((k) => k.id === activeTank.value) ?? tanks[0];
  const pan = tankPan.value;
  return (
    <>
      <div class="tank-plate" aria-hidden="true">
        <b>{cur?.name ?? 'Hatchery'}</b> · above {W.PLANET_NAME}
      </div>
      {tanks.length > 1 && (
        <>
          <nav class="tank-dots" aria-label="Switch tank">
            {tanks.map((k) => {
              const [w, h] = k.shape.split('x').map(Number);
              return (
                <button
                  key={k.id}
                  aria-current={k.id === cur?.id}
                  aria-label={k.name}
                  title={k.name}
                  onClick={() => setTank(k.id)}
                  style={{ width: `${0.5 + w * 0.3}rem`, height: `${0.5 + h * 0.5}rem` }}
                />
              );
            })}
          </nav>
          <button class="tank-menu-btn" aria-label="List tanks" aria-expanded={tankMenuOpen.value} onClick={() => (tankMenuOpen.value = !tankMenuOpen.value)}>
            ☰ <b>{tanks.length}</b>
          </button>
          {tankMenuOpen.value && <TankMenu tanks={tanks} cur={cur} edge={game.value.settings.tankMenuEdge} />}
        </>
      )}
      {pan != null && (
        <div class="tank-pan" aria-hidden="true">
          <i style={{ left: `${pan * 100}%` }} />
        </div>
      )}
    </>
  );
}

/** A Mac-menu-bar-style pop-out: the full list of tanks, sliding in from whichever screen edge Settings picks. */
function TankMenu({ tanks, cur, edge }: { tanks: W.Tank[]; cur?: W.Tank; edge: string }) {
  return (
    <>
      <div class="tank-menu-scrim" onClick={() => (tankMenuOpen.value = false)} />
      <nav class={`tank-menu edge-${edge}`} aria-label="Tanks">
        <div class="tank-menu-head">
          <b>Tanks</b>
          <button class="close-x" aria-label="Close" onClick={() => (tankMenuOpen.value = false)}>
            ×
          </button>
        </div>
        {tanks.map((k) => (
          <button
            key={k.id}
            class="tank-menu-row"
            aria-current={k.id === cur?.id}
            onClick={() => {
              setTank(k.id);
              tankMenuOpen.value = false;
            }}
          >
            <span class="dot" aria-hidden="true" />
            <span class="nm">{k.name}</span>
            <span class="shape">{k.shape}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

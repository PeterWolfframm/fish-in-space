// The station shell: one persistent Pixi canvas behind every room, the dock, and the toggleable detail sheet.

import { useEffect, useRef } from 'preact/hooks';
import { game, room, ready, waking, tankPan, panelOpen, selected, recall } from '../store/signals';
import { stage, batterySaver } from '../scenes/stage';
import { HatcheryScene } from '../scenes/hatchery/tank';
import { BridgeScene } from '../scenes/bridge/bridge';
import { InterchangeScene } from '../scenes/interchange/interchange';
import { PipScene } from '../scenes/pip/pip';
import { LabScene } from '../scenes/lab/lab';
import { TinderScene } from '../scenes/tinder/tinder';
import { CharacterArt } from '../art/characters';
import { Dock } from './Dock';
import { StatusStrip } from './Hud';
import { Toasts } from './Toasts';
import { FishPost } from './FishPost';
import { ComicStrip } from './comic/ComicStrip';
import { Briefing, ProfPop, Countdown } from './briefing/Briefing';
import { HatcheryBanners } from './HatcheryBanners';
import { HatcheryPanel } from './rooms/Hatchery';
import { BridgePanel } from './rooms/Bridge';
import { InterchangePanel, VialScreen } from './rooms/Interchange';
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
  const open = panelOpen.value;
  const fishOpen = selected.value != null || recall.value != null;
  const rail = game.value.settings.tankMenuEdge === 'left' ? 'left' : 'right';
  return (
    <div
      class={`station room-${room.value}${open ? ' sheet-open' : ''}${fishOpen ? ' has-fish' : ''} rail-${rail}`}
      data-ready={ready.value ? '1' : '0'}
    >
      <div class="scene">
        <div class="scene-host" ref={host} />
        {room.value === 'hatchery' && tankPan.value != null && (
          <div class="tank-pan" aria-hidden="true">
            <i style={{ left: `${tankPan.value * 100}%` }} />
          </div>
        )}
        {room.value === 'interchange' && <VialScreen />}
        {room.value === 'tinder' && <TinderDeck />}
        {waking.value && (
          <div class="wake" aria-hidden="true">
            <i />
            <i />
          </div>
        )}
      </div>
      <StatusStrip />
      {room.value === 'hatchery' && <HatcheryBanners />}
      <section class={`detail-sheet${open ? ' open' : ''}`} aria-label={`${room.value} controls`} aria-hidden={!open || fishOpen}>
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

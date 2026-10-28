// The station shell: one persistent Pixi canvas behind every room, the HUD, the dock and the room panel.

import { useEffect, useRef } from 'preact/hooks';
import { game, room, ready } from '../store/signals';
import { stage, batterySaver } from '../scenes/stage';
import { HatcheryScene } from '../scenes/hatchery/tank';
import { BridgeScene } from '../scenes/bridge/bridge';
import { CounterScene } from '../scenes/counter/counter';
import { CommsScene } from '../scenes/comms/comms';
import { LabScene } from '../scenes/lab/lab';
import { CharacterArt } from '../art/characters';
import { Hud } from './Hud';
import { Dock } from './Dock';
import { Toasts } from './Toasts';
import { Sheet } from './Sheet';
import { ComicStrip } from './comic/ComicStrip';
import { Briefing, ProfPop, Countdown } from './briefing/Briefing';
import { HatcheryPanel } from './rooms/Hatchery';
import { BridgePanel } from './rooms/Bridge';
import { CounterPanel } from './rooms/Counter';
import { CommsPanel } from './rooms/Comms';
import { LabPanel } from './rooms/Lab';

const PANELS = { hatchery: HatcheryPanel, bridge: BridgePanel, counter: CounterPanel, comms: CommsPanel, lab: LabPanel };

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
      stage.register('counter', () => new CounterScene());
      stage.register('comms', () => new CommsScene());
      stage.register('lab', () => new LabScene());
      stage.show(room.value);
    });
    CharacterArt.preload();
    return room.subscribe((r) => up && stage.show(r));
  }, []);

  batterySaver.value = game.value.settings.batterySaver;
  const Panel = PANELS[room.value];
  return (
    <div class={`station room-${room.value}`} data-ready={ready.value ? '1' : '0'}>
      <Hud />
      <div class="scene" ref={host} />
      <section class="panel" aria-label={`${room.value} controls`}>
        <Panel />
      </section>
      <Dock />
      <Sheet />
      <ComicStrip />
      <Briefing />
      <ProfPop />
      <Countdown />
      <Toasts />
    </div>
  );
}

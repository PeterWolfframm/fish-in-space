import { room, goRoom, commsUnread, game, type Room } from '../store/signals';
import { Portrait } from './Art';

const ROOMS: { id: Room; label: string; ico: string; pip?: boolean }[] = [
  { id: 'hatchery', label: 'Hatchery', ico: '🐟' },
  { id: 'bridge', label: 'Bridge', ico: '🪐' },
  { id: 'interchange', label: 'X-change', ico: '🧺' },
  { id: 'pip', label: 'PIP', ico: '📡', pip: true },
  { id: 'lab', label: 'Lab', ico: '🧬' },
  { id: 'tinder', label: 'Fish-der', ico: '💘' },
];

export function Dock() {
  const orders = game.value.orders.length;
  return (
    <nav class="dock" aria-label="Station rooms">
      <div class="brand">FISH IN SPACE!</div>
      {ROOMS.map((r) => {
        const badge = r.id === 'pip' ? commsUnread.value : r.id === 'bridge' ? orders : 0;
        const active = room.value === r.id;
        return (
          <button key={r.id} aria-current={active ? 'page' : undefined} onClick={() => goRoom(r.id)}>
            <span class="ico" aria-hidden={r.pip ? undefined : true}>
              {r.pip ? (
                <span class="dock-pip">
                  <Portrait who="pip" />
                </span>
              ) : (
                r.ico
              )}
            </span>
            {r.label}
            {badge > 0 && <span class="badge">{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}

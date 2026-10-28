import { room, goRoom, commsUnread, game, type Room } from '../store/signals';

const ROOMS: { id: Room; label: string; ico: string }[] = [
  { id: 'hatchery', label: 'Hatchery', ico: '🐟' },
  { id: 'bridge', label: 'Bridge', ico: '🪐' },
  { id: 'counter', label: 'Roe Counter', ico: '🧺' },
  { id: 'comms', label: 'Comms', ico: '📡' },
  { id: 'lab', label: 'Lab', ico: '🧬' },
];

export function Dock() {
  const orders = game.value.orders.length;
  return (
    <nav class="dock" aria-label="Station rooms">
      <div class="brand">SEEDFALL</div>
      {ROOMS.map((r) => {
        const badge = r.id === 'comms' ? commsUnread.value : r.id === 'bridge' ? orders : 0;
        return (
          <button key={r.id} aria-current={room.value === r.id ? 'page' : undefined} onClick={() => goRoom(r.id)}>
            <span class="ico" aria-hidden="true">
              {r.ico}
            </span>
            {r.label}
            {badge > 0 && <span class="badge">{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}

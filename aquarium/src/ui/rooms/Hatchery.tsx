import { game, now, selected, pairWith, placing, selectFish, cancelPair, feedTank } from '../../store/signals';
import * as W from '../../game';
import { SpriteArt } from '../Art';
import { mmss } from '../Sheet';

export function HatcheryPanel() {
  const s = game.value;
  const t = now.value;
  const pair = pairWith.value ? s.fish.find((f) => f.id === pairWith.value) : null;
  const cutting = placing.value != null ? s.ownedCuttings[placing.value] : null;
  const hungry = s.fish.filter((f) => f.hunger > 0.5).length;
  const cap = s.capacity;
  return (
    <div class="stack">
      {pair && (
        <div class="banner" role="status">
          <span>♡ Pick a partner for {W.nameOf(pair.code)}: tap a fish of the other sex.</span>
          <button class="btn small ghost" onClick={cancelPair}>
            Cancel
          </button>
        </div>
      )}
      {cutting && (
        <div class="banner plant" role="status">
          <span>✿ Tap a glowing slot {cutting.family === 'plant3' ? 'on the dry ledge' : 'in the sand'} to plant {W.plantName(cutting.family, cutting.code)}.</span>
          <button class="btn small ghost" onClick={() => (placing.value = null)}>
            Cancel
          </button>
        </div>
      )}
      <div class="section-title">
        <h3>
          Tank · {s.fish.length}/{cap}
        </h3>
        <span class="note">
          {s.eggs.length ? `${s.eggs.length} clutch${s.eggs.length > 1 ? 'es' : ''} on the sand · ` : ''}
          {hungry ? `${hungry} hungry` : 'all fed'}
        </span>
      </div>
      <div class="row">
        <button class="btn tank" onClick={feedTank}>
          ✦ Feed the tank
        </button>
        <span class="note">or tap the water to drop a pinch</span>
      </div>
      {s.fish.length ? (
        <div class="roster" role="group" aria-label="Fish in the tank">
          {s.fish.map((f) => {
            const g = W.genomeOf(f.code);
            const stage = W.stageOf(f.code);
            const resting = f.spawnReadyAt > t && W.isAdult(f);
            return (
              <button
                key={f.id}
                aria-pressed={selected.value === f.id}
                class={pairWith.value === f.id ? 'pairing' : ''}
                onClick={() => selectFish(f.id)}
                aria-label={`${W.nameOf(f.code)}, ${g.sex === 'f' ? 'female' : 'male'} ${stage}${f.hunger > 0.5 ? ', hungry' : ''}`}
              >
                <SpriteArt family="fish3" code={f.code} anim="swim" />
                <span class={`nm ${f.hunger > 0.5 ? 'hungry' : ''}`}>
                  {g.sex === 'f' ? '♀' : '♂'} {W.nameOf(f.code)}
                </span>
                <span class="sub">{resting ? `rest ${mmss(f.spawnReadyAt - t)}` : stage}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p class="empty">The tank is empty. The Roe Counter has roe to thaw.</p>
      )}
      {s.ownedCuttings.length > 0 && (
        <>
          <div class="section-title">
            <h3>Cuttings</h3>
            <span class="note">tap one, then a slot</span>
          </div>
          <div class="row">
            {s.ownedCuttings.map((c, i) => (
              <button key={i} class="btn small ghost" aria-pressed={placing.value === i} onClick={() => (placing.value = placing.value === i ? null : i)}>
                <SpriteArt family={c.family} code={c.code} anim={c.family === 'plant3' ? 'idle' : 'sway'} class="mini" />
                {W.plantName(c.family, c.code)}
              </button>
            ))}
          </div>
        </>
      )}
      <div class="section-title">
        <h3>Station log</h3>
      </div>
      <div>
        {s.log.slice(-6).reverse().map((l, i) => (
          <div key={i} class="note" style={{ padding: '2px 0' }}>
            {l.icon} {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

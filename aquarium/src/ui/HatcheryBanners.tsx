import { game, pairWith, placing, cancelPair } from '../store/signals';
import * as W from '../game';

/** Pairing / planting prompts float above the dock even when the detail sheet is closed. */
export function HatcheryBanners() {
  const s = game.value;
  const pair = pairWith.value ? s.fish.find((f) => f.id === pairWith.value) : null;
  const cutting = placing.value != null ? s.ownedCuttings[placing.value] : null;
  if (!pair && !cutting) return null;
  return (
    <div class="hatchery-banners" role="status">
      {pair && (
        <div class="banner">
          <span>♡ Pick a partner for {W.fishName(pair)}: tap a fish of the other sex.</span>
          <button class="btn small ghost" onClick={cancelPair}>
            Cancel
          </button>
        </div>
      )}
      {cutting && (
        <div class="banner plant">
          <span>✿ Tap a glowing slot in the sand to plant {W.itemName(cutting)}.</span>
          <button class="btn small ghost" onClick={() => (placing.value = null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

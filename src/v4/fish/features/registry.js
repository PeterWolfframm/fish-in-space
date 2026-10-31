// Every fish4 feature module, in genome order. Append only: a module's position is its place in
// the code, and its salt is its roll stream. See .claude/skills/extend-fish4.

import helmet from './helmet.js';
import desertKit from './desertKit.js';
import spiceEyes from './spiceEyes.js';
import { mutA, mutB, mutC } from './mutations.js';
import forgeKit from './forgeKit.js';

export const FEATURES = [helmet, desertKit, spiceEyes, mutA, mutB, mutC, forgeKit];

export const featureById = (id) => FEATURES.find((f) => f.id === id) ?? null;

/** The genome fields the features add, in registry order. */
export const FEATURE_FIELDS = FEATURES.map((f) => f.genomeField);

/**
 * The v3 painter's parts with the feature parts spliced in at their layers. `paramsOf(id)` gives a
 * module's look params (studio overrides, else its defaults); `enabled(id)` can switch a module
 * off for the studio's per-layer toggles.
 */
export function partsWith(base, { paramsOf = (id) => featureById(id)?.defaults ?? {}, enabled = () => true } = {}) {
  const parts = base.filter((p) => enabled(p.id));
  for (const f of FEATURES) {
    if (!enabled(f.id)) continue;
    const painters = [[f.id, f.layer, f.draw]];
    if (f.behind) painters.push([`${f.id}Behind`, f.behind.layer, f.behind.draw]);
    for (const [id, layer, draw] of painters) {
      const [where, anchor] = layer.split(':');
      const part = {
        id,
        feature: true,
        paint: (ctx) => {
          const value = ctx.v4?.[f.id];
          if (value && value !== f.none) draw(ctx, value, { ...f.defaults, ...paramsOf(f.id) });
        },
      };
      let i = parts.findIndex((p) => p.id === anchor);
      if (i < 0) i = parts.length - 1;
      parts.splice(where === 'before' ? i : i + 1, 0, part);
    }
  }
  return parts;
}

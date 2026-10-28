// Region Life and survey state as arrays in planet-map order, for painting. Cached per state.

import type { State } from '../game/types';
import { planetRegions } from '../planet/gen';

let last: State | null = null;
let out = { life: [] as number[], open: [] as number[] };

export function regionLive(s: State) {
  if (s === last) return out;
  last = s;
  const seeds = planetRegions(s.planet);
  const byId = new Map(s.regions.map((r) => [r.id, r]));
  out = {
    life: seeds.map((x) => Math.round(byId.get(x.id)?.life ?? 0)),
    open: seeds.map((x) => (byId.get(x.id)?.opened ? 1 : 0)),
  };
  return out;
}

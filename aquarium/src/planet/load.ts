// The planet map, generated once per seed (in a worker when possible) and shared by every scene.

import type { PlanetMap } from './gen';
import { prepare, type PaintPrep } from './paint';
import PlanetWorker from './planet.worker?worker';

export interface Planet {
  map: PlanetMap;
  prep: PaintPrep;
}

const cache = new Map<string, Promise<Planet>>();

export function loadPlanet(seed: string): Promise<Planet> {
  const hit = cache.get(seed);
  if (hit) return hit;
  const p = new Promise<PlanetMap>((resolve) => {
    const fallback = () => import('./gen').then((g) => resolve(g.generatePlanet(seed)));
    try {
      const w = new PlanetWorker();
      w.onmessage = ({ data }) => (resolve(data as PlanetMap), w.terminate());
      w.onerror = () => (w.terminate(), void fallback());
      w.postMessage({ seed });
    } catch {
      void fallback();
    }
  }).then((map) => ({ map, prep: prepare(map) }));
  cache.set(seed, p);
  return p;
}

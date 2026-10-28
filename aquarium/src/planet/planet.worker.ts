// Generates the planet map off the main thread.
import { generatePlanet } from './gen';

self.onmessage = ({ data }: MessageEvent<{ seed: string }>) => {
  const m = generatePlanet(data.seed);
  (self as unknown as Worker).postMessage(m, [m.height.buffer, m.temp.buffer, m.moist.buffer, m.cls.buffer, m.region.buffer]);
};

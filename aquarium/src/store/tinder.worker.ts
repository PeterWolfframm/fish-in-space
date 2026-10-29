// The taste net, off the main thread. It learns from Fish Tinder swipes and nothing else: the
// personal model is fine-tuned from the public one (when signed in) on this player's swipes, and
// scores cards for the "match" readout. Messages: setPublic, train, score; each replies {id, result}.

import { trainModel, loadModel } from '@forge/pixelgen/model.js';
import { score, insights } from '@forge/pixelgen/beautify.js';
import { generator, fromCode } from '@forge/gen/registry.js';

interface Model {
  predict(x: Float32Array): { beauty: number };
}
interface Swipe {
  user: string;
  kind: string;
  code: string;
  verdict: 'approve' | 'pass';
  created?: string;
}

const gen = generator('fish4');
let pub: Model | null = null;
let personal: Model | null = null;

// Insight labels in plain words, for the "your type" card.
const WORDS: Record<string, [string, string]> = {
  colors: ['more colours', 'fewer colours'],
  lumMean: ['brighter fish', 'darker fish'],
  lumSd: ['strong shading', 'flat shading'],
  lumRange: ['high contrast', 'low contrast'],
  localContrast: ['crisp detail', 'soft detail'],
  bgContrast: ['standing out from the water', 'blending into the water'],
  satMean: ['vivid colour', 'muted colour'],
  satSd: ['mixed saturation', 'even saturation'],
  hueSpread: ['many hues', 'one hue'],
  hueEntropy: ['rainbow palettes', 'tight palettes'],
  darkShare: ['dark patches', 'few dark patches'],
  brightShare: ['bright highlights', 'few highlights'],
  fill: ['chunky bodies', 'slender bodies'],
  compactness: ['round shapes', 'spiky shapes'],
  noise: ['speckles', 'clean surfaces'],
  jaggies: ['frilly outlines', 'smooth outlines'],
  symmetryX: ['symmetry', 'asymmetry'],
  clusters: ['busy patterns', 'simple patterns'],
  scale: ['big fish', 'small fish'],
};

function taste(net: Model) {
  const raw = insights(net, [gen], { probes: 3, top: 4 }) as { up: { label: string; delta: number }[]; down: { label: string; delta: number }[] };
  const word = (l: string, i: 0 | 1) => WORDS[l.replace(/^more /, '')]?.[i] ?? l;
  return { likes: raw.up.map((e) => word(e.label, 0)), dislikes: raw.down.map((e) => word(e.label, 0)) };
}

const handlers: Record<string, (msg: Record<string, unknown>) => unknown> = {
  setPublic({ record }) {
    pub = loadModel(record) as Model | null;
    return !!pub;
  },
  train({ swipes }) {
    const list = swipes as Swipe[];
    // It needs both sides: on likes alone every fish looks like a 100% match.
    if (list.length < 4 || new Set(list.map((s) => s.verdict)).size < 2) {
      personal = null;
      return null;
    }
    const out = trainModel(list, { scope: 'personal', base: pub }) as { net: Model; stats: Record<string, unknown> } | null;
    personal = out?.net ?? null;
    return out ? { stats: out.stats, taste: taste(out.net) } : null;
  },
  score({ codes }) {
    const model = personal ?? pub;
    return (codes as string[]).map((c) => {
      if (!model) return null;
      const g = fromCode(gen, c);
      return g ? score(gen, g, model) : null;
    });
  },
};

self.onmessage = ({ data }: MessageEvent<{ id: number; type: string }>) => {
  try {
    const result = handlers[data.type]?.(data as unknown as Record<string, unknown>);
    self.postMessage({ id: data.id, result });
  } catch (e) {
    self.postMessage({ id: data.id, error: (e as Error).message });
  }
};

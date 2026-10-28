// pixelgen's heavy lifting, off the main thread so the deck never stutters: rolling and
// beautifying cards, scoring, and training models.
//
// Messages are {id, type, ...args}; replies {id, result} or {id, error}.

import { generator, fromCode } from '../src/gen/registry.js';
import { hasStyle, still } from '../src/pixelgen/features.js';
import { beautify, pickGood, scoreBoth, blend, insights } from '../src/pixelgen/beautify.js';
import { trainModel, loadModel, modelRecord } from '../src/pixelgen/model.js';

const models = { public: null, personal: null };
const cache = new Map(); // feature vectors by kind|code
const normalize = (gen, g) => (gen.normalize ? gen.normalize(g) : gen.traits.normalize(g));

/** The model a deck/forge mode means; personal falls back to public until it exists. */
function modelFor(mode) {
  if (mode === 'public') return models.public;
  if (mode === 'personal') return models.personal ?? models.public;
  if (mode === 'blend') return blend(models.public, models.personal, 0.5);
  return null;
}

/** The anim a card or thumbnail plays: a loop that shows the grown sprite, or null for a still. */
const animFor = (gen) => gen.anims.find((a) => a.id === 'wind') ?? gen.anims.find((a) => a.frames > 1 && a.id !== 'stages' && a.id !== 'grow') ?? null;

/** A sprite's frames as the deck plays them; codes are what is stored, so render from the code. */
function framesOf(gen, genome, { animate = true } = {}) {
  const anim = animate && animFor(gen);
  if (!anim) return { frames: [still(gen, genome)], fps: 1 };
  return { frames: Array.from({ length: anim.frames }, (_, i) => gen.frame(genome, anim.id, i)), fps: anim.fps || 6 };
}

const fixedOf = (gen, look) => (look && look !== 'auto' && hasStyle(gen) ? { look } : {});

const handlers = {
  setModels({ public: pub, personal }) {
    if (pub !== undefined) models.public = loadModel(pub);
    if (personal !== undefined) models.personal = loadModel(personal);
    return { public: !!models.public, personal: !!models.personal };
  },

  /** A deck card: rolled (past the weakest of a few, with a model) and beautified. */
  card({ kind, seed, mode, look }) {
    const gen = generator(kind);
    const model = modelFor(mode);
    let genome = model ? pickGood(gen, model, seed, { pool: 4, floor: 0.3 }) : gen.fromSeed(seed);
    const fixed = fixedOf(gen, look);
    genome = model && hasStyle(gen) ? beautify(gen, genome, model, { fixed, rounds: 1 }).genome : normalize(gen, { ...genome, ...fixed });
    const code = gen.traits.encode(genome);
    const shown = fromCode(gen, code);
    return { kind, seed, code, genome: shown, scores: scoreBoth(gen, shown, models), ...framesOf(gen, shown) };
  },

  /** Frames of a stored code (or a still, with animate: false). */
  frames({ kind, code, animate = true }) {
    const gen = generator(kind);
    const genome = gen && fromCode(gen, code);
    return genome ? framesOf(gen, genome, { animate }) : null;
  },

  beautify({ kind, code, mode, look }) {
    const gen = generator(kind);
    const genome = fromCode(gen, code);
    const model = modelFor(mode);
    if (!genome || !model) return null;
    const out = beautify(gen, genome, model, { fixed: fixedOf(gen, look), rounds: 1 });
    return { genome: out.genome, code: gen.traits.encode(out.genome), before: out.before, beauty: out.beauty };
  },

  /** Beautify a genome in place of a code (Forge rolls, whose seed-made genome is the truth). */
  beautifyGenome({ kind, genome, mode, look }) {
    const gen = generator(kind);
    const model = modelFor(mode);
    if (!model) return null;
    const out = beautify(gen, genome, model, { fixed: fixedOf(gen, look), rounds: 1 });
    return { genome: out.genome, before: out.before, beauty: out.beauty };
  },

  /** Both scores of a code, or of a genome. */
  score({ kind, code, genome }) {
    const gen = generator(kind);
    const g = genome ?? (gen && fromCode(gen, code));
    return g ? scoreBoth(gen, g, models) : { public: null, personal: null };
  },

  /** Train a model on swipes; personal starts from the public one. Returns a storable record. */
  train({ scope, swipes, user = null, withInsights = false }) {
    const out = trainModel(swipes, { scope, base: scope === 'personal' ? models.public : null, k: scope === 'public' && swipes.length >= 40 ? 5 : 0, cache });
    if (!out) return null;
    models[scope] = out.net;
    const stats = { ...out.stats };
    if (withInsights) stats.insights = insights(out.net, [...new Set(swipes.map((s) => s.kind))].map(generator).filter(Boolean), { probes: 2 });
    return modelRecord(scope, out.net, stats, user);
  },

  insights({ scope, kinds }) {
    const m = models[scope];
    return m ? insights(m, kinds.map(generator).filter(Boolean), { probes: 2 }) : null;
  },
};

self.onmessage = async ({ data: { id, type, ...args } }) => {
  try {
    self.postMessage({ id, result: await handlers[type](args) });
  } catch (e) {
    self.postMessage({ id, error: e.message });
  }
};

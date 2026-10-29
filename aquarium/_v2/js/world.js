// FISH IN SPACE! rules: the planet, its phases and biomes, seeding requests, the exchange, the vault,
// breeding, growth and the save. Pure: no DOM, no clock of its own (every call takes `now`), so it
// runs the same in the browser, in a worker and under `node --test`.

import fish from '../../../src/v3/fish/index.js';

export const SAVE_VERSION = 1;
export const START_CREDITS = 150;
export const MAX_ORDERS = 3;
export const ORDER_EVERY = 75_000;
export const EGG_HATCH = 20_000;
export const ROE_THAW = 5_000;
export const SPAWN_COOLDOWN = 90_000;
export const GROW = { juvenile: 60, adult: 150 }; // seconds of growth to reach each stage
export const HUNGER_PER_S = 1 / 300;
export const BASE_CAPACITY = 10;
export const MAX_CAPACITY = 30;
const OFFLINE_CAP = 6 * 3600_000;

// --- planet --------------------------------------------------------------------------------------

export const PLANET = 'Mirelle';

export const PHASES = [
  { name: 'First Thaw', bloom: 0, story: 'The ice caps of Mirelle have cracked. Meltwater is pooling in the northern basins: clean, cold, and completely empty. Let’s give it a pulse, Doc.' },
  { name: 'Rivers Run', bloom: 120, story: 'The lakes overflowed overnight! Meltwater is carving rivers down the Glassrun valleys. Running water wants strong swimmers.' },
  { name: 'Brine Rising', bloom: 300, story: 'Rivers met the old salt flats and made a delta. Brackish water! Also: the lakes are warming. Cold-water lines will struggle there now.' },
  { name: 'Warm Seas', bloom: 540, story: 'The equatorial basin filled. Mirelle has a sea! The engines report coral scaffolds taking hold. The rivers and delta are warming up too.' },
  { name: 'The Deep Wakes', bloom: 840, story: 'Something is glowing in the Lanternfall Trench. Mineral light, not life… yet. The deep needs fish that can see in the dark. Upwelling is chilling the delta.' },
  { name: 'Living World', bloom: 1200, story: 'The Accord has declared Mirelle a living world. Every biome is open, and every colony wants something. You did this, Doc.' },
];

export const BIOMES = [
  { id: 'melt', name: 'Meltwater Lakes', icon: '❄', color: '#8fd8ee', opens: 0, blurb: 'Glacial basins in the north, clear as glass.',
    conds: [{ from: 0, salinity: 'fresh', temp: 'cold' }, { from: 2, salinity: 'fresh', temp: 'temperate' }] },
  { id: 'river', name: 'Glassrun Rivers', icon: '≋', color: '#6fc3a8', opens: 1, blurb: 'Fast valleys carved by the overflowing lakes.',
    conds: [{ from: 1, salinity: 'fresh', temp: 'temperate' }, { from: 3, salinity: 'fresh', temp: 'tropical' }] },
  { id: 'delta', name: 'Brinemouth Delta', icon: '☘', color: '#c9b46a', opens: 2, blurb: 'Where river silt meets the salt flats.',
    conds: [{ from: 2, salinity: 'brackish', temp: 'temperate' }, { from: 3, salinity: 'brackish', temp: 'tropical' }, { from: 4, salinity: 'brackish', temp: 'cold' }] },
  { id: 'reef', name: 'Coral Nursery', icon: '❁', color: '#f08fa8', opens: 3, blurb: 'Warm equatorial shallows on engine-grown coral.',
    conds: [{ from: 3, salinity: 'marine', temp: 'tropical' }] },
  { id: 'trench', name: 'Lanternfall Trench', icon: '✦', color: '#8b7cf0', opens: 4, blurb: 'A cold, deep scar lit by glowing minerals.',
    conds: [{ from: 4, salinity: 'marine', temp: 'cold', depth: ['twilight', 'abyss'] }] },
];

export const biomeById = (id) => BIOMES.find((b) => b.id === id);
export const openBiomes = (phase) => BIOMES.filter((b) => b.opens <= phase);
export function condOf(biome, phase) {
  return biome.conds.filter((c) => c.from <= Math.max(phase, biome.opens)).at(-1);
}
/** What changes at the next phase, for PIP's forecast. */
export function forecast(phase) {
  const next = PHASES[phase + 1];
  if (!next) return [];
  const out = [];
  for (const b of BIOMES) {
    if (b.opens === phase + 1) out.push(`${b.name} opens (${condWords(condOf(b, phase + 1))})`);
    else if (b.opens <= phase) {
      const now = condOf(b, phase);
      const then = condOf(b, phase + 1);
      if (now !== then) out.push(`${b.name}: ${condWords(now)} → ${condWords(then)}`);
    }
  }
  return out;
}
export const condWords = (c) => [c.salinity, c.temp, c.depth && 'deep'].filter(Boolean).join(', ');

// --- small helpers ------------------------------------------------------------------------------

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rng(seed) {
  let a = hash(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

// --- fish facts, cached by code -------------------------------------------------------------------

const genomeCache = new Map();
const ecoCache = new Map();
const remember = (map, k, v) => {
  if (map.size > 600) map.clear();
  map.set(k, v);
  return v;
};
export function genomeOf(code) {
  return genomeCache.get(code) ?? remember(genomeCache, code, fish.normalize(fish.fromCode(code)));
}
export const codeOf = (genome) => fish.traits.encode(fish.normalize(genome));
const NORM = { temp: { polar: 'cold', volcanic: 'tropical' }, depth: { void: 'abyss' } };
/** The ecology values the game plays with, flattened. */
export function ecoOf(code) {
  const hit = ecoCache.get(code);
  if (hit) return hit;
  const e = fish.ecology(genomeOf(code));
  const v = (k) => NORM[k]?.[e[k].value] ?? e[k].value;
  return remember(ecoCache, code, {
    salinity: v('salinity'), temp: v('temp'), depth: v('depth'), diet: v('diet'), level: v('level'),
    sociality: v('sociality'), temperament: v('temperament'), activity: v('activity'), care: e.care,
  });
}
export const nameOf = (code) => fish.name(genomeOf(code));
export const generationOf = (g) => Number(String(g.generation).slice(1)) || 0;
export const allelesOf = (code) => {
  const g = genomeOf(code);
  return [g.geneA, g.geneB];
};
export const stageOf = (code) => genomeOf(code).stage;
export const withStage = (code, stage) => codeOf({ ...genomeOf(code), stage });

export function fitsBiome(code, biome, phase) {
  const c = condOf(biome, phase);
  const e = ecoOf(code);
  return (e.salinity === 'any' || e.salinity === c.salinity) && e.temp === c.temp && (!c.depth || c.depth.includes(e.depth));
}

/** Does this fish meet one requirement? */
export function meets(code, req) {
  if (req.kind === 'eco') {
    const v = ecoOf(code)[req.key];
    if (req.key === 'salinity' && v === 'any') return true;
    return Array.isArray(req.value) ? req.value.includes(v) : v === req.value;
  }
  if (req.kind === 'gene') return allelesOf(code).includes(req.allele);
  if (req.kind === 'bred') return generationOf(genomeOf(code)) >= 1;
  if (req.kind === 'adult') return ['adult', 'elder'].includes(stageOf(code));
  return false;
}
export const meetsAll = (code, reqs) => reqs.every((q) => meets(code, q));
export const score = (code, reqs) => reqs.filter((q) => meets(code, q)).length;

// --- the vault ------------------------------------------------------------------------------------

/** A real fish that suits the biome, from a seed. Tries a few hundred seeds before settling. */
export function rollForBiome(biome, phase, seed, stage = 'juvenile') {
  let last;
  for (let i = 0; i < 400; i++) {
    const g = fish.fromSeed(`${seed}:${i}`);
    last = codeOf({ ...g, stage });
    if (fitsBiome(last, biome, phase)) return last;
  }
  return last;
}
export const rollWild = (seed, stage = 'juvenile') => codeOf({ ...fish.fromSeed(seed), stage });

export function vaultItems(state) {
  const items = [{ id: 'wild', kind: 'roe', name: 'Wildcard roe', note: 'Unsorted vault stock. Anything could thaw.', cost: 35 }];
  for (const b of openBiomes(state.phase)) {
    items.push({ id: `roe:${b.id}`, kind: 'roe', biome: b.id, name: `${b.name} roe`, note: `Sorted for ${condWords(condOf(b, state.phase))} water.`, cost: 50 + 20 * b.opens });
  }
  if (state.capacity < MAX_CAPACITY) {
    const lvl = (state.capacity - BASE_CAPACITY) / 4;
    items.push({ id: 'tank', kind: 'upgrade', name: 'Tank extension', note: `+4 berths (now ${state.capacity}).`, cost: 120 + 90 * lvl });
  }
  return items;
}

// --- the exchange ---------------------------------------------------------------------------------

const DIETS = ['herbivore', 'detritivore', 'planktivore', 'omnivore', 'carnivore', 'piscivore', 'durophage'];
const TEMPS = ['cold', 'temperate', 'tropical'];
const SALTS = ['fresh', 'brackish', 'marine'];
export const MARKET_TAGS = [...DIETS, ...TEMPS, ...SALTS];
const WHY = {
  herbivore: 'Algae blooms are clogging colony reservoirs',
  detritivore: 'Settler fish farms need tank cleaners',
  planktivore: 'Hydroponic plankton is overgrowing the vats',
  omnivore: 'Colony aquaponics want hardy all-rounders',
  carnivore: 'Larval pests in the irrigation canals',
  piscivore: 'Feeder-fish booms in the colony ponds',
  durophage: 'Snail plagues in the terraced paddies',
  cold: 'A cold front over the polar settlements',
  temperate: 'Mild spring in the valley colonies',
  tropical: 'Equatorial domes are heating up',
  fresh: 'New freshwater reservoirs opened',
  brackish: 'Estuary farms are expanding',
  marine: 'Sea-farms launched on the coast',
};
const MARKET_SLOT = 12 * 60_000;
/** How badly the colonies want a trait right now: 0.5 (glut) .. 2.4 (crisis). Same for everyone. */
export function demand(tag, now) {
  const h = hash(tag);
  const period = (8 + (h % 9)) * 60_000;
  let v = 1 + 0.5 * Math.sin((2 * Math.PI * now) / period + (h % 628) / 100);
  const slot = Math.floor(now / MARKET_SLOT);
  if (MARKET_TAGS[hash(`spike:${slot}`) % MARKET_TAGS.length] === tag) v += 0.9;
  return Math.max(0.5, Math.min(2.4, v));
}
export function headlines(now) {
  return MARKET_TAGS.map((tag) => ({ tag, mult: demand(tag, now), why: WHY[tag] }))
    .sort((a, b) => b.mult - a.mult);
}
const RARITY_PRICE = { common: 18, uncommon: 30, rare: 60, myth: 140 };
const SIZE_PRICE = { tiny: 0.8, small: 0.9, medium: 1, large: 1.2, huge: 1.4, giant: 1.6 };
const STAGE_PRICE = { fry: 0.35, juvenile: 0.65, adult: 1, elder: 0.9 };
export function priceOf(code, now) {
  const g = genomeOf(code);
  const e = ecoOf(code);
  let p = (RARITY_PRICE[g.rarity] ?? 18) * (SIZE_PRICE[g.size] ?? 1) * (STAGE_PRICE[g.stage] ?? 1);
  p *= 1 + 0.1 * Math.min(10, generationOf(g));
  if (g.hybrid !== 'none') p *= 1.5;
  p *= 1.1 ** [g.geneA, g.geneB].filter((a) => a !== 'wild').length;
  const tags = [e.diet, e.temp, e.salinity].filter((t) => MARKET_TAGS.includes(t));
  const mult = tags.length ? tags.reduce((s, t) => s + demand(t, now), 0) / tags.length : 1;
  return Math.max(3, Math.round(p * mult));
}

// --- seeding requests -----------------------------------------------------------------------------

const COLONIES = ['Port Halcyon', 'Tessaly Dome', 'Kettle Hollow', 'Vesper Landing', 'Ardent Reach', 'New Wren', 'Lowmarsh', 'Saltmother Camp'];
const ROLE = {
  diet: {
    herbivore: 'Algae mats are smothering the water. Send a grazer.',
    detritivore: 'Dead moss is piling up on the bed. Send a sifter.',
    planktivore: 'A plankton bloom is clouding everything. Send a filter-feeder.',
    piscivore: 'Little fish are booming out of control. The water needs a hunter.',
    carnivore: 'Worm swarms in the silt need eating.',
    omnivore: 'The food web has gaps. Send a generalist.',
    durophage: 'Snails are overrunning the rocks. Send a shell-cracker.',
  },
  level: {
    bottom: 'The bed silt needs stirring.',
    top: 'Surface midges are biting the settlers.',
    mid: 'The open water column is still empty.',
    above: 'Something that can leap the falls is needed.',
  },
  sociality: {
    school: 'Settler kids are asking for a real school of fish.',
    pair: 'The biologists want a nesting pair line.',
    solitary: 'A lone sentinel species is needed for water monitoring.',
    warband: 'Something tough enough to hold territory.',
    retinue: 'A fish that leads others.',
  },
};
const GENE = {
  albino: 'Cave lakes have no light: pigment-free genes wanted.',
  leucistic: 'Pale genes for the bright glacier shallows.',
  melanistic: 'UV is still harsh up top. Dark pigment protects.',
  axanthic: 'Blue-shift genes for the mineral-heavy water.',
  ghost: 'Glass-bodied genes, to hide from the new predators.',
  bubble: 'Bubble-eye genes for the sanctuary ponds.',
  xanthic: 'Golden genes for the Accord’s ornamental pools.',
  longfin: 'Long-fin genes for slow, still water.',
  koi: 'Koi-white genes for the settlement temple ponds.',
};
export const WORD = {
  fresh: 'Fresh', brackish: 'Brackish', marine: 'Marine', cold: 'Cold', temperate: 'Temperate', tropical: 'Tropical',
  twilight: 'Twilight', abyss: 'Abyss', bottom: 'Bottom-dweller', top: 'Surface', mid: 'Midwater', above: 'Leaper',
  school: 'Schooling', pair: 'Pairing', solitary: 'Solitary', warband: 'Warband', retinue: 'Leader',
};
export function reqLabel(q) {
  if (q.kind === 'gene') return `Carries ${q.allele}`;
  if (q.kind === 'bred') return 'Hatchery-bred';
  if (q.kind === 'adult') return 'Adult';
  if (Array.isArray(q.value)) return 'Deep-water';
  return WORD[q.value] ?? q.value.charAt(0).toUpperCase() + q.value.slice(1);
}

export function makeOrder(state, now, seed) {
  const r = rng(seed);
  const biomes = openBiomes(state.phase);
  const newest = biomes.at(-1);
  const biome = r() < 0.45 ? newest : pick(r, biomes);
  const c = condOf(biome, state.phase);
  const reqs = [{ kind: 'eco', key: 'salinity', value: c.salinity }, { kind: 'eco', key: 'temp', value: c.temp }];
  if (c.depth) reqs.push({ kind: 'eco', key: 'depth', value: c.depth });
  const tutorial = state.stats.orders === 0;
  let flavor = `${biome.name} needs its first residents.`;
  if (!tutorial && (state.phase >= 1 || r() < 0.5)) {
    const sample = rollForBiome(biome, state.phase, `${seed}:sample`);
    const key = pick(r, ['diet', 'diet', 'level', 'sociality']);
    const value = ecoOf(sample)[key];
    reqs.push({ kind: 'eco', key, value });
    flavor = ROLE[key]?.[value] ?? flavor;
  }
  if (!tutorial && state.phase >= 1 && r() < 0.35) reqs.push({ kind: 'bred' });
  if (!tutorial && state.phase >= 2 && r() < 0.5) {
    const carried = [...new Set(state.fish.flatMap((f) => allelesOf(f.code)).filter((a) => a !== 'wild'))].sort();
    if (carried.length) {
      const allele = pick(r, carried);
      reqs.push({ kind: 'gene', allele });
      flavor = GENE[allele] ?? flavor;
    }
  }
  const extra = reqs.length - 2;
  return {
    id: `o${state.nextId++}`,
    biome: biome.id,
    colony: pick(r, COLONIES),
    flavor,
    reqs,
    reward: Math.round(45 + 40 * extra + 18 * state.phase + r() * 20),
    bloom: 18 + 14 * extra + 4 * state.phase,
    expires: now + (10 + Math.floor(r() * 10)) * 60_000,
  };
}

// --- state ------------------------------------------------------------------------------------------

function newFish(state, code, now, extra = {}) {
  const stage = stageOf(code);
  const growth = stage === 'fry' ? 0 : stage === 'juvenile' ? GROW.juvenile : GROW.adult;
  return { id: `f${state.nextId++}`, code, growth, hunger: 0.3, spawnReadyAt: now, born: now, ...extra };
}

export function newGame(now, seed = String(now)) {
  const state = {
    v: SAVE_VERSION, seed, nextId: 1, credits: START_CREDITS, phase: 0, bloom: 0, biomeBloom: {},
    capacity: BASE_CAPACITY, fish: [], eggs: [], orders: [], nextOrderAt: now + 4_000, log: [],
    stats: { orders: 0, bred: 0, sold: 0, seeded: 0, hatched: 0 }, lastTick: now, intro: false,
  };
  const melt = BIOMES[0];
  // Two lake fish of each sex so the first pairing is possible, plus one wildcard.
  ['m', 'f', 'm', 'f'].forEach((sex, i) => {
    const code = rollForBiome(melt, 0, `${seed}:start${i}`, 'adult');
    state.fish.push(newFish(state, codeOf({ ...genomeOf(code), sex }), now));
  });
  state.fish.push(newFish(state, rollWild(`${seed}:start-wild`, 'adult'), now));
  addLog(state, now, '✦', PHASES[0].story);
  return state;
}

export function addLog(state, now, icon, text) {
  state.log.unshift({ t: now, icon, text });
  if (state.log.length > 50) state.log.length = 50;
}

const occupied = (state) => state.fish.length + state.eggs.length;
export const hasRoom = (state) => occupied(state) < state.capacity;
export const isAdult = (f) => ['adult', 'elder'].includes(stageOf(f.code));

/** Advance time. Returns what happened, for toasts and effects. */
export function tick(state, now) {
  const events = [];
  const dt = Math.max(0, Math.min(OFFLINE_CAP, now - state.lastTick)) / 1000;
  state.lastTick = now;

  for (const f of state.fish) {
    const fed = f.hunger < 0.6;
    f.growth += dt * (fed ? 2 : 1);
    f.hunger = Math.min(1, f.hunger + dt * HUNGER_PER_S);
    const stage = stageOf(f.code);
    const want = f.growth >= GROW.adult ? 'adult' : f.growth >= GROW.juvenile ? 'juvenile' : 'fry';
    const order = ['fry', 'juvenile', 'adult', 'elder'];
    if (order.indexOf(want) > order.indexOf(stage)) {
      f.code = withStage(f.code, want);
      events.push({ kind: 'grew', fish: f, stage: want });
    }
  }

  for (const egg of [...state.eggs]) {
    if (egg.hatchAt > now) continue;
    state.eggs.splice(state.eggs.indexOf(egg), 1);
    const f = newFish(state, egg.code, now, { x: egg.x });
    state.fish.push(f);
    state.stats.hatched++;
    events.push({ kind: 'hatched', fish: f, roe: egg.roe });
  }

  for (const o of [...state.orders]) {
    if (o.expires > now) continue;
    state.orders.splice(state.orders.indexOf(o), 1);
    events.push({ kind: 'expired', order: o });
  }
  if (state.orders.length < MAX_ORDERS && now >= state.nextOrderAt) {
    const o = makeOrder(state, now, `${state.seed}:order${state.nextId}`);
    state.orders.push(o);
    state.nextOrderAt = now + ORDER_EVERY;
    events.push({ kind: 'order', order: o });
  }
  return events;
}

export function feed(state, fishId, amount = 0.25) {
  const f = state.fish.find((x) => x.id === fishId);
  if (f) f.hunger = Math.max(0, f.hunger - amount);
}

/** Why these two can't breed, or null if they can. */
export function breedProblem(state, a, b, now) {
  if (!a || !b || a === b) return 'Pick two different fish.';
  if (!isAdult(a) || !isAdult(b)) return 'Both fish need to be adults.';
  if (genomeOf(a.code).sex === genomeOf(b.code).sex) return 'They need to be a male and a female.';
  if (a.spawnReadyAt > now || b.spawnReadyAt > now) return 'One of them is still resting from the last spawn.';
  if (!hasRoom(state)) return 'The tank is full. Sell, seed, or extend the tank.';
  return null;
}

export function breed(state, aId, bId, now) {
  const a = state.fish.find((f) => f.id === aId);
  const b = state.fish.find((f) => f.id === bId);
  const problem = breedProblem(state, a, b, now);
  if (problem) return { error: problem };
  const { child, events } = fish.breedDetailed(genomeOf(a.code), genomeOf(b.code), `${state.seed}:brood${state.nextId}`);
  const code = codeOf({ ...child, stage: 'fry' });
  const r = rng(`${state.seed}:egg${state.nextId}`);
  const egg = { id: `e${state.nextId++}`, code, hatchAt: now + EGG_HATCH, x: 0.15 + r() * 0.7, laid: now };
  state.eggs.push(egg);
  a.spawnReadyAt = b.spawnReadyAt = now + SPAWN_COOLDOWN;
  state.stats.bred++;
  addLog(state, now, '♡', `${nameOf(a.code)} × ${nameOf(b.code)} spawned.${events.length ? ` ${events.map((e) => e.text).join('; ')}.` : ''}`);
  return { egg, events };
}

function bloomUp(state, now, biomeId, amount) {
  state.bloom += amount;
  state.biomeBloom[biomeId] = (state.biomeBloom[biomeId] ?? 0) + amount;
  const out = [];
  while (PHASES[state.phase + 1] && state.bloom >= PHASES[state.phase + 1].bloom) {
    state.phase++;
    addLog(state, now, '✷', `Phase ${state.phase}: ${PHASES[state.phase].name}. ${PHASES[state.phase].story}`);
    out.push({ kind: 'phase', phase: state.phase });
    state.nextOrderAt = Math.min(state.nextOrderAt, now);
  }
  return out;
}

export function fulfil(state, orderId, fishId, now) {
  const o = state.orders.find((x) => x.id === orderId);
  const f = state.fish.find((x) => x.id === fishId);
  if (!o || !f) return { error: 'That request or fish is gone.' };
  if (!meetsAll(f.code, o.reqs)) return { error: 'This fish doesn’t meet every requirement.' };
  state.orders.splice(state.orders.indexOf(o), 1);
  state.fish.splice(state.fish.indexOf(f), 1);
  state.credits += o.reward;
  state.stats.orders++;
  state.stats.seeded++;
  addLog(state, now, '☄', `${nameOf(f.code)} dropped into ${biomeById(o.biome).name} for ${o.colony}. +${o.reward} ◎, +${o.bloom} bloom.`);
  return { order: o, fish: f, events: bloomUp(state, now, o.biome, o.bloom) };
}

export function seedFree(state, fishId, biomeId, now) {
  const f = state.fish.find((x) => x.id === fishId);
  const b = biomeById(biomeId);
  if (!f || !b || b.opens > state.phase) return { error: 'Nowhere to send it.' };
  if (!fitsBiome(f.code, b, state.phase)) return { error: `It wouldn’t survive in ${b.name}.` };
  state.fish.splice(state.fish.indexOf(f), 1);
  const bloom = isAdult(f) ? 8 : 4;
  state.credits += 6;
  state.stats.seeded++;
  addLog(state, now, '☄', `${nameOf(f.code)} seeded into ${b.name}. +${bloom} bloom.`);
  return { fish: f, bloom, events: bloomUp(state, now, b.id, bloom) };
}

export function sell(state, fishId, now) {
  const f = state.fish.find((x) => x.id === fishId);
  if (!f) return { error: 'That fish is gone.' };
  const price = priceOf(f.code, now);
  state.fish.splice(state.fish.indexOf(f), 1);
  state.credits += price;
  state.stats.sold++;
  addLog(state, now, '◎', `Sold ${nameOf(f.code)} on the Exchange for ${price} ◎.`);
  return { fish: f, price };
}

export function buy(state, itemId, now) {
  const item = vaultItems(state).find((i) => i.id === itemId);
  if (!item) return { error: 'Not available.' };
  if (state.credits < item.cost) return { error: 'Not enough credits.' };
  if (item.kind === 'upgrade') {
    state.credits -= item.cost;
    state.capacity = Math.min(MAX_CAPACITY, state.capacity + 4);
    addLog(state, now, '⚒', `Tank extended to ${state.capacity} berths.`);
    return { item };
  }
  if (!hasRoom(state)) return { error: 'The tank is full.' };
  state.credits -= item.cost;
  const seed = `${state.seed}:roe${state.nextId}`;
  const code = item.biome ? rollForBiome(biomeById(item.biome), state.phase, seed) : rollWild(seed);
  const r = rng(seed);
  const egg = { id: `e${state.nextId++}`, code, hatchAt: now + ROE_THAW, x: 0.15 + r() * 0.7, laid: now, roe: true };
  state.eggs.push(egg);
  return { item, egg };
}

// --- save -----------------------------------------------------------------------------------------

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);

/** A saved state if it is sound, else null. Drops fish whose codes no longer decode. */
export function restore(raw) {
  let s;
  try {
    s = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!isObj(s) || s.v !== SAVE_VERSION || !num(s.credits) || !num(s.phase) || !Array.isArray(s.fish)) return null;
  if (!Array.isArray(s.eggs) || !Array.isArray(s.orders) || !isObj(s.stats) || !num(s.lastTick)) return null;
  const decodes = (c) => {
    try {
      return typeof c === 'string' && Boolean(fish.traits.decode(c));
    } catch {
      return false;
    }
  };
  s.fish = s.fish.filter((f) => isObj(f) && decodes(f.code) && num(f.growth));
  s.eggs = s.eggs.filter((e) => isObj(e) && decodes(e.code) && num(e.hatchAt));
  s.orders = s.orders.filter((o) => isObj(o) && Array.isArray(o.reqs) && biomeById(o.biome));
  s.phase = Math.max(0, Math.min(PHASES.length - 1, Math.floor(s.phase)));
  s.log = Array.isArray(s.log) ? s.log.slice(0, 50) : [];
  s.biomeBloom = isObj(s.biomeBloom) ? s.biomeBloom : {};
  s.capacity = num(s.capacity) ? s.capacity : BASE_CAPACITY;
  return s;
}

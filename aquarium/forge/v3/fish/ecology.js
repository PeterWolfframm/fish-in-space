// Fish ecology, read off the body: diet from the jaw, tank level from the mouth, temperament from
// weapons and size, current from the tail, depth from eyes and light. No randomness at all --
// the same traits always give the same ecology, so a player can learn to read a fish.
//
// Every fact comes with `because`: the traits that decided it, for tooltips and for lore lines
// that must stay true to the fish. The tables are in ecology-data.js.

import { fish3Traits } from './genome.js';
import { phenotype } from './phenotype.js';
import { HYBRIDS } from './bodies.js';
import {
  SCALES, HABITAT, DIET_BY_JAW, ARMED_JAWS, ARMED_DORSALS, ARMED_EXTRAS, CURRENT_BY_TAIL, CURRENT_BY_GAIT,
  SIZE_CARE, TEMP_C, PH, MARINE_PH, SIGNATURE_ECOLOGY, WORDS,
} from './ecology-data.js';

const T = fish3Traits;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MEAT = ['piscivore', 'carnivore'];

/** One piece of evidence: a trait and what it is set to, in words. */
function why(field, value) {
  const f = T.fieldById(field);
  const label = f?.choices.find((c) => c.id === value)?.label ?? value;
  return { field, value, label: `${(f?.label ?? field).toLowerCase()}: ${String(label).toLowerCase()}` };
}

/** The body's baseline: its own entry, else a hybrid's first parent's, else torpedo's. */
export function habitatOf(ph) {
  return HABITAT[ph.body] ?? HABITAT[HYBRIDS[ph.body]?.a] ?? HABITAT[ph.set.body] ?? HABITAT.torpedo;
}

/** Everything a keeper would want to know, each fact with the traits behind it. */
export function ecologyOf(genome) {
  const ph = phenotype(genome);
  const set = ph.set;
  const base = habitatOf(ph);
  const bodyWhy = why('body', set.body);
  if (ph.body !== set.body) Object.assign(bodyWhy, { value: ph.body, label: `hybrid: ${ph.body}` });
  const fact = (value, because) => ({ value, because: because.length ? because : [bodyWhy] });

  // --- diet: the jaw decides, then a lure or barbels, then the body ---------------------------
  let diet;
  if (DIET_BY_JAW[ph.jaw]) diet = fact(DIET_BY_JAW[ph.jaw], [why('jaw', ph.jaw)]);
  else if (ph.extras === 'lure') diet = fact('piscivore', [why('extras', 'lure')]);
  else if (ph.extras === 'barbels' || (ph.jaw === 'underbite' && base.level === 'bottom')) diet = fact('detritivore', [why(ph.extras === 'barbels' ? 'extras' : 'jaw', ph.extras === 'barbels' ? 'barbels' : 'underbite')]);
  else diet = fact(base.diet, [bodyWhy]);

  // --- how it feeds ----------------------------------------------------------------------------
  const fastTail = (CURRENT_BY_TAIL[ph.tail] ?? 0) > 0;
  const fastGait = (CURRENT_BY_GAIT[ph.gait] ?? 0) > 0;
  let feeding;
  if (ph.extras === 'lure') feeding = fact('lure', [why('extras', 'lure')]);
  else if (MEAT.includes(diet.value)) feeding = fastTail || fastGait ? fact('pursuit', [why(fastTail ? 'tail' : 'gait', fastTail ? ph.tail : ph.gait)]) : fact('ambush', [...diet.because, why('tail', ph.tail)]);
  else if (diet.value === 'herbivore' || diet.value === 'durophage') feeding = fact('grazing', diet.because);
  else if (diet.value === 'detritivore') feeding = fact('sifting', diet.because);
  else feeding = fact('picking', diet.because);

  // --- where in the tank: the mouth points the way ---------------------------------------------
  let level;
  if (set.snout === 'under') level = fact('bottom', [why('snout', 'under')]);
  else if (ph.extras === 'barbels') level = fact('bottom', [why('extras', 'barbels')]);
  else if (ph.pelvic === 'sucker') level = fact('bottom', [why('pelvic', 'sucker')]);
  else if (ph.pectoral === 'glider') level = fact('top', [why('pectoral', 'glider')]);
  else level = fact(base.level, [bodyWhy]);

  // --- temperament: weapons and size push it up, mood nudges it one step ----------------------
  let temper = base.temper;
  const tBecause = [bodyWhy];
  if (ARMED_JAWS.includes(ph.jaw)) (temper += 1), tBecause.push(why('jaw', ph.jaw));
  if (ARMED_DORSALS.includes(ph.dorsal)) (temper += 1), tBecause.push(why('dorsal', ph.dorsal));
  else if (ARMED_EXTRAS.includes(ph.extras)) (temper += 1), tBecause.push(why('extras', ph.extras));
  if (['huge', 'giant'].includes(set.size)) (temper += 1), tBecause.push(why('size', set.size));
  if (set.size === 'tiny') (temper -= 1), tBecause.push(why('size', 'tiny'));
  if (set.mood === 'grumpy') (temper += 1), tBecause.push(why('mood', 'grumpy'));
  if (set.mood === 'sleepy' || set.mood === 'happy') (temper -= 1), tBecause.push(why('mood', set.mood));
  const temperament = { value: SCALES.temperament[clamp(temper, 0, 4)], because: tBecause };

  // --- company --------------------------------------------------------------------------------
  let sociality;
  if (temperament.value === 'apex') sociality = fact('solitary', temperament.because.slice(1));
  else if (['huge', 'giant'].includes(set.size)) sociality = fact('solitary', [why('size', set.size)]);
  else if (['tiny', 'small'].includes(set.size) && ['stripe', 'bars'].includes(set.pattern)) sociality = fact('school', [why('size', set.size), why('pattern', set.pattern)]);
  else if (temperament.value === 'territorial' && ph.dimorphic) sociality = fact('pair', [bodyWhy]);
  else sociality = fact(base.social, [bodyWhy]);

  // --- when it is awake: eyes and light ------------------------------------------------------
  let activity;
  if (['telescope', 'tubular'].includes(set.eyeMount)) activity = fact('nocturnal', [why('eyeMount', set.eyeMount)]);
  else if (set.markings === 'photophores') activity = fact('nocturnal', [why('markings', 'photophores')]);
  else if (set.glow !== 'none') activity = fact('nocturnal', [why('glow', set.glow)]);
  else if (set.eye === 'big') activity = fact(base.activity === 'diurnal' ? 'crepuscular' : 'nocturnal', [why('eye', 'big')]);
  else if (set.eye === 'small') activity = fact('diurnal', [why('eye', 'small')]);
  else activity = fact(base.activity, [bodyWhy]);

  // --- depth: lights and eyes for the dark ----------------------------------------------------
  let depth;
  if (ph.extras === 'lure') depth = fact('abyss', [why('extras', 'lure')]);
  else if (set.eyeMount === 'tubular') depth = fact('abyss', [why('eyeMount', 'tubular')]);
  else if (set.markings === 'photophores') depth = fact('twilight', [why('markings', 'photophores')]);
  else if (set.glow !== 'none' || set.eyeMount === 'telescope') depth = fact('twilight', [why(set.glow !== 'none' ? 'glow' : 'eyeMount', set.glow !== 'none' ? set.glow : 'telescope')]);
  else if (['ghost', 'albino', 'leucistic'].includes(ph.morph)) depth = fact('twilight', [{ field: 'genes', value: ph.morph, label: `genes: ${ph.morph}` }]);
  else depth = fact(base.depth, [bodyWhy]);

  // --- water ----------------------------------------------------------------------------------
  const salinity = fact(base.salinity, [bodyWhy]);
  const deep = ['twilight', 'abyss'].includes(depth.value) && !['twilight', 'abyss'].includes(base.depth);
  const temp = deep ? fact('cold', depth.because) : fact(base.temp, [bodyWhy]);
  let cur = SCALES.current.indexOf(base.current);
  const cBecause = [bodyWhy];
  if (CURRENT_BY_TAIL[ph.tail]) (cur += CURRENT_BY_TAIL[ph.tail]), cBecause.push(why('tail', ph.tail));
  if (CURRENT_BY_GAIT[ph.gait] && !set.gait.startsWith('auto')) (cur += CURRENT_BY_GAIT[ph.gait]), cBecause.push(why('gait', ph.gait));
  if (ph.longfin) (cur -= 1), cBecause.push({ field: 'genes', value: 'longfin', label: 'genes: long fins' });
  if (set.chonk === 'round') (cur -= 1), cBecause.push(why('chonk', 'round'));
  const current = { value: SCALES.current[clamp(cur, 0, 3)], because: cBecause };
  const hardness = set.scales === 'plates' ? fact('hard', [why('scales', 'plates')]) : fact(base.hardness, [bodyWhy]);

  const eco = { diet, feeding, level, temperament, sociality, activity, depth, salinity, temp, current, hardness };

  // --- signatures and relics overrule the traits ---------------------------------------------
  for (const [kind, id] of [['signature', ph.signature], ['relic', ph.relic]]) {
    for (const [k, v] of Object.entries(SIGNATURE_ECOLOGY[id] ?? {})) {
      eco[k] = { value: v, because: [{ field: kind, value: id, label: `${kind}: ${T.fieldById(kind).choices.find((c) => c.id === id)?.label.toLowerCase() ?? id}` }] };
    }
  }

  // --- care numbers ---------------------------------------------------------------------------
  const care = SIZE_CARE[set.size] ?? SIZE_CARE.medium;
  const group = { school: 6, pair: 2, warband: 5, retinue: 3 }[eco.sociality.value] ?? 1;
  const litres = Math.round(care.litres * (group > 1 ? 1 + group * 0.25 : 1) * (eco.temperament.value === 'apex' ? 1.5 : 1));
  const tempC = TEMP_C[eco.temp.value] ?? TEMP_C.temperate;
  const pH = eco.salinity.value === 'marine' ? MARINE_PH : PH[eco.hardness.value] ?? PH.medium;

  return { ...eco, care: { cm: care.cm, group, litres, tempC, pH }, signature: ph.signature, relic: ph.relic, rarity: set.rarity };
}

/** The ecology as a few plain lines, for a tooltip or a fallback dossier. */
export function describeEcology(genome) {
  const e = ecologyOf(genome);
  const w = (k) => WORDS[k][e[k].value] ?? e[k].value;
  const { care } = e;
  return [
    `${cap(w('diet'))}; ${w('feeding')}. ${cap(w('level'))}.`,
    `${cap(w('temperament'))}, ${w('activity')}; ${w('sociality')}.`,
    `${cap(w('salinity'))}, ${w('temp')} (${care.tempC[0]}–${care.tempC[1]} °C), ${w('hardness')} water, pH ${care.pH[0]}–${care.pH[1]}, ${w('current')}.`,
    `Home: ${w('depth')}. Grows to ${care.cm} cm; ${care.litres} L for ${care.group > 1 ? `${care.group}` : 'one'}.`,
  ];
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Fish names, built from the fish: the body always gives the last word ("… Piranha") and the
// genus, and the fish's most striking traits, in a fixed order of salience, give the rest
// ("Fanged Ember-tailed Piranha", Serrasalmus odontourus). Rare and myth fish add a title from
// their signature ("…, the Crowned").
//
// The fish's looks seed the hash (ph.seed, the jitter key), and the hash only ever picks a word
// *within* the pool a trait points to, so two fish with the same standout traits get related
// names, and the camera, growth or breeding bookkeeping never rename a fish.

import { roller } from '../../pixel/rng.js';
import { rgbOf } from '../../pixel/color.js';
import { BODY_COLORS } from '../../gen/fish/palettes.js';
import { HYBRIDS } from './bodies.js';
import { fish3Traits } from './genome.js';
import { phenotype } from './phenotype.js';
import { TAXA, MODIFIERS, PARTS, PATTERN_PARTS, LATIN, LATIN_ENDS, TITLES } from './names-data.js';

const T = fish3Traits;
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/**
 * The fish's standout traits as salience keys (`field.value`), most striking first. Rarer and
 * louder things lead: relic, signature, colour morph, light, jaw, head gear, fins, eyes, pattern,
 * size, mood. Skin colour always comes last, so every fish has at least one key.
 */
export function salienceOf(ph) {
  const set = ph.set;
  const keys = [];
  const add = (k, ok = true) => ok && keys.push(k);
  add(`relic.${ph.relic}`, ph.relic !== 'none');
  add(`signature.${ph.signature}`, ph.signature !== 'none');
  add(`morph.${ph.morph}`, ph.morph !== 'wild');
  add('lure.on', ph.extras === 'lure');
  add('glow.on', set.glow !== 'none');
  add('photophores.on', set.markings === 'photophores');
  add(`jaw.${ph.jaw}`, Boolean(MODIFIERS[`jaw.${ph.jaw}`]));
  add(`extras.${ph.extras}`, Boolean(MODIFIERS[`extras.${ph.extras}`]));
  add(`dorsal.${ph.dorsal}`, Boolean(MODIFIERS[`dorsal.${ph.dorsal}`]));
  add(`tail.${ph.tail}`, Boolean(MODIFIERS[`tail.${ph.tail}`]));
  add(`eyes.${set.eyeMount}`, set.eyeMount !== 'normal');
  add('eyes.bubble', ph.bubble);
  add(`pattern.${set.pattern}`, Boolean(PATTERN_PARTS[set.pattern]));
  add(`size.${set.size}`, ['tiny', 'huge', 'giant'].includes(set.size));
  add(`mood.${set.mood}`, Boolean(MODIFIERS[`mood.${set.mood}`]));
  add(`skin.${shownColour(ph).id}`);
  return keys;
}

const family = (key) => key.split('.')[0];
const taxonOf = (body) => TAXA[body] ?? TAXA[HYBRIDS[body]?.a] ?? TAXA.torpedo;
/** The colour the fish shows (after its morph), as the nearest body swatch. */
export function shownColour(ph) {
  const [r, g, b] = rgbOf(ph.colors?.skin ?? T.choiceOf(ph.set, 'skin')?.hex ?? '#888888');
  let best = null;
  let bestD = Infinity;
  for (const c of BODY_COLORS) {
    const [R, G, B] = rgbOf(c.hex);
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
    if (d < bestD) (bestD = d), (best = c);
  }
  return best ?? BODY_COLORS[0];
}

/** Every name the fish goes by. */
export function namesOf(genome) {
  const ph = phenotype(genome);
  const set = ph.set;
  const { pick } = roller(ph.seed, 8800);
  const keys = salienceOf(ph);
  const taxon = taxonOf(ph.body);
  const noun = pick(taxon.nouns, 1);

  // Lead word: the most striking trait that has a modifier.
  const lead = keys.find((k) => MODIFIERS[k]);
  const modifier = lead ? pick(MODIFIERS[lead], 2) : null;

  // Compound: the skin colour joined to a body part. A pattern names its own part
  // ("Ember-spotted"); otherwise the next striking trait that is a body part does.
  const partKey = keys.find((k) => k !== lead && PARTS[family(k)]);
  let part;
  if (partKey && family(partKey) === 'pattern') part = PATTERN_PARTS[partKey.split('.')[1]];
  else part = pick(PARTS[partKey ? family(partKey) : 'default'], 3);
  const compound = `${shownColour(ph).label}-${part}`;

  const common = [modifier, compound, noun].filter(Boolean).join(' ');

  // Binomial: genus from the body, epithet from the most striking trait's root.
  const root = pick(LATIN[keys[0]] ?? LATIN[family(keys[0])] ?? LATIN.skin, 10);
  const end = pick(LATIN_ENDS, 12);
  const epithet = /[aeiou]$/.test(root) && /^[aeiou]/.test(end) ? `${root.slice(0, -1)}${end}` : `${root}${end}`;
  const binomial = `${taxon.genus} ${epithet.toLowerCase()}`;

  // Title: the relic outranks the signature.
  const titled = ph.relic !== 'none' ? ph.relic : ph.signature !== 'none' ? ph.signature : null;
  const title = titled ? `the ${pick(TITLES[titled], 20)}` : null;

  const slug = [modifier, compound, noun].filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { common, binomial, title, slug, full: title ? `${common}, ${title}` : common, keys };
}

/** The fish's name: its common name, with a title if it has earned one. */
export function nameOf(genome) {
  return namesOf(genome).full;
}

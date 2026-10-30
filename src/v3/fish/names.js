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

/** The words in a name worth noticing twice. Short ones ("ink", "the") are not worth the trouble. */
const nameWords = (s) => String(s).toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4);
/** A word's stem: the inflections fish names put on it gone. Fanged → fang, spined → spin. */
const stem = (w) => w.replace(/(ed|ing|s)$/, '').replace(/e$/, '');

/**
 * Does a name say the same thing twice? "Dune-tailed Dune-hopper", "Spine-crowned Butter-spined
 * Turkeyfish" and "Glass-saddled Glassback" all do. Two rules, each deliberately narrow:
 *
 * - the two words have the same stem — "Fanged … Fang", "Spine-… …-spined";
 * - one *whole* word opens or closes the other — "Glass-" inside "Glassback". Whole, because
 *   comparing stems here would make "Ink-barred Barracuda" (barr…, barracuda) a repeat.
 *
 * Only words from different parts of the name are compared, so a compound noun may repeat itself.
 * Between them these miss about one name in 5,000 ("Wide-mouthed … Pitmouth": mouthed is not the
 * whole word and its stem is not pitmouth's). A missed repeat is a far smaller fault than a fish
 * renamed for a resemblance it does not have.
 */
export function saysTwice(pieces) {
  const words = pieces.filter(Boolean).map(nameWords);
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      for (const a of words[i]) {
        for (const b of words[j]) {
          if (stem(a) === stem(b)) return true;
          const [short, long] = a.length < b.length ? [a, b] : [b, a];
          if (long.length - short.length >= 3 && (long.startsWith(short) || long.endsWith(short))) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Every name the fish goes by. `ext`: a body from a later generator, with its own `taxon`.
 * `dedupe` re-picks a word when the name would say the same thing twice; it is off by default,
 * because fish3's names are the names its fish have always had (fish4 asks for it, see
 * v4/fish/names.js).
 */
export function namesOf(genome, ext, { dedupe = false } = {}) {
  const ph = phenotype(genome, -1, ext);
  const set = ph.set;
  const { pick } = roller(ph.seed, 8800);
  const keys = salienceOf(ph);
  const taxon = ph.ext?.taxon ?? taxonOf(ph.body);
  let noun = pick(taxon.nouns, 1);

  // Lead word: the most striking trait that has a modifier.
  const lead = keys.find((k) => MODIFIERS[k]);
  let modifier = lead ? pick(MODIFIERS[lead], 2) : null;

  // Compound: the skin colour joined to a body part. A pattern names its own part
  // ("Ember-spotted"); otherwise the next striking trait that is a body part does.
  const partKey = keys.find((k) => k !== lead && PARTS[family(k)]);
  let part;
  if (partKey && family(partKey) === 'pattern') part = PATTERN_PARTS[partKey.split('.')[1]];
  else part = pick(PARTS[partKey ? family(partKey) : 'default'], 3);
  const colour = ph.ext?.skinLabel && ph.morph === 'wild' ? ph.ext.skinLabel : shownColour(ph).label;
  let shown = colour; // the colour as the name wears it; dropped only if nothing else clears a repeat

  // A name that says the same thing twice reads like a mistake. Try the other words this fish
  // could have had — another noun for its taxon, another body part, another lead word — and keep
  // the first set that says each thing once. The colour stays: it is what the fish looks like.
  // Each candidate has its own salt, so a fish keeps one name for good. A shorter name beats a
  // silly one, so dropping the lead word is the last thing tried; if even that repeats, the name
  // stands as it was, because a wrong word would be worse.
  if (dedupe && saysTwice([modifier, colour, part, noun])) {
    const partPool = partKey && family(partKey) === 'pattern' ? null : PARTS[partKey ? family(partKey) : 'default'];
    const tries = [];
    for (let k = 1; k <= 4; k++) tries.push([pick(taxon.nouns, 30 + k), modifier, part, colour]);
    if (partPool) for (let k = 1; k <= 4; k++) tries.push([noun, modifier, pick(partPool, 36 + k), colour]);
    if (lead) for (let k = 1; k <= 4; k++) tries.push([noun, pick(MODIFIERS[lead], 42 + k), part, colour]);
    tries.push([noun, null, part, colour], [noun, modifier, part, null], [noun, null, part, null]);
    const fix = tries.find(([n, m, pt, c]) => !saysTwice([m, c, pt, n]));
    if (fix) [noun, modifier, part, shown] = fix;
  }
  const compound = shown ? `${shown}-${part}` : cap(part);

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

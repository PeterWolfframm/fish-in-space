// Fish names, deterministic from the fish's looks: GitHub-repo style ("crispy-turbo-guppy"),
// field-guide style ("Lesser Ember-finned Piranha") or a full name ("Captain Soggybottom").
// Traits steer the word pools: a piranha jaw reaches for "chompy", a ghost morph for "spectral".

import { roller } from '../../pixel/rng.js';
import { ADJECTIVES, NOUNS, QUALIFIERS, STEMS, SUFFIXES, FULL, TAGGED } from './names-data.js';
import { phenotype } from './phenotype.js';

/** Tags a fish earns from its traits, each a pool in TAGGED. */
export function tagsOf(ph) {
  const set = ph.set;
  const tags = [];
  if (['piranha', 'fangs', 'gape'].includes(ph.jaw) || ph.body === 'piranha' || ph.body === 'barracuda') tags.push('toothy');
  if (['eel', 'needle', 'oarfish', 'knifefish', 'noodleshark'].includes(ph.body) || ph.gait === 'anguilliform') tags.push('noodle');
  if (set.chonk === 'round' || set.chonk === 'plump' || ['puffer', 'blobfish', 'mola', 'moonblob', 'chompball'].includes(ph.body)) tags.push('chonk');
  if (['spiny', 'venom'].includes(ph.dorsal) || ['cheekspines', 'horns', 'nosehorn', 'scutes'].includes(ph.extras)) tags.push('spiky');
  if (set.glow !== 'none' || set.markings === 'photophores' || ph.extras === 'lure' || ph.morph === 'neon') tags.push('glowy');
  if (['veil', 'lyre', 'streamer'].includes(ph.tail) || ph.longfin || ['crest', 'sail'].includes(ph.dorsal)) tags.push('fancy');
  if (set.mood === 'grumpy') tags.push('grumpy');
  if (ph.classLen <= 14) tags.push('tiny');
  if (ph.classLen >= 52) tags.push('giant');
  if (ph.morph === 'ghost' || ph.morph === 'leucistic' || ph.morph === 'albino') tags.push('ghost');
  if (ph.morph === 'chrome' || set.sheen !== 'none' || set.iridescence === 'rainbow' || ph.morph === 'galaxy') tags.push('shiny');
  if (ph.morph === 'melanistic') tags.push('dark');
  if (set.hybrid && set.hybrid !== 'none') tags.push('hybrid');
  return tags;
}

const STYLES = ['repo', 'repo', 'repo', 'guide', 'guide', 'full'];
const DOUBLE = new Set(['fin', 'gut', 'lip', 'chin', 'skin']);
/** fin → finned, belly → bellied, scale → scaled. */
const participle = (w) => (DOUBLE.has(w) ? `${w}${w.at(-1)}ed` : w.endsWith('y') ? `${w.slice(0, -1)}ied` : w.endsWith('e') ? `${w}d` : `${w}ed`);
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/** The fish's name. `style` forces one: 'repo', 'guide' or 'full'. */
export function nameOf(genome, style) {
  const ph = phenotype(genome);
  const { r, pick, chance } = roller(ph.seed, 8800);
  const tags = tagsOf(ph);
  const tagWord = (salt) => (tags.length ? pick(TAGGED[pick(tags, salt)], salt + 1) : null);
  const kind = style ?? pick(STYLES, 1);
  const bodyWord = String(ph.body).replace(/[^a-z]/gi, '').toLowerCase();

  if (kind === 'full') return pick(FULL, 3);

  if (kind === 'guide') {
    const q = chance(0.6, 10) ? `${pick(QUALIFIERS, 11)} ` : '';
    const stem = pick(STEMS, 12);
    const suffix = pick(SUFFIXES, 13);
    const noun = cap(chance(0.5, 14) ? bodyWord : pick(NOUNS, 15));
    // "Lesser Ember-finned Piranha", or a compound: "Royal Mudwhisker".
    if (suffix === 'fish' || chance(0.3, 16)) return `${q}${stem}${suffix}`;
    return `${q}${stem}-${participle(suffix)} ${noun}`;
  }

  // repo: adjective-adjective-noun, with a trait word in front most of the time
  const first = tagWord(20) && r(21) < 0.7 ? tagWord(20) : pick(ADJECTIVES, 22);
  let second = pick(ADJECTIVES, 23);
  if (second === first) second = pick(ADJECTIVES, 24);
  const noun = chance(0.35, 25) ? bodyWord : pick(NOUNS, 26);
  return `${first}-${second}-${noun}`.toLowerCase().replace(/\s+/g, '-');
}

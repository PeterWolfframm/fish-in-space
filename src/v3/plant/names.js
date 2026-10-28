// Names from what the plant shows: species, size, colour, bloom. The look (garden, breeze,
// cartoon) is a camera, so it does not change the name.

import { phenotype } from './phenotype.js';
import { labelOf } from './genome.js';

const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : '');
const SIZE = { herb: 'Dwarf', shrub: 'Garden', tall: 'Tall', tree: 'Great', giant: 'Giant' };

/** The plant's name. Stable for a genome, and the same if only the camera changes. */
export function nameOf(genome) {
  const ph = phenotype(genome);
  const set = ph.set;
  const bits = [SIZE[set.size] ?? 'Garden'];
  if (ph.pigment !== 'green') bits.push(cap(ph.pigment));
  if (set.glow === 'glow') bits.push('Glowing');
  else if (set.glow === 'crystal') bits.push('Crystal');
  else if (set.glow === 'sparkle') bits.push('Starry');
  const leaf = labelOf(set, 'leafColor');
  if (leaf) bits.push(leaf);
  if (set.bloom !== 'none') bits.push(cap(set.bloom));
  else if (set.fruit !== 'none') bits.push(cap(labelOf(set, 'fruit')));
  bits.push(ph.spec.label);
  return bits.join(' ');
}

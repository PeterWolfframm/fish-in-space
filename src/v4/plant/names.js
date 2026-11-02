// Names, the way a seed catalogue writes them: what you can see, the plant, and a cultivar name
// in quotes that belongs to this individual ("Dwarf Striped Lettuce 'Merel'"). The look is a
// camera, so it never changes the name.

import { FORMS } from './forms.js';
import { normalizePlant } from './genome.js';
import { hintsFor } from './ecotype.js';
import { ROLES } from './palettes.js';
import { REGIONS } from './data/places.js';
import { hash01 } from '../../pixel/rng.js';

const SIZE = { herb: 'Dwarf', tall: 'Tall', giant: 'Giant' };
const VARIEGATION = { edge: 'Edged', stripe: 'Striped', spots: 'Speckled', veins: 'Veined', tipTint: 'Painted', blush: 'Blushing' };
const COLOR_WORD = {
  redleaf: 'Red', purple: 'Purple', bluegreen: 'Blue', sage: 'Silver', goldkelp: 'Golden', redalgae: 'Ruby',
  white: 'White', cream: 'Ivory', yellow: 'Yellow', orange: 'Orange', red: 'Red', pink: 'Pink', blush: 'Blush', magenta: 'Magenta', lavender: 'Lilac', blue: 'Blue', cyan: 'Sky',
  plum: 'Plum', berryblue: 'Blue', ink: 'Black', gold: 'Gold', pumpkin: 'Orange', lime_: 'Green', brown: 'Russet',
  carrot: 'Orange', purpleroot: 'Purple', radish: 'Pink', beet: 'Crimson', onion: 'White', redonion: 'Red',
  coral: 'Coral', paper: 'Paper', grey: 'Grey', barkred: 'Red', black: 'Black',
};
const SYL = ['a', 'ri', 'mel', 'so', 'ka', 'lu', 'ven', 'thi', 'or', 'na', 'el', 'ki', 'mar', 'is', 'do', 'ra', 'tes', 'vi', 'an', 'le', 'jo', 'sa', 'wen', 'ty'];

/** The cultivar name: two or three syllables, stable for a form and its sprout. */
export function cultivarOf(set) {
  const key = `${set.form}:${set.sprout}:${set.twist}`;
  const n = 2 + (hash01(key, 1) < 0.35 ? 1 : 0);
  let s = '';
  for (let i = 0; i < n; i++) s += SYL[Math.floor(hash01(key, 10 + i) * SYL.length)];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Which colour roles a form actually shows. */
function shows(form, role) {
  const organs = form.organs ?? [];
  if (role === 'leaf') return true;
  if (role === 'petal') return organs.some((o) => o.type === 'bloom');
  if (role === 'fruit') return organs.some((o) => o.type === 'fruit' || o.type === 'cap');
  if (role === 'root') return organs.some((o) => o.type === 'root');
  return form.axes.some((a) => a.mat === role);
}

/** The colour that most marks this plant out, if any is off its form's usual. */
function colourWord(set) {
  const order = FORMS[set.form].crop || set.realm === 'farm' ? ['fruitColor:fruit', 'rootColor:root', 'petalColor:petal', 'leafColor:leaf'] : ['petalColor:petal', 'coralColor:coral', 'leafColor:leaf', 'barkColor:bark'];
  for (const pair of order) {
    const [fieldId, role] = pair.split(':');
    if (!shows(FORMS[set.form], role)) continue;
    const hints = hintsFor(set.form, set.region, role);
    if (!hints.length) continue;
    if (hints[0][0] !== set[fieldId] && COLOR_WORD[set[fieldId]]) return COLOR_WORD[set[fieldId]];
  }
  return null;
}

export function namesOf(genome) {
  const set = normalizePlant(genome);
  const form = FORMS[set.form];
  const bits = [];
  if (SIZE[set.size]) bits.push(SIZE[set.size]);
  if (set.glow === 'on' && !form.glow) bits.push('Glowing');
  if (VARIEGATION[set.variegation]) bits.push(VARIEGATION[set.variegation]);
  const c = colourWord(set);
  if (c) bits.push(c);
  bits.push(form.label);
  const common = bits.join(' ');
  const cultivar = cultivarOf(set);
  return { common, cultivar, full: `${common} '${cultivar}'`, region: REGIONS[set.region]?.label ?? '' };
}

export const nameOf = (genome) => namesOf(genome).full;

/** One line: what it is and where it grows. */
export function describePlant(genome) {
  const set = normalizePlant(genome);
  const n = namesOf(set);
  const leaf = ROLES.leaf.find((x) => x.id === set.leafColor)?.label ?? set.leafColor;
  return `${n.full}: a ${set.size} ${FORMS[set.form].label.toLowerCase()} from the ${n.region.toLowerCase()}, ${leaf.toLowerCase()} leaves.`;
}

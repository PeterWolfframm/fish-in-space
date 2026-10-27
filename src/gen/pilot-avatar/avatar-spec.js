// A pilot avatar as data. `FIELDS` lists every choice the editor offers; a spec is one choice id per
// field. `avatarFromSeed` rolls a whole pilot from a seed (a callsign or a crew-room seed) and keeps
// the locked groups of a base spec. An avatar travels as a short code: `p1.` and one base-36 digit per
// field in FIELDS order, so the online seat and a pasted code carry the same pilot. Fields are only
// ever appended: an older, shorter code decodes with defaults for the new ones, and a value out of
// range falls back to that field's default, so any string decodes to a valid pilot.
//
// Pure: no DOM. The painter is avatar-svg.js, the nations avatar-nations.js.

import { hash01 } from '../../pixel/rng.js';
import { NATIONS, ERAS, nationById } from './avatar-nations.js';

export const CODE_PREFIX = 'p1.';
/** Longest code the online seat accepts (crates/server `clean_avatar`). */
export const CODE_MAX = 64;
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

// ---------- Palettes ----------

export const SKIN = [
  { id: 's1', label: 'Porcelain', hex: '#f6dccb' },
  { id: 's2', label: 'Fair', hex: '#efc4a4' },
  { id: 's3', label: 'Light', hex: '#e2ad86' },
  { id: 's4', label: 'Warm', hex: '#cf9566' },
  { id: 's5', label: 'Olive', hex: '#b57d4e' },
  { id: 's6', label: 'Tan', hex: '#96603a' },
  { id: 's7', label: 'Brown', hex: '#73462a' },
  { id: 's8', label: 'Deep', hex: '#4e2f1e' },
];

export const HAIR_COLORS = [
  { id: 'black', label: 'Black', hex: '#1d1814' },
  { id: 'darkbrown', label: 'Dark brown', hex: '#3b2618' },
  { id: 'brown', label: 'Brown', hex: '#6b4426' },
  { id: 'auburn', label: 'Auburn', hex: '#7f321b' },
  { id: 'copper', label: 'Copper', hex: '#b5562a' },
  { id: 'blonde', label: 'Blonde', hex: '#d0a457' },
  { id: 'platinum', label: 'Platinum', hex: '#e6d9b8' },
  { id: 'grey', label: 'Grey', hex: '#958f88' },
  { id: 'white', label: 'White', hex: '#e7e5e0' },
];

export const EYE_COLORS = [
  { id: 'brown', label: 'Brown', hex: '#5a3a22' },
  { id: 'dark', label: 'Dark', hex: '#2a1d14' },
  { id: 'hazel', label: 'Hazel', hex: '#7d6a34' },
  { id: 'green', label: 'Green', hex: '#3f7a4f' },
  { id: 'blue', label: 'Blue', hex: '#3d6fa8' },
  { id: 'grey', label: 'Grey', hex: '#6f7c86' },
];

/** Helmet shells, helmet paint and patch colours. */
export const PAINT = [
  { id: 'white', label: 'White', hex: '#e9ebe6' },
  { id: 'lightgrey', label: 'Light grey', hex: '#c3c8c8' },
  { id: 'gunship', label: 'Gunship grey', hex: '#6b727a' },
  { id: 'darkgrey', label: 'Dark grey', hex: '#3d4349' },
  { id: 'black', label: 'Black', hex: '#1c1f23' },
  { id: 'olive', label: 'Olive', hex: '#5e6a46' },
  { id: 'tan', label: 'Tan', hex: '#b39a6e' },
  { id: 'navy', label: 'Navy', hex: '#2a3a63' },
  { id: 'royal', label: 'Royal blue', hex: '#2c5ab6' },
  { id: 'red', label: 'Red', hex: '#b5302a' },
  { id: 'orange', label: 'Orange', hex: '#de7826' },
  { id: 'yellow', label: 'Yellow', hex: '#e6c13a' },
  { id: 'gold', label: 'Gold', hex: '#c69a2f' },
  { id: 'green', label: 'Green', hex: '#3b7c49' },
  { id: 'purple', label: 'Purple', hex: '#6a3f8f' },
  { id: 'leather', label: 'Leather', hex: '#6d4426' },
];

export const SUIT = [
  { id: 'sage', label: 'Sage green', hex: '#7c8667' },
  { id: 'olive', label: 'Olive drab', hex: '#5c6547' },
  { id: 'tan', label: 'Tan', hex: '#b09c76' },
  { id: 'desert', label: 'Desert', hex: '#c8b28b' },
  { id: 'navy', label: 'Navy', hex: '#2f3c58' },
  { id: 'blue', label: 'Air force blue', hex: '#4d6c93' },
  { id: 'grey', label: 'Grey', hex: '#6d737a' },
  { id: 'black', label: 'Black', hex: '#24272b' },
  { id: 'orange', label: 'Survival orange', hex: '#cf6a2b' },
  { id: 'leather', label: 'Leather brown', hex: '#694127' },
  { id: 'green', label: 'Forest green', hex: '#3e5a3c' },
];

// ---------- Fields ----------

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));

export const HEADGEAR = opts(
  ['hgu55', 'HGU-55/P'], ['jhmcs', 'JHMCS'], ['scorpion', 'Scorpion HMD'], ['zsh7', 'ZSh-7'],
  ['typhoon', 'Typhoon HEA'], ['aph5', 'APH-5 (1950s)'], ['leather', 'Leather cap & goggles'],
  ['garrison', 'Garrison cap'], ['beret', 'Beret'], ['ballcap', 'Squadron ball cap'],
  ['headset', 'Headset'], ['none', 'Bare head'],
);

/** Headgear with a hard shell (paint, decals and a visor apply). */
export const SHELLS = new Set(['hgu55', 'jhmcs', 'scorpion', 'zsh7', 'typhoon', 'aph5']);
/** Headgear that covers the top of the head (no hair on top shows). */
export const COVERS_HEAD = new Set([...SHELLS, 'leather']);

/**
 * Every editor choice, in code order. `group` places it in the editor; `colors` marks a swatch
 * row. Append new fields at the end only (old codes must keep decoding).
 */
export const FIELDS = [
  { id: 'gender', group: 'identity', label: 'Gender', choices: opts(['female', 'Female'], ['male', 'Male'], ['other', 'Unspecified']) },
  { id: 'nation', group: 'identity', label: 'Air force', choices: NATIONS.map((n) => ({ id: n.id, label: n.name, short: n.short })) },
  { id: 'era', group: 'identity', label: 'Era', choices: ERAS },
  { id: 'face', group: 'face', label: 'Face shape', choices: opts(['oval', 'Oval'], ['square', 'Square'], ['round', 'Round'], ['long', 'Long'], ['heart', 'Heart'], ['angular', 'Angular']) },
  { id: 'skin', group: 'face', label: 'Skin', colors: true, choices: SKIN },
  { id: 'eyes', group: 'face', label: 'Eyes', choices: opts(['almond', 'Almond'], ['round', 'Round'], ['hooded', 'Hooded'], ['narrow', 'Narrow'], ['wide', 'Wide']) },
  { id: 'eyeColor', group: 'face', label: 'Eye colour', colors: true, choices: EYE_COLORS },
  { id: 'brows', group: 'face', label: 'Brows', choices: opts(['natural', 'Natural'], ['thin', 'Thin'], ['thick', 'Thick'], ['arched', 'Arched'], ['straight', 'Straight'], ['bushy', 'Bushy']) },
  { id: 'nose', group: 'face', label: 'Nose', choices: opts(['straight', 'Straight'], ['button', 'Button'], ['roman', 'Roman'], ['broad', 'Broad'], ['narrow', 'Narrow']) },
  { id: 'mouth', group: 'face', label: 'Expression', choices: opts(['neutral', 'Neutral'], ['determined', 'Determined'], ['smirk', 'Smirk'], ['smile', 'Smile'], ['grin', 'Grin'], ['shout', 'Shout']) },
  { id: 'facialHair', group: 'face', label: 'Facial hair', choices: opts(['none', 'None'], ['moustache', 'Moustache'], ['stubble', 'Stubble'], ['beard', 'Full beard'], ['handlebar', 'Handlebar'], ['goatee', 'Goatee']) },
  { id: 'marks', group: 'face', label: 'Marks', choices: opts(['none', 'None'], ['freckles', 'Freckles'], ['scar', 'Brow scar'], ['cheekscar', 'Cheek scar'], ['lines', 'Age lines'], ['warpaint', 'War paint'], ['mole', 'Beauty mark']) },
  { id: 'eyewear', group: 'face', label: 'Eyewear', choices: opts(['none', 'None'], ['aviators', 'Aviators'], ['specs', 'Round specs']) },
  { id: 'hair', group: 'hair', label: 'Hair', choices: opts(['bald', 'Bald'], ['buzz', 'Buzz cut'], ['crew', 'Crew cut'], ['sidepart', 'Side part'], ['quiff', 'Quiff'], ['curls', 'Curls'], ['mohawk', 'Mohawk'], ['bob', 'Bob'], ['bun', 'Bun'], ['ponytail', 'Ponytail'], ['braid', 'Braid'], ['long', 'Long']) },
  { id: 'hairColor', group: 'hair', label: 'Hair colour', colors: true, choices: HAIR_COLORS },
  { id: 'headgear', group: 'helmet', label: 'Headgear', choices: HEADGEAR },
  { id: 'shell', group: 'helmet', label: 'Shell', colors: true, choices: PAINT },
  { id: 'pattern', group: 'helmet', label: 'Paint scheme', choices: opts(['plain', 'Plain'], ['stripe', 'Stripe'], ['twin', 'Twin stripes'], ['checker', 'Checkers'], ['bolt', 'Lightning bolt'], ['star', 'Star'], ['flames', 'Flames'], ['teeth', 'Shark teeth'], ['chevron', 'Chevrons'], ['national', 'National bands'], ['split', 'Split tone'], ['number', 'Number']) },
  { id: 'paint', group: 'helmet', label: 'Paint colour', colors: true, choices: PAINT },
  { id: 'decal', group: 'helmet', label: 'Decal', choices: opts(['none', 'None'], ['roundel', 'Roundel'], ['squadron', 'Squadron emblem'], ['number', 'Number']) },
  { id: 'number', group: 'helmet', label: 'Number', choices: Array.from({ length: 36 }, (_, i) => ({ id: String(i + 1).padStart(2, '0'), label: String(i + 1).padStart(2, '0') })) },
  { id: 'visorTint', group: 'visor', label: 'Visor / goggles', choices: opts(['clear', 'Clear'], ['smoke', 'Smoke'], ['gold', 'Gold'], ['mirror', 'Mirror blue'], ['iridium', 'Iridium'], ['amber', 'Amber']) },
  { id: 'visorPos', group: 'visor', label: 'Visor', choices: opts(['up', 'Up'], ['down', 'Down']) },
  { id: 'mask', group: 'visor', label: 'Oxygen mask', choices: opts(['off', 'Off'], ['on', 'On'], ['hanging', 'Hanging']) },
  { id: 'suitStyle', group: 'suit', label: 'Kit', choices: opts(['flightsuit', 'Flight suit & harness'], ['vest', 'Survival vest'], ['ma1', 'MA-1 jacket'], ['leather', 'Leather jacket'], ['fur', 'Fur-collar jacket']) },
  { id: 'suitColor', group: 'suit', label: 'Suit colour', colors: true, choices: SUIT },
  { id: 'camo', group: 'suit', label: 'Camouflage', choices: opts(['none', 'None'], ['splinter', 'Splinter'], ['woodland', 'Woodland'], ['digital', 'Digital'], ['tiger', 'Tiger stripe']) },
  { id: 'nametape', group: 'suit', label: 'Name tape', choices: opts(['on', 'Callsign'], ['off', 'None']) },
  { id: 'rankBadge', group: 'suit', label: 'Rank on collar', choices: opts(['on', 'Show'], ['off', 'Hide']) },
  { id: 'shoulder', group: 'patches', label: 'Shoulder patch', choices: opts(['flag', 'Flag'], ['squadron', 'Squadron'], ['roundel', 'Roundel'], ['none', 'None']) },
  { id: 'sqShape', group: 'patches', label: 'Squadron shape', choices: opts(['disc', 'Disc'], ['shield', 'Shield'], ['triangle', 'Triangle'], ['pentagon', 'Pentagon'], ['diamond', 'Diamond']) },
  { id: 'sqGlyph', group: 'patches', label: 'Squadron emblem', choices: opts(['bolt', 'Lightning'], ['star', 'Star'], ['wings', 'Wings'], ['arrow', 'Arrow'], ['spade', 'Ace of spades'], ['skull', 'Skull'], ['crosshair', 'Crosshair'], ['flame', 'Flame'], ['crown', 'Crown'], ['moon', 'Moon'], ['anchor', 'Anchor'], ['jet', 'Jet']) },
  { id: 'sqColor', group: 'patches', label: 'Patch colour', colors: true, choices: PAINT },
  { id: 'sqAccent', group: 'patches', label: 'Emblem colour', colors: true, choices: PAINT },
  { id: 'background', group: 'background', label: 'Backdrop', choices: opts(['nation', 'National colours'], ['sky', 'Open sky'], ['sunset', 'Sunset'], ['night', 'Night'], ['hangar', 'Hangar'], ['carrier', 'Carrier deck'], ['scope', 'Radar scope'], ['plain', 'Plain']) },
];

/** Editor sections, in order. */
export const GROUPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'helmet', label: 'Helmet' },
  { id: 'visor', label: 'Visor & mask' },
  { id: 'suit', label: 'Flight suit' },
  { id: 'patches', label: 'Patches' },
  { id: 'background', label: 'Backdrop' },
];

const FIELD = new Map(FIELDS.map((fl) => [fl.id, fl]));

/** The field definition for `id`. */
export const fieldById = (id) => FIELD.get(id) || null;

/** The choice object a spec holds for `fieldId` (label, hex …). */
export function choiceOf(spec, fieldId) {
  const fl = FIELD.get(fieldId);
  return fl?.choices.find((c) => c.id === spec?.[fieldId]) || fl?.choices[0] || null;
}

/** Hex colour of a colour field's value. */
export const hexOf = (spec, fieldId) => choiceOf(spec, fieldId)?.hex || '#888888';

/** The default pilot (every field at its first choice, a few nicer starting points). */
export function defaultAvatar() {
  const spec = Object.fromEntries(FIELDS.map((fl) => [fl.id, fl.choices[0].id]));
  return { ...spec, gender: 'other', nation: 'blue', skin: 's3', hair: 'crew', hairColor: 'brown', shell: 'white', paint: 'royal', visorTint: 'gold', suitColor: 'sage', sqColor: 'navy', sqAccent: 'yellow' };
}

/** A spec with every field valid: unknown fields dropped, bad values set to the default. */
export function normalizeAvatar(raw) {
  const base = defaultAvatar();
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const fl of FIELDS) out[fl.id] = fl.choices.some((c) => c.id === src[fl.id]) ? src[fl.id] : base[fl.id];
  return out;
}

// ---------- Code ----------

/** The avatar as its short code. */
export function encodeAvatar(spec) {
  const s = normalizeAvatar(spec);
  return CODE_PREFIX + FIELDS.map((fl) => DIGITS[fl.choices.findIndex((c) => c.id === s[fl.id])]).join('');
}

/** Whether `code` looks like an avatar code (prefix and digits; not whether every digit fits). */
export function isAvatarCode(code) {
  return typeof code === 'string' && code.length <= CODE_MAX && code.startsWith(CODE_PREFIX) && /^[0-9a-z]*$/.test(code.slice(CODE_PREFIX.length));
}

/** The spec of a code; null when it is not an avatar code at all. Digits out of range get defaults. */
export function decodeAvatar(code) {
  const text = String(code ?? '').trim().toLowerCase();
  if (!isAvatarCode(text)) return null;
  const digits = text.slice(CODE_PREFIX.length);
  const base = defaultAvatar();
  const out = {};
  FIELDS.forEach((fl, i) => {
    const v = digits[i] == null ? -1 : DIGITS.indexOf(digits[i]);
    out[fl.id] = fl.choices[v]?.id ?? base[fl.id];
  });
  return out;
}

// ---------- Generator ----------

/** Rolls for one seed: `r(salt)` 0..1, `pick(list, salt)`, `weighted([[item, w] …], salt)`. */
function roller(seed) {
  const key = String(seed ?? '');
  const r = (salt) => hash01(key, salt + 701);
  const pick = (list, salt) => list[Math.floor(r(salt) * list.length) % list.length];
  const weighted = (pairs, salt) => {
    const total = pairs.reduce((a, [, w]) => a + w, 0);
    let x = r(salt) * total;
    for (const [item, w] of pairs) {
      if ((x -= w) < 0) return item;
    }
    return pairs[pairs.length - 1][0];
  };
  return { r, pick, weighted };
}

const ids = (list) => list.map((c) => c.id);
const HAIR_BY_GENDER = {
  female: [['bun', 3], ['ponytail', 3], ['braid', 2], ['bob', 2], ['long', 2], ['curls', 2], ['sidepart', 1], ['crew', 1], ['buzz', 0.5]],
  male: [['crew', 3], ['buzz', 3], ['sidepart', 2], ['quiff', 2], ['curls', 1.5], ['bald', 1], ['mohawk', 0.3], ['ponytail', 0.3], ['long', 0.3]],
  other: [['crew', 2], ['buzz', 2], ['bob', 1.5], ['curls', 1.5], ['sidepart', 1.5], ['ponytail', 1], ['bun', 1], ['quiff', 1], ['mohawk', 0.6], ['bald', 0.5], ['long', 0.6], ['braid', 0.6]],
};
const FACIAL_BY_GENDER = {
  female: [['none', 1]],
  male: [['none', 5], ['moustache', 2], ['stubble', 2], ['beard', 1], ['handlebar', 0.6], ['goatee', 0.8]],
  other: [['none', 8], ['stubble', 1], ['moustache', 0.5]],
};
const OFF_DUTY = ['ballcap', 'headset', 'none', 'garrison', 'beret'];
const ERA_WEIGHT = [['modern', 6], ['coldwar', 2], ['ww2', 2]];

/**
 * A whole pilot from `seed`. Options pin `gender`, `nation`, `era` or `headgear` ('any' or empty
 * means roll it). With `base` and `locks` (a set or list of group ids), the locked groups keep the
 * base's values. The same seed and options always give the same pilot.
 */
export function avatarFromSeed(seed, { gender, nation, era, headgear, base = null, locks = null } = {}) {
  const { r, pick, weighted } = roller(seed);
  const set = (v) => (v && v !== 'any' ? v : null);
  const g = set(gender) || weighted([['female', 4], ['male', 5], ['other', 1]], 1);
  let n = set(nation) ? nationById(nation) : null;
  let e = set(era);
  if (n && !e) e = n.eras.includes('modern') && r(2) < 0.7 ? 'modern' : pick(n.eras, 3);
  if (!e) e = weighted(ERA_WEIGHT, 2);
  if (!n) {
    const pool = NATIONS.filter((x) => x.eras.includes(e));
    n = pick(pool, 4);
  }
  if (!n.eras.includes(e)) e = n.eras[0];
  const ww2 = e === 'ww2';
  const helmetPool = n.helmets[e] || n.helmets.modern || ['hgu55'];
  const hg = set(headgear) || (r(5) < 0.16 ? pick(ww2 ? ['garrison', 'beret', 'none'] : OFF_DUTY, 6) : pick(helmetPool, 7));
  const flashy = r(8) < 0.3;
  let shell;
  if (hg === 'leather') shell = weighted([['leather', 5], ['tan', 2], ['black', 1], ['darkgrey', 1]], 9);
  else if (hg === 'beret') shell = pick(['red', 'navy', 'black', 'green', 'royal', 'tan', 'purple'], 9);
  else shell = flashy ? pick(ids(PAINT).filter((c) => c !== 'leather'), 9) : pick(n.shells.filter((c) => c !== 'leather'), 9) || 'white';
  const paint = pick(ids(PAINT).filter((c) => c !== shell), 10);
  const visorDown = SHELLS.has(hg) ? r(11) < 0.3 : hg === 'leather' ? r(11) < 0.35 : false;
  const suitStyle = ww2 ? weighted([['leather', 3], ['fur', 3], ['ma1', 1]], 12) : weighted([['flightsuit', 6], ['vest', 2], ['ma1', 1.5], ['leather', 0.5]], 12);
  const out = {
    gender: g,
    nation: n.id,
    era: e,
    face: pick(ids(fieldById('face').choices), 20),
    skin: pick(ids(SKIN), 21),
    eyes: pick(ids(fieldById('eyes').choices), 22),
    eyeColor: pick(ids(EYE_COLORS), 23),
    brows: g === 'female' ? pick(['natural', 'thin', 'arched', 'straight'], 24) : pick(['natural', 'thick', 'straight', 'bushy', 'arched'], 24),
    nose: pick(ids(fieldById('nose').choices), 25),
    mouth: weighted([['neutral', 3], ['determined', 3], ['smirk', 2], ['smile', 2], ['grin', 1]], 26),
    facialHair: weighted(FACIAL_BY_GENDER[g], 27),
    marks: weighted([['none', 10], ['freckles', 2], ['scar', 1], ['cheekscar', 1], ['lines', 1.2], ['warpaint', 0.5], ['mole', 0.8]], 28),
    eyewear: SHELLS.has(hg) || hg === 'leather' ? 'none' : weighted([['none', 6], ['aviators', 3], ['specs', 1]], 29),
    hair: weighted(HAIR_BY_GENDER[g], 30),
    hairColor: weighted([['black', 3], ['darkbrown', 3], ['brown', 3], ['auburn', 1], ['copper', 1], ['blonde', 2], ['platinum', 0.6], ['grey', 0.8], ['white', 0.3]], 31),
    headgear: hg,
    shell,
    pattern: weighted([['plain', 4], ['stripe', 2], ['twin', 1], ['checker', 1], ['bolt', 1], ['star', 1], ['flames', 0.8], ['teeth', 0.8], ['chevron', 1], ['national', 1], ['split', 0.8], ['number', 0.8]], 32),
    paint,
    decal: weighted([['none', 3], ['roundel', 2], ['squadron', 1.5], ['number', 1]], 33),
    number: pick(ids(fieldById('number').choices), 34),
    visorTint: hg === 'leather' ? pick(['clear', 'amber', 'smoke'], 35) : pick(ids(fieldById('visorTint').choices), 35),
    visorPos: visorDown ? 'down' : 'up',
    mask: SHELLS.has(hg) ? weighted([['on', 3], ['hanging', 3], ['off', 2]], 36) : hg === 'leather' ? weighted([['off', 3], ['hanging', 1]], 36) : 'off',
    suitStyle,
    suitColor: suitStyle === 'leather' || suitStyle === 'fur' ? weighted([['leather', 4], ['black', 1], ['tan', 1]], 37) : pick(n.suits, 37),
    camo: ww2 ? 'none' : weighted([['none', 8], ['splinter', 1], ['woodland', 1], ['digital', 1], ['tiger', 0.6]], 38),
    nametape: r(39) < 0.85 ? 'on' : 'off',
    rankBadge: r(40) < 0.8 ? 'on' : 'off',
    shoulder: weighted([['flag', 3], ['squadron', 3], ['roundel', 1], ['none', 0.5]], 41),
    sqShape: pick(ids(fieldById('sqShape').choices), 42),
    sqGlyph: pick(ids(fieldById('sqGlyph').choices), 43),
    sqColor: pick(['black', 'navy', 'red', 'darkgrey', 'royal', 'green', 'purple', 'gold'], 44),
    sqAccent: pick(['yellow', 'white', 'gold', 'orange', 'red', 'lightgrey'], 45),
    background: weighted([['nation', 3], ['sky', 2], ['sunset', 1], ['night', 1], ['hangar', 1.5], ['carrier', n.id === 'usn' ? 3 : 0.8], ['scope', 1], ['plain', 0.6]], 46),
  };
  if (out.sqAccent === out.sqColor) out.sqAccent = 'white';
  if (base && locks) {
    const locked = locks instanceof Set ? locks : new Set(locks);
    const b = normalizeAvatar(base);
    for (const fl of FIELDS) if (locked.has(fl.group)) out[fl.id] = b[fl.id];
  }
  return normalizeAvatar(out);
}

/** The pilot a callsign gets before anyone customises it. */
export const avatarForCallsign = (callsign) => avatarFromSeed(`pilot:${String(callsign || 'Guest').toUpperCase()}`);

/** One line describing the pilot (alt text, aria-live). */
export function describeAvatar(spec) {
  const s = normalizeAvatar(spec);
  const who = s.gender === 'female' ? 'Female pilot' : s.gender === 'male' ? 'Male pilot' : 'Pilot';
  const parts = [`${who}, ${nationById(s.nation).name}`, choiceOf(s, 'headgear').label];
  if (SHELLS.has(s.headgear)) parts.push(`${choiceOf(s, 'shell').label.toLowerCase()} shell`, `${choiceOf(s, 'visorTint').label.toLowerCase()} visor ${s.visorPos}`);
  if (s.mask !== 'off') parts.push(`mask ${s.mask}`);
  parts.push(choiceOf(s, 'mouth').label.toLowerCase());
  return parts.join(', ');
}

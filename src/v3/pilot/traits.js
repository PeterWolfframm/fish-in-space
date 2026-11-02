// Pilots v3 genome: anyone at all, not just the crew. Pilots v1's flat 32×32 radio portrait, with
// the helmet made one hat among many: age, build, face shape, kin, sixteen hairstyles, headwear,
// eyewear, facial hair, marks, earrings and thirteen outfits, each in its own colours.
//
// `c3.` codes. A v1 `c` code still decodes (`fromV1Code`): the same face, in a flight suit and
// helmet, with each colour moved to the nearest one this palette has.

import { defineTraits } from '../../pixel/traits.js';
import { hash01 } from '../../pixel/rng.js';
import { rgbOf } from '../../pixel/color.js';
import { pilotTraits } from '../../gen/pilot.js';

const opts = (...pairs) => pairs.map(([id, label]) => ({ id, label }));
const swatches = (...pairs) => pairs.map(([hex, label]) => ({ id: hex, hex: `#${hex}`, label }));

export const SKIN = swatches(
  ['f6dccb', 'Porcelain'], ['ffdbac', 'Fair'], ['efc4a4', 'Rose'], ['f1c27d', 'Light'], ['e2ad86', 'Peach'],
  ['e0ac69', 'Honey'], ['cf9566', 'Warm'], ['c68642', 'Golden'], ['b57d4e', 'Olive'], ['96603a', 'Tan'],
  ['8d5524', 'Bronze'], ['73462a', 'Brown'], ['603c1e', 'Umber'], ['4e2f1e', 'Deep'],
  ['9fc3a0', 'Sage'], ['8fb2d8', 'Azure'], ['c3a6d8', 'Lilac'],
);
const SKIN_HUMAN = 14;

export const HAIR = swatches(
  ['1d1814', 'Black'], ['281e14', 'Soft black'], ['3b2618', 'Dark brown'], ['5a3c1e', 'Chestnut'], ['6b4426', 'Brown'],
  ['7f321b', 'Auburn'], ['b4461e', 'Ginger'], ['b5562a', 'Copper'], ['a07838', 'Dark blonde'], ['d0a457', 'Blonde'],
  ['e6d9b8', 'Platinum'], ['958f88', 'Grey'], ['828282', 'Steel'], ['e7e5e0', 'White'],
  ['e05a9a', 'Pink'], ['3f6fd8', 'Blue'], ['2fb5a4', 'Teal'], ['7a4ac0', 'Violet'], ['5aa84a', 'Green'],
);
const HAIR_NATURAL = 14;
const GREYS = ['958f88', '828282', 'e7e5e0', 'e6d9b8'];

export const EYES = swatches(
  ['3c5a8c', 'Blue'], ['46321e', 'Brown'], ['286e46', 'Green'], ['1e1e1e', 'Dark'], ['6e5028', 'Hazel'],
  ['6a8a9a', 'Grey'], ['a07020', 'Amber'],
);

export const CLOTH = swatches(
  ['5e684c', 'Olive drab'], ['4c5646', 'Field green'], ['465060', 'Slate'], ['2c3a5c', 'Navy'], ['3a5aa8', 'Blue'],
  ['6aa0d8', 'Sky'], ['2e8a7a', 'Teal'], ['4a8a3e', 'Green'], ['d8a838', 'Gold'], ['d27a2e', 'Orange'],
  ['c84a3a', 'Red'], ['8a2e2e', 'Maroon'], ['d88aa8', 'Pink'], ['5e3a86', 'Purple'], ['6a4a30', 'Brown'],
  ['7a7e86', 'Grey'], ['2a2a2e', 'Black'], ['e8e6e0', 'White'],
);

export const ACCENT = swatches(
  ['c82828', 'Red'], ['f0be28', 'Yellow'], ['1e1e1e', 'Black'], ['2858c8', 'Blue'], ['f0f0f0', 'White'],
  ['3ca050', 'Green'], ['783ca0', 'Purple'], ['2fb5a4', 'Teal'], ['e07a2e', 'Orange'], ['e05a9a', 'Pink'],
);

export const HAT = swatches(
  ['d6dad6', 'Helmet white'], ['606854', 'Helmet olive'], ['3c4248', 'Gunmetal'], ['28385f', 'Navy'], ['f0c828', 'Safety yellow'],
  ['e07a2e', 'Orange'], ['c84a3a', 'Red'], ['8a2e2e', 'Maroon'], ['2e8a7a', 'Teal'], ['3a5aa8', 'Blue'],
  ['5e3a86', 'Purple'], ['e05a9a', 'Pink'], ['6a4a30', 'Brown'], ['2a2a2e', 'Black'], ['e8e6e0', 'White'],
  ['c8b48a', 'Sand'],
);

const HELMETS = ['d6dad6', '606854', '3c4248', '28385f', 'e8e6e0'];
const HARDHATS = ['f0c828', 'e07a2e', 'e8e6e0', 'c84a3a'];

const NO_HAT = ['none', 'flower', 'headband', 'headset'];

export const pilot3Traits = defineTraits({
  prefix: 'c3.',
  fields: [
    { id: 'age', label: 'Age', group: 'body', choices: opts(['kid', 'Kid'], ['young', 'Young'], ['adult', 'Adult'], ['middle', 'Middle-aged'], ['elder', 'Elder']), weights: [8, 22, 34, 20, 16], default: 'adult' },
    { id: 'build', label: 'Build', group: 'body', choices: opts(['slim', 'Slim'], ['average', 'Average'], ['broad', 'Broad']), weights: [3, 5, 3], default: 'average' },
    { id: 'face', label: 'Face', group: 'body', choices: opts(['oval', 'Oval'], ['round', 'Round'], ['long', 'Long'], ['square', 'Square']) },
    { id: 'kin', label: 'Kin', group: 'body', choices: opts(['human', 'Human'], ['pointed', 'Pointed ears'], ['ridged', 'Ridged'], ['spotted', 'Spotted']), weights: [88, 4, 4, 4] },
    { id: 'skin', label: 'Skin', group: 'face', colors: true, choices: SKIN, weights: SKIN.map((_, i) => (i < SKIN_HUMAN ? 6 : 1)), default: 'e2ad86' },
    { id: 'eyes', label: 'Eyes', group: 'face', colors: true, choices: EYES },
    { id: 'brows', label: 'Brows', group: 'face', choices: opts(['thin', 'Thin'], ['thick', 'Thick'], ['bushy', 'Bushy']), weights: [5, 5, 2] },
    { id: 'hair', label: 'Hair', group: 'hair', choices: opts(
      ['bald', 'Bald'], ['buzz', 'Buzz'], ['short', 'Short'], ['part', 'Side part'], ['spiky', 'Spiky'], ['curly', 'Curly'],
      ['afro', 'Afro'], ['bun', 'Bun'], ['ponytail', 'Ponytail'], ['long', 'Long'], ['bob', 'Bob'], ['braids', 'Braids'],
      ['mohawk', 'Mohawk'], ['receding', 'Receding'], ['puffs', 'Puffs'], ['locs', 'Locs'],
    ), weights: [4, 7, 12, 8, 4, 6, 4, 5, 6, 9, 6, 4, 2, 4, 3, 4], default: 'short' },
    { id: 'hairColor', label: 'Hair colour', group: 'hair', colors: true, choices: HAIR, weights: HAIR.map((_, i) => (i < HAIR_NATURAL ? 5 : 1)) },
    { id: 'facialHair', label: 'Facial hair', group: 'hair', choices: opts(['none', 'None'], ['stubble', 'Stubble'], ['mustache', 'Moustache'], ['goatee', 'Goatee'], ['beard', 'Beard'], ['chops', 'Mutton chops']), weights: [62, 10, 10, 6, 10, 2], when: (s) => s.age !== 'kid' },
    { id: 'headwear', label: 'Headwear', group: 'head', choices: opts(
      ['none', 'None'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['scarf', 'Headscarf'], ['turban', 'Turban'], ['headband', 'Headband'],
      ['bandana', 'Bandana'], ['helmet', 'Flight helmet'], ['headset', 'Headset'], ['hat', 'Wide hat'], ['hardhat', 'Hard hat'],
      ['beret', 'Beret'], ['flower', 'Flower'],
    ), weights: [46, 6, 5, 4, 3, 3, 3, 8, 6, 3, 3, 3, 3] },
    { id: 'hatColor', label: 'Headwear colour', group: 'head', colors: true, choices: HAT, when: (s) => s.headwear !== 'none' },
    { id: 'eyewear', label: 'Eyewear', group: 'head', choices: opts(['none', 'None'], ['round', 'Round glasses'], ['square', 'Square glasses'], ['shades', 'Shades'], ['goggles', 'Goggles'], ['monocle', 'Monocle'], ['patch', 'Eye patch'], ['band', 'Visor band']), weights: [66, 9, 9, 6, 3, 2, 2, 3] },
    { id: 'marks', label: 'Marks', group: 'face', choices: opts(['none', 'None'], ['freckles', 'Freckles'], ['mole', 'Beauty mark'], ['scar', 'Scar'], ['blush', 'Blush'], ['paint', 'Face paint']), weights: [60, 12, 8, 6, 8, 6] },
    { id: 'earring', label: 'Earrings', group: 'face', choices: opts(['none', 'None'], ['stud', 'Studs'], ['hoop', 'Hoops']), weights: [75, 15, 10] },
    { id: 'lips', label: 'Lips', group: 'face', choices: opts(['natural', 'Natural'], ['rose', 'Rose'], ['dark', 'Dark']), weights: [80, 12, 8] },
    { id: 'outfit', label: 'Outfit', group: 'outfit', choices: opts(
      ['flightsuit', 'Flight suit'], ['uniform', 'Uniform'], ['labcoat', 'Lab coat'], ['coverall', 'Coverall'], ['tee', 'T-shirt'],
      ['hoodie', 'Hoodie'], ['sweater', 'Sweater'], ['suit', 'Suit & tie'], ['robe', 'Robe'], ['apron', 'Apron'], ['tank', 'Tank top'],
      ['spacesuit', 'Spacesuit'], ['turtleneck', 'Turtleneck'],
    ), weights: [10, 10, 6, 7, 9, 7, 7, 5, 4, 4, 4, 5, 5] },
    { id: 'cloth', label: 'Outfit colour', group: 'outfit', colors: true, choices: CLOTH },
    { id: 'accent', label: 'Accent', group: 'outfit', colors: true, choices: ACCENT },
  ],
});

/** Headwear that sits on top of the hair, so tall hairstyles are tucked under it. */
export const hatClips = (set) => !NO_HAT.includes(set.headwear);

/**
 * Anyone from a seed. The trait roll, then a little sense: elders mostly grey, flight suits
 * mostly helmeted, helmets and hard hats in their own paints.
 */
export function fromSeed(seed) {
  const s = pilot3Traits.fromSeed(seed);
  const r = (salt) => hash01(String(seed), 900 + salt);
  const pick = (list, salt) => list[Math.floor(r(salt) * list.length) % list.length];
  const grey = { elder: 0.7, middle: 0.25 }[s.age] ?? 0;
  if (r(1) < grey) s.hairColor = pick(GREYS, 2);
  if (s.outfit === 'flightsuit' && r(3) < 0.5) s.headwear = 'helmet';
  if (s.headwear === 'helmet') s.hatColor = pick(HELMETS, 4);
  if (s.headwear === 'hardhat') s.hatColor = pick(HARDHATS, 5);
  if (s.headwear === 'none') s.hatColor = pilot3Traits.defaults().hatColor;
  return pilot3Traits.normalize(s);
}

const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const nearest = (hex, list) => {
  const rgb = rgbOf(`#${hex}`);
  return list.reduce((best, c) => (dist(rgbOf(c.hex), rgb) < dist(rgbOf(best.hex), rgb) ? c : best)).id;
};

/** A v1 crew member as a v3 person: the same face, flight suit and helmet. */
export function fromV1(v1) {
  return pilot3Traits.normalize({
    age: 'adult',
    build: 'average',
    face: 'oval',
    kin: 'human',
    skin: nearest(v1.skin, SKIN.slice(0, SKIN_HUMAN)),
    eyes: nearest(v1.eyes, EYES),
    brows: v1.brows === '2' ? 'thick' : 'thin',
    hair: 'short',
    hairColor: nearest(v1.hair, HAIR),
    facialHair: v1.mustache === 'yes' ? 'mustache' : 'none',
    headwear: v1.figure === 'pilot' ? 'helmet' : v1.figure === 'boss' ? 'headset' : 'cap',
    hatColor: nearest(v1.helmet, HAT),
    outfit: v1.figure === 'pilot' ? 'flightsuit' : 'uniform',
    cloth: nearest(v1.suit, CLOTH),
    accent: nearest(v1.stripe, ACCENT),
  });
}

export function fromV1Code(code) {
  const v1 = pilotTraits.decode(code);
  return v1 ? fromV1(v1) : null;
}

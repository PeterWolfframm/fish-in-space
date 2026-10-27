// Pilots (Burn-Through crew): the 32×32 radio portraits as a pixelforge generator.
//
// The drawing is pilot-pixel.js, a byte-identical port of the game's. On top of it this wraps
// the rolled spec in a trait system, so a crew member can be edited field by field, bred and
// shared as a short code. Colour fields hold every colour either the rolled crew or an avatar
// (the game's crew-room editor, `p1.` codes) can produce, so both round-trip exactly.

import { defineTraits } from '../pixel/traits.js';
import { hexFrom, rgbOf } from '../pixel/color.js';
import { pilotSpec, pilotFrame, PALETTES, PORTRAIT } from './pilot-pixel.js';
import { SKIN, HAIR_COLORS, EYE_COLORS, PAINT, SUIT, decodeAvatar, isAvatarCode, avatarFromSeed, encodeAvatar } from './pilot-avatar/avatar-spec.js';
import { pixelTraits, PIXEL_VISOR } from './pilot-avatar/avatar-pixel.js';

const swatch = (rgb, label) => ({ id: hexFrom(rgb).slice(1), hex: hexFrom(rgb), label });

/** Rolled colours first (crew 1, 2 …), then the avatar's named ones; duplicates dropped. */
function colorChoices(rolled, named = []) {
  const out = [];
  const seen = new Set();
  const add = (c) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    out.push(c);
  };
  rolled.forEach((rgb, i) => add(swatch(rgb, `Crew ${i + 1}`)));
  named.forEach((s) => add(swatch(rgbOf(s.hex), s.label)));
  return out;
}

const opts = (...ids) => ids.map(([id, label]) => ({ id, label }));
const SUIT_ROLLED = [...PALETTES.SUITS.blue, ...PALETTES.SUITS.red];
const VISOR_NAMED = Object.entries(PIXEL_VISOR).map(([id, rgb]) => ({ hex: hexFrom(rgb), label: id[0].toUpperCase() + id.slice(1) }));

export const pilotTraits = defineTraits({
  prefix: 'c',
  fields: [
    { id: 'figure', label: 'Figure', group: 'role', choices: opts(['pilot', 'Pilot'], ['boss', 'Air boss'], ['tutor', 'Instructor'], ['scope', 'Scope']), weights: [10, 1, 1, 1] },
    { id: 'side', label: 'Side', group: 'role', choices: opts(['blue', 'Blue'], ['red', 'Red']) },
    { id: 'skin', label: 'Skin', group: 'face', colors: true, choices: colorChoices(PALETTES.SKIN, SKIN) },
    { id: 'eyes', label: 'Eyes', group: 'face', colors: true, choices: colorChoices(PALETTES.EYES, EYE_COLORS) },
    { id: 'hair', label: 'Hair / brows', group: 'face', colors: true, choices: colorChoices(PALETTES.HAIR, HAIR_COLORS) },
    { id: 'brows', label: 'Brows', group: 'face', choices: opts(['1', 'Thin'], ['2', 'Thick']) },
    { id: 'mustache', label: 'Moustache', group: 'face', choices: opts(['no', 'No'], ['yes', 'Yes']), weights: [7, 3] },
    { id: 'helmet', label: 'Helmet', group: 'helmet', colors: true, choices: colorChoices([...PALETTES.HELMET_BLUE, ...PALETTES.HELMET_RED], PAINT) },
    { id: 'pattern', label: 'Paint', group: 'helmet', choices: opts(['stripe', 'Stripe'], ['twin', 'Twin'], ['checker', 'Checker'], ['bolt', 'Bolt'], ['plain', 'Plain'], ['star', 'Star']) },
    { id: 'stripe', label: 'Paint colour', group: 'helmet', colors: true, choices: colorChoices(PALETTES.STRIPES, PAINT) },
    { id: 'visor', label: 'Visor', group: 'helmet', colors: true, choices: colorChoices(PALETTES.VISORS, VISOR_NAMED) },
    { id: 'visorDown', label: 'Visor down', group: 'helmet', choices: opts(['no', 'Up'], ['yes', 'Down']), weights: [78, 22] },
    { id: 'suit', label: 'Suit', group: 'suit', colors: true, choices: colorChoices(SUIT_ROLLED, SUIT) },
    { id: 'patch', label: 'Patch', group: 'suit', colors: true, choices: colorChoices(PALETTES.STRIPES, PAINT) },
  ],
});

const COLOR_FIELDS = ['skin', 'eyes', 'hair', 'helmet', 'stripe', 'visor', 'suit', 'patch'];
const hexId = (rgb) => hexFrom(rgb).slice(1);

/** A pilotSpec-shaped object (rgb arrays, booleans) as a trait set. */
export function genomeOfSpec(spec) {
  const out = { side: spec.side ?? 'blue', figure: spec.figure === 'backseat' ? 'pilot' : spec.figure ?? 'pilot', pattern: spec.pattern };
  for (const f of COLOR_FIELDS) out[f] = hexId(spec[f]);
  out.brows = String(spec.brows);
  out.mustache = spec.mustache ? 'yes' : 'no';
  out.visorDown = spec.visorDown ? 'yes' : 'no';
  return { ...pilotTraits.normalize(out), seed: spec.seed };
}

/** The trait set back as the spec pilotFrame draws. `seed` only matters for the scope's blips. */
export function specOfGenome(genome) {
  const g = pilotTraits.normalize(genome);
  const spec = { seed: String(genome.seed ?? pilotTraits.encode(g)), side: g.side, figure: g.figure, pattern: g.pattern };
  for (const f of COLOR_FIELDS) spec[f] = rgbOf(g[f]);
  spec.brows = Number(g.brows);
  spec.mustache = g.mustache === 'yes';
  spec.visorDown = g.visorDown === 'yes';
  return spec;
}

/**
 * A crew member. `seed` is a callsign ("MAGIC 1") and draws exactly the face the game does;
 * `avatar` (a `p1.` code, or true to roll one from the seed) dresses them as a crew-room pilot.
 */
export function pilotFromSeed(seed, { side = 'blue', figure = 'pilot', avatar = null } = {}) {
  const base = pilotSpec(seed, { side, figure });
  if (!avatar) return genomeOfSpec(base);
  const spec = avatar === true ? avatarFromSeed(seed) : isAvatarCode(avatar) ? decodeAvatar(avatar) : null;
  return spec ? genomeOfSpec({ ...base, ...pixelTraits(spec) }) : genomeOfSpec(base);
}

export const pilotAvatarCode = (seed) => encodeAvatar(avatarFromSeed(seed));

const EXPR_ANIMS = [
  { id: 'talk', frames: 6, fps: 6 },
  { id: 'idle', frames: 1, fps: 1 },
  { id: 'blink', frames: 1, fps: 1 },
  { id: 'strain', frames: 4, fps: 6 },
  { id: 'alarm', frames: 4, fps: 6 },
  { id: 'grin', frames: 2, fps: 3 },
  { id: 'calm', frames: 1, fps: 1 },
  { id: 'eject', frames: 4, fps: 8 },
  { id: 'scope', frames: 12, fps: 10, label: 'sweep' },
];

export default {
  id: 'pilot',
  label: 'Pilots',
  game: 'Burn-Through',
  size: { w: PORTRAIT, h: PORTRAIT },
  bg: '#1d2430',
  traits: pilotTraits,
  options: [
    { id: 'avatar', label: 'Crew-room avatar', kind: 'toggle' },
  ],
  fromSeed: (seed, opts = {}) => pilotFromSeed(seed, opts),
  normalize: (g) => ({ ...pilotTraits.normalize(g), seed: g?.seed }),
  anims: EXPR_ANIMS,
  frame(genome, anim = 'idle', i = 0) {
    const expr = anim === 'scope' ? 'idle' : anim;
    return pilotFrame(specOfGenome(genome), expr, i);
  },
};

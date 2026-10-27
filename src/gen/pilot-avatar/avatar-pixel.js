// The vector avatar as the 32×32 pixel crew (pilot-pixel.js): the traits a radio portrait and the
// cockpit bust need, taken from an avatar spec, so the player's pilot looks the same on the radio.
// Pure.

import { hexOf, normalizeAvatar, SHELLS } from './avatar-spec.js';

const rgb = (hex) => {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const PIXEL_PATTERN = {
  plain: 'plain', stripe: 'stripe', twin: 'twin', checker: 'checker', bolt: 'bolt', star: 'star',
  flames: 'bolt', teeth: 'checker', chevron: 'star', national: 'twin', split: 'stripe', number: 'plain',
};
export const PIXEL_VISOR = { clear: [120, 160, 190], smoke: [60, 64, 70], gold: [200, 150, 40], mirror: [50, 110, 180], iridium: [100, 70, 150], amber: [210, 140, 50] };

/** pilotSpec traits (pilot-pixel.js) for an avatar spec. */
export function pixelTraits(spec) {
  const s = normalizeAvatar(spec);
  return {
    skin: rgb(hexOf(s, 'skin')),
    eyes: rgb(hexOf(s, 'eyeColor')),
    hair: rgb(hexOf(s, 'hairColor')),
    helmet: rgb(hexOf(s, 'shell')),
    stripe: rgb(hexOf(s, 'paint')),
    pattern: PIXEL_PATTERN[s.pattern] || 'plain',
    visor: PIXEL_VISOR[s.visorTint] || PIXEL_VISOR.smoke,
    visorDown: SHELLS.has(s.headgear) && s.visorPos === 'down',
    mustache: ['moustache', 'handlebar', 'beard', 'goatee'].includes(s.facialHair),
    brows: s.brows === 'thick' || s.brows === 'bushy' ? 2 : 1,
    suit: rgb(hexOf(s, 'suitColor')),
    patch: rgb(hexOf(s, 'sqColor')),
  };
}

// Swatches: every colour a plant4 genome can name. Each role (leaf, bark, petal, …) is its own
// gene with its own list, so a code digit always means the same colour for that role. Lists are
// append-only: a code is a plant's identity.

export const SW = {
  // greens
  spring: '#7cc04b', grass: '#5aa83c', forest: '#3f8a3a', deep: '#2f6b3a', olive: '#7d8f3a',
  sage: '#8aa37a', bluegreen: '#4f8f80', teal: '#2f8f86', lime: '#a3c94a', pine: '#2f6a50',
  redleaf: '#b0463f', purple: '#6a4a8a', cactus: '#5a9a5a', kelp: '#6f7a2a', goldkelp: '#a8923a',
  redalgae: '#b04a5a',
  // bark and canes
  brown: '#6b4a32', darkbrown: '#4a3426', grey: '#7a7570', red: '#d63a2a', paper: '#dcd6c8',
  tan: '#9a7a52', cane: '#b8b45a', black: '#3a3030', barkred: '#7a3f2a',
  // flowers and fruit
  white: '#f0ece0', cream: '#f2e2b0', yellow: '#f2cc3a', orange: '#ee8a2a', pink: '#ef8aa8',
  blush: '#f2a8b8', magenta: '#c04a9a', lavender: '#a08ad8', blue: '#5a7ae0', cyan: '#4ac8d8',
  pumpkin: '#e8802a', gold: '#d8b048', coral: '#e07a5a', amber: '#d89a2a', rust: '#b8552a',
  scarlet: '#d0382a', berryblue: '#4a5ac0', plum: '#6a3a8a', ink: '#2e2438',
  // roots
  carrot: '#ec7a24', purpleroot: '#7a3a8a', radish: '#e0507a', beet: '#8a2a4a', onion: '#e8d8b0',
  redonion: '#9a3a6a',
  // eyes
  eyebrown: '#5a3a1a', eyedark: '#2a1a14',
  // glow
  cyanglow: '#6af0e0', limeglow: '#c0f060', pinkglow: '#f080d0',
};

const ids = (list) => list.map((id) => ({ id, label: id.replace(/^./, (c) => c.toUpperCase()), hex: SW[id] }));

/** Per-role swatch lists. Order is frozen (append only). */
export const ROLES = {
  leaf: ids(['grass', 'spring', 'forest', 'deep', 'olive', 'sage', 'bluegreen', 'teal', 'lime', 'pine', 'redleaf', 'purple', 'cactus', 'kelp', 'goldkelp', 'redalgae']),
  tip: ids(['redleaf', 'orange', 'blush', 'magenta', 'yellow', 'purple', 'white', 'lime']),
  bark: ids(['brown', 'darkbrown', 'grey', 'barkred', 'paper', 'tan', 'cane', 'black']),
  petal: ids(['white', 'cream', 'yellow', 'orange', 'red', 'pink', 'blush', 'magenta', 'purple', 'lavender', 'blue', 'cyan']),
  eye: ids(['yellow', 'eyebrown', 'eyedark', 'orange', 'white']),
  fruit: ids(['red', 'orange', 'yellow', 'lime', 'plum', 'berryblue', 'ink', 'pumpkin', 'gold', 'cream', 'brown', 'magenta', 'pink']),
  root: ids(['carrot', 'purpleroot', 'cream', 'radish', 'beet', 'onion', 'redonion']),
  coral: ids(['coral', 'magenta', 'gold', 'purple', 'cyan', 'red', 'cream', 'orange']),
  autumn: ids(['amber', 'rust', 'scarlet', 'gold']),
  glow: ids(['cyanglow', 'limeglow', 'pinkglow']),
};

/** Form colour hints use friendly names; map them onto each role's own ids. */
const ALIAS = {
  fruit: { blue: 'berryblue', purple: 'plum', black: 'ink' },
  bark: { red: 'barkred', cane: 'cane' },
  eye: { brown: 'eyebrown', dark: 'eyedark' },
  coral: {},
  cap: { brown: 'brown', purple: 'purple' },
};

export function roleId(role, name) {
  const id = ALIAS[role]?.[name] ?? name;
  return ROLES[role]?.some((c) => c.id === id) ? id : null;
}

export const hexOf = (role, id) => ROLES[role]?.find((c) => c.id === id)?.hex ?? SW[id] ?? '#888888';

/** Beds: what the plant stands in. */
export const BEDS = {
  none: { label: 'None' },
  soil: { label: 'Soil', bed: '#6a4a32', bed2: '#4f3624' },
  tilled: { label: 'Tilled soil', bed: '#5a3c28', bed2: '#46301f' },
  grass: { label: 'Turf', bed: '#6a4a32', bed2: '#4f3624', grass: '#5a9a3a' },
  sand: { label: 'Sand', bed: '#d8c48a', bed2: '#bfa870' },
  gravel: { label: 'Gravel', bed: '#a89c84', bed2: '#7a7468' },
  rock: { label: 'Rock', bed: '#6a6a70', bed2: '#55555c' },
  pot: { label: 'Pot', bed: '#3a2a20', bed2: '#2a1e16' },
};
export const BED_IDS = Object.keys(BEDS);

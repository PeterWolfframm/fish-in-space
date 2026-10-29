// fish4's pigments: swatches fish3's palette does not have, for the terrain fish (and for any fish
// a biome palette reaches). The genome fields `pigment` and `markPigment` pick one; `fish3` keeps
// the fish3 swatch (`skin` / `markColor`). Colour morphs still apply on top (an albino cinderback
// is pale), so a pigment is a base swatch, not a final colour.
//
// Append only: a pigment's position is its digit in the code. `terrain` is where it is native
// (biome palettes lean toward it there); `hue` is a word for names.

export const PIGMENTS = [
  { id: 'fish3', label: 'Fish3 swatch', hex: null },
  // lava
  { id: 'obsidian', label: 'Obsidian', hex: '#2e2833', terrain: 'lava' },
  { id: 'basalt', label: 'Basalt', hex: '#4c4349', terrain: 'lava' },
  { id: 'magma', label: 'Magma', hex: '#e4532a', terrain: 'lava' },
  { id: 'cinder', label: 'Cinder', hex: '#9c3d26', terrain: 'lava' },
  { id: 'ash', label: 'Ash', hex: '#a59d96', terrain: 'lava' },
  { id: 'sulfur', label: 'Sulfur', hex: '#e9c64a', terrain: 'lava' },
  // sand
  { id: 'ochre', label: 'Ochre', hex: '#c98c3b', terrain: 'sand' },
  { id: 'dune', label: 'Dune', hex: '#e1c38e', terrain: 'sand' },
  { id: 'sandstone', label: 'Sandstone', hex: '#b97a5b', terrain: 'sand' },
  { id: 'terracotta', label: 'Terracotta', hex: '#a9563b', terrain: 'sand' },
  { id: 'desertrose', label: 'Desert-rose', hex: '#d8a1a0', terrain: 'sand' },
  { id: 'glass', label: 'Glass', hex: '#cfe6df', terrain: 'sand' },
  // nuclear (radiant, harmless)
  { id: 'uraniumglass', label: 'Uranium-glass', hex: '#9fe25c', terrain: 'nuclear' },
  { id: 'cherenkov', label: 'Cherenkov', hex: '#3fa9ff', terrain: 'nuclear' },
  { id: 'isotopeamber', label: 'Isotope-amber', hex: '#ffb44a', terrain: 'nuclear' },
  { id: 'thorium', label: 'Thorium', hex: '#c9d7a2', terrain: 'nuclear' },
  { id: 'radium', label: 'Radium', hex: '#7df1c4', terrain: 'nuclear' },
  // aether
  { id: 'voidink', label: 'Void-ink', hex: '#1b1731', terrain: 'aether' },
  { id: 'starlight', label: 'Starlight', hex: '#e9e5ff', terrain: 'aether' },
];

export const PIGMENT_IDS = PIGMENTS.map((p) => p.id);
export const pigmentById = (id) => PIGMENTS.find((p) => p.id === id) ?? PIGMENTS[0];

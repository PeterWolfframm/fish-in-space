// Where plants grow. A region says which forms you find there (weights), which colours it leans
// toward (palette ids by role, on top of each form's own preferences), which sizes it favours, and
// what the plants stand in. The ecotype roll reads this first, the way fish4 reads its terrains:
// a seed is a place before it is a plant, so a batch from one region looks like it belongs.
//
// Ids are frozen (they are code digits of the `region` field): append only.

export const REGIONS = {
  // farm: the plots a player tends, by the season they are sown in
  kitchen: {
    realm: 'farm', label: 'Kitchen garden',
    forms: { lettuce: 6, cabbage: 4, kale: 4, carrot: 6, radish: 6, onion: 5, tomato: 6, bean: 5, pepper: 5, strawberry: 5 },
    sizes: { herb: 3, shrub: 3 },
  },
  field: {
    realm: 'farm', label: 'Open field',
    forms: { wheat: 8, corn: 7, pumpkin: 6, sunflower: 4, cabbage: 2, carrot: 2 },
    sizes: { shrub: 3, tall: 2 },
    tint: { leaf: ['grass', 'olive'] },
  },
  flowerbed: {
    realm: 'farm', label: 'Flower bed',
    forms: { tulip: 6, daisy: 6, lavender: 5, rose: 5, sunflower: 4, strawberry: 1 },
    sizes: { herb: 2, shrub: 3, tall: 1 },
    tint: { petal: ['pink', 'blush', 'lavender', 'yellow', 'white', 'magenta', 'orange', 'red', 'blue'] },
  },
  greenhouse: {
    realm: 'farm', label: 'Greenhouse',
    forms: { tomato: 5, pepper: 6, strawberry: 5, bean: 3, rose: 3, lettuce: 3, kale: 2 },
    sizes: { herb: 2, shrub: 3 },
    tint: { fruit: ['red', 'orange', 'yellow', 'plum', 'lime'] },
    bed: ['pot', 'tilled'],
  },

  // wild
  woodland: {
    realm: 'wild', label: 'Broadleaf wood',
    forms: { oak: 7, maple: 6, birch: 4, bush: 5, hydrangea: 2, fern: 5, mushroom: 4, grass: 2 },
    sizes: { tall: 2, tree: 3, giant: 1, shrub: 2 },
    tint: { leaf: ['forest', 'grass', 'deep', 'spring'], autumn: ['amber', 'rust', 'scarlet', 'gold'] },
  },
  orchard: {
    realm: 'wild', label: 'Orchard',
    forms: { fruittree: 9, bush: 4, grass: 2 },
    sizes: { tall: 2, tree: 3 },
    tint: { fruit: ['red', 'orange', 'yellow', 'lime', 'plum', 'pink'] },
  },
  taiga: {
    realm: 'wild', label: 'Taiga',
    forms: { spruce: 9, birch: 4, mushroom: 3, fern: 3, grass: 2 },
    sizes: { tree: 3, giant: 2, tall: 1 },
    tint: { leaf: ['pine', 'deep', 'bluegreen'], bark: ['grey', 'darkbrown', 'paper'] },
  },
  riverbank: {
    realm: 'wild', label: 'Riverbank',
    forms: { willow: 7, bamboo: 4, grass: 5, fern: 3, birch: 2 },
    sizes: { tall: 2, tree: 3, shrub: 1 },
    tint: { leaf: ['lime', 'spring', 'sage'] },
  },
  desert: {
    realm: 'wild', label: 'Desert',
    forms: { saguaro: 7, prickly: 7, succulent: 6, acacia: 3, grass: 2 },
    sizes: { herb: 2, shrub: 3, tall: 2 },
    tint: { leaf: ['cactus', 'sage', 'bluegreen', 'olive'], petal: ['magenta', 'pink', 'yellow', 'orange', 'red'] },
    bed: ['sand'],
  },
  tropics: {
    realm: 'wild', label: 'Tropics',
    forms: { palm: 8, bamboo: 4, fern: 4, succulent: 2, bush: 2 },
    sizes: { tall: 2, tree: 3, giant: 1 },
    tint: { leaf: ['spring', 'grass', 'lime', 'teal'] },
  },
  savanna: {
    realm: 'wild', label: 'Savanna',
    forms: { acacia: 8, grass: 6, bush: 2, succulent: 1 },
    sizes: { tree: 3, tall: 2, shrub: 1 },
    tint: { leaf: ['olive', 'sage', 'grass'] },
  },
  coast: {
    realm: 'wild', label: 'Cypress coast',
    forms: { cypress: 8, grass: 3, succulent: 2, bush: 3, palm: 1 },
    sizes: { tall: 2, tree: 3 },
    tint: { leaf: ['deep', 'pine', 'olive'] },
  },

  // water
  reef: {
    realm: 'water', label: 'Coral reef',
    forms: { seafan: 7, staghorn: 7, caulerpa: 4, sealettuce: 3 },
    sizes: { shrub: 3, tall: 2, herb: 1 },
    bed: ['sand', 'rock'],
  },
  kelpforest: {
    realm: 'water', label: 'Kelp forest',
    forms: { kelp: 10, sealettuce: 3, seafan: 1 },
    sizes: { tree: 3, giant: 2, tall: 2 },
    tint: { leaf: ['kelp', 'goldkelp', 'olive'] },
  },
  river: {
    realm: 'water', label: 'River',
    forms: { vallis: 7, aponogeton: 5, sword: 4, anubias: 3, hairgrass: 3 },
    sizes: { shrub: 3, tall: 2, herb: 1 },
    bed: ['gravel', 'sand'],
  },
  tank: {
    realm: 'water', label: 'Planted tank',
    forms: { stemplant: 6, cabomba: 5, mossball: 4, hairgrass: 4, sword: 4, anubias: 4, vallis: 2 },
    sizes: { herb: 2, shrub: 3, tall: 1 },
    tint: { leaf: ['spring', 'grass', 'lime', 'redalgae', 'forest'] },
  },
  abyss: {
    realm: 'water', label: 'Abyss vent',
    forms: { glowstalk: 9, seafan: 3, staghorn: 2 },
    sizes: { shrub: 3, tall: 2 },
    tint: { leaf: ['teal', 'purple', 'bluegreen'], coral: ['purple', 'cyan', 'magenta'] },
    bed: ['rock'],
    glow: 0.5,
  },
};

export const REGION_IDS = Object.keys(REGIONS);
export const REALM_IDS = ['farm', 'wild', 'water'];
export const regionsOf = (realm) => REGION_IDS.filter((id) => REGIONS[id].realm === realm);

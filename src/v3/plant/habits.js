// Species templates for plant3. A species is a habit (how it bends) plus the parts the
// skeleton is allowed to grow. Noise only jitters a template. It does not invent one.
//
// The nine v1 forms are species ids, so a v1 `g…` code keeps its form. The other seven are
// the same painters with different structure. Crosses are bred, never rolled.

/** @typedef {'grass'|'rosette'|'flower'|'bush'|'tree'|'vine'|'cactus'|'bamboo'|'mushroom'} Habit */

/**
 * @type {Record<string, {
 *   label: string, habit: Habit, form: string, parts: string, evergreen?: boolean,
 *   droop?: number, crown?: string, forceBloom?: boolean, prefer?: Record<string, string>,
 * }>}
 */
export const SPECIES = {
  grass: { label: 'Grain', habit: 'grass', form: 'grass', parts: 'blades', prefer: { leaf: 'lance', fruit: 'grain', bloom: 'none' } },
  rosette: { label: 'Rosette', habit: 'rosette', form: 'rosette', parts: 'rosette', prefer: { leaf: 'oval' } },
  flower: { label: 'Flower', habit: 'flower', form: 'flower', parts: 'flower', prefer: { leaf: 'lance', bloom: 'daisy' } },
  bush: { label: 'Bush', habit: 'bush', form: 'bush', parts: 'bush', prefer: { bloom: 'cluster', leaf: 'oval' } },
  tree: { label: 'Sapling', habit: 'tree', form: 'tree', parts: 'tree', crown: 'blob', prefer: { stemColor: 'brown', leaf: 'oval', bloom: 'none' } },
  vine: { label: 'Vine', habit: 'vine', form: 'vine', parts: 'vine', prefer: { leaf: 'heart' } },
  cactus: { label: 'Cactus', habit: 'cactus', form: 'cactus', parts: 'cactus', evergreen: true, prefer: { bloom: 'cup', stemColor: 'green', leafColor: 'garden' } },
  bamboo: { label: 'Bamboo', habit: 'bamboo', form: 'bamboo', parts: 'bamboo', evergreen: true, prefer: { leaf: 'lance', stemColor: 'pale', bloom: 'none' } },
  mushroom: { label: 'Mushroom', habit: 'mushroom', form: 'mushroom', parts: 'mushroom', evergreen: true, prefer: { bloom: 'none', fruit: 'none', stemColor: 'pale' } },
  reed: { label: 'Reed', habit: 'grass', form: 'grass', parts: 'reed', prefer: { leaf: 'lance', height: 'tall', stemColor: 'pale', bloom: 'none', fruit: 'grain' } },
  fern: { label: 'Fern', habit: 'rosette', form: 'rosette', parts: 'fronds', prefer: { leaf: 'lance', leafColor: 'forest', bloom: 'none' } },
  succulent: { label: 'Succulent', habit: 'rosette', form: 'rosette', parts: 'stacked', evergreen: true, prefer: { leaf: 'round', height: 'low', leafColor: 'sage', bloom: 'none' } },
  willow: { label: 'Willow', habit: 'tree', form: 'tree', parts: 'tree', crown: 'droop', droop: 0.18, prefer: { leaf: 'lance', leafColor: 'sage', stemColor: 'brown', bloom: 'none' } },
  palm: { label: 'Palm', habit: 'tree', form: 'tree', parts: 'palm', evergreen: true, prefer: { leaf: 'lance', stemColor: 'brown', bloom: 'none', fruit: 'round' } },
  conifer: { label: 'Conifer', habit: 'tree', form: 'tree', parts: 'tiers', crown: 'tiers', evergreen: true, prefer: { leaf: 'needle', stemColor: 'brown', leafColor: 'forest', bloom: 'none' } },
  ivy: { label: 'Ivy', habit: 'vine', form: 'vine', parts: 'vine', evergreen: true, dense: true, prefer: { leaf: 'heart', leafColor: 'forest', bloom: 'none' } },
};

/** Bred overlays. Same part painters, different structure, never rolled. */
export const CROSSES = {
  meadow: { id: 'meadow', label: 'Meadow', habit: 'grass', form: 'grass', parts: 'meadow', forceBloom: true },
  weeping: { id: 'weeping', label: 'Weeping bloom', habit: 'tree', form: 'tree', parts: 'tree', crown: 'droop', droop: 0.2, forceBloom: true },
  fir: { id: 'fir', label: 'Fir', habit: 'tree', form: 'tree', parts: 'tiers', crown: 'tiers', evergreen: true },
};

/** The template a genome draws: the species, or a cross laid over it. */
export function resolveSpec(set) {
  const base = SPECIES[set?.species] ?? SPECIES.flower;
  const overlay = set?.cross && set.cross !== 'none' ? CROSSES[set.cross] : null;
  if (!overlay) return { ...base, id: set?.species && SPECIES[set.species] ? set.species : 'flower' };
  return { ...base, ...overlay, id: overlay.id };
}

export const SPECIES_IDS = Object.keys(SPECIES);

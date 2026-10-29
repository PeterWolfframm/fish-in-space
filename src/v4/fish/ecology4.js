// fish4's ecology: fish3's facts (ecologyOf, reading a fish4 body's own habitat through `ext`)
// plus where the fish lives — terrain, medium, heat, radiance, region, niche — and care numbers
// in its own medium: a lava fish's tank runs at 850–1250 °C, not at fish3's water numbers.
//
// A water fish (every import and every classic roll) keeps fish3's facts and numbers exactly;
// it only gains the extra facts.

import { ecologyOf } from '../../v3/fish/ecology.js';
import { toFish3 } from './genome.js';
import { extOf, bodyOf } from './bodies/index.js';
import { TERRAINS, REGIONS, NICHES } from './data/terrains.js';

/** Heat bands, coolest first. Water fish read theirs off fish3's temperature fact. */
export const HEAT = ['frozen', 'cold', 'mild', 'warm', 'hot', 'baking', 'molten'];
const HEAT_BY_TEMP = { polar: 'cold', cold: 'cold', temperate: 'mild', tropical: 'warm', volcanic: 'hot' };
const HEAT_BY_TERRAIN = { lava: 'molten', sand: 'baking', nuclear: 'hot', aether: 'frozen' };

/** Media that are water enough for pH and salinity to mean something. */
export const WET = ['water', 'coolant'];

/** The terrain a fish lives in: its own field, else its body's. */
export const terrainOf = (set) => (TERRAINS[set.terrain] ? set.terrain : bodyOf(set).terrain ?? 'water');

/** The temperature band of a fish's medium, °C: the terrain's, or fish3's for water. */
export const tempBandFor = (set, eco) => TERRAINS[terrainOf(set)].tempC ?? eco.care.tempC;

/** A fish's heat band: its body's, its terrain's, or (water) fish3's temperature fact's. */
export const heatOf = (rec, terrain, eco) => rec.habitat?.heat ?? HEAT_BY_TERRAIN[terrain] ?? HEAT_BY_TEMP[eco.temp.value] ?? 'mild';

/** Harmless radiance 0..1: its body's, else a nuclear fish's default. */
export const radianceOf = (rec, terrain) => rec.habitat?.radiance ?? (terrain === 'nuclear' ? 0.5 : 0);

const why = (field, value, label) => ({ field, value, label: `${field}: ${String(label ?? value).toLowerCase()}` });

/** fish3's ecology plus fish4's place facts and medium-aware care. */
export function ecology4Of(set) {
  const eco = ecologyOf(toFish3(set), extOf(set));
  const rec = bodyOf(set);
  const terrain = terrainOf(set);
  const T = TERRAINS[terrain];
  const tWhy = why('terrain', terrain, T.label);
  const bodyWhy = why('body', rec.id, rec.label);

  const heatId = heatOf(rec, terrain, eco);
  const radiance = radianceOf(rec, terrain);
  const region = REGIONS[set.region] && set.region !== 'unmapped' ? set.region : null;
  const niche = NICHES[set.niche] && set.niche !== 'unmapped' ? set.niche : null;

  const wet = WET.includes(T.medium);
  const care = {
    ...eco.care,
    medium: T.medium,
    mediumLabel: T.mediumLabel,
    tempC: T.tempC ?? eco.care.tempC,
    pH: wet ? eco.care.pH : null,
  };

  return {
    ...eco,
    terrain: { value: terrain, because: [rec.fish3 ? tWhy : bodyWhy] },
    medium: { value: T.medium, because: [tWhy] },
    heat: { value: heatId, because: [rec.habitat?.heat ? bodyWhy : T.tempC ? tWhy : eco.temp.because[0]] },
    radiance: { value: radiance, because: [rec.habitat?.radiance != null ? bodyWhy : tWhy] },
    region: { value: region ?? 'unmapped', label: region ? REGIONS[region].label : 'Unknown waters', because: [] },
    niche: { value: niche ?? 'unmapped', label: NICHES[niche ?? 'unmapped'].label, note: niche ? NICHES[niche].note : undefined, because: [] },
    care,
  };
}

/** The care line for a fish's medium, as plain words. */
export function careLine(eco) {
  const c = eco.care;
  const where = c.medium === 'water' ? 'water' : c.mediumLabel;
  const ph = c.pH ? `, pH ${c.pH[0]}–${c.pH[1]}` : '';
  return `${c.tempC[0]}–${c.tempC[1]} °C ${where}${ph}; ${c.litres} L for ${c.group > 1 ? c.group : 'one'}.`;
}

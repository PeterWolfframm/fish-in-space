// fish4's classification: Order › Family › Genus species var. variety. Genus and species are
// fish3's binomial, unchanged; order and family come from taxonomy-data.js; the variety from the
// colour morph (or a pure line). Hybrids read as `× Genus`, the botanists' way, under their first
// parent's family.

import { HYBRIDS } from '../../v3/fish/bodies.js';
import { phenotype } from '../../v3/fish/phenotype.js';
import { namesOf } from '../../v3/fish/names.js';
import { TAXA } from '../../v3/fish/names-data.js';
import { ORDERS, FAMILIES, FAMILY_OF, VARIETY_OF_MORPH } from './taxonomy-data.js';
import { BODY_RECORDS } from './bodies/index.js';

export { ORDERS, FAMILIES, FAMILY_OF };

/** A body's family id: its own, else a hybrid's first parent's, else torpedo's. */
export const familyOf = (body) => FAMILY_OF[body] ?? BODY_RECORDS[body]?.family ?? FAMILY_OF[HYBRIDS[body]?.a] ?? 'Cursoridae';

/** The tree for a fish3-shaped set (fish4 callers pass toFish3(set) and extOf(set)). */
export function taxonomyOf(f3, ext) {
  const ph = phenotype(f3, -1, ext);
  const hybrid = HYBRIDS[ph.body];
  const familyId = familyOf(ph.body);
  const family = FAMILIES[familyId];
  const genus = (ext?.taxon ?? TAXA[ph.body] ?? TAXA[hybrid?.a] ?? TAXA.torpedo).genus;
  const species = namesOf(f3, ext).binomial.split(' ').slice(1).join(' ');
  const purity = Number(String(f3.purity ?? 'p0').slice(1)) || 0;
  const variety = VARIETY_OF_MORPH[ph.morph] ?? (purity >= 3 ? `line ${Number(String(f3.lineA).slice(1))}` : null);
  const shownGenus = hybrid ? `× ${genus}` : genus;
  const binomial = `${shownGenus} ${species}`;
  return {
    order: { id: family.order, ...ORDERS[family.order] },
    family: { id: familyId, label: family.label, priors: family.priors },
    genus,
    species,
    variety,
    hybrid: hybrid ? { a: hybrid.a, b: hybrid.b, sterile: Boolean(hybrid.sterile) } : null,
    binomial,
    full: variety ? `${binomial} ${/^line/.test(variety) ? variety : `var. ${variety}`}` : binomial,
    path: [family.order, familyId, shownGenus, species, variety].filter(Boolean),
  };
}

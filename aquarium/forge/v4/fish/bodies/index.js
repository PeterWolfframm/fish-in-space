// fish4's body registry: fish3's 32 bodies (mirrored by reference, so their data is fish3's) and
// fish4's own forms, one record shape for both:
//
//   { id, label, terrain, kin, weight, arch, habitat, taxon, family, anatomy, leanings, pigments?, fish3? }
//
// A fish3 body is `form: 'fish3'` + `body: <id>`; a fish4 form is `form: <id>` and its `body`
// field holds its kin (the nearest fish3 body), so the fish3 machinery underneath always has a
// valid body to read. `extOf(set)` is what the fish3 painter, ecology, names and lore receive to
// draw and describe the real one.
//
// Append only: NEW_FORMS order is the `form` digit in the code.

import { BODIES, HYBRIDS } from '../../../v3/fish/bodies.js';
import { HABITAT } from '../../../v3/fish/ecology-data.js';
import { TAXA } from '../../../v3/fish/names-data.js';
import { fish3Traits } from '../../../v3/fish/genome.js';
import { FAMILY_OF } from '../taxonomy-data.js';
import { pigmentById } from '../data/pigments.js';
import WATER from './water.js';
import LAVA from './lava.js';
import SAND from './sand.js';
import NUCLEAR from './nuclear.js';

/** fish4's own forms, in code order. */
export const NEW_FORMS = [...WATER, ...LAVA, ...SAND, ...NUCLEAR];
export const FORM_IDS = ['fish3', ...NEW_FORMS.map((b) => b.id)];

const fish3Label = (id) => fish3Traits.fieldById('body').choices.find((c) => c.id === id)?.label ?? id;

const FISH3_RECORDS = Object.fromEntries(
  Object.keys(BODIES).map((id) => [id, {
    id,
    label: fish3Label(id),
    terrain: 'water',
    kin: id,
    weight: 1,
    arch: BODIES[id],
    habitat: HABITAT[id],
    taxon: TAXA[id],
    family: FAMILY_OF[id],
    anatomy: [],
    leanings: {},
    fish3: true,
  }]),
);

const NEW_RECORDS = Object.fromEntries(NEW_FORMS.map((b) => [b.id, b]));

/** Every body by id: fish3's and fish4's. */
export const BODY_RECORDS = { ...FISH3_RECORDS, ...NEW_RECORDS };
export const isNewForm = (id) => Boolean(NEW_RECORDS[id]);

/** The record of the body a fish4 set shows (a fish3 hybrid reads as its first parent). */
export function bodyOf(set) {
  if (set.form && set.form !== 'fish3' && NEW_RECORDS[set.form]) return NEW_RECORDS[set.form];
  return FISH3_RECORDS[set.body] ?? FISH3_RECORDS[HYBRIDS[set.body]?.a] ?? FISH3_RECORDS.torpedo;
}

/** The id a fish is known by: its form, else its fish3 body (or hybrid). */
export const bodyIdOf = (set) => (set.form && set.form !== 'fish3' && NEW_RECORDS[set.form] ? set.form : set.hybrid && set.hybrid !== 'none' ? set.hybrid : set.body);

/** The genome fields for a body id: fish3's `body`, or a form plus its kin. */
export const bodyFields = (id) => (NEW_RECORDS[id] ? { form: id, body: NEW_RECORDS[id].kin } : { form: 'fish3', body: id });

/**
 * What the fish3 machinery needs to draw and describe a fish4 body or pigment, or undefined for a
 * plain fish3 fish (so its pixels and words stay fish3's exactly). See v3 phenotype `ext`.
 */
export function extOf(set) {
  const rec = set.form && set.form !== 'fish3' ? NEW_RECORDS[set.form] : null;
  const skinP = set.pigment && set.pigment !== 'fish3' ? pigmentById(set.pigment) : null;
  const markP = set.markPigment && set.markPigment !== 'fish3' ? pigmentById(set.markPigment) : null;
  if (!rec && !skinP && !markP) return undefined;
  const ext = { key: `${set.form ?? 'fish3'}/${set.pigment ?? 'fish3'}/${set.markPigment ?? 'fish3'}` };
  if (rec) Object.assign(ext, { body: rec.id, label: rec.label, arch: rec.arch, habitat: rec.habitat, taxon: rec.taxon });
  if (skinP) Object.assign(ext, { skin: skinP.hex, skinLabel: skinP.label });
  if (markP) ext.mark = markP.hex;
  return ext;
}

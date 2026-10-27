/**
 * Colour pools for fish.
 *
 * Hand-picked rather than generated: random hues produce mud, and the whole point of the
 * generator is that every result should look like it was drawn on purpose.
 */

/** Body colours. Saturated enough to survive the shading ramp at sprite size. */
export const BODY_COLORS = [
  { id: 'ember', hex: '#e8551f', label: 'Ember' },
  { id: 'tangerine', hex: '#f08a24', label: 'Tangerine' },
  { id: 'butter', hex: '#f2c53d', label: 'Butter' },
  { id: 'lime', hex: '#8cc63f', label: 'Lime' },
  { id: 'jade', hex: '#2fa678', label: 'Jade' },
  { id: 'teal', hex: '#1f8a8c', label: 'Teal' },
  { id: 'lagoon', hex: '#2d7fd0', label: 'Lagoon' },
  { id: 'cobalt', hex: '#2b4fa8', label: 'Cobalt' },
  { id: 'violet', hex: '#7a4bbf', label: 'Violet' },
  { id: 'orchid', hex: '#c44fa0', label: 'Orchid' },
  { id: 'coral', hex: '#f0646b', label: 'Coral' },
  { id: 'rose', hex: '#e58fa0', label: 'Rose' },
  { id: 'sand', hex: '#d8b98a', label: 'Sand' },
  { id: 'bronze', hex: '#a9712f', label: 'Bronze' },
  { id: 'slate', hex: '#6b7f8c', label: 'Slate' },
  { id: 'pewter', hex: '#8d949b', label: 'Pewter' },
  { id: 'ink', hex: '#39414f', label: 'Ink' },
  { id: 'pearl', hex: '#e8e4d8', label: 'Pearl' },
];

/** Markings. Includes near-black and near-white, which read as outline and highlight. */
export const MARK_COLORS = [
  { id: 'soot', hex: '#2b2f38', label: 'Soot' },
  { id: 'chalk', hex: '#f4f1e6', label: 'Chalk' },
  { id: 'ember', hex: '#e8551f', label: 'Ember' },
  { id: 'butter', hex: '#f2c53d', label: 'Butter' },
  { id: 'jade', hex: '#2fa678', label: 'Jade' },
  { id: 'lagoon', hex: '#2d7fd0', label: 'Lagoon' },
  { id: 'violet', hex: '#7a4bbf', label: 'Violet' },
  { id: 'coral', hex: '#f0646b', label: 'Coral' },
  { id: 'bronze', hex: '#a9712f', label: 'Bronze' },
];

export const EYE_COLORS = [
  { id: 'jet', hex: '#17191f', label: 'Jet' },
  { id: 'amber', hex: '#c8871b', label: 'Amber' },
  { id: 'copper', hex: '#a8481c', label: 'Copper' },
  { id: 'moss', hex: '#3e7a45', label: 'Moss' },
  { id: 'sky', hex: '#3a7fc1', label: 'Sky' },
  { id: 'ruby', hex: '#b02a3c', label: 'Ruby' },
];

/** The outline every fish shares, so a school reads as one set. */
export const INK = '#1b1a22';

/** The glint in an eye, and the lightest step of a belly. */
export const HIGHLIGHT = '#fbf7ec';

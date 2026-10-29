// Allele display helpers shared by the Lab and PIP's archive.
import * as W from '../game';

const CHOICES = W.fish.traits.fieldById('geneA').choices as { id: string; label: string }[];
export const labelOf = (a: string) => CHOICES.find((c) => c.id === a)?.label.replace(/\s*\(.*\)/, '') ?? a;
export const modeOf = (a: string) => /\((\w+)\)/.exec(CHOICES.find((c) => c.id === a)?.label ?? '')?.[1] ?? 'wild';

/** One colour per allele, shared by the Punnett square, the family tree, the gene pool and the Lab's helix.
 *  Each loosely suggests what the allele does; wild type is a quiet slate. */
const HEX: Record<string, string> = {
  wild: '#5d6a8a',
  albino: '#ffb3c9',
  leucistic: '#e8eefc',
  melanistic: '#8a74c9',
  axanthic: '#7fb0d8',
  ghost: '#3ee6f5',
  bubble: '#c79bff',
  xanthic: '#ffd84a',
  longfin: '#ffa53d',
  koi: '#ff6b6b',
};
export const alleleColor = (a: string | undefined) => HEX[a ?? 'wild'] ?? '#9aa6c8';
export const alleleNum = (a: string | undefined) => parseInt(alleleColor(a).slice(1), 16);

/** What a pair of alleles shows: recessives need both copies; dominant and codominant need one. */
export function shows(x: string, y: string): string[] {
  const out = new Set<string>();
  for (const a of [x, y]) {
    if (a === 'wild') continue;
    if (modeOf(a) === 'recessive' ? x === y : true) out.add(a);
  }
  return [...out];
}

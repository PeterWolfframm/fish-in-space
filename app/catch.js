// A readable profile for a stored sprite. Fish v3 fills the codex; other kinds get the label and code.

import { generator, fromCode, sizeOf } from '../src/gen/registry.js';
import { swipes } from './pixelgen.js';

const CHIP_KEYS = ['diet', 'temperament', 'sociality', 'depth', 'salinity'];

/** Name, lore, ecology chips, and any saved compatibility scores for one catch. */
export function describeCatch(kind, code) {
  const gen = generator(kind);
  const genome = gen && fromCode(gen, code);
  const swipe = swipes().find((s) => s.kind === kind && s.code === code && s.scores);
  const scores = swipe?.scores ?? null;
  if (!gen || !genome) {
    return { name: gen?.label ?? kind, sub: code, away: '', bio: [], chips: [kind], scores };
  }
  const lore = gen.lore?.(genome);
  const eco = gen.ecology?.(genome);
  const bio = [];
  if (lore?.quote?.text) bio.push(`“${lore.quote.text}”${lore.quote.by ? ` — ${lore.quote.by}` : ''}`);
  for (const line of lore?.codex ?? []) if (line.text) bio.push(line.text);
  if (lore?.edict?.text) bio.push(lore.edict.text);
  if (lore?.legend?.text) bio.push(lore.legend.text);
  if (!bio.length) {
    const described = gen.describe?.(genome);
    bio.push(described || `${gen.label} · ${code}`);
  }
  const chips = [];
  if (eco) for (const k of CHIP_KEYS) if (eco[k]?.value) chips.push(eco[k].value);
  if (genome.size) chips.push(String(genome.size));
  const sig = gen.signatureOf?.(genome)?.label;
  if (sig) chips.push(sig);
  if (!chips.length) chips.push(gen.label);
  const box = sizeOf(gen, genome);
  const bits = [genome.size, genome.body, genome.mood || genome.look].filter(Boolean);
  return {
    name: gen.name?.(genome) ?? gen.label,
    sub: bits.length ? bits.join(' · ') : gen.label,
    away: box ? `${box.w}×${box.h}` : '',
    bio,
    chips,
    scores,
  };
}

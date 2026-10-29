// Family layout shared by the Lab wall and the Heritage sheet.
// A child always sits a generation below its parents, even when its genome says otherwise.

import { allelesOf, generationOf, genomeOf } from './fish';
import { fishName } from './state';
import type { Origin, Parent, State } from './types';

export interface LineNode {
  id: string;
  code: string;
  name: string;
  gen: number;
  alive: boolean;
  parents: Parent[];
  origin?: Origin;
  tank?: string;
}

/** Which of the child's two alleles came from which parent. If neither split fits, a mutation slipped in. */
export function handedDown(child: string, a: string, b: string): [string, string] {
  const [c1, c2] = allelesOf(child);
  const A = allelesOf(a);
  const B = allelesOf(b);
  if (A.includes(c1) && B.includes(c2)) return [c1, c2];
  if (A.includes(c2) && B.includes(c1)) return [c2, c1];
  return [c1, c2];
}

export function lineageNodes(s: State): LineNode[] {
  const nodes = new Map<string, LineNode>();
  for (const f of s.fish)
    nodes.set(f.id, {
      id: f.id,
      code: f.code,
      name: fishName(f),
      gen: generationOf(genomeOf(f.code)),
      alive: true,
      parents: f.parents ?? [],
      origin: f.origin,
      tank: f.tank,
    });
  for (const f of s.fish)
    for (const p of f.parents ?? [])
      if (!nodes.has(p.id))
        nodes.set(p.id, { id: p.id, code: p.code, name: p.name, gen: generationOf(genomeOf(p.code)), alive: false, parents: [] });
  const all = [...nodes.values()];
  for (let pass = 0; pass < 6; pass++)
    for (const n of all)
      for (const p of n.parents) {
        const pn = nodes.get(p.id);
        if (pn && n.gen <= pn.gen) n.gen = pn.gen + 1;
      }
  return all;
}

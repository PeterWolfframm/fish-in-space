// Heritage: where every fish came from and what it carries.
//  · Family tree — one row per generation. Each fish is a card with its two alleles drawn as a chromosome
//    pair. The line from each parent to a child is painted in the allele that parent handed down, so you
//    can follow a gene down the page. Parents that have since been sold or seeded stay on as ghosts.
//  · Gene pool — a barcode of the whole station (one column per fish, two cells per column), then each
//    allele's reach: how many fish show it and how many quietly carry it.

import { useState } from 'preact/hooks';
import { game, selectFish } from '../store/signals';
import * as W from '../game';
import { SpriteArt } from './Art';
import { Heading, Stat } from './kit';
import { alleleColor, labelOf, modeOf, shows } from './genes';

interface Node {
  id: string;
  code: string;
  name: string;
  gen: number;
  alive: boolean;
  parents: W.Parent[];
  origin?: W.Origin;
  tank?: string;
  x: number;
  y: number;
}

const CARD_W = 92;
const CARD_H = 112;
const GAP_X = 14;
const GAP_Y = 54;
const ORIGIN: Record<W.Origin, string> = { bred: 'bred here', roe: '🧊 roe', heritage: '🏺 heritage', crate: '📦 crate', starter: '🚀 first crew' };

/** Which of the child's two alleles came from which parent. If neither split fits, a mutation slipped in. */
function inherited(child: string, a: string, b: string): [string, string] {
  const [c1, c2] = W.allelesOf(child);
  const A = W.allelesOf(a);
  const B = W.allelesOf(b);
  if (A.includes(c1) && B.includes(c2)) return [c1, c2];
  if (A.includes(c2) && B.includes(c1)) return [c2, c1];
  return [c1, c2];
}

function build(s: W.State) {
  const nodes = new Map<string, Node>();
  for (const f of s.fish)
    nodes.set(f.id, { id: f.id, code: f.code, name: W.fishName(f), gen: W.generationOf(W.genomeOf(f.code)), alive: true, parents: f.parents ?? [], origin: f.origin, tank: f.tank, x: 0, y: 0 });
  for (const f of s.fish)
    for (const p of f.parents ?? [])
      if (!nodes.has(p.id)) nodes.set(p.id, { id: p.id, code: p.code, name: p.name, gen: W.generationOf(W.genomeOf(p.code)), alive: false, parents: [], x: 0, y: 0 });
  // A child always sits below its parents, whatever its genome says.
  const all = [...nodes.values()];
  for (let pass = 0; pass < 6; pass++)
    for (const n of all) for (const p of n.parents) {
      const pn = nodes.get(p.id);
      if (pn && n.gen <= pn.gen) n.gen = pn.gen + 1;
    }
  const gens = [...new Set(all.map((n) => n.gen))].sort((a, b) => a - b);
  const rows = gens.map((g) => all.filter((n) => n.gen === g));
  // Order: founders by id, then each row by the average x of its parents so lines stay short.
  const idNum = (id: string) => Number(id.replace(/\D/g, '')) || 0;
  rows.forEach((row, ri) => {
    if (ri === 0) row.sort((a, b) => idNum(a.id) - idNum(b.id));
    else {
      const bary = (n: Node) => {
        const xs = n.parents.map((p) => nodes.get(p.id)?.x).filter((x): x is number => x !== undefined);
        return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1e6 + idNum(n.id);
      };
      row.sort((a, b) => bary(a) - bary(b));
    }
    row.forEach((n, i) => {
      n.x = i * (CARD_W + GAP_X);
      n.y = ri * (CARD_H + GAP_Y);
    });
  });
  const width = Math.max(...rows.map((r) => r.length)) * (CARD_W + GAP_X) - GAP_X;
  // Centre each row under the widest.
  for (const row of rows) {
    const w = row.length * (CARD_W + GAP_X) - GAP_X;
    for (const n of row) n.x += (width - w) / 2;
  }
  return { nodes, rows, gens, width, height: rows.length * (CARD_H + GAP_Y) - GAP_Y };
}

function Chromosomes({ code }: { code: string }) {
  const [a, b] = W.allelesOf(code);
  return (
    <span class="chromo" aria-label={`alleles ${labelOf(a)} and ${labelOf(b)}`}>
      <i style={{ background: alleleColor(a) }} />
      <i style={{ background: alleleColor(b) }} />
    </span>
  );
}

function FamilyTree() {
  const s = game.value;
  const { nodes, rows, gens, width, height } = build(s);
  if (!nodes.size) return <p class="empty">No fish aboard yet.</p>;
  const edges: { d: string; color: string; key: string; ghost: boolean }[] = [];
  for (const n of nodes.values()) {
    if (n.parents.length !== 2) continue;
    const [pa, pb] = n.parents;
    const got = inherited(n.code, pa.code, pb.code);
    [pa, pb].forEach((p, i) => {
      const pn = nodes.get(p.id);
      if (!pn) return;
      const x1 = pn.x + CARD_W / 2 + (i ? 6 : -6);
      const y1 = pn.y + CARD_H;
      const x2 = n.x + CARD_W / 2 + (i ? 5 : -5);
      const y2 = n.y;
      const my = (y1 + y2) / 2;
      edges.push({ key: `${p.id}>${n.id}`, d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`, color: alleleColor(got[i]), ghost: !pn.alive });
    });
  }
  const pad = 8;
  return (
    <div class="tree-scroll">
      <div class="tree" style={{ width: `${width + pad * 2}px`, height: `${height + pad * 2}px` }}>
        <svg class="tree-lines" width={width + pad * 2} height={height + pad * 2} aria-hidden="true">
          <g transform={`translate(${pad},${pad})`}>
            {edges.map((e) => (
              <g key={e.key}>
                <path d={e.d} stroke="var(--void)" stroke-width="6" fill="none" />
                <path d={e.d} stroke={e.color} stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray={e.ghost ? '5 4' : undefined} />
              </g>
            ))}
          </g>
        </svg>
        {rows.map((row, ri) => (
          <span key={`g${ri}`} class="gen-tag" style={{ top: `${pad + ri * (CARD_H + GAP_Y) - 2}px` }}>
            Gen {gens[ri]}
          </span>
        ))}
        {[...nodes.values()].map((n) => {
          const g = W.genomeOf(n.code);
          return (
            <button
              key={n.id}
              type="button"
              class={`tree-card r-${g.rarity} ${n.alive ? '' : 'ghost'}`}
              style={{ left: `${pad + n.x}px`, top: `${pad + n.y}px`, width: `${CARD_W}px`, height: `${CARD_H}px` }}
              disabled={!n.alive}
              onClick={() => n.alive && selectFish(n.id)}
              aria-label={`${n.name}${n.alive ? '' : ', no longer aboard'}, generation ${n.gen}`}
            >
              <span class="spr">
                <SpriteArt family="fish3" code={n.code} anim="swim" />
              </span>
              <span class="nm">
                {g.sex === 'f' ? '♀' : '♂'} {n.name}
              </span>
              <Chromosomes code={n.code} />
              <span class="tag">{n.alive ? (n.parents.length ? (s.tanks.find((t) => t.id === n.tank)?.name ?? '') : ORIGIN[n.origin ?? 'roe']) : 'departed'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GenePool() {
  const s = game.value;
  const fish = s.fish;
  if (!fish.length) return <p class="empty">No fish aboard yet.</p>;
  const counts = new Map<string, { copies: number; show: number; carry: number }>();
  for (const f of fish) {
    const [a, b] = W.allelesOf(f.code);
    const visible = shows(a, b);
    for (const al of new Set([a, b])) {
      const c = counts.get(al) ?? { copies: 0, show: 0, carry: 0 };
      if (visible.includes(al) || al === 'wild') c.show++;
      else c.carry++;
      counts.set(al, c);
    }
    for (const al of [a, b]) counts.get(al)!.copies++;
  }
  const list = [...counts.entries()].sort((x, y) => y[1].copies - x[1].copies);
  // Barcode: fish sorted by their rarest-looking allele so colours cluster.
  const order = [...fish].sort((x, y) => {
    const k = (f: W.Fish) => W.allelesOf(f.code).filter((a) => a !== 'wild').sort().join() || '~';
    return k(x).localeCompare(k(y));
  });
  const bred = fish.filter((f) => f.parents?.length).length;
  const deepest = Math.max(0, ...fish.map((f) => W.generationOf(W.genomeOf(f.code))));
  const variety = list.filter(([a]) => a !== 'wild').length;
  return (
    <div class="stack">
      <div class="stat-row">
        <Stat value={fish.length} label="fish aboard" />
        <Stat value={bred} label="bred here" tone="lilac" />
        <Stat value={`G${deepest}`} label="deepest line" tone="gold" />
        <Stat value={variety} label="alleles kept" tone="bloom" />
      </div>
      <div class="barcode" role="img" aria-label={`Every fish's two alleles, ${fish.length} fish`}>
        {order.map((f) => {
          const [a, b] = W.allelesOf(f.code);
          return (
            <button key={f.id} type="button" title={`${W.fishName(f)}: ${labelOf(a)} / ${labelOf(b)}`} onClick={() => selectFish(f.id)}>
              <i style={{ background: alleleColor(a) }} />
              <i style={{ background: alleleColor(b) }} />
            </button>
          );
        })}
      </div>
      <div class="pool">
        {list.map(([a, c]) => (
          <div key={a} class="pool-row">
            <span class="sw" style={{ background: alleleColor(a) }} />
            <span class="lbl">
              <b>{labelOf(a)}</b> <small>{a === 'wild' ? 'baseline' : modeOf(a)}</small>
            </span>
            <span class="pool-bar" aria-hidden="true">
              <i class="show" style={{ width: `${(c.show / fish.length) * 100}%`, background: alleleColor(a) }} />
              <i class="carry" style={{ width: `${(c.carry / fish.length) * 100}%`, color: alleleColor(a) }} />
            </span>
            <span class="num">
              {c.show ? `${c.show} show` : ''}
              {c.show && c.carry ? ' · ' : ''}
              {c.carry ? `${c.carry} carry` : ''}
            </span>
          </div>
        ))}
      </div>
      <p class="note">Solid bars show the fish wearing a trait. Striped bars show hidden carriers. Pair two carriers of a recessive allele and about a quarter of their eggs will show it.</p>
    </div>
  );
}

export function Heritage() {
  const [mode, setMode] = useState<'tree' | 'pool'>('tree');
  return (
    <div class="stack">
      <Heading
        title={mode === 'tree' ? 'Family tree' : 'Gene pool'}
        emoji={mode === 'tree' ? '🌳🐟🧬' : '🧬🌈🧪'}
        action={
          <div class="seg" role="group" aria-label="Heritage view">
            <button aria-pressed={mode === 'tree'} onClick={() => setMode('tree')}>
              Tree
            </button>
            <button aria-pressed={mode === 'pool'} onClick={() => setMode('pool')}>
              Pool
            </button>
          </div>
        }
      />
      {mode === 'tree' ? (
        <>
          <p class="note">Each line takes the colour of the allele that parent passed down. Dashed lines lead to fish that have left the station.</p>
          <FamilyTree />
        </>
      ) : (
        <GenePool />
      )}
    </div>
  );
}

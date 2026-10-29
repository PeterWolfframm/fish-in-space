// Fish-der: fresh procgen fish, one profile at a time. Nothing here comes from the tanks: every card
// is a fish4 ecotype roll from a random seed, so the swipes describe the generator, not your breeding.
// Swipes are the only thing the pixelgen net learns from (store/tinder.ts, server/trainer.mjs).
//
// The profile is read off the genome: name, an "age" from the life stage, how far below the station
// it would live, a bio in its own voice, interests from its ecology, and its care edict as
// dealbreakers. The full dossier (factsOf) is the same genome laid out section by section.

import { hash01 } from '@forge/pixel/rng.js';
import { WORDS } from '@forge/v3/fish/ecology-data.js';
import { fish, genomeOf, codeOf, ecoOf, withStage, cap, signatureLabel } from './fish';
import type { Stage } from './types';

export const TINDER_KIND = 'fish4';
export const TINDER_MODE = 'fishtinder';

export type Verdict = 'approve' | 'pass';
export interface Card {
  seed: string;
  code: string;
}
export interface TinderSwipe {
  id: string;
  code: string;
  seed: string;
  verdict: Verdict;
  superlike?: boolean;
  matched?: boolean;
  at: number;
  /** The PocketBase record, once uploaded. */
  remote?: string;
  /** The net's score for this card when it was swiped, 0..1. */
  score?: number | null;
  /** Notes from the feedback sheet, stored with the swipe. */
  feedback?: Feedback;
}

export const RANKS = ['S', 'A', 'B', 'C', 'D'] as const;
export type Rank = (typeof RANKS)[number] | 'pool';
export type Tiers = Record<Rank, string[]>;
export const emptyTiers = (): Tiers => ({ S: [], A: [], B: [], C: [], D: [], pool: [] });

/** A card for a seed: the fish4 roll as the generator makes it, nothing else. */
export function roll(seed: string): Card {
  return { seed, code: codeOf(fish.fromSeed(seed)) };
}

export const randomSeed = () => Math.random().toString(36).slice(2, 9);

// ---------- profile ----------

const pick = <T>(list: T[], code: string, salt: number) => list[Math.floor(hash01(code, salt) * list.length) % list.length];

const AGES: Record<string, [number, number]> = { fry: [1, 1], juvenile: [2, 4], adult: [5, 11], elder: [12, 31] };
const DEPTH: Record<string, string> = { shallows: 'the shallows', reef: 'a reef', open: 'open water', twilight: 'the twilight zone', abyss: 'the abyss' };
const KM: Record<string, [number, number]> = { shallows: [2, 9], reef: [3, 14], open: [8, 40], twilight: [20, 90], abyss: [60, 400] };

const TEMPER: Record<string, string[]> = {
  peaceful: ['Chill. Will share a cave.', 'Gentle fins, gentle soul.', 'Peaceful. My last ex was a sponge.'],
  territorial: ['I need my space. About one square metre of it.', 'This rock is mine. You can visit.', 'Territorial, but in a cute way.'],
  aggressive: ['Looking for someone who can handle me.', 'I bite. Affectionately. Mostly.', 'Not for the faint of fin.'],
  skittish: ['Shy at first. Then still shy.', 'Will hide behind a plant on date one.', 'Please approach slowly.'],
  apex: ['Top of the food chain, bottom of my inbox.', 'I could eat you. I would rather date you.', 'Apex predator, soft heart.'],
};
const SOCIAL: Record<string, string> = {
  solitary: 'Something casual',
  pair: 'A long-term current',
  school: 'New friends (I bring six)',
  warband: 'A crew to raid with',
};
const ACTIVE: Record<string, string> = {
  diurnal: 'Morning fish.',
  nocturnal: 'Night owl. Night fish.',
  crepuscular: 'Dusk dates only.',
  sleepless: 'I do not sleep. Ask me anything at 3 a.m.',
};
const DIET: Record<string, string> = {
  planktivore: 'Plankton tasting menus',
  herbivore: 'Plant-based',
  omnivore: 'Not picky',
  detritivore: 'Will eat what you drop',
  piscivore: 'Sushi (do not ask)',
  carnivore: 'Steak, but small',
  durophage: 'Crunchy snacks (shells)',
};
const DATE = [
  (d: string) => `A slow drift through ${d}.`,
  (d: string) => `Racing bubbles in ${d}, loser cleans the gravel.`,
  (d: string) => `Moonlight over ${d}. Well, planet-light.`,
  (d: string) => `Showing you my favourite rock in ${d}.`,
];
const PROMPTS = ['My ideal date', 'Green flag', 'I geek out on', 'Two truths and a lie'];

export interface Profile {
  name: string;
  binomial: string;
  title: string | null;
  signature: string;
  age: number;
  stage: string;
  sex: 'm' | 'f';
  rarity: string;
  distance: string;
  bio: string;
  lookingFor: string;
  prompt: { q: string; a: string };
  interests: string[];
  dealbreakers: string;
  codex: string[];
}

const profiles = new Map<string, Profile>();

export function profileOf(code: string): Profile {
  const hit = profiles.get(code);
  if (hit) return hit;
  const g = genomeOf(code);
  const n = fish.names(g);
  const e = fish.ecology(g);
  const v = (k: 'diet' | 'feeding' | 'level' | 'temperament' | 'sociality' | 'activity' | 'depth' | 'salinity' | 'temp' | 'current' | 'hardness') => e[k].value;
  const lore = fish.lore(g) as { codex?: { text: string }[]; edict?: { text: string } | null };
  const [a0, a1] = AGES[g.stage] ?? [3, 9];
  const [k0, k1] = KM[v('depth')] ?? [5, 30];
  const where = DEPTH[v('depth')] ?? 'the sea';
  const sig = signatureLabel(code);
  const qi = Math.floor(hash01(code, 5) * PROMPTS.length);
  const answers = [
    pick(DATE, code, 6)(where),
    `${v('temperament') === 'peaceful' ? 'Never once bit a tank mate.' : 'Honest about my teeth.'}`,
    `${e.care.tempC[0]}–${e.care.tempC[1]} °C water. Get it right and I am yours.`,
    `I live in ${where}. I am ${(e.care as { cm?: number }).cm ?? 10} cm long. I have never seen a cat.`,
  ];
  const interests = [
    DIET[v('diet')],
    ({ fresh: 'Fresh water', marine: 'Salt life', brackish: 'Estuaries', any: 'Any water, really' } as Record<string, string>)[v('salinity')],
    ({ cold: 'Cold plunges', temperate: 'Mild weather', tropical: 'Tropical heat', volcanic: 'Hot vents' } as Record<string, string>)[v('temp')],
    ({ still: 'Still water', gentle: 'Gentle currents', strong: 'Strong currents', torrent: 'White water' } as Record<string, string>)[v('current')],
    ({ top: 'Surface life', mid: 'Midwater', bottom: 'Bottom dwelling', above: 'Jumping out' } as Record<string, string>)[v('level')],
    g.geneA !== 'wild' || g.geneB !== 'wild' ? 'Rare genes' : '',
  ].filter((x): x is string => !!x);
  const p: Profile = {
    name: n.common ?? fish.name(g),
    binomial: n.binomial ?? '',
    title: n.title ?? null,
    signature: sig,
    age: a0 + Math.floor(hash01(code, 3) * (a1 - a0 + 1)),
    stage: g.stage,
    sex: g.sex,
    rarity: g.rarity,
    distance: `${k0 + Math.floor(hash01(code, 4) * (k1 - k0))} km below · ${where}`,
    bio: [pick(TEMPER[v('temperament')] ?? ['Just a fish.'], code, 1), ACTIVE[v('activity')] ?? ''].filter(Boolean).join(' '),
    lookingFor: SOCIAL[v('sociality')] ?? 'Whatever floats',
    prompt: { q: PROMPTS[qi], a: answers[qi] },
    interests,
    dealbreakers: lore.edict?.text ?? '',
    codex: (lore.codex ?? []).map((c) => c.text),
  };
  if (profiles.size > 400) profiles.clear();
  profiles.set(code, p);
  return p;
}

/** Whether the fish likes you back: seeded by its code; a super like always lands. */
export const likesBack = (code: string, superlike = false) => superlike || hash01(code, 77) < 0.45;

// ---------- photos ----------

export interface Shot {
  code: string;
  anim: string;
  /** A caption under the shot, for the stage pairs. */
  caption?: string;
}
export interface Photo {
  label: string;
  shots: Shot[];
}

const STAGES: Stage[] = ['fry', 'juvenile', 'adult', 'elder'];

/**
 * The "photos" of a profile, one per pip: the fish as rolled, then its life stages two at a time,
 * then every animation it has.
 */
export function photosOf(code: string): Photo[] {
  const pairs: Photo[] = [];
  for (let i = 0; i < STAGES.length; i += 2) {
    const two = STAGES.slice(i, i + 2);
    pairs.push({ label: two.join(' · '), shots: two.map((st) => ({ code: withStage(code, st), anim: 'swim', caption: st })) });
  }
  const anims = fish.anims.map((a) => ({ label: a.id, shots: [{ code, anim: a.id }] }));
  return [{ label: 'profile', shots: [{ code, anim: 'swim' }] }, ...pairs, ...anims];
}

// ---------- the full dossier ----------

export interface FactSection {
  title: string;
  rows: [string, string][];
}

const word = (k: string, v: string) => (WORDS as Record<string, Record<string, string>>)[k]?.[v] ?? v;
const choice = (field: string, id: string) => fish.traits.fieldById(field)?.choices.find((c) => c.id === id)?.label ?? id;

const facts = new Map<string, FactSection[]>();

/** Everything the generator knows about a fish, in labelled sections; empty rows are left out. */
export function factsOf(code: string): FactSection[] {
  const hit = facts.get(code);
  if (hit) return hit;
  const g = genomeOf(code);
  const p = profileOf(code);
  const e = fish.ecology(g) as unknown as Record<string, { value: string }> & {
    care: { cm: number; group: number; litres: number; tempC: [number, number]; pH: [number, number] };
  };
  const v = (k: string) => e[k]?.value ?? '';
  const w = (k: string) => cap(word(k, v(k)));
  const c = e.care;
  const genes = [g.geneA, g.geneB].filter((a) => a !== 'wild');
  const out: FactSection[] = [
    {
      title: 'Identity',
      rows: [
        ['Species', p.binomial],
        ['Title', p.title ?? ''],
        ['Life stage', `${cap(p.stage)}, ${p.age}`],
        ['Sex', p.sex === 'f' ? 'Female' : 'Male'],
        ['Rarity', cap(p.rarity)],
        ['Signature', p.signature],
        ['Generation', String(g.generation ?? '')],
      ],
    },
    {
      title: 'Lifestyle',
      rows: [
        ['Diet', w('diet')],
        ['Feeding', w('feeding')],
        ['Swims', w('level')],
        ['Active', w('activity')],
        ['Social', w('sociality')],
        ['Temperament', w('temperament')],
      ],
    },
    {
      title: 'Habitat',
      rows: [
        ['Water', w('salinity')],
        ['Temperature', `${w('temp')}, ${c.tempC[0]}–${c.tempC[1]} °C`],
        ['pH', `${c.pH[0]}–${c.pH[1]}`],
        ['Hardness', w('hardness')],
        ['Current', w('current')],
        ['Depth', w('depth')],
      ],
    },
    {
      title: 'Care',
      rows: [
        ['Grows to', `${c.cm} cm`],
        ['Tank', `${c.litres} L`],
        ['Keep', c.group > 1 ? `${c.group} together` : 'alone'],
      ],
    },
    {
      title: 'Genes',
      rows: [
        ['Body', cap(choice('body', g.body))],
        ['Hybrid', g.hybrid && g.hybrid !== 'none' ? cap(choice('hybrid', g.hybrid)) : ''],
        ['Alleles', genes.length ? genes.join(' / ') : 'wild / wild'],
        ['Expressed', (fish as unknown as { describe(genome: typeof g): string }).describe(g)],
      ],
    },
  ];
  for (const s of out) s.rows = s.rows.filter(([, x]) => !!x);
  if (facts.size > 400) facts.clear();
  facts.set(code, out);
  return out;
}

// ---------- feedback ----------

export const CANNED_NOTES = ['Love it', 'Too busy', 'Colors off', 'Looks broken', 'Not this kind', 'Needs more contrast'] as const;

export const AS_KINDS = [
  { id: 'plant', label: 'plant' },
  { id: 'waterplant', label: 'waterplant' },
  { id: 'pilot', label: 'pilot' },
] as const;

export interface Feedback {
  canned: string[];
  note: string;
  fix: string[];
  instead: Record<string, string>;
  asKind: string;
}

export const emptyFeedback = (): Feedback => ({ canned: [], note: '', fix: [], instead: {}, asKind: '' });

/** How many things the sheet is holding, for the ✎ badge. */
export function feedbackCount(f: Feedback): number {
  return f.fix.length + f.canned.length + (f.asKind ? 1 : 0) + (f.note.trim() ? 1 : 0);
}

/** Canned takes and free text, joined the way the PixelForge swiper stores a note. */
export function feedbackNote(f: Feedback): string {
  return [f.canned.join(', '), f.note.trim()].filter(Boolean).join(' — ');
}

export interface TraitChoice {
  id: string;
  label: string;
}
export interface TraitField {
  id: string;
  label: string;
  choices: TraitChoice[];
}
export interface TraitGroup {
  group: string;
  fields: TraitField[];
}

let groups: TraitGroup[] | null = null;

/** Fish4 traits, in their groups, for the feedback chips. */
export function traitGroups(): TraitGroup[] {
  if (groups) return groups;
  const fields = fish.traits.fields;
  const map = new Map<string, TraitField[]>();
  for (const f of fields) {
    const group = f.group ?? 'traits';
    const list = map.get(group) ?? [];
    list.push({
      id: f.id,
      label: f.label ?? f.id,
      choices: f.choices.map((c) => ({ id: c.id, label: c.label ?? c.id })),
    });
    map.set(group, list);
  }
  groups = [...map].map(([group, list]) => ({ group, fields: list }));
  return groups;
}

export const fieldValue = (code: string, id: string) => String(genomeOf(code)[id] ?? '');

/** The fish with the feedback sheet's "instead" picks applied. Empty picks leave the code alone. */
export function withInstead(code: string, instead: Record<string, string>): string {
  const picks = Object.fromEntries(Object.entries(instead).filter(([, v]) => v));
  if (!Object.keys(picks).length) return code;
  return codeOf({ ...genomeOf(code), ...picks });
}

export interface CloudSwipe {
  note?: string | null;
  fix?: unknown;
  instead?: unknown;
  asKind?: string | null;
  scores?: unknown;
}

/** PocketBase swipe fields back into a super like and a feedback draft. A note of exactly "super like" is the old flag. */
export function readCloudSwipe(rec: CloudSwipe): { superlike: boolean; feedback?: Feedback; score: number | null } {
  const scores = rec.scores && typeof rec.scores === 'object' ? (rec.scores as { personal?: number | null; superlike?: boolean }) : {};
  const note = String(rec.note ?? '');
  const legacy = note === 'super like';
  const superlike = scores.superlike === true || legacy;
  const fix = Array.isArray(rec.fix) ? rec.fix.filter((x): x is string => typeof x === 'string') : [];
  const instead: Record<string, string> = {};
  if (rec.instead && typeof rec.instead === 'object' && !Array.isArray(rec.instead)) {
    for (const [k, v] of Object.entries(rec.instead as Record<string, unknown>)) if (typeof v === 'string' && v) instead[k] = v;
  }
  const asKind = typeof rec.asKind === 'string' ? rec.asKind : '';
  const text = legacy ? '' : note;
  const feedback = text || fix.length || asKind || Object.keys(instead).length ? { canned: [] as string[], note: text, fix, instead, asKind } : undefined;
  const score = typeof scores.personal === 'number' ? scores.personal : null;
  return { superlike, feedback, score };
}

// ---------- what you go for ----------

export interface Preference {
  trait: string;
  rows: { value: string; likes: number; total: number }[];
}

/** The traits a swipe is judged on in the stats, with how each is read off a code. */
const TRAITS: [string, (code: string) => string][] = [
  ['Diet', (c) => ecoOf(c).diet],
  ['Temperament', (c) => ecoOf(c).temperament],
  ['Depth', (c) => ecoOf(c).depth],
  ['Water', (c) => ecoOf(c).salinity],
  ['Climate', (c) => ecoOf(c).temp],
  ['Social', (c) => ecoOf(c).sociality],
  ['Active', (c) => ecoOf(c).activity],
  ['Swims', (c) => ecoOf(c).level],
  ['Body', (c) => choice('body', genomeOf(c).body)],
  ['Life stage', (c) => genomeOf(c).stage],
  ['Rarity', (c) => genomeOf(c).rarity],
  ['Sex', (c) => (genomeOf(c).sex === 'f' ? 'female' : 'male')],
];

/**
 * How often you like each value of each trait. A super like counts twice, as it does for the taste
 * net. Values seen fewer than `min` times are left out; rows run from most to least liked.
 */
export function preferences(swipes: TinderSwipe[], min = 2): Preference[] {
  return TRAITS.map(([trait, read]) => {
    const tally = new Map<string, { likes: number; total: number }>();
    for (const s of swipes) {
      const n = s.superlike ? 2 : 1;
      const k = read(s.code);
      const t = tally.get(k) ?? { likes: 0, total: 0 };
      t.total += n;
      if (s.verdict === 'approve') t.likes += n;
      tally.set(k, t);
    }
    const rows = [...tally]
      .filter(([, t]) => t.total >= min)
      .map(([value, t]) => ({ value, ...t }))
      .sort((a, b) => b.likes / b.total - a.likes / a.total || b.total - a.total);
    return { trait, rows };
  }).filter((p) => p.rows.length > 0);
}

// ---------- tiers ----------

/** Liked fish keep their place; new likes pour into the pool (super likes start at S); unliked go. */
export function syncTiers(t: Tiers, swipes: TinderSwipe[]): Tiers {
  const liked = swipes.filter((s) => s.verdict === 'approve');
  const keep = new Set(liked.map((s) => s.code));
  const next = emptyTiers();
  const seen = new Set<string>();
  for (const r of [...RANKS, 'pool'] as Rank[]) {
    for (const c of t[r] ?? []) {
      if (!keep.has(c) || seen.has(c)) continue;
      seen.add(c);
      next[r].push(c);
    }
  }
  for (const s of liked) {
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    if (s.superlike) next.S.push(s.code);
    else next.pool.unshift(s.code);
  }
  return next;
}

/** Move a fish to `rank`, in front of `before` if given and in that row. */
export function moveTier(t: Tiers, code: string, rank: Rank, before?: string | null): Tiers {
  const next = emptyTiers();
  let found = false;
  for (const r of Object.keys(next) as Rank[]) {
    next[r] = (t[r] ?? []).filter((c) => {
      if (c !== code) return true;
      found = true;
      return false;
    });
  }
  if (!found) return t;
  const row = next[rank];
  const at = before && before !== code ? row.indexOf(before) : -1;
  if (at >= 0) row.splice(at, 0, code);
  else row.push(code);
  return next;
}

export const rankOf = (t: Tiers, code: string): Rank | null => ((Object.keys(t) as Rank[]).find((r) => t[r].includes(code)) ?? null);

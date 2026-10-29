// Plain-data comms entries. Easy to write, easy to translate.

export type Who = 'prof' | 'pip' | 'teo' | 'dot' | 'cook' | 'sel' | 'you';

export interface CommsPanel {
  who: Who;
  mood?: string; // pilot2 anim: talk, grin, alarm, calm, blink
  text: string;
  side?: 'left' | 'right';
}

export interface CommsChoice {
  label: string;
  next?: string; // another entry id to play after
  reply?: CommsPanel; // a line that colours the answer
  credits?: number; // a tiny reward
}

export interface CommsEntry {
  id: string;
  tags: string[]; // lore, planet, fish, galley, kid, story, reaction, onboard, work
  when?: { minPhase?: number; maxPhase?: number; biome?: string };
  weight?: number;
  panels: CommsPanel[];
  choices?: CommsChoice[];
}

export const CAST: Record<Who, { name: string; color: string; seed: string }> = {
  prof: { name: 'PROF', color: '#ffb86b', seed: 'wren-halloway' },
  pip: { name: 'PIP', color: '#3fc6c9', seed: 'pip' },
  teo: { name: 'MARSHAL TEO', color: '#9fb4ff', seed: 'teo-banerjee-voss' },
  dot: { name: 'DOT', color: '#ff7aa8', seed: 'dot-okafor' },
  cook: { name: 'COOK', color: '#f6d365', seed: 'cook-ahiga' },
  sel: { name: 'SEL', color: '#b9a5ff', seed: 'archivist-sel' },
  you: { name: 'YOU', color: '#c9d4e8', seed: 'you' }, // the player: a pale silhouette, drawn by hand
};

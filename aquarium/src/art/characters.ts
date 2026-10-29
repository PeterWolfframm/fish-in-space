// CharacterArt: the cast's faces. Backed by the pilot2 generator's portrait framing for now.
// WILL BE REPLACED by a dedicated character generator; only this file needs to change.

import { load, sheet, type Sheet } from './atlas';
import { CAST, type Who } from '../content/comms/types';

const FIGURE: Record<Who, string> = { prof: 'tutor', pip: 'scope', teo: 'boss', dot: 'pilot', cook: 'pilot', sel: 'tutor', you: 'pilot' };
const MOODS = ['idle', 'talk', 'blink', 'grin', 'alarm', 'calm'];

export const codeOf = (id: Who) => `${CAST[id].seed}|${FIGURE[id]}`;
const moodOf = (m?: string) => (m && MOODS.includes(m) ? m : 'idle');

export const CharacterArt = {
  /** The portrait sheet for a cast member in a mood, or null while it bakes. PIP is drawn by hand. */
  get(id: Who, mood?: string): Sheet | null {
    if (id === 'pip' || id === 'you') return null;
    return sheet('pilot2', codeOf(id), moodOf(mood));
  },
  load(id: Who, mood?: string): Promise<Sheet | null> {
    if (id === 'pip' || id === 'you') return Promise.resolve(null);
    return load('pilot2', codeOf(id), moodOf(mood));
  },
  preload() {
    for (const id of Object.keys(CAST) as Who[]) if (id !== 'pip' && id !== 'you') for (const m of ['idle', 'talk']) void CharacterArt.load(id, m);
  },
};

/** PIP: a bespoke 16×16 drone. Two frames: hover up, hover down; eye colour by mood. */
const PIP_ROWS = [
  '................',
  '.......cc.......',
  '.......cc.......',
  '....hhhhhhhh....',
  '...hHHHHHHHHh...',
  '..hHHddddddHHh..',
  '..hHdeeEEeedHh..',
  '..hHdeEEEEedHh..',
  '..hHdeeEEeedHh..',
  '..hHHddddddHHh..',
  '...hHHHHHHHHh...',
  '....hhhhhhhh....',
  '..ll..l..l..ll..',
  '.......tt.......',
  '......t..t......',
  '................',
];
export function drawPip(c: HTMLCanvasElement, frame: number, mood = 'calm', scale = 3) {
  const eye = mood === 'alarm' ? '#ff7aa8' : mood === 'grin' ? '#9be37a' : '#3fc6c9';
  const pal: Record<string, string> = { c: '#ffb86b', h: '#1b2140', H: '#c9cfe6', d: '#2c3563', e: '#0b0e1f', E: eye, l: '#7d8aa0', t: frame % 2 ? '#ffb86b' : '#ff7aa8' };
  c.width = 16 * scale;
  c.height = 16 * scale;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  const bob = frame % 2;
  PIP_ROWS.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const k = row[x];
      if (k === '.') continue;
      g.fillStyle = pal[k];
      g.fillRect(x * scale, (y + bob - 0) * scale, scale, scale);
    }
  });
}

/** You: a pale head-and-shoulders silhouette with a faint visor glint. Nobody, yet. Frame 1 is a blink. */
const YOU_ROWS = [
  '................',
  '................',
  '......hhhh......',
  '.....hHHHHh.....',
  '....hHHHHHHh....',
  '....hHeHHeHh....',
  '....hHHHHHHh....',
  '....hHHHHHHh....',
  '.....hHHHHh.....',
  '......hHHh......',
  '...hhhhHHhhhh...',
  '..hHHHHHHHHHHh..',
  '.hHHHHHHHHHHHHh.',
  '.hHHHHHsHHHHHHh.',
  '.hHHHHHsHHHHHHh.',
  '.hHHHHHHHHHHHHh.',
];
export function drawYou(c: HTMLCanvasElement, frame: number, mood = 'idle', scale = 4) {
  const blink = mood === 'blink' || frame % 7 === 6;
  const pal: Record<string, string> = { h: '#5d6a86', H: '#c9d4e8', e: blink ? '#c9d4e8' : '#3b4560', s: '#9aa8c4' };
  c.width = 16 * scale;
  c.height = 16 * scale;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  YOU_ROWS.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const k = row[x];
      if (k === '.') continue;
      g.fillStyle = pal[k];
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  });
}

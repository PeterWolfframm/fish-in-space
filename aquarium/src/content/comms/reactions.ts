// One-liners for notable moments. Keyed by trigger; one is picked at random.
import type { CommsPanel } from './types';

export type Trigger = 'rare-hatch' | 'perfect' | 'big-sale' | 'elder' | 'clean-drop' | 'restock' | 'named' | 'vote' | 'new-allele' | 'tank-full';

export const REACTIONS: Record<Trigger, CommsPanel[]> = {
  'rare-hatch': [
    { who: 'prof', mood: 'alarm', text: 'Is that a RARE one? Don’t move. Nobody move. I’m getting my notebook.' },
    { who: 'sel', mood: 'talk', text: 'Rarity class confirmed. I have not seen one of those since catalogue drawer 88.' },
  ],
  perfect: [
    { who: 'teo', mood: 'grin', text: 'Every box ticked. I am filing this under “show-offs”. Approvingly.', side: 'right' },
    { who: 'prof', mood: 'grin', text: 'A perfect fit! The region will love it. I might frame the request.' },
  ],
  'big-sale': [
    { who: 'cook', mood: 'grin', text: 'Big sale! Dinner’s on you. Kidding. Dinner’s on me. It’s always on me.' },
    { who: 'sel', mood: 'calm', text: 'That trade will appear in my ledger with a small star next to it.' },
  ],
  elder: [
    { who: 'prof', mood: 'calm', text: 'One of yours is getting old. Elder fish are wise. Or at least slower. Same thing, at my age.' },
  ],
  'clean-drop': [
    { who: 'pip', mood: 'grin', text: 'Clean drop! Trajectory error: 0.0%. I would like that on my file.' },
    { who: 'pip', mood: 'calm', text: 'Clean drop. Window used. PIP is satisfied.' },
  ],
  restock: [
    { who: 'sel', mood: 'talk', text: 'Restocked. Six drawers, thawed and labelled. The labels are very neat.' },
  ],
  named: [
    { who: 'prof', mood: 'grin', text: 'The votes are in! That place has a name now. A name! We named a place!' },
  ],
  vote: [
    { who: 'dot', mood: 'grin', text: 'I voted too! Mine was the funniest one. Obviously.', side: 'right' },
  ],
  'new-allele': [
    { who: 'prof', mood: 'alarm', text: 'A new allele in the tank! Field Notes, page… let’s say forty. Writing it down.' },
  ],
  'tank-full': [
    { who: 'pip', mood: 'alarm', text: 'Tank at capacity. Suggest: seed, sell, or buy a bigger tank. PIP does not fit in the tank.' },
  ],
};

// "How humanity got here": the five lore entries from the plan, verbatim.
import type { CommsEntry } from './types';

export const LORE: CommsEntry[] = [
  {
    id: 'lore-long-quiet', tags: ['lore'], when: { minPhase: 0 }, weight: 2,
    panels: [
      { who: 'prof', mood: 'talk', text: 'Fun fact. For two hundred years after the Ark ships left Earth, nobody talked to anybody. Ship to ship, I mean.' },
      { who: 'prof', mood: 'grin', text: 'Not out of rudeness! Light lag. You’d say “hello” and your grandkids got the reply.' },
      { who: 'prof', mood: 'talk', text: 'So every ship learned to fix its own problems. That’s why we’re all a little bit stubborn. And why the Minnow has eleven different kinds of duct tape.' },
      { who: 'pip', mood: 'calm', text: 'Correction: twelve.', side: 'right' },
      { who: 'prof', mood: 'blink', text: '…Twelve.' },
    ],
  },
  {
    id: 'lore-salt-memory', tags: ['lore', 'kid'], when: { minPhase: 1 }, weight: 2,
    panels: [
      { who: 'dot', mood: 'talk', text: 'Prof, why do people cry salty?', side: 'right' },
      { who: 'prof', mood: 'talk', text: 'Ooh. Because a long, long time ago, all our ancestors lived in the sea. We left, but we took a little sea with us. In our blood, in our tears.' },
      { who: 'prof', mood: 'calm', text: 'So when you seed Mirelle’s oceans, you’re kind of… giving the sea back.' },
      { who: 'dot', mood: 'grin', text: 'That’s beautiful. Also, can fish cry?', side: 'right' },
      { who: 'prof', mood: 'grin', text: 'Field Notes says “unclear.” I’m putting you down as co-author.' },
    ],
  },
  {
    id: 'lore-gardeners', tags: ['lore'], when: { minPhase: 2 }, weight: 2,
    panels: [
      { who: 'sel', mood: 'talk', text: 'Ark log 4471-B. Around year 300 of the voyage, a whole generation chose to train as gardeners instead of engineers.' },
      { who: 'sel', mood: 'calm', text: 'The engineers called them “the soft hands.” Then the hydroponics failed on the Juniper, and the soft hands kept nine thousand people fed for six years.' },
      { who: 'sel', mood: 'talk', text: 'Every terraforming school is still named after them. Including yours, Ichthyologist.' },
      { who: 'sel', mood: 'grin', text: 'Catalogue note: their seed bank is what the X-change sells from. You’re shopping in their pantry.' },
    ],
  },
  {
    id: 'lore-two-tall', tags: ['lore', 'galley'], when: { minPhase: 1 }, weight: 2,
    panels: [
      { who: 'cook', mood: 'talk', text: 'You notice the folks born on the colony ships are tall? Like, ceiling-tile tall?' },
      { who: 'cook', mood: 'talk', text: 'Low spin gravity, couple of generations. Bones get long. Meanwhile the people from the Ceres mines are short and strong as a cargo winch.' },
      { who: 'cook', mood: 'grin', text: 'Anyway, I make two sizes of soup bowl now. The Accord calls it “cultural accommodation.” I call it “my shoulder hurts.”' },
      { who: 'cook', mood: 'calm', text: 'Your fish eat better than both groups, by the way.' },
    ],
  },
  {
    id: 'lore-first-word', tags: ['lore', 'planet'], when: { minPhase: 3 }, weight: 2,
    panels: [
      { who: 'teo', mood: 'talk', text: 'Halloway. I just read the survey. The first word anybody said when they landed on Mirelle was… “squelch”?', side: 'right' },
      { who: 'prof', mood: 'grin', text: 'Ha! Yes. Ensign Paloma stepped right into the first algae mat. Our algae. Seeded from this very hatchery.' },
      { who: 'prof', mood: 'calm', text: 'Humanity’s been leaving footprints for three million years, Teo. That was the first one that went squelch on a planet we woke up ourselves.' },
      { who: 'teo', mood: 'calm', text: '…I’m putting it on the colony crest.', side: 'right' },
      { who: 'prof', mood: 'alarm', text: 'You absolutely are not.' },
      { who: 'teo', mood: 'grin', text: 'I absolutely am.', side: 'right' },
    ],
  },
];

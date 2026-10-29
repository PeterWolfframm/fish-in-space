// PIP's side of the conversation. The chat lives here (not in the panel) so it survives room
// changes, and the PIP scene reads `pipMood` to make the big face react.

import { signal } from '@preact/signals';
import * as W from '../game';
import { game } from './signals';
import { sfx } from '../audio/sfx';

export type Topic = 'advice' | 'news' | 'archive' | 'log' | 'stats' | 'settings';
export interface ChatMsg {
  key: number;
  from: 'pip' | 'you';
  text: string;
  topic?: Topic; // a folder or card set this reply opens
}

export const PHRASES: { topic: Topic; say: string }[] = [
  { topic: 'advice', say: 'What should I send where?' },
  { topic: 'news', say: 'Any news?' },
  { topic: 'archive', say: 'Open the archive.' },
  { topic: 'log', say: 'Show old calls.' },
  { topic: 'stats', say: 'How are we doing?' },
  { topic: 'settings', say: 'Settings, please.' },
];

const LINES: Record<Exclude<Topic, 'advice'>, string[]> = {
  news: [
    'Interchange bulletin, freshly scraped. PIP has read every word. Twice.',
    'News! PIP loves news. Here is the bulletin. PIP has highlighted the numbers.',
    'The bulletin. PIP predicts these prices will change. PIP is never wrong about that one.',
  ],
  archive: [
    'Opening the archive. Everything you have ever discovered, filed alphabetically. Approximately.',
    'Archive unlocked. PIP dusted it. There is no dust in space. PIP dusted anyway.',
  ],
  log: [
    'Call log, sorted by orbit. PIP remembers everything. That is not a threat.',
    'Here are the old calls. PIP has kept the transcripts and also the vibes.',
  ],
  stats: [
    'Station statistics. Big numbers are good. PIP made the numbers big.',
    'You are doing well. PIP checked. Here is the evidence.',
  ],
  settings: [
    'Settings. Please do not set PIP to off. That is not a setting. PIP checked.',
    'Station settings. Bigger text is a click away. PIP supports bigger everything.',
  ],
};
const ADVICE_YES = [
  'PIP has run the numbers. The numbers ran back. Recommendations:',
  'Calculating… done. PIP is very confident. Possibly too confident. Here:',
  'Excellent question. PIP has answers. Some of them are right:',
];
const ADVICE_NO = [
  'PIP has looked everywhere. Nothing fits anywhere. PIP is sad about it.',
  'Bad news, phrased kindly: nobody aboard can go anywhere useful right now.',
];
const CORRECTIONS = [
  'Correction: "sure" was a strong word. PIP has updated its beliefs.',
  'PIP has double-checked and is now 4% less confident. Still recommends it.',
  'Update: PIP misread one decimal. Not that one. A different one. It is fine.',
];
const HELLO = 'PIP online. Ask PIP anything. PIP knows six things, and they are below.';

let key = 0;
let said = 0;
const msg = (from: ChatMsg['from'], text: string, topic?: Topic): ChatMsg => ({ key: ++key, from, text, topic });

export const chat = signal<ChatMsg[]>([msg('pip', HELLO)]);
export const pipMood = signal<'calm' | 'talk' | 'grin' | 'alarm'>('calm');
export const pipThinking = signal(false);

let moodTimer: ReturnType<typeof setTimeout> | undefined;
function emote(m: typeof pipMood.value, ms = 2400) {
  pipMood.value = m;
  clearTimeout(moodTimer);
  moodTimer = setTimeout(() => (pipMood.value = 'calm'), ms);
}

const line = (list: string[]) => list[said++ % list.length];

/** You say a phrase; PIP thinks for a beat and answers, usually with a folder or cards attached. */
export function ask(topic: Topic) {
  if (pipThinking.value) return;
  const p = PHRASES.find((x) => x.topic === topic)!;
  chat.value = [...chat.value, msg('you', p.say)].slice(-40);
  pipThinking.value = true;
  emote('talk', 900);
  setTimeout(() => {
    pipThinking.value = false;
    sfx.blip();
    if (topic === 'advice') {
      const cards = W.advise(game.peek());
      const yes = cards[0]?.kind !== 'none';
      emote(yes ? 'grin' : 'alarm');
      const out = [msg('pip', line(yes ? ADVICE_YES : ADVICE_NO), 'advice')];
      if (yes && said % 3 === 0) out.push(msg('pip', line(CORRECTIONS)));
      chat.value = [...chat.value, ...out].slice(-40);
    } else {
      emote('talk');
      chat.value = [...chat.value, msg('pip', line(LINES[topic]), topic)].slice(-40);
    }
  }, 650);
}

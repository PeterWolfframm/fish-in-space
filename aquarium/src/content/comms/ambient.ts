// Ambient chatter: picked at most once every 3–6 minutes of active play.
import type { CommsEntry } from './types';

export const AMBIENT: CommsEntry[] = [
  { id: 'amb-cook-broth', tags: ['galley'], panels: [
    { who: 'cook', mood: 'talk', text: 'Today’s galley special: kelp broth. Not YOUR kelp. Relax. Hydroponics kelp.' },
    { who: 'cook', mood: 'grin', text: 'I saw that look.' },
  ] },
  { id: 'amb-cook-pellets', tags: ['galley', 'fish'], panels: [
    { who: 'cook', mood: 'talk', text: 'I’ve been plating your fish pellets. Little garnish. Nobody notices but I notice.' },
  ], choices: [
    { label: 'I noticed', reply: { who: 'cook', mood: 'grin', text: 'I KNEW it. You’re getting the good mug tomorrow.' } },
    { label: 'They’re pellets', reply: { who: 'cook', mood: 'calm', text: 'Everything is pellets if you don’t believe in it.' } },
  ] },
  { id: 'amb-pip-dust', tags: ['fish'], panels: [
    { who: 'pip', mood: 'calm', text: 'Cabin dust level: nominal. Tank water: clear. Mug on console: cold since 06:40.' },
  ] },
  { id: 'amb-pip-stars', tags: ['planet'], panels: [
    { who: 'pip', mood: 'calm', text: 'Night side. Visible stars: 4,211. Stars I have named: 3. Their names are Bob.' },
  ] },
  { id: 'amb-dot-names', tags: ['kid'], panels: [
    { who: 'dot', mood: 'talk', text: 'If I find a fish on the beach can I name it? My mum says only the Accord names things.', side: 'right' },
    { who: 'prof', mood: 'grin', text: 'Between you and me, Dot, the Accord is just a lot of people voting. You’re people.' },
  ] },
  { id: 'amb-dot-homework', tags: ['kid'], when: { minPhase: 1 }, panels: [
    { who: 'dot', mood: 'talk', text: 'I have to do a report on rivers. Is it okay if I say rivers are “lakes that are in a hurry”?', side: 'right' },
  ], choices: [
    { label: 'Perfect', reply: { who: 'dot', mood: 'grin', text: 'Okay I’m writing your name as a source.', side: 'right' }, credits: 2 },
    { label: 'Add some facts', reply: { who: 'dot', mood: 'calm', text: 'Fine. “Lakes that are in a hurry DOWNHILL.”', side: 'right' } },
  ] },
  { id: 'amb-teo-busy', tags: ['planet'], panels: [
    { who: 'teo', mood: 'calm', text: 'Accord liaison checking in. Sixty-one forms filed today. Zero of them about fish. A tragedy.', side: 'right' },
  ] },
  { id: 'amb-teo-photo', tags: ['fish'], when: { minPhase: 1 }, panels: [
    { who: 'teo', mood: 'talk', text: 'Halloway, can your ichthyologist send me a picture of the tank. For… official reasons.', side: 'right' },
    { who: 'prof', mood: 'grin', text: 'He wants a desktop background.' },
    { who: 'teo', mood: 'calm', text: 'Official reasons.', side: 'right' },
  ] },
  { id: 'amb-sel-catalogue', tags: ['lore'], panels: [
    { who: 'sel', mood: 'talk', text: 'Catalogue entry 0001 in the Ark Vault is not a fish. It is a jar of sourdough starter. Someone had priorities.' },
  ] },
  { id: 'amb-sel-earth', tags: ['lore'], when: { minPhase: 2 }, panels: [
    { who: 'sel', mood: 'calm', text: 'Old Earth trivia: a goldfish can tell music apart. Bach from Stravinsky. Ark records do not say which it preferred.' },
  ] },
  { id: 'amb-prof-pun', tags: ['fish'], panels: [
    { who: 'prof', mood: 'grin', text: 'Why are fish so smart? Because they live in schools. …PIP, log that as a joke.' },
    { who: 'pip', mood: 'calm', text: 'Logged as: attempt.', side: 'right' },
  ] },
  { id: 'amb-prof-proud', tags: ['planet'], when: { minPhase: 2 }, panels: [
    { who: 'prof', mood: 'calm', text: 'I looked at the survey this morning. There’s green where there wasn’t green. That’s you, you know.' },
  ] },
  { id: 'amb-planet-rain', tags: ['planet'], when: { minPhase: 1 }, panels: [
    { who: 'teo', mood: 'talk', text: 'First recorded rain over the northern lakes. The colonists ran outside and stood in it. Unprofessional. I also stood in it.', side: 'right' },
  ] },
  { id: 'amb-planet-glow', tags: ['planet'], when: { minPhase: 4 }, panels: [
    { who: 'pip', mood: 'alarm', text: 'Night-side trench luminance up 9%. Hypothesis: fish. Alternative hypothesis: also fish.' },
  ] },
  { id: 'amb-reef-color', tags: ['planet', 'fish'], when: { minPhase: 3 }, panels: [
    { who: 'dot', mood: 'grin', text: 'We went snorkelling at the coral bit! There was a PINK one. Was that one yours?', side: 'right' },
    { who: 'prof', mood: 'grin', text: 'Statistically? Probably!' },
  ] },
  { id: 'amb-cook-mango', tags: ['galley'], when: { minPhase: 2 }, panels: [
    { who: 'cook', mood: 'talk', text: 'Someone traded me a real mango from the dome farm. I cut it in front of the crew. There were tears.' },
  ] },
];

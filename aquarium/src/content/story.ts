// The mission: chapters (one per phase), Chapter 0 onboarding beats, and side work from the cast.
import type { Req } from '../game/types';
import type { CommsEntry } from './comms/types';

export interface Chapter {
  title: string;
  mission: string;
  bullets: string[]; // what changed and what to breed next
  patch: string; // mission patch name
}

export const CHAPTERS: Chapter[] = [
  { title: 'Wake-up Shift', patch: 'First Shift',
    mission: 'Keep five fish alive and send one to the lakes. That’s literally the whole job today.',
    bullets: ['The northern lakes are open: fresh, cold, empty.', 'Feed the tank, pair a male and a female.', 'Fill a request from the Bridge to drop your first pod.'] },
  { title: 'Moving Water', patch: 'Downhill',
    mission: 'The meltwater’s running downhill. Rivers want strong swimmers.',
    bullets: ['River regions are open: fresh and temperate.', 'Requests can ask for hatchery-bred fish now.', 'Fill a region to Life 100 to close its naming poll.'] },
  { title: 'Salt in the Wound', patch: 'Brackish',
    mission: 'Mirelle’s getting salty. Literally. We need fish that can handle both.',
    bullets: ['The delta is open: brackish and temperate.', 'The lakes have warmed to temperate.', 'Requests may want a specific allele. Breed for it.'] },
  { title: 'Coral Weather', patch: 'Reef Season',
    mission: 'Reef season! Colour is a feature, not a bug.',
    bullets: ['Reefs are open: marine and tropical.', 'Rivers and the delta are warming to tropical.', 'Heritage roe at the Interchange brings new genes in.'] },
  { title: 'Lanternfall', patch: 'Lanternfall',
    mission: 'Something down there is glowing back at us. I love this job.',
    bullets: ['The trench is open: marine, cold and deep.', 'Upwelling has chilled the delta to cold.', 'Twilight and abyss fish only; check depth in the dossier.'] },
  { title: 'Hand-off', patch: 'Living World',
    mission: 'You don’t need me anymore. I’m going to cry in the galley.',
    bullets: ['Mirelle is a living world. Every region is open.', 'Name every region you can.', 'The Accord says there’s another planet. Kessa. Cold. Later.'] },
];

/** Onboarding beats: each plays once, when its trigger fires. */
export type BeatTrigger = 'start' | 'tanks' | 'jerry' | 'tapped' | 'hungry' | 'fed' | 'paired' | 'hatched' | 'order' | 'window' | 'landed' | 'shop' | 'phase-end-0' | 'named-first';

export const BEATS: Record<BeatTrigger, CommsEntry> = {
  start: { id: 'ob-start', tags: ['onboard'], panels: [
    { who: 'prof', mood: 'grin', text: 'Hey. Good morning. Good MORNING. Up you get, you’ve got fish to get back to.' },
    { who: 'you', mood: 'blink', text: '…Fish?', side: 'right' },
    { who: 'prof', mood: 'talk', text: 'Yes! Fish! Today is another day of filling a brand-new planet with life. That one, right behind the glass. Mirelle.' },
    { who: 'you', mood: 'alarm', text: 'Wait. Where am I? What year is it?', side: 'right' },
    { who: 'prof', mood: 'calm', text: 'Orbit 41 of the Colony Accord. Tuesday-ish, hull time.' },
    { who: 'you', mood: 'talk', text: 'I’m from 2022, I don’t—', side: 'right' },
    { who: 'prof', mood: 'talk', text: 'Love that for you, tell me over lunch. Mirelle won’t seed itself. And if you’ve forgotten how all this works, I’ll walk you through it. I’m Wren. Everybody says Prof.' },
  ] },
  tanks: { id: 'ob-tanks', tags: ['onboard'], panels: [
    { who: 'prof', mood: 'talk', text: 'Right. You’ve got two tanks. This one’s the main group. Swipe up on the glass to see the other.' },
    { who: 'pip', mood: 'calm', text: 'Swipe, scroll, or tap the markers on the right. PIP recommends: all three, for thoroughness.', side: 'right' },
  ] },
  jerry: { id: 'ob-jerry', tags: ['onboard'], panels: [
    { who: 'prof', mood: 'grin', text: 'And this is Jerry.' },
    { who: 'you', mood: 'talk', text: 'What’s wrong with Jerry?', side: 'right' },
    { who: 'prof', mood: 'calm', text: 'Nothing’s wrong with Jerry! He just likes being alone. He needs his me-fish time.' },
    { who: 'prof', mood: 'talk', text: 'Also the water in the big tank’s too warm for him. Swipe back down and tap a fish to say hello.' },
  ] },
  tapped: { id: 'ob-tapped', tags: ['onboard'], panels: [
    { who: 'pip', mood: 'calm', text: 'Fish selected. The dossier shows its water, diet and genes. PIP recommends: reading it.' },
  ] },
  hungry: { id: 'ob-hungry', tags: ['onboard'], panels: [
    { who: 'prof', mood: 'alarm', text: 'Ooh, that one’s hungry. Tap Feed, or tap the water to drop a pellet. Fed fish grow twice as fast.' },
  ] },
  fed: { id: 'ob-fed', tags: ['onboard'], panels: [
    { who: 'cook', mood: 'grin', text: 'Look at it go. Chef’s kiss.' },
    { who: 'prof', mood: 'talk', text: 'Now let’s pair them. Pick a male and a female in the roster and tap Pair.' },
  ] },
  paired: { id: 'ob-paired', tags: ['onboard'], panels: [
    { who: 'pip', mood: 'grin', text: 'Egg laid. Hatching in 20 seconds. PIP will count. PIP has started counting.' },
  ] },
  hatched: { id: 'ob-hatched', tags: ['onboard'], panels: [
    { who: 'prof', mood: 'grin', text: 'A fry! Hatchery-bred, generation one. Some requests only take those.' },
  ] },
  order: { id: 'ob-order', tags: ['onboard'], panels: [
    { who: 'teo', mood: 'talk', text: 'Marshal Teo, Colony Accord. Here’s your first request. One fish that can live in that lake. Thank you.', side: 'right' },
    { who: 'prof', mood: 'talk', text: 'It’s on the Bridge. Pick the request, pick a fish that meets every chip, and launch.' },
  ] },
  window: { id: 'ob-window', tags: ['onboard'], panels: [
    { who: 'prof', mood: 'calm', text: 'Look out the window. Each region passes under us once an orbit. Drop during its window for extra Life.' },
    { who: 'pip', mood: 'calm', text: 'The glowing arc on the orbit dial is the window. You do not have to wait. It is just nicer.', side: 'right' },
  ] },
  landed: { id: 'ob-landed', tags: ['onboard', 'kid'], panels: [
    { who: 'pip', mood: 'grin', text: 'Pod down. Splash confirmed.' },
    { who: 'dot', mood: 'grin', text: 'HI! I’m Dot! I saw your pod from the camp! It went WHOOSH. Can you send another one?', side: 'right' },
    { who: 'prof', mood: 'grin', text: 'And that, Ichthyologist, is a fan. Keep going: every delivery adds Bloom.' },
  ] },
  shop: { id: 'ob-shop', tags: ['onboard'], panels: [
    { who: 'sel', mood: 'talk', text: 'Archivist Sel, the Interchange. Six drawers of Ark roe, restocked every orbit. Allotment accepted. Manners appreciated.' },
  ] },
  'phase-end-0': { id: 'ob-done', tags: ['onboard'], panels: [
    { who: 'prof', mood: 'grin', text: 'Shift one, done. You’re a natural. I’ll leave you to it; ping me with Ask the Prof any time.' },
  ] },
  'named-first': { id: 'story-named-first', tags: ['story'], panels: [
    { who: 'teo', mood: 'talk', text: 'The Accord has ratified its first place name. I had to stamp it four times. I enjoyed every stamp.', side: 'right' },
  ] },
};

/** Side work orders from the cast. Optional, small reward, a story line. */
export interface Work {
  id: string;
  who: 'cook' | 'dot' | 'sel';
  minPhase: number;
  title: string;
  ask: string;
  reqs: Req[];
  reward: number;
  thanks: string;
}

export const WORKS: Work[] = [
  { id: 'work-mango', who: 'cook', minPhase: 1, title: 'A mango-coloured fish', reward: 90,
    ask: 'I want a fish the colour of a ripe mango. For morale. And for the menu board photo. Not the menu.',
    reqs: [{ kind: 'gene', allele: 'xanthic' }], thanks: 'LOOK at that. Golden. I’m naming the soup after it.' },
  { id: 'work-funny', who: 'dot', minPhase: 1, title: 'A fish with a funny name', reward: 60,
    ask: 'Can you breed a fish so I can give it a funny name? It has to be a new one. From your tank. Please.',
    reqs: [{ kind: 'bred' }], thanks: 'I’m calling it Mister Wobbleton. This is the best day of my whole life.' },
  { id: 'work-old-allele', who: 'sel', minPhase: 2, title: 'An old Earth allele', reward: 150,
    ask: 'Catalogue gap, drawer 12: koi-white. Earth temple ponds, pre-Ark. If one turns up in your tank, I would like it back.',
    reqs: [{ kind: 'gene', allele: 'koi' }], thanks: 'Drawer 12, filled. I have not said this in forty years: thank you.' },
];

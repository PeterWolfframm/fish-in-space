// What each pinnable thing looks like as a pin. Every source (PIP's folders, the Lab, a fish's post)
// builds a draft here, so pins read the same wherever they came from.

import * as W from '../game';
import { CAST, type Who } from '../content/comms/types';

const pinFish = (f: W.Fish): W.PinFish => ({ id: f.id, code: f.code, name: W.fishName(f) });

/** Water, temperature and role in a few words: "Fresh · Cold · Grazer". */
export function ecoLine(code: string): string {
  const e = W.ecoOf(code);
  return [W.WORD[e.salinity] ?? W.cap(e.salinity), W.WORD[e.temp] ?? W.cap(e.temp), W.cap(W.ROLE_WORD[e.diet] ?? e.diet)].join(' · ');
}

export function headlineDraft(h: W.Headline, orbit: number): W.PinDraft {
  const dir = h.mult > 1.05 ? 'paying more for' : h.mult < 0.95 ? 'paying less for' : 'steady on';
  return {
    ref: `news:${h.tag}`, kind: 'note', source: 'news', fish: [],
    title: `${W.cap(h.tag)} ×${h.mult.toFixed(2)}`,
    text: `${h.why}. Colonies are ${dir} ${h.tag} fish. (Bulletin, orbit ${orbit}.)`,
    tone: h.mult > 1.05 ? 'bloom' : h.mult < 0.95 ? 'signal' : 'sky',
  };
}

export function adviceDraft(c: Extract<W.Advice, { fish: W.Fish }>): W.PinDraft {
  const where = W.regionLabel(c.region);
  return {
    ref: `advice:${c.fish.id}:${c.region.id}`, kind: 'note', source: 'advice', fish: [pinFish(c.fish)],
    title: `Send ${W.fishName(c.fish)}`,
    text: `To ${where}${c.kind === 'order' ? ` for ${c.order.colony}'s request` : ' to seed it'}. +${c.reward} ◎`,
    tone: 'lamp',
  };
}

export function callDraft(e: W.CommsLogEntry): W.PinDraft {
  const who = e.panels[0]?.who as Who | undefined;
  const name = (who && CAST[who]?.name) ?? 'A call';
  return {
    ref: `call:${e.id}:${e.at}`, kind: 'note', source: 'call', fish: [],
    title: `${name}, orbit ${e.orbit}`,
    text: e.panels.map((p) => (p.who === who ? p.text : `${CAST[p.who as Who]?.name ?? p.who}: ${p.text}`)).join(' ') + (e.choice ? ` ↳ ${e.choice}` : ''),
    tone: 'sky',
  };
}

export function planDraft(p: W.PairPlan, t: W.RegionNeeds): W.PinDraft {
  const place = W.regionLabel(t.region);
  const extra = p.odds.filter((o) => o.need.source === 'order' && o.pct > 0).map((o) => `${o.need.label} ${o.pct}%`);
  return {
    ref: `plan:${p.a.id}:${p.b.id}:${t.region.id}`, kind: 'note', source: 'plan', fish: [pinFish(p.a), pinFish(p.b)],
    title: `Breed for ${place}`,
    text: `${W.fishName(p.a)} × ${W.fishName(p.b)}: ${p.water}% of eggs fit the water${extra.length ? `; ${extra.join(', ')}` : ''}.`,
    tone: 'lilac',
  };
}

export function seekDraft(seek: NonNullable<W.BreedPlan['seek']>, region: W.Region): W.PinDraft {
  return {
    ref: `seek:${region.id}`, kind: 'note', source: 'plan', fish: [],
    title: `Find: ${seek.wants.map((n) => n.label.toLowerCase()).join(', ')}`,
    text: seek.text,
    tone: 'gold',
  };
}

/** A fish portrait to remember: "breed this one", "get more like it". */
export function fishDraft(f: W.Fish, source: W.PinSource = 'lab'): W.PinDraft {
  return { ref: `fish:${f.id}`, kind: 'portrait', source, fish: [pinFish(f)], title: W.fishName(f), text: ecoLine(f.code), tone: 'tank' };
}

/** A pairing to come back to: both portraits on one card. */
export function pairDraft(a: W.Fish, b: W.Fish): W.PinDraft {
  return { ref: `pair:${[a.id, b.id].sort().join(':')}`, kind: 'portrait', source: 'lab', fish: [pinFish(a), pinFish(b)], title: `${W.fishName(a)} × ${W.fishName(b)}`, text: 'Breeding goal', tone: 'lilac' };
}

// Mission patches: one per chapter, one per named region, a few for feats.
export interface Patch {
  id: string;
  name: string;
  blurb: string;
}

export const FEAT_PATCHES: Patch[] = [
  { id: 'feat:first-drop', name: 'First Splash', blurb: 'Dropped your first pod onto Mirelle.' },
  { id: 'feat:clean-5', name: 'Window Seat', blurb: 'Five clean drops inside launch windows.' },
  { id: 'feat:bred-10', name: 'Matchmaker', blurb: 'Ten successful pairings.' },
  { id: 'feat:crate', name: 'Crank It', blurb: 'Opened a mystery crate.' },
];

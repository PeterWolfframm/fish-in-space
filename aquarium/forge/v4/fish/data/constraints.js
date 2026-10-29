// The aesthetic guard: combinations that read badly at pixel size, or that break the setting.
// Plain JSON in a module (the studio can edit it).
//
// { id, when, fix, fallback?, note }: when `when` holds (a rules.js condition over the fish's
// fields), the field `fix` is re-rolled without its current value, deterministically, up to four
// times; if the fish still trips the guard, `fix` is set to `fallback` (or its first choice).
// `params.guard.enabled` turns the guard off; `params.guard.off` lists ids to skip.

export default [
  { id: 'tiny-arsenal', when: { all: [{ field: 'size', is: 'tiny' }, { field: 'dorsal', is: 'venom' }, { field: 'tail', is: 'sword' }] }, fix: 'tail', fallback: 'fork', note: 'a tiny fish cannot carry venom spines and a sword: the pixels turn to noise' },
  { id: 'helmet-eyes', when: { all: [{ feature: 'helmet', not: 'none' }, { field: 'eyeMount', in: ['telescope', 'tubular'] }] }, fix: 'helmet', fallback: 'none', note: 'a helmet over telescope or tube eyes hides the eyes' },
  { id: 'lava-veil', when: { all: [{ field: 'terrain', is: 'lava' }, { field: 'tail', in: ['veil', 'streamer'] }] }, fix: 'tail', fallback: 'fork', note: 'molten rock would tear a veil tail' },
  { id: 'sand-sail', when: { all: [{ field: 'terrain', is: 'sand' }, { field: 'dorsal', in: ['sail', 'streamer', 'tall', 'crest'] }] }, fix: 'dorsal', fallback: 'low', note: 'a sand-swimmer cannot drag a sail through the dune' },
  { id: 'nuclear-warts', when: { all: [{ field: 'terrain', is: 'nuclear' }, { field: 'damage', is: 'warts' }] }, fix: 'damage', fallback: 'none', note: 'radiant fish are healthy fish: no warts in the cooling lake' },
  { id: 'big-googly', when: { all: [{ size: '>=huge' }, { field: 'eyeStyle', is: 'googly' }] }, fix: 'eyeStyle', fallback: 'round', note: 'googly eyes on a giant read as a mistake, not a joke' },
  { id: 'tiny-sword', when: { all: [{ field: 'size', is: 'tiny' }, { field: 'jaw', is: 'bill' }] }, fix: 'jaw', fallback: 'plain', note: 'a bill on a tiny fish is a single grey line' },
];

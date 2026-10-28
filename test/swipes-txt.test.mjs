import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swipesToTxt } from '../src/pixelgen/swipes-txt.js';

test('swipesToTxt writes one block per swipe and skips empty notes', () => {
  const text = swipesToTxt(
    [
      {
        created: '2026-10-28T10:15:00Z',
        user: 'u1',
        kind: 'fish2',
        code: 'f.abc',
        verdict: 'approve',
        seed: 'MAGIC 1',
        fix: ['contrast', 'outline'],
        instead: { species: 'shark' },
        asKind: 'pilot2',
        note: 'looks too flat',
        scores: { public: 0.724, personal: 0.806 },
        mode: 'public',
      },
      { created: '2026-10-28T11:00:00Z', user: 'u2', kind: 'plant2', code: 'g.x', verdict: 'pass' },
    ],
    { nameOf: (id) => (id === 'u1' ? 'Alice (guest)' : id) },
  );
  assert.equal(
    text,
    [
      '--- swipe 2026-10-28T10:15:00Z ---',
      'user: Alice (guest)',
      'kind: fish2  code: f.abc  verdict: approve',
      'seed: MAGIC 1',
      'fix: contrast, outline',
      'instead: {"species":"shark"}',
      'asKind: pilot2',
      'note: looks too flat',
      'scores: public=0.72 personal=0.81 mode: public',
      '',
      '--- swipe 2026-10-28T11:00:00Z ---',
      'user: u2',
      'kind: plant2  code: g.x  verdict: pass',
      '',
    ].join('\n'),
  );
});

test('swipesToTxt of nothing is empty', () => {
  assert.equal(swipesToTxt([]), '');
});

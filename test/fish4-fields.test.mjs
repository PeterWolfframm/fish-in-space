// The `f4` field order is a committed snapshot. A fish's code is positional: field n of the
// genome is character n of the code. So a field may be APPENDED, and a choice may be APPENDED to
// a field, but nothing may move, change salt or disappear — that silently re-maps every fish
// already stored in a save.
//
// When this fails and the change was deliberate (an append), refresh the snapshot:
//   UPDATE_GOLDENS=1 node --test test/fish4-fields.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fish4Traits as T } from '../src/v4/fish/index.js';

const FIXTURE = new URL('./fixtures/fish4-fields.json', import.meta.url);

/** One line per field: where it sits, the salt it rolls on, and its choices in order. */
const snapshot = () => T.fields.map((f) => ({ id: f.id, salt: f.salt, choices: f.choices.map((c) => c.id) }));

test('fish4 fields: nothing moves, nothing changes salt, nothing is removed', () => {
  const now = snapshot();
  if (process.env.UPDATE_GOLDENS || !existsSync(FIXTURE)) writeFileSync(FIXTURE, `${JSON.stringify(now, null, 1)}\n`);
  const was = JSON.parse(readFileSync(FIXTURE, 'utf8'));

  assert.ok(now.length >= was.length, `${was.length - now.length} field(s) removed: stored codes would shift`);
  was.forEach((old, i) => {
    const f = now[i];
    assert.equal(f.id, old.id, `field ${i} is now '${f.id}', was '${old.id}': fields may only be appended`);
    assert.equal(f.salt, old.salt, `field '${f.id}' changed salt ${old.salt} → ${f.salt}: it would roll a different fish`);
    assert.ok(f.choices.length >= old.choices.length, `field '${f.id}' lost a choice: codes that hold it would not decode`);
    old.choices.forEach((c, ci) => assert.equal(f.choices[ci], c, `field '${f.id}' choice ${ci} is now '${f.choices[ci]}', was '${c}': choices may only be appended`));
  });

  const added = now.slice(was.length);
  if (added.length) console.log(`appended ${added.length} field(s): ${added.map((f) => `${f.id}@${f.salt}`).join(', ')} — refresh with UPDATE_GOLDENS=1`);
});

test('fish4 fields: a code digit holds at most 36 choices, and salts are unique', () => {
  const seen = new Map();
  for (const f of T.fields) {
    assert.ok(f.choices.length <= 36, `field '${f.id}' has ${f.choices.length} choices: a code digit holds 36`);
    const other = seen.get(f.salt);
    assert.equal(other, undefined, `fields '${other}' and '${f.id}' share salt ${f.salt}: they would roll together`);
    seen.set(f.salt, f.id);
  }
});

// src/pixel/ is a copy of the kit; it must not drift from it (skipped when the kit is not here).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SOURCE, drift } from '../scripts/vendor-pixel.mjs';

test('vendored pixel kit matches the kit', { skip: !existsSync(SOURCE) && `no kit at ${SOURCE}` }, () => {
  const { drifted, stale } = drift();
  assert.deepEqual(drifted, [], 'run node scripts/vendor-pixel.mjs');
  assert.deepEqual(stale, []);
});

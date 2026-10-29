// v1 is frozen. The game ports are held by parity.test.mjs; the fish-in-space-native v1 plants are
// held here to fingerprints rendered from their own code before v2 existed. New work goes in v2.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { waterplantGoldens, plantGoldens } from './golden-cases.mjs';
import * as waterplant from '../src/gen/waterplant.js';
import * as plant from '../src/gen/plant.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

for (const [name, render, mod] of [['waterplant', waterplantGoldens, waterplant], ['plant', plantGoldens, plant]]) {
  test(`v1 ${name} draws exactly what it always drew`, () => {
    const golden = fixture(name);
    const now = render(mod);
    const bad = Object.keys(golden).filter((k) => now[k] !== golden[k]);
    assert.equal(Object.keys(now).length, Object.keys(golden).length, 'same cases');
    assert.equal(bad.length, 0, `${bad.length} frames differ, e.g. ${bad.slice(0, 3).join(', ')}`);
  });
}

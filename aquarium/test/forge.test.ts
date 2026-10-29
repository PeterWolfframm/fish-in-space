import { describe, expect, test } from 'vitest';
import fish4 from '@forge/v4/fish/index.js';

describe('vendored forge', () => {
  test('fish4 draws a swim frame from a code', () => {
    const g = fish4.fromSeed('smoke');
    const code = fish4.traits.encode(g);
    const genome = fish4.fromCode(code);
    const img = fish4.frame(genome, 'swim', 0);
    expect(img.w).toBeGreaterThan(0);
    expect(img.h).toBeGreaterThan(0);
    expect(img.data.length).toBe(img.w * img.h);
  });
});

import { describe, expect, test } from 'vitest';
import fish3 from '@forge/v3/fish/index.js';

describe('vendored forge', () => {
  test('fish3 draws a swim frame from a code', () => {
    const g = fish3.fromSeed('smoke');
    const code = fish3.traits.encode(g);
    const genome = fish3.fromCode(code);
    const img = fish3.frame(genome, 'swim', 0);
    expect(img.w).toBeGreaterThan(0);
    expect(img.h).toBeGreaterThan(0);
    expect(img.data.length).toBe(img.w * img.h);
  });
});

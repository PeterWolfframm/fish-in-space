// Seeded randomness. Every rule takes its seed explicitly, so the same seed gives the same game.

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32 seeded from a string. */
export function rng(seed: string | number): () => number {
  let a = hash(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)];

export function weighted<T>(r: () => number, list: readonly T[], weight: (t: T) => number): T | undefined {
  const total = list.reduce((s, t) => s + Math.max(0, weight(t)), 0);
  if (total <= 0) return undefined;
  let x = r() * total;
  for (const t of list) {
    x -= Math.max(0, weight(t));
    if (x < 0) return t;
  }
  return list.at(-1);
}

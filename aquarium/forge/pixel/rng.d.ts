export function hash01(key: string | number, salt?: number): number;

export interface Roller {
  /** 0..1 for this salt. */
  r(salt: number): number;
  pick<T>(list: readonly T[], salt: number): T;
  weighted<T>(pairs: ReadonlyArray<readonly [T, number]>, salt: number): T;
  chance(p: number, salt: number): boolean;
  range(min: number, max: number, salt: number): number;
  int(min: number, max: number, salt: number): number;
}

export function roller(seed: string | number, band?: number): Roller;

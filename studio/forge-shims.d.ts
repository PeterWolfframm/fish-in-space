declare module '@studio-forge/gen/registry.js' {
  export const GENERATORS: unknown[];
  export function sizeOf(...args: unknown[]): unknown;
  export function breedWith(...args: unknown[]): unknown;
  export function fromCode(...args: unknown[]): unknown;
}

declare module '@studio-forge/gen/versions.js' {
  export function versionsFor(family: string): unknown[];
}

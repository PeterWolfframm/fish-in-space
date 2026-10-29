export type RGB = [number, number, number];

export function rgbOf(hex: string): RGB;
export function hexFrom(rgb: readonly number[]): string;

/** Darkened (k < 1) or lightened toward white (k > 1). */
export function shadeRgb(rgb: readonly number[], k: number): RGB;
/** Multiplied by k and clamped; cannot lighten a dark colour. */
export function scaleRgb(rgb: readonly number[], k: number): RGB;
export function shade(hex: string, k: number): string;

export function mixRgb(a: readonly number[], b: readonly number[], t: number): RGB;
export function mix(a: string, b: string, t: number): string;

/** Perceived brightness, 0..1. */
export function lum(hex: string): number;
/** Whichever of dark/light contrasts more with hex. */
export function inkOn(hex: string, dark?: string, light?: string): string;

/** `steps` colours, darkest first, with `hex` in the middle. */
export function ramp(hex: string, steps?: number, spread?: number): string[];
export function trio(hex: string, spread?: number): { dark: string; base: string; light: string };
export function rotateHue(hex: string, deg: number): string;

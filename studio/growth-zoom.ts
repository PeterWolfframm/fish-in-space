/** Integer zoom for large UI previews of grown fish by size class (game-style display sizing). */
const CLASS_VIEW: Record<string, number> = { tiny: 0.5, small: 0.62, medium: 0.75, large: 0.87, huge: 1, giant: 1 };

export function zoomForStageSize(stage: string, size: string, base: number): number {
  if (stage === 'fry' || stage === 'juvenile') return base;
  return Math.max(1, Math.round(base * (CLASS_VIEW[size] ?? 1)));
}

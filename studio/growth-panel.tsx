// Growth panel: only shown for generators with both a `stage` and a `size` trait field (fish3,
// fish4). Shows the stage × size ladder two ways — at a uniform zoom, so the real painted pixel
// dimensions stay honestly comparable, and at the in-game `zoomForStageSize` zoom (src/game/fish.ts),
// so Part A's size-class compensation for the big UI views is tunable right here.

import type { StudioGen } from './gens';
import { Sprite } from './sprite';
import { zoomForStageSize } from './growth-zoom';

const BASE_ZOOM = 8; // matches FishPost's own base zoom for grown fish
const REAL_ZOOM = 4; // uniform across every cell, so relative sizes stay honest

function Ladder({
  gen,
  genome,
  animId,
  title,
  zoomOf,
  stages,
  sizes,
}: {
  gen: StudioGen;
  genome: Record<string, unknown>;
  animId: string;
  title: string;
  zoomOf: (stage: string, size: string) => number;
  stages: { id: string; label?: string }[];
  sizes: { id: string; label?: string }[];
}) {
  return (
    <section>
      <h3>{title}</h3>
      <div class="studio-growth-grid" style={{ gridTemplateColumns: `auto repeat(${sizes.length}, 1fr)` }}>
        <div />
        {sizes.map((sz) => (
          <div key={sz.id} class="studio-growth-head mono">
            {sz.label ?? sz.id}
          </div>
        ))}
        {stages.map((st) => (
          <>
            <div key={st.id} class="studio-growth-head mono">
              {st.label ?? st.id}
            </div>
            {sizes.map((sz) => {
              const rolled = { ...genome, stage: st.id, size: sz.id };
              const cell = gen.normalize ? gen.normalize(rolled) : rolled;
              return (
                <div key={sz.id} class="studio-growth-cell" style={{ background: gen.bg }}>
                  <Sprite gen={gen} genome={cell} animId={animId} zoom={zoomOf(st.id, sz.id)} />
                </div>
              );
            })}
          </>
        ))}
      </div>
    </section>
  );
}

export function GrowthPanel({ gen, genome, animId }: { gen: StudioGen; genome: unknown; animId: string }) {
  const stageField = gen.traits?.fieldById?.('stage');
  const sizeField = gen.traits?.fieldById?.('size');
  if (!stageField || !sizeField) return <div class="empty">{gen.label} has no stage/size ladder.</div>;

  const base = genome as Record<string, unknown>;
  return (
    <div class="studio-growth">
      <Ladder gen={gen} genome={base} animId={animId} title="Real pixels (uniform zoom, true relative sizes)" zoomOf={() => REAL_ZOOM} stages={stageField.choices} sizes={sizeField.choices} />
      <Ladder
        gen={gen}
        genome={base}
        animId={animId}
        title={`In-game zoom (zoomForStageSize, base ${BASE_ZOOM}× — how FishPost/Fish-der/Gene Lab show it)`}
        zoomOf={(stage, size) => zoomForStageSize(stage, size, BASE_ZOOM)}
        stages={stageField.choices}
        sizes={sizeField.choices}
      />
    </div>
  );
}

// A generator frame painted to a <canvas>: palette-indexed pixels straight to RGBA, no smoothing.
// Mirrors src/art/bake.ts's own palette walk — the Studio never goes through the baked atlas, it
// paints raw generator frames live.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { StudioGen } from './gens';

interface IndexedImage {
  w: number;
  h: number;
  data: ArrayLike<number>;
  palette: (readonly [number, number, number, number])[];
}

export function paintFrame(canvas: HTMLCanvasElement, img: IndexedImage, zoom: number) {
  canvas.width = img.w;
  canvas.height = img.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const out = ctx.createImageData(img.w, img.h);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const idx = img.data[y * img.w + x];
      const p = img.palette[idx];
      if (!p || !p[3]) continue;
      const o = (y * img.w + x) * 4;
      out.data[o] = p[0];
      out.data[o + 1] = p[1];
      out.data[o + 2] = p[2];
      out.data[o + 3] = p[3];
    }
  }
  ctx.putImageData(out, 0, 0);
  canvas.style.width = `${img.w * zoom}px`;
  canvas.style.height = `${img.h * zoom}px`;
}

export function Sprite({
  gen,
  genome,
  animId,
  frame = 0,
  zoom = 4,
  opts,
}: {
  gen: StudioGen;
  genome: unknown;
  animId: string;
  frame?: number;
  zoom?: number;
  opts?: unknown;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      const img = gen.frame(genome, animId, frame, opts);
      paintFrame(ref.current, img, zoom);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [gen, genome, animId, frame, zoom, opts]);
  return (
    <div class="studio-sprite-wrap">
      <canvas ref={ref} class="studio-sprite" />
      {error && <div class="studio-sprite-error">{error}</div>}
    </div>
  );
}

/** Plays a generator's animation at its own fps, looping, restarting whenever the fish changes. */
export function Anim({
  gen,
  genome,
  animId,
  zoom = 4,
  opts,
  playing = true,
}: {
  gen: StudioGen;
  genome: unknown;
  animId: string;
  zoom?: number;
  opts?: unknown;
  playing?: boolean;
}) {
  const anim = gen.anims.find((a) => a.id === animId) ?? gen.anims[0];
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (!playing || !anim) return;
    const fps = gen.fpsOf ? gen.fpsOf(genome, anim) : anim.fps;
    const id = setInterval(() => setI((n) => (n + 1) % anim.frames), 1000 / Math.max(1, fps));
    return () => clearInterval(id);
  }, [gen, genome, animId, playing, anim]);
  if (!anim) return null;
  return <Sprite gen={gen} genome={genome} animId={anim.id} frame={i} zoom={zoom} opts={opts} />;
}

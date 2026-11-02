// Anatomy panel: only shown for generators that expose `layers` (fish3, fish4 so far). Lets you
// toggle or solo any paint-order layer, see it exploded (one layer per tile, against the body),
// see the cumulative build-up (layer 1..n), and hover a zoomed render for a per-pixel readout.
//
// Most of fish3/4's parts aren't independent sprites — they're modulations of the body (scales,
// markings, wear, the anatomy overlays…) painted through a tone map (`ctx.toneAt`/`ctx.repaint`)
// that only exists once the `body` part itself has run. Rendering one of those parts alone paints
// zero pixels, which breaks the engine's auto-crop (an empty bounding box has no valid window). So
// "solo" here always composites `body + that layer`, never the layer by itself — which is also the
// more useful view, since a lone scale-texture pass has nothing to show without the skin it textures.
//
// The per-pixel "which layer owns this" readout isn't a real engine hook (no layerMap export
// exists) — it's inferred from the build-up renders (layer 1..n, the same ones the strip below
// shows) by walking paint order and noting the last layer whose cumulative render changed that
// pixel. That's exact for "what layer is visibly responsible for this pixel", short of a part that
// paints transparent over an already-opaque pixel to erase it (none currently do).

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { StudioGen } from './gens';
import { paintFrame } from './sprite';

interface IndexedImage {
  w: number;
  h: number;
  data: ArrayLike<number>;
  palette: (readonly [number, number, number, number])[];
}

function labelOf(gen: StudioGen, id: string): string {
  const custom = gen.layers?.labelOf?.(id);
  if (custom && custom !== id) return custom;
  return id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function Tile({ gen, genome, animId, enabled, cacheKey, zoom, title }: { gen: StudioGen; genome: unknown; animId: string; enabled: (id: string) => boolean; cacheKey: string; zoom: number; title: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      // pixelforge's partsFor() caches the filtered part list by opts.key — without one every
      // distinct `enabled` would collide on the same ('') slot and reuse the first cached list.
      const img = gen.frame(genome, animId, 0, { enabled, key: cacheKey }) as IndexedImage;
      paintFrame(ref.current, img, zoom);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [gen, genome, animId, enabled, cacheKey, zoom]);
  return (
    <div class="studio-anatomy-tile" title={title}>
      <div class="studio-sprite-wrap">
        <canvas ref={ref} class="studio-sprite" />
        {error && <div class="studio-sprite-error">{error}</div>}
      </div>
      <div class="studio-anatomy-tile-label mono">{title}</div>
    </div>
  );
}

function PixelInspector({ gen, genome, animId, ids, zoom }: { gen: StudioGen; genome: unknown; animId: string; ids: string[]; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; layer: string | null; idx: number; color: string } | null>(null);

  const full = useMemo(() => {
    try {
      return gen.frame(genome, animId, 0, { key: 'full' }) as IndexedImage;
    } catch {
      return null;
    }
  }, [gen, genome, animId]);

  // The build-up renders (layer 1..n, cumulative) — same cache-key convention as the strip below
  // (`upto:${i}`), so pixelforge's part-list cache is shared rather than doubled. Used to infer
  // which layer last changed a given pixel (see the file-top comment).
  const cumulative = useMemo(
    () =>
      ids.map((id, i) => {
        try {
          return { id, img: gen.frame(genome, animId, 0, { enabled: (pid: string) => ids.indexOf(pid) <= i, key: `upto:${i}` }) as IndexedImage };
        } catch {
          return { id, img: null };
        }
      }),
    [gen, genome, animId, ids],
  );

  useEffect(() => {
    if (ref.current && full) paintFrame(ref.current, full, zoom);
  }, [full, zoom]);

  const pixelKey = (img: IndexedImage, x: number, y: number): string => {
    const idx = img.data[y * img.w + x];
    const p = img.palette[idx];
    return p && p[3] ? `${p[0]},${p[1]},${p[2]},${p[3]}` : '';
  };

  const ownerAt = (x: number, y: number): string | null => {
    let prev = '';
    let owner: string | null = null;
    for (const { id, img } of cumulative) {
      if (!img || img.w !== full?.w || img.h !== full?.h) continue;
      const cur = pixelKey(img, x, y);
      if (cur !== prev) owner = id;
      prev = cur;
    }
    return owner;
  };

  const onMove = (e: MouseEvent) => {
    if (!ref.current || !full) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    if (x < 0 || y < 0 || x >= full.w || y >= full.h) {
      setHover(null);
      return;
    }
    const idx = full.data[y * full.w + x];
    const p = full.palette[idx];
    const layer = ownerAt(x, y);
    const color = p && p[3] ? `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${(p[3] / 255).toFixed(2)})` : 'transparent';
    setHover({ x, y, layer, idx, color });
  };

  return (
    <div class="studio-anatomy-inspect">
      <div class="studio-sprite-wrap" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <canvas ref={ref} class="studio-sprite" />
      </div>
      <div class="studio-anatomy-readout mono">
        {hover ? `x${hover.x} y${hover.y} · ${hover.layer ? labelOf(gen, hover.layer) : 'nothing'} · palette ${hover.idx} · ${hover.color}` : 'hover the fish for a per-pixel readout'}
      </div>
    </div>
  );
}

export function AnatomyPanel({ gen, genome, animId }: { gen: StudioGen; genome: unknown; animId: string }) {
  const ids = gen.layers?.ids ?? [];
  const [off, setOff] = useState<Set<string>>(new Set());
  const [solo, setSolo] = useState<string | null>(null);
  const [zoom, setZoom] = useState(4);

  useEffect(() => {
    setOff(new Set());
    setSolo(null);
  }, [gen]);

  if (!gen.layers) return <div class="empty">{gen.label} has no layer breakdown.</div>;

  // Solo always keeps `body` painting too — see the file-top comment on why a lone overlay part
  // paints nothing (and breaks the engine's auto-crop) without it.
  const liveEnabled = (id: string) => (solo ? id === solo || id === 'body' : !off.has(id));
  const toggle = (id: string) => {
    setSolo(null);
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div class="studio-anatomy">
      <div class="studio-toolbar row">
        <label class="row">
          zoom
          <input type="range" min={1} max={12} value={zoom} onChange={(e) => setZoom(Number((e.currentTarget as HTMLInputElement).value))} />
          <span class="numeral">{zoom}×</span>
        </label>
        {(off.size > 0 || solo) && (
          <button
            class="btn small ghost"
            onClick={() => {
              setOff(new Set());
              setSolo(null);
            }}
          >
            reset
          </button>
        )}
      </div>

      <section>
        <h3>Live (toggle to hide, click a tile below to solo)</h3>
        <div class="studio-stage" style={{ background: gen.bg }}>
          <Tile gen={gen} genome={genome} animId={animId} enabled={liveEnabled} cacheKey={`live:${solo ?? [...off].sort().join(',')}`} zoom={zoom * 1.5} title="" />
        </div>
      </section>

      <section>
        <h3>Pixel inspector</h3>
        <PixelInspector gen={gen} genome={genome} animId={animId} ids={ids} zoom={zoom * 1.5} />
      </section>

      <section>
        <h3>Exploded: every layer alone ({ids.length})</h3>
        <div class="studio-anatomy-grid">
          {ids.map((id) => (
            <div key={id} class={`studio-anatomy-cell ${off.has(id) ? 'is-off' : ''} ${solo === id ? 'is-solo' : ''}`}>
              <div class="studio-anatomy-cell-actions row">
                <label class="row">
                  <input type="checkbox" checked={!off.has(id)} onChange={() => toggle(id)} /> show
                </label>
                <button class="btn small ghost" onClick={() => setSolo(solo === id ? null : id)}>
                  {solo === id ? 'un-solo' : 'solo'}
                </button>
              </div>
              <Tile gen={gen} genome={genome} animId={animId} enabled={(pid) => pid === id || pid === 'body'} cacheKey={`solo:${id}`} zoom={zoom} title={labelOf(gen, id)} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>Build-up: layer 1 … n, in paint order</h3>
        <div class="studio-anatomy-strip">
          {ids.map((id, i) => (
            <Tile key={id} gen={gen} genome={genome} animId={animId} enabled={(pid) => ids.indexOf(pid) <= i} cacheKey={`upto:${i}`} zoom={zoom} title={`+${labelOf(gen, id)}`} />
          ))}
        </div>
      </section>
    </div>
  );
}

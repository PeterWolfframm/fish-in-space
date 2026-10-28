// Little canvases for baked sprites in the HTML layer: fish in the roster and dossier, plants in the
// counter, cast portraits in comms.

import { useEffect, useRef } from 'preact/hooks';
import { load, sheet, frameCanvas, type Sheet } from '../art/atlas';
import type { Family } from '../art/bake';
import { CharacterArt, drawPip } from '../art/characters';
import type { Who } from '../content/comms/types';

interface Props {
  family: Family;
  code: string;
  anim: string;
  scale?: number;
  animate?: boolean;
  class?: string;
  label?: string;
}

export function SpriteArt({ family, code, anim, scale = 1, animate = false, class: cls, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    let f = 0;
    const draw = (s: Sheet) => {
      if (!alive || !ref.current) return;
      frameCanvas(s, f, scale, ref.current);
      if (animate && !timer) timer = setInterval(() => ref.current && frameCanvas(s, ++f, scale, ref.current), 1000 / Math.max(2, s.fps));
    };
    const hit = sheet(family, code, anim);
    if (hit) draw(hit);
    else void load(family, code, anim).then((s) => s && draw(s));
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [family, code, anim, scale, animate]);
  return <canvas ref={ref} class={cls} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} width={1} height={1} />;
}

/** A cast member's face; talks while `talking` is set. */
export function Portrait({ who, mood = 'idle', talking = false }: { who: Who; mood?: string; talking?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let f = 0;
    let alive = true;
    const anim = talking ? 'talk' : mood === 'talk' ? 'idle' : mood;
    if (who === 'pip') {
      drawPip(c, 0, mood, 4);
      const t = setInterval(() => drawPip(c, ++f, mood, 4), talking ? 220 : 600);
      return () => clearInterval(t);
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    void CharacterArt.load(who, anim).then((s) => {
      if (!alive || !s) return;
      const scale = Math.max(1, Math.floor(64 / s.w));
      frameCanvas(s, 0, scale, c);
      if (s.n > 1) timer = setInterval(() => frameCanvas(s, ++f, scale, c), 1000 / Math.max(2, s.fps));
    });
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [who, mood, talking]);
  return <canvas ref={ref} width={64} height={64} aria-hidden="true" />;
}

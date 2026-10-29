// Shelf keepsakes as tiny hand-placed pixel art (12×12): the shop draws them as SVG, the tank as textures.

/** Tiny pixel keepsakes, 12×12, one string per row. */
export const KEEPSAKES: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  astronaut: {
    rows: ['....wwww....', '...wwwwww...', '..wwbbbbww..', '..wbbcbbbw..', '..wbbbbbbw..', '...wwwwww...', '..wwwggwww..', '.wwwwggwwww.', '.w.wwwwww.w.', '...ww..ww...', '...ww..ww...', '..www..www..'],
    pal: { w: '#e8eefc', b: '#2a3d6b', c: '#7fe6ff', g: '#ffa53d' },
  },
  teapot: {
    rows: ['.....kk.....', '....pppp....', '..pppppppp..', 'h.pppwwppp.s', 'hhpppwwpppss', 'h.pppppppp.s', '..pppppppps.', '..pppppppp..', '...pppppp...', '....dddd....', '............', '............'],
    pal: { p: '#ff9eb8', w: '#fff1f5', k: '#ffd84a', h: '#c96f8a', s: '#c96f8a', d: '#8a4a5e' },
  },
  pennant: {
    rows: ['g...........', 'gssss.......', 'gssssss.....', 'gsswssss....', 'gswwwsssss..', 'gsswssss....', 'gssssss.....', 'gssss.......', 'g...........', 'g...........', 'g...........', 'ggg.........'],
    pal: { g: '#ffd84a', s: '#3ee6f5', w: '#ffffff' },
  },
  crystal: {
    rows: ['.....l......', '....lll.....', '....lml..l..', '...llmll.ll.', '...lmmml.lm.', '..llmmmlllm.', '..lmmmmmlmm.', '..lmmmmmlmm.', '..llmmmllml.', '...rrrrrrrr.', '..rrrrrrrrr.', '............'],
    pal: { l: '#e4c9ff', m: '#b07cff', r: '#5d6a8a' },
  },
};

/** A 12×12 canvas of a keepsake, or null if the code is unknown. */
export function keepsakeCanvas(code: string): HTMLCanvasElement | null {
  const p = KEEPSAKES[code];
  if (!p || typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 12;
  const g = c.getContext('2d')!;
  p.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!p.pal[ch]) return;
    g.fillStyle = p.pal[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return c;
}

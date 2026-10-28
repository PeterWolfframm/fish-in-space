// Tiny synthesized sound effects: no files to load. Starts muted until the first tap (browsers
// require a gesture), and remembers the mute switch.

let ac = null;
let muted = false;
try {
  muted = localStorage.getItem('seedfall-muted') === '1';
} catch {}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem('seedfall-muted', m ? '1' : '0');
  } catch {}
}
export function unlock() {
  if (ac || muted) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) ac = new AC();
}

function tone(freq, dur, { type = 'sine', vol = 0.08, slide = 0, delay = 0 } = {}) {
  if (muted || !ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  plip: () => tone(880, 0.08, { slide: -300, vol: 0.05 }),
  bite: () => tone(520, 0.09, { type: 'triangle', slide: 300, vol: 0.05 }),
  select: () => tone(660, 0.06, { type: 'triangle', vol: 0.04 }),
  hatch: () => [523, 659, 784].forEach((f, i) => tone(f, 0.14, { type: 'triangle', delay: i * 0.07 })),
  coin: () => (tone(988, 0.08, { type: 'square', vol: 0.03 }), tone(1319, 0.16, { type: 'square', vol: 0.03, delay: 0.07 })),
  launch: () => tone(180, 0.7, { type: 'sawtooth', slide: 900, vol: 0.035 }),
  love: () => [784, 988].forEach((f, i) => tone(f, 0.12, { delay: i * 0.09, vol: 0.05 })),
  phase: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', delay: i * 0.11, vol: 0.06 })),
  nope: () => tone(220, 0.15, { type: 'square', slide: -60, vol: 0.03 }),
};

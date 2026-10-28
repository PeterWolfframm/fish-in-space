// Tiny synthesized sound effects: no files to load. Silent until the first tap (browsers require a
// gesture). Ported from v2, plus a radio click-hiss for comms and a countdown blip.

let ac: AudioContext | null = null;
let muted = false;
let master: GainNode | null = null;

export const isMuted = () => muted;
export const audioContext = () => ac;
export const masterOut = () => master;

export function setMuted(m: boolean) {
  muted = m;
  if (master && ac) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
}

export function unlock() {
  if (ac) {
    if (ac.state === 'suspended') void ac.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ac.destination);
}

interface ToneOpts {
  type?: OscillatorType;
  vol?: number;
  slide?: number;
  delay?: number;
}

function tone(freq: number, dur: number, { type = 'sine', vol = 0.08, slide = 0, delay = 0 }: ToneOpts = {}) {
  if (muted || !ac || !master) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(dur: number, vol = 0.03, delay = 0) {
  if (muted || !ac || !master) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  const g = ac.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(ac.currentTime + delay);
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
  radio: () => (tone(1800, 0.02, { type: 'square', vol: 0.025 }), hiss(0.18, 0.025, 0.02)),
  blip: () => tone(1046, 0.05, { type: 'square', vol: 0.03 }),
  type: () => tone(1400 + Math.random() * 300, 0.012, { type: 'square', vol: 0.008 }),
  stamp: () => (tone(140, 0.12, { type: 'triangle', slide: -60, vol: 0.09 }), hiss(0.08, 0.04)),
  splash: () => (hiss(0.35, 0.05), tone(300, 0.2, { slide: -200, vol: 0.03 })),
};

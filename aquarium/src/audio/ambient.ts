// The cabin's quiet ambient loop: hull hum, a soft pad that follows day/night, and the occasional
// distant radio crackle. Pure WebAudio, very low volume.

import { audioContext, masterOut, isMuted } from './sfx';

// Off for now — the looping pad reads as music and gets tiring. Flip this to bring it back.
const AMBIENT_ON = false;

let started = false;
let pad: GainNode | null = null;
let padFilter: BiquadFilterNode | null = null;
let crackleAt = 0;

export function startAmbient() {
  if (!AMBIENT_ON) return;
  const ac = audioContext();
  const out = masterOut();
  if (started || !ac || !out) return;
  started = true;
  const bus = ac.createGain();
  bus.gain.value = 0.0;
  bus.gain.setTargetAtTime(1, ac.currentTime, 2);
  bus.connect(out);

  // Hull hum: two detuned low sines.
  for (const [f, v] of [[55, 0.018], [55.4, 0.014], [110.2, 0.006]] as const) {
    const o = ac.createOscillator();
    o.frequency.value = f;
    const g = ac.createGain();
    g.gain.value = v;
    o.connect(g).connect(bus);
    o.start();
  }
  // Pad: a soft triad through a lowpass that opens on the day side.
  pad = ac.createGain();
  pad.gain.value = 0.012;
  padFilter = ac.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 600;
  pad.connect(padFilter).connect(bus);
  for (const f of [220, 277.18, 329.63, 440]) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.07;
    const lg = ac.createGain();
    lg.gain.value = 1.5;
    lfo.connect(lg).connect(o.detune);
    lfo.start();
    o.connect(pad);
    o.start();
  }
}

/** Called about once a second with the orbit light (0 night .. 1 day). */
export function ambientTick(light: number) {
  const ac = audioContext();
  if (!ac || !started || !padFilter || isMuted()) return;
  padFilter.frequency.setTargetAtTime(380 + light * 900, ac.currentTime, 3);
  if (ac.currentTime > crackleAt) {
    crackleAt = ac.currentTime + 25 + Math.random() * 40;
    const len = Math.floor(ac.sampleRate * 0.6);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() < 0.02 ? (Math.random() * 2 - 1) : 0;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = ac.createGain();
    g.gain.value = 0.02;
    src.connect(f).connect(g).connect(masterOut()!);
    src.start();
  }
}

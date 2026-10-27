// Pilots v2: the crew drawn as one 64×48 scene at a fixed pixel density, then cropped to a
// framing: an icon is the face, a portrait the head and shoulders (v1's view), a bust adds the
// chest with harness, hose and name tag, and the cockpit view puts the seat, canopy bow and
// consoles round them. The head is the same size in every framing; bigger framings show more.
//
// The helmet is a lit sphere with a specular spot and painted with recolours (so paint keeps
// the shading), a lowered visor reflects a sky gradient with a glint that slides with the anim,
// and skin, suit and mask take hue-shifted ramps. Expressions are v1's, plus glance and shake.
//
// Pure: genome + pose in, IndexedImage out.

import { shade, mix, rgbOf } from '../../pixel/color.js';
import { hash01 } from '../../pixel/rng.js';
import { Surface, lightOf } from '../kit/surface.js';
import { ellipse, poly, capsule } from '../kit/shapes.js';
import { crop } from '../kit/sizes.js';
import { rest } from '../anim/rig.js';
import { pilot2Traits } from './traits.js';

export const SCENE = { w: 64, h: 48 };

/** Each framing's window onto the scene. */
export const FRAMINGS = {
  icon: { x: 24, y: 8, w: 16, h: 16 },
  portrait: { x: 16, y: 2, w: 32, h: 32 },
  bust: { x: 8, y: 0, w: 48, h: 48 },
  cockpit: { x: 0, y: 0, w: 64, h: 40 },
};

export function pilotCanvas(genome) {
  const f = FRAMINGS[pilot2Traits.normalize(genome).size] ?? FRAMINGS.portrait;
  return { w: f.w, h: f.h };
}

const hexOf = (set, id) => {
  const v = set[id];
  return v?.startsWith?.('#') ? v : `#${v}`;
};

const rect = (x, y, w, h) => {
  const t = (px, py) => px >= x && px < x + w && py >= y && py < y + h;
  t.box = [x - 1, y - 1, x + w + 1, y + h + 1];
  return t;
};

const INK = '#18161a';
const WHITE = '#f0f0ec';

export function drawPilot2(genome, pose = rest('pilot')) {
  const set = pilot2Traits.normalize(genome);
  const seed = String(genome?.seed ?? pilot2Traits.encode(set));
  const framing = FRAMINGS[set.size] ?? FRAMINGS.portrait;
  const s = new Surface(SCENE.w, SCENE.h);
  const expr = pose.expr ?? 'idle';
  const beat = pose.beat ?? 0;
  const jitter = pose.shake ?? 0;

  if (set.size === 'cockpit') cockpit(s, set, expr, beat);

  if (set.figure === 'scope') scope(s, set, seed, expr, beat, pose, jitter);
  else {
    const tilt = (pose.tilt ?? 0) + (expr === 'strain' ? (beat % 2 ? 1 : 0) : expr === 'eject' ? (beat % 2 ? -1 : 1) : 0);
    const cx = 32 + jitter + tilt;
    const ctx = { s, set, expr, beat, pose, cx, bx: 32 + jitter };
    if (set.figure === 'boss') boss(ctx);
    else if (set.figure === 'tutor') tutor(ctx);
    else pilot(ctx);
  }
  const img = s.render({ dither: 0, outline: true });
  return crop(img, framing.x, framing.y, framing.w, framing.h);
}

// ---------- figures ----------

function pilot(c) {
  const { set, expr } = c;
  const visorUp = set.visorDown !== 'yes' || expr === 'grin';
  torso(c, { harness: true });
  head(c, { visorUp, mask: true });
  helmet(c, { visorUp });
  if ((expr === 'strain' || expr === 'alarm') && c.beat % 4 < 2) {
    const drop = c.s.color('#aadcff');
    c.s.pin(c.cx + 6, 15, drop);
    c.s.pin(c.cx + 6, 16, drop);
  }
}

function boss(c) {
  const { s, set, cx, bx } = c;
  const red = set.side === 'red';
  torso(c, { harness: false, coat: red ? '#46505f' : '#f0c828' });
  head(c, { visorUp: true, mask: false });
  // Cranial: a padded cap, goggles on the brow, headset cups, a boom mic.
  const capM = s.material(red ? '#5a606e' : '#f0c828', { steps: 5 });
  const capE = ellipse(cx, 12, 7.6, 5.2);
  sphere(s, (x, y) => capE(x, y) && y <= 13, capE.box, capM, cx, 12, 7.6, 5.2);
  const cup = s.material('#2a2a30', { steps: 4 });
  for (const x of [cx - 9, cx + 6]) s.fill(rect(x, 14, 3, 6), { box: rect(x, 14, 3, 6).box, mat: cup });
  const band = s.material('#323a42', { steps: 4 });
  s.fill(rect(cx - 6, 8, 12, 2), { box: rect(cx - 6, 8, 12, 2).box, mat: band });
  const lens = s.material('#78aac8', { steps: 4 });
  for (const x of [cx - 5, cx + 2]) s.fill(rect(x, 8, 3, 2), { box: rect(x, 8, 3, 2).box, mat: lens, bias: 0.2 });
  s.pin(cx - 5, 8, s.color('#e6f4ff'));
  const mic = s.color('#1e1e22');
  s.pin(cx + 6, 20, mic);
  for (let x = cx + 3; x < cx + 6; x++) s.pin(x, 21, mic);
  void bx;
}

function tutor(c) {
  const { s, cx } = c;
  torso(c, { harness: false, suit: '#46506a' });
  head(c, { visorUp: true, mask: false });
  const capM = s.material('#28344f', { steps: 5 });
  const capE = ellipse(cx, 11.5, 7, 4.6);
  sphere(s, (x, y) => capE(x, y) && y <= 12, capE.box, capM, cx, 11.5, 7, 4.6);
  s.fill(rect(cx - 7, 12, 16, 1), { box: rect(cx - 7, 12, 16, 1).box, mat: capM, bias: 0.15 });
  s.fill(rect(cx - 6, 13, 13, 1), { box: rect(cx - 6, 13, 13, 1).box, mat: capM, bias: -0.4, seam: false });
  const badge = s.material('#f0c83c', { steps: 4 });
  s.fill(rect(cx - 1, 8, 2, 2), { box: rect(cx - 1, 8, 2, 2).box, mat: badge, bias: 0.2 });
  const cup = s.material('#2a2a30', { steps: 4 });
  for (const x of [cx - 9, cx + 7]) s.fill(rect(x, 15, 2, 5), { box: rect(x, 15, 2, 5).box, mat: cup });
}

// ---------- parts ----------

/** A sphere-lit fill: the normal comes from the ellipsoid, so a shell cut open still reads round. */
function sphere(s, test, box, mat, cx, cy, rx, ry, extra = {}) {
  return s.fill(test, {
    box,
    mat,
    ...extra,
    light: (x, y) => {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const nz = Math.sqrt(Math.max(0.04, 1 - nx * nx - ny * ny));
      return lightOf(nx, ny, nz) + (extra.bias ?? 0);
    },
  });
}

function torso(c, { harness = true, coat = null, suit = null }) {
  const { s, set, bx } = c;
  const suitHex = coat ?? suit ?? hexOf(set, 'suit');
  const m = s.material(suitHex, { steps: 5, shift: 16 });
  const half = (y) => 7.5 + 15 * (1 - Math.exp(-(y - 25) / 4.5));
  const left = [];
  const right = [];
  for (let y = 25; y <= 49; y += 1) {
    left.push([bx - half(y), y]);
    right.push([bx + half(y), y]);
  }
  const body = poly([...left, ...right.reverse()]);
  s.fill(body, { box: body.box, mat: m, dome: 7 });
  // Folds and the zip: darker lines that follow the chest.
  s.tone((x, y) => body(x, y) && x === Math.round(bx) && y >= 29, -1, { box: body.box });
  // Arms: a seam where each sleeve meets the chest.
  s.tone((x, y) => body(x, y) && y >= 31 && Math.abs(Math.abs(x + 0.5 - bx) - (12.5 + (y - 31) * 0.12)) < 0.5, -1, { box: body.box });
  // Collar.
  const collar = ellipse(bx, 26, 6.5, 2.2);
  s.fill(collar, { box: collar.box, mat: m, bias: -0.15 });

  if (coat) {
    // Reflective bands on a float coat.
    const band = s.material('#d8dcd8', { steps: 4 });
    s.recolor((x, y) => body(x, y) && (y === 37 || y === 38) && Math.abs(x - bx) > 2, band, { box: body.box });
  }
  if (harness) {
    const strap = s.material('#2e2c28', { steps: 4 });
    for (const x of [bx - 6, bx + 4]) s.fill((px, py) => body(px, py) && px >= x && px < x + 2 && py >= 27, { box: [x - 1, 26, x + 3, 48], mat: strap });
    s.fill((px, py) => body(px, py) && py >= 34 && py < 36 && Math.abs(px + 0.5 - bx) <= 7, { box: [bx - 8, 33, bx + 8, 37], mat: strap });
    const metal = s.material('#b4b8bc', { steps: 4 });
    s.fill(rect(bx - 1, 34, 3, 2), { box: rect(bx - 1, 34, 3, 2).box, mat: metal, bias: 0.15 });
    for (const x of [bx - 6, bx + 4]) s.fill(rect(x, 40, 2, 2), { box: rect(x, 40, 2, 2).box, mat: metal });
  }
  // Shoulder patch, and a name tag that only the bust and cockpit framings reach.
  const patch = s.material(hexOf(set, 'patch'), { steps: 4 });
  s.fill(rect(bx + 7, 29, 3, 3), { box: rect(bx + 7, 29, 3, 3).box, mat: patch, flat: 0.6 });
  s.pin(bx + 8, 30, s.color(WHITE));
  const tag = s.material('#6e5034', { steps: 4 });
  s.fill(rect(bx - 12, 36, 6, 3), { box: rect(bx - 12, 36, 6, 3).box, mat: tag, flat: 0.7 });
  const letters = s.color('#e6d2a0');
  for (let i = 0; i < 4; i++) if (hash01(pilot2Traits.encode(set), 90 + i) > 0.25) s.pin(bx - 11 + i, 37, letters);
}

function head(c, { visorUp, mask }) {
  const { s, set, expr, beat, pose, cx, bx } = c;
  const skinHex = hexOf(set, 'skin');
  const skin = s.material(skinHex, { steps: 5, shift: 6, dark: 0.38, light: 0.4 });
  // Neck in the head's shadow.
  s.fill(rect(Math.min(cx, bx) - 3, 22, 7 + Math.abs(cx - bx), 5), { box: [bx - 6, 21, bx + 6, 28], mat: skin, bias: -0.18, flat: 0.5 });
  const face = ellipse(cx, 17, 6.2, 7.4);
  s.fill(face, { box: face.box, mat: skin, dome: 6, flat: 0.4, bias: 0.05 });

  const pal = rgbOf(skinHex);
  const skinD = s.color(mix(skinHex, '#5a2a3a', 0.35));
  const skinL = s.color(shade(skinHex, 1.12));
  const ink = s.color(INK);
  const white = s.color(WHITE);
  const iris = s.color(hexOf(set, 'eyes'));
  const hair = hexOf(set, 'hair');
  const eyeY = 16;
  const L = cx - 3;
  const R = cx + 2;
  const shut = (pose.lid ?? 0) >= 0.5 || expr === 'blink' || (expr === 'grin' && beat % 2 === 0);
  const look = Math.round(pose.glance ?? 0);
  const eye = (x) => {
    const inner = x < cx ? 1 : 0;
    if (shut) {
      s.pin(x, eyeY + 1, ink);
      s.pin(x + 1, eyeY + 1, ink);
    } else if (expr === 'grin') {
      s.pin(x, eyeY + 1, ink);
      s.pin(x + 1, eyeY, ink);
    } else if (expr === 'strain') {
      s.pin(x, eyeY + 1, ink);
      s.pin(x + 1, eyeY + 1, ink);
      s.pin(x + inner, eyeY, ink);
    } else if (expr === 'calm') {
      s.pin(x, eyeY + 1, iris);
      s.pin(x + 1, eyeY + 1, iris);
      s.pin(x, eyeY, skinD);
      s.pin(x + 1, eyeY, skinD);
    } else if (expr === 'alarm' || expr === 'eject') {
      for (let y = eyeY - 1; y <= eyeY + 1; y++) {
        s.pin(x, y, white);
        s.pin(x + 1, y, white);
      }
      s.pin(x + (beat % 2), eyeY, ink);
    } else {
      // Open: white, iris below a pupil; looks inward unless glancing.
      const px = look < 0 ? x : look > 0 ? x + 1 : x + inner;
      s.pin(x, eyeY, white);
      s.pin(x + 1, eyeY, white);
      s.pin(x, eyeY + 1, white);
      s.pin(x + 1, eyeY + 1, white);
      s.pin(px, eyeY + 1, iris);
      s.pin(px, eyeY, ink);
    }
  };
  if (visorUp) {
    eye(L);
    eye(R);
    const browY = expr === 'strain' ? eyeY - 1 : eyeY - 2;
    const brow = s.color(shade(hair, 0.9));
    for (const x of [L, R]) {
      s.pin(x, browY, brow);
      s.pin(x + 1, browY, brow);
      if (set.brows === '2') s.pin(x + (x < cx ? -1 : 2), browY + (expr === 'strain' ? -1 : 0), brow);
    }
    // Nose: lit on the left, shadowed on the right and under.
    s.pin(cx, eyeY + 2, skinL);
    s.pin(cx + 1, eyeY + 2, skinD);
    s.pin(cx, eyeY + 3, skinD);
    if (set.scar === 'brow') for (let y = browY - 1; y <= browY + 1; y++) s.pin(R + 1, y, s.color(mix(skinHex, '#f0c8c0', 0.5)));
  }
  if (set.freckles === 'yes') {
    const fr = s.color(mix(skinHex, '#7a3a20', 0.35));
    for (const [dx, dy] of [[-4, 18], [-3, 19], [-5, 19], [3, 18], [4, 19], [2, 19]]) s.pin(cx + dx, dy, fr);
  }
  if (set.scar === 'cheek') {
    const sc = s.color(mix(skinHex, '#f0b4b4', 0.45));
    for (const [dx, dy] of [[4, 17], [4, 18], [5, 19]]) s.pin(cx + dx, dy, sc);
  }

  const moustache = s.color(shade(hair, 0.8));
  if (mask) {
    const lift = expr === 'talk' && (pose.mouth ?? 0) > 0.5 ? -1 : 0;
    const mm = s.material('#4a5248', { steps: 5 });
    const shell = capsule(cx, 21 + lift, cx, 22.5 + lift, 3.6, 2.6);
    s.fill(shell, { box: shell.box, mat: mm, dome: 3 });
    // Hose: corrugated, from the mask down across the chest.
    s.stroke({ x: cx - 0.5, y: 24 + lift, angle: Math.PI + 0.25, len: 15, bend: -0.5, width: () => 2 }, { mat: mm, light: (u, a, v) => (Math.floor(u * 15) % 2 ? v * 0.7 : v) });
    s.fill(rect(cx - 1, 21 + lift, 3, 2), { box: rect(cx - 1, 21 + lift, 3, 2).box, mat: mm, bias: -0.35, seam: false });
    if (expr === 'talk') s.pin(cx + 2, 21 + lift, s.color((pose.mouth ?? 0) > 0.8 ? '#50ff78' : '#28a046'));
    if (set.mustache === 'yes' && visorUp) for (let x = cx - 2; x <= cx + 2; x++) s.pin(x, 19, moustache);
  } else {
    const lip = s.color(shade(skinHex, 0.62));
    const m = pose.mouth ?? 0;
    const open = expr === 'talk' ? (m > 0.6 ? 2 : m > 0.3 ? 1 : 0) : expr === 'alarm' ? 2 : 0;
    if (expr === 'grin') {
      for (let x = cx - 2; x <= cx + 2; x++) s.pin(x, 21, lip);
      s.pin(cx - 3, 20, lip);
      s.pin(cx + 3, 20, lip);
    } else if (open) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        s.pin(x, 20, lip);
        for (let y = 21; y < 21 + open; y++) s.pin(x, y, ink);
      }
    } else for (let x = cx - 1; x <= cx + 1; x++) s.pin(x, 21, lip);
    if (set.mustache === 'yes') for (let x = cx - 2; x <= cx + 2; x++) s.pin(x, 20 - (open ? 1 : 0), moustache);
    if (set.scar === 'chin') s.pin(cx + 1, 23, s.color(mix(skinHex, '#f0c8c0', 0.5)));
  }
  void pal;
}

function helmet(c, { visorUp }) {
  const { s, set, expr, pose, cx } = c;
  const retro = set.helmetStyle === 'retro';
  const sleek = set.helmetStyle === 'sleek';
  const shellHex = retro ? mix(hexOf(set, 'helmet'), '#6b4a2f', 0.7) : hexOf(set, 'helmet');
  const shell = s.material(shellHex, { steps: 6, shift: 18 });
  const hy = 13.5;
  const E = ellipse(cx, hy, 8.6, 8.4);
  const openHalf = retro ? 5.2 : 4.7;
  const inShell = (x, y) => E(x, y) && (y <= 13 || Math.abs(x + 0.5 - cx) > openHalf);
  sphere(s, inShell, E.box, shell, cx, hy, 8.6, 8.4);
  // Paint, recoloured onto the lit shell so it keeps the shading.
  if (!retro) {
    const paint = s.material(hexOf(set, 'stripe'), { steps: 5 });
    const p = set.pattern;
    const on = (x, y) => {
      const dx = x - cx;
      if (p === 'stripe') return (dx === -1 || dx === 0) && y >= 5 && y <= 13;
      if (p === 'twin') return (dx === -3 || dx === 2) && y >= 5 && y <= 13;
      if (p === 'checker') return (y === 12 || y === 13) && (x + y) % 2 === 0 && Math.abs(dx) <= 7;
      if (p === 'bolt') return [[3, 6], [2, 7], [3, 8], [2, 9], [1, 10], [2, 11]].some(([bx, by]) => dx === bx && y === by);
      if (p === 'star') return (dx === 0 && y === 8) || (Math.abs(dx) <= 1 && y === 9) || (Math.abs(dx) === 1 && y === 10);
      return false;
    };
    s.recolor((x, y) => inShell(x, y) && on(x, y), paint, { box: E.box });
  } else {
    // Leather: a stitched seam over the crown.
    s.tone((x, y) => inShell(x, y) && x === Math.round(cx) && y < 12 && y % 2 === 0, -1, { box: E.box });
  }
  if (sleek) s.tone((x, y) => inShell(x, y) && Math.abs(x + 0.5 - cx) <= 1 && y <= 10, 1, { box: E.box });
  // Specular: where the shell faces the light, a hot spot.
  const spec = s.color(mix(shellHex, '#ffffff', retro ? 0.35 : 0.75));
  s.pin(cx - 4, hy - 6, spec);
  if (!retro) s.pin(cx - 5, hy - 5, spec);
  // Ear cups.
  const cupM = s.material(shade(shellHex, 0.7), { steps: 4 });
  for (const x of [cx - 9, cx + 7]) s.fill(capsule(x + 1, 16, x + 1, 19.5, 1.4), { box: capsule(x + 1, 16, x + 1, 19.5, 1.4).box, mat: cupM });

  const visorHex = hexOf(set, 'visor');
  const vm = s.material(visorHex, { steps: 5, light: 0.75 });
  if (retro) {
    // Goggles: on the brow, or over the eyes.
    const gy = visorUp ? 11 : 16.5;
    const rim = s.material('#3a3632', { steps: 3 });
    s.fill(rect(cx - 7, Math.floor(gy), 15, 1), { box: rect(cx - 7, Math.floor(gy), 15, 1).box, mat: rim });
    for (const ox of [-3, 3]) {
      const lens = ellipse(cx + ox + 0.5, gy + 0.5, 2.3, 2);
      s.fill(lens, { box: lens.box, mat: rim });
      const inner = ellipse(cx + ox + 0.5, gy + 0.5, 1.4, 1.2);
      s.fill(inner, { box: inner.box, mat: vm, bias: 0.25, seam: false });
      s.pin(cx + ox - 1, Math.floor(gy) - 1, s.color('#ffffff', 200));
    }
    return;
  }
  if (visorUp) {
    // Raised: the visor rests in its housing over the brow.
    const top = sleek ? 10 : 11;
    const h = sleek ? 3 : 2;
    s.fill(rect(cx - 6, top, 13, h), { box: rect(cx - 6, top, 13, h).box, mat: vm, light: (x, y) => 0.75 - (y - top) * 0.25 + (x < cx ? 0.1 : -0.05) });
    s.pin(cx - 4, top, s.color(mix(visorHex, '#ffffff', 0.7)));
    if (sleek) s.pin(cx, top - 1, s.color('#8a8e92'));
  } else {
    // Down: a sky gradient, a dark horizon and a glint that slides across with the anim's phase.
    const ry = sleek ? 3.9 : 3.3;
    const V = ellipse(cx, 16, sleek ? 7.2 : 6.6, ry);
    const top = 13;
    const glint = (pose.phase ?? 0) * 16 + (expr === 'alarm' ? 3 : 0);
    s.fill((x, y) => V(x, y) && y >= top, {
      box: V.box,
      mat: vm,
      light: (x, y) => {
        const t = (y - top) / (ry * 2);
        let v = 0.62 - t * 0.55;
        if (Math.abs(y - 16) < 0.6) v = 0.05;
        const d = ((x - cx + 8 - (y - top) * 0.6 - glint) % 16 + 16) % 16;
        if (d < 1.2) v = 0.95;
        return v;
      },
    });
  }
}

// ---------- scope and cockpit ----------

function scope(s, set, seed, expr, beat, pose, jitter) {
  const cx = 32 + jitter;
  const cy = 18;
  const alarm = expr === 'alarm';
  const bezel = s.material('#3a3e44', { steps: 5 });
  const box = poly([[cx - 13, 6], [cx + 13, 6], [cx + 13, 31], [cx - 13, 31]]);
  s.fill(box, { box: box.box, mat: bezel, dome: 3 });
  for (const [dx, dy] of [[-11, 8], [11, 8], [-11, 29], [11, 29]]) s.pin(cx + dx, dy, s.color('#8a9096'));
  const screen = ellipse(cx, cy, 10.5, 10.5);
  const scr = s.material(alarm ? '#3c0a08' : '#061c12', { steps: 4 });
  s.fill(screen, { box: screen.box, mat: scr, dome: 10, bias: -0.1 });
  const trace = alarm ? '#ff5a46' : '#5aff96';
  const dim = s.color(alarm ? '#8c281e' : '#288c50');
  for (const r of [3.5, 7, 10]) {
    for (let a = 0; a < 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      s.pin(Math.round(cx + Math.cos(t) * r - 0.5), Math.round(cy + Math.sin(t) * r - 0.5), dim);
    }
  }
  // The sweep and its fading afterglow; blips light up as it passes.
  const sweep = (pose.sweep ?? 0) * Math.PI * 2;
  for (let k = 3; k >= 0; k--) {
    const a = sweep - k * 0.16;
    const col = s.color(trace, 255 - k * 55);
    for (let d = 0; d < 10; d++) s.pin(Math.round(cx + Math.cos(a) * d - 0.5), Math.round(cy + Math.sin(a) * d - 0.5), col);
  }
  const blips = Math.floor(hash01(seed, 40) * 3) + 2;
  for (let i = 0; i < blips; i++) {
    const a = hash01(seed, 41 + i) * Math.PI * 2;
    const d = 3 + hash01(seed, 51 + i) * 6;
    const since = (((sweep - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const col = s.color(trace, Math.round(255 - Math.min(1, since / Math.PI) * 140));
    const bx = Math.round(cx + Math.cos(a) * d - 1);
    const by = Math.round(cy + Math.sin(a) * d - 1);
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) s.pin(bx + dx, by + dy, col);
  }
  const lamp = (x, on, hex, off) => {
    const m = s.material(on ? hex : off, { steps: 3 });
    s.fill(rect(x, 28, 3, 2), { box: rect(x, 28, 3, 2).box, mat: m, bias: on ? 0.3 : 0 });
  };
  lamp(cx - 10, expr === 'talk' && beat % 2, '#ffc83c', '#5a461e');
  lamp(cx + 7, alarm && beat % 2, '#ff3c32', '#501e1a');
  void set;
}

function cockpit(s, set, expr, beat) {
  // Seat and headrest behind the figure, the ejection handle over it.
  const seat = s.material('#3a3c40', { steps: 5 });
  const rest_ = poly([[19, 6], [45, 6], [47, 40], [17, 40]]);
  s.fill(rest_, { box: rest_.box, mat: seat, dome: 5 });
  s.tone((x, y) => rest_(x, y) && (y === 14 || y === 22), -1, { box: rest_.box });
  const yel = s.color('#f0c828');
  const blk = s.color('#201e1c');
  const handle = [[27, 5], [27, 4], [27, 3], [28, 2], [29, 2], [30, 2], [31, 2], [32, 2], [33, 2], [34, 2], [35, 2], [36, 3], [36, 4], [36, 5]];
  handle.forEach(([x, y], i) => s.pin(x, y, i % 2 ? blk : yel));
  // Canopy bow: a framed arch in the top corners, glass streaks inside it.
  const frame = s.material('#4a4e54', { steps: 4 });
  s.fill((x, y) => {
    const e = ((x + 0.5 - 32) / 38) ** 2 + ((y + 0.5 - 50) / 52) ** 2;
    return e >= 1 && e <= 1.12;
  }, { mat: frame, box: [0, 0, 63, 47] });
  const glass = s.color('#c8e6ff', 70);
  for (let i = 0; i < 6; i++) {
    s.pin(3 + i, 12 - i, glass);
    s.pin(56 + i, 6 + i, glass);
  }
  // Side consoles with lit displays.
  const panel = s.material('#2c3034', { steps: 4 });
  for (const x0 of [0, 50]) {
    const p = rect(x0, 30, 14, 10);
    s.fill(p, { box: p.box, mat: panel, dome: 2 });
  }
  const glow = s.color(expr === 'alarm' && beat % 2 ? '#ff5040' : '#46e68c');
  const dim = s.color('#1e6440');
  for (let y = 32; y < 37; y++) for (let x = 3; x < 10; x++) s.pin(x, y, (y === 34 || x === 3 || x === 9 || y === 32 || y === 36) ? glow : dim);
  const amber = s.color('#ffb43c');
  for (let i = 0; i < 4; i++) s.pin(53 + i * 2, 33, (beat + i) % 4 === 0 ? amber : s.color('#5a3c1e'));
  for (let y = 35; y < 38; y++) for (let x = 53; x < 61; x++) s.pin(x, y, (x + y) % 3 ? dim : glow);
  void set;
}

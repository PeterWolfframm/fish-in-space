// A small multi-layer perceptron, written out by hand so it runs the same in the browser and in
// Node with no dependencies.
//
//   input ─► trunk (64, ReLU) ─► (32, ReLU) ─┬─► beauty  (1, sigmoid): how likely a swipe right
//                                            └─► fix     (F, sigmoid): how likely each field is
//                                                         the one a note says to change
//
// One trunk serves every sprite type, so what it learns about contrast on fish carries to plants.
// The fix head trains only on swipes that carry notes (masked elsewhere). Adam, L2 weighted per
// input (the kind block harder, see features.l2Mask), dropout on the trunk, seeded init: the same
// rows and seed always give the same model.

const relu = (x) => (x > 0 ? x : 0);
const sigmoid = (x) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));

/** A seeded 0..1 stream (mulberry32). */
function rand(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A dense layer: `w[o * n + i]`, `b[o]`. */
function layer(n, m, rnd) {
  const s = Math.sqrt(2 / n); // He init for ReLU
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  return { n, m, w: Float64Array.from({ length: n * m }, () => gauss() * s), b: new Float64Array(m) };
}

const NAMES = ['h1', 'h2', 'beauty', 'fix'];

/** Standardised copies of input vectors, per norm. */
const NORMED = new WeakMap();

/** The non-zero inputs of a vector, cached: feature vectors are mostly one-hot zeros. */
const NZ = new WeakMap();
function nonZero(x) {
  let nz = NZ.get(x);
  if (!nz) {
    nz = [];
    for (let i = 0; i < x.length; i++) if (x[i]) nz.push(i);
    nz = Int32Array.from(nz);
    if (typeof x === 'object') NZ.set(x, nz);
  }
  return nz;
}

export class Net {
  /** `dim` inputs, `fix` fix-head outputs, `hidden` trunk widths. */
  constructor({ dim, fix = 0, hidden = [64, 32], seed = 'pixelgen' } = {}) {
    const rnd = rand(seed);
    this.dim = dim;
    this.nFix = fix;
    this.hidden = hidden;
    this.h1 = layer(dim, hidden[0], rnd);
    this.h2 = layer(hidden[0], hidden[1], rnd);
    this.beauty = layer(hidden[1], 1, rnd);
    this.fix = layer(hidden[1], Math.max(1, fix), rnd);
    this.norm = null; // {mean, sd} for the first mean.length inputs (the dense aesthetic block)
    this.meta = {};
  }

  /** Standardise the first `count` inputs by their mean and spread over `rows`. */
  fitNorm(rows, count) {
    const mean = new Float64Array(count);
    const sd = new Float64Array(count);
    for (const r of rows) for (let i = 0; i < count; i++) mean[i] += r.x[i] / rows.length;
    for (const r of rows) for (let i = 0; i < count; i++) sd[i] += (r.x[i] - mean[i]) ** 2 / rows.length;
    for (let i = 0; i < count; i++) sd[i] = Math.max(0.02, Math.sqrt(sd[i]));
    this.norm = { mean, sd };
  }

  /** The input as the trunk sees it. */
  input(x) {
    if (!this.norm) return x;
    let seen = NORMED.get(x);
    if (seen?.norm === this.norm) return seen.y;
    const { mean, sd } = this.norm;
    const y = Float32Array.from(x);
    for (let i = 0; i < mean.length; i++) y[i] = (x[i] - mean[i]) / sd[i];
    NORMED.set(x, { norm: this.norm, y });
    return y;
  }

  /** Forward pass; with `drop` (a 0..1 stream and rate) it applies dropout and keeps activations. */
  forward(x0, drop = null) {
    const x = this.input(x0);
    const dense = (L, inp, act) => {
      const out = new Float64Array(L.m);
      for (let o = 0; o < L.m; o++) {
        let s = L.b[o];
        const row = o * L.n;
        for (let i = 0; i < L.n; i++) if (inp[i]) s += L.w[row + i] * inp[i];
        out[o] = act ? act(s) : s;
      }
      return out;
    };
    const H1 = this.h1;
    const nz = nonZero(x);
    const a1 = new Float64Array(H1.m);
    for (let o = 0; o < H1.m; o++) {
      let s = H1.b[o];
      const row = o * H1.n;
      for (const i of nz) s += H1.w[row + i] * x[i];
      a1[o] = relu(s);
    }
    let m1 = null;
    if (drop) {
      m1 = new Float64Array(a1.length);
      const keep = 1 - drop.rate;
      for (let i = 0; i < a1.length; i++) {
        m1[i] = drop.rnd() < keep ? 1 / keep : 0;
        a1[i] *= m1[i];
      }
    }
    const a2 = dense(this.h2, a1, relu);
    const beauty = sigmoid(dense(this.beauty, a2)[0]);
    const fix = dense(this.fix, a2).map(sigmoid);
    return { x, a1, m1, a2, beauty, fix };
  }

  /** {beauty 0..1, fix: one 0..1 per fix target}. */
  predict(x) {
    const { beauty, fix } = this.forward(x);
    return { beauty, fix: this.nFix ? fix : new Float64Array(0) };
  }

  toJSON() {
    const L = (l) => ({ n: l.n, m: l.m, w: Array.from(l.w, (v) => +v.toPrecision(6)), b: Array.from(l.b, (v) => +v.toPrecision(6)) });
    const norm = this.norm && { mean: Array.from(this.norm.mean, (v) => +v.toPrecision(6)), sd: Array.from(this.norm.sd, (v) => +v.toPrecision(6)) };
    return { v: 1, dim: this.dim, fix: this.nFix, hidden: this.hidden, meta: this.meta, norm, ...Object.fromEntries(NAMES.map((k) => [k, L(this[k])])) };
  }

  static fromJSON(j) {
    const net = new Net({ dim: j.dim, fix: j.fix, hidden: j.hidden });
    for (const k of NAMES) {
      net[k] = { n: j[k].n, m: j[k].m, w: Float64Array.from(j[k].w), b: Float64Array.from(j[k].b) };
    }
    net.norm = j.norm ? { mean: Float64Array.from(j.norm.mean), sd: Float64Array.from(j.norm.sd) } : null;
    net.meta = j.meta ?? {};
    return net;
  }

  clone() {
    return Net.fromJSON(this.toJSON());
  }
}

/**
 * Train in place on rows `{x, y, w = 1, fix?: Float32Array, fixMask?: Float32Array}`. Returns
 * {loss} of the last epoch. Options: epochs, lr, batch, l2, l2Mask (per input), dropout, seed,
 * fixWeight.
 */
export function train(net, rows, { epochs = 60, lr = 0.01, batch = 16, l2 = 1e-3, l2Mask = null, dropout = 0.1, seed = 'train', fixWeight = 0.5 } = {}) {
  if (!rows.length) return { loss: 0 };
  const rnd = rand(seed);
  const params = NAMES.flatMap((k) => [net[k].w, net[k].b]);
  const adam = params.map((p) => ({ m: new Float64Array(p.length), v: new Float64Array(p.length) }));
  const grads = params.map((p) => new Float64Array(p.length));
  const [B1, B2, EPS] = [0.9, 0.999, 1e-8];
  let t = 0;
  let last = 0;
  const order = rows.map((_, i) => i);
  for (let e = 0; e < epochs; e++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let loss = 0;
    let wsum = 0;
    for (let s = 0; s < order.length; s += batch) {
      grads.forEach((g) => g.fill(0));
      const chunk = order.slice(s, s + batch);
      let bw = 0;
      for (const r of chunk) {
        const row = rows[r];
        const w = row.w ?? 1;
        bw += w;
        loss += backprop(net, row, w, fixWeight, grads, { rnd, rate: dropout }) * w;
        wsum += w;
      }
      t++;
      const c1 = 1 - B1 ** t;
      const c2 = 1 - B2 ** t;
      const step = (p, g, st, i, decay) => {
        const gi = g[i] / (bw || 1) + decay * p[i];
        st.m[i] = B1 * st.m[i] + (1 - B1) * gi;
        st.v[i] = B2 * st.v[i] + (1 - B2) * gi * gi;
        p[i] -= (lr * (st.m[i] / c1)) / (Math.sqrt(st.v[i] / c2) + EPS);
      };
      // The first layer is updated lazily, only on the inputs this batch used: most inputs are
      // one-hot zeros, and a weight on an unused input has no gradient (L2 waits for its next use).
      const used = new Set();
      for (const r of chunk) for (const i of nonZero(net.input(rows[r].x))) used.add(i);
      const H1 = net.h1;
      for (let o = 0; o < H1.m; o++) for (const i of used) step(H1.w, grads[0], adam[0], o * H1.n + i, l2 * (l2Mask ? l2Mask[i] : 1));
      for (let k = 1; k < params.length; k++) {
        const p = params[k];
        for (let i = 0; i < p.length; i++) step(p, grads[k], adam[k], i, k % 2 === 0 ? l2 : 0);
      }
    }
    last = loss / (wsum || 1);
  }
  return { loss: last };
}

/** One row's gradients, added into `grads` (scaled by `w`); returns its loss. */
function backprop(net, row, w, fixWeight, grads, drop) {
  const { y } = row;
  const f = net.forward(row.x, drop);
  const { x } = f;
  let loss = -(y * Math.log(f.beauty + 1e-9) + (1 - y) * Math.log(1 - f.beauty + 1e-9));
  const d2 = new Float64Array(net.h2.m);
  const [gH1w, gH1b, gH2w, gH2b, gBw, gBb, gFw, gFb] = grads;
  // beauty head: dL/dz = p − y
  const db = (f.beauty - y) * w;
  gBb[0] += db;
  for (let i = 0; i < net.beauty.n; i++) {
    gBw[i] += db * f.a2[i];
    d2[i] += db * net.beauty.w[i];
  }
  // fix head, masked
  if (row.fix && net.nFix) {
    const F = net.fix;
    for (let o = 0; o < F.m; o++) {
      const mk = row.fixMask ? row.fixMask[o] : 1;
      if (!mk) continue;
      const p = f.fix[o];
      const tgt = row.fix[o];
      loss += fixWeight * mk * -(tgt * Math.log(p + 1e-9) + (1 - tgt) * Math.log(1 - p + 1e-9));
      const dz = fixWeight * mk * (p - tgt) * w;
      gFb[o] += dz;
      const r = o * F.n;
      for (let i = 0; i < F.n; i++) {
        gFw[r + i] += dz * f.a2[i];
        d2[i] += dz * F.w[r + i];
      }
    }
  }
  // h2
  const H2 = net.h2;
  const d1 = new Float64Array(H2.n);
  for (let o = 0; o < H2.m; o++) {
    if (f.a2[o] <= 0) continue;
    const dz = d2[o];
    gH2b[o] += dz;
    const r = o * H2.n;
    for (let i = 0; i < H2.n; i++) {
      gH2w[r + i] += dz * f.a1[i];
      d1[i] += dz * H2.w[r + i];
    }
  }
  // h1 (through dropout)
  const H1 = net.h1;
  for (let o = 0; o < H1.m; o++) {
    if (f.a1[o] <= 0) continue;
    const dz = d1[o] * (f.m1 ? f.m1[o] : 1);
    gH1b[o] += dz;
    const r = o * H1.n;
    for (const i of nonZero(x)) gH1w[r + i] += dz * x[i];
  }
  return loss;
}

/** A copy of `base` trained further on `rows`, gently: a personal model from the public one. */
export function fineTune(base, rows, opts = {}) {
  const net = base.clone();
  train(net, rows, { epochs: 40, lr: 0.004, dropout: 0.05, ...opts });
  return net;
}

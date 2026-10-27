// Indexed images to PNG files, in node. No canvas and no image library: the PNG is written by
// hand on top of zlib (the encoder fish.'s fish-sheet.mjs uses), so the CLI runs anywhere node does.

import { deflateSync } from 'node:zlib';
import { toRGBA } from './pixel/blit.js';
import { rgbOf } from './pixel/color.js';

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc(bytes) {
  let c = -1;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}

/** RGBA bytes (w*h*4) as a PNG file. */
export function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

/**
 * An indexed image as RGBA, scaled up by an integer factor with hard edges. `bg` (#hex) fills
 * the transparent pixels; leave it out to keep them clear.
 */
export function scaledRGBA(img, scale = 1, bg = null) {
  const src = toRGBA(img);
  const w = img.w * scale;
  const h = img.h * scale;
  const out = new Uint8ClampedArray(w * h * 4);
  const fill = bg ? [...rgbOf(bg), 255] : null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / scale) * img.w + Math.floor(x / scale)) * 4;
      const o = (y * w + x) * 4;
      if (fill && src[s + 3] === 0) out.set(fill, o);
      else out.set(src.subarray(s, s + 4), o);
    }
  }
  return { w, h, rgba: out };
}

/** An indexed image as a PNG file buffer. */
export function imagePNG(img, scale = 1, bg = null) {
  const { w, h, rgba } = scaledRGBA(img, scale, bg);
  return encodePNG(w, h, rgba);
}

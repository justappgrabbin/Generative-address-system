// Minimal pure-JS animated GIF89a encoder: fixed 6x7x6 colour cube (252 colours), LZW, looping.
const LV = [6, 7, 6];
function palette() { const p = new Uint8Array(256 * 3); let i = 0; for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) { p[i++] = Math.round(r * 51); p[i++] = Math.round(g * 42.5); p[i++] = Math.round(b * 51); } return p; }
function quant(img) { const n = img.width * img.height, o = new Uint8Array(n), d = img.data; for (let i = 0; i < n; i++) { const r = Math.round(d[i * 4] / 51), g = Math.round(d[i * 4 + 1] / 42.5), b = Math.round(d[i * 4 + 2] / 51); o[i] = r * 42 + g * 6 + b; } return o; }
function lzw(idx, out) { const min = 8, clear = 256, eoi = 257; let size = 9, next = 258, dict = new Map(), buf = 0, bits = 0; const bytes = [];
  const emit = (c) => { buf |= c << bits; bits += size; while (bits >= 8) { bytes.push(buf & 255); buf >>>= 8; bits -= 8; } };
  emit(clear); let cur = idx[0];
  for (let i = 1; i < idx.length; i++) { const k = idx[i], key = cur * 256 + k, v = dict.get(key); if (v !== undefined) { cur = v; continue; }
    emit(cur); if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; } else { emit(clear); dict = new Map(); size = 9; next = 258; } cur = k; }
  emit(cur); emit(eoi); if (bits > 0) bytes.push(buf & 255);
  out.push(min); for (let i = 0; i < bytes.length; i += 255) { const s = bytes.slice(i, i + 255); out.push(s.length, ...s); } out.push(0); }
export function encodeGif(frames, { delayCs = 8 } = {}) {
  const { width: w, height: h } = frames[0], out = [], u16 = (v) => out.push(v & 255, v >> 8);
  out.push(...[71, 73, 70, 56, 57, 97]); u16(w); u16(h); out.push(0xf7, 0, 0); out.push(...palette());
  out.push(0x21, 0xff, 11, ...[78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48], 3, 1, 0, 0, 0);
  for (const f of frames) { out.push(0x21, 0xf9, 4, 0, delayCs & 255, delayCs >> 8, 0, 0, 0x2c); u16(0); u16(0); u16(w); u16(h); out.push(0); lzw(quant(f), out); }
  out.push(0x3b); return new Uint8Array(out);
}

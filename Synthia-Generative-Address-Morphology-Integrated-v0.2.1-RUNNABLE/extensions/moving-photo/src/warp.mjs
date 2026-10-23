// Pure-JS backward warp with bilinear sampling. Pixels are moved from the real photo, never invented.
// Output pixels whose source falls outside the photo are marked uncovered (mask=0) for the fill step.
export function warp(img, p) {
  const { width: w, height: h, data } = img, out = new Uint8Array(w * h * 4), mask = new Uint8Array(w * h);
  const cx = w / 2, cy = h / 2, cos = Math.cos(-p.rotate || 0), sin = Math.sin(-p.rotate || 0), z = p.zoom || 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let dx = (x - cx) / z, dy = (y - cy) / z; let sx = dx * cos - dy * sin + cx - (p.panX || 0) * w, sy = dx * sin + dy * cos + cy - (p.panY || 0) * h;
    sx += (p.waveAmp || 0) * w * Math.sin((y / h) * Math.PI * 4 + (p.wavePhase || 0)); sy += (p.waveAmp || 0) * h * Math.sin((x / w) * Math.PI * 3 + (p.wavePhase || 0));
    const o = (y * w + x) * 4;
    if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) { out[o + 3] = 255; continue; }
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), fx = sx - x0, fy = sy - y0;
    for (let c = 0; c < 3; c++) { const a = data[(y0 * w + x0) * 4 + c], b = data[(y0 * w + x1) * 4 + c], d = data[(y1 * w + x0) * 4 + c], e = data[(y1 * w + x1) * 4 + c];
      out[o + c] = Math.round(a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy); }
    out[o + 3] = 255; mask[y * w + x] = 1;
  }
  return { image: { width: w, height: h, data: out }, mask };
}

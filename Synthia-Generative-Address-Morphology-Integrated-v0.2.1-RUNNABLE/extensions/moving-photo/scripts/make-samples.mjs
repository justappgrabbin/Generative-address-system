// Node-only demo (not runtime): writes frames, GIF, contact sheet and a JSON report.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import * as G from '../../generative-reconstruction/src/index.mjs';
import { makeMovingPhoto, encodeGif, rebuildFromLayers } from '../src/index.mjs';
const outDir = process.argv[2] || path.join(import.meta.dirname, '..', 'fixtures', 'out'); fs.mkdirSync(outDir, { recursive: true });
const SRC = ['/workspace/v05/n4/uc/grok_1786623505617.jpg', path.join(import.meta.dirname, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')].find((p) => fs.existsSync(p));
const bytes = new Uint8Array(fs.readFileSync(SRC)); const full = G.decodeJpeg(bytes); const img = G.downscale(full, 2);
const store = new G.GenerativeImageStore(); const m = store.store('photo', img, { sourceBytes: bytes });
const rebuilt = rebuildFromLayers(store, m.address); const q = G.psnr(img, rebuilt);
const exactOk = crypto.createHash('sha256').update(store.exactOriginal(m.address)).digest('hex') === crypto.createHash('sha256').update(bytes).digest('hex');
const start = { movement: -1, evolution: 0, being: 0, design: 0, space: 0 }, end = { movement: 1, evolution: 1, being: 1, design: 1, space: 1 };
const t0 = Date.now(); const frames = await makeMovingPhoto(rebuilt, { start, end, frames: 24 }); const ms = Date.now() - t0;
frames.forEach((f) => fs.writeFileSync(path.join(outDir, `frame-${String(f.index).padStart(2, '0')}.png`), G.encodePng(f.image)));
fs.writeFileSync(path.join(outDir, 'moving-photo.gif'), encodeGif(frames.map((f) => f.image), { delayCs: 8 }));
// contact sheet: 6x4 grid at 1/4 of frame size
const tw = frames[0].image.width >> 2, th = frames[0].image.height >> 2, cols = 6, rows = 4, sheet = { width: tw * cols, height: th * rows, data: new Uint8Array(tw * cols * th * rows * 4) };
frames.forEach((f, k) => { const s = G.downscale(f.image, 4), ox = (k % cols) * tw, oy = Math.floor(k / cols) * th; for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) sheet.data.set(s.data.subarray((y * s.width + x) * 4, (y * s.width + x) * 4 + 4), ((oy + y) * sheet.width + ox + x) * 4); });
fs.writeFileSync(path.join(outDir, 'contact-sheet.png'), G.encodePng(sheet));
const px = img.width * img.height, filled = frames.map((f) => f.filledPixels);
const report = { source: path.basename(SRC), frameSize: `${img.width}x${img.height} (half of ${full.width}x${full.height})`, frames: frames.length, address: m.address,
  rebuild: { psnr: +q.psnr.toFixed(2), maxError: q.maxError, exactOriginalSha256Match: exactOk },
  filledPct: { min: +(100 * Math.min(...filled) / px).toFixed(2), max: +(100 * Math.max(...filled) / px).toFixed(2), mean: +(100 * filled.reduce((a, b) => a + b, 0) / frames.length / px).toFixed(2) }, renderMs: ms };
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1));

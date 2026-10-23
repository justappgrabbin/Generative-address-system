// Node-only demo (not part of the runtime path): writes sample PNGs and prints the PSNR table as JSON.
import fs from 'node:fs'; import path from 'node:path';
import * as G from '../src/index.mjs';
const outDir = process.argv[2] || path.join(import.meta.dirname, '..', 'fixtures', 'out');
const factor = Number(process.argv[3] || 4);
fs.mkdirSync(outDir, { recursive: true });
const SRC = '/workspace/v05/n4/uc/grok_1786623505617.jpg';
const jpgPath = fs.existsSync(SRC) ? SRC : path.join(import.meta.dirname, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg');
const bytes = new Uint8Array(fs.readFileSync(jpgPath));
const full = G.decodeJpeg(bytes); const img = factor > 1 ? G.downscale(full, factor) : full;
const save = (n, im) => fs.writeFileSync(path.join(outDir, n), G.encodePng(im));
const store = new G.GenerativeImageStore(); const m = store.store('photo', img, { sourceBytes: bytes });
const table = { image: `${img.width}x${img.height} (photo.jpg downscaled x${factor})`, address: m.address, layers: [] };
save('original.png', img);
for (let n = 1; n <= m.layers.length; n++) { const r = store.reconstruct(m.address, { layers: [...Array(n).keys()] }); const q = G.psnr(img, r.image); table.layers.push({ layers: n, psnr: +q.psnr.toFixed(2), maxError: q.maxError }); if ([1, 3, 6].includes(n)) save(`layers-${n === 6 ? 'all' : n}.png`, r.image); }
const an = G.analyze(img), known = G.randomBlockMask(an, 0.25), dmg = G.damage(an, known);
save('damaged-25pct.png', G.synthesize(dmg));
const naive = G.synthesize(G.naiveRepair(dmg, known)); save('naive-fill.png', naive);
const t0 = Date.now(); const rep = G.psoRepair(dmg, known); const psoImg = G.synthesize(rep); save('pso-repaired.png', psoImg);
table.repair25 = { droppedBlocks: known.length - known.reduce((a, b) => a + b, 0), totalBlocks: known.length, damaged: +G.psnr(img, G.synthesize(dmg)).psnr.toFixed(2), naive: +G.psnr(img, naive).psnr.toFixed(2), pso: +G.psnr(img, psoImg).psnr.toFixed(2), psoMs: Date.now() - t0, evals: rep.evals };
const hole = G.rectMask(an, { x0: Math.floor(an.bx * 0.4), y0: Math.floor(an.by * 0.4), x1: Math.floor(an.bx * 0.4) + 4, y1: Math.floor(an.by * 0.4) + 4 });
const hd = G.damage(an, hole), hn = G.synthesize(G.naiveRepair(hd, hole)), hp = G.synthesize(G.psoRepair(hd, hole));
save('hole-pso-repaired.png', hp);
table.hole32px = { naive: +G.psnr(img, hn).psnr.toFixed(2), pso: +G.psnr(img, hp).psnr.toFixed(2) };
// in-between: frame A = photo, frame B = photo shifted 16px right
const B = { width: img.width, height: img.height, data: new Uint8Array(img.data.length) }; for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const sx = Math.max(0, x - 16); B.data.set(img.data.subarray((y * img.width + sx) * 4, (y * img.width + sx) * 4 + 4), (y * img.width + x) * 4); }
const mb = store.store('frameB', B); const a1 = store.load(m.address), b1 = store.load(mb.address);
const mid = G.synthesize(G.interpolateCoefs(a1, b1, 0.5)); save('frameB.png', B); save('inbetween-t0.5.png', mid);
table.inbetween = { psnrVsA: +G.psnr(img, mid).psnr.toFixed(2), psnrVsB: +G.psnr(B, mid).psnr.toFixed(2) };
table.exactOriginalSha256Match = G.GenerativeImageStore && (await import('../../translation-layer/src/sha256.mjs')).sha256Hex(store.exactOriginal(m.address)) === m.sourceSha256;
console.log(JSON.stringify(table, null, 1));

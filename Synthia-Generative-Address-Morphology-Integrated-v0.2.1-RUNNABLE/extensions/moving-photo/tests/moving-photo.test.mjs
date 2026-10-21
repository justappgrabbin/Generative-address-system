import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import * as G from '../../generative-reconstruction/src/index.mjs';
import { makeMovingPhoto, encodeGif, rebuildFromLayers, warp } from '../src/index.mjs';
const HERE = import.meta.dirname;
const JPG = ['/workspace/v05/n4/uc/grok_1786623505617.jpg', path.join(HERE, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')].find((p) => fs.existsSync(p));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const bytes = new Uint8Array(fs.readFileSync(JPG)); const img = G.downscale(G.decodeJpeg(bytes), 8);
const store = new G.GenerativeImageStore(); const m = store.store('p', img, { sourceBytes: bytes });
const S = { movement: -1, evolution: 0, being: 0, design: 0, space: 0 }, E = { movement: 1, evolution: 1, being: 1, design: 1, space: 1 };
test('rebuild from addressed layers matches the stored original', () => {
  assert.equal(sha(store.exactOriginal(m.address)), sha(bytes));
  const q = G.psnr(img, rebuildFromLayers(store, m.address)); assert.ok(q.maxError <= 1, `maxError ${q.maxError}`);
});
test('vendored video-generator is byte-exact to provenance sha256', () => {
  assert.equal(sha(fs.readFileSync(path.join(HERE, '..', 'vendor', 'video-generator', 'video-generator.mjs'))), 'e5f33c8f6fdd0eed1c051cb1066a91f098bd68ab3170d54692a1d9ffcf9ff5bd');
});
test('identity warp moves no pixels and leaves nothing uncovered', () => {
  const r = warp(img, {}); assert.ok(r.mask.every((v) => v === 1)); assert.ok(r.image.data.every((v, i) => v === img.data[i]));
});
test('frames are deterministic for the same address path, covered pixels come from the photo', async () => {
  const a = await makeMovingPhoto(img, { start: S, end: E, frames: 6 }), b = await makeMovingPhoto(img, { start: S, end: E, frames: 6 });
  assert.equal(a.length, 6); a.forEach((f, i) => assert.equal(sha(f.image.data), sha(b[i].image.data)));
  assert.ok(a.some((f) => f.filledPixels > 0)); assert.ok(a.every((f) => f.filledPixels < img.width * img.height * 0.2));
  const c = await makeMovingPhoto(img, { start: S, end: { ...E, movement: -1 }, frames: 6 }); assert.notEqual(sha(c[5].image.data), sha(a[5].image.data));
});
test('GIF encoder writes a valid looping GIF89a', () => {
  const g = encodeGif([img, img]); assert.equal(String.fromCharCode(...g.subarray(0, 6)), 'GIF89a'); assert.equal(g[g.length - 1], 0x3b);
});

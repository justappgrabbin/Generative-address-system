import test from 'node:test'; import assert from 'node:assert/strict';
import { G, jpegBytes, synthetic } from './helpers.mjs';
import { sha256Hex } from '../../translation-layer/src/sha256.mjs';
const photo = G.downscale(G.decodeJpeg(jpegBytes()), 4);
for (const [name, img, src] of [['photo', photo, jpegBytes()], ['generated PNG', G.decodePng(G.encodePng(synthetic())), null]]) {
  test(`${name}: addressed layers, monotonic progressive PSNR, full > 40 dB`, () => {
    const store = new G.GenerativeImageStore(); const m = store.store(name, img, { sourceBytes: src });
    assert.match(m.address, /^genrec:\/\/image\/[0-9a-f]{64}$/); assert.equal(m.layers.length, 6);
    for (const L of m.layers) { assert.match(L.address, /^morphmir:\/\/manifest\/[0-9a-f]{64}$/); assert.equal(store.memory.rebuild(L.address).sha256, L.sha256); }
    let prev = -1; const ps = [];
    for (let n = 1; n <= 6; n++) { const q = G.psnr(img, store.reconstruct(m.address, { layers: [...Array(n).keys()] }).image).psnr; ps.push(q); assert.ok(q > prev, `PSNR not increasing at ${n}: ${ps}`); prev = q; }
    assert.ok(ps[5] > 40, `full PSNR ${ps[5]}`);
    if (src) assert.equal(sha256Hex(store.exactOriginal(m.address)), sha256Hex(src));
  });
}
test('missing/corrupt layer degrades instead of failing; supersedes on re-store', () => {
  const store = new G.GenerativeImageStore(); const img = synthetic(); const m = store.store('f', img);
  const last = m.layers[5]; const rec = store.memory.records.get(store.memory.manifests.get(last.address).chunks[0]);
  store.memory.records.set(rec.address, Object.freeze({ ...rec, bytes: rec.bytes.map((b) => b ^ 1) }));
  const r = store.reconstruct(m.address); assert.deepEqual(r.used, [0, 1, 2, 3, 4]); assert.equal(r.missing[0].reason, 'CHUNK_INTEGRITY');
  const m2 = store.store('f', synthetic(96, 64, 50)); assert.equal(m2.supersedes, m.address); assert.ok(m2.layers.some((L) => L.supersedes));
});

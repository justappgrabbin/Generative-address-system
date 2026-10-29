import test from 'node:test'; import assert from 'node:assert/strict';
import { G, jpegBytes, synthetic } from './helpers.mjs';
const img = G.downscale(G.decodeJpeg(jpegBytes()), 4); const an = G.analyze(img);
test('PSO repair beats naive fill with 25% of blocks dropped', () => {
  const known = G.randomBlockMask(an, 0.25), d = G.damage(an, known);
  const dmg = G.psnr(img, G.synthesize(d)).psnr, naive = G.psnr(img, G.synthesize(G.naiveRepair(d, known))).psnr, pso = G.psnr(img, G.synthesize(G.psoRepair(d, known))).psnr;
  assert.ok(naive > dmg && pso > naive, JSON.stringify({ dmg, naive, pso }));
});
test('PSO repair beats naive fill on a missing 32x32 region', () => {
  const known = G.rectMask(an, { x0: 9, y0: 14, x1: 13, y1: 18 }), d = G.damage(an, known);
  const naive = G.psnr(img, G.synthesize(G.naiveRepair(d, known))).psnr, pso = G.psnr(img, G.synthesize(G.psoRepair(d, known))).psnr;
  assert.ok(pso > naive, JSON.stringify({ naive, pso }));
});
test('interpolation between two addressed frames produces in-between frames', () => {
  const store = new G.GenerativeImageStore(); const A = synthetic(96, 64, 30), B = synthetic(96, 64, 66);
  const a = store.load(store.store('A', A).address), b = store.load(store.store('B', B).address);
  const f0 = G.synthesize(G.interpolateCoefs(a, b, 0)), f1 = G.synthesize(G.interpolateCoefs(a, b, 1)), mid = G.synthesize(G.interpolateCoefs(a, b, 0.5));
  assert.ok(G.psnr(A, f0).psnr > 40 && G.psnr(B, f1).psnr > 40);
  const pa = G.psnr(A, mid).psnr, pb = G.psnr(B, mid).psnr; assert.ok(Number.isFinite(pa) && Math.abs(pa - pb) < 3 && pa < 40);
});
test('registry: other backend first, pure JS takes over on failure', async () => {
  const reg = G.createGenerativeReconstruction(); const store = new G.GenerativeImageStore(); const m = store.store('x', synthetic());
  let r = await reg.run('reconstruct', { store, address: m.address }); assert.equal(r.backend, 'pure-js');
  reg.register({ name: 'ok', reconstruct: () => 'ok' }); r = await reg.run('reconstruct', { store, address: m.address }); assert.equal(r.backend, 'ok');
  const reg2 = G.createGenerativeReconstruction().register({ name: 'broken', reconstruct: () => { throw new Error('down'); } });
  r = await reg2.run('reconstruct', { store, address: m.address }); assert.equal(r.backend, 'pure-js'); assert.equal(r.attempts[0].error, 'down'); assert.ok(G.psnr(synthetic(), r.result.image).psnr > 40);
});


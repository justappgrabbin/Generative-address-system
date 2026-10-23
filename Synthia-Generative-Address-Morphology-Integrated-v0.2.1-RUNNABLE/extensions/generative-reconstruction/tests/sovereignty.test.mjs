import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { HERE, JPG } from './helpers.mjs';
const SRC = path.join(HERE, '..', 'src');
test('runtime source has no network, worker, wasm, gpu, dynamic-import or Node-only API references', () => {
  const forbidden = [/from\s+['"]node:/, /require\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /\bWorker\b/, /WebAssembly/, /navigator\.gpu/, /\bprocess\./, /\bBuffer\b/, /https?:\/\//, /sendBeacon/, /importScripts/];
  for (const f of fs.readdirSync(SRC)) { const text = fs.readFileSync(path.join(SRC, f), 'utf8'); for (const re of forbidden) assert.ok(!re.test(text), `${f} matches ${re}`); for (const m of text.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+['"]([^'"]+)['"]/gm)) assert.ok(m[1].startsWith('./') || m[1].startsWith('../'), `${f} imports ${m[1]}`); }
});
test('full pipeline runs with network/workers/wasm blocked and process/Buffer removed', () => {
  const probe = `
    const out = process.stdout.write.bind(process.stdout); const hits = [];
    const block = (n) => function () { hits.push(n); throw new Error('blocked: ' + n); };
    for (const n of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker']) globalThis[n] = block(n);
    globalThis.WebAssembly = new Proxy({}, { get() { hits.push('WebAssembly'); throw new Error('wasm blocked'); } });
    const fs = await import('node:fs'); const bytes = new Uint8Array(fs.readFileSync(${JSON.stringify(JPG)}));
    const saved = { process: globalThis.process, Buffer: globalThis.Buffer, setImmediate: globalThis.setImmediate };
    globalThis.process = undefined; globalThis.Buffer = undefined; globalThis.setImmediate = undefined;
    const G = await import(${JSON.stringify(path.join(SRC, 'index.mjs'))});
    const img = G.downscale(G.decodeJpeg(bytes), 8); const store = new G.GenerativeImageStore(); const m = store.store('p', img, { sourceBytes: bytes });
    const full = G.psnr(img, store.reconstruct(m.address).image).psnr; const an = G.analyze(img); const k = G.randomBlockMask(an, 0.25);
    const rep = G.psnr(img, G.synthesize(G.psoRepair(G.damage(an, k), k, { iterations: 10 }))).psnr;
    const png = G.decodePng(G.encodePng(img)); const lossless = png.data.every((v, i) => v === img.data[i]);
    Object.assign(globalThis, saved);
    out(JSON.stringify({ hits, full, rep, lossless }));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); const res = JSON.parse(r.stdout);
  assert.deepEqual(res.hits, []); assert.ok(res.full > 40); assert.ok(res.rep > 15); assert.equal(res.lossless, true);
});

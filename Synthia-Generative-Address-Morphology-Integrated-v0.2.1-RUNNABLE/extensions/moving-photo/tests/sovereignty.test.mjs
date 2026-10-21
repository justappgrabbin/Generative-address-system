import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const HERE = import.meta.dirname, SRC = path.join(HERE, '..', 'src'), VG = path.join(HERE, '..', 'vendor', 'video-generator', 'video-generator.mjs');
const JPG = ['/workspace/v05/n4/uc/grok_1786623505617.jpg', path.join(HERE, '..', '..', 'morphmir-memory', 'fixtures', 'photo.jpg')].find((p) => fs.existsSync(p));
test('runtime source has no network, worker, wasm, gpu or Node-only references', () => {
  const forbidden = [/from\s+['"]node:/, /require\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /\bWorker\b/, /WebAssembly/, /navigator\.gpu/, /\bprocess\./, /\bBuffer\b/, /https?:\/\//];
  for (const f of [...fs.readdirSync(SRC).map((x) => path.join(SRC, x)), VG]) { const t = fs.readFileSync(f, 'utf8'); for (const re of forbidden) assert.ok(!re.test(t), `${f} matches ${re}`); }
});
test('pipeline runs with network/workers/wasm blocked and process/Buffer removed', () => {
  const probe = `
    const out = process.stdout.write.bind(process.stdout); const hits = [];
    const block = (n) => function () { hits.push(n); throw new Error('blocked ' + n); };
    for (const n of ['fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker']) globalThis[n] = block(n);
    globalThis.WebAssembly = new Proxy({}, { get() { hits.push('WebAssembly'); throw new Error('wasm blocked'); } });
    const fs = await import('node:fs'); const bytes = new Uint8Array(fs.readFileSync(${JSON.stringify(JPG)}));
    const saved = { process: globalThis.process, Buffer: globalThis.Buffer }; globalThis.process = undefined; globalThis.Buffer = undefined;
    const G = await import(${JSON.stringify(path.join(HERE, '..', '..', 'generative-reconstruction', 'src', 'index.mjs'))});
    const M = await import(${JSON.stringify(path.join(SRC, 'index.mjs'))});
    const img = G.downscale(G.decodeJpeg(bytes), 8);
    const fr = await M.makeMovingPhoto(img, { start: { movement: -1 }, end: { movement: 1, being: 1, space: 1 }, frames: 4 });
    const gif = M.encodeGif(fr.map((f) => f.image));
    Object.assign(globalThis, saved); out(JSON.stringify({ hits, n: fr.length, gif: gif.length }));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); const res = JSON.parse(r.stdout); assert.deepEqual(res.hits, []); assert.equal(res.n, 4); assert.ok(res.gif > 100);
});

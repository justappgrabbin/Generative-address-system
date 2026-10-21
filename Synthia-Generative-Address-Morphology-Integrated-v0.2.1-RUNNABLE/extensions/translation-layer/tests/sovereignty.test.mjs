import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HERE } from './helpers.mjs';

const SRC = path.join(HERE, '..', 'src');
const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]));

test('runtime source has no network, worker, wasm, gpu, dynamic-import or Node-only API references', () => {
  const forbidden = [/from\s+['"]node:/, /require\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /\bWorker\b/, /WebAssembly/, /navigator\.gpu/, /\bprocess\./, /\bBuffer\b/, /https?:\/\//, /sendBeacon/, /importScripts/];
  for (const f of files(SRC)) {
    const text = fs.readFileSync(f, 'utf8');
    for (const re of forbidden) assert.ok(!re.test(text), `${path.relative(SRC, f)} matches ${re}`);
    for (const m of text.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+['"]([^'"]+)['"]/gm)) assert.ok(m[1].startsWith('./') || m[1].startsWith('../'), `${f} imports ${m[1]}`);
  }
});

test('runs with the network blocked and Node globals removed (browser/WebView-like host)', () => {
  const probe = `
    const out = process.stdout.write.bind(process.stdout);
    const hits = [];
    const block = (n) => function () { hits.push(n); throw new Error('network blocked: ' + n); };
    for (const n of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker']) globalThis[n] = block(n);
    globalThis.WebAssembly = new Proxy({}, { get() { hits.push('WebAssembly'); throw new Error('wasm blocked'); } });
    const realProcess = globalThis.process;
    const mod = await import(${JSON.stringify(path.join(SRC, 'index.mjs'))});
    const fs = await import('node:fs');
    const fix = ${JSON.stringify(path.join(HERE, '..', 'fixtures'))};
    const srcs = Object.fromEntries(['t.py','t.rb','t.lua','t.c'].map(f => [f, fs.readFileSync(fix + '/' + f, 'utf8')]));
    // remove Node-only globals for the duration of execution
    const saved = { process: globalThis.process, Buffer: globalThis.Buffer, setImmediate: globalThis.setImmediate };
    globalThis.process = undefined; globalThis.Buffer = undefined; globalThis.setImmediate = undefined;
    const adapter = mod.createTranslationLayerAdapter();
    const results = [];
    for (const [name, content] of Object.entries(srcs)) results.push(await adapter.execute({ artifact: { name, content } }));
    Object.assign(globalThis, saved);
    out(JSON.stringify({ hits, results: results.map(r => ({ ok: r.ok, engine: r.engine, lines: r.stdout.length })) }));
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const { hits, results } = JSON.parse(r.stdout);
  assert.deepEqual(hits, []);
  assert.equal(results.length, 4);
  for (const x of results) assert.equal(x.ok, true, JSON.stringify(x));
});

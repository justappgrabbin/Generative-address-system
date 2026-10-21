import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MorphMirMemory, ExactChunkMemory, looksBinary } from '../src/index.mjs';
import { MorphMemoryEngine } from '../../../authorities/execution-spine/src/pure-synthia/automata/tools/tool-16-morph-mir.js';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const sha = (b) => createHash('sha256').update(b).digest('hex'); // independent (node) hash to cross-check the pure-JS one
function randomBytes(n, seed = 7) { const out = new Uint8Array(n); let a = seed; for (let i = 0; i < n; i++) { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; out[i] = (t ^ (t >>> 14)) & 255; } return out; }
const cases = [
  ['photo.jpg', new Uint8Array(fs.readFileSync(path.join(FIX, 'photo.jpg'))), '389481fa282d47552cf2f70fc2707818e1f56b6304feeed7e6c18228c36d2cd3'],
  ['gradient.png', new Uint8Array(fs.readFileSync(path.join(FIX, 'gradient.png'))), 'af294b42c2fed0af0c992da92566f02617bd1c766544b1a6529731a00a7d76ab'],
  ['random.bin', randomBytes(1_000_003), null],
];

for (const [name, bytes, expected] of cases) {
  test(`${name} (${bytes.length} bytes) round-trips byte-exact through regenerate(mode:'exact')`, () => {
    if (expected) assert.equal(sha(bytes), expected);
    const mm = new MorphMirMemory();
    const art = mm.ingest({ name, content: bytes });
    assert.ok(art.binary, 'detected as binary');
    mm.analyze(art.id);
    const r = mm.regenerate(art.id, { mode: 'exact' });
    assert.equal(r.isExact, true);
    assert.equal(r.bytes.length, bytes.length);
    assert.equal(sha(r.bytes), sha(bytes));
    assert.equal(r.sha256, sha(bytes));
    assert.equal(r.chunkCount, Math.ceil(bytes.length / 16384));
  });
}

test('the original MorphMir drops bytes on the same photo (baseline, unchanged)', () => {
  const orig = new MorphMemoryEngine(); const s = Buffer.from(cases[0][1]).toString('base64');
  const a = orig.ingest({ name: 'p', content: s }); orig.analyze(a.id);
  assert.equal(orig.regenerate(a.id, { mode: 'exact' }).isExact, false);
});

test('text/code keeps MorphMir behaviour exactly as before', () => {
  const src = "export function add(a, b) {\n  return a + b;\n}\nconsole.log(add(2, 3));\n".repeat(30);
  const before = new MorphMemoryEngine(), after = new MorphMirMemory();
  const a1 = before.ingest({ name: 'x.js', content: src }), a2 = after.ingest({ name: 'x.js', content: src });
  assert.equal(a2.binary, undefined);
  before.analyze(a1.id); after.analyze(a2.id);
  for (const mode of ['exact', 'equivalent', 'morph_runtime']) {
    const r1 = before.regenerate(a1.id, { mode }), r2 = after.regenerate(a2.id, { mode });
    assert.deepEqual({ ...r2 }, { ...r1 }, mode);
  }
  assert.equal(looksBinary(new TextEncoder().encode(src)), false);
  // UTF-8 bytes given as Uint8Array are treated as text too
  const a3 = after.ingest({ name: 'u.py', content: new TextEncoder().encode('print("héllo")\n') });
  assert.equal(a3.binary, undefined); assert.equal(a3.originalContent, 'print("héllo")\n');
});

test('a single chunk can be recalled by its address and carries address/sha256/index/byteLength', () => {
  const mm = new MorphMirMemory(); const bytes = cases[0][1];
  const art = mm.ingest({ name: 'photo.jpg', content: bytes });
  const m = mm.memory.manifests.get(art.binary.manifestAddress);
  const c = mm.recallChunk(m.chunks[5]);
  assert.equal(c.address, `morphmir://chunk/${m.sha256}/5`);
  assert.equal(c.index, 5); assert.equal(c.start, 5 * 16384); assert.equal(c.byteLength, 16384);
  assert.equal(sha(c.bytes), c.sha256);
  assert.deepEqual([...c.bytes], [...bytes.slice(5 * 16384, 6 * 16384)]);
});

test('a corrupted chunk is detected (per-chunk hash) and regenerate refuses', () => {
  const mm = new MorphMirMemory(); const art = mm.ingest({ name: 'photo.jpg', content: cases[0][1] }); mm.analyze(art.id);
  const addr = mm.memory.manifests.get(art.binary.manifestAddress).chunks[3];
  const rec = mm.memory.records.get(addr); const bad = rec.bytes.slice(); bad[100] ^= 0xff;
  mm.memory.records.set(addr, Object.freeze({ ...rec, bytes: bad }));
  assert.throws(() => mm.recallChunk(addr), (e) => e.code === 'CHUNK_INTEGRITY');
  assert.throws(() => mm.regenerate(art.id, { mode: 'exact' }), (e) => e.code === 'CHUNK_INTEGRITY');
});

test('re-storing a changed file links supersedes on the manifest and on changed chunks only', () => {
  const mem = new ExactChunkMemory(); const a = randomBytes(50_000, 1); const b = a.slice(); b[40_000] ^= 1;
  const m1 = mem.store('f', a), m2 = mem.store('f', b);
  assert.equal(m2.supersedes, m1.address);
  const changed = m2.chunks.map((x) => mem.records.get(x).supersedes);
  assert.deepEqual(changed, [null, null, m1.chunks[2], null]);
});

test('snapshot export/import (for browser storage) restores exact bytes', () => {
  const mm = new MorphMirMemory(); const art = mm.ingest({ name: 'g.png', content: cases[1][1] });
  const restored = ExactChunkMemory.import(JSON.parse(JSON.stringify(mm.memory.export())));
  assert.equal(sha(restored.rebuild(art.binary.manifestAddress).bytes), cases[1][2]);
});

test('runtime source is browser-safe (relative imports only, no Node/network APIs)', () => {
  const text = fs.readFileSync(path.join(FIX, '..', 'src', 'index.mjs'), 'utf8');
  for (const re of [/from\s+['"]node:/, /require\(/, /\bfetch\(/, /XMLHttpRequest|WebSocket|\bWorker\b|WebAssembly/, /\bBuffer\b/, /\bprocess\./]) assert.ok(!re.test(text), String(re));
});

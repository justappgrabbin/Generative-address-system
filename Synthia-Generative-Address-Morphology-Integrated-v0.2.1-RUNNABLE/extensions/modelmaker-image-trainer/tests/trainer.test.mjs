import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { T, SIZE, photoPairs, SRC, JPG } from './helpers.mjs';
const pairs = photoPairs(); const r = T.train(pairs, { size: SIZE, epochs: 60 });
test('her ImageField trains on photo crops and loss goes down', () => {
  assert.ok(JPG); assert.ok(r.final.train < r.baseline.train * 0.8, JSON.stringify([r.baseline, r.final]));
  assert.ok(r.history.every((h) => Number.isFinite(h.train)));
});
test('unseen address (gate 17) yields output distinct from every training target and from seen-gate output', () => {
  const src = pairs[0].source, gen = T.generate(r.model, src, SIZE, { ...T.DEFAULT_ADDRESS, gate: 17 });
  for (const p of pairs) assert.ok(T.mse(gen, p.target) > 1e-4, p.name);
  assert.ok(T.mse(gen, T.generate(r.model, src, SIZE, { ...T.DEFAULT_ADDRESS, gate: 1 })) > 1e-7);
  assert.ok(gen.every((v) => v >= 0 && v <= 1));
});
test('save to genrec://model/<sha> and reload gives identical output; versions + supersedes link', () => {
  const s = new T.ModelStore(); const a = s.save('photo', r.model);
  assert.match(a.address, /^genrec:\/\/model\/[0-9a-f]{64}$/); assert.equal(a.version, 1); assert.equal(a.supersedes, null);
  const src = pairs[0].source, adr = { ...T.DEFAULT_ADDRESS, gate: 17 };
  assert.deepEqual(T.generate(s.load(a.address), src, SIZE, adr), T.generate(r.model, src, SIZE, adr));
  const r2 = T.train(pairs, { size: SIZE, epochs: 2, seed: 7 }); const b = s.save('photo', r2.model);
  assert.equal(b.version, 2); assert.equal(b.supersedes, a.address);
});
test('persistence across a fresh process restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-')), snap = path.join(dir, 'snap.json');
  const s = new T.ModelStore(); const rec = s.save('photo', r.model); fs.writeFileSync(snap, JSON.stringify(s.export()));
  const src = pairs[0].source, adr = { ...T.DEFAULT_ADDRESS, gate: 17 }, expect = Array.from(T.generate(r.model, src, SIZE, adr));
  const probe = `const fs=await import('node:fs');const T=await import(${JSON.stringify(SRC)});const s=T.ModelStore.fromSnapshot(JSON.parse(fs.readFileSync(${JSON.stringify(snap)},'utf8')));
    const src=Float32Array.from(${JSON.stringify(Array.from(src))});process.stdout.write(JSON.stringify(Array.from(T.generate(s.load(${JSON.stringify(rec.address)}),src,${SIZE},${JSON.stringify(adr)}))));`;
  const p = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { encoding: 'utf8' }); assert.equal(p.status, 0, p.stderr);
  assert.deepEqual(JSON.parse(p.stdout), expect);
});
test('optional LearningMesh record (her vendored LearningMesh, unchanged)', async () => {
  const meshPath = path.join(import.meta.dirname, '..', '..', '..', 'vendor', 'cynthia-original', 'r21.21', 'browser', 'LearningMesh.mjs');
  if (!fs.existsSync(meshPath)) return; const { LearningMesh } = await import(meshPath);
  const s = new T.ModelStore(), rec = s.save('photo', r.model), l = await T.publishToMesh(new LearningMesh(), rec, r);
  assert.equal(l.value, rec.address); assert.ok(l.evidence.includes('mapping:investigating'));
});

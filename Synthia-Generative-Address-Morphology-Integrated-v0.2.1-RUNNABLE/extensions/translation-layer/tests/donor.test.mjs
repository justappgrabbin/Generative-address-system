import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runSource } from '../src/index.mjs';
import { FIX, DONOR, read, deepClose } from './helpers.mjs';

// The oracle was produced once by CPython 3.13.5 + numpy 2.5.4 running the same donor+driver; it is only a
// recorded fixture. The runtime path below never calls Python.
test('donor address_space_engine.py runs end-to-end and matches the recorded CPython+numpy output', () => {
  const src = read(DONOR) + '\n' + read(path.join(FIX, 'address_space_engine_driver.py'));
  const r = runSource('python', src);
  assert.equal(r.ok, true, r.stderr.join('\n'));
  const oracle = read(path.join(FIX, 'address_space_engine.cpython-oracle.txt')).trimEnd().split('\n');
  assert.equal(r.stdout.length, oracle.length);
  for (let i = 0; i < 3; i++) {
    const diffs = deepClose(JSON.parse(oracle[i]), JSON.parse(r.stdout[i]), 1e-12);
    assert.deepEqual(diffs, [], `resolve #${i + 1} differs`);
  }
  assert.equal(r.stdout[3], oracle[3]);
  for (const rule of ['py-classes', 'py-dataclass', 'py-enum', 'py-decorators', 'py-imports', 'py-comprehension', 'py-fstring']) assert.ok(r.rulesUsed.includes(rule), rule);
});

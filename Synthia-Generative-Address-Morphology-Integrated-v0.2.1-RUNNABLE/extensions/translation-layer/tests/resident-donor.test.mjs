import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createResidentDonor } from '../src/resident-donor.mjs';
import { FIX, DONOR, read } from './helpers.mjs';

const expected = (f) => read(path.join(FIX, `${f}.expected`)).trimEnd().split('\n');

test('donor contract: derive → execute computes real results for py/rb/lua/c kind hints', async () => {
  const d = createResidentDonor();
  assert.ok(d.canHandle({ requiredCapability: 'artifact.realize' }));
  const rule = await d.derive({ requiredCapability: 'artifact.realize' });
  for (const [f, k] of [['t.py', 'py'], ['t.rb', 'rb'], ['t.lua', 'lua'], ['t.c', 'c']]) {
    const out = await rule.execute({ artifact: { name: f, content: read(path.join(FIX, f)) }, kindHint: k });
    assert.equal(out.handled, true, f); assert.deepEqual(out.value.stdout, expected(f));
  }
  assert.equal((await rule.execute({ artifact: { name: 'x.zig', content: '' }, kindHint: 'zig' })).handled, false);
});

// Runs against the real v0.3.0 base when present on the device (not vendored):
//   SYNTHIA_V030_ROOT=/path/to/Synthia-State-Space-and-Execution-v0.3.0 (with the 1R4snwT8 overlay applied)
const ROOT = globalThis.process?.env?.SYNTHIA_V030_ROOT;
test('v0.3.0 resident path (executionMode:resident) composes this donor and computes', { skip: !ROOT && 'SYNTHIA_V030_ROOT not set' }, async () => {
  const { ScientificSynthiaAssembly } = await import(path.join(ROOT, 'src/ScientificSynthiaAssembly.mjs'));
  const a = new ScientificSynthiaAssembly({ autoStart: false, executionMode: 'resident' });
  const address = { planetary: 'Sun', dimension: 'Movement', gate: 1, line: 1, color: 1, tone: 1, base: 1, degree: 0, minute: 0, second: 0, arc: 0, zodiac: 1, house: 1 };
  try {
    const before = await a.executeArtifact({ name: 't.py', content: 'print(1)' }, { organismAddress: address });
    assert.equal(before.execution.path, 'capability-unresolved');
    a.registerResidentCapability(createResidentDonor());
    for (const f of ['t.py', 't.rb', 't.lua', 't.c']) {
      const r = await a.executeArtifact({ name: f, content: read(path.join(FIX, f)) }, { organismAddress: address });
      assert.equal(r.admitted, true); assert.equal(r.execution.path, 'mesh-derived', f); assert.deepEqual(r.execution.result.stdout, expected(f));
    }
    const ase = await a.executeArtifact({ name: 'address_space_engine.py', content: read(DONOR) + '\n' + read(path.join(FIX, 'address_space_engine_driver.py')) }, { organismAddress: address });
    assert.equal(ase.execution.path, 'mesh-derived'); assert.equal(ase.execution.result.stdout.length, 4);
  } finally { await a.close(); }
});

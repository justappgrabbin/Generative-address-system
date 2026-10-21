import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { UniversalExecutionBridge } from '../../../authorities/execution-spine/src/pure-synthia/integration/universal-execution-bridge.js';
import { RuntimeAdapterRegistry } from '../../../authorities/execution-spine/src/pure-synthia/integration/runtime-adapter-registry.js';
import { registerTranslationLayer, createTranslationLayerAdapter, ADAPTER_ID } from '../src/index.mjs';
import { FIX, read } from './helpers.mjs';

const art = (name) => ({ name, content: read(path.join(FIX, name)) });
const expected = (name) => read(path.join(FIX, `${name}.expected`)).trimEnd().split('\n');

test('(a) no other backends: the bridge registered-runtime step runs py/rb/lua/c through the pure-JS layer', async () => {
  const bridge = new UniversalExecutionBridge();
  registerTranslationLayer(bridge);
  for (const f of ['t.py', 't.rb', 't.lua', 't.c']) {
    const r = await bridge.execute(art(f), { canonicalAddress: { gate: 41, line: 3 } });
    assert.equal(r.path, 'registered-runtime', f);
    assert.equal(r.runtimeAdapter, ADAPTER_ID);
    assert.equal(r.ok, true, `${f}: ${r.result.stderr}`);
    assert.deepEqual(r.result.stdout, expected(f));
    assert.equal(r.result.usedFallback, true);
    assert.equal(r.result.address.targetGate, 41);
  }
});

test('(b) a working backend in the slot gets first refusal and is used', async () => {
  const calls = [];
  const mock = { id: 'mock-native-python', kinds: ['python'], canRun: () => true, execute: ({ artifact }) => { calls.push(artifact.name); return { ok: true, engine: 'mock-native-python', stdout: ['from mock'] }; } };
  const bridge = new UniversalExecutionBridge();
  registerTranslationLayer(bridge, { backends: [mock] });
  const r = await bridge.execute(art('t.py'));
  assert.deepEqual(calls, ['t.py']);
  assert.equal(r.result.engine, 'mock-native-python');
  assert.deepEqual(r.result.stdout, ['from mock']);
  assert.equal(r.result.usedFallback, false);
  // Backends can also simply be registered ahead of the layer in the registry itself.
  const reg = new RuntimeAdapterRegistry([mock, createTranslationLayerAdapter()]);
  const r2 = await reg.execute({ artifact: art('t.py'), kind: 'python' });
  assert.equal(r2.adapterId, 'mock-native-python');
  const r3 = await reg.execute({ artifact: art('t.lua'), kind: 'lua' });
  assert.equal(r3.adapterId, ADAPTER_ID);
});

test('(c) a failing backend (throws or ok:false) falls back to the pure-JS layer', async () => {
  const throwing = { id: 'mock-throws', kinds: ['*'], execute: () => { throw new Error('backend offline'); } };
  const refusing = { id: 'mock-ok-false', kinds: ['*'], execute: () => ({ ok: false, stderr: ['nope'] }) };
  const bridge = new UniversalExecutionBridge();
  registerTranslationLayer(bridge, { backends: [throwing, refusing] });
  for (const f of ['t.py', 't.rb', 't.lua', 't.c']) {
    const r = await bridge.execute(art(f));
    assert.equal(r.ok, true, f);
    assert.deepEqual(r.result.stdout, expected(f));
    assert.equal(r.result.usedFallback, true);
    assert.deepEqual(r.result.fallbackChain.map((s) => [s.backend, s.ok]), [['mock-throws', false], ['mock-ok-false', false], [`${ADAPTER_ID}/${{ 't.py': 'python', 't.rb': 'ruby', 't.lua': 'lua', 't.c': 'c' }[f]}`, true]]);
  }
});

test('JavaScript artifacts are untouched by the layer (kinds do not include javascript)', async () => {
  const bridge = new UniversalExecutionBridge();
  registerTranslationLayer(bridge);
  const r = await bridge.execute({ name: 'x.js', content: 'console.log(1+1)' });
  assert.notEqual(r.path, 'registered-runtime');
});

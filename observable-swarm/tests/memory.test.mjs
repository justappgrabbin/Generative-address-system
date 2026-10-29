import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryExperiment } from '../native/memory-experiment.mjs';
import { inspectFormation } from '../native/inspection.mjs';
import { Substrate } from '../native/substrate.mjs';

test('learned delayed relations retain useful state, change under disruption and survive restart', () => {
  const { substrate: s, report: r } = memoryExperiment();
  assert.equal(r.manualConnections, 0);
  assert.ok(r.heldOutMSE < 1e-5, String(r.heldOutMSE));
  assert.ok(r.disruptedMSE > 0.005, String(r.disruptedMSE));
  assert.ok(r.recoveredMSE < 1e-5); assert.equal(r.restartMSE, 0);
  assert.ok(Math.abs(r.samePresentInput.left - r.samePresentInput.right) > 0.5);
  assert.deepEqual(r.inspection.selfConnections, ['state->state']);
  assert.equal(r.inspection.structuralDescription, 'recurrent linear signal network');
  assert.ok(r.inspection.executionTrace.every(e => e.delay === 1));
  assert.ok([...s.edges.values()].every(e => e.history.some(h => h.cause === 'feedback')));
});

test('without a recurrent opportunity the same examples do not establish the temporal behavior', () => {
  const { report: r } = memoryExperiment({ selfObservation: false });
  assert.ok(r.heldOutMSE > 0.005);
  assert.equal(r.inspection.structuralDescription, 'acyclic linear signal network');
});

test('inspection is read-only and reports disabled cycles and unknown formations accurately', () => {
  const s = new Substrate({ execution: 'temporal' });
  s.add({ id: 'a' }); s.add({ id: 'b' });
  s.bind({ from: 'a', to: 'b', weight: 0.5 }); s.bind({ from: 'b', to: 'a', weight: 0.5 });
  const before = s.snapshot(); assert.deepEqual(inspectFormation(s).recurrentComponents, [['a', 'b']]);
  assert.deepEqual(s.snapshot(), before);
  s.disrupt(['b->a']); assert.equal(inspectFormation(s).established.cyclesPresent, false);
  assert.throws(() => inspectFormation(s, 'missing'), /Unknown/);
});

test('delayed propagation reads previous state independently of insertion order', () => {
  for (const order of [['input', 'output'], ['output', 'input']]) {
    const s = new Substrate({ execution: 'temporal' });
    for (const id of order) s.add({ id, input: id === 'input' });
    s.bind({ from: 'input', to: 'output', weight: 2 });
    assert.equal(s.evaluate({ input: 3 }).output, 0);
    assert.equal(s.evaluate({ input: 0 }).output, 6);
  }
});

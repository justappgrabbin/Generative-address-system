import test from 'node:test';
import assert from 'node:assert/strict';
import { exclusiveOffsets, sparseLayout, propagateSegment } from '../native/primitives.mjs';
import { encounterExperiment } from '../native/encounter-experiment.mjs';
import { Substrate } from '../native/substrate.mjs';

test('scan preserves empty segments and stable scatter preserves directed identity', () => {
  assert.deepEqual(exclusiveOffsets([2, 0, 1]), [0, 2, 2, 3]);
  assert.throws(() => exclusiveOffsets([-1]));
  const nodes = new Map(['a', 'b', 'c'].map(id => [id, {}]));
  const edges = new Map([
    ['ab', { id: 'ab', from: 'a', to: 'b', enabled: true, weight: 2 }],
    ['ba', { id: 'ba', from: 'b', to: 'a', enabled: true, weight: 3 }],
    ['cb', { id: 'cb', from: 'c', to: 'b', enabled: true, weight: -1 }]
  ]);
  const layout = sparseLayout(nodes, edges), trace = [];
  assert.deepEqual(layout.relations.map(e => e.id), ['ba', 'ab', 'cb']);
  assert.equal(layout.relations[0], edges.get('ba'));
  assert.equal(propagateSegment(layout, 'b', 1, id => ({ a: 4, c: 5 })[id], e => trace.push(e.id)), 4);
  assert.deepEqual(trace, ['ab', 'cb']);
  assert.equal(propagateSegment(layout, 'c', 7, () => assert.fail(), () => assert.fail()), 7);
});

test('sparse kernel executes learned unseen transformation, causal disruption and replay', () => {
  const { substrate: s, report: r } = encounterExperiment();
  assert.equal(r.manualOffers, 0);
  assert.ok(r.heldOutMSE < 1e-12);
  assert.ok(r.disruptedMSE > 0.01);
  assert.ok(r.recoveredMSE < 1e-12);
  assert.equal(r.restartError, 0);
  assert.ok(s.executionCounts.gatheredSignals > 0);
  assert.equal(s.executionCounts.gatheredSignals, s.executionCounts.accumulations);
  const restored = Substrate.restore(s.snapshot());
  assert.deepEqual(restored.executionCounts, s.executionCounts);
  for (const t of r.trace) assert.equal(t.contribution, t.source * t.weight);
});

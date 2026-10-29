import test from 'node:test';
import assert from 'node:assert/strict';
import { traceExperiment } from '../native/trace-experiment.mjs';
import { Substrate } from '../native/substrate.mjs';
test('asynchronous environmental visits enable learned relations, ablation and persistence', () => {
  const { substrate: s, report: r } = traceExperiment();
  assert.ok(r.heldOutMSE < 1e-12); assert.ok(r.disruptedMSE > 0.01);
  assert.ok(r.recoveredMSE < 1e-12); assert.equal(r.restartDifference, 0);
  assert.equal(r.manualConnections, 0);
  assert.equal(r.opportunities[0].origin, 'environmental-trace');
  const t = s.traces.find(t => t.id === r.opportunities[0].trace);
  assert.equal(t.source, 'signal'); assert.ok(t.observers.includes('result'));
  assert.equal(t.active, false); assert.ok(t.history.length >= 3);
  assert.deepEqual(Substrate.restore(s.snapshot()).traces, s.traces);
});
test('without traces separated visits do not produce computational contacts', () => {
  const { report: r } = traceExperiment({ traces: false });
  assert.equal(r.learnedRelations.length, 0); assert.ok(r.heldOutMSE > 0.01);
});

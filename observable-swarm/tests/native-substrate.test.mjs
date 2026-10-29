import test from 'node:test';
import assert from 'node:assert/strict';
import { Substrate, DIMENSIONS } from '../native/substrate.mjs';
import { functionalExperiment, imageExperiment, surfaceSVG } from '../native/experiments.mjs';

test('connections learn held-out behavior, disruption changes it, restoration and restart recover it', () => {
  const { substrate, report: r } = functionalExperiment();
  assert.equal(r.beforeEdges, 0); assert.equal(r.learnedEdges, 2);
  assert.ok(r.heldOutMSE < 1e-8, JSON.stringify(r));
  assert.ok(r.memorizationMSE > r.heldOutMSE + 0.001);
  assert.equal(r.unrelatedDisruptionMSE, r.heldOutMSE);
  assert.ok(r.disruptedMSE > 0.1); assert.ok(r.recoveredMSE < 1e-8); assert.equal(r.restartError, 0);
  assert.equal(r.trace.length, 2);
  for (const n of substrate.nodes.values()) assert.deepEqual(Object.keys(n.dimensionalContext), DIMENSIONS);
  assert.ok(substrate.events.every(e => e.leadingDimension === null));
});

test('small image reconstructs through learned relations, changes after ablation, persists and participates in learned reuse', () => {
  const { substrate, report: r } = imageExperiment();
  assert.ok(r.reconstructionMSE < 0.001, JSON.stringify(r));
  assert.ok(r.alteredMSE > r.reconstructionMSE + 0.005);
  assert.ok(r.recoveredMSE < 0.001); assert.equal(r.restartMSE, 0);
  assert.ok(r.continuation.absoluteError < 0.03, JSON.stringify(r.continuation));
  assert.ok(r.executionContributions >= 16);
  assert.match(surfaceSVG(substrate, ['surface-0']), /<rect/);
});

test('composition uses the same propagation primitive and blocks backward edges', () => {
  const s = new Substrate();
  s.add({ id: 'in', rank: 0, input: true }); s.add({ id: 'middle', rank: 1 }); s.add({ id: 'out', rank: 2 });
  s.bind({ from: 'in', to: 'middle', weight: 2 }); s.bind({ from: 'middle', to: 'out', weight: 3 });
  assert.equal(s.evaluate({ in: 4 }).out, 24);
  assert.deepEqual(s.lastTrace.map(e => e.contribution), [8, 24]);
  assert.throws(() => s.offer({ from: 'out', to: 'middle' }), /constraints/);
  assert.equal(s.formations.length, 1);
});

test('realized extents constrain motion; malformed input and provenance are rejected', () => {
  const s = new Substrate();
  s.add({ id: 'moving', rank: 0, input: true, position: [0, 0], radius: 0.1 });
  s.add({ id: 'wall', rank: 1, fixed: true, position: [0.15, 0], radius: 0.1 });
  s.evaluate({ moving: 1 }); assert.deepEqual(s.nodes.get('moving').position, [0, 0]);
  assert.ok(s.events.some(e => e.kind === 'boundary-contact'));
  assert.throws(() => s.evaluate({ moving: Infinity }), /Invalid/);
  const snapshot = s.snapshot(); snapshot.nodes[0][1].value = 77;
  assert.throws(() => Substrate.restore(snapshot), /provenance/);
});

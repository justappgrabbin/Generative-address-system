import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptationExperiment } from '../native/adaptation-experiment.mjs';
import { Substrate } from '../native/substrate.mjs';

test('changed encounters and feedback retire an old connection and acquire a new functional path', () => {
  const { report: r } = adaptationExperiment();
  assert.equal(r.manualConnections, 0);
  assert.ok(r.originalMSE < 1e-7);
  assert.ok(r.beforeChangedMSE > 0.1);
  assert.deepEqual(r.before.edges.sort(), ['a->result', 'b->result']);
  assert.deepEqual(r.after.edges.sort(), ['b->result', 'c->result']);
  assert.ok(r.retiredRelations.some(e => e.id === 'a->result' && e.history.length > 0));
  assert.ok(r.adaptedMSE < 1e-5, String(r.adaptedMSE));
  assert.ok(r.disruptedMSE > 0.1);
  assert.ok(r.recoveredMSE < 1e-5); assert.equal(r.restartMSE, r.adaptedMSE);
  assert.deepEqual(r.learnedTrace.map(e => e.from).sort(), ['b', 'c']);
  assert.ok(r.after.formations[0].predecessors.length > 0);
});

test('new encounters alone and feedback alone do not supply the changed capability', () => {
  for (const settings of [{ feedbackAfterChange: false }, { bringNewContact: false }]) {
    const { report: r } = adaptationExperiment(settings);
    assert.ok(r.adaptedMSE > 0.1, JSON.stringify(settings));
    assert.ok(!r.after.edges.includes('c->result'));
  }
});

test('spatial perturbations validate before mutation and replay retains their history', () => {
  const s = new Substrate(); s.add({ id: 'n', rank: 0, input: true });
  assert.throws(() => s.place({ id: 'n', position: [NaN, 0] }), /Invalid/);
  assert.deepEqual(s.nodes.get('n').position, [0, 0]);
  s.place({ id: 'n', position: [2, 3] });
  assert.deepEqual(Substrate.restore(s.snapshot()).snapshot(), s.snapshot());
});

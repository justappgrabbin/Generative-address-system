import test from 'node:test';
import assert from 'node:assert/strict';
import { encounterExperiment } from '../native/encounter-experiment.mjs';
import { Substrate } from '../native/substrate.mjs';

test('encounters grow functional connections without manually offered wiring or supplied ranks', () => {
  const { substrate: s, report: r } = encounterExperiment();
  assert.equal(r.initial.opportunities, 0); assert.equal(r.initial.connections, 0); assert.equal(r.manualOffers, 0);
  assert.ok(r.heldOutMSE < 1e-8, JSON.stringify(r));
  assert.ok(r.disruptedMSE > 0.1); assert.ok(r.recoveredMSE < 1e-8); assert.equal(r.restartError, 0);
  assert.deepEqual(r.connections.map(e => e.id).sort(), ['a->result', 'b->result']);
  assert.ok(r.firstOffers.every(e => e.tick > 4 && e.reason === 'repeated local encounter'));
  assert.ok(r.opportunities.every(c => c.origin === 'local-encounter'));
  assert.ok(r.contacts.every(c => c.count >= 4));
  assert.ok([...s.nodes.values()].every(n => n.rank === 0));
  assert.ok(r.executionOrder.indexOf('a') < r.executionOrder.indexOf('result'));
  assert.ok(r.executionOrder.indexOf('b') < r.executionOrder.indexOf('result'));
  assert.equal(r.trace.length, 2);
});

test('preventing encounters prevents wiring and capability, despite identical examples', () => {
  const disabled = encounterExperiment({ encounters: false }).report;
  const separated = encounterExperiment({ targetPosition: [8, 8] }).report;
  const insufficient = encounterExperiment({ minimum: 10000 }).report;
  for (const r of [disabled, separated, insufficient]) {
    assert.equal(r.connections.length, 0); assert.equal(r.opportunities.length, 0);
    assert.ok(r.heldOutMSE > 0.1);
  }
});

test('topology determines order and cycle constraints survive restoration', () => {
  const s = new Substrate({ execution: 'discovered-dag' });
  for (const id of ['z', 'middle', 'a']) s.add({ id, input: id === 'z' });
  s.bind({ from: 'z', to: 'middle', weight: 2 });
  s.bind({ from: 'middle', to: 'a', weight: 3 });
  assert.equal(s.evaluate({ z: 4 }).a, 24);
  assert.throws(() => s.offer({ from: 'a', to: 'middle' }), /constraints/);
  s.disrupt(['middle->a']); s.bind({ from: 'a', to: 'middle', weight: 1 });
  assert.throws(() => s.disrupt(['middle->a'], true), /cycle/);
  assert.equal(s.edges.get('middle->a').enabled, false);
  assert.deepEqual(Substrate.restore(s.snapshot()).snapshot(), s.snapshot());
});

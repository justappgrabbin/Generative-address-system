import test from 'node:test';
import assert from 'node:assert/strict';
import { repairExperiment } from '../native/repair-experiment.mjs';
for (const fault of ['a->result', 'b->result']) test(`feedback identifies reversible disruption without a supplied fault ID: ${fault}`, () => {
  const { report: r } = repairExperiment({ fault });
  assert.ok(r.damagedMSE > 0.01);
  assert.ok(r.recoveredMSE < 1e-12);
  assert.ok(r.restartedMSE < 1e-12);
  assert.equal(r.unchangedWeights, true);
  assert.equal(r.recovery.accepted.length, 1);
  assert.equal(r.recovery.accepted[0].relation, fault);
  assert.equal(r.noSignalAcceptedChanges, 0);
  assert.ok(r.noSignalMSE > 0.01);
  assert.ok(r.recovery.trials.some(t => t.relation !== fault));
});

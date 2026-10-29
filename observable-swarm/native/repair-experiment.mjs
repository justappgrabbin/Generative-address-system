import { encounterExperiment } from './encounter-experiment.mjs';
import { random, mse } from './experiments.mjs';
import { Substrate } from './substrate.mjs';
import { reorganizeByFeedback } from './reorganization.mjs';

export function repairExperiment({ fault = 'a->result' } = {}) {
  const { substrate: s } = encounterExperiment();
  if (!s.edges.has(fault)) throw Error('Unknown experimental fault');
  const rng = random(8642);
  const examples = count => Array.from({ length: count }, () => ({ a: rng() * 3 - 1.5, b: rng() * 3 - 1.5, distant: rng() * 2 - 1 }));
  const feedbackExamples = examples(24), unseen = examples(60);
  // Only this external environment knows the expected transformation.
  const assess = inputs => graph => mse(inputs.map(input => graph.evaluate(input).result), inputs.map(({ a, b }) => 0.7 * a - 0.4 * b + 0.2));
  const snapshot = s.snapshot();
  s.disrupt([fault]);
  const damaged = s.snapshot(), noRepair = Substrate.restore(damaged);
  const damagedMSE = assess(unseen)(noRepair);
  const recovery = reorganizeByFeedback(s, assess(feedbackExamples));
  const recoveredMSE = assess(unseen)(s), restored = Substrate.restore(s.snapshot());
  const restartedMSE = assess(unseen)(restored);
  const unchangedWeights = [...s.edges.values()].every(e => e.weight === new Map(snapshot.edges).get(e.id).weight);
  // Constant feedback cannot identify a beneficial change: search must abstain.
  const noSignal = Substrate.restore(damaged);
  const noSignalSearch = reorganizeByFeedback(noSignal, () => 1);
  return { substrate: s, report: { experiment: 'feedback-driven structural recovery', faultKnownOnlyToEnvironment: fault,
    feedbackExamples: feedbackExamples.length, heldOutExamples: unseen.length, damagedMSE, recoveredMSE, restartedMSE,
    unchangedWeights, recovery, noSignalAcceptedChanges: noSignalSearch.accepted.length,
    noSignalMSE: assess(unseen)(noSignal), trace: structuredClone(s.lastTrace),
    limits: 'Developer-supplied perturbation search repairs reversible connection disabling using environmental error. Learned relations execute predictions, but diagnosis/search has not itself emerged. No unseen fault class, missing-edge replacement, dimensional medical equivalence, or autonomous mesh repair is established.' } };
}

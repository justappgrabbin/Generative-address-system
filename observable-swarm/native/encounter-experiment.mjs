import { Substrate } from './substrate.mjs';
import { random, mse } from './experiments.mjs';
import { performance } from 'node:perf_hooks';

// This is an external experiment, not an operation dispatched by a formation.
// Task knowledge exists only in the example/assessment environment below.
export function encounterExperiment({ samples = 700, encounters = true, minimum = 4, targetPosition = [0, 0] } = {}) {
  const start = performance.now(), rng = random(19718);
  const s = new Substrate({ execution: 'discovered-dag', encounters: encounters ? { radius: 0.12, minimum } : null });
  s.add({ id: 'a', input: true, position: [-0.14, 0], phase: 0, radius: 0.005 });
  s.add({ id: 'b', input: true, position: [0.14, 0], phase: Math.PI, radius: 0.005 });
  s.add({ id: 'distant', input: true, position: [3, 3], phase: 0.8, radius: 0.005 });
  s.add({ id: 'result', fixed: true, position: targetPosition, radius: 0.005 });
  const initial = { opportunities: s.candidates.size, connections: s.edges.size, positions: [...s.nodes.values()].map(n => ({ id: n.id, position: [...n.position] })) };
  for (let i = 0; i < samples; i++) {
    const a = 2 * rng() - 1, b = 2 * rng() - 1, distant = 2 * rng() - 1;
    s.evaluate({ a, b, distant }); s.feedback({ result: 0.7 * a - 0.4 * b + 0.2 });
  }
  const heldOut = Array.from({ length: 40 }, () => ({ a: rng() * 3 - 1.5, b: rng() * 3 - 1.5, distant: rng() * 2 - 1 }));
  const expected = heldOut.map(({ a, b }) => 0.7 * a - 0.4 * b + 0.2);
  const assess = () => mse(heldOut.map(input => s.evaluate(input).result), expected);
  const error = assess(), trace = structuredClone(s.lastTrace);
  const relevant = [...s.edges.values()].filter(e => e.to === 'result').map(e => e.id);
  s.disrupt(relevant); const disruptedMSE = assess();
  s.disrupt(relevant, true); const recoveredMSE = assess();
  const restored = Substrate.restore(s.snapshot());
  const probe = { a: 0.38791, b: -0.61821, distant: 0.14151 };
  const restartError = Math.abs(s.evaluate(probe).result - restored.evaluate(probe).result);
  return { substrate: s, report: {
    experiment: 'encounter-grown computational relations', initial, seed: 19718, trainingExamples: samples,
    heldOutExamples: heldOut.length, heldOutMSE: error, disruptedMSE, recoveredMSE, restartError,
    opportunities: [...s.candidates.values()], contacts: [...s.contacts.values()],
    connections: [...s.edges.values()].map(e => ({ id: e.id, weight: e.weight, updates: e.history.length })),
    formationCount: s.formations.length, trace, firstOffers: s.events.filter(e => e.kind === 'offer-accepted'),
    manualOffers: s.journal.filter(c => c.operation === 'offer' || c.operation === 'bind').length,
    suppliedExecutionRanks: false, executionOrder: s.executionOrder().map(n => n.id),
    milliseconds: performance.now() - start,
    limits: 'Encounter-developed connections and topology-derived ordering in an adaptive linear DAG. Not a demonstrated emergent neural architecture or computational mesh. Input/output contacts, encounter geometry, feedback and acyclicity are supplied experimental conditions.'
  } };
}

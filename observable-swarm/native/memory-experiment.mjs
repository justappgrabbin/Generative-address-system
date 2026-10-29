import { Substrate } from './substrate.mjs';
import { random, mse } from './experiments.mjs';
import { inspectFormation } from './inspection.mjs';

// External sequence-generating environment. The recurrence is not installed in
// the substrate; evaluate receives only the present signal.
export function memoryExperiment({ selfObservation = true, samples = 1800 } = {}) {
  const rng = random(190308228), s = new Substrate({ rate: 0.3, execution: 'temporal', selfObservation,
    encounters: { radius: 0.25, minimum: 4 } });
  s.add({ id: 'signal', input: true, position: [-0.08, 0], radius: 0.005 });
  s.add({ id: 'state', position: [0.08, 0], phase: Math.PI, radius: 0.005 });
  let previousInput = 0, target = 0;
  for (let i = 0; i < samples; i++) {
    const signal = rng() * 2 - 1;
    target = 0.65 * target + 0.35 * previousInput;
    s.evaluate({ signal }); s.feedback({ state: target }); previousInput = signal;
  }
  const heldOut = Array.from({ length: 100 }, () => rng() * 2 - 1);
  function assess(graph) {
    // Start from the physically observed current state, then predict the whole
    // sequence independently. No held-out targets enter graph execution.
    let expectedState = graph.nodes.get('state').value, prior = graph.nodes.get('signal').value;
    const actual = [], expected = [];
    for (const signal of heldOut) {
      expectedState = 0.65 * expectedState + 0.35 * prior;
      expected.push(expectedState); actual.push(graph.evaluate({ signal }).state); prior = signal;
    }
    return mse(actual, expected);
  }
  const heldOutMSE = assess(s), inspection = inspectFormation(s);
  const preserved = s.snapshot(), restarted = Substrate.restore(preserved);
  const future = [0.81, -0.46, 0, 0.19, -0.28];
  const restartMSE = mse(future.map(signal => s.evaluate({ signal }).state), future.map(signal => restarted.evaluate({ signal }).state));
  // Same present input, different prior experiences: do the relations carry state?
  const left = Substrate.restore(preserved), right = Substrate.restore(preserved);
  for (let i = 0; i < 5; i++) { left.evaluate({ signal: 1 }); right.evaluate({ signal: -1 }); }
  const samePresentInput = { left: left.evaluate({ signal: 0 }).state, right: right.evaluate({ signal: 0 }).state };
  const disrupted = Substrate.restore(preserved);
  const recurrent = [...disrupted.edges.values()].filter(e => e.from === e.to).map(e => e.id);
  disrupted.disrupt(recurrent); const disruptedMSE = assess(disrupted);
  disrupted.disrupt(recurrent, true); const recoveredMSE = assess(disrupted);
  return { substrate: s, report: { experiment: 'encounter-developed delayed-state memory', trainingExamples: samples,
    heldOutExamples: heldOut.length, selfObservation, heldOutMSE, restartMSE, disruptedMSE, recoveredMSE,
    samePresentInput, manualConnections: s.journal.filter(c => ['offer', 'bind'].includes(c.operation)).length,
    inspection, limits: 'A learned linear recurrence using a supplied one-step delay and local self-observation opportunity. Synchronous scalar updates and supervised feedback are experimental primitives. No spiking network, hidden-layer emergence, computational mesh, or derived dimensional realization law is established.' } };
}

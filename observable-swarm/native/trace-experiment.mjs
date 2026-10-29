import { Substrate } from './substrate.mjs';
import { random, mse } from './experiments.mjs';
export function traceExperiment({ traces = true } = {}) {
  const s = new Substrate({ execution: 'discovered-dag', traces: traces ? { lifetime: 20, decay: 0.8, minimum: 0.05, radius: 0.1 } : null });
  s.add({ id: 'signal', input: true, position: [0, 0], fixed: true });
  s.add({ id: 'result', position: [3, 0], fixed: true });
  s.idle(1); // The signal leaves a visit while result is elsewhere.
  s.place({ id: 'signal', position: [-3, 0] });
  s.place({ id: 'result', position: [0, 0] });
  const rng = random(33979321);
  for (let i = 0; i < 500; i++) {
    const signal = rng() * 2 - 1;
    s.evaluate({ signal }); s.feedback({ result: 0.6 * signal - 0.1 });
  }
  const inputs = Array.from({ length: 40 }, () => rng() * 3 - 1.5);
  const expected = inputs.map(x => 0.6 * x - 0.1);
  const assess = () => mse(inputs.map(signal => s.evaluate({ signal }).result), expected);
  const heldOutMSE = assess(), trace = structuredClone(s.lastTrace);
  const ids = [...s.edges.keys()];
  s.disrupt(ids); const disruptedMSE = assess();
  s.disrupt(ids, true); const recoveredMSE = assess();
  const restored = Substrate.restore(s.snapshot());
  const restartDifference = Math.abs(s.evaluate({ signal: 0.873 }).result - restored.evaluate({ signal: 0.873 }).result);
  return { substrate: s, report: { traces, heldOutMSE, disruptedMSE, recoveredMSE, restartDifference,
    learnedRelations: [...s.edges.values()].map(e => ({ id: e.id, weight: e.weight })), opportunities: [...s.candidates.values()],
    trace, traceRecords: s.traces.length, activeTraces: s.traces.filter(t => t.active).length,
    observedEvents: s.events.filter(e => e.kind === 'trace-observed'),
    manualConnections: s.journal.filter(e => ['offer', 'bind'].includes(e.operation)).length,
    limits: 'Externally arranged sequential visits; supplied trace-contact and feedback rules. Trace references permit subsequent ordinary signals between separated constituents. No diffusion, autonomous navigation, semantic dimensional law or learned trace policy is established.' } };
}

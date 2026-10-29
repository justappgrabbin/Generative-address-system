import { Substrate } from './substrate.mjs';
import { random, mse } from './experiments.mjs';
import { performance } from 'node:perf_hooks';

// External environment supplies examples and a changed condition, never a solver
// to the substrate. The core still executes only generic relational propagation.
export function adaptationExperiment({ feedbackAfterChange = true, bringNewContact = true, samples = 650 } = {}) {
  const start = performance.now(), rng = random(17946231);
  const s = new Substrate({ execution: 'discovered-dag', encounters: { radius: 0.25, minimum: 4 }, adaptation: { pruneWeight: 0.01, patience: 12, recentContact: 12 } });
  s.add({ id: 'a', input: true, position: [-0.08, 0], phase: 0, radius: 0.005 });
  s.add({ id: 'b', input: true, position: [0.08, 0], phase: Math.PI, radius: 0.005 });
  s.add({ id: 'c', input: true, position: [3, 3], phase: 0.8, radius: 0.005 });
  s.add({ id: 'result', fixed: true, position: [0, 0], radius: 0.005 });
  const sample = () => ({ a: rng() * 2 - 1, b: rng() * 2 - 1, c: rng() * 2 - 1 });
  const ruleA = ({ a, b }) => 0.7 * a - 0.4 * b + 0.2;
  const ruleB = ({ b, c }) => -0.4 * b + 0.8 * c - 0.1;
  for (let i = 0; i < samples; i++) { const input = sample(); s.evaluate(input); s.feedback({ result: ruleA(input) }); }
  const heldOut = Array.from({ length: 50 }, () => sample());
  const assess = (graph, rule) => mse(heldOut.map(input => graph.evaluate(input).result), heldOut.map(rule));
  const originalMSE = assess(s, ruleA);
  const before = { tick: s.tick, edges: [...s.edges.keys()], formations: structuredClone(s.formations) };
  const beforeChangedMSE = assess(s, ruleB);
  s.place({ id: 'a', position: [3, -3] });
  if (bringNewContact) s.place({ id: 'c', position: [-0.08, 0] });
  const changeTick = s.tick;
  for (let i = 0; i < samples; i++) { const input = sample(); s.evaluate(input); if (feedbackAfterChange) s.feedback({ result: ruleB(input) }); }
  const adaptedMSE = assess(s, ruleB), learnedTrace = structuredClone(s.lastTrace);
  const after = { tick: s.tick, edges: [...s.edges.keys()], formations: structuredClone(s.formations) };
  const relevant = [...s.edges.keys()];
  s.disrupt(relevant); const disruptedMSE = assess(s, ruleB);
  s.disrupt(relevant, true); const recoveredMSE = assess(s, ruleB);
  const restored = Substrate.restore(s.snapshot());
  const restartMSE = assess(restored, ruleB);
  return { substrate: s, report: {
    experiment: 'functional reorganization after changed conditions', seed: 17946231,
    trainingExamplesPerPhase: samples, heldOutExamples: heldOut.length,
    feedbackAfterChange, bringNewContact, originalMSE, beforeChangedMSE, adaptedMSE,
    disruptedMSE, recoveredMSE, restartMSE, before, after, changeTick,
    learnedTrace, retiredRelations: s.retired,
    events: s.events.filter(e => ['relation-created', 'relation-dissolved', 'environment-perturbation'].includes(e.kind)),
    manualConnections: s.journal.filter(c => ['offer', 'bind'].includes(c.operation)).length,
    milliseconds: performance.now() - start,
    limits: 'Supervised affine transformations in an encounter-developed DAG. Environmental relocation, scalar credit, pruning thresholds and acyclicity are experimental conditions. Not yet emergent hidden neural architecture, functional meshes, or derived five-dimensional morphology.'
  } };
}

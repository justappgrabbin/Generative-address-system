// Task knowledge belongs ONLY to this external experimental environment.
// Substrate.evaluate receives inputs, never these target-generating expressions.
import { Substrate } from './substrate.mjs';
import { performance } from 'node:perf_hooks';

export function random(seed = 42) {
  let state = seed >>> 0;
  return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
}
export const mse = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length;

export function functionalExperiment({ samples = 600 } = {}) {
  const start = performance.now(), s = new Substrate(), rng = random();
  s.add({ id: 'a', rank: 0, input: true, position: [-1, 0] });
  s.add({ id: 'b', rank: 0, input: true, position: [-1, 1] });
  s.add({ id: 'result', rank: 1, position: [1, 0] });
  s.offer({ from: 'a', to: 'result' }); s.offer({ from: 'b', to: 'result' });
  const beforeEdges = s.edges.size;
  const training = [];
  for (let i = 0; i < samples; i++) {
    const a = rng() * 2 - 1, b = rng() * 2 - 1;
    training.push([a, b, 0.7 * a - 0.4 * b + 0.2]);
    s.evaluate({ a, b }); s.feedback({ result: 0.7 * a - 0.4 * b + 0.2 });
  }
  const heldOut = Array.from({ length: 40 }, () => [rng() * 3 - 1.5, rng() * 3 - 1.5]);
  function assess() {
    const expected = heldOut.map(([a, b]) => 0.7 * a - 0.4 * b + 0.2);
    const predicted = heldOut.map(([a, b]) => s.evaluate({ a, b }).result);
    return mse(predicted, expected);
  }
  const heldOutMSE = assess(), trace = structuredClone(s.lastTrace);
  const nearestPredictions = heldOut.map(([a, b]) => training.reduce((best, row) => Math.hypot(a - row[0], b - row[1]) < Math.hypot(a - best[0], b - best[1]) ? row : best)[2]);
  const memorizationMSE = mse(nearestPredictions, heldOut.map(([a, b]) => 0.7 * a - 0.4 * b + 0.2));
  const learned = [...s.edges.keys()];
  s.add({ id: 'unrelated-observer', rank: 2, fixed: true });
  s.bind({ from: 'result', to: 'unrelated-observer', weight: 1, trainable: false });
  s.disrupt(['result->unrelated-observer']); const unrelatedDisruptionMSE = assess();
  s.disrupt(learned); const disruptedMSE = assess();
  s.disrupt(learned, true); const recoveredMSE = assess();
  const saved = s.snapshot(), restored = Substrate.restore(saved);
  const probe = { a: 0.1234567, b: -0.8912345 };
  const restartError = Math.abs(s.evaluate(probe).result - restored.evaluate(probe).result);
  return { substrate: s, report: { experiment: 'held-out affine relation', seed: 42, trainingExamples: samples,
    heldOutExamples: heldOut.length, beforeEdges, learnedEdges: learned.length,
    heldOutMSE, memorizationMSE, unrelatedDisruptionMSE, disruptedMSE, recoveredMSE, restartError, trace,
    milliseconds: performance.now() - start,
    limits: 'A supervised adaptive linear graph. This does not establish arbitrary computation, unsupervised learning, or source-derived dimensional physics.' } };
}

export function imageExperiment({ samples = 900, source = null } = {}) {
  const start = performance.now(), cpuStart = process.cpuUsage(), s = new Substrate(), rng = random(99);
  const side = 4, count = side * side;
  for (let i = 0; i < count; i++) {
    s.add({ id: `sensor-${i}`, rank: 0, input: true, fixed: true, position: [i % side, Math.floor(i / side)], provenance: { source: source?.provenance ?? 'built-in experimental fixture', sampleIndex: i } });
    s.add({ id: `surface-${i}`, rank: 1, fixed: true, position: [i % side, Math.floor(i / side)] });
  }
  // Opportunities contain no preselected corresponding-pixel routing or weights.
  for (let i = 0; i < count; i++) for (let j = 0; j < count; j++) s.offer({ from: `sensor-${i}`, to: `surface-${j}` });
  for (let trial = 0; trial < samples; trial++) {
    const values = Array.from({ length: count }, () => rng() * 2 - 1);
    s.evaluate(Object.fromEntries(values.map((v, i) => [`sensor-${i}`, v])));
    s.feedback(Object.fromEntries(values.map((v, i) => [`surface-${i}`, v])));
  }
  // An asymmetric tiny glyph, never a training example. Values are measured
  // grayscale intensities represented on [-1,1], not symbol/color assignments.
  if (source && (source.width !== side || source.height !== side || source.samples.length !== count)) throw Error('This initial experiment requires a 4x4 input image');
  const pixels = source?.samples ?? [0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1];
  const encoded = pixels.map(v => 2 * v - 1);
  const inputs = Object.fromEntries(encoded.map((v, i) => [`sensor-${i}`, v]));
  const reconstruct = graph => { const values = graph.evaluate(inputs); return pixels.map((_, i) => (values[`surface-${i}`] + 1) / 2); };
  const output = reconstruct(s), reconstructionMSE = mse(output, pixels);
  const trace = structuredClone(s.lastTrace);
  const relevant = [...s.edges.values()].filter(e => e.to === 'surface-1').sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))[0];
  s.disrupt([relevant.id]); const altered = reconstruct(s), alteredMSE = mse(altered, pixels);
  s.disrupt([relevant.id], true); const recovered = reconstruct(s);
  const restored = Substrate.restore(s.snapshot()), restartOutput = reconstruct(restored);
  // A second learned operation uses the persistent surface contacts directly.
  // No second image decoder, reinterpretation or pretrained network is involved.
  s.add({ id: 'continuation', rank: 2, fixed: true, position: [side + 1, 0] });
  for (let i = 0; i < count; i++) s.offer({ from: `surface-${i}`, to: 'continuation' });
  for (let trial = 0; trial < 600; trial++) {
    const values = Array.from({ length: count }, () => rng() * 2 - 1);
    s.evaluate(Object.fromEntries(values.map((v, i) => [`sensor-${i}`, v])));
    // Simultaneous feedback maintains the representation while teaching reuse.
    s.feedback({ ...Object.fromEntries(values.map((v, i) => [`surface-${i}`, v])), continuation: values.reduce((a, b) => a + b, 0) / count });
  }
  const reusedValues = s.evaluate(inputs), expectedContinuation = encoded.reduce((a, b) => a + b, 0) / count;
  const cpu = process.cpuUsage(cpuStart);
  return { substrate: s, image: { width: side, height: side, source: pixels, output, altered }, report: {
    experiment: 'local constituent image reconstruction and learned reuse', seed: 99, trainingExamples: samples,
    pixelCount: count, reconstructionMSE, alteredMSE, recoveredMSE: mse(recovered, pixels),
    restartMSE: mse(restartOutput, output), disruptedRelation: relevant.id,
    changedPixel: { index: 1, before: output[1], after: altered[1] },
    continuation: { expected: expectedContinuation, actual: reusedValues.continuation, absoluteError: Math.abs(reusedValues.continuation - expectedContinuation), inputContacts: 'existing surface constituents' },
    trace, executionContributions: trace.length,
    milliseconds: performance.now() - start, cpuMilliseconds: (cpu.user + cpu.system) / 1000,
    rssBytes: process.memoryUsage().rss,
    limits: '4x4 measured grayscale samples; supervised reconstruction and reuse. Geometry is supplied by sample coordinates. This does not establish emergent object geometry, color semantics, photorealism, or generative scenes.'
  } };
}

// Output-only adapter: consumes realized contacts; never reads source pixels.
export function surfaceSVG(substrate, ids, { cell = 48 } = {}) {
  const nodes = ids.map(id => { const n = substrate.nodes.get(id); if (!n) throw Error('Unknown surface contact'); return n; });
  const cells = nodes.map(n => { const gray = Math.max(0, Math.min(255, Math.round((n.value + 1) * 127.5))); return `<rect x="${n.position[0] * cell}" y="${n.position[1] * cell}" width="${cell}" height="${cell}" fill="rgb(${gray},${gray},${gray})"/>`; });
  const width = (Math.max(...nodes.map(n => n.position[0])) + 1) * cell, height = (Math.max(...nodes.map(n => n.position[1])) + 1) * cell;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${cells.join('')}</svg>`;
}

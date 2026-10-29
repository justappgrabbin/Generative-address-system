import { encounterExperiment } from './encounter-experiment.mjs';
import { Substrate } from './substrate.mjs';
import { proposeVariation } from './variation.mjs';
import { random } from './experiments.mjs';

// Observer adapter: same constituent positions/relations, no replacement asset.
export function observe(s) {
  return { constituents: [...s.nodes.values()].map(n => ({ id: n.id, position: [...n.position], value: n.value })),
    segments: [...s.edges.values()].filter(e => e.enabled).map(e => ({ from: e.from, to: e.to })) };
}
export function bridgeExperiment() {
  const { substrate: s } = encounterExperiment();
  // Anchor the existing input contacts; the internal contact remains movable.
  // Clone by journal replay with a revised experimental fixture, not state edits.
  const journal = structuredClone(s.journal);
  for (const item of journal) if (item.operation === 'add') item.data.fixed = item.data.input;
  const graph = Substrate.replay(journal, s.options);
  graph.relax({ steps: 1000 });
  const probe = { a: 0.82, b: -0.37, distant: 0.2 };
  const beforeValue = graph.evaluate(probe).result;
  graph.relax({ steps: 1000 });
  const before = observe(graph), proposal = proposeVariation(graph, random(20261029));
  graph.vary(proposal); graph.relax({ steps: 1000 });
  const after = observe(graph), afterValue = graph.evaluate(probe).result;
  graph.relax({ steps: 1000 });
  const settled = observe(graph);
  const distance = (x, y) => Math.hypot(...x.map((v, i) => v - y[i]));
  const geometryChange = distance(before.constituents.find(n => n.id === 'result').position, after.constituents.find(n => n.id === 'result').position);
  const stabilityDrift = distance(after.constituents.find(n => n.id === 'result').position, settled.constituents.find(n => n.id === 'result').position);
  const restored = Substrate.restore(graph.snapshot());
  return { substrate: graph, report: { experiment: 'context-weighted relational variation and geometric realization', proposal,
    before, after, settled, geometryChange, stabilityDrift, beforeValue, afterValue, behaviorChange: Math.abs(afterValue - beforeValue),
    restartSameGeometry: JSON.stringify(observe(restored)) === JSON.stringify(settled),
    causeEvent: graph.events.findLast(e => e.kind === 'relational-variation'),
    limits: 'Supplied mutation policy and elastic realization rule; learned weights determine both signal transport and rest lengths under this convention. Not a derived I Ching dimensional mapping, biological mutation law, recognizable world or emerged mutation policy. Observer omission is interface scope, not a security boundary.' } };
}
export function observationSVG(observation) {
  const points = new Map(observation.constituents.map(n => [n.id, n.position]));
  const xy = p => [240 + p[0] * 90, 160 + p[1] * 90];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360" viewBox="0 0 600 360"><rect width="600" height="360" fill="white"/>${observation.segments.map(e => {
    const [x1,y1]=xy(points.get(e.from)),[x2,y2]=xy(points.get(e.to));
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black"/>`;
  }).join('')}${[...points.values()].map(p => { const [cx,cy]=xy(p);return `<circle cx="${cx}" cy="${cy}" r="4"/>`; }).join('')}</svg>`;
}

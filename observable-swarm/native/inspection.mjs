/** Read-only structural evidence; never dispatches behavior by a network label. */
export function inspectFormation(substrate, formationId = null) {
  const formation = formationId === null ? null : substrate.formations.find(f => f.id === formationId);
  if (formationId !== null && !formation) throw Error('Unknown formation');
  const members = new Set(formation?.members ?? substrate.nodes.keys());
  const edges = [...substrate.edges.values()].filter(e => e.enabled && members.has(e.from) && members.has(e.to));
  const adjacency = new Map([...members].map(id => [id, []]));
  for (const e of edges) adjacency.get(e.from).push(e.to);
  let next = 0;
  const indices = new Map(), low = new Map(), stack = [], active = new Set(), components = [];
  function visit(id) {
    indices.set(id, next); low.set(id, next++); stack.push(id); active.add(id);
    for (const to of adjacency.get(id)) {
      if (!indices.has(to)) { visit(to); low.set(id, Math.min(low.get(id), low.get(to))); }
      else if (active.has(to)) low.set(id, Math.min(low.get(id), indices.get(to)));
    }
    if (low.get(id) === indices.get(id)) {
      const group = []; let child;
      do { child = stack.pop(); active.delete(child); group.push(child); } while (child !== id);
      components.push(group.sort());
    }
  }
  for (const id of members) if (!indices.has(id)) visit(id);
  const recurrentComponents = components.filter(group => group.length > 1 || edges.some(e => e.from === group[0] && e.to === group[0]));
  const recurrent = recurrentComponents.length > 0;
  return {
    formation: formation?.id ?? 'entire substrate', tick: substrate.tick, members: [...members],
    structuralDescription: recurrent ? 'recurrent linear signal network' : 'acyclic linear signal network',
    update: substrate.options.execution === 'temporal' ? 'discrete synchronous one-step delay' : 'within-interaction acyclic propagation',
    recurrentComponents, selfConnections: edges.filter(e => e.from === e.to).map(e => e.id),
    constituentStates: [...members].map(id => { const n = substrate.nodes.get(id); return { id, value: n.value, position: [...n.position], input: n.input, dimensionalContext: structuredClone(n.dimensionalContext) }; }),
    relations: edges.map(e => ({ id: e.id, from: e.from, to: e.to, weight: e.weight, usage: e.usage, feedbackUpdates: e.history.filter(h => h.cause === 'feedback').length, origin: substrate.candidates.get(e.id)?.origin ?? 'explicit offer' })),
    executionTrace: substrate.lastTrace.filter(e => members.has(e.from) && members.has(e.to)),
    established: { linearPropagation: true, delayedSignals: substrate.options.execution === 'temporal', cyclesPresent: recurrent },
    notEstablishedByInspection: ['learning generalization', 'memory usefulness', 'spiking or oscillatory neural behavior', 'hidden-layer emergence', 'computational mesh', 'complete five-dimensional morphology'],
    capabilityEvidence: 'Consult held-out and causal-intervention experiments; topology alone does not establish capability.'
  };
}

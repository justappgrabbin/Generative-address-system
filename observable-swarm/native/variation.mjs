// Supplied stochastic policy: recent unstable updates increase variation weight;
// usage reduces it. These probabilities are experimental, not biological laws.
export function proposeVariation(s, random, { amplitude = 0.2, uniform = false } = {}) {
  if (!Number.isFinite(amplitude) || amplitude <= 0) throw Error('Invalid amplitude');
  const candidates = [...s.edges.values()].filter(e => e.enabled && e.trainable).map(e => {
    const updates = e.history.filter(h => Number.isFinite(h.before) && Number.isFinite(h.after)).slice(-20);
    const instability = updates.reduce((sum, h) => sum + Math.abs(h.after - h.before), 0) / Math.max(1, updates.length);
    return { id: e.id, score: uniform ? 1 : (0.01 + instability) / (1 + Math.log1p(e.usage)), instability, usage: e.usage };
  });
  if (!candidates.length) throw Error('No eligible relation');
  const total = candidates.reduce((sum, c) => sum + c.score, 0);
  const sample = () => { const x = random(); if (!Number.isFinite(x) || x < 0 || x >= 1) throw Error('Invalid random sample'); return x; };
  let draw = sample() * total, chosen = candidates.at(-1);
  for (const c of candidates) { draw -= c.score; if (draw < 0) { chosen = c; break; } }
  return { id: chosen.id, weight: s.edges.get(chosen.id).weight + amplitude * (2 * sample() - 1),
    cause: 'experimental context-weighted variation', distribution: candidates.map(c => ({ ...c, probability: c.score / total })) };
}

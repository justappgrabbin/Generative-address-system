/** Experimental general feedback-driven structural search. Not an acquired
 * diagnosis capability: the search policy is supplied by the developer.
 * assess sees a trial graph and returns only a lower-is-better scalar cost.
 * No fault identifier or target transformation is passed to this policy.
 * Trials run on provenance-replayed copies, keeping rejected changes out of
 * the living formation. Accepted changes use journalled substrate operations.
 */
import { Substrate } from './substrate.mjs';
export function reorganizeByFeedback(substrate, assess, { rounds = 4, tolerance = 1e-12 } = {}) {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100 || !Number.isFinite(tolerance) || tolerance < 0) throw Error('Invalid search budget');
  const score = graph => {
    const cost = assess(graph);
    if (!Number.isFinite(cost) || cost < 0) throw Error('Invalid environmental cost');
    return cost;
  };
  const trials = [], accepted = [];
  let cost = score(Substrate.restore(substrate.snapshot()));
  for (let round = 0; round < rounds; round++) {
    let best = null;
    for (const relation of substrate.edges.values()) {
      const trial = Substrate.restore(substrate.snapshot()), enabled = !relation.enabled;
      try { trial.disrupt([relation.id], enabled); }
      catch (error) { trials.push({ round, relation: relation.id, enabled, rejected: error.message }); continue; }
      const candidateCost = score(trial);
      trials.push({ round, relation: relation.id, enabled, cost: candidateCost });
      if (candidateCost < cost - tolerance && (!best || candidateCost < best.cost)) best = { relation: relation.id, enabled, cost: candidateCost };
    }
    if (!best) break;
    substrate.disrupt([best.relation], best.enabled);
    accepted.push({ round, ...best, previousCost: cost }); cost = best.cost;
  }
  return { finalCost: cost, trials, accepted, policy: 'bounded single-relation perturbation with scalar environmental feedback' };
}

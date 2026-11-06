// LABELLED FIX 2026-11-05 (Pink). Original ../tool-06-historical-monte-carlo.js UNTOUCHED.
// Fixes:
//  6. Negative variant weights must never appear as accepted probabilities.
//  7. Empty hypotheses must not report success (ok:false / status:'no-evidence').
// Architecture preserved: same Automaton sampling form, same multiplicative drift.

import { Automaton } from '../../automaton.js';
import { mulberry32 } from '../../../state-space/constants.js';

const normalizeNonNegative = (weights) => {
  const clipped = Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, Number.isFinite(v) && v > 0 ? v : 0]),
  );
  const total = Object.values(clipped).reduce((sum, n) => sum + n, 0);
  if (!(total > 0)) return Object.fromEntries(Object.keys(clipped).map((k) => [k, 0]));
  return Object.fromEntries(Object.entries(clipped).map(([k, v]) => [k, v / total]));
};

const hasInvalidWeight = (weights) =>
  Object.values(weights).some((v) => !Number.isFinite(v) || v < 0);

export class HistoricalMonteCarloAutomaton extends Automaton {
  static registry = Object.freeze({
    id: 'historical-monte-carlo',
    aliases: ['monte-carlo'],
    gate: 32,
    channels: ['32-54'],
    capabilities: ['sample-histories'],
    ports: Object.freeze({
      in: Object.freeze([Object.freeze({ id: 'input', type: 'json' })]),
      out: Object.freeze([Object.freeze({ id: 'output', type: 'json', guarantees: ['addressed'] })]),
    }),
    automatonForm: 'sampling automaton',
    dimension: 'Evolution',
    description: "Klein's historical Monte Carlo (fixed): rejects empty or negative-weight hypotheses; seeded multiplicative weight drift on non-negative weights only.",
  });

  constructor() {
    const d = HistoricalMonteCarloAutomaton.registry;
    super({
      id: d.id,
      address: { gate: d.gate, line: 1, color: 1, tone: 1, base: 1 },
      states: [
        { id: 'hypothesize', initial: true },
        { id: 'sample' },
        { id: 'tally' },
        { id: 'conclude', accepting: true },
      ],
      alphabet: ['variant', 'weight', 'generation', 'sample'],
      q0: 'hypothesize',
      finals: ['conclude'],
      ports: d.ports,
      capabilities: d.capabilities,
      dimension: d.dimension,
      automatonForm: d.automatonForm,
      state: null,
      implementation: (input = {}, { emit }) => {
        const variants = input.variants || {};
        const names = Object.keys(variants);
        // Capability 7: no hypotheses → not a successful sample.
        if (names.length === 0) {
          emit({ from: 'hypothesize', to: 'conclude', input: 'no-evidence', transition: 'flow' });
          return { ok: false, status: 'no-evidence', finalWeights: {}, dominantVariant: null, trajectory: [] };
        }
        // Capability 6: negative / non-finite weights are invalid input, not probabilities.
        if (hasInvalidWeight(variants)) {
          emit({ from: 'hypothesize', to: 'conclude', input: 'invalid-weights', transition: 'flow' });
          return {
            ok: false,
            status: 'invalid-weights',
            reason: 'negative or non-finite variant weights cannot form a probability distribution',
            finalWeights: {},
            dominantVariant: null,
            trajectory: [],
          };
        }

        const seed = input.seed ?? 7;
        const scale = input.mutationScale ?? 0.1;
        const generations = input.generations ?? 20;
        const rng = mulberry32(seed);
        emit({ from: 'hypothesize', to: 'sample', input: `variants=${names.length}`, transition: 'flow' });
        let weights = { ...variants };
        const trajectory = [{ generation: 0, weights: normalizeNonNegative(weights) }];
        for (let generation = 1; generation <= generations; generation++) {
          weights = Object.fromEntries(Object.entries(weights)
            .map(([name, value]) => [name, Math.max(0, value * (1 + (rng() - 0.5) * 2 * scale))]));
          trajectory.push({ generation, weights: normalizeNonNegative(weights) });
        }
        emit({ from: 'sample', to: 'tally', input: `generations=${generations}`, transition: 'recursion' });
        const finalWeights = normalizeNonNegative(weights);
        const dominantVariant = Object.entries(finalWeights)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
        emit({ from: 'tally', to: 'conclude', input: dominantVariant, transition: 'flow' });
        return { ok: true, finalWeights, dominantVariant, trajectory };
      },
    });
  }
}

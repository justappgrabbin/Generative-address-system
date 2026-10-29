// Single pluggable particle swarm optimizer (global-best PSO), deterministic with a seed. Pure JS.
export function rng(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Minimize fitness(x). seeds: initial positions (first is kept as-is). spread: per-dim init range. */
export function pso(fitness, { dims, seeds = [], spread, particles = 24, iterations = 40, w = 0.72, c1 = 1.49, c2 = 1.49, random = rng(1) }) {
  const X = [], V = [], P = [], Pf = []; let G = null, Gf = Infinity;
  for (let p = 0; p < particles; p++) {
    const base = seeds[p % Math.max(1, seeds.length)] || new Float64Array(dims);
    const x = Float64Array.from(base, (v, d) => (p < seeds.length ? v : v + (random() * 2 - 1) * spread[d]));
    const v = Float64Array.from({ length: dims }, (_, d) => (random() * 2 - 1) * spread[d] * 0.1);
    const f = fitness(x); X.push(x); V.push(v); P.push(x.slice()); Pf.push(f); if (f < Gf) { Gf = f; G = x.slice(); }
  }
  for (let it = 0; it < iterations; it++) for (let p = 0; p < particles; p++) {
    const x = X[p], v = V[p];
    for (let d = 0; d < dims; d++) { v[d] = w * v[d] + c1 * random() * (P[p][d] - x[d]) + c2 * random() * (G[d] - x[d]); x[d] += v[d]; }
    const f = fitness(x); if (f < Pf[p]) { Pf[p] = f; P[p] = x.slice(); if (f < Gf) { Gf = f; G = x.slice(); } }
  }
  return { best: G, fitness: Gf };
}


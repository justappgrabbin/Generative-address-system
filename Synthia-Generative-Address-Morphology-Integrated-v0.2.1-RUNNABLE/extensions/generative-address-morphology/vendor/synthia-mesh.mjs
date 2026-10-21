/**
 * SynthiaMesh — the "one authority" weighted mesh.
 *
 * Every subsystem that needs to choose among legal candidates (DEG motif
 * selection, AST ApplyRule selection, tool routing, world behavior) asks
 * THIS instead of inventing its own scoring formula. Search algorithms
 * (A*, BFS, hill-climbing) still do the exploring; this provides the
 * learned values they navigate with.
 *
 * Provenance, honestly stated:
 *  - Node/edge/weight shape is new — nothing donor had a real one.
 *  - The reinforce()/weaken()-by-delta-and-persist pattern is a direct
 *    generalization of triform-simworld's shared/world.ts WorldRelationship
 *    (affinity/trust/tension deltas, clamped, persisted) — that was the one
 *    piece of donor code that actually mutated a weight and kept it.
 *    Generalized here from "character pair" to "any node pair" (candidate
 *    motif, AST rule, tool, world node, etc.).
 *  - ignite/propagate/tick/reactivate implement the vocabulary that
 *    triform-simworld's shared/kimiSovereign.ts named but never built
 *    (KIMI_NAMED_TRANSITIONS: ignition, flow, weakening, dormancy,
 *    reactivation). Those were label strings in a lookup table with no
 *    math behind them; the math here is new, not ported, because there
 *    was nothing to port.
 *
 * Persistence: serialize()/deserialize() round-trip the full learned
 * topology (weights + activation state) to plain JSON so each Synthia
 * instance can keep her own mesh state distinct from every other
 * instance's — no shared/required backend, matches the "fully
 * self-contained JS, no required infra" rule already set for this project.
 */

export const DEFAULT_DECAY = 0.08; // λ — how fast activation weakens per tick
export const DORMANCY_THRESHOLD = 0.12; // θ — below this, a node goes dormant

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function undirectedKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export class SynthiaMesh {
  constructor({ id = "default", decay = DEFAULT_DECAY, threshold = DORMANCY_THRESHOLD } = {}) {
    this.id = id;
    this.decay = decay;
    this.threshold = threshold;
    this.nodes = new Map(); // nodeId -> { id, activation: 0..1, status }
    this.edges = new Map(); // edgeKey -> { a, b, weight: 0..1, directed, updates, key }
  }

  ensureNode(nodeId) {
    if (!this.nodes.has(nodeId)) {
      this.nodes.set(nodeId, { id: nodeId, activation: 0, status: "dormant" });
    }
    return this.nodes.get(nodeId);
  }

  ensureEdge(a, b, { weight = 0.3, directed = false } = {}) {
    const key = directed ? `${a}>${b}` : undirectedKey(a, b);
    if (!this.edges.has(key)) {
      this.edges.set(key, { a, b, weight: clamp01(weight), directed, updates: 0, key });
    }
    return this.edges.get(key);
  }

  /** ignition: dormant -> active (alpha: 0 -> sigma(input)) */
  ignite(nodeId, inputStrength = 1) {
    const node = this.ensureNode(nodeId);
    const sigma = 1 / (1 + Math.exp(-4 * (inputStrength - 0.5)));
    node.activation = clamp01(Math.max(node.activation, sigma));
    node.status = node.activation < this.threshold ? "dormant" : "active";
    return node;
  }

  /** reactivation: dormant -> active via resonance (external nudge, not decay-driven) */
  reactivate(nodeId, resonance) {
    return this.ignite(nodeId, resonance);
  }

  /** flow: active -> active (alpha propagates w/ weight) to directly connected neighbors */
  propagate(fromNodeId) {
    const from = this.nodes.get(fromNodeId);
    if (!from || from.status === "dormant") return [];
    const touched = [];
    for (const edge of this.edges.values()) {
      let neighborId = null;
      if (edge.a === fromNodeId) neighborId = edge.b;
      else if (!edge.directed && edge.b === fromNodeId) neighborId = edge.a;
      if (neighborId == null) continue;
      const neighbor = this.ensureNode(neighborId);
      const incoming = clamp01(from.activation * edge.weight);
      if (incoming > neighbor.activation) {
        neighbor.activation = incoming;
        neighbor.status = incoming < this.threshold ? "dormant" : "active";
      }
      touched.push(neighborId);
    }
    return touched;
  }

  /** weakening + dormancy: active -> weakening -> dormant; topology (edges/weights) is kept */
  tick() {
    for (const node of this.nodes.values()) {
      if (node.status === "dormant") continue;
      node.activation = clamp01(node.activation - this.decay);
      if (node.activation < this.threshold) {
        node.status = "dormant";
        node.activation = 0;
      } else {
        node.status = "weakening";
      }
    }
  }

  /** strengthen or weaken a learned edge based on real outcome evidence, then persist via serialize() */
  reinforce(a, b, delta, { directed = false } = {}) {
    const edge = this.ensureEdge(a, b, { directed });
    edge.weight = clamp01(edge.weight + delta);
    edge.updates += 1;
    return edge;
  }

  weight(a, b, { directed = false } = {}) {
    const key = directed ? `${a}>${b}` : undirectedKey(a, b);
    return this.edges.get(key)?.weight ?? 0;
  }

  /**
   * THE call every subsystem makes instead of inventing its own scorer.
   * legal candidates -> mesh -> ordered candidates.
   * Blends learned edge weight (path strength from current state) with
   * the candidate's own current activation (how "warm" it already is).
   */
  resolveCandidates(currentNodeId, candidateIds, { directed = false, weightBias = 0.7 } = {}) {
    return candidateIds
      .map((candidateId) => {
        const w = this.weight(currentNodeId, candidateId, { directed });
        const candidateActivation = this.nodes.get(candidateId)?.activation ?? 0;
        const score = weightBias * w + (1 - weightBias) * candidateActivation;
        return { id: candidateId, score, weight: w, activation: candidateActivation };
      })
      .sort((x, y) => y.score - x.score);
  }

  serialize() {
    return JSON.stringify({
      id: this.id,
      decay: this.decay,
      threshold: this.threshold,
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
    });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const mesh = new SynthiaMesh({ id: data.id, decay: data.decay, threshold: data.threshold });
    for (const n of data.nodes) mesh.nodes.set(n.id, n);
    for (const e of data.edges) mesh.edges.set(e.key, e);
    return mesh;
  }
}

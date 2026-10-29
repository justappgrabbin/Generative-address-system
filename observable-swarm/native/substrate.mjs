import { sparseLayout, propagateSegment } from './primitives.mjs';
/** Experimental CPU substrate. Only scalar propagation, adaptive relations,
 * formation, movement, feedback and persistence data live here. No task dispatcher.
 * Dimensional interpretations are experimental operational bindings, not a claim
 * to have derived the Black Book's missing physical equations. */
export const DIMENSIONS = ['Movement', 'Evolution', 'Being', 'Design', 'Space'];
const finite = x => typeof x === 'number' && Number.isFinite(x);
const clone = x => structuredClone(x);
const key = (a, b) => `${a}->${b}`;

export class Substrate {
  constructor({ rate = 0.35, growth = 0.003, decay = 0.0001, execution = 'ranked-dag', encounters = null, adaptation = null, selfObservation = false, traces = null } = {}) {
    if (![rate, growth, decay].every(finite) || rate <= 0 || rate > 1 || growth < 0 || decay < 0 || decay > 1) throw Error('Invalid substrate parameters');
    this.options = { rate, growth, decay };
    if (!['ranked-dag', 'discovered-dag', 'temporal'].includes(execution)) throw Error('Invalid execution policy');
    if (execution !== 'ranked-dag') this.options.execution = execution;
    if (selfObservation) {
      if (execution !== 'temporal') throw Error('Self-observation requires delayed execution');
      this.options.selfObservation = true;
    }
    this.executionCounts = { evaluations: 0, layouts: 0, gatheredSignals: 0, multiplications: 0, accumulations: 0, constituentTasks: 0 };
    this.previousValues = {};
    this.valueTick = 0; this.previousValueTick = 0;
    if (encounters !== null) {
      const { radius, minimum = 3 } = encounters;
      if (!finite(radius) || radius <= 0 || !Number.isInteger(minimum) || minimum < 1) throw Error('Invalid encounter policy');
      this.options.encounters = { radius, minimum };
    }
    this.traces = []; this.nextTrace = 1;
    if (traces !== null) {
      const { radius = 0.1, lifetime = 100, decay = 0.95, minimum = 0.05 } = traces;
      if (!finite(radius) || radius <= 0 || !Number.isInteger(lifetime) || lifetime < 1 || !finite(decay) || decay <= 0 || decay >= 1 || !finite(minimum) || minimum <= 0 || minimum >= 1) throw Error('Invalid trace policy');
      this.options.traces = { radius, lifetime, decay, minimum };
    }
    this.contacts = new Map();
    this.retired = [];
    if (adaptation !== null) {
      const { pruneWeight = 0.01, patience = 12, recentContact = 12 } = adaptation;
      if (!finite(pruneWeight) || pruneWeight <= 0 || !Number.isInteger(patience) || patience < 1 || !Number.isInteger(recentContact) || recentContact < 0) throw Error('Invalid adaptation policy');
      this.options.adaptation = { pruneWeight, patience, recentContact };
    }
    this.nodes = new Map(); this.edges = new Map(); this.candidates = new Map();
    this.formations = []; this.nextFormation = 1; this.tick = 0;
    this.events = []; this.journal = []; this.lastTrace = []; this.lastInputs = {};
  }
  record(operation, data) { this.journal.push({ operation, data: clone(data) }); }
  event(kind, data) {
    const e = { id: this.events.length, tick: this.tick, kind, ...clone(data),
      potentialExpressions: Array.from({ length: 6 }, (_, i) => ({ id: i, actionCapable: null })),
      leadingDimension: null, leadershipStatus: 'unresolved: no derived identification rule',
      provenance: 'native/PRIMARY-CONDITIONS.md' };
    this.events.push(e);
    const touched = new Set([data.constituent, data.from, data.to, ...Object.keys(data.inputs || {}), ...Object.keys(data.targets || {}), ...Object.keys(data.realizedExpressions || {})]);
    for (const id of touched) {
      const n = this.nodes.get(id);
      if (n) { n.history.push(e.id); n.address.history.push(e.id); }
    }
    this.contexts(); return e;
  }
  contexts() {
    for (const n of this.nodes.values()) {
      n.dimensionalContext = {
        Movement: { present: true, phase: n.phase, position: [...n.position], fixedContact: n.fixed },
        Evolution: { present: true, encounters: n.experience, historyCount: n.history.length, lastEvent: n.history.at(-1) ?? null },
        Being: { present: true, realizedValue: n.value, extent: n.radius },
        Design: { present: true, executionRank: this.options.execution ? null : n.rank, ...(this.options.execution ? { executionPolicy: this.options.execution === 'temporal' ? 'synchronous one-step delayed signals' : 'order derived from active connections' } : {}), contactType: n.input ? 'input' : 'internal', allowedRelation: 'directed signal' },
        Space: { present: true, resultingAdjacency: [...n.address.relations], formations: this.formations.filter(f => f.members.includes(n.id)).map(f => f.id) }
      };
    }
  }
  add({ id, rank = this.options.execution ? 0 : undefined, input = false, position = [0, 0], fixed = false, radius = 0.02, bias = 0, provenance = null, phase = 0 }) {
    if (typeof id !== 'string' || !id || this.nodes.has(id) || !Number.isInteger(rank) || rank < 0 || !Array.isArray(position) || position.length !== 2 || !position.every(finite) || !finite(radius) || radius < 0 || !finite(bias)) throw Error('Invalid constituent');
    if (input && rank !== 0) throw Error('Input contacts must have rank zero');
    if (!finite(phase)) throw Error('Invalid movement phase');
    const n = { id, rank, input: !!input, fixed: !!fixed, position: [...position], radius, bias, provenance: clone(provenance),
      value: 0, phase, experience: 0, history: [],
      dimensionalContext: Object.fromEntries(DIMENSIONS.map(d => [d, { present: true }])),
      address: { identity: id, frame: 'experimental local formation', relations: [], history: [] } };
    this.nodes.set(id, n); this.record('add', n); this.event('constituent-created', { constituent: id }); return n;
  }
  offer({ from, to }) {
    this.acceptOffer({ from, to }, false);
  }
  reaches(from, to) {
    const pending = [from], visited = new Set();
    while (pending.length) {
      const id = pending.pop(); if (id === to) return true;
      if (visited.has(id)) continue; visited.add(id);
      for (const e of this.edges.values()) if (e.enabled && e.from === id) pending.push(e.to);
    }
    return false;
  }
  permitted(from, to) {
    const a = this.nodes.get(from), b = this.nodes.get(to);
    if (this.options.execution === 'temporal') return !!(a && b && !b.input && (from !== to || this.options.selfObservation));
    return !!(a && b && from !== to && !b.input &&
      (this.options.execution === 'discovered-dag' ? !this.reaches(to, from) : a.rank < b.rank));
  }
  acceptOffer({ from, to }, encountered) {
    if (!this.permitted(from, to)) throw Error('Offer violates typed acyclic execution constraints or delayed-contact policy');
    const id = key(from, to);
    if (!this.candidates.has(id)) {
      this.candidates.set(id, { id, from, to, correlation: 0, encounters: 0, ...(encountered ? { origin: from === to ? 'local-self-observation' : 'local-encounter', firstContact: this.tick } : {}) });
      if (!encountered) this.record('offer', { from, to });
      this.event('offer-accepted', { from, to, relationType: 'signal', ...(encountered ? { reason: from === to ? 'repeated local self-observation' : 'repeated local encounter' } : {}) });
    }
  }
  encounter() {
    const policy = this.options.encounters; if (!policy) return;
    const nodes = [...this.nodes.values()];
    for (const a of nodes) for (const b of nodes) if ((a.id !== b.id || this.options.selfObservation) && !b.input) {
      if (Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1]) > policy.radius) continue;
      const id = key(a.id, b.id), previous = this.contacts.get(id);
      const contact = previous || { from: a.id, to: b.id, count: 0, firstTick: this.tick, lastTick: this.tick };
      contact.count++; contact.lastTick = this.tick; this.contacts.set(id, contact);
      if (contact.count === policy.minimum) this.event('encounter-threshold', { from: a.id, to: b.id, count: contact.count });
      if (contact.count >= policy.minimum && this.permitted(a.id, b.id)) this.acceptOffer({ from: a.id, to: b.id }, true);
    }
  }
  executionOrder() {
    if (this.options.execution !== 'discovered-dag') return [...this.nodes.values()].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
    const indegree = new Map([...this.nodes.keys()].map(id => [id, 0]));
    for (const e of this.edges.values()) if (e.enabled) indegree.set(e.to, indegree.get(e.to) + 1);
    const ready = [...this.nodes.keys()].filter(id => indegree.get(id) === 0).sort(), order = [];
    while (ready.length) {
      const id = ready.shift(); order.push(this.nodes.get(id));
      for (const e of this.edges.values()) if (e.enabled && e.from === id) {
        indegree.set(e.to, indegree.get(e.to) - 1);
        if (indegree.get(e.to) === 0) { ready.push(e.to); ready.sort(); }
      }
    }
    if (order.length !== this.nodes.size) throw Error('Execution cycle detected');
    return order;
  }
  bind({ from, to, weight = 0, trainable = true }) {
    if (!finite(weight)) throw Error('Invalid weight');
    this.offer({ from, to });
    const id = key(from, to);
    if (this.edges.has(id)) throw Error('Relation already exists');
    this.edges.set(id, { id, from, to, weight, trainable: !!trainable, enabled: true, usage: 0, strength: 0, history: [] });
    this.record('bind', { from, to, weight, trainable }); this.event('relation-created', { from, to, reason: 'explicit experimental scaffold' });
    this.organize();
  }
  advance() {
    this.tick++;
    for (const n of this.nodes.values()) {
      n.phase = (n.phase + 0.03) % (Math.PI * 2);
      if (n.fixed) continue;
      const old = [...n.position];
      const proposal = [old[0] + 0.002 * Math.cos(n.phase), old[1] + 0.002 * Math.sin(n.phase)];
      // Realized extents constrain subsequent motion; no image-specific collision code.
      const blocked = [...this.nodes.values()].some(b => b.id !== n.id && Math.hypot(proposal[0] - b.position[0], proposal[1] - b.position[1]) < n.radius + b.radius);
      if (!blocked) n.position = proposal;
      else this.event('boundary-contact', { constituent: n.id, proposal, position: old });
    }
    this.encounter();
    this.environmentalTraces();
  }
  environmentalTraces() {
    const policy = this.options.traces; if (!policy) return;
    // Observe previous visits before depositing this tick. Expired records stay
    // archived for identity/provenance; this deliberately favors auditability.
    for (const t of this.traces) if (t.active) {
      t.strength *= policy.decay;
      if (this.tick - t.createdAt > policy.lifetime || t.strength < policy.minimum) {
        t.active = false;
        const e = this.event('trace-expired', { from: t.source, trace: t.id }); t.history.push(e.id);
        continue;
      }
      for (const n of this.nodes.values()) {
        if (n.id === t.source || n.input || !this.permitted(t.source, n.id)) continue;
        if (Math.hypot(n.position[0] - t.position[0], n.position[1] - t.position[1]) > policy.radius) continue;
        if (t.observers.includes(n.id)) continue;
        t.observers.push(n.id);
        const e = this.event('trace-observed', { from: t.source, to: n.id, trace: t.id, strength: t.strength });
        t.history.push(e.id);
        // A trace provides a reference/contact opportunity, never a task result.
        // Subsequent signal propagation uses the ordinary directed relation.
        if (!this.candidates.has(key(t.source, n.id))) {
          this.acceptOffer({ from: t.source, to: n.id }, true);
          const c = this.candidates.get(key(t.source, n.id));
          c.origin = 'environmental-trace'; c.trace = t.id;
        }
      }
    }
    for (const n of this.nodes.values()) {
      const nearby = this.traces.find(t => t.active && t.source === n.id && Math.hypot(n.position[0] - t.position[0], n.position[1] - t.position[1]) < policy.radius / 2);
      if (nearby) continue;
      const t = { id: `trace-${this.nextTrace++}`, source: n.id, position: [...n.position], createdAt: this.tick, strength: 1, active: true, observers: [], history: [] };
      this.traces.push(t);
      t.history.push(this.event('trace-deposited', { from: n.id, trace: t.id, position: t.position }).id);
    }
  }
  evaluate(inputs = {}) {
    for (const [id, value] of Object.entries(inputs)) if (!this.nodes.get(id)?.input || !finite(value)) throw Error('Invalid input contact/value');
    const required = [...this.nodes.values()].filter(n => n.input);
    if (required.some(n => !Object.hasOwn(inputs, n.id))) throw Error('Missing input contact');
    if (this.options.execution === 'temporal') { this.previousValues = this.values(); this.previousValueTick = this.valueTick; }
    this.advance(); this.lastInputs = clone(inputs); this.lastTrace = [];
    const layout = sparseLayout(this.nodes, this.edges);
    this.executionCounts.evaluations++; this.executionCounts.layouts++;
    for (const n of this.executionOrder()) {
      this.executionCounts.constituentTasks++;
      const result = n.input ? inputs[n.id] : propagateSegment(layout, n.id, n.bias,
        id => this.options.execution === 'temporal' ? this.previousValues[id] : this.nodes.get(id).value,
        (e, source, contribution) => {
          this.executionCounts.gatheredSignals++; this.executionCounts.multiplications++; this.executionCounts.accumulations++;
          e.usage++; e.strength = Math.min(1, e.strength + 0.01);
          this.lastTrace.push({ from: e.from, to: n.id, source, weight: e.weight, contribution, ...(this.options.execution === 'temporal' ? { delay: 1, sourceTick: this.previousValueTick } : {}) });
        });
      if (!finite(result)) throw Error('Non-finite propagation');
      n.value = result; n.experience++;
    }
    if (this.options.execution === 'temporal') this.valueTick = this.tick;
    this.record('evaluate', inputs);
    // The replay journal preserves full inputs and reconstructs every execution.
    // Keep one full current trace instead of duplicating it in every event.
    this.event('interaction', { inputs, execution: { contributions: this.lastTrace.length, journalPosition: this.journal.length - 1 }, realizedExpressions: this.values(), trajectoryChange: null });
    return this.values();
  }
  feedback(targets) {
    if (!this.journal.length || this.journal.at(-1).operation !== 'evaluate') throw Error('Feedback requires a fresh interaction');
    if (!Object.keys(targets).length || Object.entries(targets).some(([id, v]) => !this.nodes.has(id) || this.nodes.get(id).input || !finite(v))) throw Error('Invalid feedback');
    const errors = new Map(); let squaredError = 0;
    for (const [id, target] of Object.entries(targets)) { const error = target - this.nodes.get(id).value; errors.set(id, error); squaredError += error * error; }
    // Reverse transport of residuals is a universal experimental credit rule.
    for (const n of this.options.execution === 'temporal' ? [] : this.executionOrder().reverse()) {
      const delta = errors.get(n.id) || 0;
      for (const e of this.edges.values()) if (e.to === n.id && e.enabled) errors.set(e.from, (errors.get(e.from) || 0) + e.weight * delta);
    }
    for (const n of this.nodes.values()) if (!n.input && errors.has(n.id)) {
      const incoming = [...this.candidates.values()].filter(c => c.to === n.id);
      const sourceValue = id => this.options.execution === 'temporal' ? this.previousValues[id] : this.nodes.get(id).value;
      const norm = 1 + incoming.reduce((s, c) => s + sourceValue(c.from) ** 2, 0);
      const delta = errors.get(n.id);
      n.bias += this.options.rate * delta / norm;
      for (const c of incoming) {
        const signal = sourceValue(c.from);
        c.encounters++; c.correlation = c.correlation * 0.95 + signal * delta * 0.05;
        const contact = this.contacts.get(c.id);
        const contactAllowsBirth = !this.options.adaptation || c.origin !== 'local-encounter' || (contact && this.tick - contact.lastTick <= this.options.adaptation.recentContact);
        if (!this.edges.has(c.id) && contactAllowsBirth && Math.abs(c.correlation) > this.options.growth && this.permitted(c.from, c.to)) {
          this.edges.set(c.id, { id: c.id, from: c.from, to: c.to, weight: 0, trainable: true, enabled: true, usage: 0, strength: 0, history: [] });
          this.event('relation-created', { from: c.from, to: c.to, reason: 'experienced signal/residual correlation', correlation: c.correlation });
        }
        const e = this.edges.get(c.id);
        if (e?.enabled && e.trainable) {
          const before = e.weight;
          e.weight += this.options.rate * delta * signal / norm;
          e.history.push({ tick: this.tick, before, after: e.weight, cause: 'feedback' });
          if (this.options.adaptation) {
            e.weakSteps = Math.abs(e.weight) < this.options.adaptation.pruneWeight ? (e.weakSteps || 0) + 1 : 0;
            if (e.weakSteps >= this.options.adaptation.patience) {
              this.retired.push({ ...clone(e), retiredAt: this.tick, reason: 'persistently weak learned contribution' });
              this.edges.delete(e.id);
              this.event('relation-dissolved', { from: e.from, to: e.to, reason: 'persistently weak learned contribution' });
            }
          }
        }
      }
    }
    this.record('feedback', targets); this.event('feedback', { targets, squaredError, consequences: 'relations and constituent offsets updated' }); this.organize();
    return squaredError / Object.keys(targets).length;
  }
  disrupt(ids, enabled = false) {
    if (!Array.isArray(ids) || ids.some(id => !this.edges.has(id))) throw Error('Unknown relation');
    if (enabled && this.options.execution === 'discovered-dag') {
      const changed = [];
      for (const id of ids) {
        const e = this.edges.get(id);
        if (e.enabled) continue;
        if (this.reaches(e.to, e.from)) { for (const prior of changed) prior.enabled = false; throw Error('Restoration would introduce an execution cycle'); }
        e.enabled = true; changed.push(e);
      }
    }
    for (const id of ids) { const e = this.edges.get(id); e.enabled = enabled; e.history.push({ tick: this.tick, enabled }); }
    this.record('disrupt', { ids, enabled }); this.event('relations-altered', { ids, enabled }); this.organize();
  }
  vary({ id, weight, cause }) {
    const e = this.edges.get(id);
    if (!e || !finite(weight) || typeof cause !== 'string' || !cause) throw Error('Invalid relational variation');
    const before = e.weight; e.weight = weight;
    e.history.push({ tick: this.tick, before, after: weight, cause });
    this.record('vary', { id, weight, cause });
    this.event('relational-variation', { from: e.from, to: e.to, before, after: weight, cause });
  }
  relax({ steps = 1, rate = 0.1, rest = 0.1 } = {}) {
    if (!Number.isInteger(steps) || steps < 1 || steps > 10000 || !finite(rate) || rate <= 0 || rate > 0.2 || !finite(rest) || rest <= 0) throw Error('Invalid relaxation');
    // Experimental elastic realization: learned magnitude determines rest length.
    // No symbol/color association or prescribed object shape enters this rule.
    for (let step = 0; step < steps; step++) {
      const shifts = new Map([...this.nodes.keys()].map(id => [id, [0, 0]]));
      for (const e of this.edges.values()) if (e.enabled) {
        const a = this.nodes.get(e.from), b = this.nodes.get(e.to);
        const dx = b.position[0] - a.position[0], dy = b.position[1] - a.position[1], distance = Math.hypot(dx, dy);
        if (!distance) continue;
        const desired = rest + Math.abs(e.weight), force = rate * (distance - desired);
        for (const [n, sign] of [[a, 1], [b, -1]]) if (!n.fixed) {
          shifts.get(n.id)[0] += sign * force * dx / distance;
          shifts.get(n.id)[1] += sign * force * dy / distance;
        }
      }
      for (const n of this.nodes.values()) if (!n.fixed) n.position = n.position.map((v, i) => v + shifts.get(n.id)[i]);
    }
    this.record('relax', { steps, rate, rest });
    this.event('geometric-relaxation', { steps, rate, rest, realizedExpressions: this.values() });
  }
  place({ id, position }) {
    const n = this.nodes.get(id);
    if (!n || !Array.isArray(position) || position.length !== 2 || !position.every(finite)) throw Error('Invalid spatial perturbation');
    const before = [...n.position]; n.position = [...position];
    this.record('place', { id, position });
    this.event('environment-perturbation', { constituent: id, before, position, cause: 'explicit external condition change' });
  }
  idle(steps = 1) {
    if (!Number.isInteger(steps) || steps < 0 || steps > 10000) throw Error('Invalid idle interval');
    for (let i = 0; i < steps; i++) {
      this.advance();
      for (const [id, e] of this.edges) {
        e.strength *= 1 - this.options.decay;
        if (e.strength < 1e-6 && Math.abs(e.weight) < 1e-6 && e.usage > 0) { this.edges.delete(id); this.event('relation-dissolved', { from: e.from, to: e.to, reason: 'weak unused relation' }); }
      }
    }
    this.record('idle', steps); this.event('idle', { steps }); this.organize();
  }
  organize() {
    const groups = [], unseen = new Set(this.nodes.keys());
    while (unseen.size) {
      const stack = [unseen.values().next().value], members = []; unseen.delete(stack[0]);
      while (stack.length) { const id = stack.pop(); members.push(id); for (const e of this.edges.values()) if (e.enabled && (e.from === id || e.to === id)) { const other = e.from === id ? e.to : e.from; if (unseen.delete(other)) stack.push(other); } }
      if (members.length > 1 || (this.options.execution === 'temporal' && [...this.edges.values()].some(e => e.enabled && e.from === members[0] && e.to === members[0]))) groups.push(members.sort());
    }
    const previous = this.formations;
    this.formations = groups.map(members => {
      const same = previous.find(f => JSON.stringify(f.members) === JSON.stringify(members));
      return same || { id: `formation-${this.nextFormation++}`, members, createdAt: this.tick,
        predecessors: previous.filter(f => f.members.some(id => members.includes(id))).map(f => f.id), dimensionalParticipation: [...DIMENSIONS] };
    });
    for (const n of this.nodes.values()) n.address.relations = [...this.edges.values()].filter(e => e.enabled && (e.from === n.id || e.to === n.id)).map(e => e.id);
    this.contexts();
  }
  values() { return Object.fromEntries([...this.nodes.values()].map(n => [n.id, n.value])); }
  snapshot() { return clone({ version: 1, options: this.options, nodes: [...this.nodes], edges: [...this.edges], candidates: [...this.candidates], ...(this.options.encounters ? { contacts: [...this.contacts] } : {}), ...(this.options.execution === 'temporal' ? { previousValues: this.previousValues, valueTick: this.valueTick, previousValueTick: this.previousValueTick } : {}), ...(this.options.adaptation ? { retired: this.retired } : {}), ...(this.options.traces ? { traces: this.traces, nextTrace: this.nextTrace } : {}), formations: this.formations, nextFormation: this.nextFormation, tick: this.tick, events: this.events, journal: this.journal, lastTrace: this.lastTrace, lastInputs: this.lastInputs }); }
  static replay(journal, options = {}) {
    const s = new Substrate(options);
    const operations = new Set(['add', 'offer', 'bind', 'evaluate', 'feedback', 'disrupt', 'idle', 'place', 'vary', 'relax']);
    for (const { operation, data } of journal) {
      if (!operations.has(operation)) throw Error('Unsupported replay operation');
      if (operation === 'disrupt') s.disrupt(data.ids, data.enabled); else s[operation](data);
    }
    return s;
  }
  static restore(snapshot) {
    if (snapshot?.version !== 1 || !Array.isArray(snapshot.journal)) throw Error('Unsupported snapshot');
    // Rebuild and compare: serialized learned state cannot silently diverge from its provenance.
    const s = Substrate.replay(snapshot.journal, snapshot.options);
    if (JSON.stringify(s.snapshot()) !== JSON.stringify(snapshot)) throw Error('Snapshot does not match event provenance');
    return s;
  }
}

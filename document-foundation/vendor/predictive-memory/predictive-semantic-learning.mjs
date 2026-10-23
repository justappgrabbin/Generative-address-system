'use strict';

import {LAYERS, GenerativeTraceMemory} from './vqvae-generative-memory.mjs';

const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
const clone = (x) => x == null ? x : JSON.parse(JSON.stringify(x));
const stable = obj => obj === null || typeof obj !== 'object' ? JSON.stringify(obj) : Array.isArray(obj) ? '['+obj.map(stable).join(',')+']' : '{'+Object.keys(obj).sort().map(k=>JSON.stringify(k)+':'+stable(obj[k])).join(',')+'}';

function coordKey(coord = {}) {
  return LAYERS.map(({name}) => `${name}:${coord[name] ?? '?'}`).join('|');
}

function partialKey(partial = {}) {
  return LAYERS.filter(({name}) => partial[name] !== undefined && partial[name] !== null)
    .map(({name}) => `${name}:${partial[name]}`).join('|') || 'empty-cue';
}

function compareCoordinates(predicted = {}, actual = {}) {
  let compared = 0, correct = 0;
  const perLayer = {};
  for (const {name} of LAYERS) {
    if (actual[name] === undefined || actual[name] === null) continue;
    compared += 1;
    const ok = predicted[name] === actual[name];
    if (ok) correct += 1;
    perLayer[name] = { predicted: predicted[name] ?? null, actual: actual[name], correct: ok };
  }
  return { compared, correct, accuracy: compared ? correct / compared : null, perLayer };
}

function compareOutcome(predicted, actual) {
  if (actual === undefined) return { comparable: false, correct: null, score: null };
  const p = stable(predicted ?? null);
  const a = stable(actual ?? null);
  const correct = p === a;
  return { comparable: true, correct, score: correct ? 1 : 0 };
}

class LearnedRelationMesh {
  constructor({learningRate = 0.12, decayRate = 0.02, floor = 0.05, now = Date.now} = {}) {
    this.learningRate = learningRate; this.now = now;
    this.decayRate = decayRate;
    this.floor = floor;
    this.edges = new Map();
  }

  _id(from, relation, to) { return `${from}::${relation}::${to}`; }

  observe({from, relation = 'predicts', to, success, evidence = null}) {
    const id = this._id(from, relation, to);
    const prev = this.edges.get(id) || {
      id, from, relation, to, weight: 0.5, traversals: 0, successes: 0, failures: 0, evidence: []
    };
    const direction = success ? 1 : -1;
    const nextWeight = clamp01(prev.weight + direction * this.learningRate * (success ? (1 - prev.weight) : prev.weight));
    const next = {
      ...prev,
      weight: Math.max(this.floor, nextWeight),
      traversals: prev.traversals + 1,
      successes: prev.successes + (success ? 1 : 0),
      failures: prev.failures + (success ? 0 : 1),
      evidence: [...prev.evidence, evidence].filter(Boolean).slice(-12),
      updatedAt: this.now(),
    };
    this.edges.set(id, next);
    return Object.freeze(clone(next));
  }

  decay() {
    for (const [id, edge] of this.edges) {
      const next = {...edge, weight: Math.max(this.floor, edge.weight * (1 - this.decayRate))};
      this.edges.set(id, next);
    }
  }

  strongest(limit = 12) {
    return [...this.edges.values()].sort((a,b) => b.weight - a.weight || b.traversals - a.traversals).slice(0, limit).map(clone);
  }
}

class PredictiveMemoryLoop {
  constructor({memory = new GenerativeTraceMemory(), fireThreshold = 0.55, relationMesh = new LearnedRelationMesh(), now = Date.now} = {}) {
    this.memory = memory; this.now = now;
    this.fireThreshold = fireThreshold;
    this.mesh = relationMesh;
    this.predictions = new Map();
    this.sequence = 0;
    this.calibration = new Map();
  }

  rememberExperience({coordinate, outcome = null, nextCoordinate = null, evidence = [], address = null, id = null} = {}) {
    if (!coordinate) throw new TypeError('coordinate is required');
    return this.memory.remember(coordinate, {
      id,
      address,
      evidence,
      outcome: { value: clone(outcome), nextCoordinate: clone(nextCoordinate) },
    });
  }

  predict(cue, {minActivation = this.fireThreshold} = {}) {
    const recall = this.memory.reactivate(cue, {minConfidence: minActivation});
    const source = recall.matchedTrace;
    const storedOutcome = source?.outcome || null;
    const prediction = Object.freeze({
      id: `prediction:${++this.sequence}`,
      at: this.now(),
      status: recall.status === 'firing' ? 'open' : 'weak-candidate',
      cue: Object.freeze({...cue}),
      cueKey: partialKey(cue),
      activation: recall.activation,
      sourceTraceId: source?.id || null,
      sourceTraceIndex: source?.traceIndex ?? null,
      predictedCoordinate: Object.freeze({...recall.completed.coordinate}),
      predictedNextCoordinate: storedOutcome?.nextCoordinate ? Object.freeze({...storedOutcome.nextCoordinate}) : null,
      predictedOutcome: clone(storedOutcome?.value ?? null),
      provenance: recall.completed.provenance,
      confidence: recall.completed.confidence,
      epistemicStatus: 'prediction-not-fact',
    });
    this.predictions.set(prediction.id, prediction);
    return prediction;
  }

  resolve(predictionId, {coordinate = null, outcome = undefined, evidence = null} = {}) {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) throw new Error(`Unknown prediction: ${predictionId}`);
    if(prediction.status === "resolved") throw new Error("Prediction already resolved");

    const targetPrediction = prediction.predictedNextCoordinate || prediction.predictedCoordinate;
    const coordinateResult = coordinate ? compareCoordinates(targetPrediction, coordinate) : {compared:0, correct:0, accuracy:null, perLayer:{}};
    const outcomeResult = compareOutcome(prediction.predictedOutcome, outcome);
    const scores = [];
    if (coordinateResult.accuracy !== null) scores.push(coordinateResult.accuracy);
    if (outcomeResult.score !== null) scores.push(outcomeResult.score);
    const score = scores.length ? scores.reduce((a,b)=>a+b,0) / scores.length : 0;
    const success = score >= 0.75;

    const cal = this.calibration.get(prediction.cueKey) || {correct:0, total:0, meanScore:0};
    const nextCal = {
      correct: cal.correct + (success ? 1 : 0),
      total: cal.total + 1,
      meanScore: (cal.meanScore * cal.total + score) / (cal.total + 1),
    };
    this.calibration.set(prediction.cueKey, nextCal);

    const actualKey = coordinate ? coordKey(coordinate) : stable(outcome ?? null);
    const relation = this.mesh.observe({
      from: prediction.cueKey,
      relation: 'predicts',
      to: actualKey,
      success,
      evidence: {predictionId, score, evidence: clone(evidence)},
    });

    const resolved = Object.freeze({
      predictionId,
      resolvedAt: this.now(),
      success,
      score,
      prediction: clone(prediction),
      actual: Object.freeze({coordinate: clone(coordinate), outcome: clone(outcome), evidence: clone(evidence)}),
      error: Object.freeze({
        coordinate: coordinateResult,
        outcome: outcomeResult,
        magnitude: 1 - score,
      }),
      calibration: Object.freeze({...nextCal, accuracy: nextCal.total ? nextCal.correct / nextCal.total : 0}),
      learnedRelation: relation,
      rule: 'prediction is compared with Reality; only the observed outcome becomes fact',
    });

    this.predictions.set(predictionId, Object.freeze({...prediction, status:'resolved', resolution: resolved}));
    return resolved;
  }

  snapshot() {
    return Object.freeze({
      memories: this.memory.snapshot(),
      openPredictions: [...this.predictions.values()].filter(p => p.status !== 'resolved').map(clone),
      calibration: Object.fromEntries([...this.calibration.entries()].map(([k,v]) => [k, clone(v)])),
      strongestRelations: this.mesh.strongest(),
    });
  }
}

export {
  PredictiveMemoryLoop,
  LearnedRelationMesh,
  compareCoordinates,
  compareOutcome,
  coordKey,
  partialKey,
};

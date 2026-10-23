// vqvae.js
// Vector-Quantized Variational Autoencoder, implemented from scratch (no TF.js, no API calls).
// Rebuild of the storage half of Fayyaz et al. 2022 ("A Model of Semantic Completion in
// Generative Episodic Memory", Neural Comput 34(9):1841-1870, PMID 35896150): the hippocampus
// stores a compressed, discretized trace of an experience rather than the raw experience itself.
//
// Domain mapping: an "experience" here is one full sentence-coordinate —
//   dimension.center.gate.line.color.tone.base.sign.house
// Each layer is categorical, so instead of pixel intensities we quantize a 9-layer coordinate.

const LAYERS = [
  {name:'planetary',k:13},{name:'dimension',k:5},{name:'gate',k:64},
  {name:'line',k:6},{name:'color',k:6},{name:'tone',k:6},{name:'base',k:5},
  {name:'degree',k:30},{name:'minute',k:60},{name:'second',k:60},
  {name:'arc',k:100},{name:'zodiac',k:12},{name:'house',k:12},
];
const INPUT_DIM = LAYERS.reduce((s, l) => s + l.k, 0); // 130

// ---------- tiny linear-algebra helpers (flat arrays, no dependencies) ----------
function zeros(n) { return new Array(n).fill(0); }
function randMat(rows, cols, scale, random = Math.random) {
  const m = new Array(rows);
  for (let i = 0; i < rows; i++) {
    m[i] = new Array(cols);
    for (let j = 0; j < cols; j++) m[i][j] = (random() * 2 - 1) * scale;
  }
  return m;
}
function matVec(W, x) { // W: [out][in], x: [in] -> [out]
  const out = zeros(W.length);
  for (let i = 0; i < W.length; i++) {
    let s = 0;
    const row = W[i];
    for (let j = 0; j < row.length; j++) s += row[j] * x[j];
    out[i] = s;
  }
  return out;
}
function addInPlace(a, b) { for (let i = 0; i < a.length; i++) a[i] += b[i]; return a; }
function relu(x) { return x.map(v => Math.max(0, v)); }
function reluGrad(pre) { return pre.map(v => (v > 0 ? 1 : 0)); }
function softmax(x) {
  const m = Math.max(...x);
  const ex = x.map(v => Math.exp(v - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map(v => v / s);
}
function oneHot(k, idx) { const v = zeros(k); v[idx] = 1; return v; }

// ---------- a single dense (fully-connected) layer with manual backprop ----------
class Dense {
  constructor(inDim, outDim, scale, random = Math.random) {
    this.W = randMat(outDim, inDim, scale || Math.sqrt(2 / inDim), random);
    this.b = zeros(outDim);
  }
  forward(x) {
    const pre = addInPlace(matVec(this.W, x), this.b);
    return pre;
  }
  // dOutPre: gradient w.r.t. this layer's pre-activation output (already includes any
  // downstream activation-derivative). Returns gradient w.r.t. input x.
  backward(x, dOutPre, lr) {
    const dX = zeros(x.length);
    for (let i = 0; i < this.W.length; i++) {
      const g = dOutPre[i];
      if (g === 0) continue;
      const row = this.W[i];
      for (let j = 0; j < row.length; j++) {
        dX[j] += row[j] * g;
        row[j] -= lr * g * x[j];
      }
      this.b[i] -= lr * g;
    }
    return dX;
  }
}

function encodeCoordinate(coord) {
  // coord: {dimension: idx, center: idx, ...} -> flat one-hot concat, length INPUT_DIM
  const vec = [];
  for (const layer of LAYERS) vec.push(...oneHot(layer.k, coord[layer.name]));
  return vec;
}

class VQVAE {
  constructor(latentDim = 24, hiddenDim = 48, codebookSize = 32, random = Math.random) {
    this.latentDim = latentDim;
    this.hiddenDim = hiddenDim;
    this.codebookSize = codebookSize;

    this.encL1 = new Dense(INPUT_DIM, hiddenDim, undefined, random);
    this.encL2 = new Dense(hiddenDim, latentDim, undefined, random);
    this.codebook = randMat(codebookSize, latentDim, 1.0, random);
    this.decL1 = new Dense(latentDim, hiddenDim, undefined, random);
    // one softmax head per layer, all reading the shared decoder hidden state
    this.heads = LAYERS.map(l => new Dense(hiddenDim, l.k, undefined, random));
  }

  encode(x) {
    const h1pre = this.encL1.forward(x);
    const h1 = relu(h1pre);
    const z = this.encL2.forward(h1);
    return { x, h1pre, h1, z };
  }

  quantize(z) {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < this.codebook.length; i++) {
      let d = 0;
      for (let j = 0; j < z.length; j++) { const diff = z[j] - this.codebook[i][j]; d += diff * diff; }
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return { index: best, zq: this.codebook[best].slice() };
  }

  decode(zq) {
    const h2pre = this.decL1.forward(zq);
    const h2 = relu(h2pre);
    const logitsPerLayer = this.heads.map(head => head.forward(h2));
    return { h2pre, h2, logitsPerLayer };
  }

  // Full forward pass for one coordinate. Returns everything needed for backward + inspection.
  forward(coord) {
    const x = encodeCoordinate(coord);
    const enc = this.encode(x);
    const q = this.quantize(enc.z);
    const dec = this.decode(q.zq);
    const probsPerLayer = dec.logitsPerLayer.map(softmax);
    return { x, enc, q, dec, probsPerLayer };
  }

  // One SGD step on one experience. beta = commitment loss weight.
  trainStep(coord, lr = 0.03, beta = 0.25) {
    const { x, enc, q, dec, probsPerLayer } = this.forward(coord);

    // --- reconstruction loss: cross-entropy per layer, gradient at each head's pre-activation
    // is simply (softmax_probs - one_hot_target) — the standard softmax+CE shortcut.
    let dH2 = zeros(this.hiddenDim);
    let ceLoss = 0;
    LAYERS.forEach((layer, li) => {
      const target = coord[layer.name];
      const p = probsPerLayer[li];
      ceLoss += -Math.log(Math.max(p[target], 1e-9));
      const dLogits = p.slice(); dLogits[target] -= 1;
      dH2 = addInPlace(dH2, this.heads[li].backward(dec.h2, dLogits, lr));
    });
    const dH2pre = dH2.map((g, i) => g * reluGrad(dec.h2pre)[i]);
    const dZq = this.decL1.backward(q.zq, dH2pre, lr);

    // --- VQ losses (van den Oord et al. formulation, adapted straight-through):
    // codebook loss moves the chosen embedding toward z (detach z)
    // commitment loss moves z toward the chosen embedding (detach embedding)
    const embedding = this.codebook[q.index];
    let vqLoss = 0;
    for (let j = 0; j < embedding.length; j++) {
      const diff = enc.z[j] - embedding[j];
      vqLoss += diff * diff;
      embedding[j] += lr * diff;                 // codebook loss step (pulls embedding -> z)
    }
    // straight-through: gradient from decoder flows to z as if zq == z, plus commitment term
    const dZ = dZq.map((g, j) => g + beta * 2 * (enc.z[j] - embedding[j]));

    // --- backprop through encoder ---
    const dH1 = this.encL2.backward(enc.h1, dZ, lr);
    const dH1pre = dH1.map((g, i) => g * reluGrad(enc.h1pre)[i]);
    this.encL1.backward(x, dH1pre, lr);

    return { ceLoss, vqLoss, codeIndex: q.index };
  }

  train(experiences, epochs = 200, lr = 0.03) {
    const log = [];
    for (let e = 0; e < epochs; e++) {
      let totalCE = 0, totalVQ = 0;
      for (const coord of experiences) {
        const { ceLoss, vqLoss } = this.trainStep(coord, lr);
        totalCE += ceLoss; totalVQ += vqLoss;
      }
      if (e % Math.max(1, Math.floor(epochs / 10)) === 0 || e === epochs - 1) {
        log.push({ epoch: e, ce: totalCE / experiences.length, vq: totalVQ / experiences.length });
      }
    }
    return log;
  }

  // Encode + quantize an experience -> discrete trace id (the "hippocampal index" for it)
  traceOf(coord) {
    const { q } = this.forward(coord);
    return q.index;
  }

  // Reconstruct a full coordinate (argmax per layer) from a stored/quantized trace index
  reconstructFromTrace(index) {
    const dec = this.decode(this.codebook[index]);
    const out = {};
    LAYERS.forEach((layer, li) => {
      const probs = softmax(dec.logitsPerLayer[li]);
      out[layer.name] = probs.indexOf(Math.max(...probs));
    });
    return out;
  }
}

// semantic_completion.js
// Rebuild of the completion half of Fayyaz et al. 2022: "the neocortex reasonably fills in the
// missing parts based on general semantic information" when a stored trace is incomplete.
// Their model chains a PixelCNN-style autoregressive network on top of the VQ-VAE's discrete
// codes. A PixelCNN factorizes p(pixels) = prod_i p(pixel_i | pixel_<i) using causal masking.
// Our "pixels" are the 9 categorical layers, so the same factorization is:
//   p(dimension, center, gate, line, color, tone, base, sign, house)
//     = p(dimension) * p(center|dimension) * p(gate|dimension,center) * ...
// implemented as 9 small classifiers chained in a fixed causal order, trained with teacher
// forcing and run autoregressively at completion time. No external ML/AI library.



class SemanticCompletion {
  constructor(hiddenDim = 32, random = Math.random) {
    this.hiddenDim = hiddenDim;
    // classifier i sees the concatenated one-hots of layers [0..i-1]; input dim grows with i.
    let prefixDim = 0;
    this.stages = LAYERS.map((layer, i) => {
      const stage = {
        inDim: prefixDim,
        l1: prefixDim > 0 ? new Dense(prefixDim, hiddenDim, undefined, random) : null,
        l2: new Dense(prefixDim > 0 ? hiddenDim : 1, layer.k, undefined, random), // dimension layer (i=0) has no context: bias-only prior
      };
      prefixDim += layer.k;
      return stage;
    });
  }

  _prefixVec(coord, uptoIdx) {
    const vec = [];
    for (let i = 0; i < uptoIdx; i++) vec.push(...oneHot(LAYERS[i].k, coord[LAYERS[i].name]));
    return vec;
  }

  // forward for stage i given the true/known prefix -> {probs, cache}
  _forwardStage(i, prefixVec) {
    const stage = this.stages[i];
    if (stage.inDim === 0) {
      const logits = stage.l2.forward([1]); // learned constant prior over categories
      return { probs: softmax(logits), cache: { input: [1] } };
    }
    const h1pre = stage.l1.forward(prefixVec);
    const h1 = relu(h1pre);
    const logits = stage.l2.forward(h1);
    return { probs: softmax(logits), cache: { h1pre, h1, input: prefixVec } };
  }

  trainStep(coord, lr = 0.05) {
    let totalCE = 0;
    LAYERS.forEach((layer, i) => {
      const prefix = this._prefixVec(coord, i);
      const { probs, cache } = this._forwardStage(i, prefix);
      const target = coord[layer.name];
      totalCE += -Math.log(Math.max(probs[target], 1e-9));
      const dLogits = probs.slice(); dLogits[target] -= 1;

      const stage = this.stages[i];
      if (stage.inDim === 0) {
        stage.l2.backward(cache.input, dLogits, lr);
      } else {
        const dH1 = stage.l2.backward(cache.h1, dLogits, lr);
        const dH1pre = dH1.map((g, j) => g * reluGrad(cache.h1pre)[j]);
        stage.l1.backward(cache.input, dH1pre, lr);
      }
    });
    return totalCE;
  }

  train(experiences, epochs = 300, lr = 0.05) {
    const log = [];
    for (let e = 0; e < epochs; e++) {
      let total = 0;
      for (const coord of experiences) total += this.trainStep(coord, lr);
      if (e % Math.max(1, Math.floor(epochs / 10)) === 0 || e === epochs - 1) {
        log.push({ epoch: e, ce: total / experiences.length });
      }
    }
    return log;
  }

  // partial: object with SOME layer names set to an integer index; others left undefined/null.
  // Returns { coord, confidence } where coord has every layer filled in and confidence is the
  // per-layer probability the network assigned to the value it used (1.0 for given/known layers).
  complete(partial, { sample = false, temperature = 1.0 } = {}) {
    const coord = {};
    const confidence = {};
    LAYERS.forEach((layer, i) => {
      const known = partial[layer.name];
      if (known !== undefined && known !== null) {
        coord[layer.name] = known;
        confidence[layer.name] = 1.0;
        return;
      }
      const prefix = this._prefixVec(coord, i);
      const { probs } = this._forwardStage(i, prefix);
      let choice;
      if (sample) {
        const adj = probs.map(p => Math.pow(p, 1 / temperature));
        const s = adj.reduce((a, b) => a + b, 0);
        let r = Math.random() * s, acc = 0;
        choice = adj.length - 1;
        for (let k = 0; k < adj.length; k++) { acc += adj[k]; if (r <= acc) { choice = k; break; } }
      } else {
        choice = probs.indexOf(Math.max(...probs));
      }
      coord[layer.name] = choice;
      confidence[layer.name] = probs[choice];
    });
    return { coord, confidence };
  }
}


// ---------- integrated episodic-memory organ ----------
// Storage and completion are intentionally kept distinct in provenance:
// observed = supplied by current evidence; reconstructed = decoded from a stored VQ trace;
// inferred = filled by semantic completion from partial context.
class GenerativeTraceMemory {
  constructor({ latentDim = 24, hiddenDim = 48, codebookSize = 32, completionHiddenDim = 32, fireThreshold = 0.55, random = Math.random, now = Date.now } = {}) {
    this.vqvae = new VQVAE(latentDim, hiddenDim, codebookSize, random);
    this.completion = new SemanticCompletion(completionHiddenDim, random);
    this.fireThreshold = fireThreshold; this.now = now;
    this.traces = [];
  }

  train(experiences, { vqEpochs = 200, completionEpochs = 300, vqLR = 0.03, completionLR = 0.05 } = {}) {
    return {
      vq: this.vqvae.train(experiences, vqEpochs, vqLR),
      completion: this.completion.train(experiences, completionEpochs, completionLR),
    };
  }

  remember(coord, meta = {}) {
    const traceIndex = this.vqvae.traceOf(coord);
    const rec = Object.freeze({
      id: meta.id || `trace:${this.now()}:${this.traces.length}`,
      traceIndex,
      coordinate: Object.freeze({ ...coord }),
      address: meta.address || null,
      outcome: meta.outcome ?? null,
      evidence: Array.isArray(meta.evidence) ? Object.freeze([...meta.evidence]) : Object.freeze([]),
      at: meta.at || this.now(),
    });
    this.traces.push(rec);
    return rec;
  }

  reconstruct(traceIndex) {
    const coordinate = this.vqvae.reconstructFromTrace(traceIndex);
    const provenance = Object.fromEntries(LAYERS.map(layer => [layer.name, 'reconstructed']));
    return Object.freeze({ traceIndex, coordinate: Object.freeze(coordinate), provenance: Object.freeze(provenance) });
  }

  complete(partial, options = {}) {
    const result = this.completion.complete(partial, options);
    const provenance = {};
    for (const layer of LAYERS) {
      const known = partial[layer.name] !== undefined && partial[layer.name] !== null;
      provenance[layer.name] = known ? 'observed' : 'inferred';
    }
    return Object.freeze({
      coordinate: Object.freeze(result.coord),
      confidence: Object.freeze(result.confidence),
      provenance: Object.freeze(provenance),
    });
  }

  // Partial-cue reactivation: complete the missing coordinate, then identify the closest
  // stored episode by categorical agreement. It never promotes inferred fields to observed.
  reactivate(partial, { minConfidence = this.fireThreshold, ...completionOptions } = {}) {
    const completed = this.complete(partial, completionOptions);
    let best = null;
    for (const trace of this.traces) {
      let matches = 0;
      let compared = 0;
      for (const layer of LAYERS) {
        const value = completed.coordinate[layer.name];
        if (value === undefined || value === null) continue;
        compared += 1;
        if (trace.coordinate[layer.name] === value) matches += 1;
      }
      const score = compared ? matches / compared : 0;
      if (!best || score > best.score) best = { trace, score };
    }
    const inferredConf = LAYERS
      .filter(layer => completed.provenance[layer.name] === 'inferred')
      .map(layer => completed.confidence[layer.name]);
    const completionConfidence = inferredConf.length
      ? inferredConf.reduce((a,b) => a+b, 0) / inferredConf.length
      : 1;
    const activation = best ? best.score * completionConfidence : 0;
    return Object.freeze({
      status: activation >= minConfidence ? 'firing' : 'candidate',
      activation,
      threshold: minConfidence,
      cue: Object.freeze({ ...partial }),
      completed,
      matchedTrace: best ? best.trace : null,
      matchScore: best ? best.score : 0,
      rule: 'inference may reactivate a memory; only current evidence is observed',
    });
  }

  snapshot() {
    return Object.freeze({ count: this.traces.length, traces: Object.freeze([...this.traces]) });
  }
}

export {
  LAYERS, INPUT_DIM, VQVAE, Dense, softmax, oneHot, encodeCoordinate,
  SemanticCompletion, GenerativeTraceMemory,
};

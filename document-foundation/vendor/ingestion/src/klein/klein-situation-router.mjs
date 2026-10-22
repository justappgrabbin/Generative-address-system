
import { TOOL_REGISTRY } from '../../../spine/src/pure-synthia/automata/registry.js';

const TOOL_SEEDS = Object.freeze({
  'autoling': [
    'grammar-induction','learn-transformation','unknown-syntax','foreign-lowering',
    'reusable-rule','morphology','phrase-structure','semantic-parse','examples'
  ],
  'autoling-lite': ['grammar-induction-lite','pattern-rule','few-shot-pattern'],
  'klein-analogy': [
    'analogy','correspondence','map-relation','transfer','foreign-lowering',
    'known-to-unknown','structural-mapping'
  ],
  'historical-monte-carlo': [
    'multiple-candidates','uncertainty','search','sample','recovery','competing-lowerers',
    'strategy-selection'
  ],
  'computational-grammar-coder': [
    'source-grammar','disambiguate','token-class','syntax-coding','lexical-ambiguity'
  ],
  'morph-mir': [
    'artifact-memory','ingest-artifact','remember-artifact','regenerate-artifact',
    'structural-memory','exact-recall'
  ],
  'diseminer': [
    'claims','distributional','evidence','hypothesis','narrative','cooccurrence',
    'observation'
  ],
  'diseminer-lite': ['neighbors','distributional-lite','two-hop-inference'],
  'messy': ['simulation','agent-rules','state-transition','tick-history','probabilistic-system'],
  'language-contact': ['grammar-contact','language-mixing','cross-grammar','adapt-grammar'],
  'autonovel': ['generate-structure','compose-structure','combinator','sequence-generation'],
  'iching-grammar': ['hexagram','trigram','transform-lines','state-transform'],
  'success': ['feedback','outcome-learning','progress','reward','replay'],
  'conversation': ['conversation','utterance','repair-context','explain-result'],
  'research-browser': ['research','sources','claims','hypothesis','experiment','draft'],
  'browser-form': ['browser-form','inspect-form','fill-form','submit-form','consent'],
  'morph-mir': ['artifact-memory','ingest-artifact','remember-artifact','regenerate-artifact','structural-memory','exact-recall'],
});

const STOP = new Set([
  'the','a','an','and','or','to','of','for','with','by','on','in','from','into',
  'tool','automaton','klein','s','plus','via','per','full','state'
]);

function words(value) {
  return String(value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((x) => x && !STOP.has(x));
}
function uniq(values) { return [...new Set(values.filter(Boolean))]; }
function hashText(text) {
  let h = 2166136261 >>> 0;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8,'0');
}
function safeClone(value) {
  try { return structuredClone(value); } catch { return JSON.parse(JSON.stringify(value ?? null)); }
}

function registryTokens(entry) {
  return new Set(uniq([
    entry.id,
    ...(entry.aliases ?? []),
    ...(entry.capabilities ?? []),
    entry.automatonForm,
    entry.dimension,
    ...words(entry.description),
    ...(TOOL_SEEDS[entry.id] ?? []),
  ].flatMap(words)));
}

const REGISTRY_INDEX = new Map(TOOL_REGISTRY.map((entry) => [entry.id, {
  entry,
  tokens: registryTokens(entry),
}]));

function textOf(task) {
  if (typeof task === 'string') return task;
  return task?.content ?? task?.originalContent ?? task?.text ?? task?.name ?? '';
}

function deriveSignals({ phase='general', task=null, normalized=null, decomposition=null, fieldMap=null, context={} }={}) {
  const signals = new Set();
  const kind = normalized?.kind ?? decomposition?.artifact?.kind ?? context.kind ?? null;
  const family = normalized?.format?.family ?? context.family ?? null;
  const text = String(textOf(task ?? normalized?.original ?? normalized) || normalized?.text || '');
  const lower = text.toLowerCase();

  signals.add(`phase:${phase}`);
  if (kind) signals.add(`kind:${kind}`);
  if (family) signals.add(`family:${family}`);

  const foreign = !['javascript','json','text','wasm'].includes(String(kind ?? ''));
  const source = normalized?.format?.family === 'source'
    || ['python','ruby','lua','php','shell','c','cpp','rust','go','java','kotlin','csharp','fsharp','swift','typescript','wat'].includes(String(kind));
  const model = Boolean(normalized?.format?.model)
    || ['onnx','safetensors','gguf','tflite','pytorch'].includes(String(kind));
  const binary = ['native-binary','bytecode','binary'].includes(String(family))
    || ['elf','pe','macho','dex','jvm-class','python-bytecode'].includes(String(kind));

  if (foreign) signals.add('foreign-structure');
  if (source) {
    signals.add('source-grammar');
    signals.add('grammar-induction');
  }
  if (model) {
    signals.add('model-graph');
    signals.add('foreign-lowering');
    signals.add('structural-mapping');
  }
  if (binary) {
    signals.add('foreign-lowering');
    signals.add('structural-mapping');
  }
  if (decomposition?.primitiveCount > 0) signals.add('primitive-decomposition');
  if ((decomposition?.units?.length ?? 0) > 1) signals.add('multi-unit');
  if ((fieldMap?.fields?.dependency?.length ?? 0) > 0) signals.add('dependency-resolution');

  const loweringCandidates = context.loweringCandidates ?? context.candidates ?? [];
  if (Array.isArray(loweringCandidates) && loweringCandidates.length > 1) {
    signals.add('multiple-candidates');
    signals.add('competing-lowerers');
    signals.add('uncertainty');
  }

  if (context.previousError || context.execution?.ok === false || /\b(error|failed|failure|retry|recover)\b/.test(lower)) {
    signals.add('recovery');
    signals.add('uncertainty');
  }
  if (context.learn !== false && (foreign || source || model || context.teach === true || context.learn === true)) {
    signals.add('reusable-rule');
    signals.add('examples');
  }
  if (context.analogy || context.mapping || context.sourceStructure || context.targetStructure) {
    signals.add('analogy');
    signals.add('map-relation');
  }
  if (context.simulation || /\b(simulate|agents?|ticks?|state transition)\b/.test(lower)) signals.add('simulation');
  if (context.grammarA && context.grammarB) signals.add('grammar-contact');
  if (context.variants && Object.keys(context.variants).length > 1) signals.add('multiple-candidates');
  if (context.research || /\b(research|sources?|citations?|hypothesis)\b/.test(lower)) signals.add('research');
  if (context.form || /\b(form|field|submit)\b/.test(lower)) signals.add('browser-form');
  if (context.compose || /\b(compose|generate structure|novel|sequence)\b/.test(lower)) signals.add('generate-structure');
  if (context.claims || /\b(claims?|distributional|co-?occurrence|narrative)\b/.test(lower)) signals.add('distributional');
  if (context.hexagram || context.trigram) signals.add('hexagram');
  const structurallyNovel = foreign || source || model || binary || (decomposition?.units?.length ?? 0) > 1;
  if (
    context.rememberArtifact === true
    || ((phase === 'ingest' || phase === 'compile') && structurallyNovel)
  ) {
    signals.add('ingest-artifact');
    signals.add('artifact-memory');
  }
  if (phase === 'post-execution') {
    signals.add('feedback');
    signals.add('outcome-learning');
  }

  // Direct execution is enough only when there is no learning/mapping/recovery reason
  // to recruit a Klein tool.
  const directAdequate = Boolean(context.directAdequate)
    || (
      ['json','text','wasm','javascript'].includes(String(kind ?? ''))
      && !context.learn
      && !context.previousError
      && !context.analogy
      && !context.mapping
    );

  return Object.freeze({
    phase,
    kind,
    family,
    source,
    model,
    binary,
    directAdequate,
    signals: Object.freeze([...signals].sort()),
  });
}

function scoreTool(entry, situation, context={}) {
  const profile = REGISTRY_INDEX.get(entry.id);
  const tokenSet = profile.tokens;
  const reasons = [];
  let score = 0;

  for (const signal of situation.signals) {
    const raw = signal.includes(':') ? signal.split(':').slice(1).join(':') : signal;
    const parts = words(raw);
    const seedMatch = (TOOL_SEEDS[entry.id] ?? []).includes(raw);
    if (seedMatch) {
      score += 4;
      reasons.push(`seed:${raw}`);
      continue;
    }
    const overlaps = parts.filter((part) => tokenSet.has(part));
    if (overlaps.length) {
      score += 1 + Math.min(2, overlaps.length * 0.5);
      reasons.push(`capability:${raw}`);
    }
  }

  // High-value semantic routing rules. These are seed correspondences, not
  // hard-coded pipelines; outcome learning can later bias them.
  const has=(x)=>situation.signals.includes(x);
  if (entry.id==='autoling' && (has('grammar-induction')||has('reusable-rule')||has('foreign-lowering'))) {
    score += 7; reasons.push('induce-reusable-execution-grammar');
  }
  if (entry.id==='klein-analogy' && (has('structural-mapping')||has('map-relation')||has('foreign-lowering'))) {
    score += 6; reasons.push('map-foreign-structure-to-known-primitives');
  }
  if (entry.id==='historical-monte-carlo' && (has('multiple-candidates')||has('uncertainty')||has('recovery'))) {
    score += 7; reasons.push('compare-competing-execution-hypotheses');
  }
  if (entry.id==='morph-mir' && has('artifact-memory')) {
    score += 5; reasons.push('remember-artifact-structure');
  }
  if (entry.id==='computational-grammar-coder' && has('source-grammar')) {
    score += 4; reasons.push('code-and-disambiguate-source-grammar');
  }
  if (entry.id==='success' && has('outcome-learning')) {
    score += 5; reasons.push('observe-execution-outcome');
  }

  const explicit = new Set(context.preferTools ?? context.preferredTools ?? []);
  if (explicit.has(entry.id)) {
    score += 10;
    reasons.push('context-preference');
  }
  const banned = new Set(context.avoidTools ?? []);
  if (banned.has(entry.id)) {
    score = -Infinity;
    reasons.push('context-avoid');
  }

  return { score, reasons };
}

export class KleinSituationRouter {
  constructor({ engine=null, store=null, threshold=5, maxTools=4 }={}) {
    this.engine = engine;
    this.store = store;
    this.threshold = threshold;
    this.maxTools = maxTools;
    this.history = [];
    this.bias = new Map();
  }

  bindEngine(engine) { this.engine = engine; return this; }
  bindStore(store) { this.store = store; return this; }

  #memoryKey(situation) {
    const basis = [situation.phase, situation.kind, situation.family, ...situation.signals].join('|');
    return `klein-route:${hashText(basis)}`;
  }

  async choose(input={}, context={}) {
    const situation = deriveSignals({ ...input, context: { ...(input.context ?? {}), ...context } });
    const ctx = { ...(input.context ?? {}), ...context };
    const memoryKey = this.#memoryKey(situation);
    const remembered = this.store?.get ? await this.store.get(memoryKey) : null;

    const scored = TOOL_REGISTRY.map((entry) => {
      const base = scoreTool(entry, situation, ctx);
      const learnedBias = this.bias.get(`${situation.kind ?? 'unknown'}:${entry.id}`) ?? 0;
      const rememberedBoost = remembered?.successfulTools?.includes(entry.id) ? 4 : 0;
      return {
        id: entry.id,
        gate: entry.gate,
        channels: [...(entry.channels ?? [])],
        dimension: entry.dimension,
        capabilities: [...(entry.capabilities ?? [])],
        score: Number.isFinite(base.score) ? base.score + learnedBias + rememberedBoost : base.score,
        reasons: [
          ...base.reasons,
          ...(learnedBias ? [`learned-bias:${learnedBias.toFixed(2)}`] : []),
          ...(rememberedBoost ? ['remembered-success'] : []),
        ],
      };
    }).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));

    const meaningful = scored.filter((x)=>Number.isFinite(x.score) && x.score >= this.threshold);
    const directOnly = situation.directAdequate && !ctx.forceKlein && meaningful.every((x)=>x.score < this.threshold + 4);
    const selected = directOnly ? [] : meaningful.slice(0, ctx.maxKleinTools ?? this.maxTools);
    const decision = Object.freeze({
      schema:'synthia.klein-situation-route.v1',
      useKlein:selected.length>0,
      directAdequate:situation.directAdequate,
      situation,
      primary:selected[0] ?? null,
      selected:Object.freeze(selected.map((x)=>Object.freeze(x))),
      considered:Object.freeze(scored.slice(0,8).map((x)=>Object.freeze(x))),
      remembered:Boolean(remembered),
      memoryKey,
    });
    this.history.push(decision);
    return decision;
  }

  async rankCandidates(candidates={}, { seed=7, generations=18, mutationScale=0.08, route=null }={}) {
    const variants = Array.isArray(candidates)
      ? Object.fromEntries(candidates.map((x,i)=>[String(x.id ?? x.name ?? `candidate-${i+1}`), Number(x.score ?? x.weight ?? 1)]))
      : Object.fromEntries(Object.entries(candidates).map(([k,v])=>[k, Number(v?.score ?? v ?? 1)]));
    if (!Object.keys(variants).length) return { dominantVariant:null, finalWeights:{}, tool:null };

    const selectedMonteCarlo = route == null
      ? Object.keys(variants).length > 1
      : Boolean(route?.selected?.some((item)=>item.id==='historical-monte-carlo'));
    const tool=selectedMonteCarlo ? this.engine?.mesh?.get?.('historical-monte-carlo') : null;
    if (tool?.run) {
      const output=tool.run({variants,seed,generations,mutationScale},{source:'klein-situation-router'}).output;
      return {...output,tool:'historical-monte-carlo'};
    }
    // Deterministic no-tool fallback: highest supplied weight, never random.
    const dominantVariant=Object.entries(variants).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??null;
    const total=Object.values(variants).reduce((a,b)=>a+b,0)||1;
    return {
      dominantVariant,
      finalWeights:Object.fromEntries(Object.entries(variants).map(([k,v])=>[k,v/total])),
      tool:null,
    };
  }

  async learnExecutionPattern({
    normalized=null,
    fingerprint=null,
    program=null,
    lowering=null,
    execution=null,
    route=null,
    context={},
  }={}) {
    if (!execution?.ok) return null;
    const kind=normalized?.kind ?? 'unknown';
    const ops=[...new Set((program?.nodes ?? program?.ops ?? []).map((n)=>String(n.op??n.operator??'')).filter(Boolean))];
    const constraints=[
      `kind:${kind}`,
      ...(normalized?.format?.family ? [`family:${normalized.format.family}`] : []),
      ...ops.map((op)=>`op:${op}`),
      ...(route?.situation?.signals ?? []).slice(0,24),
    ];
    const output=`execute ${kind} via ${lowering ?? execution.path ?? execution.result?.engine ?? 'known-runtime'}`;

    let autoling=null;
    const autolingSelected = Boolean(
      route?.selected?.some((item)=>item.id==='autoling')
      || context.forceAutoling === true
    );
    const tool=autolingSelected ? this.engine?.mesh?.get?.('autoling') : null;
    if (tool?.run) {
      try {
        autoling=tool.run({
          operation:'induce',
          examples:[{input:{constraints},output}],
        },{source:'klein-situation-router',kind}).output;
      } catch (error) {
        autoling={ok:false,error:String(error?.message??error)};
      }
    }

    const learned=Object.freeze({
      schema:'synthia.klein-execution-learning.v1',
      kind,
      fingerprint,
      lowering:lowering ?? null,
      path:execution.path ?? null,
      engine:execution.result?.engine ?? null,
      operators:Object.freeze(ops),
      constraints:Object.freeze(constraints),
      autoling:safeClone(autoling),
      learningSequence:this.history.length + 1,
    });

    if (this.store?.put) {
      const key=fingerprint ? `klein-learning:${fingerprint}` : `klein-learning:${hashText(constraints.join('|'))}`;
      await this.store.put(key, learned);
      if (route?.memoryKey) {
        await this.store.put(route.memoryKey, {
          schema:'synthia.klein-route-memory.v1',
          kind,
          successfulTools:(route.selected ?? []).map((x)=>x.id),
          lowering:lowering ?? null,
          operators:ops,
        });
      }
    }

    for (const selected of route?.selected ?? []) {
      const key=`${kind}:${selected.id}`;
      this.bias.set(key, Math.min(6, (this.bias.get(key) ?? 0) + 0.5));
    }
    return learned;
  }

  async observeFailure({ normalized=null, route=null }={}) {
    const kind=normalized?.kind ?? 'unknown';
    for (const selected of route?.selected ?? []) {
      const key=`${kind}:${selected.id}`;
      this.bias.set(key, Math.max(-6, (this.bias.get(key) ?? 0) - 0.25));
    }
    return {kind,adjusted:(route?.selected ?? []).map((x)=>x.id)};
  }

  async audit() {
    return Object.freeze({
      router:'synthia-klein-situation-router',
      toolsAvailable:TOOL_REGISTRY.length,
      threshold:this.threshold,
      maxTools:this.maxTools,
      history:this.history.length,
      learnedBiases:Object.freeze(Object.fromEntries(this.bias)),
    });
  }
}

export { deriveSignals as deriveKleinSituationSignals, TOOL_REGISTRY as KLEIN_TOOL_REGISTRY };
export default KleinSituationRouter;

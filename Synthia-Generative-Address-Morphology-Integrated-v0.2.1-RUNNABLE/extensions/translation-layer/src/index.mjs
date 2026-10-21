// Synthia translation layer — pure-JS FALLBACK runtime for Python / Ruby / Lua / C sources.
//
// Sovereign by construction: no network, no CDN, no WASM, no web workers, no GPU, no native deps,
// no Node-only APIs on the runtime path. Runs offline on Node, browsers and Android WebView.
//
// It plugs into the existing runtime slot (RuntimeAdapterRegistry / UniversalExecutionBridge
// "registered-runtime" step). The slot stays open: any other backend (e.g. a native interpreter,
// a remote runner, a future engine) can be passed as `backends` and gets first refusal; if none
// is present, or one fails, this layer runs the source itself.
import { PythonInterpreter } from './python/interpreter.mjs';
import { stdlibModules } from './python/stdlib.mjs';
import { RubyInterpreter } from './ruby/interpreter.mjs';
import { LuaInterpreter } from './lua/interpreter.mjs';
import { CInterpreter } from './c/interpreter.mjs';
import { sha256Hex } from './sha256.mjs';

export const ADAPTER_ID = 'synthia-translation-layer';
export const LANGUAGE_OF_KIND = Object.freeze({ python: 'python', py: 'python', pyw: 'python', rb: 'ruby', ruby: 'ruby', lua: 'lua', c: 'c', h: 'c' });
export const KINDS = Object.freeze(Object.keys(LANGUAGE_OF_KIND));

const ENGINES = {
  python: () => new PythonInterpreter({ modules: stdlibModules() }),
  ruby: () => new RubyInterpreter(),
  lua: () => new LuaInterpreter(),
  c: () => new CInterpreter(),
};

function sourceText(artifact) {
  if (typeof artifact === 'string') return artifact;
  const c = artifact?.content ?? artifact?.source ?? artifact?.text ?? artifact?.bytes ?? '';
  if (typeof c === 'string') return c;
  if (c instanceof Uint8Array || c instanceof ArrayBuffer) return new TextDecoder().decode(c);
  return String(c);
}
function kindOf(artifact, kind) {
  if (kind && LANGUAGE_OF_KIND[kind]) return kind;
  const name = artifact?.name || artifact?.originalName || '';
  const ext = (name.split('.').pop() || '').toLowerCase();
  return LANGUAGE_OF_KIND[ext] ? ext : kind;
}

/** Run one source through the pure-JS emulator for its language. Never touches the network or host. */
export function runSource(language, source, { context = {}, maxSteps } = {}) {
  const make = ENGINES[language];
  if (!make) return { ok: false, engine: `${ADAPTER_ID}/none`, stdout: [], stderr: [`no translation engine for '${language}'`], unsupported: [{ reason: 'no-engine', source: language }] };
  const engine = make(); if (maxSteps) engine.maxSteps = maxSteps;
  const digest = sha256Hex(source);
  const stages = [{ stage: 'read', bytes: source.length, sha256: digest }];
  let ok = true, error = null;
  try { engine.run(source); stages.push({ stage: 'compose-and-run', steps: engine.steps }); }
  catch (e) { ok = false; error = { type: e.pyType || e.rbClass || e.constructor?.name || 'Error', message: String(e.message || e), line: engine.line ?? null }; if (engine.flush) engine.flush(); }
  if (engine.buf) { engine.stdout.push(engine.buf); engine.buf = ''; }
  return {
    ok, engine: `${ADAPTER_ID}/${language}`, language,
    stdout: [...engine.stdout], stderr: error ? [`${error.type}: ${error.message}`] : [], error,
    exitCode: language === 'c' ? engine.exitCode ?? (ok ? 0 : 1) : ok ? 0 : 1,
    rulesUsed: [...engine.rulesUsed].sort(),
    stages,
    address: { sourceSha256: digest, canonicalAddress: context.canonicalAddress ?? null, targetGate: context.targetGate ?? context.canonicalAddress?.gate ?? null },
  };
}

/**
 * Create the runtime adapter. `backends` are other adapters (same contract) that get first refusal;
 * the pure-JS emulator is the guaranteed fallback.
 */
export function createTranslationLayerAdapter({ backends = [], maxSteps } = {}) {
  return {
    id: ADAPTER_ID,
    kinds: [...KINDS],
    sovereign: true,
    canRun({ artifact, kind }) { return Boolean(LANGUAGE_OF_KIND[kindOf(artifact, kind)]); },
    async execute({ artifact, kind, context = {} }) {
      const k = kindOf(artifact, kind); const language = LANGUAGE_OF_KIND[k];
      const chain = [];
      for (const b of backends) {
        try {
          if (b.kinds?.length && !b.kinds.includes(k) && !b.kinds.includes(language) && !b.kinds.includes('*')) { chain.push({ backend: b.id, skipped: 'kind' }); continue; }
          if (typeof b.canRun === 'function' && !(await b.canRun({ artifact, kind: k, context }))) { chain.push({ backend: b.id, skipped: 'canRun=false' }); continue; }
          const prepared = typeof b.prepare === 'function' ? await b.prepare({ artifact, kind: k, context }) : undefined;
          const r = await b.execute({ artifact, kind: k, context, prepared });
          if (r && r.ok !== false) { chain.push({ backend: b.id, ok: true }); return { ok: true, stdout: [], stderr: [], ...r, engine: r.engine || b.id, fallbackChain: chain, usedFallback: false }; }
          chain.push({ backend: b.id, ok: false, error: r?.stderr?.join?.('\n') || r?.error || 'returned ok:false' });
        } catch (e) { chain.push({ backend: b.id, ok: false, error: String(e?.message || e) }); }
      }
      const result = runSource(language, sourceText(artifact), { context, maxSteps });
      chain.push({ backend: result.engine, ok: result.ok });
      return { ...result, fallbackChain: chain, usedFallback: true };
    },
  };
}

/** Register the layer in a bridge or registry at the END of the adapter list (fallback position). */
export function registerTranslationLayer(target, options = {}) {
  const registry = target?.runtimeAdapters ?? target;
  const adapter = createTranslationLayerAdapter(options);
  registry.register(adapter);
  return adapter;
}

export { PythonInterpreter, RubyInterpreter, LuaInterpreter, CInterpreter, sha256Hex };

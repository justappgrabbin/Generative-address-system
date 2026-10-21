// Pairing: the translation layer as an executable donor for the v0.3.0 resident execution path
// (components/state-math/src/integration/universal-execution-bridge.js + mesh-capability-deriver.js).
// New file only; the 253 MB base is not vendored. Usage with her assembly:
//   const assembly = new ScientificSynthiaAssembly({ autoStart:false, executionMode:'resident' });
//   assembly.registerResidentCapability(createResidentDonor());
//   await assembly.executeArtifact({ name:'t.py', content }, { organismAddress });
import { runSource, LANGUAGE_OF_KIND } from './index.mjs';

/** Donor contract read by MeshCapabilityDeriver: name, gateAddress, provides, canHandle(gap), derive(gap) → {execute}. */
export function createResidentDonor({ name = 'synthia-translation-layer', gateAddress = 1, maxSteps } = {}) {
  const languageFor = (artifact, kindHint) => {
    const ext = String(artifact?.name || '').split('.').pop().toLowerCase();
    return LANGUAGE_OF_KIND[kindHint] ?? LANGUAGE_OF_KIND[ext] ?? null;
  };
  return {
    name, gateAddress,
    provides: ['artifact.realize', 'execute:python', 'execute:ruby', 'execute:lua', 'execute:c'],
    canHandle: (gap) => gap?.requiredCapability === 'artifact.realize' && Boolean(languageFor(gap.artifact ?? {}, gap.kind ?? gap.kindHint) ?? true),
    derive: async () => ({
      execute: async ({ artifact, kindHint }) => {
        const language = languageFor(artifact, kindHint);
        if (!language) return { handled: false, requiredCapability: `execute:${kindHint}` };
        const content = typeof artifact.content === 'string' ? artifact.content : new TextDecoder().decode(artifact.content);
        const r = runSource(language, content, { maxSteps });
        return { handled: r.ok, value: r, trace: [{ donor: name, language, engine: r.engine, rulesUsed: r.rulesUsed }] };
      },
    }),
  };
}

// Backend registry: other backends may plug in first; the pure-JS backend is always last and must finish the job.
export function createReconstructionRegistry(jsBackend) {
  const backends = [];
  return {
    register(backend) { backends.push(backend); return this; },
    list() { return [...backends.map((b) => b.name), jsBackend.name]; },
    async run(op, args) {
      const attempts = [];
      for (const b of backends) { try { if (typeof b[op] !== 'function') { attempts.push({ backend: b.name, error: 'unsupported' }); continue; } const result = await b[op](args); return { backend: b.name, result, attempts }; } catch (e) { attempts.push({ backend: b.name, error: String(e && e.message || e) }); } }
      return { backend: jsBackend.name, result: await jsBackend[op](args), attempts };
    },
  };
}

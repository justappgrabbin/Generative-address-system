# Synthia/Kimi focal-space integration

This package preserves the recovered Kimi implementation and adds a browser-safe integration seam.

```js
import { FocalStateSpace } from './src/integration/focal-state-space.js';
import { LocalStorageRecordStore } from './src/integration/storage.js';

const synthia = new FocalStateSpace({
  store: new LocalStorageRecordStore(),
  semanticResolvers: [existingProjectCanonicalResolver]
});

const { record, view } = await synthia.ingest(artifact);
const result = await synthia.execute(record.identity, 'mirror');
const same = await synthia.replay(record.identity, result.event.sequence);
```

An artifact may provide its already-established `canonicalAddress`, or a registered resolver may return `{address, evidence}`. If neither exists, ingestion throws `UNRESOLVED_CANONICAL_ADDRESS`. It never converts a content hash or keyword guess into a semantic address.

Run `npm run test:focal` for the required ingest → record → focal projections → macro/micro → Kimi transition → persist → reload → replay proof. Run `npm test` for the original 908 checks plus the integration proof.

## v1.3.2 — Klein contact wiring

Added pure-JS contact integration:
- deep loop: CHAT → DISEMINER → Language Contact → Historical Monte Carlo → AUTOLING → Grammar Coder → CHAT
- public/person contact model with a hard privacy cutoff at Base
- compact canonical address code retained as identity; public contact code is `P...DIM...G...L...C...T...B...`
- full internal address remains `P...DIM...G...L...C...T...B...D...M...S...A...Z...H...`

Per request, this package was wired but the test suites were not executed after the v1.3.2 changes.


## v1.3.3 — success-first execution synthesis

- Initial execution is retained as an instrumented probe. Probe failure is evidence, not a verdict.
- `UniversalExecutionBridge` now derives runtime requirements from the artifact + probe result before choosing a fallback.
- Existing `HistoricalMonteCarloAutomaton` searches/ranks reusable execution-rule bundles.
- `AutolingEngine` records the winning composition as a learned rule.
- `ComputationalGrammarCoder` codes the selected runtime rule description before materialization.
- `RuntimeAutoWriter` emits the selected pure-JS runtime and executes it.
- Learned synthesized runtimes are reused on subsequent execution.
- Legacy source reconstruction remains only after runtime synthesis is exhausted.
- Stronger non-JS test: Python import + math + mutable state + list + loop + branch + builtins.
- Heavy execution test performs 1,000,000 foreign-language loop iterations and verifies exact output.


## v1.3.4 — generative mesh bridge

- Added `src/integration/mesh-rule-synthesizer.js`.
- Runtime capability grammar is registered as mesh nodes; `RuntimeRulePlanner` no longer searches a separate `RULES` array.
- Uses canonical `gateBits()` + `hamming()` for topological distance; never integer-mask gate numbers.
- Mesh synthesis consumes probe/analysis/behavioral-contract evidence, extracts callable/AST donors from mesh neighbors, stochastically composes candidates, and requires a real retry probe before promotion.
- Winning verified rules are written back to the mesh as learned capability nodes.
- Parser/analyzer/rewriter donors are organized under `docs/donors/` for the next intake-stage wiring pass.
- Existing second-scan reconstruction remains a last-resort compatibility path; it is not considered proof of mesh-derived synthesis.


## v1.3.6 — Pure-JS Worker/VFS execution chamber

Added `src/integration/paper-runtime-sandbox.js`. This keeps the useful part of the polyglot-worker idea (background Worker + in-memory VFS + message boundary) while removing the external language-runtime brain. There is no Pyodide/CDN runtime and no language-to-runtime switch in the sandbox. Synthia's mesh/state/grammar derives the executable plan; the sandbox only executes the resulting JavaScript or native WebAssembly plan and returns observations to the mesh.

Invariant: foreign artifact -> probe/analyze/address -> mesh-derived semantics -> pure-JS execution plan -> Worker/VFS chamber -> observation/retry.

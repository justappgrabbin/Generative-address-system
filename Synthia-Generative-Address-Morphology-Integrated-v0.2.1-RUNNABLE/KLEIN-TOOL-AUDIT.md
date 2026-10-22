# Klein tools: source and execution audit

## Result

The assembly mounts the existing **16 canonical tools** plus **three source-backed adapters** missing from the canonical registry. All 19 have tool registration, a Klein operator, transport in both directions to the structural organ, a shared-context provider, and an actual-run result observer. Tests execute every tool with meaningful input and inspect its output in shared state.

This is a source/runtime audit of this repository. It does not certify an Android UI, unrestricted semantic understanding, photo understanding, or complete historical fidelity to every Klein publication.

## Drive sources checked

- `klein-tools.mjs`: eight original factories and their memory engines. The current registry's first eight tools correspond to these families: AutoLing, DISEMINER, ATO, I Ching grammar, Language Contact, Historical Monte Carlo, AutoNovel and MESSY. The original file was inspected outside the active tree, not executed with missing dependencies. SHA-256: `415b32db25d3d59b031beebe17967dab5af177f9704d4d88c8cc5fd7fcaaab3e`.
- `klein-iching.mjs`: inspected trigram, house and hexagram operations. SHA-256: `58d2030f5e2afddac16d519c04349318732dcaabb3f3c34578ef9a56475102ca`.
- `klein_outline_paraphraser.pdf`: executable description of reordering one semantic triple set through entity-led, chronological and highlight outlines.
- `klein_control_of_style.pdf`: executable description of weighted production selection and numeric style blending.
- `klein_kuppin_grammar_learner.pdf`: executable description of incremental elimination of candidate transformations and held-out prediction. The document itself labels this a conceptual reconstruction rather than a verified reproduction of the unavailable primary source.
- `shared_cognition.pdf`: read the shared-observation/network and tool orchestration approach. Its persistent Python/SQLite runtime was not replaced or claimed to have been ported by this change.
- `ATO_Source_and_Implementation_Synthesis (1).pdf`, the architecture/nested-state-space notes and integration-failure analysis: used to check explicit context, witnessed execution, shared information, distinction between merely mounted and actually invoked, and the prohibition on fixed inferred field edges. The old failure analysis was treated as a lead and checked against the current implementation.

Private Drive documents and original binary files are not republished here. The additional adapters implement their stated core mechanisms, with the scope differences below.

## Executable coverage

Every row passed a root invocation, result inspection and shared-state receipt check.

| Tool | Functional behavior checked |
| --- | --- |
| autoling-lite | Learn a supplied relation, recognize it, generate an unseen surface from it |
| diseminer-lite | Ingest context and return distributional neighbors with positive measured similarity |
| klein-analogy | Complete an analogy over explicitly named feature sets |
| iching-grammar | Read six binary lines and perform a named transformation |
| language-contact | Actual replacement of a host grammar rule under full contact |
| historical-monte-carlo | Normalized variant trajectories under a controlled zero-mutation case |
| autonovel | Grow a new node and relation using a supplied combinator domain |
| messy | Apply supplied rules across multiple ticks and observe the changed agent state |
| success | Define indicators, record progress and obtain a summary |
| conversation | Render actual supplied contributions |
| browser-form | Inspect a supplied page, draft fields, and preserve the approval requirement before filling |
| research-browser | Create a real research workspace; unknown project references fail |
| computational-grammar-coder | Code words using the existing grammatical tests |
| autoling | Parse a token graph and return stats |
| diseminer | Retain distributional observations and extract a subject/predicate/object claim |
| morph-mir | Ingest, analyze and exactly reconstruct a text/code artifact |
| outline-paraphraser | Different outlines change order while every complete source triple remains represented |
| control-of-style | Different weight tables change selected productions; blends work and invalid blends fail |
| transformation-learner | Eliminate inconsistent supplied hypotheses and correctly transform a held-out input |

The three new adapters are `src/klein-source-tools.mjs`. They use the existing Automaton, Klein and mesh infrastructure. They do not prescribe subject-matter relationships. The paraphraser conservatively preserves active clauses rather than guessing passive inflections; optional connective phrase-bank variation is not implemented. Style rules and realizations are supplied rather than shipping the source's example phrase bank. Transformation candidates are supplied position permutations with the remaining tokens retained, rather than hardcoded English auxiliary hypotheses. These are bounded executable adapters, not claims that all optional behavior of the standalone source builds is present.

## Actual wiring

`Automaton.provideContext` supplies the shared state to a live tool. `Automaton.observeRuns` records its actual completed or failed run. Consequently direct root invocation, engine calls, and tools called by the contact/chat pipeline reach the same shared view; this is not an after-the-fact broadcast claiming to be execution.

`KleinToolState` retains bounded, operation-specific results and a receipt history. AUTOLING syntax, DISEMINER claims, learned AutoLing relations, AutoNovel compositions and paraphraser triples have explicit adapters preserving their original labels and provenance. Other outputs remain available as typed tool results; no semantic edge is invented to make a tool appear connected. Callable values are represented descriptively in the shared JSON view and are not evaluated from serialized text. The observer does not modify the tool's original return value.

Shared results reach `snapshot.toolState` and default structural interactions. The default reference graph is not used to infer relationships. `context.example` explicitly selects the reference JUT/song demonstrations. An updated tool output updates its operation's shared result. The shared view is in-memory with bounded retention; it is not a new disk-persistence implementation.

Klein probes receive the shared context but cannot commit trial tool results. The shared state is included in the witnessed Klein context, so changes cannot remain hidden behind an unchanged context identity. Probe snapshots restore learned state and call counters.

## Using all tools

`GET /api/tools` returns the catalog, each wiring check and the shared state. `POST /api/tools/run` executes a declarative task through root invocation, Klein and training records. `root.runToolTask(steps)` exposes the same path locally. Bindings explicitly translate a prior tool's actual output into a later tool's input:

```js
root.invoke('autoling-lite', { operation: 'learn', rule: {
  id: 'my-relation', relation: 'USER_RELATION',
  pattern: ['$a', 'connects', '$b'], template: '$a connects $b',
} });
const task = root.runToolTask([
  { toolId: 'klein-analogy', input: {
    vocab: ['memory', 'shape', 'blue'], A: ['memory'],
    B: ['memory', 'shape'], C: ['blue'],
  } },
  { toolId: 'autoling-lite', input: {
    operation: 'generate', relation: 'USER_RELATION',
  }, bindings: { args: { step: 0, path: ['result'] } } },
]);
// Actual generated surface: "shape connects blue".
```

This relationship comes from the supplied grammar and features. It is not a predefined field coupling. Bindings to future steps or missing output paths fail. Tasks stop on rejected outputs. All tools are callable; inappropriate operations are not forced on every utterance. Text intake retains its existing recognizer selection. Browser submission continues to require its existing explicit approval/executor flow.

## Repairs and verification

Four additional acceptance-state defects were found: valid success summaries/proposals, browser inspection/drafting, research workspace operations and AUTOLING stats were marked rejected despite returning output. Their public operations now accept at their own resting states. Domain errors and browser approvals remain enforced. The earlier Morph-MIR fix remains included.

`npm run test:all`: root **59/59**, execution spine **29/29**, trainable core **6/6**, morphology **13/13**. The new file contributes **28** tests: functional cases for all 19 tools, complete audit coverage, shared-context delivery, probe isolation, declarative composition, actual generated structures reaching structural interactions, invalid-input/consent checks, counterexample elimination and witnessed shared-context changes.

Live HTTP verification passed: 19-tool catalog/audit; learned rule → ATO completion → generated wording → recognition → structural relationship; unknown tool returns 400. `git diff --check` passes. No graphical UI or external form submission was exercised.

Remaining scope: full source fidelity, durable shared-state restoration, automatic selection of arbitrary new multi-tool tasks, photo recognition/learning and new image/3D synthesis require separate implementation and acceptance criteria. This audit verifies the documented current mechanisms and execution paths.

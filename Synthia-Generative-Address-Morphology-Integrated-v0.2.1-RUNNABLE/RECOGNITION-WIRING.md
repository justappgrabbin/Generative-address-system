# Recognition tools → state space

The root now executes its existing recognition tools at morphology intake and passes their actual outputs to `snapshot.structure.recognition`. Mesh links alone did not previously do this. Every run includes its tool ID, operation, result status, raw output, derivation ID, Klein evaluation ID, root event ID and training record ID.

| Existing tool | Verified role | Scope / limitation |
| --- | --- | --- |
| AUTOLING | Morphology, grammar induction and token graph | Heuristic features and syntax; token adjacency is not proof of a semantic relationship. |
| Computational grammar coder | Word codes and contextual disambiguation | Uses the existing dictionary and grammar heuristics. |
| DISEMINER | Retained distributional observations and extracted subject/predicate/object claims | Claims are heuristic, carry confidence/modality, and are not established facts. |
| Klein analogy / Boolean ATO | Feature-set analogy completion | Requires explicit `vocab`, `A`, `B`, `C` arrays. Does not invent features for unknown meanings. |
| Morph-MIR | Analysis of an existing artifact's blueprint and reusable structure | The mounted implementation analyzes text/code artifacts; this check does not establish visual meaning recognition or photo learning. |

For text intake the root calls AUTOLING pipeline, grammar coding, DISEMINER observation and extraction through the existing root invocation / Klein / training journal path. The tools retain their owned state. Applicable `subject.analogy` input invokes ATO; `subject.artifactId` invokes Morph-MIR analysis. Non-applicable tools are not pretended to have run. Empty input returns `no-applicable-input`. Failed/rejected runs return `incomplete` and explicit issues.

AUTOLING's graph edges and DISEMINER's extracted claims reach `structure.recognition.graph` and, by default, `structure.space.interactions`. They retain their original labels, source and evidence. Grammar codes, morphology results, analogy completions and artifact analysis remain available in the per-tool run outputs. No new cross-field relationship is hardcoded by this adapter.

Reference JUT/song graphs remain explicit examples selected by `context.example`, including the reference inspector's example control. Without that selection, matching source words such as Mind/Ego does not produce a Speed relationship. An explicit example does not overwrite the separate live recognition results. The CPU tensor utility remains an explicitly configured calculation, not a recognizer.

Chat/research intake passes recognition into the same morphology snapshot and conversation/tool mesh context. Outward passes retain intake evidence; generated wording is not automatically re-observed as external evidence. This is not a reconstruction error feedback or photo learning loop.

`wiringAudit().morphology.recognitionTools` checks mounting, tool registry, Klein operators and transport links for all five tools. This checks connectivity; it does not certify semantic accuracy. `lastRecognitionStatus`, the snapshot summary and run receipts expose whether actual recognition executed.

A real issue found by this check: Morph-MIR successfully ingested/analyzed artifacts but reported those operations as rejected because only regeneration was accepting. Its public operations now accept at their own terminal states; actual failures remain errors.

## Reproduce

```js
const result = root.structure({ text: 'Memory shapes structure.' });
const state = result.derivation.output.snapshot.structure;
console.log(state.recognition.runs); // actual tool results and execution receipts
console.log(state.space.interactions); // syntax + extracted "shapes" claim, no invented Speed edge

root.structure({ analogy: {
  vocab: ['memory', 'structure', 'movement'],
  A: ['memory'], B: ['memory', 'structure'], C: ['movement'],
}}); // ATO result: structure + movement
```

`npm run test:all` passes. Nine additional integration tests verify connectivity, output delivery and provenance, changed recognizer output changing the received relationship, failure visibility, actual ATO completion, Morph-MIR acceptance/analysis, explicit-only reference relationships, chat/Klein/outward continuity, and persistent DISEMINER observation. These demonstrate the current tools and wiring work for those cases; unrestricted meaning recognition and visual recognition remain unverified.

The unfinished structural-generation experiment was removed from the active source tree after the user stopped that work. It is not invoked or published by this wiring change.

## Complete tool-set audit

The follow-up [KLEIN-TOOL-AUDIT.md](KLEIN-TOOL-AUDIT.md) expands coverage from the five intake recognizers to all 16 existing tools plus three source-backed adapters found in Drive. Actual runs now contribute to a common bounded shared state, and later tools receive that state as context. `/api/tools` exposes wiring and `/api/tools/run` executes explicit tasks with output-to-input bindings. See the audit for per-tool functional tests, source scope and remaining limitations.

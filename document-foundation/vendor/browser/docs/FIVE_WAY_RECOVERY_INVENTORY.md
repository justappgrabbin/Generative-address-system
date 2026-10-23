# Kimi/Synthia five-way recovery inventory

This inventory records recovered machinery. It does not redefine the dimensional canon. The four graph projections are relational views around a focal object in Space; they are not aliases for Movement, Evolution, Being, or Design.

## Directly callable primitive families

| Status | Family | Exported symbols | Source |
|---|---|---|---|
| existing + wired | Fusion/bundle, Chain/sequence, Perspective/project, Recursion, Mutation/transform, Automatization, Weave/discourse, Mirror/reverse, Shadow/inverse, Rotation/converse, Core/nuclear, Becoming/change | `OPERATORS`, `operatorById` | `src/state-space/operators.js` |
| existing + wired | ignition, flow, weakening, dormancy, reactivation, fusion, chain, mirror, shadow, rotation, core, becoming, perspective, recursion, weave, automatize | `NAMED_TRANSITIONS`, `transitionById` | `src/state-space/transitions.js` |
| existing + wired | Boolean AND/OR/XOR/XNOR/NOT/NAND/NOR and Boolean ATO execution | `BooleanATO` and Boolean operator exports | `src/engine/boolean-ato.js` |
| existing + wired | lawful successor lattice, changing-line paths, pair/inverse/swap/nuclear relations, phase trajectories | successor and predictor exports | `src/state-space/generative-grammar.js` |
| existing | line, bigram, trigram, hexagram, nuclear, pair, punctuation, sound, color, letter, HD and Wen-Wang-Gua primitives | module constant/function exports | `src/state-space/fragments.js`, `letters.js`, `sounds.js`, `colors.js`, `human-design.js`, `wen-wang-gua.js` |
| existing | canonical source claims, conflict quarantine, hypotheses | `CanonRegistry`, `seedFromDimensionCanon`, `CLAIM_STATUS`, canon tables | `src/engine/canon-registry.js`, `src/state-space/claim-status.js`, `dimension-canon.js` |
| existing | parser, token grammar, lawful/generative grammar and sentence production | parser/grammar exports | `src/grammar/*`, `src/state-space/generative-grammar.js`, `src/merged/lawful-grammar.js` |
| existing + wired | deterministic derivation, complexity ledger, exact replay | `Derivation`, `stableStringify`, `ComplexityLedger`, `SynthiaAutomata.replay` | `src/engine/derivation.js`, `ledger.js`, `synthia.js` |
| existing + wired | FSM/automata, typed ports, composition, five projections | `Automaton`, `AutomataMesh`, `PROJECTIONS`, `StatePacket` | `src/automata/automaton.js`, `src/mesh/mesh.js`, `packet.js` |
| existing + wired | 16 registered Kimi tools plus boot-grown media field | `TOOL_REGISTRY`, `createAllTools` | `src/automata/registry.js`; `src/automata/tools/*`; `src/merged/media-field.js` |
| existing | analogy, Fu Xi/King Wen conversion, gate field, channels/centers, mesh memory, artifact production | merged barrel exports | `src/merged/index.js` and sibling modules |
| existing | phase-space engine and scale experiments | engine/experiment exports | `src/engine/v2/phase_space_engine.js`, `src/experiments/scale/*` |
| existing | persistence-capable living loop and owned automaton state | `LivingLoop`, `verifyEpisodeChain`, automaton `exportState/hydrate` | `src/organism/living-loop.js`, tool classes |

## Five-way placement and wiring status

| Mechanism | Recovered implementation | Before this integration | Current status |
|---|---|---|---|
| Space / focal state | Kimi `phase` projection; Emergent `StateSpace`; address state | split across packages | wired as persistent `focalSpacePosition`; semantic equivalence of Kimi `phase` and focal Space remains unresolved |
| Knowledge | `AutomataMesh.projections.knowledge`, semantic triples, canon registry | existing, not artifact-record-bound | wired to focal artifact capabilities, address, and callable machinery |
| Causal | `AutomataMesh.projections.causal`, `CausalTrace`, derivation transforms | existing, not artifact-record-bound | wired to executed before/after transition evidence |
| Temporal | `AutomataMesh.projections.temporal`, ordered derivations/ledger/history | existing | wired to append-only artifact history |
| Dependency | `AutomataMesh.projections.dependency`, typed connections/import relations | existing | wired to declared artifact dependencies |
| Macro traversal | scale experiments, mesh neighbors, channels, upstream/downstream relations | partially wired | wired in canonical record and recomputed on focus |
| Micro traversal | decomposition, bits/lines/fragments, local transitions | partially wired | wired in canonical record and recomputed on focus |
| Canonical addressing | full project spine plus Kimi DMS codec | Kimi intake used a hash candidate and reduced display key | full persistent record wired; missing semantic evidence now fails rather than guessing |
| Persistence/reload | tool hydration, snapshots, living-loop history | disconnected from artifact identity | wired through pluggable local store (`localStorage` in browser; memory in tests) |
| Replay | Kimi deterministic derivations and replay | execution-level only | wired to artifact transition history without artifact re-analysis |

## Known unresolved items (preserved, not invented)

- The Kimi package itself marks automatic DMS assignment as hypothesis `H3` / open question `OQ-2`; therefore the recovered hash-candidate intake is not accepted as a semantic canonical address.
- The package marks the Space discrepancy as `H4` / `OQ-3`; therefore this layer does not silently equate Kimi's `phase` projection, Emergent Space, or any of the established five dimensions.
- Planetary, arc/axis, zodiac, and house semantics require explicit artifact metadata or a registered source-backed resolver. Missing evidence causes `UNRESOLVED_CANONICAL_ADDRESS`.

## Integration exports

- `FocalStateSpace`, `CANONICAL_ADDRESS_FIELDS` — `src/integration/focal-state-space.js`
- `MemoryRecordStore`, `LocalStorageRecordStore` — `src/integration/storage.js`
- End-to-end executable proof — `test/focal-integration.test.mjs`

# Synthia v1.3.5 — Mesh-native execution loop

Invariant: the host runtime is pure JavaScript; the artifact may be non-JavaScript.

1. Execute/probe the original artifact.
2. Treat failure as runtime evidence, not a terminal unsupported result.
3. Parse/analyze behavior, state, dependencies and relationships; resolve canonical address.
4. Express the missing capability as a gap at that focal mesh position.
5. Query active mesh nodes. Topology uses the verified `gateBits()` representation and Hamming distance, not integer gate labels.
6. Monte-Carlo/stochastic candidate construction operates over discovered mesh donors and their executable/AST payloads. No capability switch/case is used by the synthesizer.
7. Compile/compose a candidate in pure JS.
8. Retry the ORIGINAL artifact with the candidate installed/provided.
9. Score execution progress + behavioral match - new failures. Only observed progress can promote a capability.
10. Register successful capability back onto the mesh with provenance, then continue until verified or repair budget is exhausted.

The existing legacy Python grammar/rebuilder remains in `universal-execution-bridge.js` for backwards compatibility in v1.3.5, but it is not part of `ExecutionLoopOrchestrator` and is not used by the new mesh-native path. It should be removed once Paper Prime is switched fully to the orchestrator.

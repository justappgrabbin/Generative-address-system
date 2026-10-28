# Architecture

## One runtime substrate

`src/engine.mjs` owns particles, directed synapses, persistent formations, five interpretive frames, experimental parameters, events, and external action history. `src/worker.mjs` owns the running instance. The DOM and canvas consume its snapshots; neither owns a separate simulated world.

The renderers have no target object and never alter semantic state. Scene surfaces require closed triangles of actual persistent relations. Fine marks are tessellation samples, not invented additional agents. Macro recognition of people/trees/buildings is not implemented.

## Independent kinds of scale

- **Semantic dimensions:** Being, Movement, Design, Evolution, Space.
- **Qualitative structure:** a separate variable-depth forest inside each dimension’s frame. A node can interpret another dimension. Arrangement may be unresolved; siblings need not be a vertical stack.
- **Formation levels:** currently particles, persistent bond subassemblies, and connected formations. These are engineering aggregation levels, not dimensions and not the completed recursive generative grammar.
- **Camera zoom:** a view on the same world. Fine zoom reveals connections and source-qualified expression tracks. It does not generate or prove the semantic relationships shown.

## Learning and persistence

Signed neural weights predict scalar activation using a sparse recurrent network and online delta updates. Nonnegative relational strength measures persistence separately. Encounters reinforce strength; disuse reduces it at a rate affected by retention and use history. Perturbation can weaken both strength and predictive coupling. Dissolution retains identities, members and history.

This constitutes a demonstrable small predictive learner, not a trained language model, general intelligence, a completed emotional model, or autonomous artifact creation.

## Addressing, grammar and evidence

Canonical six-bit hexagrams are distinct from King Wen ordinals. A line flip is recorded with original/resultant configuration, before/after context, direction and unresolved semantic leadership. All six potential slots remain unresolved until a source-grounded realization rule is implemented.

Source keynotes and titles can form provisional readable expressions, such as “I Am Conflict.” They do not impose fixed meanings or behaviors. Being’s inspected ordering is preserved; other per-dimension orders are not inferred. The exact BANTU morphology, structural-leading-primitive rules, and letter-to-direction traversals remain open.

`LocalModelAdapter` accepts an actual in-process local model implementing `ingestComparisons({comparisons, context})`. It requires returned proposal evidence to cite supplied comparison records. Proposals stay untested and are not executed. No model weights or training runtime are bundled.

## Storage and replay

Manual and automatic IndexedDB snapshots use separate keys. Export includes all current weights, retained formations, events, dimensional qualitative structures, source-qualified directional rules and action history. Replay reconstructs from the initial seed and actions at their exact ticks. Determinism excludes wall-clock timestamps.

The current runtime retains full in-memory history; compaction and long-session performance are not yet characterized. Snapshot imports have a 32 MB UI budget. These are resource limits, not limits on semantic address space.

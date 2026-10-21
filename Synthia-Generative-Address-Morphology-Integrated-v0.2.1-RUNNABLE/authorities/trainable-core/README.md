# Pure Synthia Trainable Assembly v0.4.1

This is an additive assembly layer over the verified Pure Synthia organism and Universal Execution Spine. It does **not** replace or truncate either authority.

## Authorities preserved
- `Pure-Synthia-v0.4.0-FINISHED-BASELINE.zip` — organism/swarm/continuity authority.
- `Synthia-Universal-Execution-Spine-v0.4.0.zip` — execution/state-space authority.

## Added live-learning organs
1. Registration layer: immutable native address + mutable current-state address + provenance + sayings + snapshots.
2. Book ingest bridge: source fragments remain verbatim, hashed, provenance-bearing, and addressable; optional adapters call AutoLing/DISEMINER/Monte Carlo.
3. Sentence mesh: composes only registered sayings; it does not rewrite canonical source vocabulary.
4. Scientist loop: question/hypothesis/evidence/experiment/predicted-vs-actual/validation.
5. Training journal: records before state, tool/swarm route, interaction, after state, expression, success/error and route scores.

## Hard rules
- All Synthia instances inherit the complete canonical capability genome.
- Birth/configuration changes expression/routing/weighting, never inheritance.
- Training may learn weights, relations and predictions; it may not overwrite canonical sayings or provenance.
- Native/canonical address is stable. Current-state address is live and changes with state. Interaction events are separately addressable records.

## Test
`npm test`

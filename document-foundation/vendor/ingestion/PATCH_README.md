# Synthia v0.5.1 — Automata Ingestion & Execution Kernel Patch

This overlay is built specifically against `Synthia-v0.5.1-PRE-DNA-WIRING-CHECKPOINT-1.zip`.

## What it does

- makes ingestion a compile → execute → observe → remember cycle
- reduces supported artifacts to canonical primitives
- distributes those primitives across:
  - shared
  - knowledge
  - causal
  - dependency
  - stateSpace
- reuses exact compiled forms on later runs
- adds browser-local JSON/text/self-contained-JS/WASM execution providers
- adds ZIP/JAR/APK container decomposition with expansion limits
- persists browser memory in IndexedDB when available
- observes execution results and creates one deterministic ontological integrity address
- wires the kernel around the existing `ExecutionPipeline`
- exposes the receipt as `executeArtifact(...).automata`

## Apply

Overlay the files in this archive onto the root of the checkpoint project.

No vendor donor file is replaced by this patch.

## Validation

`npm test`

Expected result for this packaged checkpoint:

- tests: 37
- pass: 37
- fail: 0

`npm run verify` also passes.

## Capability boundary

This patch does not pretend that every arbitrary native binary or model can execute without a compatible provider. Unsupported execution requirements are recorded in the dependency field and retained for later resolution.

The existing checkpoint GameGAN adapter remains its existing deterministic local donor/mock-diffusion implementation; this patch does not claim to contain NVIDIA's original trained GameGAN weights.

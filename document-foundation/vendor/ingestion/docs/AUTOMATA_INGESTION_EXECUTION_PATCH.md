# Synthia Automata Ingestion & Execution Kernel Patch

This patch turns ingestion into a compile/observe/remember cycle instead of a filename classifier.

## Live path

`IntegratedSynthiaSystem.executeArtifact()` now automatically:

1. normalizes the artifact,
2. fingerprints exact content,
3. reuses an already-compiled form when the fingerprint is known,
4. reduces supported artifacts to canonical primitives,
5. compiles those primitives into the five execution fields,
6. lets the existing Synthia execution pipeline perform the actual execution,
7. observes the result back into causal + state-space fields,
8. creates one deterministic post-execution ontological address,
9. stores the compiled form, note, address, and execution observation.

The returned execution response now exposes the receipt at `response.automata`.

## The five execution fields

These are intentionally separate from the pre-existing five *state-space levels* (`Movement`, `Evolution`, `Being`, `Design`, `Space`).

The new runtime fields are:

- `shared`
- `knowledge`
- `causal`
- `dependency`
- `stateSpace`

They are execution surfaces, not decorative labels.

## Browser-native kernel

`src/automata/` is browser-safe ESM and does not require Node APIs, a backend, or a Web Worker for its core operation.

Current native execution providers:

- JSON: `JSON.parse`
- text: browser-native text
- self-contained JavaScript: sandboxed iframe with `sandbox=allow-scripts`
- WebAssembly: `WebAssembly.compile/instantiate` when imports are supplied
- additional formats: provider registry

Workers are optional acceleration/scheduling tools, not part of Synthia's identity or required execution model.

## Archive decomposition

ZIP/JAR/APK-shaped ZIP containers are inspected through their central directory.

- stored entries are read directly
- deflate entries are decompressed when `DecompressionStream('deflate-raw')` is available
- archive and inflated-size limits are enforced before expansion
- unsupported or oversized entries remain recorded as dependencies/warnings rather than being silently discarded

## Remembered compiled forms

The exact artifact fingerprint is the cache key. On the next identical artifact:

- primitive decomposition is reused
- five-field compilation is reused
- the execution plan is reused
- execution runs again
- the new result is observed and addressed

In browsers the default store is IndexedDB. In hosts without IndexedDB it falls back to an in-memory store unless another store is injected.

## Ontological addressing

The ontological address is generated after execution observation and binds:

- exact artifact fingerprint
- five field signatures
- behavioral result signature

`integritySignature` is a deterministic content digest. It is deliberately labelled as an integrity signature, not a private-key/personhood signature.

## Existing execution preserved

This patch does not replace the checkpoint's existing:

- execution bridge
- exact-address recall
- registered app runtime
- GameGAN registered adapter
- Klein mesh
- state-space organism
- governance path
- donor authorities

The automata layer wraps the existing execution path with prepare/finalize behavior.

## Important capability boundary

This patch does **not** claim that arbitrary native binaries or arbitrary ML model weights can execute magically in every browser.

The runtime rule is:

1. execute directly when browser-native,
2. lower/translate when a supported provider exists,
3. record unresolved dependencies when it does not,
4. allow a provider to be registered later without losing the compiled understanding.

The checkpoint's existing GameGAN registration continues to use its existing deterministic local donor/mock-diffusion implementation. This patch does not substitute that for NVIDIA's original trained GameGAN model.

## Tests

`test/12-automata-ingestion-execution.test.mjs` verifies:

- JavaScript decomposes into all five execution fields
- no worker/backend is required by the kernel contract
- exact fingerprints reuse compiled forms
- post-execution addressing binds the observed fields
- the existing `executeArtifact()` path emits the automata receipt

The full checkpoint test suite remains green after the patch.

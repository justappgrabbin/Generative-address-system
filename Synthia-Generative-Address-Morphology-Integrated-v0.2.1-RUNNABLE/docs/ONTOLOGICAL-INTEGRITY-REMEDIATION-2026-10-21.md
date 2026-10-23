# Ontological integrity remediation — 2026-10-21

Status: confirmed source audit; fixes pending validation. This document does not claim successful test execution.

## Verified source findings

- `extensions/generative-address-morphology/src/core/address.mjs`: missing line/color/tone/base default to 1; minute/second to 0; house to 1. Range validation accepts noninteger gate/line/color/tone/base/house. Degree and arcAxis have no corresponding structural validation. Caller-supplied id is trusted without consistency checking.
- `extensions/generative-address-morphology/src/projections/multimodal.mjs`: hue, frequency and orientation derive from SHA-256 bytes of graph channelId/energy/id. This is deterministic but not an ontological mapping.
- `extensions/generative-address-morphology/src/engine.mjs`: supplied addresses are normalized, pairwise compiled, projected; this file does not derive addresses from images.
- `src/synthia-generative-assembly.mjs`: activeMorphologyAddresses can be retained between invocations. Validate subject binding and stale context behavior.
- `extensions/morphmir-memory/README.md`: exact binary chunk round-trip is documented; it is not proof of semantic image generation.

## Required non-destructive changes

1. Add a strict opt-in canonical validator before modifying legacy normalization. Reject fractional discrete coordinates, invalid angular bounds, missing provenance and contradictory coordinate combinations. Retain legacy behavior behind explicit compatibility mode until all callers and fixtures are migrated.
2. Add an address provenance record: supplied | derived | unresolved for each coordinate, with source, rule identifier, leading dimension, and version. Do not synthesize missing coordinates.
3. Separate semantic coordinate keys from integrity digests and storage IDs. Verify semantic identity under ID changes.
4. Add versioned multimodal projection functions driven by validated structural features; retain legacy SHA projection as an explicitly experimental comparison fixture, not an ontological generator.
5. Preserve MorphMir byte-exact restoration. Add an independent address-to-image decoder, declare stored residuals, and test with chunks unavailable.
6. Audit Klein, channel rules, graph formation/dissolution, and subject-address lifecycle without rewriting donor authorities.

## Tests required before promotion

- Missing coordinate must remain unresolved or fail strict validation.
- Fractional gate/line/color/tone/base/house must fail strict validation.
- Contradictory zodiac/degree/arcAxis combinations must fail under an explicitly documented coordinate convention.
- Replacing only a storage ID must not change semantic multimodal projection.
- Equivalent addresses produce equivalent semantic projections.
- Distinct inputs must not accidentally share identity due to default-filled coordinates.
- MorphMir exact JPEG/PNG round-trips pass, including chunk corruption detection.
- Generative image test runs without original byte chunks and reports fidelity metrics and encoded residual size.
- All existing tests pass before any migration is merged.

## Gate

Do not merge until implementation patches and independently rerun test results are attached. No original file deletion, no silent fallback, no fabricated semantic values.

# Verification Report — v0.1.0

## Additive engine

PASS:
- 36 unique channel pairs load.
- 3–60 resolves to Mutation.
- 63–4 resolves to Logic.
- 59–6 resolves to Intimacy.
- unrelated gate pair does not create a graph.
- graphs dissolve when their required active addresses disappear.
- graph learning cannot create a nonexistent graph.
- graph ecology computes active energy coverage/dominance.
- local HTTP server starts and dashboard returns HTTP 200.
- `/api/channels` returns all 36 entries.

## Intact Cynthia bridge

PASS:
- recovered r21.21 `core/SynthiaUnit.mjs` imports without source modification.
- Synthia initializes.
- additive engine registers on Cynthia's existing MCP bus as `thing:address-morphology-engine`.
- MCP message reaches the engine and returns a valid status response.
- additive process registers through Cynthia's existing process-fabric API.

## Recovery limitation, preserved rather than patched

The r21.21 recovered ZIP's `package.json` declares many `tests/*.mjs` scripts, but the recovered archive does not contain its `tests/` directory. Therefore its own `npm run smoke` cannot execute from this recovery artifact. No Cynthia source or package metadata was changed to hide or repair that condition.

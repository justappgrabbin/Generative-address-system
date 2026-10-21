# Verification v0.2.0

## Preservation checks

- `authorities/` compared against the extracted Pure-Synthia-Integrated-Assembly-v0.4.2 source: **identical**.
- original `src/unified-synthia-assembly.mjs`: **identical**.
- original `tests/root-wiring.test.mjs`: **identical**.

## Existing tests

The original v0.4.2 suite remains passing:

- original root tests: 5/5
- execution-spine tests: 29/29
- trainable-core tests: 6/6

**Original total: 40/40.**

## New integration tests

5/5 passing:

1. morphology mounts as a live mesh organ without replacing existing organs;
2. chat reads inward through graph ecology and writes outward through morphology;
3. research-browser uses the same morphology field;
4. graphs dissolve when connection conditions fail;
5. browser/form receives the same morphology field while retaining consent gates.

The embedded morphology engine's own tests also pass 5/5, including all 36 unique channel pairs, non-channel refusal, graph dissolution, dominant-energy ecology and the rule that learning cannot create a nonexistent graph.

## Server smoke test

`npm run start:generative` successfully starts the integrated local server and `/api/audit` reports `ok: true` with:

- morphology mounted;
- Klein wrapper present;
- chat morphology transport path live;
- research morphology path live;
- browser morphology path live;
- no missing Klein operators.

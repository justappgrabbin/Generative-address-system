# Verification — 22 October 2026

- `npm test`: 15/15 integration tests pass, including strict coordinates, independent-level transitions, synchronous message effects, held-out numerical transfer, nested composition, field replay, dictionary policy and photo corruption detection.
- `npm run test:spine`: 24/24 pass.
- `npm run test:browser`: preserved donor suites pass; detailed counts/output in `document-browser-donor-tests.txt`.
- Existing repository application: 11/11 tests pass, output in `existing-application-tests.txt`.
- `npm run demo:field`: actual component training reduces the synthetic task loss from about 0.319 to 0.0135 over 30 updates; exact state replay passes. This does not measure language understanding.
- Offline build: 118 source modules bundled; linked under Node and executes expression result 42.
- Chromium UI: field command submitted, learning persisted in IndexedDB across refresh; actual 96×96 PNG uploaded/recovered/opened before and after refresh; chat submitted and restored visibly; mobile width has no overflow; no page errors or external service requests.
- Managed Chromium blocks `file:` navigation. UI verification therefore uses the bundled HTML over localhost static HTTP; direct file navigation on a user device remains unverified. No inference backend is involved.

Original archive integration baseline was also reproduced before edits (6/6). Source-preservation comparison is recorded in `provenance/RUNTIME-INTEGRITY.json`.

No sparse/dense resource-saving benchmark, historical Klein-algorithm equivalence, full semantic-address calculation, Bantu language validation, nine-center derivation, semantic image reconstruction, new-photo generation, or device voice verification is claimed.

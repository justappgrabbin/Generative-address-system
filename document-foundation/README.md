# Synthia document foundation 0.2.0

A JavaScript runtime descendant of the foundation archive supplied by Alexis, built against **Synthia: Architecture and Nested State-Space Neural Field (2026-10-10)**. The previous repository application remains intact. No external language model or GPU is used here.

Open `Synthia-Foundation-Offline.html`. It embeds the runtime modules. If your browser blocks local-file modules, serve this directory with any static-file server and open the same HTML. The server serves bytes only; computation and IndexedDB persistence run in the browser. Python is an optional existing build/static-serving utility, not a runtime dependency.

The existing chat, file ingestion and tool selector remain. **Operational state space** accepts JSON commands and shows real results. **Photo recovery** stores an original image file, verifies its recovered bytes, and opens the recovered image. Refresh restores landed commands, parameters and photos. Export contains the full private input journal; keep it private.

## Working paths

- Typed addresses: degree 0–29, minute/second 0–59, arcFraction 0–99. Errors retain coordinate, origin and calculation evidence. `arcFraction` is separate from unresolved `axis` semantics.
- Lazy components, sparse budgets, independently checked binary transitions, observed coactivity, typed messages affecting computations, real tiny-MLP parameter updates and explicit local transfer.
- Micro outputs, engineering meso aggregation and derived Space. Five × 64 slot views without a fifth peer model or invented nine-center assignment.
- Ordered composition with retained constituents. Composites become constituents without materializing the whole possibility space. Scale-specific address derivation remains open.
- Actual Klein contact evidence enters investigation records. Missing sensors remain unknown. Unknown/unoccupied candidates trigger investigation rather than invented addresses.
- A dictionary adapter stores explicit sourced definitions; narrative persuasion is unavailable. Historical 1966 algorithm fidelity and full dimension-conditioned routing remain unverified.
- Exact photo-file recovery, corruption detection, browser preview and refresh persistence through the existing MorphMir chunk memory.

## Try a field command

Paste this array into the Operational state space panel. These are **synthetic numerical test coordinates**, not learned meanings or a calculated birth chart:

```json
[
  {"operation":"register","payload":{"address":{"planetary":1,"dimension":"Movement","gate":1,"line":1,"color":1,"tone":1,"base":1,"degree":0,"minute":0,"second":0,"arcFraction":0,"zodiac":1,"house":1},"provenance":{"source":"explicit-test-coordinate"}}},
  {"operation":"run","payload":{"candidates":[{"planetary":1,"dimension":"Movement","gate":1,"line":1,"color":1,"tone":1,"base":1,"degree":0,"minute":0,"second":0,"arcFraction":0,"zodiac":1,"house":1}],"input":[0.7,0.2],"feedback":0.8,"provenance":{"source":"numerical-observation"}}}
]
```

Repeat only `run` to train the same component; occupied registration fails. Features and feedback must be explicit numbers. No text hashing places these components. Automatic meaning-to-address selection still needs its source-derived rules.

Other commands: `observe`, `installRule`, `compose`, `transfer`, `view`, `dictionary`. Transition rules require `{version, source, encodings}` with explicit binary encodings per changed field. Missing maps are investigated. King Wen chapter numbers are never implicitly treated as binary codes. Dictionary payloads accept `{operation:"extract",entries:[{term,definition,source}]}` or `{operation:"query",term}`.

## Verification

```sh
npm test
npm run test:spine
npm run test:browser
npm run demo:field
npm run build:offline
npm run test:offline
```

Browser QA: install Playwright separately, then `node scripts/browser-qa.mjs`; optionally set `CHROMIUM_PATH`, `PLAYWRIGHT_MODULE`, and `FOUNDATION_URL` for a static server. Evidence is in `evidence/document-*`. Managed Chromium blocks `file:` navigation here, so browser QA uses the bundled HTML over local static HTTP. The offline module graph also executes under Node.

## Remaining work

The full document is **not completed** by this increment. Birth-to-address calculation, contextual DMSA/Color/Tone/Base assignment, mesh-frequency center emergence, arc-derived color/sound, Base sharing, language-specific Bantu rules and the four Model Maker placements remain unresolved. Existing legacy chat/ingestion placement remains labeled computational bookkeeping; it is not promoted to semantic derivation.

Photo recovery rebuilds stored bytes. It does not yet reconstruct images from semantic primitives, perform identity-preserving Morph, or create new photographs. Video synthesis, device voice verification and full language understanding are not established by these tests.

See `CAPABILITIES.md`, `CHANGELOG.md` and `provenance/DOCUMENT-BUILD.json`. Original source README/manifest are retained under `provenance` for comparison, not as current capability claims.

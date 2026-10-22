# Synthia document foundation 0.4.0

A JavaScript runtime descendant of the foundation archive supplied by Alexis, built against **Synthia: Architecture and Nested State-Space Neural Field (2026-10-10)**. The previous repository application remains intact. No external language model or GPU is used here.

Open `Synthia-Foundation-Offline.html`. It embeds the runtime modules. If your browser blocks local-file modules, serve this directory with any static-file server and open the same HTML. The server serves bytes only; computation and IndexedDB persistence run in the browser. Python is an optional existing build/static-serving utility, not a runtime dependency.

The existing chat, file ingestion and tool selector remain. **Operational state space** accepts JSON commands and shows real results. **Photo recovery** stores an original image file, verifies its recovered bytes, and opens the recovered image. Refresh restores landed commands, parameters and photos. Export contains the full private input journal; keep it private.

## Contextual field meaning and tools (0.4)

The field owns sourced representations, their lexical expressions, learned construction programs and contextual teaching. `attachRepresentation` and `teachMeaning` are journaled field operations; `resolveMeaning` reads them with an optional `dominatingStructure`. Teach the same expression in different structures without overwriting those different uses. Omit necessary context and ambiguity remains visible.

`{operation:"tool",payload:{tool,source,input,address,meaning}}` runs any mounted tool through the same journal and shared mesh. `address` is optional for unplaced computational work and must be complete when provided. Donor tool gate assignments do not become semantic coordinates. For semantic work, `meaning` specifies `terms`, optional `dominatingStructure`, a `source` and `version` for its adapter, and `bindings`. Each binding selects an actual field-owned value, for example `{A:{operand:0,path:["representation","features"]}}`. Those values replace the corresponding native tool inputs before execution. The receipt records the selected states, teaching sources, adapter and trace. Missing or ambiguous meaning stops the semantic call before the tool runs. This is a sourced input adapter, not automatic discovery of all tool contracts.

The mounted set contains 16 tools including lightweight variants: autoling-lite, diseminer-lite, klein-analogy, iching-grammar, language-contact, historical-monte-carlo, autonovel, messy, success, conversation, browser-form, research-browser, computational-grammar-coder, autoling, diseminer and morph-mir. Tests exercise a valid contract for each, preserve tool output in field observations, and verify restart replay. This does not establish every advertised behavior or fidelity to the original historical algorithms. The dictionary adapter advertises its actual storage/query contract rather than the donor narrative capabilities.

For images, bind the observed constituents to sourced addresses, teach labels, demonstrate a composition, then use **Learn this construction** and **Construct from states**. Optional **Context** selects a previously defined dominating structure for teaching and construction. The state space resolves the terms and supplies its retained representations and learned layout to the renderer. The same expression can produce different images in different sourced contexts. A generated whole can become a constituent at the next scale. Construction does not require an existing output image or the source-image cache.

The runtime is local JavaScript with no mandatory GPU or paid image service. Tests establish exact decoded-pixel reconstruction and bounded contextual construction, not arbitrary photorealistic scene invention or universal semantic understanding. Acceleration is optional; no product setting disables it.

## Working paths

- Typed addresses: degree 0–29, minute/second 0–59, arcFraction 0–99. Errors retain coordinate, origin and calculation evidence. `arcFraction` is separate from the documented Design/Axis structural role.
- Lazy components, sparse budgets, independently checked binary transitions, observed coactivity, typed messages affecting computations, real tiny-MLP parameter updates and explicit local transfer.
- Micro outputs, engineering meso aggregation and derived Space. Five × 64 slot views without a fifth peer model or invented nine-center assignment.
- Ordered composition with retained constituents. Composites become constituents without materializing the whole possibility space. Scale-specific address derivation remains open.
- Actual Klein contact evidence enters investigation records. Missing sensors remain unknown. Unknown/unoccupied candidates trigger investigation rather than invented addresses.
- A dictionary adapter stores explicit sourced definitions; narrative persuasion is unavailable. Historical 1966 algorithm fidelity and full dimension-conditioned routing remain unverified.
- Exact photo-file recovery, corruption detection, browser preview and refresh persistence through the existing MorphMir chunk memory.
- Measured image parts, pixel-exact reconstruction at analysis resolution, reusable compositions, user-taught visual examples and corrections, and optional explicitly sourced field bindings. See the image workflow below.

## Image workflow

1. Upload photos under **Photo recovery**, then select **Analyze and reconstruct pixels**. The browser decodes them locally. Analysis defaults to a maximum side of 512 pixels; select 1024 if needed. Resampling is recorded; the original file is retained separately. Animated inputs provide a decoded still frame, not reconstructed animation.
2. **Reconstruct image** rebuilds the decoded RGBA from retained solid/raster/split primitives, without reading the original encoded file. Its pixel hash is verified. The inspector shows measurements, lineage and the first 64 parts. Saved BMP previews composite transparency over white; the stored RGBA structure retains exact alpha.
3. Teach a label to an example. Other images receive similarity candidates based on measured visual features and the latest sourced teaching. Corrections change future candidate labels while retaining earlier feedback. This is a bounded appearance-based learner, not general object/scene recognition.
4. Choose left/right source images and **Create composition**. The new image is rendered from retained parts with explicit placement and scaling. Download the saved, hash-verified artifact with **Save image**. Encoded outputs are stored separately in IndexedDB; recipes and outputs recover identically after refresh. Replay checks existing output hashes instead of silently replacing a landed artifact.

Advanced recipes use `{operation:"image:compose",payload:{recipe:{width,height,background:[r,g,b,a],source,parts:[{imageId,x,y,width,height,crop,quarterTurns,flipX,flipY}]}}}` in the operational command panel. Optional fields may be omitted; crop and placement bounds are checked. Rotations, flips, cropping, nearest-neighbor scaling and source-over composition are geometry operations, not dimensional meaning assignments.

To connect visual measurements to an ontological coordinate, use `{operation:"image:bind",payload:{imageId,address,provenance:{source}}}`. Supply the full address explicitly. Later visual contacts select among these bindings by measured similarity and execute actual field components using mean brightness and local pixel difference as the two documented inputs. This selection is an engineering hypothesis, not a derived birth/design rule. No canonical address is invented from pixels or a filename hash. `{operation:"image:teach",payload:{imageId,label,source,outcome:0.7}}` optionally supplies an explicit numerical training outcome; teaching a label alone updates the visual example memory.

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

Photo recovery rebuilds stored file bytes; the newer image grammar separately rebuilds decoded pixels and creates source-part compositions. It does not yet construct arbitrary requested scenes from learned semantic primitives or demonstrate universal identity-preserving Morph. Video synthesis, device voice verification and full language understanding are not established by these tests.

See `CAPABILITIES.md`, `CHANGELOG.md` and `provenance/DOCUMENT-BUILD.json`. Original source README/manifest are retained under `provenance` for comparison, not as current capability claims.

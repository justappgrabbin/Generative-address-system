# Klein visual grammar (additive, pure JS, offline)

Alexis's Klein tools reading an image directly from visual primitives — no words in between.

- **Her tools, unchanged:** `vendor/kmge_v5_fixed/` is the Klein Mesh Game Engine v5.1 copied byte-for-byte (source zip `k.zip` sha256 `03c95016…150fb1`; per-file sha256 in `PROVENANCE.sha256`, checked by a test). Used: `CompGramCoder`, `SensoryInputAdapter.sightFromVisualData`, `DiseMinerEngine.ingestObservation`, `AutolingGrammar` (imported from `dist/klein-mesh-game-engine.js` and `dist/sensory-adapter.js`; `dist/index.js` runs her demo pipeline on import, so it is not used).
- **Adapter (`src/`)**: reads genrec's addressed DCT layers per 8×8 block (DC brightness/colour, edge direction+strength, texture energy per layer band, position), segments into 4 region classes, derives relations (adjacent, contains, brighter_than, mirror_symmetric), and row-scan token sequences.
- **Transform:** grammar-level rewrite `R3.* -> R3'.*` (chroma DC rotated 120°) on genrec coefficients, rebuilt by genrec `synthesize`. Every block outside the class is byte-identical (test).

## What each Klein tool did (verified)
- **CompGramCoder:** accepts the tokens, but its function-element lexicon is a fixed private game-word map (`player`, `move`…), so every visual token is `MISC` and no useful triads form. Minimal fix (alongside, *investigating*): a subclass/wrapper that supplies a visual lexicon — what visual primitive maps to which code is Alexis's to define.
- **SensoryInputAdapter → DiseMinerEngine:** her intended path; accepted regions + relations, built stems, links and transitive reachability. Limit: `ingestObservation` stores every relation as a plain `from→to` link, so the predicate (adjacent vs brighter_than) is only kept as a separate stem, not on the link. The adapter keeps the full relation list alongside.
- **AutolingGrammar:** learned one sentence rule (H1) per distinct image row (37 rules, 37 rows) and can parse a learned row. `learnFromSequence` only calls heuristic 1, so it memorizes rows rather than generalizing (H2/H4 exist but aren't triggered by her code).

## Limits / investigating
- Region classes are k-means on colour/brightness (k=4); token bins (flat/grain/rough, edge thresholds) are measurement bins, not meanings.
- Recolor at DC only gives visible 8×8 block edges at region borders.
- Mapping of these primitives to her address (gate/line/color/tone/base) and to the 13 per-gate layers: investigating, hers to define.

## ATO — Appositional Transformation Operators (Klein et al. ~1981, "Revolt in Flatland")
- `src/ato.mjs` implements the paper's definitions over bit arrays: `*ab` = XNOR (3-valued `-` = does not apply), analogy `?=*Z(*XY)`, complex analogy, ATO tree ("patterns behind patterns"), replanning `*A(*DE)…`.
- It is the same operator as Alexis's `klein-iching-ato-mesh.ts` `ato()` (vendored byte-exact in `vendor/klein-final-engines/`, sha256 in `PROVENANCE-ato.sha256`); a test runs her function and checks all 64×64 6-bit pairs agree. Hers works on integers ≤31 bits, so the array form is added alongside.
- KMGE's `AtoEngine` is a different "ATO" (Fayyaz 2022 episodic memory), so it was not used here.
- Paper examples reproduce exactly: `10101010:01010110::01100101:? = 10011001`, `10010101:01011010::10100110:? = 01101001`.
- Visual: each region gets an 8-bit feature state (Y 3 bits, Cb>0, Cr>0, texture 2 bits, vertical-edge). `R0:R1::R2:?` gave a new state, rendered onto R2's blocks via genrec (others byte-identical). Bit layout is a measurement choice — *investigating*, Alexis's to define.
- Frames: 24 moving-photo frames as 2D bright/dark bit-planes → level-1 ATOs and level-2 ATO-of-ATOs in `fixtures/out/ato-report.json`.

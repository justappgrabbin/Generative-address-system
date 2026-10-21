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

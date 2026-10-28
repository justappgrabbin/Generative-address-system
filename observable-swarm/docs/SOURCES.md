# Sources and implementation boundaries

## Existing Synthia code

Imported from `justappgrabbin/Generative-address-system`, commit `ce1704d5d53d5729b499463f7eeaf5dcd5091550`, under `Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE/`.

| Local module | Upstream source |
| --- | --- |
| `vendor/ato.mjs` | `extensions/klein-visual-grammar/src/ato.mjs` |
| `vendor/gate-table.mjs` | `extensions/klein-visual-grammar/data/real_gate_table.json` (wrapped as an ES module) |
| `vendor/channels.mjs` | `extensions/generative-address-morphology/config/channels.json` (wrapped as an ES module) |
| `vendor/structural-space.mjs` | `extensions/generative-address-morphology/src/core/structural-space.mjs` (relative chain import adapted) |
| `vendor/klein.js` | `authorities/execution-spine/src/pure-synthia/engine/klein.js` |
| `vendor/chains.js`, `dimension-canon.js`, `claim-status.js`, `constants.js`, `dimensions.js`, `primitive-dimensions.js`, `features.js`, `letters.js`, `fragments.js`, `sounds.js`, `addressing.js`, `colors.js`, `transitions.js` | Corresponding upstream `authorities/execution-spine/src/pure-synthia/state-space/` modules |
| `vendor/canon-registry.js` | Upstream `authorities/execution-spine/src/pure-synthia/engine/canon-registry.js` (relative imports adapted) |
| `vendor/controls.js` | Upstream `authorities/execution-spine/src/pure-synthia/experiments/scale/controls.js` (relative import adapted) |

Upstream comments and provenance are preserved. Vendored modules include historical experimental choices. Importing a module does not validate every claim in it. The new runtime does not use the older angle converter to assign meaning, houses, or dimensional order. No new license is assigned to upstream code or source-book text.

## Black Book

Ra Uru Hu, *The Human Design System* (1991/1992), supplied by the user. Relevant material: crystals/monopole, macrocosmic and microcosmic chains, five dimensions, and Gate 16’s full/partial dimensional participation example.

The upstream transcription uses source IDs BB-p126 through BB-p130; the supplied PDF’s printed numbering includes the corresponding material around pp. 115–120 and introductory pp. 4–6. These identifiers are retained, not silently renumbered. OCR and pagination require visual cross-checking before declaring the complete vocabulary verified.

The hexagram titles in `src/morphology.mjs` are a readable normalization of the supplied Black Book’s 64-title list; the short raw OCR list is retained in `docs/corpus/black-book-hexagrams-ocr.txt`. Full changing-line vocabulary has not been extracted. Keynotes with multiple source attestations remain separate in `vendor/chains.js`.

## Semantic spacetime

Mark Burgess, *Spacetimes with Semantics* I–III: autonomous agents and promises; scaling, super-agents and tenancy; functional knowledge, context, memory and semantic addressing.

These guide the distinction between identity and location, typed directed relations, aggregation retaining constituents, contextual retrieval, and histories. This prototype is not a complete implementation of Promise Theory or a proof that its numerical learning formulas follow from Burgess.

Burgess, *Consolidate code from Semantic Spacetime Model* (2023 research notes), informs selective materialization and the need for coarse-graining. Current history is fully retained, and long-duration growth still needs a compaction/indexing strategy that preserves provenance.

## Klein and Zhouyi

Sheldon Klein’s analogical/appositional transformation work supplies strong equivalence/XNOR and the implemented analogy operation `Z XNOR (X XNOR Y)`. Bitwise analogy is exact; interpreting its output as a semantic conclusion requires contextual testing.

Richard Rutt, *Zhouyi: The Book of Changes*, is the user’s intended Zhouyi reference. The Hatcher excerpts supplied during the discussion separately describe original/resultant configurations and directed changing-line interpolation. These sources are not interchangeable, and Rutt’s detailed transition interpretations have not yet been encoded here.

## User-defined requirements and open rules

- One substrate; five dimensions with independently nested qualitative structures, not five layers.
- Event-resolved leading dimension, distinct from the participating address frame.
- Six potential expressions and two potentially trajectory-changing expressions; exact selection remains unresolved.
- BANTU representations, case/leading-primitive sensitivity, morphology and contextual reading order; a leading primitive can be more general than typographic capitalization. The current direction adapter handles the literal-capital case only.
- Paragraphs, verses, songs and other forms can emerge as compositions. None is selected automatically by cluster size.
- Continuous motion and dodecahedral totality. The dodecahedron is an explicit geometric reference, not a derivation of semantic dimensions or dimensional traversals.
- The source architectural documents contain vertical/horizontal/diagonal descriptions and multiple historical drafts. Exact letter paths and orientation transforms have not been resolved from those descriptions. They are not replaced by a universal axis lookup.

## Experimental engineering choices

Spatial proximity and six-bit similarity create candidate synapses; registered HD channel evidence is attached separately. Delta-rule prediction, retention, force response, spring-like projection motion, pigment, surface tessellation, and camera projection are explicitly experimental. They do not establish an inherent equivalence between a hexagram and a color, sound, glyph orientation, biological structure, or physical law.

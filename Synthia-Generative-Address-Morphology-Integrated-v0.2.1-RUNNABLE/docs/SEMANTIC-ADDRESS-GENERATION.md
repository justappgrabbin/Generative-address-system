# Semantic address generation

The active Morph path now implements:

`subject → AUTOLING morphology + named meaning features → cosine-ranked gate/line/dimension prototypes → validated candidate addresses → registry → channel graph`

Generation runs when no explicit addresses are supplied. Explicit addresses, including addresses set through `/api/addresses`, retain precedence; clear them with `setMorphologyAddresses([])` or `POST /api/addresses` with `{"addresses":[]}` to resume automatic generation. Generated addresses are not pinned as inputs for the next subject. The outward pass retains the inward addresses so it cannot erase a generated field merely because the response uses different wording.

## Try from an empty registry

Start `npm run start:generative`, then send:

```sh
curl http://127.0.0.1:8787/api/morphology \
  -H 'Content-Type: application/json' \
  -d '{"subject":{"text":"Innovation ordering limitation acceptance"}}'
```

`derivation.output.snapshot.generation` reports the generation result. The example includes gates 3 and 60, allowing their existing channel rule to form a graph. `POST /api/chat` with the same text in `message` and `mode: "morph"` uses the same generator.

## What is measured

- The model normalizes Unicode and token boundaries and uses vocabulary-constrained English inflection rules. AUTOLING supplies each token's Boolean morphological analysis.
- Named meaning-feature counts represent the subject. Gate prototypes use the existing `GATES` names/themes, line prototypes use the existing line names/keynotes, and dimension prototypes use `CANON_DIMENSION_CHAINS`.
- Cosine similarity is `dot(a,b) / (norm(a) * norm(b))`; zero vectors score zero. Candidates below 0.1 similarity are omitted, with at most four returned by default. Scores are similarity measures, not calibrated probabilities.
- Generation constructs and validates addresses before registry insertion. Different semantic vectors have different identities even if their conventional coordinates coincide. Registry membership is never a prerequisite for generation.
- Generic morphology uses endpoint semantic cosine similarity, coherence, amplitude and phase. For manually addressed states without semantic vectors it uses normalized coordinate distance. Its equations remain experimental; changing channel labels cannot change the numerical behavior.

Each address carries `semantic.vector`, the model schema, similarity, matched prototype features, token analyses, unknown terms and derivation/default policies. SHA-256 is used only for stable IDs after the meaning and coordinates have been determined.

## Teach meanings without pre-creating addresses

```js
import Engine from '../extensions/generative-address-morphology/src/engine.mjs';

const engine = new Engine({ weightsFile: null });
engine.generator.model.teach('zorbax', {
  'meaning:innovation': 1,
  'meaning:limitation': 1,
});
const state = engine.run([], { subject: { text: 'zorbax' } });
```

Teaching accepts existing named meaning axes with finite nonnegative weights. This provides an inspectable small model-building API. It is in-memory; no durable trained-model storage is claimed. It does not assign random coordinates to unknown tokens. `model.features(text)` exposes vectors for inspection, and `subject.features` accepts an explicit feature vector for non-text callers.

## Boolean ATO generation

```js
const result = engine.generate({ analogy: {
  a: { 'meaning:innovation': 1 },
  b: { 'meaning:innovation': 1, 'meaning:limitation': 1 },
  c: { 'meaning:acceptance': 1 },
  mode: 'xor',
} });
```

The existing `completeAnalogy` function operates on Boolean vectors over the union of named feature axes. Here the result has `acceptance` and `limitation`, and can create a new address matching gate 60. The relation and result vectors are recorded in the derivation. This is feature algebra, not Boolean operations on hash bits. String analogy operands are also accepted when their meanings are supported by the model.

Klein witness probes use isolated generator/model state and cannot register candidates in the live registry. Existing channel-pair rules still decide whether generated addresses can form connections; generation does not invent a missing channel partner.

## Limits and defaults

The model is a lexical semantic prototype baseline with a small English morphology layer, not general language understanding. A novel combination of supported meanings can generate immediately. An entirely unknown meaning requires teaching or a supplied feature representation. Negation, roles and syntax do not yet constitute a full compositional semantic parser. Source gate and dimension descriptions are treated as project vocabulary, not empirical proof of their interpretations.

Unmatched dimension defaults to Design. Planetary defaults to the symbolic `semantic` namespace; color/tone/base/house default to 1, and line defaults to 1 if there is no matching line evidence. Degree, zodiac and arc-axis remain unspecified. These choices are recorded and are not astronomical measurements or source-supported fine-coordinate laws. Explicit caller addresses remain available for authoritative coordinates.

Run `npm run test:all` for root, authority and morphology checks, including empty-registry generation, morphology variants, new semantic identities, unsupported inputs, concept teaching, ATO completion, label-independent measurements and probe isolation.

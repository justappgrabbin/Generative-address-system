# Perspective-dependent structural state space

This implements a first executable structural layer from the author's supplied diagrams and M/E/B/I formalization. It is a symbolic software model of that interpretation; it does not establish the physical claims of the source literature.

## State and relationships

Write the contributing state as `X = (M, E, B, I)`: Mind/Evolution, Ego/Design, Body/Being, Individuality/Movement. The full reported state is `S = (X, P)`, with `P = Φ(X, active relationships, observer context)`. P/Space is a derived condition, never a fifth independent input.

When explicitly selected using `context.example`, the reference graph contains Speed (M–E), Material (M–B), Force (B–I), Position (E–I), and the M–I / E–B diagonals. Each relationship can be opened or closed; contributing fields can be filtered. The supplied song chart is a separate labeled example. Its center reports Song/Music/Rhythm only when its full example graph is active.

Six source views preserve all five fields and their source ordering: motivation, movement, evolution, being/phase space, design, space. `frame` is separate from `view`: a starting question, governing field, individual, environment, explicit field roles and ordering belong to the observer. There is no universal question-to-field mapping. Choosing a starting question alone does not invent the remaining perspective transformation.

Color/Tone/Base meanings currently come from the existing motivation table, only in that view. Unselected coordinates stay null. Source spellings and scoped keynotes are retained. Other contextual transformations remain unresolved.

## CPU execution

`analyzeStructure` preserves case, positions within the token stream, and code points, and creates bounded symbolic field lookup workers from observed source properties. Source-example composition runs only for an explicit example selection. The root also executes the existing recognition tools and preserves their actual syntax/claim relationships in the default Space result; see [RECOGNITION-WIRING.md](RECOGNITION-WIRING.md). These workers perform source lookup and relational composition; they do not yet implement a general morphological parser or an autonomous agent swarm.

`advanceStructuralState` accepts explicit finite vectors and a supplied 4×4 tensor T, ordered M/E/B/I:

`X'[i,k] = Σj A[i,j] T[i,j] X[j,k]`

A masks inactive fields and closed relationships. This linear update is an available implementation, not an inferred universal governing equation. An optional caller-selected readout computes `P[k] = wMI M'[k] I'[k] + wEB E'[k] B'[k]` over open diagonals. Without supplied readout weights P's numeric value stays unresolved. No coefficients were present in the user's pasted formalization, so none are guessed.

## Recursive addresses

One level contains `64 × 6 × 6 × 6 × 5 = 69,120` discrete transition/line/color/tone/base slots. Repeating that explicitly independent hierarchy at depth d gives `69,120^d` representable paths. Depth three contains **330,225,942,528,000** paths. Indexing uses BigInt and creates only the requested path; it needs neither a preexisting-address registry nor a GPU. These are representable coordinate combinations, not trillions of stored images or independently validated meanings.

No hash selects these coordinates or structural meanings. The earlier lexical prototype remains available in existing compile/chat flows for compatibility; structural analysis does not invoke it or fill absent values with ones. Planet, zodiac, houses, angular conversion and the nine-view transforms are not multiplied into the count until their dependencies are established.

## Use

Run `npm run start:generative`, then open `http://127.0.0.1:8787/structure.html` for the inspector. Source view, observer question, governing field, active fields, recursive depth and motivation coordinates are selectable. A vertical flip is an explicit display operation, not an inferred transformation law.

```js
const out = root.structure({ text: 'Mind Ego Body Individuality' }, {
  view: 'motivation',
  frame: { question: 'when', governingField: 'Movement' },
  coordinates: [{ tone: 1, base: 4 }],
  depth: 3,
});
// Uses the root invocation / Klein / journal path.
const position = root.generativeMorphology.structuralAddress('9007199254740993', { depth: 4 });
```

HTTP: `GET /api/structure/views`; `POST /api/structure` takes `{subject,context}`. Utility endpoints `/api/structure/address`, `/trace`, `/step` take address, explicit path, and dynamics specifications respectively. The utility endpoints execute pure calculations; the main structure endpoint uses the root invocation path.

`traceStructuralPath` follows supplied graph edges and returns case-preserving initials or full labels plus source/view coordinates. It does not guess the LOVE, MIND or BHANTUGH traversal. Being/across, Movement/up-down, Evolution/dual-W and Design/diagonal are recorded with their stated uncertainty; full executable transforms still need exact rules.

## Validation and remaining work

`npm run test:all` covers the existing suites plus eight structural tests: six views, observer frames, coordinate scoping, large-index round trips, gated composition, letter paths, explicit CPU dynamics and root/Klein isolation. Live HTTP checks cover inspector assets, coordinate controls' API payload, large-address generation and invalid-input responses. Browser tooling was unavailable; rendered layout and interactions still require browser validation.

This slice does not implement photo reconstruction, new photo/3D synthesis, universal system execution, a full Bantu morphology/syntax decoder, or the unresolved directional/angle transformations. Those capabilities need executable rules and separate acceptance checks built on this foundation.

Sources: existing repository state-space authority tables; author-supplied Human Design / Juxtaposition Unified Theory charts and contextual interpretation. Source-table identifiers describe the existing authority provenance; they do not imply independently verified pagination of every screenshot. The source graphs are reference layouts, not universal orientations.

Follow-up: [Klein tool audit](KLEIN-TOOL-AUDIT.md) documents the full catalog and shared actual-run state. Structural interactions can now include the learned rules and generated compositions returned by those tools; their source labels and generated/evidence distinctions are preserved.

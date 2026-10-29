# Synthia · Semantic Swarm Observatory

**Current entry point: the backend-free Linux substrate.** Run `npm start` for its in-process terminal inspector or `npm run experiment -- ./swarm-data` for held-out learning, image reconstruction, disruption, recovery, and restart experiments. See [native/README.md](native/README.md) and [the primary-condition ledger](native/PRIMARY-CONDITIONS.md). The source-derived five-dimensional rules and emergent geometry remain incomplete; this is an experimental adaptive graph baseline.

The sections below describe the **older browser prototype**, retained for reference. Start it with `npm run legacy:browser`, not `npm start`. It is separate from the new native runtime.

A local JavaScript research prototype for inspecting how semantic particles, directed relationships, and persistent formations can share one changing substrate.

**Five dimensions are not five layers.** Being, Movement, Design, Evolution, and Space are interpretive dimensions. Each dimension can carry its own qualitative layers, with different depths, nesting, and arrangements. No universal five-layer stack is imposed.

## Run

Requires Node.js 22 or newer for the optional static file server and tests. No npm packages, build step, account, API key, or simulation backend are required.

```sh
cd observable-swarm
npm run legacy:browser
```

Open **http://localhost:4173**. If this folder has another local name, enter that folder instead. The legacy Node process only serves files; the prototype currently uses its cooperative browser runtime. This browser display is not the native substrate or its execution foundation.

## Observe

1. Press **Run**, or **Step** to advance one tick. The initial conditions are reproducible.
2. The primary **Swarm scene** paints particles, bonds, and surfaces closed by persistent relations. It has no target image or predefined object silhouette.
3. Scroll over the scene to zoom toward the pointer. Double-click to zoom toward the selected particle. At closer zoom, the same substrate exposes its relationships and five Black Book expression tracks. **Fit** resets the camera.
4. **Inspect structure** exposes the graph directly. Choose a dimensional view to inspect or stimulate it. This is an observation tool, not five separate simulations.
5. Select a particle from the canvas or selection menu. Change one hexagram line, apply force, or inspect incoming and outgoing predictive weights. Keyboard: arrow keys select particles; Space toggles playback while the canvas is focused.
6. Run an exact **Klein comparison**, inspect its contextual witness, and select an event row to read its evidence.
7. **Save/Restore** retains weights and the complete history in IndexedDB. Autosaves use a separate slot. **Export/Import** transfers a JSON snapshot. **Verify replay** rebuilds the state from the initial seed and recorded actions.

The initial configuration has 96 particles. The geometric reference is a moving 3D dodecahedral embedding (12 faces, 20 vertices, 30 edges). These three embedding coordinates are not the five semantic dimensions.

## What runs now

- Source-preserving reuse of existing Synthia hexagram patterns, Klein ATO and contextual operator, Black Book dimension chains, structural views, and recursive address machinery.
- All 64 hexagrams and all 384 directed single-line transitions. Identity, before/after context, and reverse-transition history remain separate.
- Encounter-created directed recurrent synapses. An online delta rule trains a small scalar activation predictor; connection strength is distinct from its signed predictive weight.
- Reinforcement, configuration-sensitive inactivity decay, and force weakening. Numerical formulas are explicit experimental settings.
- Persistent bond subassemblies and larger connected formations that retain their member identities and history after dissolution.
- Formations can carry contextual compositional morphology; **paragraph, song, verse, and haiku are possible forms, not a mandatory hierarchy or automatic classifications**.
- Six user-defined expression-potential slots with unresolved realization and action-capable pair. Event leadership remains unresolved without a validated attribution rule.
- Case-preserved expressions and first-capital, frame-specific direction-rule support. No universal alphabet-to-vector table is invented.
- Per-dimension variable-depth qualitative structures, independent of geometric or formation level.

## What is not finished

This is an observable computational foundation, **not yet a generative Sims-like or photorealistic world**. Current formations do not autonomously resolve into recognizable people, trees, buildings, songs, or applications. Showing a phrase in the inspector does not prove that phrase generated a shape.

The zoomed-in phrases are provisional grammatical compositions of source keynotes and Black Book hexagram titles. For example, Gate 6 supports the displayed composition “I Am Conflict” in the Being view. These compositions are not quotations of complete source sentences, learned conclusions, or fixed behavior assignments. Exact BANTU vertical/diagonal reading paths, general transliteration, sound generation, qualitative layer derivation, and morphology-to-scene synthesis still need source-grounded implementations. Other dimensions’ address ordering is left unresolved where the inspected transcription has no established order.

No pretrained language model is bundled or trained. The included adapter can ingest real contextual comparisons through a supplied local model and record its responses as **untested proposals**. It cannot claim language-model learning happened merely because a callback ran.

## Local extension interfaces

In the browser console:

```js
await window.synthia.command('expression', {
  id: 'p001', text: 'i am Conflict', frame: 'Being'
});

// Use only a mapping you have established from a source.
// The following is a contract example, not a proposed BANTU mapping.
await window.synthia.command('direction-rule', {
  capital: 'C', dimension: 'Being', vector: [0, 1],
  source: 'EXAMPLE ONLY — replace with the actual source rule'
});

// A model must be supplied locally; no remote provider is contacted here.
window.synthia.attachModel({
  name: 'My local model',
  async ingestComparisons({ comparisons, context }) {
    // Invoke your actual local inference runtime here.
    // Return { text: string, evidence: [existingComparisonId, ...] }.
    throw new Error('Connect an actual local inference implementation');
  }
});
```

`window.synthia.snapshot()` returns the full state. `command('qualitative-structure', {id, dimension, source, roots})` installs a source-qualified tree for one dimension without changing the others. Nodes have `id`, `label`, `children`, optional `interprets` (another dimension), and optional `arrangement` (`unresolved`, `side-by-side`, `stacked`, `diagonal`). The inspection budgets of 4,096 nodes/depth 64 and simulation budget of 512 particles are hardware guards, not limits on semantic address capacity.

The original `FractalAddressSpace` also retains its explicit depth-32 implementation bound. One address level contains 69,120 combinations; that is not a global address limit.

## Test and provenance

```sh
npm test
```

There are 17 core tests covering encodings, ATO, identity, dimensions, neural learning versus a control, persistence/decay, replay, input validation, sourced morphology, scene surfaces, topology, and independent qualitative layers.

Browser acceptance script (requires Python Playwright and Chromium):

```sh
python -m pip install playwright
python -m playwright install chromium
python scripts/browser_check.py
```

See [source provenance](docs/SOURCES.md), [current validation](docs/VALIDATION.md), [architecture](docs/ARCHITECTURE.md), and [Klein Boolean vision](docs/BOOLEAN-VISION.md). No full source books or private Drive documents are included.

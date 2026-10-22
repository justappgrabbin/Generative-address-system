# Synthia Generative Address & Morphology Integrated v0.2.1

This build uses **Pure-Synthia-Integrated-Assembly-v0.4.2 as the live Synthia root** and mounts the Generative Address & Morphology Engine additively inside Synthia's existing AutomataMesh.

## What is preserved

No existing v0.4.2 authority source was edited.

- `authorities/execution-spine/` is unchanged.
- `authorities/trainable-core/` is unchanged.
- `src/unified-synthia-assembly.mjs` is unchanged.
- the original v0.4.2 root tests are unchanged.
- the exact uploaded `Pure-Synthia-Integrated-Assembly-v0.4.2.zip` is preserved under `provenance/original-v0.4.2/`.
- the uploaded `synthia-v14.html` is preserved unchanged under `ui/original/`.

The previous r21.21 lineage is not the active chassis.

## Added: Generative Address & Morphology organ

`generative-address-morphology` is mounted as a real automaton on the live mesh and wrapped by the existing private KleinContextRuntime. It provides conditional addressed connection formation, graph instantiation/dissolution, graph pods, graph ecology, dominant-energy calculation, morphology/function extension registries, multimodal projections, and persistent graph weighting that cannot create an otherwise unlawful graph.

Generic morphology math and current dominance metrics remain marked experimental until replaced by source-supported laws.

## Added: three explicit chat processing forms

The modified v14 UI is at:

`ui/synthia-v14-three-chat-modes.html`

It adds one persistent **CHAT** selector with three forms:

1. **Communication** — preserves the existing v14 direct model/transport chat path exactly as its chat path. It does not require the integrated core server.
2. **Klein** — sends the utterance to the integrated Synthia root and uses the existing private deep Klein contact loop without the additive morphology pre/post passes.
3. **Morph** — sends the utterance through Generative Address & Morphology inward, then through the existing private Klein contact loop, then through Morph outward.

The active LLM/model selector remains independent of this control. The selected chat form is persisted in `localStorage` as `sy_chat_mode`.

There is **no silent fallback between forms**. If Klein or Morph cannot reach the integrated core, v14 reports that selected form as failed instead of secretly switching to Communication. This makes the three forms useful for reliability comparison.

The integrated core URL is configurable in the same menu under **CORE** and defaults to:

`http://127.0.0.1:8787`

## Address behavior in Morph mode

Morph preserves explicit active/canonical addresses when supplied. With no supplied addresses, it now derives candidate addresses from the subject's morphological and semantic features, validates them, and registers them before compiling connections. Chat and research work from an empty address registry; new candidates do not need to exist beforehand.

The included interpretable feature model uses AUTOLING morphology, the existing gate names/themes and line descriptions, and the source dimension chains. Cosine similarity measures candidate fit; Boolean ATO completes explicitly requested analogies over shared named features. Channel IDs and names no longer seed morphology parameters. SHA-256 remains only for stable address identifiers.

These mappings are **experimental**. This is a source-vocabulary prototype model, not a trained general-language model. Unknown meanings remain unresolved and can be taught explicitly. Planetary and fine-coordinate defaults are recorded as symbolic defaults, not inferred astronomical facts. See [semantic generation and model extension](docs/SEMANTIC-ADDRESS-GENERATION.md).

## Internet / browser integration

The same morphology organ is connected to the existing `research-browser` and `browser-form` automata. Their original safety/consent behavior remains intact.

## Run it

**First unzip the ZIP. A ZIP is not directly runnable.**

Then enter the extracted folder and start the integrated core:

```bash
cd Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE
npm run start:generative
```

No `npm install` is required for this included pure-JS build.

The core runs at:

`http://127.0.0.1:8787`

For the three-form v14 interface, open:

`ui/synthia-v14-three-chat-modes.html`

Communication works through v14's existing route. Klein and Morph use the CORE URL.

## Verification

Run the integrated/root tests:

```bash
npm test
```

Run every preserved authority test plus integration tests:

```bash
npm run test:all
```

Run the morphology engine's own tests:

```bash
npm --prefix extensions/generative-address-morphology test
```

Current verified totals in v0.2.1:

- integration/root: 11/11
- preserved execution spine: 29/29
- preserved trainable core: 6/6
- morphology engine: 5/5
- total: **51/51 passing checks**
- modified v14 inline JavaScript: syntax parse passed
- live `/api/chat` smoke: Klein distinct, Morph distinct, Communication intentionally rejected by the core because it remains owned by v14's existing direct route

## Programmatic chat forms

```js
import { SynthiaGenerativeAssembly } from './src/index-generative.mjs';

const synthia = new SynthiaGenerativeAssembly({ morphologyAddresses: addresses });

// Private Klein form, no additive Morph wrapper:
const klein = await synthia.chatKlein('hello');

// Morph form, morphology inward/outward around the private Klein loop:
const morph = await synthia.chat('hello');
```

The original unified root remains available unchanged through `src/index.mjs`.


### Structural perspective inspector

The CPU structural layer separates observer perspective from the source chart, derives Space through field relationships, and indexes recursive addresses on demand. Run `npm run start:generative` and open `/structure.html`. See [STRUCTURAL-STATE-SPACE.md](STRUCTURAL-STATE-SPACE.md) for the state equations, API, tested behavior and unresolved rules.

Recognition wiring: [tool capabilities, verified root/Klein paths and limitations](RECOGNITION-WIRING.md). Live tool outputs now reach the structural state; reference relationships require an explicit example.

The [complete Klein tool audit](KLEIN-TOOL-AUDIT.md) covers all 16 canonical tools plus three source-backed adapters, shared-context/result wiring and executable task composition. Inspect `/api/tools` or call `root.runToolTask(steps)`; each tool is tested through a real execution path.

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

## Added: adaptive social and verified mission runtimes

The morphology organ now includes lossless thirteen-coordinate numeric addresses, immutable choices, and personal perspectives whose word/position associations adapt from explicit observed values. The social runtime connects isolated agents through directed relationships, selects expressions from private vocabularies for requested numeric intentions, schedules bounded message ticks, and can apply immutable choices on delivery. The mission runtime connects observation-dependent planners to explicitly registered host actuators, requires exact capability grants, and verifies completion independently from planner claims.

Social and mission snapshots preserve the latest state and digest-checked provenance. No operating-system actuator is enabled by default, and arbitrary prose is not represented as a verified program or completion predicate. See `extensions/generative-address-morphology/docs/social-mission-runtime-v1.md`.

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

Morph uses the explicit active/canonical addresses already loaded into the integrated engine. It does **not** manufacture an address from chat text when none has been supplied. The morphology state can therefore be empty while the chat path still runs, which is preferable to fabricating structure.

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

Current verified totals on the additive numeric/social/mission branch:

- integration/root: 66/66
- preserved execution spine: 29/29
- preserved trainable core: 6/6
- morphology engine, including social and mission runtimes: 57/57
- total: **158/158 passing checks**
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

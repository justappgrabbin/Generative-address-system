# Verification v0.2.1

## Preservation

Pure-Synthia-Integrated-Assembly-v0.4.2 remains the active root. Existing execution-spine, trainable-core, and unified root sources are preserved. `synthia-v14.html` is preserved under `ui/original/` and the new UI is a separate copy.

## Three-form chat verification

- Communication remains the original v14 `callModel()` route.
- Klein uses `SynthiaGenerativeAssembly.chatKlein()` and returns a live deep Klein contact result without a `morphology` wrapper.
- Morph uses `SynthiaGenerativeAssembly.chat()` and returns live inward/outward morphology while retaining the private Klein contact loop.
- `/api/chat` accepts `mode: "klein"` and `mode: "morph"` explicitly.
- `/api/chat` intentionally returns HTTP 409 for `mode: "communication"` so the core cannot silently impersonate v14's existing Communication route.
- No hidden fallback occurs in the modified v14 UI.

## Test results

- root/integration: 11/11 pass
- execution spine: 29/29 pass
- trainable core: 6/6 pass
- morphology engine: 5/5 pass
- total: 51/51
- v14 modified inline JavaScript: `node --check` parse pass
- API smoke:
  - Klein: `ok=true`, no morphology wrapper, `deep-klein-contact-loop`
  - Morph: `ok=true`, morphology wrapper present, `deep-klein-contact-loop`
  - Communication: HTTP 409 by design, remains owned by v14 direct chat

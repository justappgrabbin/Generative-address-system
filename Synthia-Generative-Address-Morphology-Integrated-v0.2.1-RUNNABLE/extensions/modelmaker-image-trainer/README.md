# ModelMaker image trainer (additive)

Uses Alexis's ModelMaker image model **unchanged** as the trainer for the generative layer, and saves what it learns by address.

- `vendor/modelmaker-morph-studio/` — byte-exact copy of `Modelmaker-repair/morph-studio/` from
  justappgrabbin/Stellarproximology-lab, branch `feature/modelmaker-neural-morph`, commit `17e2b83`.
  Every file's sha256 is in `vendor/PROVENANCE.json`. Not edited.
- `src/index.mjs` — wrapper (pure JS, offline, no web workers / WASM / network):
  - `toField` / `decodeImageBytes` — PNG + baseline JPEG via the generative-reconstruction decoders.
  - `train(pairs, {size, epochs})` — pairs are `{source, address, target}`; runs her `ImageField.batch`
    with the same loop as her `train-worker.mjs` (last pair held out), inline instead of in a worker.
  - `generate(model, source, size, address)` — her `ImageField.render` at any address, including unseen ones.
  - `ModelStore` — saves her `model.save()` JSON into MorphMir `ExactChunkMemory` at `genrec://model/<sha256>`
    with `version` + `supersedes`; `export()` / `ModelStore.fromSnapshot()` survive a process restart.
  - `publishToMesh(mesh, rec, result)` — optional record into her `LearningMesh` (passed in, not imported).
- Address fields are fed to her `encodeAddress` exactly as her model does. **What each field should control is investigating — hers to define.**

Tests: `npm test` (wrapper tests + her 7 vendored tests). Samples: `node scripts/make-samples.mjs [outDir]`.
See `HANDOFF-NOTES.md` for what is verified, limits and next steps.

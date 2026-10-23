# Handoff notes — 2026-10-21

## Done and verified (node --test, fresh clone)
- Her ModelMaker morph-studio vendored byte-exact with provenance (repo, branch, commit 17e2b83, per-file sha256). Her 7 tests pass from the vendored copy.
- Wrapper trains her `ImageField` on crops of her photo (source + address -> target). Training loss drops (test requires >20%; 32px sample run: 0.172 -> 0.013).
- Unseen address (gate 17) produces output distinct from every training target.
- Weights saved at `genrec://model/<sha>` in MorphMir ExactChunkMemory, with version + supersedes; reload gives identical output, including in a fresh process.
- Sovereignty: train/save/load/generate run with fetch, XHR, WebSocket, Worker and WebAssembly blocked and process/Buffer removed.
- Optional LearningMesh record works with her vendored LearningMesh (in-memory).
- All earlier extension tests still pass (5 + 13 + 10 + 14).

## Can't do yet, and why
- **Needs a source image.** Her model transforms a source image per pixel; it can't make an image from an address alone.
- **Small and blurry.** It's a one-hidden-layer per-pixel network (16/32/64 units); samples are 32x32.
- **Weak generalization.** The held-out pair barely improved (0.124 -> 0.106 in the sample run); with 3 training pairs it mostly memorizes.
- **Address-field meanings are undefined (investigating).** Numbers go into her encoder unchanged; which field controls what is hers to define.
- **LearningMesh mapping is a placeholder.** toolId `autoling`, kind `image-field-model`, confidence = held-out loss reduction — all investigating. ValidatedLearningStore needs IndexedDB (browser) and is text-oriented; not wired.
- **AUTOLING doesn't yet receive image learnings** in any real pipeline; nothing reads the mesh record back.
- **In-between frames are a crossfade, not motion** (generative-reconstruction layer).
- **3D needs multi-view data** (several angles or video frames); none is wired in.
- **The PSO repair is a single pluggable optimizer, not her 3-2-1 swarm** (that design is hers to define).
- **Neither genrec branch is on main** (`add/generative-reconstruction-20261021`, `add/modelmaker-image-trainer-20261021`). Needs her yes to merge.

## Next steps
1. She defines what address fields control (gate/line/color/...), then train with pairs labelled that way.
2. More and larger training pairs (her own photos / morph pose sheets) and a bigger hidden size for sharper output.
3. Add a "from address alone" path (e.g. a learned or procedural base image per address) so no source is needed.
4. Connect saved model records to AUTOLING / LearningMesh consumers once she confirms the mapping.
5. Multi-view sets for 3D; motion-aware in-betweens.
6. Her decision on merging both branches to main.

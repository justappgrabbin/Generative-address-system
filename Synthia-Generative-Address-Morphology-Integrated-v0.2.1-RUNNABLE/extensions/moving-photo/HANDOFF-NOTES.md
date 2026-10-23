# Handoff notes: moving photo
## Works (verified by tests)
- Rebuild from addressed layers matches the stored original (sha256 of exact bytes; layer rebuild maxError ≤ 1).
- Her video-generator.js drives the frames, vendored byte-exact (sha256 checked in a test).
- Real-photo warp; same address path gives identical frames; different paths give different frames.
- Edge fill with genrec PSO, about 1.3% of pixels on average (max about 4.1%) in the sample run.
- Pure-JS GIF89a encoder; the sovereignty test passes with network/Worker/WASM blocked.
## Can't do yet / limits
- The motion is a simple global warp (pan/zoom/wave/rotate). It's not articulated motion: no limbs, no pose, no depth.
- The adapters are stand-ins. Her geometry/grammar/transitions/renderer modules weren't in the batch, and the state→motion mapping is a placeholder ("investigating").
- The fill only continues smooth colour at the edges. It can't invent detail; large motions would expose more edge.
- The GIF uses a fixed 252-colour palette, so it shows banding. The PNG frames are full quality.
- Frames are half resolution (392x584) for speed; full res works but is about 4x slower.
- The autonove runtime and syntia_video_v3.json aren't wired in yet.
## Next steps
- Her mapping of address fields → motion. Plug in her real transitions/grammar modules when found.
- Mesh warp driven by pose points (morph pose sheets / motion matching) for real movement.
- Fill bigger holes with the ModelMaker ImageField or Predictive Memory codebook.
- Adaptive GIF palette (median cut).

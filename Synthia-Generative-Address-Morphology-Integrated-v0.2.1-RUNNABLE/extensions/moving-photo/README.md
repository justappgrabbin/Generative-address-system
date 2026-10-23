# Moving photo (additive extension)
Pure JS, offline, no workers/WASM/GPU/network. Nothing of Alexis's is edited; this folder sits alongside.

Pipeline:
1. **Rebuild** the real photo from its addressed genrec layers (`../generative-reconstruction`). Exact original bytes come back by sha256; the layer rebuild is within 1 per pixel.
2. **Motion path** from Alexis's `VideoGenerator` (vendored byte-exact, see `vendor/video-generator/PROVENANCE.md`). Her geometry/grammar/transitions modules weren't provided, so `src/adapters.mjs` has **stand-in** adapters. The state→motion mapping (movement→pan X, evolution→pan Y, being→zoom, design→wave, space→wave phase + small rotation) is a **placeholder, "investigating"**. What each address field controls is hers to define.
3. **Warp** the real photo per frame (backward warp, bilinear). Pixels are moved, not invented.
4. **Fill** only uncovered pixels (edges pulled in by pan/zoom): 8x8 blocks that hold any uncovered pixel are repaired with genrec PSO, and only the uncovered pixels take the repaired values.
5. **Output** PNG frames, a pure-JS animated GIF (`src/gif.mjs`) and a contact sheet: `node scripts/make-samples.mjs <outDir>`.

Sample run (half resolution):
```json
{
 "source": "grok_1786623505617.jpg",
 "frameSize": "392x584 (half of 784x1168)",
 "frames": 24,
 "address": "genrec://image/389481fa282d47552cf2f70fc2707818e1f56b6304feeed7e6c18228c36d2cd3",
 "rebuild": {
  "psnr": 84.35,
  "maxError": 1,
  "exactOriginalSha256Match": true
 },
 "filledPct": {
  "min": 0,
  "max": 4.08,
  "mean": 1.31
 },
 "renderMs": 8318
}
```
Tests: `node --test tests/`

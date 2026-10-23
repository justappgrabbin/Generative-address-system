# Generative reconstruction (additive, v0.1.0)

This rebuilds images (photos, animation frames) from an address, even when only some of the data is there.
Exact byte-for-byte recall still lives in `morphmir-memory`, and this layer sits on top of it. No existing
files were edited.

## What it does

* **Reads and writes images in pure JS.** It decodes PNG (8/16-bit, gray, RGB, palette, alpha) and baseline
  JPEG to RGBA. It encodes RGBA to PNG with its own inflate/deflate.
* **Splits an image into frequency layers.** The image goes to YCbCr, then 8x8 block DCT in zigzag order. That
  gives 6 layers from coarse to fine (zigzag bands `[0]`, `[1-2]`, `[3-9]`, `[10-20]`, `[21-35]`, `[36-63]`).
  * Each layer is stored in morphmir-memory's `ExactChunkMemory`, at its own `morphmir://manifest/<sha256>`
    address, with a sha256 per chunk and `supersedes` links.
  * The image manifest is at `genrec://image/<sha256 of source file>`. It lists every layer's address, hash
    and `supersedes`, plus `exactOriginal`, which points at the byte-exact original when it was stored.
* **Rebuilds from any set of layers.** `store.reconstruct(address, {layers:[0,1,2]})` works with any subset.
  If a layer is missing or corrupt, it gets reported and left out. The rebuild still comes back, just at
  lower quality.
* **Repairs missing pieces.** It fills dropped blocks or a missing region in two ways:
  * **Naive:** a flat block at the average colour of the neighbours.
  * **PSO:** a particle swarm searches the first 10 coefficients of each missing block, per channel. It's
    scored on how well the block's edges continue the known neighbours. Blocks get filled from the outside
    in.
* **Makes in-between frames.** `interpolateCoefs(a, b, t)` blends two addressed frames in coefficient space.
* **Backend registry.** `createGenerativeReconstruction().register(backend)` tries other backends first. Pure
  JS always goes last and finishes the job alone if they fail or are missing.

## Verified results (the photo, `389481fa…`)

| layers | PSNR at full size, 784x1168 | PSNR at 1/4 size (fixtures/out) |
|---|---|---|
| 1 | 23.42 dB | 20.33 dB |
| 2 | 25.90 | 23.46 |
| 3 | 29.12 | 27.13 |
| 4 | 32.30 | 30.26 |
| 5 | 36.23 | 33.42 |
| 6 (all) | 89.94 (max error 1) | 84.04 (max error 1) |

| repair | full size | 1/4 size |
|---|---|---|
| 25% of blocks dropped, no fill | 15.50 dB | 16.60 dB |
| naive fill | 27.37 | 25.13 |
| PSO fill | **29.03** | **27.12** |
| 32px missing square, naive / PSO | 46.80 / **49.37** | 35.16 / **36.13** |

The byte-exact original comes back through `exactOriginal`, and its sha256 matches.

## Limits

* **The in-between is a crossfade, not motion.** Blending coefficients is linear, so the in-between is a
  cross-dissolve with ghosting. Its PSNR is 21.84 dB against each end frame. Real motion in-betweens need
  motion estimation, which is still investigating.
* **PSO only guesses smooth content.** It keeps edges and colour flowing, but it can't invent detail that
  isn't in the neighbours. The PSO settings (`extrapolate 0.25`, `lambda 0.05`) were tuned on this one
  photo, and they're investigating for other images.
* **Speed.** At full size, PSO took about 47 s in Node for 3,592 blocks. Phone speed hasn't been measured.
* **Formats not covered:** progressive and arithmetic JPEG, CMYK JPEG, and interlaced PNG all throw a clear
  error. JPEG chroma uses simple upsampling, so it differs a little from libjpeg (mean 0.19, max 23 per
  channel vs PIL).
* **Layers aren't smaller than the original yet.** They're stored as Int16 at x4 scale, with no
  quantization or entropy coding, so the full layer set is larger than the JPEG.

## How a swarm hooks in

`psoRepair(..., {optimizer})` takes any optimizer with the same signature as `pso(fitness, {dims, seeds,
spread, particles, iterations, random})`. The PSO here is one pluggable optimizer. It is **not** the 3-2-1
swarm design. How the levels, clusters and body cycles map onto reconstruction is yours to define. The
fitness function (edge continuity, or PSNR against a known target) is the steering signal a swarm can use.

## Run

* Tests: `npm test`. That's 13 tests: codec, progressive and monotonic, full > 40 dB, corrupt-layer
  fallback, PSO beats naive, interpolation, registry fallback, and sovereignty (network, Workers and WASM
  blocked, `process` and `Buffer` removed).
* Samples: `node scripts/make-samples.mjs <outDir> <downscale>`. This script is Node-only. It's a demo and
  not part of the runtime.

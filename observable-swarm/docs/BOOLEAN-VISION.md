# Klein, Boolean feature vectors, and perceptual composition

The intended world is one substrate at different observation scales. Low-level qualities remain attached to constituent structures; larger compositions can express them as visible shape/color/image, audible sound, or other modalities. A five-dimensional frame can have many qualitative layers; the number and arrangement are not fixed globally.

## What the existing Klein visual module actually supplies

`vendor/ato.mjs`, retained from the existing Synthia repository, includes:

- `featureBits({Y, Cb, Cr, texture, vertical})`: an eight-bit measured visual feature representation. It uses three luminance bits, chroma-sign bits, two texture-bin bits, and a vertical-edge-dominance bit.
- `decodeFeatureBits(features)`: approximate decoding of those quantized features.
- `ato`, `analogy`, `complexAnalogy`, `atoTree`, and `replan`: operations over feature states, including a does-not-apply marker.

This makes a concrete image path possible: measure spatial regions, encode each region in a consistent feature schema, compare or transform their Boolean states, then reconstruct visual expressions from the transformed features. The source representation, region relationships, governing frame, history and reconstruction assumptions must remain available.

**The running observatory currently uses the hexagram ATO path. It does not yet ingest photos through the measured-feature path or synthesize photos from those vectors.** Its existing painted surfaces use explicitly experimental pigment. They are not evidence that Boolean visual morphology has been learned.

## Required integration

1. Measure image features and preserve region identity, orientation, resolution and neighborhood relationships in the shared substrate.
2. Keep measured visual vectors distinct from six-line hexagram encodings. A common bit representation is not sufficient evidence of a common semantic interpretation.
3. Use Klein operators on aligned, compatible feature schemas and retain the comparison context.
4. Attach learned feature transformations and reconstruction functions to the relevant constituents and formations, so zoom changes observation scale rather than swapping in an unrelated picture.
5. Validate reconstruction and new synthesis against held-out examples. The present eight-bit descriptor is lossy and cannot uniquely reconstruct an arbitrary original photograph.
6. Derive the BANTU grammatical/morphological traversal and dimensional layer placement from the supplied sources. Do not substitute a flat universal mapping for frame-dependent structure.

Images, sound and other modalities need their own measured feature/reconstruction contracts. Reusing an image feature vector as an audio vector without a justified bridge would introduce an arbitrary equivalence.

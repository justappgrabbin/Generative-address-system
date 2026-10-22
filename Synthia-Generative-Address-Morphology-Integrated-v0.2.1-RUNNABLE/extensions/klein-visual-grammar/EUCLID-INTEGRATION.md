# Euclid construction extension for Klein Visual Grammar

This is an additive extension to the existing `extensions/klein-visual-grammar` branch. It does not modify the Klein engines, image reconstruction engine, execution spine, or original sources.

## Source

The user's Google Drive copy of Oliver Byrne's *The First Six Books of the Elements of Euclid* (1847), `Elements-I-VI.pdf`, was located and inspected. Reference: Book I, Proposition I (equilateral triangle on a given finite straight line), its two-circle construction, postulates 1 and 3, and common notion 1. The diagrams use color to distinguish geometrical entities; color is not treated as a gate address.

Drive source: https://drive.google.com/file/d/1bASWMDt3zxCUFafb2n-lzWfkR0ZMTApv/view

Independent public edition: https://en.wikisource.org/wiki/The_First_Six_Books_of_the_Elements_of_Euclid_in_which_coloured_diagrams_and_symbols_are_used_instead_of_letters_for_the_greater_ease_of_learners

## Implemented

- `src/euclid.mjs`: exact circle intersections, constructive Euclid I.1, explicit proof constraints and provenance.
- Similarity transformations that preserve triangle geometry and construction relations.
- RGBA raster adapter for existing `readImage()` Klein visual-grammar pipeline, exported as `readEuclidWithKlein()`.
- Unresolved state-space address explicitly stays null; no hash, index, or default gate assignment.
- `tests/euclid.test.mjs`: construction, preservation, raster, and invalid-input tests.

## Usage

```js
import {point,equilateralOnSegment,readEuclidWithKlein} from './src/euclid.mjs';
const construction=equilateralOnSegment(point(72,180),point(184,180));
const visualGrammar=await readEuclidWithKlein(construction);
```

Run `node --test tests/euclid.test.mjs` from this extension directory.

## Boundaries

This is a first working construction bridge, **not** a complete Euclid theorem prover or generalized photorealistic image generator. The visual grammar still performs its existing measurement-based region segmentation. More propositions can be implemented additively after verifying source and geometry. No existing engine behavior was replaced.

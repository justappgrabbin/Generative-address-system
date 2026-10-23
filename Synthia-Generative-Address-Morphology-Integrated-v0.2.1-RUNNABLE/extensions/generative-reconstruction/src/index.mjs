// Generative reconstruction layer (additive, pure JS, offline). See README.md.
export * from './zlib.mjs';
export * from './png.mjs';
export * from './jpeg.mjs';
export * from './dct.mjs';
export * from './image.mjs';
export * from './layers.mjs';
export * from './pso.mjs';
export * from './repair.mjs';
export * from './registry.mjs';
import { analyze, synthesize } from './layers.mjs';
import { naiveRepair, psoRepair, interpolateCoefs } from './repair.mjs';
import { createReconstructionRegistry } from './registry.mjs';
export const pureJsBackend = Object.freeze({
  name: 'pure-js',
  reconstruct: ({ store, address, layers }) => store.reconstruct(address, { layers }),
  repair: ({ image, known, method = 'pso', options }) => { const an = analyze(image); const r = method === 'naive' ? naiveRepair(an, known) : psoRepair(an, known, options); return synthesize(r); },
  interpolate: ({ a, b, t }) => synthesize(interpolateCoefs(analyze(a), analyze(b), t)),
});
export function createGenerativeReconstruction() { return createReconstructionRegistry(pureJsBackend); }

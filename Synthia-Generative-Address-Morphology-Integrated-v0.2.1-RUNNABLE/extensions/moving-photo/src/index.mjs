// Moving-photo layer (additive, pure JS, offline). Rebuild real photo from addressed genrec layers,
// drive motion with Alexis's VideoGenerator (vendored byte-exact) + labelled stand-in adapters,
// warp the real pixels, fill only uncovered blocks with genrec PSO repair.
import * as G from '../../generative-reconstruction/src/index.mjs';
import { VideoGenerator } from '../vendor/video-generator/video-generator.mjs';
import { stubGeometry, stubGrammar, stubTransitions } from './adapters.mjs';
import { warp } from './warp.mjs';
export { warp }; export { encodeGif } from './gif.mjs'; export * from './adapters.mjs';
export function rebuildFromLayers(store, address) { return store.reconstruct(address).image; }
// Fill: blocks (8x8) with any uncovered pixel are treated as unknown and repaired by genrec PSO; covered pixels are kept exactly.
export function fillUncovered(image, mask, { iterations = 15 } = {}) {
  const { width: w, height: h } = image; let missing = 0; for (const m of mask) if (!m) missing++;
  if (!missing) return { image, filledPixels: 0 };
  const an = G.analyze(image), known = new Uint8Array(an.bx * an.by).fill(1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!mask[y * w + x]) known[(y >> 3) * an.bx + (x >> 3)] = 0;
  const rep = G.synthesize(G.psoRepair(G.damage(an, known), known, { iterations }));
  const out = image.data.slice(); for (let i = 0; i < w * h; i++) if (!mask[i]) for (let c = 0; c < 3; c++) out[i * 4 + c] = rep.data[i * 4 + c];
  return { image: { width: w, height: h, data: out }, filledPixels: missing };
}
export async function makeMovingPhoto(photo, { start, end, frames = 24, durationMs = 2000, kind = 'ease', fill = true } = {}) {
  const renderer = { width: photo.width, height: photo.height, renderScene: (scene) => { const r = warp(photo, scene); return fill ? { ...fillUncovered(r.image, r.mask), scene } : { image: r.image, filledPixels: r.mask.length - r.mask.reduce((a, b) => a + b, 0), scene }; } };
  const vg = new VideoGenerator(stubGeometry, stubGrammar, stubTransitions(frames), renderer);
  const out = await vg.generateVideo(start, end, { duration: durationMs, fps: Math.round((frames * 1000) / durationMs), trajectory: kind });
  return out.map((f) => ({ index: f.index, state: f.state, image: f.canvas.image, filledPixels: f.canvas.filledPixels }));
}

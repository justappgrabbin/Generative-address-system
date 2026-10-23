// Monte Carlo over Klein ATO answers, using Alexis's own Klein historical Monte Carlo (tool-06, unchanged, same repo)
// and her seeded mulberry32 RNG. Candidates = the ATO answer with bits flipped at random; score = seam error at the
// region border (edge continuity) + Hamming distance from the ATO answer (consistency). Her automaton drifts the
// score-weights and reports the dominant variant. The scoring/candidate scheme is ours (not from her files).
import { HistoricalMonteCarloAutomaton } from '../../../authorities/execution-spine/src/pure-synthia/automata/tools/tool-06-historical-monte-carlo.js';
import { mulberry32 } from '../../../authorities/execution-spine/src/pure-synthia/state-space/constants.js';
import { renderFeatureState } from './klein.mjs';
/** Mean |diff| across 4-neighbour pixel pairs that straddle a border of class `cls` (lower = smoother seam). */
export function seamError(read, img, cls) {
  const W = img.width, H = img.height, bx = read.an.bx, inC = (x, y) => read.lab[(y >> 3) * bx + (x >> 3)] === cls; let s = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) { const X = x + dx, Y = y + dy; if (X >= W || Y >= H || inC(x, y) === inC(X, Y)) continue; for (let c = 0; c < 3; c++) s += Math.abs(img.data[(y * W + x) * 4 + c] - img.data[(Y * W + X) * 4 + c]); n += 3; }
  return n ? s / n : 0;
}
export function monteCarloAnalogy(read, a, b, c, { samples = 48, flipP = 0.15, seed = 7, lambda = 4, generations = 20 } = {}) {
  const rng = mulberry32(seed), det = renderFeatureState(read, a, b, c), base = det.result, cands = new Map([[base.join(''), base]]);
  for (let i = 0; i < samples; i++) { const s = base.map((v) => (rng() < flipP ? 1 - v : v)); cands.set(s.join(''), s); }
  const scored = [...cands].map(([k, s]) => { const im = renderFeatureState(read, a, b, c, s).image, seam = seamError(read, im, c), ham = s.reduce((h, v, i) => h + (v !== base[i]), 0); return { key: k, seam, ham, score: seam + lambda * ham, image: im }; });
  const variants = Object.fromEntries(scored.map((x) => [x.key, Math.exp(-x.score / 10)]));
  const run = new HistoricalMonteCarloAutomaton().run({ variants, seed, generations, mutationScale: 0.1 });
  const pick = scored.find((x) => x.key === run.output.dominantVariant), detScore = scored.find((x) => x.key === base.join(''));
  return { deterministic: { state: detScore.key, seam: detScore.seam, score: detScore.score, image: det.image }, monteCarlo: { state: pick.key, seam: pick.seam, ham: pick.ham, score: pick.score, image: pick.image }, candidates: scored.length, accepted: run.accepted, baseline: det.baseline };
}

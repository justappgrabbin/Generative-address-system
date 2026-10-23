// Partial-data repair in coefficient space: naive fill (neighbour-DC average) vs PSO search guided by
// continuity with known neighbouring pixels. Blocks are filled in onion order (most-known neighbours first).
import { ZIGZAG, idct, basis } from './dct.mjs';
import { pso, rng } from './pso.mjs';

const N4 = [[0, -1, 'top'], [0, 1, 'bottom'], [-1, 0, 'left'], [1, 0, 'right']];
/** Copy of analysis with coefficients of blocks where known[b]===0 zeroed. */
export function damage(an, known) { return { ...an, coefs: an.coefs.map((c) => { const o = c.slice(); for (let b = 0; b < known.length; b++) if (!known[b]) o.fill(0, b * 64, b * 64 + 64); return o; }) }; }
/** Mask dropping `fraction` of blocks at random (deterministic seed). 1=known. */
export function randomBlockMask(an, fraction, seed = 7) { const r = rng(seed), m = new Uint8Array(an.bx * an.by).fill(1); for (let b = 0; b < m.length; b++) if (r() < fraction) m[b] = 0; return m; }
/** Mask dropping a rectangle of blocks (e.g. a missing region / outside a cropped fragment). */
export function rectMask(an, { x0, y0, x1, y1 }, inside = true) { const m = new Uint8Array(an.bx * an.by); for (let j = 0; j < an.by; j++) for (let i = 0; i < an.bx; i++) { const inR = i >= x0 && i < x1 && j >= y0 && j < y1; m[j * an.bx + i] = inside ? (inR ? 0 : 1) : (inR ? 1 : 0); } return m; }

function onionOrder(an, known) {
  const k = known.slice(), order = []; let pending = []; for (let b = 0; b < k.length; b++) if (!k[b]) pending.push(b);
  while (pending.length) {
    const scored = pending.map((b) => { const i = b % an.bx, j = (b / an.bx) | 0; let s = 0; for (const [dx, dy] of N4) { const x = i + dx, y = j + dy; if (x >= 0 && y >= 0 && x < an.bx && y < an.by && k[y * an.bx + x]) s++; } return [b, s]; });
    const best = Math.max(...scored.map((x) => x[1])); const layer = scored.filter((x) => x[1] === best && best > 0).map((x) => x[0]);
    if (!layer.length) { order.push(...pending); break; } // isolated: nothing known at all
    for (const b of layer) { order.push(b); k[b] = 1; } pending = pending.filter((b) => !k[b]);
  }
  return order;
}
function neighbourDcFill(an, c, b, filled) { const i = b % an.bx, j = (b / an.bx) | 0; let s = 0, n = 0; for (const [dx, dy] of N4) { const x = i + dx, y = j + dy, nb = y * an.bx + x; if (x >= 0 && y >= 0 && x < an.bx && y < an.by && filled[nb]) { s += c[nb * 64]; n++; } } return n ? s / n : 0; }

/** Naive fill: missing block = flat block at the average DC of its known/filled neighbours. */
export function naiveRepair(damaged, known) {
  const out = { ...damaged, coefs: damaged.coefs.map((c) => c.slice()) }, filled = known.slice();
  for (const b of onionOrder(damaged, known)) { for (const c of out.coefs) { c.fill(0, b * 64, b * 64 + 64); c[b * 64] = neighbourDcFill(out, c, b, filled); } filled[b] = 1; }
  return out;
}

const K_DEFAULT = 10; let EDGE = null;
function edgeBasis(K) { // EDGE[k][side][i] value of zigzag basis k on that edge (and the row/col just inside)
  if (EDGE && EDGE.K === K) return EDGE.v; const v = [];
  for (let k = 0; k < K; k++) { const B = basis(k); v.push({ top: [0, 1].map((r) => [...Array(8)].map((_, i) => B[r * 8 + i])), bottom: [7, 6].map((r) => [...Array(8)].map((_, i) => B[r * 8 + i])), left: [0, 1].map((c) => [...Array(8)].map((_, i) => B[i * 8 + c])), right: [7, 6].map((c) => [...Array(8)].map((_, i) => B[i * 8 + c])) }); }
  EDGE = { K, v }; return v;
}
function blockPixels(c, b) { const F = new Float64Array(64), f = new Float64Array(64); for (let k = 0; k < 64; k++) F[ZIGZAG[k]] = c[b * 64 + k]; return idct(F, f); }
const OPP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
function sideOf(px, side, depth) { const r = []; for (let i = 0; i < 8; i++) r.push(side === 'top' ? px[depth * 8 + i] : side === 'bottom' ? px[(7 - depth) * 8 + i] : side === 'left' ? px[i * 8 + depth] : px[i * 8 + 7 - depth]); return r; }

/** PSO repair: searches the first K zigzag coefficients of each missing block, per channel. */
export function psoRepair(damaged, known, { K = K_DEFAULT, particles = 24, iterations = 40, seed = 11, lambda = 0.05, extrapolate = 0.25, optimizer = pso } = {}) {
  const out = { ...damaged, coefs: damaged.coefs.map((c) => c.slice()) }, filled = known.slice(), E = edgeBasis(K), random = rng(seed); let evals = 0;
  for (const b of onionOrder(damaged, known)) {
    const i = b % out.bx, j = (b / out.bx) | 0;
    for (const c of out.coefs) {
      c.fill(0, b * 64, b * 64 + 64); const dc = neighbourDcFill(out, c, b, filled);
      const targets = []; // [side, predicted edge values, inner predicted]
      for (const [dx, dy, side] of N4) { const x = i + dx, y = j + dy, nb = y * out.bx + x; if (x < 0 || y < 0 || x >= out.bx || y >= out.by || !filled[nb]) continue; const px = blockPixels(c, nb), opp = OPP[side], e0 = sideOf(px, opp, 0), e1 = sideOf(px, opp, 1); targets.push([side, e0.map((v, t) => v + extrapolate * (v - e1[t]))]); }
      if (!targets.length) { c[b * 64] = dc; continue; }
      const fit = (x) => { evals++; let s = 0; for (const [side, pred] of targets) for (let t = 0; t < 8; t++) { let v = 0; for (let k = 0; k < K; k++) v += x[k] * E[k][side][0][t]; const d = v - pred[t]; s += d * d; } let r = 0; for (let k = 1; k < K; k++) r += x[k] * x[k]; return s + lambda * r; };
      const naive = new Float64Array(K); naive[0] = dc; const spread = Float64Array.from({ length: K }, (_, k) => (k === 0 ? 16 : 24 / Math.sqrt(k)));
      const { best } = optimizer(fit, { dims: K, seeds: [naive], spread, particles, iterations, random });
      for (let k = 0; k < K; k++) c[b * 64 + k] = best[k];
    }
    filled[b] = 1;
  }
  return Object.assign(out, { evals });
}
/** Linear blend of two frames' coefficient planes (animation in-between), t in [0,1]. */
export function interpolateCoefs(a, b, t) { if (a.bx !== b.bx || a.by !== b.by) throw new Error('frames must share block grid'); return { ...a, coefs: a.coefs.map((c, ch) => Float64Array.from(c, (v, i) => (1 - t) * v + t * b.coefs[ch][i])) }; }

import gates from '../vendor/gate-table.mjs';
import { analogy } from '../vendor/ato.mjs';
export { structuralView, applyStructuralFrame, FractalAddressSpace } from '../vendor/structural-space.mjs';
export const DIMENSIONS = Object.freeze(['Being', 'Movement', 'Design', 'Evolution', 'Space']);
export const GATES = gates;
const byBits = new Map(gates.map(g => [g.binary.join(''), g.gate]));
export function gateBits(gate) {
  if (!Number.isInteger(gate) || gate < 1 || gate > 64) throw new RangeError('Gate must be 1–64');
  return [...gates[gate - 1].binary];
}
export function gateFromBits(bits) {
  if (!Array.isArray(bits) || bits.length !== 6 || bits.some(b => b !== 0 && b !== 1)) throw new TypeError('Six binary lines required');
  return byBits.get(bits.join(''));
}
export function changeLine(gate, line) {
  if (!Number.isInteger(line) || line < 1 || line > 6) throw new RangeError('Line must be 1–6, bottom to top');
  const bits = gateBits(gate); bits[line - 1] ^= 1;
  return gateFromBits(bits);
}
export function compareGates(a, b, c = a) {
  const x = gateBits(a), y = gateBits(b), z = gateBits(c);
  return { original: a, counterpart: b, appliedTo: c, result: gateFromBits(analogy(x, y, z)),
    difference: x.map((v, i) => v === y[i] ? null : i + 1).filter(Boolean),
    similarity: x.reduce((s, v, i) => s + Number(v === y[i]), 0) / 6,
    provenance: 'Synthia Klein ATO: Z XNOR (X XNOR Y); binary features, not a word-meaning equation' };
}
export function potentials() {
  return ['Color', 'Tone', 'Base'].flatMap(locus => ['A', 'B'].map(polarity => ({
    id: `${locus}:${polarity}`, locus, polarity, realized: false, actionCapable: null,
    status: 'user-defined potential; realization and action-selection rules unresolved',
  })));
}
export function representations(particle) {
  const bits = gateBits(particle.gate), symbol = String.fromCodePoint(0x4dc0 + particle.gate - 1);
  return { identity: particle.id, gate: particle.gate, binary: bits.join(''),
    hexadecimal: parseInt(bits.join(''), 2).toString(16).toUpperCase().padStart(2, '0'),
    symbol, unicode: `U+${symbol.codePointAt(0).toString(16).toUpperCase()}`,
    lineOrder: 'bottom to top', note: 'Hexadecimal encodes the six-bit pattern, not the King Wen ordinal. No phonetic/color equivalence inferred.' };
}

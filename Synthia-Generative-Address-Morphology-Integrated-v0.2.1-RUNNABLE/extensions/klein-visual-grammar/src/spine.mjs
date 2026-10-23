// Klein visual-grammar wired to Alexis's EXECUTION SPINE (authorities/execution-spine), unchanged.
// Tools from its registry (resolveTool/createAllTools); learnings into its AnticipatoryMemory at the learning
// tool's own registered address; gates only from its wheel (tool address / addressing.js). No hash, no defaults.
import { resolveTool, createAllTools } from '../../../authorities/execution-spine/src/pure-synthia/automata/registry.js';
import { AnticipatoryMemory } from '../../../authorities/execution-spine/src/pure-synthia/merged/mesh-memory.js';
import { addressForArcSec } from '../../../authorities/execution-spine/src/pure-synthia/state-space/addressing.js';
import { SEED_WORDS } from '../../../authorities/execution-spine/src/pure-synthia/state-space/lexicon.js';
import { StateSpace, buildGateTable } from '../../../authorities/execution-spine/src/pure-synthia/state-space/mesh-state-space.js';
import { longitudeToHD } from '../../../authorities/execution-spine/src/pure-synthia/state-space/human-design.js';
import { gateBits } from '../../../authorities/execution-spine/src/pure-synthia/state-space/addressing.js';
import REAL_GATE_TABLE from '../data/real_gate_table.json' with { type: 'json' };
import { CompGramCoder } from './klein.mjs';
export { REAL_GATE_TABLE };
export const WHEEL_START = Object.freeze({ degrees: 58.0, status: "her code default (human-design.js longitudeToHD); F2 alternatives 311.75 / 46.75 pending Alexis" });
/** Her real gate table passed into the spine StateSpace (instead of its built-in buildGateTable). */
export function spineStateSpace() { return new StateSpace(REAL_GATE_TABLE); }
export function gateTableCheck() { const built = buildGateTable(); let bits = 0, tri = 0; for (const g of REAL_GATE_TABLE) { if (JSON.stringify(gateBits(g.gate)) === JSON.stringify(g.binary)) bits++; const b = built.find((x) => x.gate === g.gate); if (b && b.trigrams.upper === g.trigrams.upper && b.trigrams.lower === g.trigrams.lower) tri++; } return { gates: REAL_GATE_TABLE.length, binaryMatchesSpine: bits, trigramsMatchSpineBuilt: tri }; }
const word = (t) => t.replace(/\./g, '_').toLowerCase();
/** Tool address on HER wheel: the tool's arcSecond -> longitudeToHD (GATE_WHEEL, 58° start). Registry gate and spine
 *  addressForArcSec (sequential wheel) are recorded alongside so the conflict stays visible. */
const toolAddr = (tool) => { const a = tool.address, hd = longitudeToHD(a.arcSecond / 3600); return { address: { gate: hd.gate, line: hd.line, color: hd.color, tone: hd.tone, base: hd.base }, arcSecond: a.arcSecond, gateSource: 'human-design.js longitudeToHD (GATE_WHEEL, 58° start)', gateTableEntry: REAL_GATE_TABLE.find((g) => g.gate === hd.gate), registryGate: a.gate, sequentialWheelGate: addressForArcSec(a.arcSecond).gate, wheelStart: WHEEL_START }; };
export function spineTools() {
  const all = createAllTools(), get = (id) => { const d = resolveTool(id); if (!d) throw new Error(`spine registry has no ${id}`); return all.find((t) => t.id === d.id); };
  return { autoling: get('autoling'), monteCarlo: get('historical-monte-carlo'), ichingGrammar: get('iching-grammar') };
}
/** Spine AUTOLING learns the image rows; every learning stored in the spine memory at AUTOLING's own wheel address. */
export function learnOnSpine(read, { memory = new AnticipatoryMemory() } = {}) {
  const tools = spineTools(), at = toolAddr(tools.autoling), rules = [];
  for (const r of read.rows) { const out = tools.autoling.run({ operation: 'pipeline', text: r.map(word).join(' ') }).output.pipeline; for (const nr of out.phraseStructure.newRules) rules.push(nr); }
  for (const nr of rules) memory.contribute(at.address, { kind: 'visual-grammar', lhs: nr.lhs, rhs: nr.rhs, confidence: nr.confidence, provenance: 'spine-autoling', gateSource: at.gateSource, registryGate: at.registryGate });
  return { tools, memory, rules: rules.length, classRules: rules.filter((x) => !String(x.lhs).startsWith('S')).length, at };
}
/** Re-place KMGE game words via spine logic only. Word-level gate: spine has no non-hash rule -> held.
 *  Lexical class: only if the word is in the spine SEED_WORDS (posGuess's fallback 'NOUN' is a default -> not used). */
export function placeGameWordsOnSpine(memory, tools = spineTools()) {
  const cgc = new CompGramCoder(), seed = new Map(SEED_WORDS.map((w) => [w.word, w.pos])), at = toolAddr(tools.autoling), placed = [], held = [];
  const words = [...cgc.functionElements].map((w) => ({ rule: `word:${w}`, w, codes: cgc.classify(w).codes })), sufs = [...cgc.suffixRules].map(([s, c]) => ({ rule: `suffix:${s}`, codes: c }));
  for (const x of words) {
    if (!seed.has(x.w)) { held.push({ rule: x.rule, codes: x.codes, reason: 'not in spine lexicon SEED_WORDS; needs degree rule from Alexis (spine word->gate paths are hash: intake.js:119, execution-address-resolver.mjs:131)' }); continue; }
    const rec = { word: x.w, codes: x.codes, spinePos: seed.get(x.w), wordGate: null, wordGateHeld: 'needs degree rule from Alexis', storedAt: at.address, justification: { lexicon: 'state-space/lexicon.js SEED_WORDS', address: 'autoling tool arcSecond -> human-design.js longitudeToHD' }, provenance: 'kmge-gaming' };
    memory.contribute(at.address, { kind: 'game-word', ...rec }); placed.push(rec);
  }
  for (const s of sufs) held.push({ rule: s.rule, codes: s.codes, reason: 'no spine placement rule for suffix rules' });
  return { placed, held };
}

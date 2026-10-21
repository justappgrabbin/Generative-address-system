// Klein tools resolved through Alexis's mesh registry and learning through her LearningMesh (both r21.21, unchanged).
// Our additions here (marked): the trigger for AUTOLING heuristic 2 (shared left/right environment -> word class),
// a tiny node-store adapter so her KleinAutoLingLearner can write into LearningMesh, and a CompGramCoder wrapper.
import { KleinModuleRegistry } from '../../../vendor/cynthia-original/r21.21/vendor/ato-core/src/klein-module-registry.mjs';
import { LearningMesh } from '../../../vendor/cynthia-original/r21.21/browser/LearningMesh.mjs';
import { KleinAutoLingLearner } from '../../../vendor/cynthia-original/r21.21/substrate/mesh072/core/klein_autoling_learner.mjs';
import { CompGramCoder, AutolingGrammar } from './klein.mjs';
export const KMGE_MODULES = [
  { id: 'kmge-compgramcoder', role: 'CompGramCoder (KMGE v5.1)', level: 4, reusable: true, sources: ['extensions/klein-visual-grammar/vendor/kmge_v5_fixed/dist/klein-mesh-game-engine.js'] },
  { id: 'kmge-autoling-grammar', role: 'AutolingGrammar heuristics 1-4 (KMGE v5.1)', level: 5, reusable: true, sources: ['extensions/klein-visual-grammar/vendor/kmge_v5_fixed/dist/klein-mesh-game-engine.js'] },
];
export const LEARNER_PATH = 'substrate/mesh072/core/klein_autoling_learner.mjs';
/** Resolve the tools from the registry; throws if the mesh can't supply one. */
export function resolveTools() {
  const reg = new KleinModuleRegistry(KMGE_MODULES), autoling = reg.compose('autoling', ['kmge-compgramcoder', 'kmge-autoling-grammar']);
  if (!autoling.complete) throw new Error('mesh missing modules: ' + autoling.missing.join(','));
  const gi = reg.get('grammar-induction');
  if (!gi.sources.includes(LEARNER_PATH)) throw new Error('grammar-induction does not resolve to klein_autoling_learner');
  return { registry: reg, autoling, learner: LEARNER_PATH, compGramCoder: reg.get('kmge-compgramcoder'), autolingGrammar: reg.get('kmge-autoling-grammar') };
}
/** (ours) node-store adapter: her learner calls addState/node/addEdge/setResidency; every state is also published to LearningMesh. */
function meshAdapter(lm, pending) {
  const nodes = new Map();
  return { nodes, node: (id) => nodes.get(id), addState(s) { nodes.set(s.id, s); pending.push(lm.publish({ toolId: 'autoling', kind: s.kind, value: s.text, confidence: 0.6, evidence: [s.id] })); return s; },
    addEdge(e) { pending.push(lm.connect(e.from, e.to, e.type, e.evidence || [])); return e; }, setResidency(id, r) { const n = nodes.get(id); if (n) n.residency = r; } };
}
const word = (t) => t.replace(/\./g, '_').toLowerCase(); // her tokenizer keeps [a-z0-9_-]
/** AUTOLING on the mesh learns visual words + grammar from row sequences; everything goes into LearningMesh. */
export async function learnOnMesh(read, { mesh = new LearningMesh(), ato = null } = {}) {
  const tools = resolveTools(), pending = [], learner = new KleinAutoLingLearner(meshAdapter(mesh, pending));
  const gaming = placeGamingVocab(mesh, learner, pending); await Promise.all(pending); const before = countMesh(mesh);
  for (const r of read.rows) learner.observe(r.map(word).join(' '), { success: true });
  // (ours) trigger her AutolingGrammar.heuristic2 on shared environments -> new word classes
  const ag = new AutolingGrammar('image:photo'), env = new Map();
  for (const r of read.rows) for (let i = 1; i + 1 < r.length; i++) { const k = `${r[i - 1]}|${r[i + 1]}`; if (!env.has(k)) env.set(k, new Set()); env.get(k).add(r[i]); }
  const classes = [];
  for (const [k, ms] of env) { const m = [...ms]; if (m.length < 2) continue; const [l, rr] = k.split('|'); for (let i = 1; i < m.length; i++) ag.heuristic2([l], [rr], m[0], m[i]); }
  // merge H2 classes that share members into visual words
  const groups = []; for (const rule of ag.getRules()) { const t = rule.rhs[0]; let g = groups.find((x) => x.lhs.has(rule.lhs)); if (!g) { g = { lhs: new Set([rule.lhs]), members: new Set() }; groups.push(g); } g.members.add(t); }
  const merged = []; for (const g of groups) { const hit = merged.find((m) => [...g.members].some((t) => m.has(t))); if (hit) g.members.forEach((t) => hit.add(t)); else merged.push(new Set(g.members)); }
  for (let i = 0; i < merged.length; i++) pending.push(mesh.publish({ toolId: 'autoling', kind: 'visual-word', value: JSON.stringify({ word: `VW${i}`, members: [...merged[i]].sort() }), confidence: 0.6, evidence: ['autoling-h2'] }));
  if (ato) pending.push(mesh.publish({ toolId: 'autoling', kind: 'ato', value: JSON.stringify(ato), confidence: 0.6, evidence: ['klein-ato'] }));
  await Promise.all(pending);
  return { tools, mesh, gaming, before, after: countMesh(mesh), h2Rules: ag.getRules().length, grammarNodes: [...learner.mesh.nodes.values()].filter((n) => n.kind === 'learned-grammar').length };
}
/** Visual words read back FROM the mesh. */
export const meshWords = (mesh) => mesh.snapshot().learnings.filter((l) => l.kind === 'visual-word').map((l) => JSON.parse(l.value));
/** (ours) CompGramCoder wrapper: her classify first; if MISC, use the vocabulary the mesh supplies. */
export function meshCompGramCoder(mesh) {
  const cgc = new CompGramCoder(), lex = new Map(); for (const w of meshWords(mesh)) for (const t of w.members) lex.set(t, w.word);
  return { classify(t) { const e = cgc.classify(t); return e.codes.length === 1 && e.codes[0] === 'MISC' && lex.has(t) ? { ...e, codes: [lex.get(t)], source: 'mesh' } : e; }, base: cgc };
}
export const countMesh = (mesh) => { const L = mesh.snapshot().learnings; return { gameRules: L.filter((l) => l.evidence.includes('kmge-gaming')).length, visualWords: L.filter((l) => l.kind === 'visual-word').length, total: L.length }; };
/** KMGE gaming vocabulary kept, not dropped. Placement ONLY by her klein_autoling_learner logic:
 *  roles come from her inferRoles (via learner.analyze); the role->dimension priority is the one in her observe()
 *  (why->Design, who->Space, when->Evolution, where->Being, what->Movement). Her default role (no regex match) is NOT
 *  used: such words are held. Gates are never assigned: her code derives gates only by hash, so gate is held for all. */
const PRIORITY = [['why', 'Design'], ['who', 'Space'], ['when', 'Evolution'], ['where', 'Being'], ['what', 'Movement']];
export function placeGamingVocab(mesh, learner, pending) {
  const cgc = new CompGramCoder(), placed = [], held = [];
  for (const w of cgc.functionElements) {
    const codes = cgc.classify(w).codes, probe = learner.analyze(`${w} i`).roles; // 'i' always yields 'who'; anything else is an explicit match for w
    const own = probe.filter((r) => r !== 'who'), selfWho = learner.analyze(`${w} because`).roles.includes('who');
    const roles = [...own, ...(selfWho ? ['who'] : [])];
    if (!roles.length) { held.push({ rule: `word:${w}`, codes, reason: 'no role regex in klein_autoling_learner.inferRoles matches; only her default would place it' }); continue; }
    const dimension = PRIORITY.find(([r]) => roles.includes(r))[1];
    const rec = { word: w, codes, dimension, gate: null, gateHeld: 'her code assigns gates only by hash', justification: { source: 'r21.21/' + LEARNER_PATH, via: 'inferRoles + observe() dimension priority', matchedRoles: roles } };
    placed.push(rec); pending.push(mesh.publish({ toolId: 'autoling', kind: 'game-word', value: JSON.stringify(rec), confidence: 0.6, evidence: ['kmge-gaming'] }));
  }
  for (const [suf, codes] of cgc.suffixRules) held.push({ rule: `suffix:${suf}`, codes, reason: 'no placement logic for morphology rules found in her mesh code' });
  return { placed, held };
}
/** Compare a new visual token against game meaning on the mesh: same CompGramCoder code? same mesh address? */
export function compareToGameMeaning(mesh, token) {
  const L = mesh.snapshot().learnings, games = L.filter((l) => l.kind === 'game-word').map((l) => JSON.parse(l.value)), cg = meshCompGramCoder(mesh), code = cg.classify(token).codes[0];
  const learner = new KleinAutoLingLearner({ nodes: new Map(), node: () => null, addState: (x) => x, addEdge: (x) => x, setResidency() {} }), at = learner.analyze(word(token));
  return { token, visualCode: code, sameCode: games.filter((g) => g.codes.includes(code)).map((g) => g.word),  learnerReading: { words: at.words, roles: at.roles } };
}

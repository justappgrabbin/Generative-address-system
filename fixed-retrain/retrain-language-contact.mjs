#!/usr/bin/env node
/**
 * LABELLED RETRAIN 2026-11-05 (Pink).
 * Uses FIXED Autoling / Diseminer / Monte Carlo / Language-contact tools.
 * Does NOT overwrite any prior model files; writes only under retrain-out-20261105/.
 *
 * Principle: numbers are measurements; words are measurements of expression.
 *   - Autoling expressionLexicon records how a word is used in its frame (DET+X+VERB → NOUN).
 *   - Diseminer contexts/cooccurrence measure distributional expression, including CJK.
 *   - Contact borrows rules between book grammars; Monte Carlo weighs contact hypotheses
 *     without accepting negative or empty weight sets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AutolingEngine } from '../Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE/authorities/execution-spine/src/pure-synthia/automata/tools/fixed/tool-14-autoling.fixed.js';
import { DiseminerEngine } from '../Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE/authorities/execution-spine/src/pure-synthia/automata/tools/fixed/tool-15-diseminer.fixed.js';
import { HistoricalMonteCarloAutomaton } from '../Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE/authorities/execution-spine/src/pure-synthia/automata/tools/fixed/tool-06-historical-monte-carlo.fixed.js';
import { LanguageContactAutomaton } from '../Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE/authorities/execution-spine/src/pure-synthia/automata/tools/tool-05-language-contact.js';
import { PublicLanguageContactModel } from '../Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE/authorities/execution-spine/src/pure-synthia/integration/language-contact-models.js';

const BOOKS_DIR = process.env.BOOKS_DIR || '/workspace/alexis-batch/books2';
const OUT_DIR = process.env.OUT_DIR || '/workspace/pink-klein-fix/retrain-out-20261105';
const MAX_SENTENCES_PER_BOOK = Number(process.env.MAX_SENTENCES || 120);
const CONTACT_RATE = Number(process.env.CONTACT_RATE || 0.2);
const GENERATIONS = Number(process.env.GENERATIONS || 12);

fs.mkdirSync(OUT_DIR, { recursive: true });

const splitSentences = (text) =>
  String(text)
    .split(/(?<=[.!?;:])\s+|\n{2,}/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 12);

const bookFiles = fs
  .readdirSync(BOOKS_DIR)
  .filter((f) => f.endsWith('.txt'))
  .sort();

const perBook = [];
const hostAutoling = new AutolingEngine(); // accumulating host grammar (expression measurements)
const hostDiseminer = new DiseminerEngine();
let hostGrammar = {};

const grammarFromAutoling = (engine) => {
  const g = {};
  for (const rule of engine.grammar) {
    const key = rule.lhs || `S_${Object.keys(g).length + 1}`;
    g[key] = Array.isArray(rule.rhs) ? rule.rhs.join(' ') : String(rule.rhs);
  }
  // Expression measurements travel with the grammar as first-class entries.
  for (const [lemma, entry] of engine.expressionLexicon.entries()) {
    if (entry.support >= 2 && entry.pos && entry.pos !== 'UNKNOWN') {
      g[`EXPR:${lemma}`] = `${entry.pos}@support=${entry.support}`;
    }
  }
  return g;
};

const contact = new LanguageContactAutomaton();
const publicContact = new PublicLanguageContactModel();
const monte = new HistoricalMonteCarloAutomaton();
const contactTrajectory = [];

for (const file of bookFiles) {
  const full = path.join(BOOKS_DIR, file);
  const text = fs.readFileSync(full, 'utf8');
  const sentences = splitSentences(text).slice(0, MAX_SENTENCES_PER_BOOK);
  const bookAutoling = new AutolingEngine();
  const bookDiseminer = new DiseminerEngine();

  for (const s of sentences) {
    bookAutoling.runPipeline(s);
    hostAutoling.runPipeline(s);
  }
  // Whole-book distributional observe in chunks so CJK / long pages stay intact.
  const chunkSize = 4000;
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    bookDiseminer.observe(chunk);
    hostDiseminer.observe(chunk);
  }
  // Sample claims for contradiction linking across passages within the book.
  for (const s of sentences.slice(0, 40)) {
    bookDiseminer.extractClaims(s, `${file}:passage`);
  }

  const donorGrammar = grammarFromAutoling(bookAutoling);
  const beforeKeys = new Set(Object.keys(hostGrammar));

  // Contact: host grammar ← donor book grammar (words as expression measurements).
  const contactResult = contact.run({
    grammarA: hostGrammar,
    grammarB: donorGrammar,
    contactRate: CONTACT_RATE,
    generations: GENERATIONS,
    seed: [...file].reduce((a, c) => a + c.charCodeAt(0), 0),
  });
  hostGrammar = { ...contactResult.output.finalGrammar };

  const publicResult = publicContact.run({
    partyA: { address: { planetary: 'earth', dimension: 'Evolution', gate: 1 } },
    partyB: { address: { planetary: 'earth', dimension: 'Design', gate: 2 } },
    grammarA: Object.fromEntries([...beforeKeys].map((k) => [k, hostGrammar[k]]).filter(([, v]) => v != null)),
    grammarB: donorGrammar,
    contactRate: CONTACT_RATE,
    generations: Math.min(6, GENERATIONS),
    seed: 17,
  });

  const expressionTerms = [...bookAutoling.expressionLexicon.entries()]
    .filter(([, e]) => e.support >= 2)
    .sort((a, b) => b[1].support - a[1].support)
    .slice(0, 40)
    .map(([lemma, e]) => ({ lemma, pos: e.pos, support: e.support, environments: e.environments.slice(0, 3) }));

  const cjkKept = [...bookDiseminer.distributionalSpace.keys()].filter((t) => /[^\u0000-\u007f]/.test(t)).slice(0, 30);

  const summary = {
    book: file,
    sentencesLearned: sentences.length,
    autolingRules: bookAutoling.getStats().grammarRules,
    expressionLexiconSize: bookAutoling.expressionLexicon.size,
    topExpressionMeasurements: expressionTerms,
    diseminerVocab: bookDiseminer.distributionalSpace.size,
    diseminerClaims: bookDiseminer.claims.size,
    cjkTermsSample: cjkKept,
    contactBorrowed: publicResult.borrowedCount,
    hostGrammarSizeAfter: Object.keys(hostGrammar).length,
  };
  perBook.push(summary);
  contactTrajectory.push({
    book: file,
    borrowedRules: publicResult.borrowedRules,
    finalGrammarKeys: Object.keys(contactResult.output.finalGrammar).length,
  });

  fs.writeFileSync(
    path.join(OUT_DIR, `book-${file.replace(/\.txt$/, '')}.json`),
    JSON.stringify({ summary, donorGrammarKeys: Object.keys(donorGrammar).slice(0, 200) }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, ...summary }));
}

// Monte Carlo over contact hypotheses: weight each book by how many expression measurements it contributed.
const variants = {};
for (const b of perBook) {
  const weight = Math.max(0, b.expressionLexiconSize) + Math.max(0, b.autolingRules);
  if (weight > 0) variants[b.book] = weight;
}
const mc = monte.run({ variants, mutationScale: 0.15, generations: 24, seed: 42 });

const model = {
  label: 'language-contact-retrain-fixed-20261105',
  principle: 'words-are-measurements-of-expression',
  tools: {
    autoling: 'tools/fixed/tool-14-autoling.fixed.js',
    diseminer: 'tools/fixed/tool-15-diseminer.fixed.js',
    monteCarlo: 'tools/fixed/tool-06-historical-monte-carlo.fixed.js',
    languageContact: 'tools/tool-05-language-contact.js',
    publicContact: 'integration/language-contact-models.js#PublicLanguageContactModel',
  },
  booksDir: BOOKS_DIR,
  maxSentencesPerBook: MAX_SENTENCES_PER_BOOK,
  contactRate: CONTACT_RATE,
  generations: GENERATIONS,
  perBook,
  contactTrajectory,
  hostGrammarSize: Object.keys(hostGrammar).length,
  hostExpressionLexiconSize: hostAutoling.expressionLexicon.size,
  hostDiseminerVocab: hostDiseminer.distributionalSpace.size,
  hostDiseminerClaims: hostDiseminer.claims.size,
  monteCarlo: {
    accepted: mc.accepted,
    output: mc.output,
  },
  // Persist a compact host grammar (expression entries + sentence rules).
  hostGrammarSample: Object.fromEntries(Object.entries(hostGrammar).slice(0, 400)),
  topHostExpressions: [...hostAutoling.expressionLexicon.entries()]
    .filter(([, e]) => e.support >= 3)
    .sort((a, b) => b[1].support - a[1].support)
    .slice(0, 80)
    .map(([lemma, e]) => ({ lemma, pos: e.pos, support: e.support })),
};

fs.writeFileSync(path.join(OUT_DIR, 'language-contact-model.fixed.json'), JSON.stringify(model, null, 2));
fs.writeFileSync(path.join(OUT_DIR, 'host-grammar.fixed.json'), JSON.stringify(hostGrammar, null, 2));
fs.writeFileSync(
  path.join(OUT_DIR, 'host-expression-lexicon.fixed.json'),
  JSON.stringify(Object.fromEntries(hostAutoling.expressionLexicon), null, 2),
);

// Contradiction pairs discovered across the host claim memory
const contradictions = [];
for (const [id, claim] of hostDiseminer.claims) {
  if (claim.contradictions?.length) {
    contradictions.push({ id, text: claim.text, contradictions: claim.contradictions });
  }
}
fs.writeFileSync(path.join(OUT_DIR, 'host-contradictions.fixed.json'), JSON.stringify(contradictions.slice(0, 200), null, 2));

console.log(JSON.stringify({
  done: true,
  outDir: OUT_DIR,
  books: perBook.length,
  hostGrammarSize: Object.keys(hostGrammar).length,
  hostExpressions: hostAutoling.expressionLexicon.size,
  monteAccepted: mc.accepted,
  dominantBook: mc.output?.dominantVariant ?? null,
}, null, 2));

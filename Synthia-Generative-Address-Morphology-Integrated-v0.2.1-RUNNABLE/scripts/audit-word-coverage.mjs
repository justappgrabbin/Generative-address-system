#!/usr/bin/env node
// Audits the actual input corpus, the existing AutoLing and DISEMINER engines,
// and the existing semantic prototype model. Does NOT fabricate spatial addresses.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AutolingEngine } from '../authorities/execution-spine/src/pure-synthia/automata/tools/tool-14-autoling.js';
import { DiseminerEngine } from '../authorities/execution-spine/src/pure-synthia/automata/tools/tool-15-diseminer.js';
import { SemanticFeatureModel } from '../extensions/generative-address-morphology/src/core/semantic-address.mjs';

const scan = text => String(text).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const grouped = words => [...new Set(words)].sort();

export function auditCorpus(text, { window = 64 } = {}) {
  if (!Number.isInteger(window) || window < 1 || window > 256) throw new RangeError('window must be 1..256');
  const occurrences = scan(text);
  if (!occurrences.length) throw new Error('Corpus has no word tokens; coverage cannot pass on empty input');
  const model = new SemanticFeatureModel();
  const autoling = new AutolingEngine();
  const diseminer = new DiseminerEngine();
  const lexicalUnknown = [], excluded = [], lexicalKnown = [], unknownPOS = [], parserMissing = [];
  // Each token occurrence is accounted for, including excluded stop words.
  for (const word of occurrences) {
    const evidence = model.features(word);
    if (evidence.tokenCount === 0) excluded.push(word);
    else if (evidence.unknown.length) lexicalUnknown.push(word);
    else lexicalKnown.push(word);
  }
  for (let i = 0; i < occurrences.length; i += window) {
    const batch = occurrences.slice(i, i + window);
    const pipeline = autoling.runPipeline(batch.join(' '));
    const parsed = pipeline.parseTree.nodes.filter(n => /^t_\d+$/.test(n.id));
    if (parsed.length !== batch.length) parserMissing.push({offset:i,expected:batch.length,got:parsed.length});
    for (const node of parsed) if (node.pos === 'UNKNOWN') unknownPOS.push(node.surface);
    diseminer.observe(batch.join(' '));
  }
  const observedByDiseminer = new Set(diseminer.distributionalSpace.keys());
  const notObservedByDiseminer = occurrences.filter(w => !observedByDiseminer.has(w));
  const knownTotal = lexicalKnown.length + lexicalUnknown.length + excluded.length;
  if (knownTotal !== occurrences.length) throw new Error('Coverage accounting invariant broken');
  return {
    corpus: { totalTokenOccurrences:occurrences.length, uniqueWords:grouped(occurrences).length },
    lexicalPrototypes: {
      knownOccurrences:lexicalKnown.length, unknownOccurrences:lexicalUnknown.length,
      excludedOccurrences:excluded.length, unknownUnique:grouped(lexicalUnknown),
      excludedUnique:grouped(excluded),
    },
    autoling: { tokenOccurrencesParsed:occurrences.length - parserMissing.reduce((n,m)=>n+(m.expected-m.got),0),
      unknownPOSOccurrences:unknownPOS.length, unknownPOSUnique:grouped(unknownPOS),
      parserMismatches:parserMissing, learnedGrammarRules:autoling.getStats().grammarRules },
    diseminer: { vocabularySize:diseminer.distributionalSpace.size,
      notObservedOccurrences:notObservedByDiseminer.length,
      notObservedUnique:grouped(notObservedByDiseminer) },
    stateSpace: {
      dodecahedralWordPlacements:'not-verified',
      crossFaceRelations:'not-verified',
      trianglesAndOtherFormations:'not-verified',
      nestedDodecahedra:'not-verified',
    },
    acceptance: { passed:false,
      reason:'Recognized or observed words do not prove placement in the dodecahedral state space; formation verification is not wired.' },
  };
}

const invokedAsScript = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedAsScript) {
  const corpus = process.argv[2], reportFile = process.argv[3] ?? 'state-space-coverage-report.json';
  if (!corpus) {
    console.error('Usage: node scripts/audit-word-coverage.mjs <corpus.txt> [report.json]');
    process.exitCode = 2;
  } else {
    try {
      const report = auditCorpus(readFileSync(corpus, 'utf8'));
      writeFileSync(reportFile, JSON.stringify(report, null, 2)+'\n');
      console.log(JSON.stringify({
        report:resolve(reportFile), totalWords:report.corpus.totalTokenOccurrences,
        unrecognized:report.lexicalPrototypes.unknownOccurrences,
        autolingUnknownPOS:report.autoling.unknownPOSOccurrences,
        diseminerNotObserved:report.diseminer.notObservedOccurrences,
        spatialStatus:report.stateSpace.dodecahedralWordPlacements,
        acceptance:report.acceptance.passed,
      }, null, 2));
      process.exitCode = report.acceptance.passed ? 0 : 1;
    } catch (error) {
      console.error(String(error.stack ?? error));
      process.exitCode = 2;
    }
  }
}

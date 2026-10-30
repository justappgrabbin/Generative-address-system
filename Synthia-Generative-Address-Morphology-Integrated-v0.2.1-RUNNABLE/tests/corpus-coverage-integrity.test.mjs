import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCorpus } from '../scripts/audit-word-coverage.mjs';

test('corpus audit accounts for unknown words and exclusions without calling the dodecahedron complete', () => {
  const report = auditCorpus('Limitation zorbax zorbax the and limitation.');
  assert.equal(report.corpus.totalTokenOccurrences, 6);
  assert.equal(report.lexicalPrototypes.unknownOccurrences, 2);
  assert.deepEqual(report.lexicalPrototypes.unknownUnique, ['zorbax']);
  assert.equal(report.lexicalPrototypes.excludedOccurrences, 2);
  assert.equal(report.autoling.tokenOccurrencesParsed, 6);
  assert.equal(report.acceptance.passed, false);
  assert.equal(report.stateSpace.dodecahedralWordPlacements, 'not-verified');
});

test('AutoLing and DISEMINER observations cannot silently certify a geometric result', () => {
  const report = auditCorpus('Memory shapes structure. Memory creates structure.');
  assert.ok(report.diseminer.vocabularySize > 0);
  assert.equal(report.autoling.parserMismatches.length, 0);
  assert.equal(report.stateSpace.trianglesAndOtherFormations, 'not-verified');
  assert.equal(report.acceptance.passed, false);
});

test('empty corpus is not a passing test fixture', () => {
  assert.throws(() => auditCorpus(' \t\n '), /no word tokens/);
});

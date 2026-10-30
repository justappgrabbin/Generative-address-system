import test from 'node:test';
import assert from 'node:assert/strict';
import { AutolingEngine } from '../authorities/execution-spine/src/pure-synthia/automata/tools/tool-14-autoling.js';
import { DiseminerEngine } from '../authorities/execution-spine/src/pure-synthia/automata/tools/tool-15-diseminer.js';
import { auditCorpus } from '../scripts/audit-word-coverage.mjs';

test('AUTOLING does not merge words delimited by punctuation, including Unicode', () => {
  const source = 'a,b;é!我 7';
  const run = new AutolingEngine().runPipeline(source);
  const tokens = run.parseTree.nodes.filter(n => /^t_\d+$/.test(n.id)).map(n => n.surface);
  assert.deepEqual(tokens, ['a','b','é','我','7']);
  assert.equal(run.morphology.morphemes.length, 5);
});

test('DISEMINER learns short words and Unicode instead of silently dropping them', () => {
  const d = new DiseminerEngine();
  const text = 'a,b;é!我 7';
  assert.deepEqual(d.tokenize(text), ['a','b','é','我','7']);
  const result = d.observe(text);
  assert.equal(result.sense.wordCount, 5);
  assert.equal(d.distributionalSpace.size, 5);
  assert.equal(d.distributionalSpace.get('a').cooccurrence.get('b'), 1);
});

test('corpus audit reports no silently dropped tokens at recognition intake', () => {
  const report = auditCorpus('a,b;é!我 7');
  assert.equal(report.corpus.totalTokenOccurrences, 5);
  assert.equal(report.autoling.tokenOccurrencesParsed, 5);
  assert.equal(report.diseminer.notObservedOccurrences, 0);
  assert.equal(report.acceptance.passed, false, 'observation still is not verified spatial placement');
});

test('DISEMINER tracks a novel word through repeat observation without inventing a face', () => {
  const d = new DiseminerEngine();
  assert.equal(d.observe('zorbax and I').sense.familiar, 0);
  assert.equal(d.observe('zorbax and I').sense.familiar, 1);
  assert.ok(d.distributionalSpace.has('i'));
  assert.ok(d.distributionalSpace.has('and'));
});


test('AUTOLING H2 actually learns replacements across observed identical contexts', () => {
  const engine = new AutolingEngine();
  const first = engine.runPipeline('the blue shape grows');
  assert.equal(first.phraseStructure.newRules.filter(r => !r.isSentenceRule).length, 0);
  const second = engine.runPipeline('the red shape grows');
  const classes = second.phraseStructure.newRules.filter(r => !r.isSentenceRule);
  assert.equal(classes.length, 1);
  assert.deepEqual(classes[0].rhs, ['blue','red']);
  assert.deepEqual(classes[0].evidence.left, ['the']);
  assert.deepEqual(classes[0].evidence.right, ['shape','grows']);
  assert.equal(classes[0].status, 'context-provisional');
  assert.match(classes[0].inference, /NOT verified semantic equivalence/);
  assert.equal(engine.getStats().grammarRules, 3, 'both observed sentences and their contextual class are retained');
  const repeat = engine.runPipeline('the red shape grows');
  assert.equal(repeat.phraseStructure.newRules.length, 0);
});

test('AUTOLING does not confuse similar sentence length with identical context', () => {
  const engine = new AutolingEngine();
  engine.runPipeline('a b c');
  const second = engine.runPipeline('c b a');
  assert.equal(second.phraseStructure.newRules.filter(r => !r.isSentenceRule).length, 0);
  assert.equal(engine.getStats().grammarRules, 2);
});

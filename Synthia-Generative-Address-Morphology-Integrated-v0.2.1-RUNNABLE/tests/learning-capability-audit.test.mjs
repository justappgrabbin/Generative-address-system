// Independent capability audit, 2026-10-30.
// Deliberately NOT a smoke-test suite. These expectations are about observable
// learning, cross-passage reasoning, state-space qualification, and valid sampling.
// This file lives only on the audit branch until its failures are reviewed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AutolingEngine } from '../authorities/execution-spine/src/pure-synthia/automata/tools/tool-14-autoling.js';
import { DiseminerEngine } from '../authorities/execution-spine/src/pure-synthia/automata/tools/tool-15-diseminer.js';
import { HistoricalMonteCarloAutomaton } from '../authorities/execution-spine/src/pure-synthia/automata/tools/tool-06-historical-monte-carlo.js';
import { analyzeStructure } from '../extensions/generative-address-morphology/src/core/structural-space.mjs';

test('CONTROL AUTOLING: first observation creates an initial rule', () => {
  const tool = new AutolingEngine();
  tool.learnPhraseStructure('the hexagram changes');
  assert.ok(tool.getStats().grammarRules > 0);
});

test('CAPABILITY AUTOLING: learns a second distinct sentence instead of stopping at one rule', () => {
  const tool = new AutolingEngine();
  tool.learnPhraseStructure('the hexagram changes');
  const first = tool.getStats().grammarRules;
  tool.learnPhraseStructure('the trigram changes');
  const second = tool.getStats().grammarRules;
  assert.ok(second > first, `new structured observation created no new applicable grammar rule: ${first} -> ${second}`);
});

test('CAPABILITY AUTOLING: repeated contextual examples change classification of domain terms', () => {
  const tool = new AutolingEngine();
  tool.runPipeline('the hexagram changes');
  tool.runPipeline('the trigram changes');
  tool.runPipeline('the hexagram transforms');
  const seenAgain = tool.runPipeline('the hexagram changes');
  const word = seenAgain.parseTree.nodes.find(n => n.surface === 'hexagram');
  assert.ok(word, 'hexagram token not returned');
  assert.notEqual(word.pos, 'UNKNOWN', 'repeated, structured domain term remains unknown');
});

test('CONTROL DISEMINER: repeated passages accumulate persistent contextual observations', () => {
  const tool = new DiseminerEngine();
  tool.observe('hexagram changes and relates trigrams');
  tool.observe('trigrams connect hexagram families');
  assert.ok(tool.distributionalSpace.get('hexagram').contexts.length >= 2);
});

test('CAPABILITY DISEMINER: contradiction is linked across successive passages', () => {
  const tool = new DiseminerEngine();
  const original = tool.extractClaims('Pattern connects meaning.', 'passage-one')[0];
  const correction = tool.extractClaims('Pattern does not connect meaning.', 'passage-two')[0];
  assert.ok(original && correction, 'the two statements must have been extracted');
  assert.ok(
    correction.contradictions.includes(original.id) || original.contradictions.includes(correction.id),
    `cross-passage contradiction not linked (original=${original.id}, correction=${correction.id})`,
  );
});

test('CAPABILITY DISEMINER: CJK terms are not silently dropped from Yijing text', () => {
  const tool = new DiseminerEngine();
  const result = tool.observe('乾 坤 陰 陽');
  assert.equal(result.sense.wordCount, 4, 'four source terms were silently dropped by tokenization');
});

test('CONTROL STATE SPACE: named source fields can be matched', () => {
  const result = analyzeStructure('Mind');
  assert.ok(result.matches.some(m => m.dimension === 'Evolution'));
});

test('CAPABILITY STATE SPACE: a learned, dimension-anchored relation participates in resolving its term', () => {
  const recognition = {
    status: 'executed',
    runs: [],
    issues: [],
    graph: {
      nodes: [],
      relations: [{ from: 'Evolution', to: 'Design', label: 'hexagram', source: 'autoling', kind: 'tool-recognized-rule' }],
    },
  };
  const result = analyzeStructure('Mind hexagram', { recognition });
  assert.ok(result.space.interactions.some(r => r.label === 'hexagram'), 'recognized graph was not received');
  assert.ok(
    !result.unresolvedTokens.some(t => t.value === 'hexagram'),
    'dimension-anchored learned relationship was received, yet term remains unresolved without reason',
  );
});

test('CONTROL MONTE CARLO: zero mutation preserves normalized variant weights', () => {
  const output = new HistoricalMonteCarloAutomaton().run({
    variants: { one: 3, two: 1 }, mutationScale: 0, generations: 10, seed: 23,
  }).output;
  assert.deepEqual(output.finalWeights, { one: 0.75, two: 0.25 });
});

test('CAPABILITY MONTE CARLO: negative weights never produce accepted probabilities', () => {
  const result = new HistoricalMonteCarloAutomaton().run({
    variants: { positive: 2, impossible: -1 }, mutationScale: 0, generations: 2, seed: 23,
  });
  if (result.accepted) {
    assert.ok(
      Object.values(result.output.finalWeights).every(w => Number.isFinite(w) && w >= 0 && w <= 1),
      `accepted invalid probability distribution: ${JSON.stringify(result.output.finalWeights)}`,
    );
  }
});

test('CAPABILITY MONTE CARLO: empty hypotheses cannot be declared a successful sample', () => {
  const result = new HistoricalMonteCarloAutomaton().run({
    variants: {}, mutationScale: 0, generations: 3, seed: 23,
  });
  assert.ok(
    !result.accepted || result.output?.ok === false || result.output?.status === 'no-evidence',
    'the Monte Carlo tool reported success without any variant to sample',
  );
});

test('CONTROL MONTE CARLO: identical seeds and inputs reproduce exactly', () => {
  const input = { variants: { one: 3, two: 1 }, mutationScale: 0.2, generations: 12, seed: 42 };
  const a = new HistoricalMonteCarloAutomaton().run(input).output;
  const b = new HistoricalMonteCarloAutomaton().run(input).output;
  assert.deepEqual(a, b);
});

// Intentional scope limit: historical weight drift is NOT yarrow-stalk casting.
// Rutt's 1/16, 3/16, 5/16, 7/16 yarrow probabilities cannot honestly be verified
// against this algorithm. Audit the actual Tanit reader yarrow implementation separately.

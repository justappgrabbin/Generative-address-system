import test from 'node:test';
import assert from 'node:assert/strict';
import Engine from '../src/engine.mjs';
import { SemanticAddressGenerator, SemanticFeatureModel, cosine } from '../src/core/semantic-address.mjs';
import { MorphologyCompiler } from '../src/graph/morphology-compiler.mjs';
import { normalizeAddress } from '../src/core/address.mjs';

test('unseen prose creates validated addresses and a channel graph from an empty registry', () => {
  const engine = new Engine({ weightsFile: null });
  const out = engine.run([], { subject: { text: 'Innovation ordering limitation acceptance' } });
  assert.equal(out.generation.status, 'generated');
  assert.ok(out.addresses.some(a => a.gate === 3));
  assert.ok(out.addresses.some(a => a.gate === 60));
  assert.ok(out.connections.some(c => c.channel.gates.includes(3) && c.channel.gates.includes(60)));
  assert.ok(out.graphs.length > 0);
  for (const a of out.addresses) {
    assert.equal(a.source, 'semantic-address-generator');
    assert.ok(a.semantic.derivation.matchedFeatures.length);
    assert.ok(a.semantic.similarity > 0);
    assert.equal(engine.generator.registry.has(a.id), true);
    assert.throws(() => { a.semantic.vector['meaning:tampered'] = 1; }, TypeError);
  }
});

test('morphological variants preserve meaning; unrelated input changes it', () => {
  const generator = new SemanticAddressGenerator();
  const singular = generator.generate('innovation limitation');
  const plural = generator.generate('innovations limitations!');
  assert.deepEqual(singular.addresses.map(a => a.id), plural.addresses.map(a => a.id));
  assert.ok(Math.abs(cosine(singular.vector, plural.vector) - 1) < 1e-12);
  const other = generator.generate('memory love light');
  assert.equal(cosine(singular.vector, other.vector), 0);
  assert.equal(other.addresses[0].dimension, 'Evolution');
  assert.notEqual(singular.addresses[0].id, other.addresses[0].id);
});

test('new combinations get distinct identities even at the same coordinates', () => {
  const generator = new SemanticAddressGenerator();
  const a = generator.generate('limitation').addresses.find(a => a.gate === 60);
  const b = generator.generate('limitation acceptance').addresses.find(a => a.gate === 60);
  assert.ok(a && b);
  assert.notEqual(a.id, b.id);
  assert.equal(generator.registry.has(a.id), true);
  assert.equal(generator.registry.has(b.id), true);
});

test('unsupported text stays unresolved; teaching a concept enables generation without an address', () => {
  const model = new SemanticFeatureModel();
  const generator = new SemanticAddressGenerator({ model });
  assert.equal(generator.generate('zorbax').status, 'unresolved');
  model.teach('zorbax', { 'meaning:innovation': 1, 'meaning:limitation': 1 });
  const out = generator.generate('zorbax');
  assert.equal(out.status, 'generated');
  assert.ok(out.addresses.some(a => a.gate === 3));
  assert.ok(out.addresses.some(a => a.gate === 60));
  assert.throws(() => model.teach('bad', { 'meaning:innovation': NaN }), /finite/);
});

test('Boolean ATO completes a novel analogy in named semantic features', () => {
  const generator = new SemanticAddressGenerator();
  const out = generator.generate({ analogy: {
    a: { 'meaning:innovation': 1 },
    b: { 'meaning:innovation': 1, 'meaning:limitation': 1 },
    c: { 'meaning:acceptance': 1 },
  } });
  assert.deepEqual(out.vector, { 'meaning:acceptance': 1, 'meaning:limitation': 1 });
  assert.ok(out.addresses.some(a => a.gate === 60));
  assert.equal(out.analogy.mode, 'xor');
  assert.ok(out.addresses.every(a => a.semantic.derivation.analogy));
});

test('morphology depends on measured features, never channel names or IDs', () => {
  const a = normalizeAddress({ planetary: 1, dimension: 'Design', gate: 3, semantic: { vector: { innovation: 1 } } });
  const b = normalizeAddress({ planetary: 1, dimension: 'Design', gate: 60, semantic: { vector: { innovation: 1 } } });
  const compiler = new MorphologyCompiler();
  const first = compiler.compile({ id: 'one', a, b, channel: { id: '3-60', name: 'Mutation', energy: 'MUTATION' } });
  const renamed = compiler.compile({ id: 'two', a, b, channel: { id: 'another', name: 'Unrelated label', energy: 'MUTATION' } });
  assert.deepEqual(first.parameters, renamed.parameters);
  assert.equal(first.parameters.similarity, 1);
  const different = compiler.compile({ id: 'three', a, b: { ...b, semantic: { vector: { limitation: 1 } } }, channel: { id: '3-60', energy: 'MUTATION' } });
  assert.equal(different.parameters.similarity, 0);
  assert.notDeepEqual(first.execute(), different.execute());
});

test('probe generation cannot mutate the live registry or learned model', () => {
  const engine = new Engine({ weightsFile: null });
  engine.generator.model.teach('zorbax', { 'meaning:innovation': 1 });
  const probe = engine.fork();
  assert.equal(probe.generate('zorbax').status, 'generated');
  assert.equal(engine.generator.registry.size, 0);
  probe.generator.model.teach('otherword', { 'meaning:limitation': 1 });
  assert.equal(engine.generator.model.concepts.has('otherword'), false);
});

test('explicit addresses keep their coordinates and empty input has no fabricated address', () => {
  const engine = new Engine({ weightsFile: null });
  const out = engine.run([{ id: 'manual', planetary: 1, dimension: 'Being', gate: 3 }], { subject: 'limitation' });
  assert.equal(out.generation, null);
  assert.equal(out.addresses.length, 1);
  assert.equal(out.addresses[0].id, 'manual');
  assert.equal(engine.run([], { subject: '' }).generation.status, 'unresolved');
});

test('mixed recognized and unknown words report partial coverage, not successful complete recognition', () => {
  const generator = new SemanticAddressGenerator();
  const result = generator.generate('limitation zorbax zorbax');
  assert.ok(result.addresses.length > 0, 'known evidence can still propose candidates');
  assert.equal(result.status, 'partial');
  assert.equal(result.coverage.inputTokenOccurrences, 3);
  assert.equal(result.coverage.recognizedTokenOccurrences, 1);
  assert.equal(result.coverage.unrecognizedTokenOccurrences, 2);
  assert.deepEqual(result.coverage.unrecognizedTokens, ['zorbax', 'zorbax']);
  assert.equal(result.coverage.semanticComplete, false);
  assert.equal(result.coverage.spatialPlacementVerified, false);
  assert.equal(result.coverage.completed, false);
  assert.match(result.reason, /remain unrecognized/);
});

test('recognizing all prototype words still does not falsely certify spatial placement', () => {
  const generator = new SemanticAddressGenerator();
  const result = generator.generate('limitation');
  assert.equal(result.status, 'generated');
  assert.equal(result.coverage.unrecognizedTokenOccurrences, 0);
  assert.equal(result.coverage.semanticComplete, true);
  assert.equal(result.coverage.spatialPlacementVerified, false);
  assert.equal(result.coverage.completed, false);
});

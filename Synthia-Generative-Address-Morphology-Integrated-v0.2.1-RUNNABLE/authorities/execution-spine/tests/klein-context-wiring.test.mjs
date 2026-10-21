import test from 'node:test';
import assert from 'node:assert/strict';
import { SynthiaSystem } from '../src/synthia-system.mjs';

test('boot wiring witnesses a live Klein context evaluation and wraps every mounted automaton', () => {
  const synthia = new SynthiaSystem();
  const audit = synthia.wiringAudit();
  assert.equal(audit.ok, true);
  assert.equal(audit.kleinContextRuntime, true);
  assert.equal(audit.kleinMissingOperators.length, 0);
  assert.equal(audit.kleinOperatorCoverage, audit.mountedAutomata);
  assert.ok(audit.kleinWitnessedEvaluations >= 1);
  const boot = synthia.klein.last();
  assert.ok(boot);
  assert.equal(boot.witnessed, true);
  assert.deepEqual(Object.keys(boot.result).sort(), ['direction', 'intensity', 'relation']);
});

test('engine.call cannot bypass Klein: derivation carries witnessed joint evaluation', () => {
  const synthia = new SynthiaSystem();
  const before = synthia.klein.ledger().length;
  const derivation = synthia.engine.call('autoling "when x then y" then conversation "hello"');
  assert.ok(derivation.kleinEvaluation);
  assert.equal(derivation.evaluation.kleinEvaluationId, derivation.kleinEvaluation.evaluationId);
  assert.deepEqual(derivation.kleinEvaluation.activeToolIds, ['autoling', 'conversation']);
  assert.match(derivation.kleinEvaluation.result.relation ?? '', /^joint:autoling~conversation:/);
  assert.equal(synthia.klein.ledger().length, before + 1);
  assert.ok(derivation.relations.some((r) => r.operator === 'klein-context'));
});

test('identical Klein context collapses deterministically and is logged append-only', () => {
  const synthia = new SynthiaSystem();
  const request = {
    nodeId: 'test:determinism',
    eventType: 'test',
    invocations: [
      { toolId: 'diseminer', input: { operation: 'observe', text: 'same context' } },
      { toolId: 'conversation', input: { text: 'same context', contributions: ['same'] } },
    ],
    context: { fixture: 1 },
  };
  const a = synthia.klein.evaluate(request);
  const b = synthia.klein.evaluate(request);
  assert.notEqual(a.evaluationId, b.evaluationId);
  assert.equal(a.contextHash, b.contextHash);
  assert.deepEqual(a.result, b.result);
  assert.equal(a.deterministicAfterCollapse, true);
  assert.equal(b.deterministicAfterCollapse, true);
});

test('deep contact loop is a real mesh path and its surface receives the joint Klein result', async () => {
  const synthia = new SynthiaSystem();
  const before = synthia.klein.ledger().length;
  const result = await synthia.chat('compare this contact pattern with a second grammar', {
    grammarB: { R1: 'peer-rule' },
  });
  assert.equal(result.contact.mode, 'deep-klein-contact-loop');
  assert.ok(result.contact.kleinEvaluation);
  assert.equal(result.contact.transport.delivered, true);
  assert.equal(result.contact.transport.receipts.length, 5);
  assert.ok(result.contact.kleinEvaluation.activeToolIds.includes('diseminer'));
  assert.ok(result.contact.kleinEvaluation.activeToolIds.includes('language-contact'));
  assert.ok(result.contact.kleinEvaluation.activeToolIds.includes('historical-monte-carlo'));
  assert.ok(result.contact.kleinEvaluation.activeToolIds.includes('autoling'));
  assert.ok(result.contact.kleinEvaluation.activeToolIds.includes('computational-grammar-coder'));
  assert.ok(result.contact.kleinEvaluation.activeToolIds.includes('conversation'));
  assert.ok(synthia.klein.ledger().length > before);
  assert.ok(synthia.engine.triples({ predicate: 'isA', object: 'KleinContextEvaluation' }).length >= 2);

  for (const [from, to] of result.contact.transport.path) {
    const crossing = synthia.channels.get(from, to);
    assert.ok(crossing, `${from} -> ${to} should be a witnessed crossing`);
    assert.ok(crossing.uses >= 1);
  }
});

test('structured internal invoke cannot bypass intake or Klein', () => {
  const synthia = new SynthiaSystem();
  const d = synthia.engine.invoke('diseminer', { operation: 'observe', text: 'structured input' });
  assert.equal(d.parse.kind, 'direct-invoke');
  assert.ok(d.intakeId);
  assert.ok(d.kleinEvaluation);
  assert.equal(d.kleinEvaluation.activeToolIds[0], 'diseminer');
  assert.equal(d.evaluation.kleinEvaluationId, d.kleinEvaluation.evaluationId);
  assert.ok(synthia.engine.triples({ predicate: 'processedBy', object: 'diseminer' }).length >= 1);
});

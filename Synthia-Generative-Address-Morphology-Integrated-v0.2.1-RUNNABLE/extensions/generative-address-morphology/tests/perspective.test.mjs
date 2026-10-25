import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptPerspective, createPerspectiveState, evaluatePerspective } from '../src/core/perspective.mjs';
import { GenerativeAddressMorphologyEngine } from '../src/engine.mjs';

const values = { freedom: 4, security: 4 };
const lexicon = { open: { freedom: 4, security: -2 }, grounded: { freedom: -1, security: 5 } };

test('the same numbers acquire different values through different words', () => {
  const person = createPerspectiveState({ person: 'adaya', lexicon });
  const open = evaluatePerspective(person, { values, words: 'open' });
  const grounded = evaluatePerspective(person, { values, words: 'grounded' });
  assert.deepEqual(open.effectiveValues, { freedom: 8, security: 2 });
  assert.deepEqual(grounded.effectiveValues, { freedom: 3, security: 9 });
  assert.notDeepEqual(open.proportions, grounded.proportions);
  assert.deepEqual(open.baseValues, values);
});

test('the same words and numbers remain personal to each perspective', () => {
  const a = createPerspectiveState({ person: 'a', lexicon: { open: { freedom: 5 } } });
  const b = createPerspectiveState({ person: 'b', lexicon: { open: { security: 7 } } });
  const va = evaluatePerspective(a, { values, words: 'open' });
  const vb = evaluatePerspective(b, { values, words: 'open' });
  assert.deepEqual(va.effectiveValues, { freedom: 9, security: 4 });
  assert.deepEqual(vb.effectiveValues, { freedom: 4, security: 11 });
  assert.equal(b.lexicon.open.freedom, undefined);
});

test('different positions produce different proportions of perspective', () => {
  const person = createPerspectiveState({
    person: 'adaya',
    positions: { inner: { freedom: 8 }, outer: { security: 12 } },
  });
  const inner = evaluatePerspective(person, { values, position: 'inner' });
  const outer = evaluatePerspective(person, { values, position: 'outer' });
  assert.deepEqual(inner.proportions, { freedom: 12 / 16, security: 4 / 16 });
  assert.deepEqual(outer.proportions, { freedom: 4 / 20, security: 16 / 20 });
});

test('unknown words do not invent value before feedback', () => {
  const person = createPerspectiveState({ person: 'adaya' });
  const result = evaluatePerspective(person, { values, words: 'unfamiliar' });
  assert.deepEqual(result.effectiveValues, values);
  assert.deepEqual(result.unknownWords, ['unfamiliar']);
});

test('explicit feedback adapts personal word effects without mutating history', () => {
  const person = createPerspectiveState({ person: 'adaya' });
  const original = evaluatePerspective(person, { values, words: 'open' });
  const adapted = adaptPerspective(person, {
    values,
    words: 'open',
    observedValues: { freedom: 8, security: 2 },
    learningRate: 1,
  });
  assert.equal(person.revision, 0);
  assert.equal(person.lexicon.open, undefined);
  assert.equal(adapted.state.revision, 1);
  assert.deepEqual(adapted.after.effectiveValues, { freedom: 8, security: 2 });
  assert.notDeepEqual(adapted.after.proportions, original.proportions);
  assert.deepEqual(adapted.after.baseValues, values);
  assert.equal(adapted.event.previousEvent, null);
});

test('successive adaptations form a personal provenance chain', () => {
  const person = createPerspectiveState({ person: 'adaya' });
  const first = adaptPerspective(person, { values, words: 'open', observedValues: { freedom: 6 }, learningRate: 0.5 });
  const second = adaptPerspective(first.state, { values, words: 'open', observedValues: { freedom: 7 }, learningRate: 0.5 });
  assert.equal(second.state.revision, 2);
  assert.equal(second.event.previousEvent, first.event.id);
  assert.equal(second.state.position, 'default');
});

test('live engine evaluates and adapts isolated user perspectives', () => {
  const engine = new GenerativeAddressMorphologyEngine({ weightsFile: null });
  const person = engine.perspectiveState({ person: 'adaya' });
  const adapted = engine.adaptPerspective(person, {
    values,
    words: 'open',
    observedValues: { freedom: 7, security: 3 },
    learningRate: 1,
  });
  const other = engine.perspectiveState({ person: 'other' });
  const personal = engine.evaluatePerspective(adapted.state, { values, words: 'open' });
  const unaffected = engine.evaluatePerspective(other, { values, words: 'open' });
  assert.deepEqual(personal.effectiveValues, { freedom: 7, security: 3 });
  assert.deepEqual(unaffected.effectiveValues, values);
});

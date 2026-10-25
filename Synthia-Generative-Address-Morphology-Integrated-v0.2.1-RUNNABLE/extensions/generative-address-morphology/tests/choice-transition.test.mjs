import test from 'node:test';
import assert from 'node:assert/strict';
import { applyChoice, choiceStateDigest, createChoiceState } from '../src/core/choice-transition.mjs';

const address = gate => ({ planetary: 1, dimension: 1, gate, line: 1, color: 1, tone: 1, base: 1, degree: 0, minute: 0, second: 0, arcsecond: 0, zodiac: 1, house: 1 });

test('a choice creates a new addressed revision without mutating its predecessor', () => {
  const initial = createChoiceState({ address: address(1), values: { energy: 10 }, modes: { node: 'MC' } });
  const originalDigest = choiceStateDigest(initial);
  const { state, event } = applyChoice(initial, {
    connection: 'channel:test',
    nextAddress: address(2),
    valueOperations: [{ op: 'add', key: 'experience', amount: 1 }],
    modeChanges: { node: 'DFF' },
  });
  assert.equal(initial.revision, 0);
  assert.equal(initial.values.experience, undefined);
  assert.equal(initial.modes.node, 'MC');
  assert.equal(choiceStateDigest(initial), originalDigest);
  assert.equal(state.revision, 1);
  assert.equal(state.address.gate, 2);
  assert.equal(state.values.energy, 10);
  assert.equal(state.values.experience, 1);
  assert.equal(state.modes.node, 'DFF');
  assert.equal(event.previousEvent, null);
  assert.equal(state.lastEvent, event.id);
});

test('connections can trade values while preserving the transferred total', () => {
  const initial = createChoiceState({ address: address(3), values: { left: 8, right: 2 } });
  const { state } = applyChoice(initial, {
    connection: 'channel:trade',
    valueOperations: [{ op: 'transfer', from: 'left', to: 'right', amount: 3 }],
  });
  assert.deepEqual(state.values, { left: 5, right: 5 });
});

test('successive choices form an append-only provenance chain', () => {
  const initial = createChoiceState({ address: address(4) });
  const first = applyChoice(initial, { connection: 'channel:a', valueOperations: [{ op: 'set', key: 'score', value: 2 }] });
  const second = applyChoice(first.state, { connection: 'channel:b', valueOperations: [{ op: 'add', key: 'score', amount: 5 }] });
  assert.equal(second.event.previousEvent, first.event.id);
  assert.equal(second.event.previousState, choiceStateDigest(first.state));
  assert.equal(second.state.values.score, 7);
  assert.equal(second.state.revision, 2);
});

test('identical choices are deterministic and different connections are distinct', () => {
  const initial = createChoiceState({ address: address(5) });
  const choice = { connection: 'channel:a', valueOperations: [{ op: 'add', key: 'count', amount: 1 }] };
  const a = applyChoice(initial, choice);
  const b = applyChoice(initial, choice);
  const c = applyChoice(initial, { ...choice, connection: 'channel:b' });
  assert.equal(a.event.id, b.event.id);
  assert.notEqual(a.event.id, c.event.id);
});

test('choices cannot fabricate coordinates or use non-finite values', () => {
  const initial = createChoiceState({ address: address(6) });
  const missing = address(7);
  delete missing.tone;
  assert.throws(() => applyChoice(initial, { connection: 'channel:a', nextAddress: missing }), /tone is unresolved/);
  assert.throws(() => applyChoice(initial, { connection: 'channel:a', valueOperations: [{ op: 'add', key: 'bad', amount: Infinity }] }), /finite/);
  assert.throws(() => applyChoice(initial, { valueOperations: [] }), /selected connection/);
});

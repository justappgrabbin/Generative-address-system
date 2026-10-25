import test from 'node:test';
import assert from 'node:assert/strict';
import { GenerativeAddressMorphologyEngine } from '../src/engine.mjs';

const address = { planetary: 1, dimension: 1, gate: 20, line: 1, color: 1, tone: 1, base: 1, degree: 0, minute: 0, second: 0, arcsecond: 0, zodiac: 1, house: 1 };

test('live engine exposes the additive numeric address and choice contracts', () => {
  const engine = new GenerativeAddressMorphologyEngine({ weightsFile: null });
  const index = engine.numericAddressIndex(address);
  assert.deepEqual(engine.numericAddress(index).coordinates, address);
  assert.equal(engine.numericAddressContract().schema, 'morph-numeric-address-v1');
  const initial = engine.choiceState({ address });
  const { state } = engine.choose(initial, { connection: 'channel:test', valueOperations: [{ op: 'add', key: 'activation', amount: 1 }] });
  assert.equal(state.values.activation, 1);
});

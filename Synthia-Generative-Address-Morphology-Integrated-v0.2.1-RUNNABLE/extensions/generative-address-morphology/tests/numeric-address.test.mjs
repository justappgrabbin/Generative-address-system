import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NUMERIC_ADDRESS_CAPACITY,
  NUMERIC_COORDINATE_ORDER,
  decodeNumericAddress,
  encodeNumericAddress,
  numericAddressKey,
  numericAddressSnapshot,
  validateNumericAddress,
} from '../src/core/numeric-address.mjs';

const minimum = () => ({ planetary: 1, dimension: 1, gate: 1, line: 1, color: 1, tone: 1, base: 1, degree: 0, minute: 0, second: 0, arcsecond: 0, zodiac: 1, house: 1 });
const maximum = () => ({ planetary: 13, dimension: 5, gate: 64, line: 6, color: 6, tone: 6, base: 5, degree: 29, minute: 59, second: 59, arcsecond: 99, zodiac: 12, house: 12 });

test('numeric contract contains all thirteen coordinates in the requested order', () => {
  assert.deepEqual(NUMERIC_COORDINATE_ORDER, ['planetary', 'dimension', 'gate', 'line', 'color', 'tone', 'base', 'degree', 'minute', 'second', 'arcsecond', 'zodiac', 'house']);
  assert.equal(NUMERIC_ADDRESS_CAPACITY, 6987202560000000n);
  assert.equal(numericAddressSnapshot().dimensions[0].label, 'Movement');
  assert.equal(numericAddressSnapshot().dimensions[4].label, 'Space');
});

test('mixed-radix encoding round-trips boundary and interior addresses', () => {
  const interior = { ...minimum(), planetary: 12, dimension: 4, gate: 34, line: 2, color: 3, tone: 5, base: 4, degree: 17, minute: 42, second: 8, arcsecond: 73, zodiac: 9, house: 7 };
  for (const address of [minimum(), interior, maximum()]) {
    const index = encodeNumericAddress(address);
    assert.deepEqual(decodeNumericAddress(index).coordinates, address);
    assert.equal(encodeNumericAddress(decodeNumericAddress(index)), index);
  }
  assert.equal(encodeNumericAddress(minimum()), 0n);
  assert.equal(encodeNumericAddress(maximum()), NUMERIC_ADDRESS_CAPACITY - 1n);
});

test('numeric identity is independent of object key order', () => {
  const address = maximum();
  assert.equal(numericAddressKey(address), numericAddressKey(Object.fromEntries(Object.entries(address).reverse())));
});

test('every coordinate rejects fractions and out-of-range values', () => {
  for (const [index, field] of NUMERIC_COORDINATE_ORDER.entries()) {
    const fractional = minimum();
    fractional[field] += 0.5;
    assert.throws(() => validateNumericAddress(fractional), new RegExp(`${field} must be an integer`));
    const outside = minimum();
    outside[field] = index < 7 || field === 'zodiac' || field === 'house' ? 0 : -1;
    assert.throws(() => validateNumericAddress(outside), new RegExp(field));
  }
  assert.throws(() => validateNumericAddress({ ...minimum(), planetary: 14 }), /planetary/);
  assert.throws(() => validateNumericAddress({ ...minimum(), arcsecond: 100 }), /arcsecond/);
});

test('partial validation leaves missing values unresolved instead of defaulting them', () => {
  const partial = minimum();
  delete partial.base;
  delete partial.arcsecond;
  assert.throws(() => validateNumericAddress(partial), /base is unresolved/);
  const result = validateNumericAddress(partial, { requireComplete: false });
  assert.equal(result.complete, false);
  assert.equal(result.coordinates.base, null);
  assert.equal(result.coordinates.arcsecond, null);
  assert.equal(result.provenance.base.status, 'unresolved');
});

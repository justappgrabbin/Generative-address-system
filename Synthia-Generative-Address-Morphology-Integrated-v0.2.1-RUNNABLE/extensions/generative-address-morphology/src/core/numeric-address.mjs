import { DIMENSIONS } from './strict-address.mjs';

export const NUMERIC_ADDRESS_SCHEMA = 'morph-numeric-address-v1';
export const NUMERIC_COORDINATE_ORDER = Object.freeze([
  'planetary', 'dimension', 'gate', 'line', 'color', 'tone', 'base',
  'degree', 'minute', 'second', 'arcsecond', 'zodiac', 'house',
]);

// User-supplied starting contract. These ranges describe representational
// capacity; they do not assert that every coordinate has an established meaning.
export const NUMERIC_RADICES = Object.freeze({
  planetary: 13, dimension: 5, gate: 64, line: 6, color: 6, tone: 6,
  base: 5, degree: 30, minute: 60, second: 60, arcsecond: 100,
  zodiac: 12, house: 12,
});
export const NUMERIC_ADDRESS_CAPACITY = NUMERIC_COORDINATE_ORDER.reduce(
  (capacity, field) => capacity * BigInt(NUMERIC_RADICES[field]), 1n,
);

const ONE_BASED = new Set(['planetary', 'dimension', 'gate', 'line', 'color', 'tone', 'base', 'zodiac', 'house']);
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const present = value => value !== null && value !== undefined && value !== '';
const offset = field => ONE_BASED.has(field) ? 1 : 0;
const clone = value => value == null ? value : structuredClone(value);
const freezeTree = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
};

function validateCoordinate(field, value, errors) {
  if (!Number.isInteger(value)) {
    errors.push(`${field} must be an integer`);
    return;
  }
  const minimum = offset(field);
  const maximum = minimum + NUMERIC_RADICES[field] - 1;
  if (value < minimum || value > maximum) errors.push(`${field} must be in ${minimum}..${maximum}`);
}

/** Validate only supplied coordinates; unresolved coordinates are never invented. */
export function validateNumericAddress(raw, { requireComplete = true } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Numeric address must be an object');
  const source = raw.coordinates ?? raw;
  const errors = [];
  for (const field of NUMERIC_COORDINATE_ORDER) {
    const value = source[field];
    if (!present(value)) {
      if (requireComplete) errors.push(`${field} is unresolved`);
      continue;
    }
    validateCoordinate(field, value, errors);
  }
  if (errors.length) throw new TypeError(`Invalid numeric address: ${errors.join('; ')}`);
  const coordinates = Object.fromEntries(NUMERIC_COORDINATE_ORDER.map(field => [field, present(source[field]) ? source[field] : null]));
  const provenance = Object.fromEntries(NUMERIC_COORDINATE_ORDER.map(field => [field, {
    status: present(coordinates[field]) ? 'supplied' : 'unresolved',
    source: present(coordinates[field]) ? (raw.source ?? null) : null,
  }]));
  return freezeTree({
    schema: NUMERIC_ADDRESS_SCHEMA,
    coordinates,
    provenance,
    complete: NUMERIC_COORDINATE_ORDER.every(field => present(coordinates[field])),
  });
}

/** Mixed-radix, lossless encoding. The returned BigInt is never a storage hash. */
export function encodeNumericAddress(raw) {
  const record = validateNumericAddress(raw);
  let index = 0n;
  for (const field of NUMERIC_COORDINATE_ORDER) {
    index = index * BigInt(NUMERIC_RADICES[field]) + BigInt(record.coordinates[field] - offset(field));
  }
  return index;
}

export function decodeNumericAddress(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new RangeError('Use a BigInt or decimal string for large indexes');
  let remaining;
  try { remaining = BigInt(value); } catch { throw new TypeError('Address index must be an integer'); }
  if (remaining < 0n || remaining >= NUMERIC_ADDRESS_CAPACITY) throw new RangeError('Address index outside numeric address space');
  const coordinates = {};
  for (const field of [...NUMERIC_COORDINATE_ORDER].reverse()) {
    const radix = BigInt(NUMERIC_RADICES[field]);
    coordinates[field] = Number(remaining % radix) + offset(field);
    remaining /= radix;
  }
  return validateNumericAddress({ ...Object.fromEntries(NUMERIC_COORDINATE_ORDER.map(field => [field, coordinates[field]])), source: 'decoded-numeric-index' });
}

export function numericAddressKey(raw) {
  const record = validateNumericAddress(raw);
  return `morph1://${NUMERIC_COORDINATE_ORDER.map(field => record.coordinates[field]).join('.')}`;
}

export function numericAddressSnapshot() {
  return freezeTree({
    schema: NUMERIC_ADDRESS_SCHEMA,
    order: [...NUMERIC_COORDINATE_ORDER],
    radices: clone(NUMERIC_RADICES),
    dimensions: DIMENSIONS.map((label, index) => ({ value: index + 1, label })),
    capacity: String(NUMERIC_ADDRESS_CAPACITY),
    indexing: 'mixed-radix; zero-based encoded index; lossless BigInt',
    interpretation: 'representational capacity, not a count of validated meanings',
  });
}

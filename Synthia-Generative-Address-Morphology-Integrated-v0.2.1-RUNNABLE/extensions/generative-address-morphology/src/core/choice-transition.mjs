import { createHash } from 'node:crypto';
import { validateNumericAddress } from './numeric-address.mjs';

export const CHOICE_STATE_SCHEMA = 'morph-choice-state-v1';
const VALID_KEY = /^(?!__proto__$|prototype$|constructor$)[A-Za-z][A-Za-z0-9_.:-]{0,127}$/;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clone = value => value == null ? value : structuredClone(value);
const freezeTree = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
};

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

function digest(value) {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function validateValues(values = {}) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new TypeError('values must be a named numeric object');
  for (const [key, value] of Object.entries(values)) {
    if (!VALID_KEY.test(key)) throw new TypeError(`Invalid value key: ${key}`);
    if (!finite(value)) throw new TypeError(`Value ${key} must be finite`);
  }
  return Object.fromEntries(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
}

function validateModes(modes = {}) {
  if (!modes || typeof modes !== 'object' || Array.isArray(modes)) throw new TypeError('modes must be a named string object');
  for (const [key, value] of Object.entries(modes)) {
    if (!VALID_KEY.test(key) || typeof value !== 'string' || !value.length) throw new TypeError(`Invalid mode register: ${key}`);
  }
  return Object.fromEntries(Object.entries(modes).sort(([a], [b]) => a.localeCompare(b)));
}

export function createChoiceState({ address, values = {}, modes = {}, context = null } = {}) {
  const numeric = validateNumericAddress(address);
  return freezeTree({
    schema: CHOICE_STATE_SCHEMA,
    revision: 0,
    address: numeric.coordinates,
    addressProvenance: numeric.provenance,
    values: validateValues(values),
    modes: validateModes(modes),
    context: clone(context),
    lastEvent: null,
  });
}

function applyValueOperation(values, operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw new TypeError('Invalid value operation');
  if (operation.op === 'add') {
    if (!VALID_KEY.test(operation.key) || !finite(operation.amount)) throw new TypeError('add requires a valid key and finite amount');
    values[operation.key] = (values[operation.key] ?? 0) + operation.amount;
  } else if (operation.op === 'set') {
    if (!VALID_KEY.test(operation.key) || !finite(operation.value)) throw new TypeError('set requires a valid key and finite value');
    values[operation.key] = operation.value;
  } else if (operation.op === 'transfer') {
    if (!VALID_KEY.test(operation.from) || !VALID_KEY.test(operation.to) || !finite(operation.amount) || operation.amount < 0)
      throw new TypeError('transfer requires valid from/to keys and a nonnegative finite amount');
    values[operation.from] = (values[operation.from] ?? 0) - operation.amount;
    values[operation.to] = (values[operation.to] ?? 0) + operation.amount;
  } else {
    throw new RangeError(`Unsupported value operation: ${operation.op}`);
  }
  if (!finite(values[operation.key ?? operation.to] ?? NaN)) throw new RangeError('Value operation produced a non-finite result');
}

/** Apply an explicit connection-selected choice without mutating the prior state. */
export function applyChoice(state, choice = {}) {
  if (!state || state.schema !== CHOICE_STATE_SCHEMA || !Number.isInteger(state.revision) || state.revision < 0)
    throw new TypeError('State must be created by createChoiceState or applyChoice');
  validateNumericAddress(state.address);
  validateValues(state.values);
  validateModes(state.modes);
  if (typeof choice.connection !== 'string' || !choice.connection.length) throw new TypeError('A choice requires the selected connection');

  const nextAddress = validateNumericAddress(choice.nextAddress ?? state.address);
  const values = clone(state.values);
  const operations = choice.valueOperations ?? [];
  if (!Array.isArray(operations)) throw new TypeError('valueOperations must be an array');
  for (const operation of operations) applyValueOperation(values, operation);

  const modes = clone(state.modes);
  const requestedModes = choice.modeChanges ?? {};
  if (!requestedModes || typeof requestedModes !== 'object' || Array.isArray(requestedModes)) throw new TypeError('modeChanges must be an object');
  for (const [key, value] of Object.entries(requestedModes)) {
    if (!VALID_KEY.test(key) || typeof value !== 'string' || !value.length) throw new TypeError(`Invalid mode change: ${key}`);
    modes[key] = value;
  }

  const next = {
    schema: CHOICE_STATE_SCHEMA,
    revision: state.revision + 1,
    address: nextAddress.coordinates,
    addressProvenance: nextAddress.provenance,
    values: validateValues(values),
    modes: validateModes(modes),
    context: choice.context === undefined ? clone(state.context) : clone(choice.context),
    lastEvent: null,
  };
  const eventBody = {
    schema: 'morph-choice-event-v1',
    revision: next.revision,
    previousEvent: state.lastEvent,
    previousState: digest({ ...state, context: state.context ?? null }),
    connection: choice.connection,
    fromAddress: clone(state.address),
    toAddress: clone(next.address),
    valueOperations: clone(operations),
    modeChanges: clone(requestedModes),
    resultingState: digest(next),
    context: clone(choice.context ?? null),
  };
  const event = freezeTree({ id: `choice-${digest(eventBody)}`, ...eventBody });
  next.lastEvent = event.id;
  return freezeTree({ state: freezeTree(next), event });
}

export function choiceStateDigest(state) {
  if (!state || state.schema !== CHOICE_STATE_SCHEMA) throw new TypeError('Invalid choice state');
  return digest(state);
}

import { createHash } from 'node:crypto';

export const PERSPECTIVE_STATE_SCHEMA = 'morph-perspective-state-v1';
export const PERSPECTIVE_VALUE_POLICY = 'additive-personal-effects/positive-part-proportions-v1';
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
const stable = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
};
const digest = value => createHash('sha256').update(stable(value)).digest('hex');

export function perspectiveTokens(input = []) {
  const parts = Array.isArray(input) ? input : [input];
  if (parts.some(part => typeof part !== 'string')) throw new TypeError('words must be a string or an array of strings');
  return parts.flatMap(part => part.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function namedString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a nonempty string`);
  return value.trim();
}

function validateValues(values = {}, { allowEmpty = true } = {}) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new TypeError('values must be a named numeric object');
  const entries = Object.entries(values);
  if (!allowEmpty && !entries.length) throw new TypeError('values cannot be empty');
  for (const [key, value] of entries) {
    if (!VALID_KEY.test(key)) throw new TypeError(`Invalid value key: ${key}`);
    if (!finite(value)) throw new TypeError(`Value ${key} must be finite`);
  }
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

function validateLexicon(lexicon = {}) {
  if (!lexicon || typeof lexicon !== 'object' || Array.isArray(lexicon)) throw new TypeError('lexicon must be an object');
  const result = {};
  for (const [surface, effects] of Object.entries(lexicon)) {
    const tokens = perspectiveTokens(surface);
    if (tokens.length !== 1 || tokens[0] !== surface.normalize('NFKC').toLowerCase()) throw new TypeError(`Lexicon key must be one normalized word: ${surface}`);
    result[tokens[0]] = validateValues(effects);
  }
  return result;
}

function validatePositions(positions = {}) {
  if (!positions || typeof positions !== 'object' || Array.isArray(positions)) throw new TypeError('positions must be an object');
  return Object.fromEntries(Object.entries(positions).map(([position, effects]) => [namedString(position, 'position'), validateValues(effects)]));
}

function assertState(state) {
  if (!state || state.schema !== PERSPECTIVE_STATE_SCHEMA || !Number.isInteger(state.revision) || state.revision < 0)
    throw new TypeError('Invalid perspective state');
  namedString(state.person, 'person');
  namedString(state.position, 'position');
  validateLexicon(state.lexicon);
  validatePositions(state.positions);
}

export function createPerspectiveState({ person, position = 'default', lexicon = {}, positions = {}, context = null } = {}) {
  const state = {
    schema: PERSPECTIVE_STATE_SCHEMA,
    person: namedString(person, 'person'),
    position: namedString(position, 'position'),
    revision: 0,
    lexicon: validateLexicon(lexicon),
    positions: validatePositions(positions),
    context: clone(context),
    lastEvent: null,
  };
  return freezeTree(state);
}

function addEffects(target, effects, scale = 1) {
  for (const [key, value] of Object.entries(effects)) {
    if (!Object.prototype.hasOwnProperty.call(target, key)) throw new RangeError(`Effect refers to unknown value register: ${key}`);
    target[key] += scale * value;
  }
}

/** Evaluate one numeric state through one person's current semantic position. */
export function evaluatePerspective(state, { values, words = [], position = state?.position } = {}) {
  assertState(state);
  const baseValues = validateValues(values, { allowEmpty: false });
  const activeWords = perspectiveTokens(words);
  const activePosition = namedString(position, 'position');
  const effectiveValues = clone(baseValues);
  const unknownWords = [...new Set(activeWords.filter(word => !Object.prototype.hasOwnProperty.call(state.lexicon, word)))];
  for (const word of activeWords) if (state.lexicon[word]) addEffects(effectiveValues, state.lexicon[word]);
  const positionEffect = state.positions[activePosition] ?? {};
  addEffects(effectiveValues, positionEffect);
  if (!Object.values(effectiveValues).every(finite)) throw new RangeError('Perspective evaluation produced a non-finite value');

  // This explicit reference policy does not claim to be a universal value law.
  // Negative effective values remain visible but contribute zero to proportions.
  const positive = Object.fromEntries(Object.entries(effectiveValues).map(([key, value]) => [key, Math.max(0, value)]));
  const total = Object.values(positive).reduce((sum, value) => sum + value, 0);
  const proportions = Object.fromEntries(Object.entries(positive).map(([key, value]) => [key, total > 0 ? value / total : 0]));
  return freezeTree({
    schema: 'morph-perspective-valuation-v1',
    policy: PERSPECTIVE_VALUE_POLICY,
    person: state.person,
    perspectiveRevision: state.revision,
    position: activePosition,
    activeWords,
    unknownWords,
    baseValues,
    effectiveValues: validateValues(effectiveValues),
    proportions,
    proportionStatus: total > 0 ? 'resolved' : 'unresolved-nonpositive-total',
  });
}

/** Personal delta-rule adaptation from explicit observed values, never inferred feedback. */
export function adaptPerspective(state, { values, words = [], position = state?.position, observedValues, learningRate = 0.1 } = {}) {
  assertState(state);
  if (!finite(learningRate) || learningRate <= 0 || learningRate > 1) throw new RangeError('learningRate must be in (0,1]');
  const activePosition = namedString(position, 'position');
  const activeWords = perspectiveTokens(words);
  const uniqueWords = [...new Set(activeWords)];
  const before = evaluatePerspective(state, { values, words: activeWords, position: activePosition });
  const observed = validateValues(observedValues, { allowEmpty: false });
  for (const key of Object.keys(observed)) if (!Object.prototype.hasOwnProperty.call(before.effectiveValues, key))
    throw new RangeError(`Observed value refers to unknown register: ${key}`);

  const lexicon = clone(state.lexicon);
  const positions = clone(state.positions);
  for (const word of uniqueWords) lexicon[word] = lexicon[word] ?? {};
  positions[activePosition] = positions[activePosition] ?? {};
  const divisor = uniqueWords.length + 1;
  const errors = {};
  for (const [key, target] of Object.entries(observed)) {
    const error = target - before.effectiveValues[key];
    const delta = learningRate * error / divisor;
    errors[key] = error;
    for (const word of uniqueWords) lexicon[word][key] = (lexicon[word][key] ?? 0) + delta;
    positions[activePosition][key] = (positions[activePosition][key] ?? 0) + delta;
  }
  const next = {
    ...clone(state),
    position: activePosition,
    revision: state.revision + 1,
    lexicon: validateLexicon(lexicon),
    positions: validatePositions(positions),
    lastEvent: null,
  };
  const after = evaluatePerspective(next, { values, words: activeWords, position: activePosition });
  const eventBody = {
    schema: 'morph-perspective-adaptation-v1',
    person: state.person,
    revision: next.revision,
    previousEvent: state.lastEvent,
    previousState: digest(state),
    position: activePosition,
    activeWords,
    observedValues: observed,
    learningRate,
    errors,
    resultingState: digest(next),
  };
  const event = freezeTree({ id: `perspective-${digest(eventBody)}`, ...eventBody });
  next.lastEvent = event.id;
  return freezeTree({ state: freezeTree(next), event, before, after });
}

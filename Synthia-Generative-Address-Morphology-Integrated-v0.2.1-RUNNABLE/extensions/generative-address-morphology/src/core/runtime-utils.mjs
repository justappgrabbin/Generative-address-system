import { createHash } from 'node:crypto';

export const clone = value => value == null ? value : structuredClone(value);

export function freezeTree(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export function stable(value) {
  if (value === undefined) return '"[undefined]"';
  if (typeof value === 'bigint') return JSON.stringify(`${value}n`);
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

export const digest = value => createHash('sha256').update(stable(value)).digest('hex');

export function namedString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a nonempty string`);
  return value.trim();
}

export function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

export function jsonClone(value, name = 'value') {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError(`${name} must be JSON-serializable`);
    return JSON.parse(serialized);
  } catch (error) {
    throw new TypeError(`${name} must be JSON-serializable: ${error.message}`);
  }
}

export function provenanceEvent(schema, revision, previousEvent, body) {
  const eventBody = { ...clone(body), schema, revision, previousEvent: previousEvent ?? null };
  return freezeTree({ id: `${schema}-${digest(eventBody)}`, ...eventBody });
}

export function assertProvenanceChain(events, lastEvent, revision) {
  if (!Array.isArray(events) || events.length !== revision) throw new TypeError('Invalid provenance length or revision');
  let previous = null;
  events.forEach((event, index) => {
    plainObject(event, 'provenance event');
    if (event.revision !== index + 1 || event.previousEvent !== previous)
      throw new TypeError(`Broken provenance link at revision ${index + 1}`);
    const { id, ...body } = event;
    if (id !== `${event.schema}-${digest(body)}`) throw new TypeError(`Invalid provenance digest at revision ${index + 1}`);
    previous = id;
  });
  if ((lastEvent ?? null) !== previous) throw new TypeError('Last event does not match provenance chain');
  return true;
}

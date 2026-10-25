import { adaptPerspective, createPerspectiveState, evaluatePerspective, perspectiveTokens } from './perspective.mjs';
import { applyChoice, createChoiceState } from './choice-transition.mjs';
import { assertProvenanceChain, clone, freezeTree, digest, jsonClone, namedString, plainObject, provenanceEvent } from './runtime-utils.mjs';

export const SOCIAL_WORLD_SCHEMA = 'morph-social-world-v1';
const clamp01 = value => Math.max(0, Math.min(1, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const byId = (items, id) => items.find(item => item.id === id);
const relationshipOf = (world, from, to) => world.relationships.find(r => r.from === from && r.to === to);

function assertWorld(world) {
  if (!world || world.schema !== SOCIAL_WORLD_SCHEMA || !Number.isInteger(world.revision) || world.revision < 0)
    throw new TypeError('Invalid social world');
}

function nextWorld(world, changes, schema, body) {
  const revision = world.revision + 1;
  const event = provenanceEvent(schema, revision, world.lastEvent, body);
  return freezeTree({
    ...clone(world),
    ...changes,
    revision,
    lastEvent: event.id,
    events: [...world.events, event],
  });
}

export function createSocialWorld({ maxAgents = 64, maxMessagesPerTick = 64, context = null } = {}) {
  if (!Number.isInteger(maxAgents) || maxAgents < 1) throw new RangeError('maxAgents must be a positive integer');
  if (!Number.isInteger(maxMessagesPerTick) || maxMessagesPerTick < 1) throw new RangeError('maxMessagesPerTick must be a positive integer');
  return freezeTree({
    schema: SOCIAL_WORLD_SCHEMA,
    revision: 0,
    tick: 0,
    agents: [],
    relationships: [],
    queue: [],
    events: [],
    settings: { maxAgents, maxMessagesPerTick },
    context: jsonClone(context, 'context'),
    lastEvent: null,
  });
}

export function addSocialAgent(world, specification = {}) {
  assertWorld(world);
  plainObject(specification, 'agent');
  const id = namedString(specification.id ?? specification.person, 'agent id');
  if (byId(world.agents, id)) throw new RangeError(`Agent already exists: ${id}`);
  if (world.agents.length >= world.settings.maxAgents) throw new RangeError('Social agent capacity reached');
  const agent = freezeTree({
    id,
    status: 'active',
    choice: createChoiceState({
      address: specification.address,
      values: specification.values,
      modes: specification.modes,
      context: specification.context ?? null,
    }),
    perspective: createPerspectiveState({
      person: id,
      position: specification.position ?? 'default',
      lexicon: specification.lexicon ?? {},
      positions: specification.positions ?? {},
      context: specification.perspectiveContext ?? null,
    }),
  });
  return nextWorld(world, { agents: [...world.agents, agent] }, 'social-agent-added-v1', {
    agent: id,
    address: agent.choice.address,
  });
}

export function removeSocialAgent(world, agentId) {
  assertWorld(world);
  const id = namedString(agentId, 'agent id');
  if (!byId(world.agents, id)) throw new RangeError(`Unknown agent: ${id}`);
  return nextWorld(world, {
    agents: world.agents.filter(agent => agent.id !== id),
    relationships: world.relationships.filter(r => r.from !== id && r.to !== id),
    queue: world.queue.filter(message => message.from !== id && message.to !== id),
  }, 'social-agent-removed-v1', { agent: id });
}

export function connectSocialAgents(world, { from, to, connection, importance = 0.5 } = {}) {
  assertWorld(world);
  from = namedString(from, 'from');
  to = namedString(to, 'to');
  connection = namedString(connection, 'connection');
  if (from === to) throw new RangeError('A social connection requires two different agents');
  if (!byId(world.agents, from) || !byId(world.agents, to)) throw new RangeError('Both agents must exist before connection');
  if (relationshipOf(world, from, to)) throw new RangeError('Directed social connection already exists');
  if (!finite(importance) || importance < 0 || importance > 1) throw new RangeError('importance must be in [0,1]');
  const relationship = freezeTree({ from, to, connection, importance, history: [] });
  return nextWorld(world, { relationships: [...world.relationships, relationship] }, 'social-connection-added-v1', {
    from, to, connection, importance,
  });
}

export function queueSocialMessage(world, specification = {}) {
  assertWorld(world);
  const from = namedString(specification.from, 'from');
  const to = namedString(specification.to, 'to');
  const relationship = relationshipOf(world, from, to);
  if (!relationship) throw new RangeError('A directed social connection is required before messaging');
  const words = perspectiveTokens(specification.words ?? []);
  if (!words.length) throw new TypeError('A social message requires at least one word');
  if (specification.observedValues != null) plainObject(specification.observedValues, 'observedValues');
  if (specification.choice != null) plainObject(specification.choice, 'choice');
  const messageBody = {
    from, to, words,
    position: specification.position ?? null,
    observedValues: clone(specification.observedValues ?? null),
    learningRate: specification.learningRate ?? 0.1,
    importanceDelta: specification.importanceDelta ?? 0,
    choice: clone(specification.choice ?? null),
  };
  if (!finite(messageBody.learningRate) || messageBody.learningRate <= 0 || messageBody.learningRate > 1)
    throw new RangeError('learningRate must be in (0,1]');
  if (!finite(messageBody.importanceDelta)) throw new TypeError('importanceDelta must be finite');
  const message = freezeTree({ id: `social-message-${digest({ worldRevision: world.revision, queueLength: world.queue.length, ...messageBody })}`, ...messageBody });
  const next = nextWorld(world, { queue: [...world.queue, message] }, 'social-message-queued-v1', {
    message: message.id, from, to, connection: relationship.connection,
  });
  return { world: next, message };
}

/** Select words from one agent's own lexicon to approach intended numeric values. */
export function expressSocialIntent(perspective, { baseValues, targetValues, position = perspective?.position, maxWords = 3 } = {}) {
  if (!Number.isInteger(maxWords) || maxWords < 0 || maxWords > 16) throw new RangeError('maxWords must be an integer in 0..16');
  plainObject(targetValues, 'targetValues');
  if (!Object.keys(targetValues).length) throw new TypeError('targetValues cannot be empty');
  const candidates = Object.keys(perspective.lexicon).sort((a, b) => a.localeCompare(b));
  const selected = [];
  let current = evaluatePerspective(perspective, { values: baseValues, words: selected, position });
  const distance = valuation => Object.entries(targetValues).reduce((sum, [key, target]) => {
    if (!finite(target) || !Object.prototype.hasOwnProperty.call(valuation.effectiveValues, key))
      throw new RangeError(`Unknown or invalid target register: ${key}`);
    return sum + (valuation.effectiveValues[key] - target) ** 2;
  }, 0);
  let bestDistance = distance(current);
  while (selected.length < maxWords) {
    let best = null;
    for (const word of candidates) {
      if (selected.includes(word)) continue;
      const words = [...selected, word];
      const valuation = evaluatePerspective(perspective, { values: baseValues, words, position });
      const candidateDistance = distance(valuation);
      if (candidateDistance < bestDistance - Number.EPSILON && (!best || candidateDistance < best.distance - Number.EPSILON))
        best = { word, words, valuation, distance: candidateDistance };
    }
    if (!best) break;
    selected.push(best.word);
    current = best.valuation;
    bestDistance = best.distance;
  }
  return freezeTree({ words: selected, valuation: current, squaredError: bestDistance });
}

export function queueSocialIntent(world, specification = {}) {
  const sender = byId(world.agents, namedString(specification.from, 'from'));
  if (!sender) throw new RangeError(`Unknown agent: ${specification.from}`);
  const expression = expressSocialIntent(sender.perspective, {
    baseValues: sender.choice.values,
    targetValues: specification.targetValues,
    position: specification.position ?? sender.perspective.position,
    maxWords: specification.maxWords ?? 3,
  });
  if (!expression.words.length) throw new RangeError('No private expression improves the intended value');
  return { ...queueSocialMessage(world, { ...specification, words: expression.words }), expression };
}

/** Deliver a bounded queue slice. Explicit feedback alone updates durable personal semantics. */
export function stepSocialWorld(world, { maxMessages = world?.settings?.maxMessagesPerTick } = {}) {
  assertWorld(world);
  if (!Number.isInteger(maxMessages) || maxMessages < 0 || maxMessages > world.settings.maxMessagesPerTick)
    throw new RangeError(`maxMessages must be an integer in 0..${world.settings.maxMessagesPerTick}`);
  const processing = world.queue.slice(0, maxMessages);
  const deliveries = [];
  let agents = clone(world.agents);
  let relationships = clone(world.relationships);

  for (const message of processing) {
    const sender = byId(agents, message.from);
    const recipient = byId(agents, message.to);
    const relationship = relationshipOf({ relationships }, message.from, message.to);
    if (!sender || !recipient || !relationship) throw new RangeError(`Dangling social message: ${message.id}`);
    const position = message.position ?? recipient.perspective.position;
    const senderValuation = evaluatePerspective(sender.perspective, {
      values: sender.choice.values, words: message.words, position,
    });
    const before = evaluatePerspective(recipient.perspective, {
      values: sender.choice.values, words: message.words, position,
    });
    let adapted = null;
    if (message.observedValues) {
      adapted = adaptPerspective(recipient.perspective, {
        values: sender.choice.values,
        words: message.words,
        position,
        observedValues: message.observedValues,
        learningRate: message.learningRate,
      });
      recipient.perspective = adapted.state;
    }
    let choiceTransition = null;
    if (message.choice) {
      choiceTransition = applyChoice(recipient.choice, { ...message.choice, connection: relationship.connection });
      recipient.choice = choiceTransition.state;
    }
    relationship.importance = clamp01(relationship.importance + message.importanceDelta);
    const deliveryBody = {
      message: message.id,
      tick: world.tick + 1,
      from: message.from,
      to: message.to,
      connection: relationship.connection,
      words: message.words,
      position,
      senderValuation,
      recipientBefore: before,
      recipientAfter: adapted?.after ?? before,
      perspectiveEvent: adapted?.event.id ?? null,
      choiceEvent: choiceTransition?.event.id ?? null,
      relationshipImportance: relationship.importance,
    };
    const delivery = freezeTree({ id: `social-delivery-${digest(deliveryBody)}`, ...deliveryBody });
    relationship.history = [...relationship.history, delivery.id];
    deliveries.push(delivery);
  }

  if (!processing.length) return freezeTree({ world, deliveries });
  const next = nextWorld(world, {
    agents,
    relationships,
    queue: world.queue.slice(processing.length),
    tick: world.tick + 1,
  }, 'social-world-tick-v1', {
    tick: world.tick + 1,
    delivered: deliveries.map(delivery => delivery.id),
    remaining: world.queue.length - processing.length,
  });
  return freezeTree({ world: next, deliveries });
}

export function restoreSocialWorld(snapshot) {
  const world = jsonClone(snapshot, 'social world');
  if (world.schema !== SOCIAL_WORLD_SCHEMA) throw new TypeError('Invalid social world snapshot');
  // Re-execute structural validation before accepting persisted input.
  let checked = createSocialWorld({ ...world.settings, context: world.context });
  for (const agent of world.agents) {
    if (agent.status !== 'active') throw new TypeError('Unsupported persisted agent status');
    checked = addSocialAgent(checked, {
      id: agent.id,
      address: agent.choice.address,
      values: agent.choice.values,
      modes: agent.choice.modes,
      context: agent.choice.context,
      position: agent.perspective.position,
      lexicon: agent.perspective.lexicon,
      positions: agent.perspective.positions,
      perspectiveContext: agent.perspective.context,
    });
  }
  for (const relationship of world.relationships) checked = connectSocialAgents(checked, relationship);
  if (!Number.isInteger(world.revision) || world.revision < checked.revision || !Number.isInteger(world.tick) || world.tick < 0)
    throw new TypeError('Invalid persisted social revision or tick');
  if (!Array.isArray(world.queue)) throw new TypeError('Invalid persisted social queue');
  assertProvenanceChain(world.events, world.lastEvent, world.revision);
  for (const message of world.queue) {
    plainObject(message, 'queued message');
    namedString(message.id, 'queued message id');
    // Validate all message fields and require a live directed connection.
    queueSocialMessage(checked, message);
  }
  return freezeTree(world);
}

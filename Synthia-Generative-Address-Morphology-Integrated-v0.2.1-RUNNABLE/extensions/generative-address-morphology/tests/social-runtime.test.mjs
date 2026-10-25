import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addSocialAgent,
  connectSocialAgents,
  createSocialWorld,
  expressSocialIntent,
  queueSocialIntent,
  queueSocialMessage,
  removeSocialAgent,
  restoreSocialWorld,
  stepSocialWorld,
} from '../src/core/social-runtime.mjs';

const address = gate => ({
  planetary: 1, dimension: 1, gate, line: 1, color: 1, tone: 1, base: 1,
  degree: 0, minute: 0, second: 0, arcsecond: 0, zodiac: 1, house: 1,
});

function worldWithAgents() {
  let world = createSocialWorld({ maxAgents: 3, maxMessagesPerTick: 1 });
  world = addSocialAgent(world, {
    id: 'a', address: address(1), values: { freedom: 4, security: 4 },
    lexicon: { open: { freedom: 4, security: -2 } },
  });
  world = addSocialAgent(world, {
    id: 'b', address: address(2), values: { energy: 2 },
    lexicon: { open: { freedom: -1, security: 5 } },
  });
  return world;
}

test('social setup preserves canonical state and requires explicit directed connections', () => {
  const empty = createSocialWorld();
  const world = worldWithAgents();
  assert.equal(empty.revision, 0);
  assert.equal(world.agents.length, 2);
  assert.deepEqual(world.agents[0].choice.address, address(1));
  assert.throws(() => queueSocialMessage(world, { from: 'a', to: 'b', words: 'open' }), /connection/);
});

test('one social expression produces different personal values without cross-user adaptation', () => {
  let world = worldWithAgents();
  world = connectSocialAgents(world, { from: 'a', to: 'b', connection: 'channel:1-2' });
  const queued = queueSocialMessage(world, { from: 'a', to: 'b', words: 'open' });
  const original = queued.world;
  const { world: next, deliveries } = stepSocialWorld(queued.world);
  assert.equal(original.queue.length, 1);
  assert.equal(next.queue.length, 0);
  assert.deepEqual(deliveries[0].senderValuation.effectiveValues, { freedom: 8, security: 2 });
  assert.deepEqual(deliveries[0].recipientBefore.effectiveValues, { freedom: 3, security: 9 });
  assert.equal(next.agents[0].perspective.revision, 0);
  assert.equal(next.agents[1].perspective.revision, 0);
});

test('observed social feedback adapts only the recipient and messages can select immutable choices', () => {
  let world = worldWithAgents();
  world = connectSocialAgents(world, { from: 'a', to: 'b', connection: 'channel:1-2', importance: 0.5 });
  const { world: queued } = queueSocialMessage(world, {
    from: 'a', to: 'b', words: 'open',
    observedValues: { freedom: 3, security: 9 }, learningRate: 1,
    importanceDelta: 0.25,
    choice: {
      connection: 'attempted-override', nextAddress: address(3),
      valueOperations: [{ op: 'add', key: 'energy', amount: 3 }],
      modeChanges: { social: 'LSM' },
    },
  });
  const { world: next, deliveries } = stepSocialWorld(queued);
  const [sender, recipient] = next.agents;
  assert.equal(recipient.perspective.revision, 1);
  assert.equal(sender.perspective.revision, 0);
  assert.deepEqual(deliveries[0].recipientAfter.effectiveValues, { freedom: 3, security: 9 });
  assert.deepEqual(recipient.choice.address, address(3));
  assert.equal(recipient.choice.values.energy, 5);
  assert.equal(recipient.choice.modes.social, 'LSM');
  assert.equal(recipient.choice.revision, 1);
  assert.equal(next.relationships[0].importance, 0.75);
  assert.equal(next.events.at(-1).previousEvent, queued.lastEvent);
});

test('private inverse vocabulary selects an expression that approaches intended values', () => {
  const world = worldWithAgents();
  const agent = world.agents[0];
  const expression = expressSocialIntent(agent.perspective, {
    baseValues: agent.choice.values,
    targetValues: { freedom: 8, security: 2 },
  });
  assert.deepEqual(expression.words, ['open']);
  assert.equal(expression.squaredError, 0);
});

test('intent queue and bounded scheduler retain excess work without inventing expressions', () => {
  let world = worldWithAgents();
  world = connectSocialAgents(world, { from: 'a', to: 'b', connection: 'channel:1-2' });
  const first = queueSocialIntent(world, {
    from: 'a', to: 'b', targetValues: { freedom: 8, security: 2 },
  });
  const second = queueSocialMessage(first.world, { from: 'a', to: 'b', words: 'open' });
  const tick = stepSocialWorld(second.world);
  assert.deepEqual(first.expression.words, ['open']);
  assert.equal(tick.deliveries.length, 1);
  assert.equal(tick.world.queue.length, 1);
  assert.equal(tick.world.tick, 1);
  assert.throws(() => queueSocialIntent(tick.world, {
    from: 'a', to: 'b', targetValues: { security: 99 },
  }), /No private expression/);
});

test('world persistence and dissolution leave no dangling relationships or queued deliveries', () => {
  let world = worldWithAgents();
  world = connectSocialAgents(world, { from: 'a', to: 'b', connection: 'channel:1-2' });
  world = queueSocialMessage(world, { from: 'a', to: 'b', words: 'open' }).world;
  const restored = restoreSocialWorld(JSON.parse(JSON.stringify(world)));
  assert.deepEqual(restored, world);
  const removed = removeSocialAgent(restored, 'b');
  assert.equal(removed.relationships.length, 0);
  assert.equal(removed.queue.length, 0);
  assert.equal(removed.agents.length, 1);
});

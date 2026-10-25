import test from 'node:test';
import assert from 'node:assert/strict';
import { GenerativeAddressMorphologyEngine } from '../src/engine.mjs';

const address = gate => ({
  planetary: 1, dimension: 1, gate, line: 1, color: 1, tone: 1, base: 1,
  degree: 0, minute: 0, second: 0, arcsecond: 0, zodiac: 1, house: 1,
});

function assertChain(events, lastEvent) {
  let previous = null;
  events.forEach((event, index) => {
    assert.equal(event.revision, index + 1);
    assert.equal(event.previousEvent, previous);
    previous = event.id;
  });
  assert.equal(lastEvent, previous);
}

test('live engine connects intent, social valuation, immutable choice, and independently verified execution', async () => {
  const engine = new GenerativeAddressMorphologyEngine({ weightsFile: null });
  let world = engine.socialWorld({ maxMessagesPerTick: 2 });
  world = engine.addSocialAgent(world, {
    id: 'guide', address: address(1), values: { freedom: 4, security: 4 },
    lexicon: { open: { freedom: 4, security: -2 } },
  });
  world = engine.addSocialAgent(world, {
    id: 'adaya', address: address(2), values: { energy: 2 },
    lexicon: { open: { freedom: -1, security: 5 } },
  });
  world = engine.connectSocialAgents(world, { from: 'guide', to: 'adaya', connection: 'channel:1-2' });
  const queued = engine.queueSocialIntent(world, {
    from: 'guide', to: 'adaya', targetValues: { freedom: 8, security: 2 },
    observedValues: { freedom: 3, security: 9 }, learningRate: 1,
    choice: { nextAddress: address(3), valueOperations: [{ op: 'add', key: 'energy', amount: 1 }] },
  });
  const social = engine.stepSocialWorld(queued.world);
  const recipient = social.world.agents.find(agent => agent.id === 'adaya');
  assert.deepEqual(queued.expression.words, ['open']);
  assert.equal(recipient.perspective.revision, 1);
  assert.deepEqual(recipient.choice.address, address(3));
  assert.equal(recipient.choice.values.energy, 3);
  assertChain(social.world.events, social.world.lastEvent);

  const completionTest = ({ observation, choice }) => observation?.ready === true && choice.address.gate === 4;
  const mission = engine.mission({
    id: 'continue-social-choice', goal: 'Continue from the socially selected state',
    address: recipient.choice.address, values: recipient.choice.values,
    capabilities: ['simulation.advance'], maxSteps: 1, completionTest,
  });
  const runner = engine.missionRunner({
    actuators: {
      advance: {
        requiredCapability: 'simulation.advance',
        execute: () => ({ observation: { ready: true }, choice: { nextAddress: address(4) } }),
      },
    },
    planner: engine.sequencePlanner([{ type: 'advance' }]),
  });
  const result = await engine.runMission(runner, mission);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.mission.choice.address, address(4));
  assert.equal(result.mission.choice.values.energy, 3);
  assertChain(result.mission.events, result.mission.lastEvent);
  const restored = engine.restoreMission(engine.missionSnapshot(result.mission), { completionTest });
  assert.deepEqual(restored.observation, { ready: true });
});

test('snapshot restoration rejects broken provenance and dangling social messages', async () => {
  const engine = new GenerativeAddressMorphologyEngine({ weightsFile: null });
  let world = engine.socialWorld();
  world = engine.addSocialAgent(world, { id: 'a', address: address(1) });
  world = engine.addSocialAgent(world, { id: 'b', address: address(2) });
  world = engine.connectSocialAgents(world, { from: 'a', to: 'b', connection: 'channel:1-2' });
  world = engine.queueSocialMessage(world, { from: 'a', to: 'b', words: 'hello' }).world;
  const snapshot = JSON.parse(JSON.stringify(world));
  snapshot.events[0].address.gate = 64;
  assert.throws(() => engine.restoreSocialWorld(snapshot), /digest/);
  const dangling = JSON.parse(JSON.stringify(world));
  dangling.queue[0].to = 'missing';
  assert.throws(() => engine.restoreSocialWorld(dangling), /connection|agent/);

  const mission = engine.mission({
    id: 'tamper-check', goal: 'Check provenance', address: address(1),
    completionTest: () => false, maxSteps: 0,
  });
  const result = await engine.runMission(engine.missionRunner({ planner: async () => null }), mission);
  const missionState = JSON.parse(JSON.stringify(engine.missionSnapshot(result.mission)));
  missionState.events[0].complete = true;
  assert.throws(() => engine.restoreMission(missionState, { completionTest: () => true }), /digest/);
});

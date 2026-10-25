import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMission,
  createMissionRunner,
  createSequencePlanner,
  missionSnapshot,
  restoreMission,
  runMission,
} from '../src/core/mission-runtime.mjs';

const address = gate => ({
  planetary: 1, dimension: 1, gate, line: 1, color: 1, tone: 1, base: 1,
  degree: 0, minute: 0, second: 0, arcsecond: 0, zodiac: 1, house: 1,
});
const reached = ({ observation }) => observation?.reached === true;

function mission(overrides = {}) {
  return createMission({
    id: 'reach-target', goal: 'Reach the observed target', address: address(1),
    capabilities: ['world.move'], completionTest: reached, maxSteps: 2, ...overrides,
  });
}

test('host execution succeeds only when independent observation satisfies the mission predicate', async () => {
  let calls = 0;
  const runner = createMissionRunner({
    actuators: {
      move: {
        requiredCapability: 'world.move',
        execute: () => {
          calls += 1;
          return {
            observation: { reached: true },
            choice: {
              nextAddress: address(2),
              valueOperations: [{ op: 'add', key: 'experience', amount: 1 }],
              modeChanges: { executor: 'MC' },
            },
          };
        },
      },
    },
    planner: createSequencePlanner([{ type: 'move', input: { target: 'x' } }]),
  });
  const result = await runMission(runner, mission());
  assert.equal(result.status, 'completed');
  assert.equal(result.steps, 1);
  assert.equal(calls, 1);
  assert.equal(result.mission.choice.revision, 1);
  assert.deepEqual(result.mission.choice.address, address(2));
  assert.equal(result.mission.choice.values.experience, 1);
  assert.equal(result.mission.choice.modes.executor, 'MC');
  assert.equal(result.mission.events.at(-1).complete, true);
});

test('a planner cannot declare completion without an observed predicate match', async () => {
  const runner = createMissionRunner({
    planner: createSequencePlanner([{ type: 'done', claimed: 'complete' }]),
  });
  const result = await runMission(runner, mission(), { initialObservation: { reached: false } });
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'actuator-unavailable');
  assert.equal(result.observation.reached, false);
  assert.ok(result.mission.events.some(event => event.schema === 'mission-actuator-unavailable-v1'));
});

test('capabilities are exact, fail closed, and wildcards are rejected', async () => {
  let called = false;
  const runner = createMissionRunner({
    actuators: { move: { requiredCapability: 'world.move', execute: () => { called = true; } } },
    planner: createSequencePlanner([{ type: 'move' }]),
  });
  const denied = await runMission(runner, mission({ capabilities: ['world.read'] }));
  assert.equal(denied.status, 'failed');
  assert.equal(denied.reason, 'capability-denied');
  assert.equal(called, false);
  assert.throws(() => mission({ capabilities: ['*'] }), /Wildcard/);
});

test('actuator failures are explicit observations in the provenance chain', async () => {
  const runner = createMissionRunner({
    actuators: { move: { requiredCapability: 'world.move', execute: () => { throw new Error('device offline'); } } },
    planner: createSequencePlanner([{ type: 'move' }]),
  });
  const result = await runMission(runner, mission());
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'actuator-failed');
  assert.match(result.mission.events.at(-1).message, /device offline/);
});

test('observation-dependent planning adapts its next action within a bounded budget', async () => {
  const observations = [{ reached: false, distance: 2 }, { reached: false, distance: 1 }, { reached: true, distance: 0 }, { reached: true, distance: 0 }];
  const runner = createMissionRunner({
    actuators: {
      move: { requiredCapability: 'world.move', execute: () => observations.shift() },
    },
    planner: async ({ observation, step }) => ({ type: 'move', input: { distance: observation.distance, step } }),
  });
  const result = await runMission(runner, mission({ maxSteps: 3 }), {
    initialObservation: { reached: false, distance: 3 },
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.steps, 3);
  const proposals = result.mission.events.filter(event => event.schema === 'mission-action-proposed-v1');
  assert.deepEqual(proposals.map(event => event.action.input.distance), [3, 2, 1]);
});

test('exhaustion and already-complete observations never trigger unnecessary host actions', async () => {
  let calls = 0;
  const runner = createMissionRunner({
    actuators: { move: { requiredCapability: 'world.move', execute: () => { calls += 1; return { reached: false }; } } },
    planner: createSequencePlanner([{ type: 'move' }]),
  });
  const exhausted = await runMission(runner, mission({ maxSteps: 1 }));
  assert.equal(exhausted.reason, 'budget-exhausted');
  assert.equal(calls, 1);
  const complete = await runMission(runner, mission(), { initialObservation: { reached: true } });
  assert.equal(complete.status, 'completed');
  assert.equal(complete.steps, 0);
  assert.equal(calls, 1);
});

test('mission snapshots preserve execution history but require explicit verifier rebinding', async () => {
  const runner = createMissionRunner({
    actuators: { move: { requiredCapability: 'world.move', execute: () => ({ reached: true }) } },
    planner: createSequencePlanner([{ type: 'move' }]),
  });
  const result = await runMission(runner, mission());
  const snapshot = missionSnapshot(result.mission);
  assert.equal(snapshot.completionTest, undefined);
  assert.throws(() => restoreMission(snapshot), /completionTest/);
  const restored = restoreMission(JSON.parse(JSON.stringify(snapshot)), { completionTest: reached });
  assert.equal(restored.choice.revision, 0);
  assert.deepEqual(restored.events, result.mission.events);
  const verified = await runMission(runner, restored);
  assert.equal(verified.status, 'completed');
  assert.equal(verified.steps, 0);
});

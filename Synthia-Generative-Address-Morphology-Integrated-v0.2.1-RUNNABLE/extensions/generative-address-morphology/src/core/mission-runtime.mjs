import { applyChoice, createChoiceState } from './choice-transition.mjs';
import { assertProvenanceChain, clone, freezeTree, jsonClone, namedString, plainObject, provenanceEvent } from './runtime-utils.mjs';

export const MISSION_SCHEMA = 'morph-mission-v1';
export const MISSION_RUNNER_SCHEMA = 'morph-mission-runner-v1';

function validateCapabilities(capabilities) {
  if (!Array.isArray(capabilities)) throw new TypeError('capabilities must be an array');
  const grants = capabilities.map(value => namedString(value, 'capability'));
  if (grants.includes('*')) throw new RangeError('Wildcard capabilities are not allowed; grant exact capabilities');
  return [...new Set(grants)].sort((a, b) => a.localeCompare(b));
}

function assertMission(mission) {
  if (!mission || mission.schema !== MISSION_SCHEMA || !Number.isInteger(mission.revision) || mission.revision < 0)
    throw new TypeError('Invalid mission');
  if (typeof mission.completionTest !== 'function') throw new TypeError('Mission requires an independent completionTest function');
}

function record(mission, changes, schema, body) {
  const revision = mission.revision + 1;
  const event = provenanceEvent(schema, revision, mission.lastEvent, body);
  return freezeTree({
    ...mission,
    ...changes,
    revision,
    lastEvent: event.id,
    events: [...mission.events, event],
  });
}

async function independentlyComplete(mission, observation, step) {
  const verdict = await mission.completionTest({
    observation: clone(observation),
    choice: mission.choice,
    mission,
    step,
  });
  if (typeof verdict === 'boolean') return { complete: verdict, reason: null };
  plainObject(verdict, 'completion verdict');
  if (typeof verdict.complete !== 'boolean') throw new TypeError('Completion verdict requires a boolean complete field');
  return { complete: verdict.complete, reason: verdict.reason ?? null };
}

export function createMission({
  id,
  goal,
  address,
  values = {},
  modes = {},
  capabilities = [],
  completionTest,
  maxSteps = 8,
  initialObservation = null,
  context = null,
} = {}) {
  id = namedString(id, 'mission id');
  goal = namedString(goal, 'mission goal');
  if (typeof completionTest !== 'function') throw new TypeError('A mission requires an independent completionTest function');
  if (!Number.isInteger(maxSteps) || maxSteps < 0 || maxSteps > 10000) throw new RangeError('maxSteps must be an integer in 0..10000');
  return freezeTree({
    schema: MISSION_SCHEMA,
    id,
    goal,
    revision: 0,
    choice: createChoiceState({ address, values, modes, context }),
    capabilities: validateCapabilities(capabilities),
    maxSteps,
    initialObservation: jsonClone(initialObservation, 'initialObservation'),
    observation: jsonClone(initialObservation, 'observation'),
    context: jsonClone(context, 'context'),
    completionTest,
    events: [],
    lastEvent: null,
  });
}

export function createSequencePlanner(actions = []) {
  if (!Array.isArray(actions)) throw new TypeError('actions must be an array');
  const sequence = actions.map(action => {
    plainObject(action, 'action');
    namedString(action.type, 'action type');
    return jsonClone(action, 'action');
  });
  return async ({ history }) => clone(sequence[history.filter(event => event.schema === 'mission-action-proposed-v1').length] ?? null);
}

export function createMissionRunner({ actuators = {}, planner, observer = null } = {}) {
  plainObject(actuators, 'actuators');
  if (typeof planner !== 'function') throw new TypeError('A mission runner requires an observation-dependent planner function');
  if (observer !== null && typeof observer !== 'function') throw new TypeError('observer must be a function or null');
  const registry = Object.create(null);
  for (const [type, actuator] of Object.entries(actuators)) {
    namedString(type, 'actuator type');
    plainObject(actuator, `actuator ${type}`);
    if (typeof actuator.execute !== 'function') throw new TypeError(`Actuator ${type} requires execute()`);
    registry[type] = freezeTree({
      requiredCapability: namedString(actuator.requiredCapability, `actuator ${type} requiredCapability`),
      execute: actuator.execute,
    });
  }
  return freezeTree({ schema: MISSION_RUNNER_SCHEMA, planner, observer, actuators: registry });
}

/**
 * Observation -> proposal -> exact capability check -> host actuation -> observation
 * -> independent completion verification. A proposed "done" action is not proof.
 */
export async function runMission(runner, mission, { initialObservation, context = null, signal = null } = {}) {
  if (!runner || runner.schema !== MISSION_RUNNER_SCHEMA || !runner.actuators || typeof runner.actuators !== 'object')
    throw new TypeError('Invalid mission runner');
  assertMission(mission);
  let current = mission;
  let observation = jsonClone(initialObservation === undefined ? mission.observation : initialObservation, 'observation');
  const runContext = jsonClone(context, 'context');
  const grants = new Set(mission.capabilities);

  const abort = () => {
    current = record(current, {}, 'mission-aborted-v1', { mission: mission.id });
    return freezeTree({ status: 'aborted', mission: current, observation });
  };
  const verify = async step => {
    try {
      return { verdict: await independentlyComplete(current, observation, step) };
    } catch (error) {
      return { error };
    }
  };
  const finish = async (status, step, reason = null) => freezeTree({
    status,
    reason,
    mission: await Promise.resolve(current),
    observation,
    steps: step,
  });

  if (signal?.aborted) return abort();
  const initial = await verify(0);
  if (initial.error) {
    current = record(current, {}, 'mission-verifier-failed-v1', { message: initial.error.message });
    return finish('failed', 0, 'verifier-failed');
  }
  current = record(current, { observation }, 'mission-observation-verified-v1', {
    step: 0, observation, complete: initial.verdict.complete, reason: initial.verdict.reason,
  });
  if (initial.verdict.complete) return finish('completed', 0);

  for (let step = 1; step <= mission.maxSteps; step += 1) {
    if (signal?.aborted) return abort();
    let proposal;
    try {
      proposal = await runner.planner({
        mission: current,
        observation: clone(observation),
        history: current.events,
        step,
        context: clone(runContext),
        signal,
      });
    } catch (error) {
      current = record(current, {}, 'mission-planner-failed-v1', { step, message: error.message });
      return finish('failed', step - 1, 'planner-failed');
    }
    if (proposal === null || proposal === undefined) {
      current = record(current, {}, 'mission-no-action-v1', { step, observation });
      return finish('incomplete', step - 1, 'no-action-available');
    }
    try {
      plainObject(proposal, 'action');
      proposal = jsonClone(proposal, 'action');
      namedString(proposal.type, 'action type');
    } catch (error) {
      current = record(current, {}, 'mission-action-rejected-v1', { step, message: error.message });
      return finish('failed', step - 1, 'invalid-action');
    }
    current = record(current, {}, 'mission-action-proposed-v1', { step, action: proposal });
    const actuator = runner.actuators[proposal.type];
    if (!actuator) {
      current = record(current, {}, 'mission-actuator-unavailable-v1', { step, type: proposal.type });
      return finish('failed', step, 'actuator-unavailable');
    }
    if (!grants.has(actuator.requiredCapability)) {
      current = record(current, {}, 'mission-capability-denied-v1', {
        step, type: proposal.type, requiredCapability: actuator.requiredCapability,
      });
      return finish('failed', step, 'capability-denied');
    }

    let result;
    try {
      result = await actuator.execute(clone(proposal), {
        mission: current,
        observation: clone(observation),
        step,
        context: clone(runContext),
        signal,
      });
      if (result && typeof result === 'object' && !Array.isArray(result) &&
          (Object.prototype.hasOwnProperty.call(result, 'observation') || Object.prototype.hasOwnProperty.call(result, 'choice'))) {
        if (result.choice !== undefined) {
          plainObject(result.choice, 'actuator choice');
          const transition = applyChoice(current.choice, {
            ...result.choice,
            connection: proposal.connection ?? `mission:${mission.id}`,
          });
          current = record(current, { choice: transition.state }, 'mission-choice-applied-v1', {
            step, choiceEvent: transition.event.id,
          });
        }
        result = result.observation;
      }
      if (runner.observer) {
        result = await runner.observer({
          result: clone(result), action: proposal, mission: current, step, context: clone(runContext), signal,
        });
      }
      observation = jsonClone(result === undefined ? null : result, 'actuator observation');
    } catch (error) {
      current = record(current, {}, 'mission-actuator-failed-v1', {
        step, type: proposal.type, message: error.message,
      });
      return finish('failed', step, 'actuator-failed');
    }
    current = record(current, { observation }, 'mission-outcome-observed-v1', { step, observation });

    const checked = await verify(step);
    if (checked.error) {
      current = record(current, {}, 'mission-verifier-failed-v1', { step, message: checked.error.message });
      return finish('failed', step, 'verifier-failed');
    }
    current = record(current, {}, 'mission-observation-verified-v1', {
      step, observation, complete: checked.verdict.complete, reason: checked.verdict.reason,
    });
    if (checked.verdict.complete) return finish('completed', step);
  }
  current = record(current, {}, 'mission-budget-exhausted-v1', { steps: mission.maxSteps, observation });
  return finish('incomplete', mission.maxSteps, 'budget-exhausted');
}

export function missionSnapshot(mission) {
  assertMission(mission);
  const { completionTest, ...snapshot } = mission;
  return freezeTree(jsonClone(snapshot, 'mission snapshot'));
}

export function restoreMission(snapshot, { completionTest } = {}) {
  plainObject(snapshot, 'mission snapshot');
  if (snapshot.schema !== MISSION_SCHEMA) throw new TypeError('Invalid mission snapshot');
  const restored = jsonClone(snapshot, 'mission snapshot');
  if (typeof completionTest !== 'function') throw new TypeError('Restoring a mission requires its independent completionTest');
  if (!Number.isInteger(restored.maxSteps) || restored.maxSteps < 0 || restored.maxSteps > 10000)
    throw new TypeError('Invalid persisted mission budget');
  restored.capabilities = validateCapabilities(restored.capabilities);
  // Revalidate the canonical address and numeric registers before trusting persistence.
  createChoiceState(restored.choice);
  if (!Number.isInteger(restored.revision) || restored.revision < 0)
    throw new TypeError('Invalid persisted mission history');
  assertProvenanceChain(restored.events, restored.lastEvent, restored.revision);
  restored.observation = jsonClone(restored.observation, 'persisted observation');
  restored.completionTest = completionTest;
  return freezeTree(restored);
}

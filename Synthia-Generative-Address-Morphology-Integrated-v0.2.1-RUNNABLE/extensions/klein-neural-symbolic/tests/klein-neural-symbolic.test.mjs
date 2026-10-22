import test from 'node:test';
import assert from 'node:assert/strict';
import { KleinNeuralSymbolicBridge } from '../src/klein-neural-symbolic.mjs';

// Contract-only fixtures: this proves dispatch, not pretrained model execution.
const address = Object.freeze({ dimension: 'Movement', gate: 28 });
function harness({ authorize = async () => true,
  neuralNetBuilder = async (args) => ({ built: args.layers }),
  modelMaker = async (args) => ({ trained: args.network.built }) } = {}) {
  const seen = [];
  const assembly = {
    klein: { evaluate: (args) => {
      seen.push(args);
      return { evaluationId: 'witness-1', perInvocation: [{ error: null }, { error: null }] };
    } },
    invoke: (id, input) => ({ derivation: { toolId: id, output: input } }),
  };
  return { seen, bridge: new KleinNeuralSymbolicBridge({
    assembly,
    validateCanonicalAddress: (a) => { if (!a?.gate) throw Error('missing address'); },
    neuralNetBuilder, modelMaker, authorize,
  }) };
}

test('runs builder then modelmaker and witnesses the contextual tool invocation', async () => {
  const { seen, bridge } = harness();
  const result = await bridge.execute({ intent: 'Build a small model', address, steps: [
    { id: 'network', op: 'neural.build', input: { layers: 2 } },
    { id: 'training', op: 'model.train', input: { network: { $result: 'network' } } },
  ] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.output, { trained: 2 });
  assert.deepEqual(seen[0].invocations.map((x) => x.toolId), ['autoling', 'diseminer']);
});

test('refuses a factory which is not connected', async () => {
  const { bridge } = harness();
  await assert.rejects(() => bridge.execute({ intent: 'build', address,
    steps: [{ id: 'network', op: 'missing.factory' }] }), /CAPABILITY_NOT_CONNECTED/);
});

test('owner authorization is required for training', async () => {
  const { bridge } = harness({ authorize: async () => false });
  const result = await bridge.execute({ intent: 'train', address,
    steps: [{ id: 'model', op: 'model.train', input: {} }] });
  assert.equal(result.ok, false);
  assert.match(result.execution[0].error, /OWNER_AUTHORIZATION_REQUIRED/);
  assert.equal(bridge.receipts.length, 1);
});

test('never fabricates addresses or forward references', async () => {
  const { bridge } = harness();
  await assert.rejects(() => bridge.execute({ intent: 'build',
    steps: [{ id: 'x', op: 'neural.build' }] }), /missing address/);
  const result = await bridge.execute({ intent: 'build', address,
    steps: [{ id: 'x', op: 'neural.build', input: { $result: 'later' } }] });
  assert.equal(result.ok, false);
  assert.match(result.execution[0].error, /UNRESOLVED_RESULT/);
});

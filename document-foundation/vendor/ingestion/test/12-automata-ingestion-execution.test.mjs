import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AutomataIngestionExecutionKernel,
  BrowserAutomataStore,
  EXECUTION_FIELDS,
  IntegratedSynthiaSystem,
} from '../src/index.mjs';
import { SynthiaAutomata } from '../vendor/execution-spine-v0.4.0/src/pure-synthia/engine/synthia.js';

test('automata kernel compiles JavaScript into all five execution fields without a worker', async () => {
  const kernel = new AutomataIngestionExecutionKernel({
    store: new BrowserAutomataStore({ databaseName: 'test-memory-js' }),
  });
  const source = `
    import thing from './thing.js';
    export function add(a, b) {
      const total = a + b;
      return total;
    }
    add(2, 3);
  `;
  const session = await kernel.prepare({ name: 'sample.mjs', content: source });

  assert.equal(session.decomposition.artifact.kind, 'javascript');
  assert.deepEqual(session.fieldMap.order, EXECUTION_FIELDS);
  for (const field of EXECUTION_FIELDS) assert.equal(Array.isArray(session.fieldMap.fields[field]), true);
  assert.equal(session.fieldMap.fields.dependency.some((entry) => entry.value === './thing.js'), true);
  assert.equal(session.fieldMap.fields.causal.some((entry) => entry.kind === 'call' && entry.value === 'add'), true);
  assert.equal(session.plan.workerRequired, false);
  assert.equal(session.plan.backendRequired, false);
});

test('exact artifact fingerprint reuses its compiled decomposition and note', async () => {
  const store = new BrowserAutomataStore({ databaseName: 'test-memory-reuse' });
  const kernel = new AutomataIngestionExecutionKernel({ store });
  const artifact = { name: 'state.json', content: '{"alpha":1,"beta":true}' };

  const first = await kernel.process(artifact);
  const second = await kernel.process(artifact);

  assert.equal(first.execution.ok, true);
  assert.equal(first.reusedCompiledForm, false);
  assert.equal(second.reusedCompiledForm, true);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(typeof second.address.integritySignature, 'string');
  assert.equal((await kernel.recallNote(second.fingerprint)).addressId, second.address.id);
});

test('ontological address binds post-execution five-field observations', async () => {
  const kernel = new AutomataIngestionExecutionKernel({
    store: new BrowserAutomataStore({ databaseName: 'test-memory-address' }),
  });
  const record = await kernel.process({ name: 'state.json', content: '{"x":4}' });

  assert.equal(record.fields.fields.causal.some((entry) => entry.kind === 'execution-outcome'), true);
  assert.equal(record.fields.fields.stateSpace.some((entry) => entry.kind === 'transition' && entry.value.to === 'executed'), true);
  assert.equal(Object.keys(record.address.fieldSignatures).sort().join(','), [...EXECUTION_FIELDS].sort().join(','));
  assert.match(record.address.id, /^onto:/);
  assert.match(record.address.signatureMeaning, /not a private-key/);
});

test('browser-local core audit explicitly does not require backend or web worker', async () => {
  const kernel = new AutomataIngestionExecutionKernel({
    store: new BrowserAutomataStore({ databaseName: 'test-memory-audit' }),
  });
  const audit = await kernel.audit();
  assert.equal(audit.workerRequired, false);
  assert.equal(audit.backendRequiredForCore, false);
  assert.deepEqual(audit.fields, EXECUTION_FIELDS);
});


test('existing executeArtifact path now emits the compiled five-field automata receipt', async () => {
  const system = new IntegratedSynthiaSystem({ engine: new SynthiaAutomata() });
  const response = await system.executeArtifact(
    { name: 'wired.json', content: '{"ready":true}' },
    { personId: 'automata-wire-test' },
  );

  assert.equal(response.ok, true);
  assert.equal(response.automata.fields.schema, 'synthia.five-field-execution-map.v1');
  assert.deepEqual(response.automata.fields.order, EXECUTION_FIELDS);
  assert.match(response.automata.address.id, /^onto:/);
  assert.equal(response.automata.note.nextRun.includes('reuse compiled decomposition'), true);
});

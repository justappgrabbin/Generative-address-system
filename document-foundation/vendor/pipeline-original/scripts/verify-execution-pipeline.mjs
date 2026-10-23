import assert from 'node:assert/strict';
import SynthiaUnifiedSystem from '../src/synthia-unified-system.mjs';

const EXPECTED_STAGES = [
  'ingest',
  'normalize',
  'primitive-operator-graph',
  'five-field-allocation',
  'dependency-schedule-forwarding',
  'artifact-execution',
  'fold-recombine',
  'state-commit',
  'observation',
  'ontological-address',
  'execution-cache',
];

const synthia = new SynthiaUnifiedSystem();
const artifact = {
  name: 'verification.json',
  content: JSON.stringify({ organism: 'Synthia', executionPipeline: true, value: 42 }),
};

const first = await synthia.executeArtifact(artifact, { source: 'verify-execution-pipeline' });
const second = await synthia.executeArtifact(artifact, { source: 'verify-execution-pipeline-repeat' });

assert.equal(first.ok, true, 'first execution must succeed');
assert.equal(first.result?.engine, 'json-native', 'original JSON artifact must execute in JSON native runtime');
assert.deepEqual(first.pipeline.stages.map((stage) => stage.stage), EXPECTED_STAGES, 'all pipeline stages must run in order');
assert.equal(first.pipeline.cache.analysisHit, false, 'first analysis must be a cache miss');
assert.equal(second.pipeline.cache.analysisHit, true, 'repeat analysis must hit the execution-analysis cache');
assert.equal(second.ok, true, 'repeat execution must still execute successfully');
assert.ok(second.canonicalAddressKey, 'post-execution canonical address must exist');
assert.equal(synthia.executionSnapshot().runSequence, 2, 'both executions must be committed');
assert.ok(synthia.learning.training.records.filter((r) => r.task === 'artifact-execution').length >= 2, 'root learning journal must observe execution');

const allocation = Object.fromEntries(
  Object.entries(second.pipeline.fields).map(([field, state]) => [field, {
    runs: state.runs,
    totalPrimitives: state.totalPrimitives,
    lastChecksum: state.lastChecksum,
  }]),
);

console.log(JSON.stringify({
  verified: true,
  artifact: artifact.name,
  first: {
    ok: first.ok,
    path: first.path,
    engine: first.result?.engine ?? null,
    analysisCacheHit: first.pipeline.cache.analysisHit,
  },
  second: {
    ok: second.ok,
    path: second.path,
    engine: second.result?.engine ?? null,
    analysisCacheHit: second.pipeline.cache.analysisHit,
  },
  stageCount: second.pipeline.stages.length,
  stages: second.pipeline.stages.map((stage) => ({ stage: stage.stage, ok: stage.ok })),
  forwardingCount: second.pipeline.schedule.forwardingCount,
  canonicalAddressKey: second.canonicalAddressKey,
  foldHash: second.pipeline.fold.foldHash,
  runSequence: synthia.executionSnapshot().runSequence,
  fields: allocation,
  learningJournalExecutions: synthia.learning.training.records.filter((r) => r.task === 'artifact-execution').length,
}, null, 2));

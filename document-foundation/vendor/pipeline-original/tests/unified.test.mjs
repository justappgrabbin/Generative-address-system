import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import SynthiaUnifiedSystem from '../src/synthia-unified-system.mjs';
test('mandatory cognition is live',()=>{const s=new SynthiaUnifiedSystem();const c=s.capabilities();assert.ok(c.stateSpace.length>0);assert.ok(c.ato.length>20);assert.ok(c.klein.length>20);});
test('HD research facade is live',()=>{const s=new SynthiaUnifiedSystem();assert.equal(s.hd.capabilities.tropical,true);assert.equal(s.hd.capabilities.siderealFaganBradley,true);assert.equal(s.hd.capabilities.draconicTrueNode,true);});
test('human-success extension is live',()=>{const s=new SynthiaUnifiedSystem();const x=s.success.observe('human','movement',0.8,{source:'human'});assert.ok(x.vitality>=0&&x.vitality<=1);});
test('mobile points to research v3',()=>{const t=fs.readFileSync(new URL('../apps/mobile/src/runtime/synthia-mobile-bridge.mjs',import.meta.url),'utf8');assert.match(t,/human-design-research/);assert.match(t,/mandatoryCognition/);});


test('unified host reaches the execution pipeline and records the outcome in learning', async()=>{
  const s=new SynthiaUnifiedSystem();
  const r=await s.executeArtifact({name:'unified-runtime.json',content:'{"answer":42}'},{source:'unified-e2e-test'});
  assert.equal(r.ok,true);
  assert.equal(r.result.engine,'json-native');
  assert.equal(r.pipeline.stages.length,11);
  assert.deepEqual(r.pipeline.stages.map(x=>x.stage),[
    'ingest','normalize','primitive-operator-graph','five-field-allocation',
    'dependency-schedule-forwarding','artifact-execution','fold-recombine',
    'state-commit','observation','ontological-address','execution-cache'
  ]);
  assert.ok(r.canonicalAddressKey);
  assert.equal(s.executionSnapshot().runSequence,1);
  const learning=s.learning.training.records.at(-1);
  assert.equal(learning.task,'artifact-execution');
  assert.equal(learning.success,true);
  assert.equal(learning.metadata.placementRecordId,r.placementRecordId);
  assert.equal(s.executionWiringAudit().executionPipeline.committedRuns,1);
});

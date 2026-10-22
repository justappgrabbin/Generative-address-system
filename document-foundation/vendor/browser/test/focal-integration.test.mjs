import assert from 'node:assert/strict';
import { FocalStateSpace } from '../src/integration/focal-state-space.js';
import { MemoryRecordStore } from '../src/integration/storage.js';

const store = new MemoryRecordStore();
const system = new FocalStateSpace({store});
const artifact = {
  identity:'artifact:kimi-operator-source', name:'operators.js', type:'text/javascript',
  canonicalAddress:{planetary:'Mercury',dimension:'Movement',gate:24,line:1,color:2,tone:3,base:4,degree:135,minute:0,second:0,arcAxis:'Horizontal',zodiac:'Leo',house:5},
  addressEvidence:'existing Kimi operator-source registration',
  macroContext:{containers:['pure-synthia-automata'],neighbors:['transitions.js'],upstream:['addressing.js'],downstream:['focal-state-space.js']},
  microContext:{components:['OPERATORS','operatorById'],localStates:[{gate:24,bits:[1,0,0,0,0,0]}],relationships:['transition.operatorId -> operator.id'],transitions:[]},
  dependencies:[{identity:'src/state-space/addressing.js',relation:'imports'}],
  provenance:{package:'Kimi_Agent_Automata State Space Merge(7).zip',file:'src/state-space/operators.js'}
};

const ingested = await system.ingest(artifact);
assert.equal(ingested.created,true);
assert.equal(ingested.record.canonicalAddress.planetary,'Mercury');
assert.ok(ingested.view.knowledge.length && ingested.view.dependency.length);
assert.ok(ingested.view.macro.containers.length && ingested.view.micro.components.length);
assert.equal(Object.keys(ingested.view.space.weightCalculation.operators).length,16);
assert.equal(ingested.view.space.weightCalculation.hamming.pairs.length,6);
assert.deepEqual(Object.keys(ingested.view.space.weightCalculation.inputs),['knowledge','causal','temporal','dependency']);
const changed = await system.execute(artifact.identity,'mirror');
assert.notEqual(changed.event.before.gate,changed.event.after.gate);
assert.equal(changed.event.operator,'o_reverse');

const reloaded = new FocalStateSpace({store});
const retrieved = await reloaded.ingest(artifact);
assert.equal(retrieved.created,false);
assert.equal(retrieved.analyzed,false);
assert.equal(retrieved.record.historyReplay.length,2);
assert.ok(retrieved.view.space.weightCalculation.spaceWeight>=0);
const replay = await reloaded.replay(artifact.identity,1);
assert.equal(replay.reproduced,true);
assert.equal(replay.reanalyzed,false);
console.log(JSON.stringify({ok:true,identity:artifact.identity,address:retrieved.record.canonicalAddress,projections:Object.fromEntries(Object.entries(retrieved.record.graphs).map(([k,v])=>[k,v.length])),macro:retrieved.record.macroContext,micro:retrieved.record.microContext,transition:changed.event,replay},null,2));

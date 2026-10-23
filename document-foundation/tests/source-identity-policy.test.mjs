import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAgentAddress,validateAgentAddress} from '../vendor/organism/src/state-space/agent-address.mjs';
import {DnaStateSubstrate} from '../vendor/organism/src/state-space/dna-state-substrate.mjs';
import {TemporalExperienceRuntime} from '../vendor/organism/src/state-space/temporal-experience-runtime.mjs';
import {BiologicalTranslationRuntime} from '../vendor/organism/src/state-space/biological-translation-runtime.mjs';
import {readFile} from 'node:fs/promises';
const address={planetary:1,dimension:'Being',gate:25,line:4,color:3,tone:2,base:5,degree:29,minute:59,second:59,arc:99,zodiac:1,house:1};
test('connected source identity modules contain no hash generator or hash-filled coordinates',async()=>{
 for(const path of ['state-space/agent-address.mjs','state-space/dna-state-substrate.mjs','state-space/relational-operator-runtime.mjs','state-space/temporal-experience-runtime.mjs','state-space/biological-translation-runtime.mjs','morph/canonical-morph-runtime.mjs','primitives/index.mjs','util.mjs']){
  const source=await readFile(new URL(`../vendor/organism/src/${path}`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/fnv1a32|numericHash|hashId|crypto\.subtle|createHash/);
 }
});
test('source address requires supplied coordinates and enforces the chosen 0–29 degree range',()=>{
  assert.deepEqual(normalizeAgentAddress(address),address);
  assert.throws(()=>normalizeAgentAddress({gate:25}));
  assert.throws(()=>validateAgentAddress({...address,degree:30}));
  assert.throws(()=>validateAgentAddress({...address,degree:31}));
  assert.equal(validateAgentAddress({...address,degree:0}),true);
});
test('resolved state and relationship identities retain named input structure rather than digests',()=>{
  const substrate=new DnaStateSubstrate();
  const left=substrate.resolve({address}),right=substrate.resolve({address:{...address,gate:51}});
  assert.match(left.stateId,/"gate":25/);
  const relationship=substrate.relate(left,right);
  assert.match(relationship.relationshipId,/"leftAddress":/);
  assert.equal(relationship.endpoints.left.stateId,left.stateId);
  assert.equal(relationship.endpoints.right.stateId,right.stateId);
  assert.equal(relationship.operatorAlphabet.length,16);
  assert.equal(relationship.relationshipNeuralVector.length,121);
});
test('temporal and translation records use explicit reproducible identities',()=>{
  const state=new DnaStateSubstrate().resolve({address});
  const temporal=new TemporalExperienceRuntime();
  const first=temporal.land({agentId:'person',coordinate:{date:'2026-10-22',time:'12:00:00'},targetResolvedState:state});
  assert.match(first.state.coordinateKey,/2026-10-22/);
  const second=temporal.land({agentId:'person',coordinate:{date:'2026-10-22',time:'12:00:00'},targetResolvedState:state});
  assert.equal(second.state.historicalStateId,first.state.historicalStateId);
  const translation=new BiologicalTranslationRuntime().translateActivation({agentId:'person',sourceActivationId:'entry:1',resolvedState:state,address});
  assert.match(translation.id,/"stateId":/);
});

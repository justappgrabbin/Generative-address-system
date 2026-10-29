import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalRuntime } from '../src/runtime.mjs';
import { Swarm } from '../src/engine.mjs';

test('main-thread CPU runtime steps, records, restores, and replays the same substrate',async()=>{
  const runtime=new LocalRuntime({swarm:new Swarm({count:12})});
  const messages=[];runtime.onmessage=event=>messages.push(event.data);
  await runtime.dispatch('step');
  await runtime.dispatch('action',{type:'transition',data:{id:'p001',line:2}});
  for(let i=0;i<45;i++)await runtime.dispatch('step');
  const {snapshot}=await runtime.dispatch('snapshot');
  const replayed=await runtime.dispatch('replay',{snapshot});
  assert.deepEqual(replayed.snapshot,snapshot);
  await runtime.dispatch('reset',{count:12});assert.equal(runtime.swarm.tick,0);
  await runtime.dispatch('restore',{snapshot});assert.equal(runtime.swarm.tick,snapshot.tick);
  assert(messages.some(m=>m.type==='state'));runtime.terminate();
});
test('runtime serializes commands and reports invalid input without damaging state',async()=>{
  const runtime=new LocalRuntime({swarm:new Swarm({count:4})}),messages=[];
  runtime.onmessage=event=>messages.push(event.data);
  await Promise.all([runtime.postMessage({id:1,type:'step'}),runtime.postMessage({id:2,type:'step'}),runtime.postMessage({id:3,type:'speed',payload:{value:99}})]);
  assert.equal(runtime.swarm.tick,2);assert.equal(messages.find(m=>m.id===3).ok,false);
  runtime.terminate();
});

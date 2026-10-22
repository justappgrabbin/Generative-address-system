import test from 'node:test';
import assert from 'node:assert/strict';
import {Foundation} from '../src/foundation.mjs';
import {BrowserAutomataStore} from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
import {createTranslationLayerAdapter} from '../../Synthia-Generative-Address-Morphology-Integrated-v0.2.1-RUNNABLE/extensions/translation-layer/src/index.mjs';

test('foundation executes four uploaded source languages and replays without optional facilities',async()=>{
 const names=['fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker','WebAssembly','GPU'];
 const saved=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]);
 for(const name of names)Object.defineProperty(globalThis,name,{configurable:true,value:undefined});
 try{
  const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
  const cases=[['answer.py','print(6 * 7)'],['answer.rb','puts 6 * 7'],['answer.lua','print(6 * 7)'],['answer.c','#include <stdio.h>\nint main(){printf("%d\\n",6*7);return 0;}']];
  for(const [name,source] of cases){
   const result=await app.ingest(source,{name});
   assert.equal(result.ok,true,JSON.stringify(result.outcome.result));
   assert.equal(result.outcome.runtimeAdapter,'synthia-translation-layer');
   assert.deepEqual(result.outcome.result.stdout,['42']);
   assert.equal(result.outcome.result.usedFallback,true);
  }
  const restored=new Foundation({store});await restored.ready;
  assert.equal(restored.history.length,4);
  assert.deepEqual(restored.history.map(e=>e.result.outcome.result.stdout),cases.map(()=>['42']));
 }finally{for(const [name,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
});

test('existing translation adapter falls back after a failing optional backend',async()=>{
 const adapter=createTranslationLayerAdapter({backends:[{id:'unavailable-backend',execute(){throw Error('offline');}}]});
 const result=await adapter.execute({artifact:{name:'answer.py',content:'print(42)'},kind:'python'});
 assert.equal(result.ok,true);assert.deepEqual(result.stdout,['42']);
 assert.equal(result.fallbackChain[0].ok,false);assert.equal(result.usedFallback,true);
});

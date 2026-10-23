import test from 'node:test';
import assert from 'node:assert/strict';
import {Foundation} from '../src/foundation.mjs';
import {BrowserAutomataStore} from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
const address={planetary:1,dimension:'Being',gate:25,line:4,color:3,tone:2,base:5,degree:29,minute:59,second:59,arcFraction:99,zodiac:1,house:1};
test('existing factory mounts an addressed analyzer, learns through tool execution, and replays its state',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 const generated=await app.fieldCommand({operation:'factory',payload:{operation:'generate',source:'fixture:factory',purpose:'analyze observations',level:4,address}});
 const toolId=generated.factory.toolId;
 const tool=app.system.mesh.get(toolId);
 assert.equal(generated.factory.status,'MOUNTED');
 for(const [key,value] of Object.entries(address))assert.equal(tool.address[key],value,key);
 const run=()=>app.runTool({tool:toolId,source:'fixture:use-generated',address,input:{sample:'one'}});
 const first=await run(),second=await run();
 assert.equal(first.tool.output.occurrences,1);assert.equal(second.tool.output.occurrences,2);
 assert.equal(second.tool.output.features.base,5);assert.equal(second.tool.lifecycleAccepted,true);
 assert.ok(app.tools().some(t=>t.id===toolId));assert.equal(app.audit().system.ok,true);
 const saved=tool.exportState();tool.hydrate(saved);assert.deepEqual(tool.exportState(),saved);
 const replay=new Foundation({store});await replay.ready;
 assert.deepEqual(replay.system.mesh.get(toolId).exportState(),saved);
 assert.deepEqual(replay.field.snapshot(),app.field.snapshot());
 const third=await replay.runTool({tool:toolId,source:'fixture:after-restart',input:{sample:'one'}});
 assert.equal(third.tool.output.occurrences,3);
 assert.deepEqual(third.tool.address,address);
});
test('factory analogy consumes field-owned binary features and returns a novel vector with native Hamming distances',async()=>{
 const app=new Foundation({store:new BrowserAutomataStore()});await app.ready;
 for(const [index,bits] of [[0,[0,0]],[1,[1,0]],[2,[0,1]]]){
  const r=await app.fieldCommand({operation:'attachRepresentation',payload:{coordinate:{...address,gate:index+1},representation:{bits},source:`fixture:bits:${index}`,provenance:{source:'fixture:observed-features'}}});
  await app.fieldCommand({operation:'teachMeaning',payload:{ref:r.field,term:`form ${index}`,source:'fixture:terminology'}});
 }
 const result=await app.fieldCommand({operation:'factory',payload:{operation:'analogy',source:'fixture:analogy',features:['first','second'],terms:['form 0','form 1','form 2'],mode:'xor'}});
 assert.deepEqual(result.factory.result,[1,1]);
 assert.equal(result.factory.candidates[0].distance,1);
 assert.ok(result.factory.meaning.operands.every(o=>o.state.source.startsWith('fixture:bits:')));
 const replay=new Foundation({store:app.store});await replay.ready;
 assert.deepEqual(replay.field.snapshot(),app.field.snapshot());
});
test('live factory donors reach Hamming synthesis; failed probes cannot install and successful capabilities survive restart',async()=>{
 const app=new Foundation({store:new BrowserAutomataStore()});await app.ready;
 const generated=await app.fieldCommand({operation:'factory',payload:{operation:'generate',source:'fixture:factory',purpose:'filter color',level:2,address}});
 const input=[{color:3,label:'keep'},{color:6,label:'discard'}];
 const failed=await app.fieldCommand({operation:'factory',payload:{operation:'derive',source:'fixture:rejected-probe',capability:'impossible-filter',address,examples:[{input,expected:'impossible'}]}});
 assert.equal(failed.ok,false);assert.equal(failed.factory.reason,'NO_VERIFIED_MESH_RULE');
 assert.equal(app.system.execution.meshSynthesizer.installed.has('impossible-filter'),false);
 const derived=await app.fieldCommand({operation:'factory',payload:{operation:'derive',source:'fixture:observed-filter',capability:'filter color',address,examples:[{input,expected:[{color:3,label:'keep'}]}]}});
 assert.equal(derived.ok,true);
 assert.ok(derived.factory.donors.includes(`automaton:${generated.factory.toolId}`));
 assert.equal(derived.factory.neighbors.find(n=>n.id===`automaton:${generated.factory.toolId}`).hammingDistance,0);
 const executed=await app.fieldCommand({operation:'factory',payload:{operation:'execute',source:'fixture:new-input',capability:'filter color',input:[{color:6,label:'other'},{color:3,label:'new'}]}});
 assert.deepEqual(executed.factory.output,[{color:3,label:'new'}]);
 const replay=new Foundation({store:app.store});await replay.ready;
 assert.ok(replay.system.execution.meshSynthesizer.installed.has('filter color'));
 assert.deepEqual(replay.field.snapshot(),app.field.snapshot());
 const again=await replay.fieldCommand({operation:'factory',payload:{operation:'execute',source:'fixture:after-restart',capability:'filter color',input}});
 assert.deepEqual(again.factory.output,[{color:3,label:'keep'}]);
});

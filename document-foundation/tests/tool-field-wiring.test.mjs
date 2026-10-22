import test from 'node:test';
import assert from 'node:assert/strict';
import {Foundation} from '../src/foundation.mjs';
import {BrowserAutomataStore} from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
const address={planetary:1,dimension:'Being',gate:2,line:1,color:1,tone:1,base:1,degree:29,minute:59,second:59,arcFraction:99,zodiac:1,house:1};
const samples={
 'autoling-lite':{operation:'export'},
 'diseminer-lite':{operation:'ingest',text:'red shape blue shape'},
 'klein-analogy':{vocab:['a','b'],A:['a'],B:['b'],C:['a']},
 'iching-grammar':{lines:[1,0,1,0,1,0],transform:'mirror'},
 'language-contact':{grammarA:{a:'x'},grammarB:{b:'y'},contactRate:1,generations:1},
 'historical-monte-carlo':{variants:{a:1,b:2},generations:2,seed:7},
 autonovel:{operation:'register',domain:{id:'fixture',primitives:[],combinators:[]}},
 messy:{agents:[{id:'one',features:{x:1}}],ticks:1},
 success:{operation:'define',personId:'fixture',purpose:{statement:'Learn from sourced examples'}},
 conversation:{text:'hello'},'browser-form':{operation:'snapshot'},
 'research-browser':{operation:'create',project:{id:'fixture',title:'Test',question:'What is observed?'}},
 'computational-grammar-coder':{text:'the bird moves'},autoling:{operation:'pipeline',text:'the bird moves'},
 diseminer:{operation:'observe',observation:{modality:'text',source_ref:'fixture'}},
 'morph-mir':{operation:'snapshot'}
};
test('all sixteen mounted tools execute through addressed field contact and replay their receipts',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 assert.deepEqual(new Set(app.tools().map(t=>t.id)),new Set(Object.keys(samples)));
 for(const [tool,input] of Object.entries(samples)){
  const r=await app.fieldCommand({operation:'tool',payload:{tool,input,address,source:'fixture:tool-contract'}});
  assert.equal(r.ok,true,tool);assert.ok(r.tool.trace.length>0,tool);
  assert.deepEqual(r.tool.address,address);assert.deepEqual(r.fieldContact.observation.tool_evidence,r.tool);
  assert.equal(r.tool.semanticTruth,'UNVERIFIED_TOOL_RESULT');
  // No donor gate assignment or tool-produced text may silently allocate a semantic node.
  assert.equal(app.field.nodes.size,0);
 }
 assert.equal(app.toolWiringAudit().tools.filter(t=>t.fieldReceiptCount===1&&t.lastStatus==='EXECUTED').length,16);
 const restored=new Foundation({store});await restored.ready;
 assert.deepEqual(restored.field.snapshot(),app.field.snapshot());
 assert.deepEqual(restored.toolWiringAudit(),app.toolWiringAudit());
 const analogy=app.history.find(e=>e.input.payload.tool==='klein-analogy').result;
 assert.deepEqual(analogy.tool.output.result,['b']);
 const contact=app.history.find(e=>e.input.payload.tool==='language-contact').result;
 assert.equal(contact.tool.output.finalGrammar.b,'y');
});
test('source and coordinate errors cannot mutate tools; rejected, missing and failed results stay distinguishable',async()=>{
 const app=new Foundation({store:new BrowserAutomataStore()});await app.ready;
 const tool=app.system.engine.toolsById.get('autoling'),before=tool.exportState(),calls=tool.calls;
 await assert.rejects(app.runTool({tool:'autoling',source:'fixture',address:{...address,degree:30},input:{text:'bad'}}));
 assert.deepEqual(tool.exportState(),before);assert.equal(tool.calls,calls);
 await assert.rejects(app.runTool({tool:'autoling',input:{text:'bad'}}));
 const rejected=await app.runTool({tool:'iching-grammar',source:'fixture',input:{lines:[1]}});assert.equal(rejected.tool.status,'REJECTED');
 const missing=await app.runTool({tool:'success',source:'fixture',input:{operation:'summary',personId:'unknown'}});assert.equal(missing.tool.status,'INVESTIGATE');assert.equal(missing.ok,false);
 const failed=await app.runTool({tool:'research-browser',source:'fixture',input:{operation:'snapshot',projectId:'unknown'}});assert.equal(failed.tool.status,'FAILED');assert.ok(failed.tool.error);
 const restored=new Foundation({store:app.store});await restored.ready;assert.deepEqual(restored.field.snapshot(),app.field.snapshot());
 assert.deepEqual(app.tools().find(t=>t.id==='diseminer').capabilities,['observe','extract','query']);
});
test('field meaning supplies actual native tool operands, changes behavior, and persists across replay',async()=>{
 const app=new Foundation({store:new BrowserAutomataStore()});await app.ready;
 const refs=[];
 for(const [i,features] of [['a'],['b'],['a']].entries()){
  const r=await app.fieldCommand({operation:'attachRepresentation',payload:{coordinate:{...address,gate:i+1},source:`fixture:state:${i}`,representation:{features,universe:['a','b']},provenance:{source:'fixture:attested-properties'}}});
  refs.push(r.field);
  await app.fieldCommand({operation:'teachMeaning',payload:{ref:r.field,term:`state ${i}`,source:'fixture:attested-lexical-expression'}});
 }
 const command={tool:'klein-analogy',source:'fixture:meaning-request',input:{A:['wrong'],B:['wrong'],C:['wrong'],vocab:['wrong']},meaning:{terms:['state 0','state 1','state 2'],version:'fixture-native-contract.v1',source:'fixture:documented-analogy-input',bindings:{vocab:{operand:0,path:['representation','universe']},A:{operand:0,path:['representation','features']},B:{operand:1,path:['representation','features']},C:{operand:2,path:['representation','features']}}}};
 const first=await app.runTool(command);
 assert.deepEqual(first.tool.output.result,['b']);
 assert.deepEqual(first.tool.handoff.input.A,['a']);assert.equal(first.tool.handoff.evidence.length,4);
 const changed=await app.runTool({...command,meaning:{...command.meaning,terms:['state 0','state 1','state 1']}});
 assert.deepEqual(changed.tool.output.result,['a']);
 const tool=app.system.engine.toolsById.get('klein-analogy'),calls=tool.calls;
 const unknown=await app.runTool({...command,meaning:{...command.meaning,terms:['unknown','state 1','state 2']}});
 assert.equal(unknown.tool.status,'INVESTIGATE');assert.equal(tool.calls,calls);
 const absent=await app.runTool({...command,meaning:{...command.meaning,bindings:{A:{operand:0,path:['representation','missing']}}}});
 assert.equal(absent.tool.status,'INVESTIGATE');assert.equal(tool.calls,calls);
 const restored=new Foundation({store:app.store});await restored.ready;
 assert.deepEqual(restored.field.snapshot(),app.field.snapshot());
 const repeat=await restored.runTool(command);assert.deepEqual(repeat.tool.output.result,first.tool.output.result);
});
test('the same expression resolves differently inside sourced dominating structures; omitted context stays ambiguous',async()=>{
 const app=new Foundation({store:new BrowserAutomataStore()});await app.ready;
 for(const [i,frame,features] of [[0,'frame-a',['a']],[1,'frame-b',['b']]]){
  await app.fieldCommand({operation:'defineStructure',payload:{id:frame,dimension:'Being',source:'fixture:frame'}});
  const r=await app.fieldCommand({operation:'attachRepresentation',payload:{coordinate:{...address,gate:i+1},source:`fixture:context-state:${i}`,representation:{features,universe:['a','b']},provenance:{source:'fixture:attested-context-properties'}}});
  await app.fieldCommand({operation:'teachMeaning',payload:{ref:r.field,term:'the same expression',source:'fixture:contextual-use',context:{dominatingStructure:frame}}});
 }
 const make=dominatingStructure=>({tool:'klein-analogy',source:'fixture:context-controlled-request',input:{B:[],C:[]},meaning:{terms:['the same expression'],dominatingStructure,source:'fixture:native-feature-contract',version:'v1',bindings:{vocab:{operand:0,path:['representation','universe']},A:{operand:0,path:['representation','features']}}}});
 const a=await app.runTool(make('frame-a')),b=await app.runTool(make('frame-b'));
 assert.deepEqual(a.tool.output.result,['a']);assert.deepEqual(b.tool.output.result,['b']);
 assert.equal(a.tool.handoff.meaning.frame.dominatingStructure.id,'frame-a');
 const calls=app.system.engine.toolsById.get('klein-analogy').calls;
 const ablated=await app.runTool(make(undefined));assert.equal(ablated.tool.status,'INVESTIGATE');assert.equal(app.system.engine.toolsById.get('klein-analogy').calls,calls);
 const replay=new Foundation({store:app.store});await replay.ready;assert.deepEqual(replay.field.snapshot(),app.field.snapshot());
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Foundation } from '../src/foundation.mjs';
import { BrowserAutomataStore } from '../vendor/ingestion/src/automata/browser-automata-store.mjs';

test('chat traverses actual Klein tools, reduction, five fields and the live mesh', async()=>{
 const app=new Foundation(); await app.ready;
 const result=await app.chat('Adaya builds a tool in the studio today because it helps.');
 assert.equal(result.ok,true);
 assert.equal(result.outcome.contact.mode,'deep-klein-contact-loop');
 assert.ok(result.record.decomposition);
 assert.deepEqual(Object.keys(result.fiveW.confidence).sort(),['what','when','where','who','why']);
 assert.ok(result.shared.deliveries.length>=17);
 assert.equal(app.ato.getStats().totalTraces,1);
});
test('spine expression executes and persists with network and Worker disabled',async()=>{
 const fetchBefore=globalThis.fetch,workerBefore=globalThis.Worker;
 globalThis.fetch=()=>{throw Error('external network used');};
 globalThis.Worker=class {constructor(){throw Error('Worker used');}};
 try {
 const store=new BrowserAutomataStore();const app=new Foundation({store});
 const r=await app.ingest({realizer:'expression-ir',expression:{op:'add',args:[2,3]}});
 assert.equal(r.record.execution.result.returnValue,5);
 assert.equal(r.record.execution.workerUsed,false);
 const restored=new Foundation({store});await restored.ready;
 assert.equal(restored.history.length,1);
 assert.equal(restored.ato.getStats().totalTraces,1);
 assert.ok(restored.system.engine.tripleStore.query({}).length);
 } finally {globalThis.fetch=fetchBefore;globalThis.Worker=workerBefore;}
});
test('concurrent inputs land in order, failed execution is preserved, earlier history stays intact',async()=>{
 const app=new Foundation();
 const [a,b]=await Promise.all([app.ingest('one',{name:'one.txt'}),app.ingest('two',{name:'two.txt'})]);
 assert.equal(a.id,'entry:1');assert.equal(b.id,'entry:2');
 const old=JSON.stringify(app.history[0]);
 const failure=await app.ingest({realizer:'capability',name:'missing-capability'});
 assert.equal(failure.ok,false);assert.ok(failure.record.address.id);
 assert.equal(app.history.length,3);assert.equal(JSON.stringify(app.history[0]),old);
});
test('relative lineage preserves inherited essence and both consequences at different depths',async()=>{
 const store=new BrowserAutomataStore();const app=new Foundation({store});
 const address={planetary:1,dimension:'Movement',gate:1,line:1,color:1,tone:1,base:1,degree:{gateSpanDegree:0},minute:0,second:0,arcAxis:{arcUnit:1,axis:'Vertical'},zodiac:1,house:1};
 await app.registerPiece({id:'root',foundational:true,qualities:['energy','creation'],source:'supplied-design',address});
 await app.registerPiece({id:'child',parents:['root'],qualities:['creation'],source:'person-design',address,proportion:{numerator:'1',denominator:'1000000000000000000000'}});
 await assert.rejects(app.registerPiece({id:'invalid',parents:['child'],qualities:['unrelated'],source:'person-design',address}));
 const contract={left:'root',right:'child',predicate:{op:'lt',left:{op:'ref',path:'depth'},right:2},evidence:'design:test',fitEffect:{attachment:'formed'},mismatchEffect:{gap:'exposed'}};
 assert.equal((await app.fitPieces({...contract,depth:1})).consequence.fits,true);
 assert.equal((await app.fitPieces({...contract,depth:2})).consequence.fits,false);
 const restored=new Foundation({store});await restored.ready;
 assert.equal(restored.lineage.pieces.size,2);
 assert.equal(restored.lineage.consequences.length,2);
 assert.equal(restored.lineage.pieces.get('child').qualities.length,1);
});
test('chat executes a selected Klein tool; upload runs actual guarded machine through every pipeline stage',async()=>{
 const app=new Foundation();
 const chat=await app.chat('klein-analogy "a:b::c:?"');
 assert.equal(chat.outcome.learned.mode,'known-call');
 const machine=await app.ingest({realizer:'state-machine',definition:{id:'motion',initial:'waiting',data:{moves:0},transitions:[{id:'move',from:'waiting',to:'moving',event:'MOVE',guard:{op:'eq',left:{op:'ref',path:'event.ready'},right:true},assign:{moves:{op:'add',args:[{op:'ref',path:'data.moves'},1]}}}]},events:[{type:'MOVE',ready:false},{type:'MOVE',ready:true}]});
 const state=machine.record.execution.result.returnValue;
 assert.equal(state.state,'moving');assert.equal(state.data.moves,1);
 assert.equal(state.history[0].type,'rejected');
 assert.equal(machine.outcome.pipeline.stages.length,11);
 assert.equal(machine.outcome.pipeline.stages.find(x=>x.stage==='ontological-address').ok,true);
 assert.deepEqual(Object.keys(machine.outcome.pipeline.allocation),['Movement','Evolution','Being','Design','Space']);
});
test('event cycles obey a budget and journal write failures keep the landed prefix',async()=>{
 const store=new BrowserAutomataStore();const app=new Foundation({store});
 const machine=app.runtime.createMachine({id:'cycle',initial:'idle',maxSteps:2,transitions:[{from:'idle',to:'idle',event:'LOOP',effects:['again']}]},{again:()=>({emit:[{type:'LOOP'}]})});
 await assert.rejects(machine.send('LOOP'),/budget exhausted/);
 assert.equal(machine.history.length,2);
 await app.ingest('landed',{name:'first.txt'});
 const put=store.put.bind(store);
 store.put=async(key,value)=>{if(key==='foundation:journal')throw Error('storage full');return put(key,value);};
 await assert.rejects(app.ingest('next',{name:'next.txt'}),/storage full/);
 await assert.rejects(app.ingest('later',{name:'later.txt'}),/Reload/);
 const saved=await store.get('foundation:journal');assert.equal(saved.length,1);
 const restored=new Foundation({store});await restored.ready;assert.equal(restored.history.length,1);
});

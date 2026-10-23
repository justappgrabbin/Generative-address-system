import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AddressedField,coordinateKey} from '../src/addressed-field.mjs';
import {parseAddress,serializeAddress,evaluateTransition} from '../src/operational-address.mjs';
import {Foundation} from '../src/foundation.mjs';
import {BrowserAutomataStore} from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
const address=(gate=1)=>({planetary:1,dimension:'Movement',gate,line:1,color:1,tone:1,base:1,degree:0,minute:0,second:0,arcFraction:0,zodiac:1,house:1});
const provenance={source:'test-fixture:synthetic-numeric-task',calculation:'Explicit test coordinates; no linguistic/HD correspondence asserted'};
const rule={version:'synthetic-test.v1',source:'test-fixture:explicit-binary-encoding',encodings:{gate:{1:'000000',2:'000001',3:'000011',4:'000111'}}};
function makeField(){const f=new AddressedField();f.installRule(rule);for(let gate=1;gate<=4;gate++)f.register({address:address(gate),provenance});return f;}
test('DMSA boundaries reject overflow/coercion and preserve coordinate and calculation evidence',()=>{
 for(const [field,lo,hi] of [['degree',0,29],['minute',0,59],['second',0,59],['arcFraction',0,99]]){
  for(const value of [lo,hi])assert.equal(parseAddress({...address(),[field]:value})[field],value);
  for(const value of [lo-1,hi+1,String(lo),NaN])assert.throws(()=>parseAddress({...address(),[field]:value},provenance),e=>e.details.field===field&&e.details.origin===provenance.source&&e.details.calculation===provenance.calculation);
 }
 assert.equal(serializeAddress(address()),serializeAddress(Object.fromEntries(Object.entries(address()).reverse())));
});
test('transitions inspect changed levels independently; absent mappings trigger investigation',()=>{
 assert.equal(evaluateTransition(address(1),address(2),rule).status,'PERMITTED');
 assert.equal(evaluateTransition(address(1),address(3),rule).status,'BLOCKED');
 const both={...address(2),line:2};
 const r=evaluateTransition(address(1),both,{...rule,encodings:{...rule.encodings,line:{1:'000',2:'001'}}});
 assert.equal(r.status,'PERMITTED');assert.deepEqual(r.checks.map(x=>x.distance),[1,1]);
 assert.equal(evaluateTransition(address(1),both,rule).status,'INVESTIGATE');
 assert.equal(evaluateTransition(address(1),address(2)).status,'INVESTIGATE');
});
test('coactivity creates permitted edges and delivered messages alter receiver computations',()=>{
 const f=makeField(),g=makeField();
 const input=[1,0.3],out=f.run({candidates:[address(1),address(2),address(3)],input,tier:2,ruleVersion:rule.version,provenance});
 const isolated=g.run({candidates:[address(2)],input,provenance});
 assert.equal(out.micro.length,2);assert.equal(f.edges.length,2);
 assert.notEqual(out.micro[1].value,isolated.micro[0].value);
 assert.equal(out.messages[0].packet.type,'field.activation.v1');assert.equal(out.Space.kind,'derived-shared-field-readout');
 assert.equal(f.audit().slots.Space.available,64);assert.equal(f.nodes.size,4);
 assert.equal(f.slots({dimension:'Movement'}).slots.length,64);
 assert.equal(f.slots({dimension:'Movement'}).activationMaskHex,'0000000000000003');
 assert.equal(f.slots({dimension:'Space'}).activationMaskHex,'0000000000000003');
 assert.equal(f.slots({dimension:'Being'}).activationMaskHex,'0000000000000000');
 const reordered=makeField().run({candidates:[address(2),address(1)],input,tier:2,ruleVersion:rule.version,provenance});
 assert.equal(out.micro[1].value,reordered.micro[0].value);
});
test('learning and explicit transfer change held-out behavior and survive snapshot restoration',()=>{
 const f=makeField(),input=[0.6,0.2],heldOut=[0.7,0.1];
 const donor=f.nodes.get(coordinateKey(address(1))),recipient=f.nodes.get(coordinateKey(address(2)));
 const initial=recipient.component.forward(heldOut).value;
 for(let i=0;i<100;i++)f.run({candidates:[address(1)],input,feedback:0.8,provenance});
 const transferred=f.transfer({from:address(1),to:address(2),ruleVersion:rule.version,provenance});
 assert.equal(transferred.status,'TRANSFERRED');
 assert.ok(Math.abs(recipient.component.forward(heldOut).value-0.8)<Math.abs(initial-0.8));
 const restored=new AddressedField().restore(JSON.parse(JSON.stringify(f.snapshot())));
 assert.deepEqual(restored.snapshot(),f.snapshot());
 assert.equal(restored.nodes.get(coordinateKey(address(2))).component.forward(heldOut).value,recipient.component.forward(heldOut).value);
});
test('nested composition retains lineage, perspective preserves identity, Space cannot allocate weights',()=>{
 const f=makeField();let child=coordinateKey(address(1));
 for(let i=0;i<100;i++)child=f.compose({children:[child,coordinateKey(address(2))],operator:'ordered-composition',provenance}).id;
 assert.equal(f.compositions.length,100);assert.equal(f.compositions[99].children[0],'composition:99');
 assert.equal(f.view(address(1),'Space').key,f.view(address(1),'Being').key);
 assert.throws(()=>f.register({address:{...address(),dimension:'Space'},provenance}),/emergent/);
 assert.throws(()=>f.register({address:address(),provenance}),/Occupied/);
});
test('actual Klein chat and field commands persist through the same foundation journal with exact replay',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 const contact=await app.chat('A person builds a tool in a room because it helps.');
 assert.ok(contact.fiveW);assert.equal(contact.fieldContact.status,'INVESTIGATE');
 assert.equal(contact.fieldContact.observation.tool_evidence.executionStatus,true);
 for(const a of [address(1),address(2)])await app.fieldCommand({operation:'register',payload:{address:a,provenance}});
 await app.fieldCommand({operation:'installRule',payload:rule});
 for(let i=0;i<4;i++)await app.fieldCommand({operation:'run',payload:{candidates:[address(1),address(2)],input:[0.6,0.2],tier:2,ruleVersion:rule.version,feedback:0.8,provenance}});
 const restored=new Foundation({store});await restored.ready;
 assert.deepEqual(restored.field.snapshot(),app.field.snapshot());assert.equal(restored.history.length,app.history.length);
 assert.ok(app.field.edges.length>0);assert.equal(app.field.observations[0].modality,'text');
});
test('photo recovery returns real PNG bytes after restart; corruption fails verification',async()=>{
 const bytes=new Uint8Array(await readFile(new URL('./fixtures/gradient.png',import.meta.url)));
 const store=new BrowserAutomataStore(),app=new Foundation({store});
 const saved=await app.storePhoto({name:'gradient.png',mime:'image/png',bytes});
 const restored=new Foundation({store});await restored.ready;
 const recovered=restored.recoverPhoto(saved.id);
 assert.deepEqual(recovered.bytes,bytes);assert.equal(recovered.photo.semanticReconstruction,false);
 const record=restored.photoMemory.memory.records.values().next().value;record.bytes[0]^=1;
 assert.throws(()=>restored.recoverPhoto(saved.id),/verification/);
});
test('failed field commands roll back and landed state remains intact',()=>{
 const f=makeField(),before=f.snapshot();
 assert.throws(()=>f.execute({operation:'run',payload:{candidates:[address()],input:['not numeric',0],provenance}}));
 assert.deepEqual(f.snapshot(),before);
});
test('document dictionary adapter retains sourced definitions, refuses persuasion, and replays',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 await app.fieldCommand({operation:'dictionary',payload:{operation:'extract',entries:[{term:'example',definition:'An explicit fixture definition',source:'fixture:dictionary'}]}});
 const restored=new Foundation({store});await restored.ready;
 const result=await restored.fieldCommand({operation:'dictionary',payload:{operation:'query',term:'example'}});
 assert.equal(result.field.definitions[0].source,'fixture:dictionary');
 const denied=await restored.fieldCommand({operation:'dictionary',payload:{operation:'narrate',query:'example'}});
 assert.equal(denied.field.status,'UNAVAILABLE');
 assert.equal(JSON.stringify(denied).includes('doubtBypassed'),false);
 const contact=await restored.chat('Explain the example.');
 assert.equal(contact.outcome.contact.documentRouting.legacyNarrativeEnabled,false);
 assert.equal(restored.audit().system.ok,true);
});

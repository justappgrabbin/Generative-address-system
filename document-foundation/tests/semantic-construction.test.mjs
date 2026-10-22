import test from 'node:test';
import assert from 'node:assert/strict';
import {Foundation} from '../src/foundation.mjs';
import {BrowserAutomataStore} from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
const frame=color=>({width:2,height:2,rgba:new Uint8Array(Array.from({length:4},()=>[...color,255]).flat())});
const address=gate=>({planetary:1,dimension:'Being',gate,line:1,color:1,tone:1,base:1,degree:0,minute:0,second:0,arcFraction:0,zodiac:1,house:1});
async function setup(){
 const store=new BrowserAutomataStore(),app=new Foundation({store}),ids=[];await app.ready;
 for(const [i,[label,color]] of [['R',[255,0,0]],['G',[0,255,0]],['B',[0,0,255]]].entries()){
  const r=await app.imageCommand({operation:'analyze',source:`fixture:${label}`,frame:frame(color)});ids.push(r.image.id);
  await app.imageCommand({operation:'bind',imageId:r.image.id,address:address(i+1),provenance:{source:'fixture:supplied-coordinate'}});
  await app.imageCommand({operation:'teach',imageId:r.image.id,label,source:'fixture:observed-label'});
 }
 const example=await app.imageCommand({operation:'compose',recipe:{width:4,height:2,background:[0,0,0,255],source:'fixture:observed-layout',parts:[{imageId:ids[0],x:0,y:0},{imageId:ids[1],x:2,y:0}]}});
 await app.imageCommand({operation:'learn-program',imageId:example.image.id,name:'Pair',source:'fixture:demonstrated-rule'});
 return {app,store,ids,example};
}
test('field-owned meaning and representations generate an unstored combination without image-cache lookup',async()=>{
 const {app,store,ids,example}=await setup();
 assert.equal(app.field.semantic.derived.size,0);
 // Removing the sidecar image cache must not remove addressed knowledge.
 app.imageMemory.images.clear();
 assert.equal(app.imageArtifact(ids[0]).renderSource,'ADDRESSED_FIELD_REPRESENTATION');
 const result=await app.imageCommand({operation:'generate',program:'Pair',terms:['B','R'],source:'fixture:novel-request'});
 assert.equal(result.construction.renderSource,'ADDRESSED_FIELD_REPRESENTATIONS');
 assert.deepEqual(result.fieldExecution.run.micro.map(n=>n.gate),[3,1]);
 const state=app.field.semantic.read(result.image.fieldAddress),pixels=state.representation.structure;
 assert.equal(result.image.fieldAddress.kind,'composition');assert.equal(app.field.semantic.derived.size,1);
 const rgba=app.imageMemory.reconstruct(result.image.id).rgba;
 assert.deepEqual(Array.from(rgba.slice(0,16)),[0,0,255,255,0,0,255,255,255,0,0,255,255,0,0,255]);
 assert.notEqual(result.image.pixelSha256,example.image.pixelSha256);assert.ok(pixels.nodes.length>0);
 const restored=new Foundation({store});await restored.ready;
 assert.deepEqual(restored.field.snapshot(),app.field.snapshot());
 assert.deepEqual((await restored.readImageArtifact(result.image.id)).bytes,app.imageArtifact(result.image.id).bytes);
});
test('correction, missing meanings, capitalization and ambiguity affect resolution instead of invented defaults',async()=>{
 const {app,ids}=await setup();
 const before=app.imageMemory.images.size;
 for(const terms of [['unknown','G'],['r','G']]){
  const r=await app.imageCommand({operation:'generate',program:'Pair',terms,source:'fixture:unresolved'});assert.equal(r.ok,false);assert.equal(r.semantic.status,'INVESTIGATE');
 }
 assert.equal(app.imageMemory.images.size,before);
 await app.imageCommand({operation:'teach',imageId:ids[2],label:'R',source:'fixture:ambiguous-label'});
 const ambiguous=await app.imageCommand({operation:'generate',program:'Pair',terms:['R','G'],source:'fixture:ambiguity'});
 assert.equal(ambiguous.semantic.resolution.matches[0].status,'AMBIGUOUS');
 await app.imageCommand({operation:'teach',imageId:ids[2],label:'B',source:'fixture:correction'});
 const resolved=await app.imageCommand({operation:'generate',program:'Pair',terms:['R','G'],source:'fixture:resolved'});
 assert.equal(resolved.ok,true);assert.ok(app.field.semantic.teaching.length>=5);
});
test('a generated addressed whole becomes a constituent under the same learned operator',async()=>{
 const {app}=await setup();
 const first=await app.imageCommand({operation:'generate',program:'Pair',terms:['B','R'],source:'fixture:first-scale'});
 await app.imageCommand({operation:'teach',imageId:first.image.id,label:'BR',source:'fixture:composite-name'});
 const second=await app.imageCommand({operation:'generate',program:'Pair',terms:['BR','G'],source:'fixture:next-scale'});
 assert.equal(second.image.fieldAddress.operands[0].kind,'composition');
 assert.deepEqual(second.image.fieldAddress.operands[0],first.image.fieldAddress);
 const repeat=await app.imageCommand({operation:'generate',program:'Pair',terms:['B','R'],source:'fixture:repeat'});
 assert.equal(repeat.construction.witnessedAgain,true);assert.equal(repeat.image.pixelSha256,first.image.pixelSha256);
});
test('context in the shared field changes constructed pixels for the same request without a GPU or source image cache',async()=>{
 const {app,ids}=await setup();
 for(const [frame,foreground] of [['first-frame',ids[0]],['second-frame',ids[2]]]){
  await app.fieldCommand({operation:'defineStructure',payload:{id:frame,dimension:'Being',source:'fixture:observed-frame'}});
  for(const [imageId,term] of [[foreground,'foreground'],[ids[1],'background']])await app.fieldCommand({operation:'teachMeaning',payload:{ref:app.field.semantic.refFor(imageId),term,source:'fixture:contextual-image-use',context:{dominatingStructure:frame}}});
 }
 const savedFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('external service called');};
 try {
  app.imageMemory.images.clear();
  const request={operation:'generate',program:'Pair',terms:['foreground','background'],source:'fixture:same-image-request'};
  const a=await app.imageCommand({...request,dominatingStructure:'first-frame'});
  const b=await app.imageCommand({...request,dominatingStructure:'second-frame'});
  assert.equal(a.ok,true);assert.equal(b.ok,true);
  assert.notEqual(a.image.pixelSha256,b.image.pixelSha256);
  assert.deepEqual(Array.from(app.imageMemory.reconstruct(a.image.id).rgba.slice(0,4)),[255,0,0,255]);
  assert.deepEqual(Array.from(app.imageMemory.reconstruct(b.image.id).rgba.slice(0,4)),[0,0,255,255]);
  assert.equal(a.image.fieldAddress.dominatingStructure,'first-frame');
  assert.equal(b.image.fieldAddress.dominatingStructure,'second-frame');
  const ablated=await app.imageCommand(request);assert.equal(ablated.ok,false);
  const replay=new Foundation({store:app.store});await replay.ready;
  assert.deepEqual(replay.field.snapshot(),app.field.snapshot());
 }finally{globalThis.fetch=savedFetch;}
});

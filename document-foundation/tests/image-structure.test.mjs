import test from 'node:test';
import assert from 'node:assert/strict';
import {decomposeImage,reconstructImage,composeImage,measurePixels} from '../src/image-structure.mjs';
import {ImageMemory} from '../src/image-memory.mjs';
import {VisualSensory} from '../src/visual-sensory.mjs';
import {Foundation} from '../src/foundation.mjs';
import {BrowserAutomataStore} from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
const solid=(r,g,b,width=7,height=5)=>({width,height,rgba:new Uint8Array(Array.from({length:width*height},()=>[r,g,b,255]).flat())});
test('image grammar reconstructs decoded RGBA exactly across odd, narrow, transparent and irregular images',()=>{
 for(const [width,height] of [[1,1],[1,19],[23,1],[7,11],[32,31]]){
  const rgba=Uint8Array.from({length:width*height*4},(_,i)=>(i*47+Math.floor(i/11))%256);
  const grammar=decomposeImage({width,height,rgba,source:'fixture:measured-pixels',tileSize:2});
  assert.deepEqual(new Uint8Array(reconstructImage(grammar).rgba),rgba);
  assert.equal(grammar.nodes.some(n=>n.op==='split'),width*height>4);
 }
 const uniform=decomposeImage({...solid(5,6,7,200,200),source:'fixture:solid'});
 assert.equal(uniform.nodes.length,1);assert.equal(uniform.metrics.literalBytes,0);
});
test('incomplete, cyclic and altered image structures fail verification',()=>{
 const grammar=decomposeImage({...solid(1,2,3),source:'fixture'});
 grammar.nodes[0]={id:0,op:'split',width:7,height:5,children:[{node:0,x:0,y:0}]};
 assert.throws(()=>reconstructImage(grammar),/cyclic/);
 const memory=new ImageMemory();memory.store({id:'original',...solid(4,5,6),source:'fixture'});
 memory.images.get('original').structure.nodes[0].color[0]++;
 assert.throws(()=>memory.reconstruct('original'),/integrity/);
 assert.throws(()=>decomposeImage({...solid(1,2,3),rgba:[1,2,3],source:'fixture'}),/RGBA/);
});
test('a new composition is rendered from existing primitives with traceable source parts',()=>{
 const memory=new ImageMemory();memory.store({id:'red',...solid(255,0,0,2,2),source:'fixture:red'});memory.store({id:'blue',...solid(0,0,255,2,2),source:'fixture:blue'});
 const recipe={width:4,height:2,background:[0,0,0,255],source:'fixture:new-layout',parts:[{imageId:'red',x:0,y:0},{imageId:'blue',x:2,y:0}]};
 const image=memory.compose(recipe,'new');
 const rgba=memory.reconstruct('new').rgba;
 assert.deepEqual(Array.from(rgba.slice(0,16)),[255,0,0,255,255,0,0,255,0,0,255,255,0,0,255,255]);
 assert.equal(image.lineage.parts.length,2);assert.notEqual(image.pixelSha256,memory.summary('red').pixelSha256);
 const artifact=memory.artifact('new');assert.equal(String.fromCharCode(...artifact.bytes.slice(0,2)),'BM');assert.equal(new DataView(artifact.bytes.buffer).getInt32(18,true),4);
 assert.throws(()=>composeImage({...recipe,parts:[{imageId:'absent',x:0,y:0}]},id=>memory.images.get(id)?.structure),/Unknown source/);
});
test('geometric image operations preserve exact pixels through inverse composition',()=>{
 const frame={width:3,height:2,rgba:Uint8Array.from([1,2,3,255,4,5,6,255,7,8,9,255,10,11,12,255,13,14,15,255,16,17,18,255])};
 const memory=new ImageMemory();memory.store({id:'original',...frame,source:'fixture'});
 memory.compose({width:2,height:3,source:'fixture:rotation',background:[0,0,0,0],parts:[{imageId:'original',x:0,y:0,quarterTurns:1}]},'rotated');
 memory.compose({width:3,height:2,source:'fixture:inverse',background:[0,0,0,0],parts:[{imageId:'rotated',x:0,y:0,quarterTurns:3}]},'restored');
 assert.deepEqual(new Uint8Array(memory.reconstruct('restored').rgba),frame.rgba);
});
test('visual learning uses sourced examples and corrections change held-out candidate labels',()=>{
 const memory=new ImageMemory();for(const [id,color] of [['red',[255,0,0]],['blue',[0,0,255]],['heldout',[250,2,1]]])memory.store({id,...solid(...color),source:`fixture:${id}`});
 assert.equal(memory.recognize('heldout').status,'INVESTIGATE');
 memory.teach({imageId:'red',label:'red sample',source:'fixture:teacher'});memory.teach({imageId:'blue',label:'blue sample',source:'fixture:teacher'});
 assert.equal(memory.recognize('heldout').candidates[0].label,'red sample');
 memory.teach({imageId:'red',label:'corrected red label',source:'fixture:correction'});
 assert.equal(memory.recognize('heldout').candidates[0].label,'corrected red label');assert.equal(memory.feedback.length,3);
 assert.equal(memory.recognize('red').taughtLabel.label,'corrected red label');
});
test('supplied Klein sensory adapter receives measured appearance without hash or temporal noise',()=>{
 const adapter=new VisualSensory(),frame=solid(128,64,32),measurements=measurePixels(frame.width,frame.height,frame.rgba);
 const a=adapter.observe({id:'first-name',...frame,measurements}),b=adapter.observe({id:'different-name',...frame,measurements});
 assert.deepEqual(a.frameEmbedding,b.frameEmbedding);assert.ok([...a.frameEmbedding].every(Number.isFinite));
 assert.ok(Math.abs(a.raw.values.brightness-(128+64+32)/3/255)<1e-12);assert.equal(a.timestamp,null);assert.equal(a.semanticConfidence,'UNKNOWN');
 assert.throws(()=>adapter.hashEmbedding('anything'),/never an identifier hash/);
});
test('visual contact, taught meaning, explicit address activation, learning and generated artifacts replay together',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 const ingest=await app.imageCommand({operation:'analyze',source:'fixture:camera',frame:solid(180,60,20)}),imageId=ingest.image.id;
 assert.equal(ingest.dictionary.observationCount,1);assert.equal(ingest.fieldExecution.status,'INVESTIGATE');
 const address={planetary:1,dimension:'Being',gate:37,line:2,color:3,tone:4,base:1,degree:29,minute:59,second:59,arcFraction:99,zodiac:12,house:12};
 await app.imageCommand({operation:'bind',imageId,address,provenance:{source:'fixture:explicit-supplied-address'}});
 await app.imageCommand({operation:'teach',imageId,label:'taught visual label',source:'fixture:teacher',outcome:0.7});
 const heldout=await app.imageCommand({operation:'analyze',source:'fixture:second-camera-frame',frame:solid(178,61,21)});
 assert.equal(heldout.recognition.candidates[0].label,'taught visual label');
 assert.equal(heldout.fieldExecution.run.micro[0].gate,37);assert.equal(heldout.fieldExecution.selection.source,imageId);
 const generated=await app.imageCommand({operation:'compose',recipe:{width:14,height:5,background:[255,255,255,255],source:'fixture:user-layout',parts:[{imageId,x:0,y:0},{imageId:heldout.image.id,x:7,y:0}]}});
 const before=app.imageArtifact(generated.image.id),restored=new Foundation({store});await restored.ready;
 const stored=await restored.readImageArtifact(generated.image.id);assert.deepEqual(stored.bytes,before.bytes);
 assert.deepEqual(restored.imageArtifact(generated.image.id).bytes,before.bytes);assert.deepEqual(restored.field.snapshot(),app.field.snapshot());
 assert.equal(restored.imageMemory.feedback.length,1);assert.equal(restored.documentToolPolicy.observations.length,3);
 const failed=await restored.imageCommand({operation:'decode-failure',photoId:'fixture:broken',error:'decoder refused bytes'});
 assert.equal(failed.ok,false);assert.equal(failed.fieldContact.observation.failure.operation,'native-photo-decode');
 const location=restored.imageMemory.summary(generated.image.id).artifact.location,corrupt=await store.get(location);corrupt.bytes[0]^=1;await store.put(location,corrupt);
 await assert.rejects(restored.readImageArtifact(generated.image.id),/integrity/);
});
test('failed journal writes leave immutable orphan outputs without blocking a fresh image after recovery',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 const put=store.put.bind(store);let fail=true;
 store.put=async(key,value)=>{if(fail&&key==='foundation:journal')throw new Error('journal unavailable');return put(key,value);};
 await assert.rejects(app.imageCommand({operation:'analyze',source:'fixture:unacknowledged',frame:solid(255,0,0)}),/journal unavailable/);
 assert.equal(app.history.length,0);fail=false;
 const recovered=new Foundation({store});await recovered.ready;
 const landed=await recovered.imageCommand({operation:'analyze',source:'fixture:new-acknowledged',frame:solid(0,0,255)});
 assert.equal(landed.id,'entry:1');assert.equal(recovered.imageMemory.reconstruct(landed.image.id).rgba[2],255);
 const again=new Foundation({store});await again.ready;assert.equal(again.imageMemory.images.size,1);
});
test('replay refuses changed landed image results instead of silently rerolling them',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});
 await app.imageCommand({operation:'analyze',source:'fixture:landed',frame:solid(3,4,5)});
 const journal=await store.get('foundation:journal');journal[0].result.image.pixelSha256='different-version-output';await store.put('foundation:journal',journal);
 const restored=new Foundation({store});await assert.rejects(restored.ready,/versioned migration/);
});

import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../Synthia-Foundation-Offline.html',import.meta.url),'utf8');
const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const modules=new Map();
const blocked=()=>{throw Error('Optional facility used during offline verification');};
const context=vm.createContext({console,TextEncoder,TextDecoder,structuredClone,Uint8Array,ArrayBuffer,DataView,fetch:blocked,Worker:blocked,SharedWorker:blocked,WebAssembly:undefined,GPU:undefined});
for(const [id,url] of Object.entries(imports)){
 const source=Buffer.from(url.split(',')[1],'base64').toString();
 modules.set(id,new vm.SourceTextModule(source,{identifier:id,context}));
}
const foundation=modules.get('synthia/src/foundation.mjs');
await foundation.link(id=>{if(!modules.has(id))throw Error(`Offline dependency missing: ${id}`);return modules.get(id);});
await foundation.evaluate();
const app=new foundation.namespace.Foundation();await app.ready;
const result=await app.ingest({realizer:'expression-ir',expression:{op:'add',args:[20,22]}});
if(result.record.execution.result.returnValue!==42)throw Error('Offline execution failed');
await app.chat('the bird moves');
if(app.system.engine.toolsById.get('diseminer').ownedState.getStats().words<3)throw Error('Offline native learning disconnected');
const generated=await app.fieldCommand({operation:'factory',payload:{operation:'generate',source:'offline-check',purpose:'analyze observations',level:4,address:{planetary:1,dimension:'Being',gate:25,line:4,color:3,tone:2,base:5,degree:0,minute:0,second:0,arcFraction:0,zodiac:1,house:1}}});
const executed=await app.runTool({tool:generated.factory.toolId,source:'offline-check',input:'observation'});
if(executed.tool.output.occurrences!==1)throw Error('Offline factory execution disconnected');
for(const [name,content] of [['answer.py','print(42)'],['answer.rb','puts 42'],['answer.lua','print(42)'],['answer.c','#include <stdio.h>\nint main(){printf("%d\\n",42);return 0;}']]){
 const result=await app.ingest(content,{name});
 if(!result.ok||result.outcome.result.stdout.join('\n')!=='42')throw Error(`Offline interpreter failed: ${name}`);
}
const rgba=Uint8Array.from({length:7*5*4},(_,i)=>(i*47)%256);
const analyzed=await app.imageCommand({operation:'analyze',source:'offline:measured-pixels',frame:{width:7,height:5,rgba}});
const pixels=app.imageMemory.reconstruct(analyzed.image.id).rgba;
if(pixels.length!==rgba.length||pixels.some((value,i)=>value!==rgba[i]))throw Error('Offline pixel reconstruction differs');
const solid=await app.imageCommand({operation:'analyze',source:'offline:solid',frame:{width:1,height:1,rgba:Uint8Array.from([10,20,30,255])}});
const composed=await app.imageCommand({operation:'compose',recipe:{width:2,height:1,background:[0,0,0,255],source:'offline:new-layout',parts:[{imageId:solid.image.id,x:0,y:0},{imageId:solid.image.id,x:1,y:0}]}});
const rendered=app.imageMemory.reconstruct(composed.image.id).rgba;
if(Array.from(rendered).join(',')!=='10,20,30,255,10,20,30,255')throw Error('Offline image construction differs');
console.log(`Offline module graph: ${modules.size} modules parsed; expression, native learning, generated tool, four source languages, exact RGBA reconstruction and new image composition passed with optional facilities unavailable.`);

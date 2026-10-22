import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../Synthia-Foundation-Offline.html',import.meta.url),'utf8');
const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const modules=new Map();
for(const [id,url] of Object.entries(imports)){
 const source=Buffer.from(url.split(',')[1],'base64').toString();
 modules.set(id,new vm.SourceTextModule(source,{identifier:id}));
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
console.log(`Offline module graph: ${modules.size} modules parsed; executed 42, native learning, and a generated tool.`);

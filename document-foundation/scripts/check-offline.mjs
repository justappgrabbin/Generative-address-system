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
console.log(`Offline module graph: ${modules.size} modules parsed; foundation linked and executed 42.`);

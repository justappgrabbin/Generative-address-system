import {Foundation} from './foundation.mjs';
const app=new Foundation();globalThis.synthiaFoundation=app;
const el=id=>document.getElementById(id);
const show=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x instanceof Uint8Array?{__synthiaBytes:Array.from(x)}:x,2);
const append=(target,title,content)=>{const box=document.createElement('article');const heading=document.createElement('strong');heading.textContent=title;const pre=document.createElement('pre');pre.textContent=typeof content==='string'?content:show(content);box.append(heading,pre);el(target).append(box);};
const describe=r=>r.field??r.photo??{address:r.record?.address?.id,path:r.record?.execution?.path,fiveW:r.fiveW,fieldContact:r.fieldContact};
const refresh=()=>{el('audit').textContent=show(app.audit());el('status').textContent=`Foundation ready · ${app.history.length} landed entries`;};
async function run(task){el('status').textContent='Processing through the foundation…';try{const r=await task();append('activity',`${r.id} · ${r.ok?'Executed':'Execution evidence recorded'}`,describe(r));refresh();return r;}catch(e){el('status').textContent=`Processing issue: ${e.message}`;throw e;}}
await app.ready;refresh();const storage=await app.store.audit();el('status').textContent+=` · ${storage.durable?'Saved on this device':'Memory session; export to retain history'}`;
for(const entry of app.history){if(entry.kind==='chat'){append('messages','You',entry.input);append('messages','Synthia',entry.result.outcome.utterance);}append('activity',`${entry.id} · restored`,describe(entry.result));}
for(const tool of app.tools()){const option=document.createElement('option');option.value=tool.id;option.textContent=tool.id;el('tools').append(option);}
el('tools').onchange=()=>{if(el('tools').value)el('text').value=el('tools').value+' ""';};
el('chat').onsubmit=async event=>{event.preventDefault();const text=el('text').value;append('messages','You',text);el('text').value='';try{const r=await run(()=>app.chat(text));append('messages','Synthia',r.outcome.utterance);}catch{}};
el('files').onchange=async()=>{for(const file of el('files').files){try{await run(()=>app.ingest(file));}catch{}}};
el('sample').onclick=()=>run(()=>app.ingest({realizer:'expression-ir',expression:{op:'mul',args:[6,7]}},{name:'calculation.json'}));
el('export').onclick=()=>{const blob=new Blob([show(app.export())],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='synthia-landed-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
el('field-command').onsubmit=async event=>{event.preventDefault();try{const commands=JSON.parse(el('command').value);for(const command of Array.isArray(commands)?commands:[commands])await run(()=>app.fieldCommand(command));}catch(e){el('status').textContent=`Field issue: ${e.message}`;}};
function renderPhotos(){el('photo-list').replaceChildren();for(const photo of app.photos.values()){
 const row=document.createElement('article'),label=document.createElement('span'),button=document.createElement('button');
 label.textContent=`${photo.name} · ${photo.byteLength} bytes · exact original recovery `;button.textContent='Open recovered photo';
 button.onclick=()=>{try{const result=app.recoverPhoto(photo.id),url=URL.createObjectURL(new Blob([result.bytes],{type:photo.mime}));el('photo-preview').src=url;el('photo-preview').onload=()=>URL.revokeObjectURL(url);}catch(e){el('status').textContent=e.message;}};
 row.append(label,button);el('photo-list').append(row);
}}
el('photo-files').onchange=async()=>{for(const file of el('photo-files').files){try{await run(()=>app.storePhoto(file));}catch{}}renderPhotos();};
renderPhotos();

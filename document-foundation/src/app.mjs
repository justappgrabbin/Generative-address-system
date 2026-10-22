import {Foundation} from './foundation.mjs';
const app=new Foundation();globalThis.synthiaFoundation=app;
const el=id=>document.getElementById(id);
const show=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x instanceof Uint8Array?{__synthiaBytes:Array.from(x)}:x,2);
const append=(target,title,content)=>{const box=document.createElement('article');const heading=document.createElement('strong');heading.textContent=title;const pre=document.createElement('pre');pre.textContent=typeof content==='string'?content:show(content);box.append(heading,pre);el(target).append(box);};
const describe=r=>r.tool??r.field??r.image??r.semanticProgram??r.semantic??r.imageFeedback??r.imageFailure??r.imageBinding??r.photo??{address:r.record?.address?.id,path:r.record?.execution?.path,fiveW:r.fiveW,fieldContact:r.fieldContact};
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
el('field-command').onsubmit=async event=>{event.preventDefault();try{const commands=JSON.parse(el('command').value);for(const command of Array.isArray(commands)?commands:[commands])await run(()=>app.fieldCommand(command));renderImages();}catch(e){el('status').textContent=`Field issue: ${e.message}`;}};
function renderPhotos(){el('photo-list').replaceChildren();for(const photo of app.photos.values()){
 const row=document.createElement('article'),label=document.createElement('span'),button=document.createElement('button'),analyze=document.createElement('button');
 label.textContent=`${photo.name} · ${photo.byteLength} bytes · exact original recovery `;button.textContent='Open recovered photo';
 button.onclick=()=>{try{const result=app.recoverPhoto(photo.id),url=URL.createObjectURL(new Blob([result.bytes],{type:photo.mime})),preview=el('photo-preview');preview.onload=()=>URL.revokeObjectURL(url);preview.onerror=()=>{URL.revokeObjectURL(url);preview.hidden=true;el('status').textContent='Original file bytes recovered, but the browser could not decode them as an image.';};preview.hidden=false;preview.src=url;}catch(e){el('status').textContent=e.message;}};
 analyze.textContent='Analyze and reconstruct pixels';analyze.onclick=async()=>{try{await run(()=>app.analyzePhoto(photo.id,{maxSide:Number(el('analysis-size').value)}));renderImages();}catch{}};
 row.append(label,button,analyze);el('photo-list').append(row);
}}
el('photo-files').onchange=async()=>{for(const file of el('photo-files').files){try{await run(()=>app.storePhoto(file));}catch{}}renderPhotos();};
renderPhotos();
async function showImageArtifact(id,download=false){
 try{const artifact=download?await app.readImageArtifact(id):app.imageArtifact(id),url=URL.createObjectURL(new Blob([artifact.bytes],{type:artifact.mime}));
  if(download){const a=document.createElement('a');a.href=url;a.download=id.replaceAll(':','-')+'.bmp';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  else {el('image-preview').onload=()=>URL.revokeObjectURL(url);el('image-preview').hidden=false;el('image-preview').src=url;const structure=app.imageMemory.images.get(id).structure;el('image-details').textContent=show({...app.imageMemory.summary(id),parts:{root:structure.root,showingFirst:Math.min(64,structure.nodes.length),nodes:structure.nodes.slice(0,64).map(n=>({id:n.id,op:n.op,width:n.width,height:n.height,color:n.color,children:n.children,pixelByteLength:n.pixels?.length}))},artifact:{sha256:artifact.sha256,alphaPolicy:artifact.alphaPolicy}});}
 }catch(error){el('status').textContent=error.message;}
}
function recognition(){const id=el('image-source').value;el('recognition').textContent=id?show(app.imageMemory.recognize(id)):'Upload a photo and analyze its pixels, then teach an example.';}
function renderImages(){
 for(const id of ['image-context','generation-context']){const select=el(id),previous=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent='Unspecified';select.append(empty);for(const name of app.field.structures.things.keys()){const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);}select.value=[...select.options].some(o=>o.value===previous)?previous:'';}

 for(const name of ['image-source','compose-left','compose-right','program-example']){const select=el(name),previous=select.value;select.replaceChildren();for(const image of app.imageMemory.images.values()){if(name==='program-example'&&!image.lineage?.parts?.length)continue;const option=document.createElement('option');option.value=image.id;option.textContent=`${image.id} · ${image.width} × ${image.height}`;select.append(option);}if([...select.options].some(o=>o.value===previous))select.value=previous;}
 const programs=el('generation-program'),previous=programs.value;programs.replaceChildren();for(const name of app.field.semantic.programs.keys()){const option=document.createElement('option');option.value=name;option.textContent=name;programs.append(option);}if([...programs.options].some(o=>o.value===previous))programs.value=previous;
 el('image-list').replaceChildren();for(const image of app.imageMemory.images.values()){
  const row=document.createElement('article'),label=document.createElement('span'),open=document.createElement('button'),save=document.createElement('button');
  label.textContent=`${image.id} · ${image.width} × ${image.height}${image.decode?.resampled?' · resized analysis':''} `;
  open.textContent='Reconstruct image';open.onclick=()=>showImageArtifact(image.id);save.textContent='Save image';save.onclick=()=>showImageArtifact(image.id,true);row.append(label,open,save);el('image-list').append(row);
 }
 recognition();
}
el('image-source').onchange=recognition;
el('teach-image').onsubmit=async event=>{event.preventDefault();try{await run(()=>app.imageCommand({operation:'teach',imageId:el('image-source').value,label:el('image-label').value,source:'user:visual-feedback',context:el('image-context').value?{dominatingStructure:el('image-context').value}:{}}));el('image-label').value='';renderImages();}catch{}};
el('compose-images').onsubmit=async event=>{event.preventDefault();try{
 const left=app.imageMemory.images.get(el('compose-left').value),right=app.imageMemory.images.get(el('compose-right').value);if(!left||!right)throw new Error('Analyze at least one photo first');
 const height=Math.min(512,left.height,right.height),lw=Math.max(1,Math.round(left.width*height/left.height)),rw=Math.max(1,Math.round(right.width*height/right.height));
 const result=await run(()=>app.imageCommand({operation:'compose',recipe:{width:lw+rw,height,background:[255,255,255,255],source:'user:side-by-side-composition',parts:[{imageId:left.id,x:0,y:0,width:lw,height},{imageId:right.id,x:lw,y:0,width:rw,height}]}}));renderImages();showImageArtifact(result.image.id);
 }catch(error){el('status').textContent=error.message;}};
renderImages();
el('learn-construction').onsubmit=async event=>{event.preventDefault();try{const result=await run(()=>app.imageCommand({operation:'learn-program',imageId:el('program-example').value,name:el('program-name').value,source:'user:demonstrated-construction'}));el('semantic-trace').textContent=show(result.semanticProgram??result.semantic);renderImages();}catch{}};
el('generate-state-image').onsubmit=async event=>{event.preventDefault();try{const terms=el('generation-terms').value.split(/\r?\n/u).map(s=>s.trim()).filter(Boolean);const result=await run(()=>app.imageCommand({operation:'generate',program:el('generation-program').value,terms,source:'user:semantic-request',dominatingStructure:el('generation-context').value||undefined}));el('semantic-trace').textContent=show(result.construction??result.semantic);renderImages();if(result.image)await showImageArtifact(result.image.id);}catch{}};

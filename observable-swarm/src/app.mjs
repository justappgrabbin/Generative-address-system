import { DIMENSIONS, representations, structuralView, FractalAddressSpace } from './semantics.mjs';
import { saveSnapshot, loadSnapshot } from './storage.mjs';
import { LocalModelAdapter } from './model-adapter.mjs';
import { renderScene } from './scene.mjs';
import { morphologyFor } from './morphology.mjs';

const $=id=>document.getElementById(id);
const COLORS=['#80e1c0','#ad91ec','#f1c77a','#f49aa6','#77aaf5'];
const worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
const pending=new Map();let requestId=0,state=null,selected='p001',running=false,initialized=false;
let eventMap=new Map(),inspectedEvents=[],zoom=1,canvasWidth=0,canvasHeight=0,frame=0;
const camera={x:.5,y:.5};
const model=new LocalModelAdapter();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const setStatus=message=>{$('status').textContent=message;};
function request(type,payload={}) {
  const id=++requestId;
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{pending.delete(id);reject(Error('Worker response timed out'));},60000);
    pending.set(id,{resolve,reject,timeout});worker.postMessage({id,type,payload});
  });
}
worker.onmessage=({data})=>{
  if(data.type==='state'){
    state=data.state;running=data.running;
    if(!initialized){initialize();initialized=true;}
    render();return;
  }
  const waiter=pending.get(data.id);if(!waiter)return;clearTimeout(waiter.timeout);pending.delete(data.id);
  if(data.ok)waiter.resolve(data);else waiter.reject(Error(data.error));
};
worker.onerror=error=>{setStatus(`Runtime error: ${error.message}`);for(const {reject,timeout} of pending.values()){clearTimeout(timeout);reject(Error(error.message));}pending.clear();};
const safe=fn=>async event=>{try{await fn(event);}catch(error){setStatus(error.message);}};
const command=(type,data)=>request('action',{type,data});
const selectedParticle=()=>state?.particles.find(p=>p.id===selected);
function options(select,values,chosen){select.replaceChildren(...values.map(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o;}));if(chosen!=null)select.value=chosen;}
function initialize(){
  $('legend').replaceChildren(...DIMENSIONS.map((d,i)=>{const span=document.createElement('span');const dot=document.createElement('i');dot.className='dot';dot.style.setProperty('--c',COLORS[i]);span.append(dot,document.createTextNode(d));return span;}));
  for(const d of DIMENSIONS){const o=document.createElement('option');o.value=d;o.textContent=d;$('view').append(o);}
  options($('line'),Array.from({length:6},(_,i)=>[String(i+1),String(i+1)]),'1');
  options($('expression-frame'),[['', 'Unresolved'],...DIMENSIONS.map(d=>[d,d])],'');
  for(const id of ['compare-a','compare-b','compare-c'])options($(id),state.particles.map(p=>[p.id,`${p.id} · G${p.gate}`]),id==='compare-b'?'p002':'p001');
  const specs=[['reinforcement','Reinforcement',0,0.2,0.001],['decay','Inactivity decay',0,0.05,0.0001],['learningRate','Learning rate',0,0.2,0.001],['encounterRadius','Encounter radius',0.03,0.4,0.005],['force','Force',0,5,0.05],['motion','Motion',0,2,0.05]];
  for(const [key,label,min,max,step] of specs){
    const row=document.createElement('label');row.className='parameter';const name=document.createElement('span');name.textContent=label;
    const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=state.params[key];input.id=`param-${key}`;
    const out=document.createElement('output');out.id=`value-${key}`;out.textContent=Number(input.value).toFixed(key==='decay'?4:3);
    input.addEventListener('input',()=>out.textContent=Number(input.value).toFixed(key==='decay'?4:3));
    input.addEventListener('change',safe(()=>command('parameters',{[key]:Number(input.value)})));
    row.append(name,input,out);$('parameters').append(row);
  }
  sourceRules();resize();
  $('scale').disabled=$('display').value==='scene';$('view').disabled=$('display').value==='scene';
  setStatus(reducedMotion?'Ready · motion paused for reduced-motion preference':'Ready · press Run to observe formation');
}
function fieldColor(p){const view=$('view').value;return COLORS[view==='all'?(Number(p.id.slice(1))-1)%5:DIMENSIONS.indexOf(view)];}
function coords(p){return {x:canvasWidth/2+(p.x-camera.x)*canvasWidth*zoom,y:canvasHeight/2+(p.y-camera.y)*canvasHeight*zoom};}
const canvas=$('field'),ctx=canvas.getContext('2d');
function resize(){const box=canvas.parentElement.getBoundingClientRect();canvasWidth=box.width;canvasHeight=box.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
new ResizeObserver(resize).observe(canvas.parentElement);
function centroid(ids){const ps=ids.map(id=>state.particles.find(p=>p.id===id)).filter(Boolean);return {x:ps.reduce((s,p)=>s+p.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.y,0)/ps.length};}
function draw(){
  if(!state||!ctx)return;ctx.clearRect(0,0,canvasWidth,canvasHeight);
  if($('display').value==='scene'){
    const result=renderScene(ctx,state,canvasWidth,canvasHeight,{selected,zoom,camera,overlay:$('overlay').checked});
    $('canvas-hint').textContent=`${zoom.toFixed(1)}× · ${zoom>2?'Neural relations within the same surface':'Particle-painted surface'} · ${result.faces} faces · object morphology not yet learned`;
    if(zoom<=2)return;
    ctx.save();ctx.globalAlpha=Math.min(1,(zoom-2)/2);
  }
  const particles=new Map(state.particles.map(p=>[p.id,p]));
  // A quiet spatial reference, not an imposed world grid.
  ctx.fillStyle='#1d3542';for(let x=26;x<canvasWidth;x+=44)for(let y=22;y<canvasHeight;y+=44){ctx.beginPath();ctx.arc(x,y,0.55,0,Math.PI*2);ctx.fill();}
  const scale=$('scale').value;
  if(scale==='particles'){
    for(const r of state.relations){const a=particles.get(r.from),b=particles.get(r.to);if(!a||!b||a.id>b.id)continue;
      const ac=coords(a),bc=coords(b),chosen=r.from===selected||r.to===selected;
      ctx.strokeStyle=chosen?`rgba(128,225,192,${0.2+r.strength*0.5})`:`rgba(122,170,202,${0.07+r.strength*0.23})`;
      ctx.lineWidth=chosen?1.2:0.5+r.strength*0.5;ctx.beginPath();ctx.moveTo(ac.x,ac.y);ctx.lineTo(bc.x,bc.y);ctx.stroke();
    }
    for(const p of state.particles){
      const c=coords(p),chosen=p.id===selected;ctx.fillStyle=fieldColor(p);ctx.globalAlpha=0.55+p.activation*0.45;
      ctx.beginPath();ctx.arc(c.x,c.y,chosen?4.8:1.8+p.activation*2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      if(chosen){ctx.strokeStyle='#b2f5df';ctx.lineWidth=1;ctx.beginPath();ctx.arc(c.x,c.y,11,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#c8eadf';ctx.font='11px ui-monospace, monospace';ctx.fillText(`${p.id} / G${p.gate}`,c.x+17,c.y+4);}
    }
  }else{
    const formations=state.formations.filter(f=>f.level===(scale==='bonds'?1:2));
    for(const f of formations){
      const center=coords(centroid(f.members)),radius=Math.min(48,8+Math.sqrt(f.members.length)*4);
      for(const id of f.members){const p=coords(particles.get(id));ctx.strokeStyle='#37525f';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.fillStyle='#6c9d9a';ctx.beginPath();ctx.arc(p.x,p.y,1.6,0,7);ctx.fill();}
      ctx.fillStyle='#10262c';ctx.strokeStyle='#80e1c080';ctx.lineWidth=1;ctx.beginPath();ctx.arc(center.x,center.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#b3e5d5';ctx.font='12px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(String(f.members.length),center.x,center.y+4);ctx.textAlign='left';
      if(f.members.includes(selected)){ctx.fillStyle='#9bb5c5';ctx.font='10px ui-monospace, monospace';ctx.fillText(`${f.children.length} constituents`,center.x+radius+7,center.y+3);}
    }
    if(!formations.length){ctx.fillStyle='#7995a7';ctx.font='12px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText('No stable formations at this scale yet. Run the substrate.',canvasWidth/2,canvasHeight/2);ctx.textAlign='left';}
  }
  if($('display').value==='scene')ctx.restore();
  if(zoom>=3){
    // Read one selected constituent deeply rather than wallpapering unrelated text.
    const p=selectedParticle(),at=coords(p),morphology=morphologyFor(p,{perspective:$('source-view').value[0].toUpperCase()+$('source-view').value.slice(1)});
    const x=Math.max(12,Math.min(canvasWidth-300,at.x+20)),y=Math.max(30,Math.min(canvasHeight-170,at.y-62));
    ctx.save();ctx.globalAlpha=Math.min(1,(zoom-3)/1.5);
    ctx.fillStyle='rgba(9,16,25,.88)';ctx.fillRect(x-8,y-19,Math.min(375,canvasWidth-24),155);
    ctx.font='11px ui-monospace,monospace';ctx.fillStyle='#92acbd';ctx.fillText(`${p.id} · G${p.gate}.${p.line}.${p.color}.${p.tone}.${p.base} · ${morphology.perspective} perspective`,x,y-3);
    morphology.tracks.forEach((track,i)=>{
      ctx.fillStyle=COLORS[DIMENSIONS.indexOf(track.dimension)];ctx.font='13px ui-monospace,monospace';
      // No universal vertical/diagonal rotation is invented; orientation is source-qualified.
      ctx.fillText(track.expression,x,y+21+i*21,Math.min(350,canvasWidth-40));
    });
    ctx.restore();
  }
}
function definitionList(entries){const dl=document.createElement('dl');dl.className='identity-data';for(const [key,value] of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;dl.append(dt,dd);}return dl;}
function render(){
  frame++;
  $('run').classList.toggle('running',running);$('run').setAttribute('aria-pressed',String(running));$('pause').setAttribute('aria-pressed',String(!running));
  const meshes=state.formations.filter(f=>f.level===2);
  $('metrics').textContent=`${state.particles.length} particles · ${state.relations.length} synapses · ${meshes.length} formations · t=${state.tick}`;
  $('event-count').textContent=`${state.eventCount.toLocaleString()} records`;
  if($('selection').options.length!==state.particles.length)options($('selection'),state.particles.map(p=>[p.id,p.id]),selected);
  const p=selectedParticle();if(!p){selected=state.particles[0].id;return render();}
  if(document.activeElement!==$('expression'))$('expression').value=p.expression;
  if(document.activeElement!==$('expression-frame'))$('expression-frame').value=p.directionFrame??'';
  $('direction-status').textContent=`First capital: ${p.direction.capital??'unassigned'} · ${p.direction.status}${p.direction.vector?' · '+p.direction.vector.join(', '):''}. Unsourced drift remains experimental.`;
  $('selection').value=selected;
  // A menu is also the keyboard-accessible alternative to canvas picking.
  for(const option of $('selection').options){const target=state.particles.find(p=>p.id===option.value);option.textContent=`${target.id} · Gate ${target.gate} / Line ${target.line}`;}
  const rep=representations(p),address=new FractalAddressSpace().at(BigInt((p.gate-1)*1080+(p.line-1)*180+(p.color-1)*30+(p.tone-1)*5+p.base-1));
  $('identity').replaceChildren(definitionList([
    ['Identity',p.id],['Hexagram',`${rep.symbol}  Gate ${p.gate} · Line ${p.line}`],['Pattern',`${rep.binary} / 0x${rep.hexadecimal}`],['Unicode',rep.unicode],['Address',address.uri??address.key??`${p.gate}.${p.line}.${p.color}.${p.tone}.${p.base}`],
    ['Origin',p.frame.originId],['Position',`${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}`],['Activation',p.activation.toFixed(4)],['Predictor MSE',state.loss==null?'No trained edges':state.loss.toFixed(6)]
  ]));
  $('frames').replaceChildren(...DIMENSIONS.map((d,i)=>{
    const row=document.createElement('div');row.className='frame-row';const label=document.createElement('span');label.textContent=d;label.style.color=COLORS[i];
    const bar=document.createElement('div');bar.className='bar';const fill=document.createElement('span');fill.style.setProperty('--c',COLORS[i]);fill.style.setProperty('--w',`${p.frames[d].activation*100}%`);bar.append(fill);
    const value=document.createElement('span');value.textContent=p.frames[d].activation.toFixed(2);row.append(label,bar,value);return row;
  }));
  $('potentials').replaceChildren(...p.potentials.map(p=>{const el=document.createElement('span');el.className='potential';el.textContent=p.id;el.title=p.status;return el;}));
  const morphology=morphologyFor(p,{perspective:'Being'});
  $('morphology').replaceChildren(...morphology.tracks.map(track=>{
    const row=document.createElement('div');row.className='source-row';const label=document.createElement('b');label.textContent=track.expression;
    const detail=document.createElement('small');detail.textContent=`${track.dimension} · ${track.definingFactors.map(f=>f.text).join(' → ')}`;
    row.append(label,document.createElement('br'),detail);return row;
  }));
  const connections=state.relations.filter(r=>r.from===p.id||r.to===p.id).sort((a,b)=>b.strength-a.strength);
  $('connections').replaceChildren(...connections.slice(0,20).map(r=>{
    const el=document.createElement('div');el.className='connection';const name=document.createElement('span'),value=document.createElement('span');value.className='weight';
    name.textContent=`${r.from} → ${r.to}`;value.textContent=`${r.weight.toFixed(3)} / ${r.strength.toFixed(2)}`;el.title=`Predictive weight / persistence strength · ${r.uses} uses${r.channel?' · '+r.channel.name:''}`;el.append(name,value);return el;
  }));
  if(!connections.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No active connections. Encounters create directed synapses.';$('connections').append(empty);}
  for(const [key,value] of Object.entries(state.params)){const input=$(`param-${key}`);if(input&&document.activeElement!==input){input.value=value;$(`value-${key}`).textContent=value.toFixed(key==='decay'?4:3);}}
  renderEvents();draw();
}
function eventDetail(e){
  if(e.type==='transition')return `G${e.from} → G${e.to} · line ${e.line} · leadership unresolved`;
  if(e.type==='comparison')return `G${e.comparison.original} : G${e.comparison.counterpart} :: G${e.comparison.appliedTo} : G${e.comparison.result}`;
  if(e.type==='relation-formed')return `${e.kind} · similarity ${e.comparison.similarity.toFixed(2)}${e.channel?' · '+e.channel.name:''}`;
  if(e.type.startsWith('formation'))return `${e.members?.length??''} members · constituents retained`;
  if(e.type==='learning-sample')return `MSE ${e.loss?.toFixed(6)??'—'} · ${e.trainedSynapses} synapses`;
  if(e.type==='perturbation')return `Force ${e.magnitude} · ${e.affected.length} connections affected`;
  if(e.type==='stimulus')return `${e.dimension} intervention · leadership unresolved`;
  if(e.type==='proposal')return `Untested · ${e.evidence.join(', ')}`;
  return e.status??e.provenance??'Record available';
}
function renderEvents(){
  if(!state)return;const filter=$('event-filter').value;
  const events=(filter==='selected'?inspectedEvents:state.events).filter(e=>filter==='all'||filter==='selected'||(filter==='formation'?e.type.startsWith('formation'):e.type===filter)).slice(-35).reverse();
  eventMap=new Map(events.map(e=>[e.id,e]));
  $('events').replaceChildren(...events.map(e=>{const row=document.createElement('tr');row.tabIndex=0;row.setAttribute('aria-label',`${e.type} at tick ${e.tick}`);
    for(const value of [e.tick,e.type,e.particleId??e.from??e.participants?.[0]??'—',e.to??e.participants?.[1]??'—',eventDetail(e)]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}
    const open=()=>{$('evidence').textContent=JSON.stringify(e,null,2);$('event-detail').open=true;};row.addEventListener('click',open);row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});return row;
  }));
  if(!events.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.textContent='No matching events. Run the swarm or change a line.';row.append(cell);$('events').append(row);}
}
function sourceRules(){
  const view=structuralView($('source-view').value);
  $('source-rules').replaceChildren(...view.fields.map(f=>{const row=document.createElement('div');row.className='source-row';const b=document.createElement('b');b.textContent=f.dimension+' · ';
    const properties=f.properties.chain??[f.properties.nature??f.properties.groupRole??f.properties.name??f.properties.chain??'See source'];
    row.append(b,document.createTextNode(Array.isArray(properties)?properties.join(' → '):String(properties)));return row;}));
  const note=document.createElement('p');note.className='hint';note.textContent=`Source perspective: ${view.source.tableSource}. Printed-page references in the original transcription differ from PDF page indices. Source order is not an inferred leading dimension.`;$('source-rules').append(note);
}
async function inspect(){const id=selected;const response=await request('inspect',{id});if(id!==selected)return;inspectedEvents=response.events;renderEvents();}
async function select(id){selected=id;render();await inspect();}
$('run').onclick=safe(()=>request('run',{running:true}));
$('pause').onclick=safe(()=>request('run',{running:false}));
$('step').onclick=safe(async()=>{await request('run',{running:false});await request('step');await inspect();});
$('reset').onclick=safe(async()=>{await request('reset');selected='p001';inspectedEvents=[];zoom=1;camera.x=.5;camera.y=.5;render();setStatus('Reset to the reproducible initial configuration');});
$('speed').oninput=safe(async()=>{const value=Number($('speed').value);$('speed-value').textContent=value+'×';await request('speed',{value});});
$('selection').onchange=safe(()=>select($('selection').value));
$('view').onchange=()=>draw();$('scale').onchange=()=>draw();$('fit').onclick=()=>{zoom=1;camera.x=.5;camera.y=.5;draw();};
$('display').onchange=()=>{
  const scene=$('display').value==='scene';
  $('legend').hidden=scene;$('palette-label').textContent=scene?'Experimental pigment · painted from live relations':'Display palette · colors do not assign dimensional ownership';
  $('scale').disabled=scene;$('view').disabled=scene;
  $('canvas-hint').textContent=scene?'The particles paint this surface · no target image':'Select a particle to follow its relations';
  draw();
};
$('overlay').onchange=()=>draw();
$('expression-form').onsubmit=safe(async e=>{e.preventDefault();await command('expression',{id:selected,text:$('expression').value,frame:$('expression-frame').value||null});await inspect();setStatus('Expression preserved with its first capital and dimensional frame');});
$('source-view').onchange=sourceRules;
$('event-filter').onchange=safe(async()=>{await inspect();renderEvents();});
$('transition').onclick=safe(async()=>{const {result}=await command('transition',{id:selected,line:Number($('line').value)});setStatus(`Identity ${selected} retained · ${result.direction} · meaning/leadership unresolved`);await inspect();});
$('stimulate').onclick=safe(async()=>{const dimension=$('view').value;if(dimension==='all')throw Error('Choose a dimensional view before stimulating it.');await command('stimulate',{id:selected,dimension});await inspect();setStatus(`${dimension} intervention recorded; leadership remains unresolved`);});
$('force').onclick=safe(async()=>{const {result}=await command('force',{id:selected,magnitude:state.params.force});await inspect();setStatus(`Perturbation recorded · ${result.affected.length} directed connections affected`);});
$('compare').onclick=safe(async()=>{
  const {result}=await command('compare',{a:$('compare-a').value,b:$('compare-b').value,c:$('compare-c').value});
  const c=result.comparison;$('comparison-result').textContent=`G${c.original} : G${c.counterpart} :: G${c.appliedTo} : G${c.result}\nChanged positions: ${c.difference.join(', ')||'none'} · similarity ${c.similarity.toFixed(3)}\n${result.id} · contextual comparison recorded; no transition executed.`;
  setStatus(`Klein comparison ${result.id} recorded`);
});
canvas.addEventListener('click',safe(async e=>{
  if(!state)return;const box=canvas.getBoundingClientRect(),point={x:e.clientX-box.left,y:e.clientY-box.top};
  let nearest,distance=24;
  for(const p of state.particles){const c=coords(p),d=Math.hypot(c.x-point.x,c.y-point.y);if(d<distance){distance=d;nearest=p;}}
  if($('scale').value!=='particles')for(const f of state.formations.filter(f=>f.level===($('scale').value==='bonds'?1:2))){const c=coords(centroid(f.members)),d=Math.hypot(c.x-point.x,c.y-point.y);if(d<distance){distance=d;nearest=state.particles.find(p=>p.id===f.members[0]);setStatus(`Formation: ${f.members.length} particles · ${f.children.length} children · first seen t=${f.createdAt}`);}}
  if(nearest)await select(nearest.id);
}));
canvas.addEventListener('wheel',e=>{
  e.preventDefault();const box=canvas.getBoundingClientRect(),x=(e.clientX-box.left-canvasWidth/2)/canvasWidth,y=(e.clientY-box.top-canvasHeight/2)/canvasHeight;
  const wx=camera.x+x/zoom,wy=camera.y+y/zoom;
  zoom=Math.max(.5,Math.min(16,zoom*Math.exp(-e.deltaY*.0015)));
  camera.x=wx-x/zoom;camera.y=wy-y/zoom;draw();
},{passive:false});
canvas.addEventListener('dblclick',()=>{const p=selectedParticle();if(p){camera.x=p.x;camera.y=p.y;zoom=Math.min(16,zoom*2);draw();}});
canvas.addEventListener('keydown',safe(async e=>{
  if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();const i=state.particles.findIndex(p=>p.id===selected);await select(state.particles[(i+(e.key==='ArrowRight'?1:-1)+state.particles.length)%state.particles.length].id);}
  if(e.code==='Space'){e.preventDefault();await request('run',{running:!running});}
}));
let saving=false;
async function save(key='manual'){
  if(saving)return; saving=true;
  try{const {snapshot}=await request('snapshot');await saveSnapshot(snapshot,key);if(key==='manual')setStatus(`Saved locally · tick ${snapshot.tick} · full history retained`);}finally{saving=false;}
}
$('save').onclick=safe(()=>save());
$('restore').onclick=safe(async()=>{
  const snapshot=await loadSnapshot('manual')??await loadSnapshot('autosave');
  if(!snapshot)throw Error('No local snapshot yet. Save a session first.');
  await request('restore',{snapshot});await inspect();setStatus(`Restored tick ${snapshot.tick} · simulation paused`);
});
$('export').onclick=safe(async()=>{
  const {snapshot}=await request('snapshot'),blob=new Blob([JSON.stringify(snapshot)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`synthia-t${snapshot.tick}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Exported state, weights, constituents, and event history');
});
$('import').onchange=safe(async()=>{
  const file=$('import').files[0];if(!file)return;if(file.size>32*1024*1024)throw Error('Import exceeds the 32 MB browser review budget');
  const snapshot=JSON.parse(await file.text());await request('restore',{snapshot});await inspect();$('import').value='';setStatus(`Imported tick ${snapshot.tick} · simulation paused`);
});
$('replay').onclick=safe(async()=>{
  await request('run',{running:false});const {snapshot}=await request('snapshot');setStatus('Replaying initial conditions and recorded actions…');
  const {snapshot:replayed}=await request('replay',{snapshot});
  const matches=JSON.stringify(snapshot)===JSON.stringify(replayed);setStatus(matches?`Replay verified · ${snapshot.tick} ticks · ${snapshot.actions.length} actions`:'Replay mismatch detected; export the session for inspection');
});
$('model-propose').onclick=safe(async()=>{
  const {snapshot}=await request('snapshot'),comparisons=snapshot.events.filter(e=>e.type==='comparison').slice(-20);
  const result=await model.propose(comparisons,{tick:snapshot.tick,selection:selectedParticle(),dimensions:DIMENSIONS});
  await command('proposal',result);$('comparison-result').textContent=result.text;setStatus('Model proposal recorded as untested; no code executed');
});
window.synthia=Object.freeze({
  attachModel(adapter){model.attach(adapter);$('model-status').textContent=`${model.name} attached locally`;setStatus('Local model adapter attached');},
  snapshot:async()=>(await request('snapshot')).snapshot,
  command, pause:()=>request('run',{running:false}), step:()=>request('step'),
  get state(){return state;},
});
setInterval(()=>{if(state?.tick>0)save('autosave').catch(error=>setStatus(`Autosave unavailable: ${error.message}. Export remains available.`));if($('event-filter').value==='selected')inspect().catch(()=>{});},10000);

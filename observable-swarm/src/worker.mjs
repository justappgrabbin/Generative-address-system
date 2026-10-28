import { Swarm } from './engine.mjs';
let swarm=new Swarm(),running=false,speed=1;
const send=(id,data)=>postMessage({id,ok:true,...data});
function publish(){postMessage({type:'state',state:swarm.view(),running});}
setInterval(()=>{if(!running)return;for(let i=0;i<speed;i++)swarm.step();publish();},80);
self.onmessage=({data})=>{
  const {id,type,payload={}}=data;
  try {
    if(type==='run'){running=Boolean(payload.running);publish();send(id,{});}
    else if(type==='speed'){
      if(!Number.isInteger(payload.value)||payload.value<1||payload.value>5)throw Error('Speed must be 1–5');
      speed=payload.value;send(id,{});
    }
    else if(type==='step'){swarm.step();publish();send(id,{});}
    else if(type==='reset'){running=false;swarm=new Swarm(payload);publish();send(id,{});}
    else if(type==='snapshot')send(id,{snapshot:swarm.snapshot()});
    else if(type==='restore'){const restored=Swarm.restore(payload.snapshot);running=false;swarm=restored;publish();send(id,{});}
    else if(type==='replay'){const replayed=Swarm.replay(payload.snapshot);running=false;swarm=replayed;publish();send(id,{snapshot:swarm.snapshot()});}
    else if(type==='inspect')send(id,{events:swarm.events.filter(e=>e.particleId===payload.id||e.from===payload.id||e.to===payload.id||e.members?.includes(payload.id)||e.participants?.includes(payload.id)).slice(-40)});
    else if(type==='action'){const result=swarm.action(payload.type,payload.data);publish();send(id,{result});}
    else throw Error('Unknown worker request');
  }catch(error){postMessage({id,ok:false,error:error.message});}
};
publish();

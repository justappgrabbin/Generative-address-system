import { Swarm } from './engine.mjs';

const yieldToHost=()=>new Promise(resolve=>setTimeout(resolve,0));

/** Cooperative CPU runtime. No Web Worker, GPU, network, or server computation.
 * Each simulation tick is still synchronous; large ticks remain an engineering
 * limit. Replay yields between batches so other main-thread events can run.
 */
export class LocalRuntime {
  constructor({swarm=new Swarm()}={}){
    this.swarm=swarm;this.running=false;this.speed=1;this.onmessage=null;this.onerror=null;
    this.timer=null;this.closed=false;this.queue=Promise.resolve();
    queueMicrotask(()=>this.publish());
  }
  emit(data){if(!this.closed)this.onmessage?.({data});}
  publish(){this.emit({type:'state',state:this.swarm.view(),running:this.running});}
  schedule(){
    if(!this.running||this.closed||this.timer!==null)return;
    this.timer=setTimeout(()=>{
      this.timer=null;
      if(!this.running||this.closed)return;
      this.queue=this.queue.then(()=>{
        if(!this.running||this.closed)return;
        this.swarm.step();this.publish();
      }).catch(error=>{this.running=false;this.onerror?.({message:error.message});}).finally(()=>this.schedule());
    },Math.max(8,80/this.speed));
    this.timer.unref?.();
  }
  stop(){this.running=false;if(this.timer!==null){clearTimeout(this.timer);this.timer=null;}}
  postMessage(message){
    this.queue=this.queue.then(async()=>{
      try{const result=await this.dispatch(message.type,message.payload??{});this.emit({id:message.id,ok:true,...result});}
      catch(error){this.emit({id:message.id,ok:false,error:error.message});}
    });
    return this.queue;
  }
  async dispatch(type,payload={}){
    if(this.closed)throw Error('Runtime is closed');
    if(type==='run'){
      if(payload.running){this.running=true;this.schedule();}else this.stop();
      this.publish();return {};
    }
    if(type==='speed'){
      if(!Number.isInteger(payload.value)||payload.value<1||payload.value>5)throw Error('Speed must be 1–5');
      this.speed=payload.value;return {};
    }
    if(type==='step'){this.swarm.step();this.publish();return {};}
    if(type==='reset'){const next=new Swarm(payload);this.stop();this.swarm=next;this.publish();return {};}
    if(type==='snapshot')return {snapshot:this.swarm.snapshot()};
    if(type==='restore'){const next=Swarm.restore(payload.snapshot);this.stop();this.swarm=next;this.publish();return {};}
    if(type==='replay'){
      const source=payload.snapshot;Swarm.restore(source);this.stop();
      const next=new Swarm({seed:source.seed,count:source.count,params:source.initialParams});
      let actionIndex=0,lastYield=performance.now();
      for(let tick=0;tick<=source.tick;tick++){
        if(this.closed)throw Error('Replay cancelled');
        while(actionIndex<source.actions.length&&source.actions[actionIndex].tick===tick){const action=source.actions[actionIndex++];next.action(action.type,action.payload);}
        if(tick<source.tick)next.step();
        if(performance.now()-lastYield>8){await yieldToHost();lastYield=performance.now();}
      }
      this.swarm=next;this.publish();return {snapshot:next.snapshot()};
    }
    if(type==='inspect')return {events:this.swarm.events.filter(e=>e.particleId===payload.id||e.from===payload.id||e.to===payload.id||e.members?.includes(payload.id)||e.participants?.includes(payload.id)).slice(-40)};
    if(type==='action'){const result=this.swarm.action(payload.type,payload.data);this.publish();return {result};}
    throw Error('Unknown runtime request');
  }
  terminate(){this.stop();this.closed=true;}
}

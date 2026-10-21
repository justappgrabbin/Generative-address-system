export class ProcessFabric{
  constructor(){this.processes=new Map();this.events=[];}
  register({id,capabilities=[],run,health=()=>({ok:true})}){if(!id||typeof run!=='function')throw new TypeError('process requires id + run');this.processes.set(id,{id,capabilities:new Set(capabilities),run,health});return id;}
  async dispatch(capability,input,context={}){
    const candidates=[...this.processes.values()].filter(p=>p.capabilities.has(capability)).map(p=>({p,h:p.health()})).filter(x=>x.h?.ok!==false);
    if(!candidates.length)throw new Error(`No healthy process provides ${capability}`);
    const errors=[];for(const {p} of candidates){try{const result=await p.run(input,context);this.events.push({at:Date.now(),process:p.id,capability,ok:true});return {process:p.id,result};}catch(error){errors.push({process:p.id,error:String(error)});this.events.push({at:Date.now(),process:p.id,capability,ok:false,error:String(error)});}}
    throw new AggregateError(errors.map(x=>new Error(`${x.process}: ${x.error}`)),`All processes failed for ${capability}`);
  }
}

import assert from 'node:assert/strict';
import { CapabilityMesh } from '../src/integration/mesh-rule-synthesizer.js';
import { ExecutionLoopOrchestrator } from '../src/integration/execution-loop-orchestrator.js';

const mesh = new CapabilityMesh();
mesh.register({
  id:'mesh:increment', gate:2,
  labels:['increment','number','mutation','add','state'],
  execute:(state)=>({ ...state, value:(state.value||0)+1 })
});
mesh.register({
  id:'mesh:double', gate:24,
  labels:['double','number','arithmetic','state'],
  execute:(state)=>({ ...state, value:(state.value||0)*2 })
});
mesh.connect('mesh:increment','mesh:double','composes-with',1);

const engine = new ExecutionLoopOrchestrator({mesh,seed:7,maxRepairs:4});
const artifact={name:'foreign.bin',bytes:new Uint8Array([1,2,3])};
const result=await engine.execute({
  artifact,
  probe:async()=>({ok:false,value:1,missingCapabilities:['increment'],progress:0}),
  analyze:async()=>({behavior:['increment state'],operation:'increment'}),
  address:async()=>({gate:24}),
  retry:async({execute,priorObservation})=>{
    const out=await execute({value:priorObservation.value||1});
    const value=out?.value?.value ?? out?.value ?? 0;
    return value===2
      ? {ok:true,value,missingCapabilities:[],progress:1,behaviorMatch:1}
      : {ok:false,value,missingCapabilities:['increment'],progress:0};
  },
  verify:async(o)=>o.value===2,
});
assert.equal(result.ok,true);
assert.equal(result.path,'mesh-derived-execution');
console.log('execution-loop-orchestrator: PASS');

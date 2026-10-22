import assert from 'node:assert/strict';
import { CapabilityMesh, MeshRuleSynthesizer } from '../src/integration/mesh-rule-synthesizer.js';
import { gateBits, hamming } from '../src/state-space/addressing.js';

const mesh=new CapabilityMesh();
mesh.register({id:'donor:a',gate:24,labels:['dispatch','call','method'],execute:(x)=>({...x,dispatch:true})});
// Gate 2 is Hamming-1 from 24 under the verified Fu Xi codec.
assert.equal(hamming(gateBits(24),gateBits(2)),1);
mesh.register({id:'donor:b',gate:2,labels:['method','target','call'],execute:(x)=>({...x,target:true})});
mesh.connect('donor:a','donor:b','resonates-with',1);
const synth=new MeshRuleSynthesizer({mesh,seed:7,maxCandidates:8});
const q=synth.query({targetGate:24,requiredCapability:'method dispatch call target'});
assert.ok(q.neighbors.length>=1);
assert.ok(q.neighbors.some(x=>x.distance===1));
const result=await synth.synthesize({targetGate:24,requiredCapability:'method dispatch call target'},{
  probeCandidate:async(fn)=>{
    const out=await fn({seed:true});
    return {ok:true,progress:1,behaviorMatch:(out?.dispatch||out?.value?.dispatch)?1:0,newFailures:0};
  }
});
assert.equal(result.ok,true);
assert.ok(result.installed);
console.log('mesh-rule-synthesizer: PASS');

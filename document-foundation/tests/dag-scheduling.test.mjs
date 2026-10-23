import test from 'node:test';
import assert from 'node:assert/strict';
import {executeDAG} from '../vendor/spine/src/dag-runtime.mjs';
test('compact scheduler executes a deep chain without per-node full snapshots',async()=>{
 const nodes=Array.from({length:12000},(_,id)=>({id,dependsOn:id?[id-1]:[]}));
 const result=await executeDAG(nodes,(node,ctx)=>node.id?ctx.dependencies[node.id-1]+1:1,{compact:true});
 assert.equal(result.ok,true);assert.equal(result.results[11999],12000);assert.equal(result.checkpoints.length,2);
});
test('compact scheduler contains synchronous failure and blocks descendants',async()=>{
 const result=await executeDAG([{id:'a'},{id:'b',dependsOn:['a']},{id:'c',dependsOn:['b']},{id:'d'}],n=>{if(n.id==='a')throw Error('failure');return 42;},{compact:true});
 assert.deepEqual(result.status,{a:'failed',b:'blocked',c:'blocked',d:'done'});assert.equal(result.results.d,42);
});
test('compact scheduler rejects cycles and missing dependencies',async()=>{
 await assert.rejects(executeDAG([{id:'a',dependsOn:['a']}],()=>0,{compact:true}),/cycle/);
 await assert.rejects(executeDAG([{id:'a',dependsOn:['missing']}],()=>0,{compact:true}),/missing/);
});

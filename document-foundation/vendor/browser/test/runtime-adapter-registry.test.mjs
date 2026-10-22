import assert from 'node:assert/strict';
import { RuntimeAdapterRegistry } from '../src/integration/runtime-adapter-registry.js';
import { UniversalExecutionBridge } from '../src/integration/universal-execution-bridge.js';

const calls=[];
const pythonAdapter={
  id:'python-test-runtime',
  kinds:['python'],
  canRun:({kind})=>kind==='python',
  prepare:({artifact})=>({source:artifact.content}),
  execute:({prepared})=>{
    calls.push(prepared.source);
    return {ok:true,engine:'python-test-runtime',stdout:['PY_NATIVE_OK'],stderr:[],returnValue:42};
  }
};
const registry=new RuntimeAdapterRegistry([pythonAdapter]);
assert.deepEqual(registry.list(),[{id:'python-test-runtime',kinds:['python']}]);

const bridge=new UniversalExecutionBridge({runtimeAdapters:registry});
const res=await bridge.execute({name:'program.py',content:'print(42)'});
assert.equal(res.ok,true);
assert.equal(res.path,'registered-runtime');
assert.equal(res.runtimeAdapter,'python-test-runtime');
assert.equal(res.result.engine,'python-test-runtime');
assert.deepEqual(res.result.stdout,['PY_NATIVE_OK']);
assert.equal(calls.length,1);
console.log('runtime-adapter-registry: PASS');

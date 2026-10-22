import assert from 'node:assert/strict';
import { MemoryVFS, PaperRuntimeSandbox } from '../src/integration/paper-runtime-sandbox.js';

const vfs=new MemoryVFS();
vfs.put('/project/input.txt','steel');
assert.equal(vfs.text('/project/input.txt'),'steel');
assert.equal(vfs.list('/project').length,1);

const sandbox=new PaperRuntimeSandbox({allowHostFallback:true});
await sandbox.mount([{path:'/work/value.txt',content:'21'}]);
const result=await sandbox.executeJavaScript(`
  const n=Number(vfs.readText('/work/value.txt'));
  console.log('SANDBOX_OK', n*2);
  return n*2;
`);
assert.equal(result.returnValue,42);
assert.match(result.stdout.join('\n'),/SANDBOX_OK 42/);
assert.match(result.engine,/pure-js-/);
sandbox.terminate();
console.log('paper-runtime-sandbox: PASS');

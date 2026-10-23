
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeArtifact,
  PrimitiveReducer,
  FiveFieldCompiler,
  BrowserExecutionSurface,
  UniversalPrimitiveExecutionBridge,
  PrimitiveExecutionVM,
} from '../vendor/ingestion/src/automata/index.mjs';
import { UniversalExecutionBridge } from '../vendor/browser/src/integration/universal-execution-bridge.js';
import {Foundation} from '../src/foundation.mjs';
import {BrowserAutomataStore} from '../vendor/ingestion/src/automata/browser-automata-store.mjs';

const enc = new TextEncoder();

test('restored primitive lowering runs a WASM-labeled artifact without native WebAssembly',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'WebAssembly');Object.defineProperty(globalThis,'WebAssembly',{configurable:true,value:undefined});
 try{
  const surface=new BrowserExecutionSurface();
  const normalized=await normalizeArtifact({name:'decoded.wasm',bytes:new Uint8Array([0,97,115,109,1,0,0,0])});
  const r=await surface.execute(normalized,{primitiveProgram:{nodes:[{id:'answer',op:'add',inputs:[{value:40},{value:2}]}],outputs:['answer']}});
  assert.equal(r.path,'synthia-primitive-vm');assert.equal(r.result.returnValue.answer,42);
 }finally{if(previous)Object.defineProperty(globalThis,'WebAssembly',previous);else delete globalThis.WebAssembly;}
});

test('restored primitive path executes through foundation ingestion and journal replay',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 const primitiveProgram={nodes:[{id:'a',op:'const',value:[[1,2],[3,4]]},{id:'b',op:'const',value:[[5,6],[7,8]]},{id:'product',op:'matmul',inputs:['a','b']}],outputs:['product']};
 const r=await app.ingest({primitiveProgram},{name:'network.json'});
 assert.equal(r.ok,true);assert.equal(r.outcome.path,'synthia-primitive-vm');
 assert.deepEqual(r.outcome.result.returnValue.product,[[19,22],[43,50]]);
 const restored=new Foundation({store});await restored.ready;
 assert.deepEqual(restored.history[0].result.outcome.result.returnValue.product,[[19,22],[43,50]]);
});

test('restored foreign lowerer hook reaches the same primitive VM',async()=>{
 const app=new Foundation();await app.ready;
 app.surface.registerPrimitiveLowerer({id:'fixture:decoded-model',canLower:n=>n.kind==='onnx',lower:()=>({nodes:[{id:'answer',op:'add',inputs:[{value:40},{value:2}]}],outputs:['answer']})});
 const r=await app.ingest(new Uint8Array([8,1]),{name:'fixture.onnx'});
 assert.equal(r.outcome.path,'synthia-primitive-vm');assert.equal(r.outcome.lowering,'fixture:decoded-model');assert.equal(r.outcome.result.returnValue.answer,42);
});

test('restored surface does not recursively delegate an unavailable JavaScript chamber',async()=>{
 const app=new Foundation();await app.ready;
 const r=await app.surface.execute(await normalizeArtifact({name:'snippet.js',content:'return 42;'}),{localOnly:true});
 assert.equal(r.ok,false);assert.equal(r.path,'browser-sandbox-unavailable');
});

test('foreign format registry recognizes source, bytecode, native, database, tensor, and model structures', async () => {
  assert.equal((await normalizeArtifact({name:'main.py',content:'print(42)'})).kind, 'python');

  const elf = new Uint8Array(64);
  elf.set([0x7f,0x45,0x4c,0x46,2,1,1,0],0);
  assert.equal((await normalizeArtifact({name:'native.bin',bytes:elf})).kind,'elf');

  const klass = new Uint8Array([0xca,0xfe,0xba,0xbe,0x00,0x00,0x00,0x3d,0x00,0x01]);
  assert.equal((await normalizeArtifact({name:'Thing.class',bytes:klass})).kind,'jvm-class');

  const dex = new Uint8Array(112);
  dex.set(enc.encode('dex\n039\0'),0);
  assert.equal((await normalizeArtifact({name:'classes.dex',bytes:dex})).kind,'dex');

  const sqlite = new Uint8Array(100);
  sqlite.set(enc.encode('SQLite format 3\0'),0);
  assert.equal((await normalizeArtifact({name:'memory.db',bytes:sqlite})).kind,'sqlite');

  const gguf = new Uint8Array(24);
  gguf.set(enc.encode('GGUF'),0);
  assert.equal((await normalizeArtifact({name:'model.bin',bytes:gguf})).kind,'gguf');

  const tflite = new Uint8Array(16);
  tflite.set(enc.encode('TFL3'),4);
  assert.equal((await normalizeArtifact({name:'model.dat',bytes:tflite})).kind,'tflite');

  assert.equal((await normalizeArtifact({name:'network.onnx',bytes:new Uint8Array([0x08,0x01])})).kind,'onnx');
});

test('python is reduced as executable source and distributed across all five fields', async () => {
  const normalized = await normalizeArtifact({
    name:'field.py',
    content:'import math\nx = 40 + 2\nprint(x)\n',
  });
  const decomposition = await new PrimitiveReducer().reduce(normalized);
  assert.equal(decomposition.artifact.kind,'python');
  assert.ok(decomposition.root.structure.dependencies.includes('math'));
  assert.ok(decomposition.root.structure.assignments.includes('x'));
  assert.ok(decomposition.root.structure.calls.includes('print'));

  const compiled = new FiveFieldCompiler().compile(decomposition);
  for (const field of ['shared','knowledge','causal','dependency','stateSpace']) {
    assert.ok(compiled.fields[field].length > 0, `${field} should receive records`);
  }
  assert.ok(compiled.fields.dependency.some(x => x.kind==='execution-provider'));
});

test('existing Python execution grammar is now reachable from the automata browser surface', async () => {
  const existing = new UniversalExecutionBridge({remember:true});
  const surface = new BrowserExecutionSurface({executionBridge:existing});
  const normalized = await normalizeArtifact({
    name:'answer.py',
    content:'x = 40 + 2\nprint(x)\n',
  });
  const result = await surface.execute(normalized);
  assert.equal(result.ok,true);
  assert.equal(result.kind,'python');
  assert.match(result.path,/automata-delegate:/);
  assert.ok(Array.isArray(result.result?.stdout));
  assert.ok(result.result.stdout.some(line => String(line).includes('42')));
});

test('primitive VM executes a lowered graph independent of source language', async () => {
  const surface = new BrowserExecutionSurface({
    primitiveBridge:new UniversalPrimitiveExecutionBridge({vm:new PrimitiveExecutionVM()}),
  });
  const normalized = await normalizeArtifact({name:'graph.onnx',bytes:new Uint8Array([0x08,0x01])});
  const result = await surface.execute(normalized,{
    primitiveProgram:{
      nodes:[
        {id:'a',op:'const',value:[[1,2],[3,4]]},
        {id:'b',op:'const',value:[[5,6],[7,8]]},
        {id:'product',op:'matmul',inputs:['a','b']},
        {id:'activated',op:'relu',inputs:['product']},
      ],
      outputs:['activated'],
    },
  });
  assert.equal(result.ok,true);
  assert.equal(result.path,'synthia-primitive-vm');
  assert.deepEqual(result.result.returnValue.activated,[[19,22],[43,50]]);
});

test('safetensors structure is decomposed into tensor primitives rather than opaque bytes', async () => {
  const header = JSON.stringify({
    weight:{dtype:'F32',shape:[2,2],data_offsets:[0,16]},
    __metadata__:{source:'test'},
  });
  const hb=enc.encode(header);
  const bytes=new Uint8Array(8+hb.length+16);
  new DataView(bytes.buffer).setBigUint64(0,BigInt(hb.length),true);
  bytes.set(hb,8);
  const normalized=await normalizeArtifact({name:'weights.safetensors',bytes});
  const decomposition=await new PrimitiveReducer().reduce(normalized);
  assert.equal(decomposition.artifact.kind,'safetensors');
  assert.equal(decomposition.root.structure.tensorCount,1);
  assert.equal(decomposition.root.structure.tensors[0].dtype,'F32');
  assert.deepEqual(decomposition.root.structure.tensors[0].shape,[2,2]);
  assert.ok(decomposition.root.primitives.some(p=>p.type==='tensor-name'&&p.value==='weight'));
});

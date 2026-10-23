import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const root=new URL('../',import.meta.url);const read=p=>fs.readFileSync(new URL(p,root),'utf8');
test('mobile shell preserved',()=>assert.match(read('src/SynthiaMobileModule.jsx'),/export default function SynthiaMobileModule/));
test('bridge has registration + training',()=>{const s=read('src/runtime/synthia-mobile-bridge.mjs');assert.match(s,/recordTraining/);assert.match(s,/transition\('synthia'/);});
test('full 13 field address',()=>{const s=read('src/runtime/browser-learning-core.mjs');for(const k of ['planetary','dimension','gate','line','color','tone','base','degree','minute','second','arc','zodiac','house'])assert.match(s,new RegExp(k));});
test('HD Research v3 facade is wired',()=>{const s=read('src/runtime/synthia-mobile-bridge.mjs');assert.match(s,/human-design-research\/src\/index\.mjs/);assert.match(s,/calculateResearchChart/);assert.match(s,/sidereal|draconic/i);});


test('mobile bridge executes an artifact through the execution spine and writes result to live mobile state',async()=>{
  const {createSynthiaMobileBridge}=await import('../src/runtime/synthia-mobile-bridge.mjs');
  const bridge=createSynthiaMobileBridge({userId:'runtime-test'});
  const result=await bridge.executeArtifact({name:'phone-runtime.json',content:'{"phone":true}'});
  assert.equal(result.ok,true);
  assert.equal(result.result.engine,'json-native');
  assert.equal(result.pipeline.stages.length,11);
  const entity=bridge.core.entities.get('synthia');
  assert.equal(entity.state.lastExecution.canonicalAddressKey,result.canonicalAddressKey);
  assert.equal(entity.state.lastExecution.stageCount,11);
  assert.ok(bridge.core.training.some(x=>x.task==='artifact-execution'&&x.success===true));
});

test('mobile App exposes the real runtime execution callback to the existing UI',()=>{
  const app=read('src/App.jsx');
  const module=read('src/SynthiaMobileModule.jsx');
  assert.match(app,/onExecuteArtifact=\{bridge\.executeArtifact\}/);
  assert.match(module,/function RuntimeScreen/);
  assert.match(module,/new Uint8Array\(await file\.arrayBuffer\(\)\)/);
  assert.match(module,/executeArtifact\(artifact/);
});

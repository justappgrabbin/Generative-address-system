
import test from 'node:test';
import assert from 'node:assert/strict';

import { createAllTools } from '../vendor/spine/src/pure-synthia/automata/registry.js';
import { BrowserAutomataStore } from '../vendor/ingestion/src/automata/browser-automata-store.mjs';
import { normalizeArtifact } from '../vendor/ingestion/src/automata/artifact-normalizer.mjs';
import { PrimitiveReducer } from '../vendor/ingestion/src/automata/primitive-reducer.mjs';
import { FiveFieldCompiler } from '../vendor/ingestion/src/automata/five-field-compiler.mjs';
import { KleinSituationRouter } from '../vendor/ingestion/src/klein/klein-situation-router.mjs';
import {Foundation} from '../src/foundation.mjs';

function engineWithRealKleinTools() {
  const tools=createAllTools();
  const byId=new Map(tools.map((tool)=>[tool.id,tool]));
  return { mesh:{ get:(id)=>byId.get(id) ?? null } };
}

test('foundation restores selected AUTOLING execution learning and route memory from its journal',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 const first=await app.ingest('print(42)',{name:'first.py'});
 assert.ok(first.record.kleinRoute.selected.some(t=>t.id==='autoling'));
 assert.equal(first.record.execution.kleinLearning.autolingLearned,true);
 const second=await app.ingest('print(43)',{name:'second.py'});
 assert.equal(second.record.kleinRoute.remembered,true);
 const before=await app.situationRouter.audit(),grammar=app.system.engine.toolsById.get('autoling').exportState();
 const restored=new Foundation({store});await restored.ready;
 assert.deepEqual(await restored.situationRouter.audit(),before);
 assert.deepEqual(restored.system.engine.toolsById.get('autoling').exportState(),grammar);
 assert.deepEqual(restored.kernel.history.map(r=>r.kleinRoute),app.kernel.history.map(r=>r.kleinRoute));
});

test('previous journal entries retain their original routing policy',async()=>{
 const store=new BrowserAutomataStore(),app=new Foundation({store});await app.ready;
 await app.ingest('print(42)',{name:'old.py',executionRoutingVersion:null});
 const restored=new Foundation({store});await restored.ready;
 assert.equal(restored.kernel.history[0].kleinRoute,null);
 assert.equal((await restored.situationRouter.audit()).history,0);
});

test('ordinary direct JSON does not recruit Klein tools without a learning reason', async () => {
  const router=new KleinSituationRouter({engine:engineWithRealKleinTools(),threshold:5});
  const normalized=await normalizeArtifact({name:'plain.json',content:'{"x":1}'});
  const decomposition=await new PrimitiveReducer().reduce(normalized);
  const fieldMap=new FiveFieldCompiler().compile(decomposition);
  const route=await router.choose({phase:'compile',normalized,decomposition,fieldMap,context:{}});
  assert.equal(route.directAdequate,true);
  assert.equal(route.useKlein,false);
  assert.equal(route.selected.length,0);
});

test('Python source selects AUTOLING when reusable execution grammar is useful', async () => {
  const router=new KleinSituationRouter({engine:engineWithRealKleinTools(),threshold:5});
  const normalized=await normalizeArtifact({name:'hello.py',content:'import math\nx=40+2\nprint(x)\n'});
  const decomposition=await new PrimitiveReducer().reduce(normalized);
  const fieldMap=new FiveFieldCompiler().compile(decomposition);
  const route=await router.choose({phase:'compile',normalized,decomposition,fieldMap,context:{}});
  assert.equal(route.useKlein,true);
  assert.ok(route.selected.some((x)=>x.id==='autoling'));
  assert.ok(route.selected.some((x)=>x.id==='computational-grammar-coder'));
});

test('foreign model lowering selects Klein analogy and AUTOLING', async () => {
  const router=new KleinSituationRouter({engine:engineWithRealKleinTools(),threshold:5});
  const normalized=await normalizeArtifact({name:'network.onnx',bytes:new Uint8Array([0x08,0x01])});
  const decomposition=await new PrimitiveReducer().reduce(normalized);
  const fieldMap=new FiveFieldCompiler().compile(decomposition);
  const route=await router.choose({phase:'compile',normalized,decomposition,fieldMap,context:{}});
  assert.ok(route.selected.some((x)=>x.id==='klein-analogy'));
  assert.ok(route.selected.some((x)=>x.id==='autoling'));
});

test('multiple competing lowerers recruit Historical Monte Carlo', async () => {
  const router=new KleinSituationRouter({engine:engineWithRealKleinTools(),threshold:5});
  const normalized=await normalizeArtifact({name:'network.onnx',bytes:new Uint8Array([0x08,0x01])});
  const route=await router.choose({
    phase:'compile',
    normalized,
    context:{loweringCandidates:[{id:'a'},{id:'b'},{id:'c'}]},
  });
  assert.ok(route.selected.some((x)=>x.id==='historical-monte-carlo'));
  const ranked=await router.rankCandidates(
    [{id:'a',score:1},{id:'b',score:0.8}],
    {route,seed:7,generations:4},
  );
  assert.equal(ranked.tool,'historical-monte-carlo');
  assert.ok(['a','b'].includes(ranked.dominantVariant));
});

test('successful selected AUTOLING execution induces and remembers a reusable rule', async () => {
  const engine=engineWithRealKleinTools();
  const store=new BrowserAutomataStore();
  const router=new KleinSituationRouter({engine,store,threshold:5});
  const normalized=await normalizeArtifact({name:'hello.py',content:'x=40+2\nprint(x)\n'});
  const route=await router.choose({phase:'compile',normalized,context:{}});
  assert.ok(route.selected.some((x)=>x.id==='autoling'));

  const learned=await router.learnExecutionPattern({
    normalized,
    fingerprint:'fp-python-test',
    program:{
      nodes:[
        {id:'a',op:'const',value:40},
        {id:'b',op:'const',value:2},
        {id:'c',op:'add',inputs:['a','b']},
      ],
      outputs:['c'],
    },
    lowering:'python-primitive-lowerer',
    execution:{
      ok:true,
      path:'synthia-primitive-vm',
      result:{engine:'synthia-primitive-vm',stdout:[],returnValue:{c:42}},
    },
    route,
  });

  assert.equal(learned.kind,'python');
  assert.ok(learned.autoling);
  assert.ok(learned.autoling.rule);
  const remembered=await store.get('klein-learning:fp-python-test');
  assert.equal(remembered.kind,'python');
  const routeMemory=await store.get(route.memoryKey);
  assert.ok(routeMemory.successfulTools.includes('autoling'));
});

test('five-field observation records chosen Klein tools and learned execution grammar', async () => {
  const compiler=new FiveFieldCompiler();
  const normalized=await normalizeArtifact({name:'x.py',content:'x=1\nprint(x)\n'});
  const decomposition=await new PrimitiveReducer().reduce(normalized);
  const base=compiler.compile(decomposition);
  const route={
    useKlein:true,
    primary:{id:'autoling'},
    remembered:false,
    selected:[
      {id:'autoling',reasons:['induce-reusable-execution-grammar'],capabilities:['induce'],gate:17,channels:['17-62']},
    ],
  };
  const observed=compiler.observe(base,{
    ok:true,
    kind:'python',
    path:'synthia-primitive-vm',
    result:{engine:'synthia-primitive-vm'},
    kleinRoute:route,
    kleinLearning:{
      kind:'python',
      lowering:'test-lowerer',
      path:'synthia-primitive-vm',
      operators:['add'],
      autoling:{rule:{id:'rule-1'}},
    },
  });
  assert.ok(observed.fields.shared.some((x)=>x.kind==='klein-tool'&&x.value==='autoling'));
  assert.ok(observed.fields.knowledge.some((x)=>x.kind==='learned-execution-grammar'));
  assert.ok(observed.fields.causal.some((x)=>x.kind==='klein-routing-decision'));
  assert.ok(observed.fields.stateSpace.some((x)=>x.kind==='learned-route-state'));
});

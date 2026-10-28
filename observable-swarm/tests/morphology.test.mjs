import test from 'node:test';
import assert from 'node:assert/strict';
import { firstCapital, resolveDirection } from '../src/direction.mjs';
import { DODECAHEDRON, containsPoint } from '../src/topology.mjs';
import { morphologyFor, HEXAGRAM_TITLES } from '../src/morphology.mjs';
import { surfaceFaces, renderScene } from '../src/scene.mjs';
import { Swarm } from '../src/engine.mjs';

test('first capital is case-preserved, Unicode-aware, and resolved only in the supplied frame',()=>{
  assert.equal(firstCapital('i am Conflict'),'C');assert.equal(firstCapital('évolution Énergie'),'É');
  assert.equal(firstCapital('all lowercase'),null);
  const rules=[{capital:'C',dimension:'Being',vector:[0,1],source:'test-only explicit rule'}];
  assert.equal(resolveDirection('i am Conflict','Movement',rules).vector,null);
  assert.deepEqual(resolveDirection('i am Conflict','Being',rules).vector,[0,1]);
});
test('direction rules and expressions persist through replay without inventing a leading dimension',()=>{
  const s=new Swarm({count:8});s.action('expression',{id:'p001',text:'i am Conflict',frame:'Being'});
  assert.equal(s.particles[0].direction.vector,null);
  s.action('direction-rule',{capital:'C',dimension:'Being',vector:[0,1],source:'test-only caller frame'});
  for(let i=0;i<30;i++)s.step();
  assert.equal(s.particles[0].leadingDimension,null);assert.equal(s.particles[0].direction.capital,'C');
  assert.deepEqual(Swarm.replay(s.snapshot()).snapshot(),s.snapshot());
});
test('dodecahedral embedding has 12 faces, 20 vertices, 30 edges, and contains all moving particles',()=>{
  assert.equal(DODECAHEDRON.faces.length,12);assert.equal(DODECAHEDRON.vertices.length,20);assert.equal(DODECAHEDRON.edges.length,30);
  assert(DODECAHEDRON.faces.every(f=>f.vertices.length===5));
  const s=new Swarm({count:24});for(let i=0;i<200;i++)s.step();
  assert(s.particles.every(p=>containsPoint([p.x,p.y,p.z])));
  assert(s.particles.some(p=>Math.abs(p.vz)>0));
});
test('Black Book morphology reveals five source tracks in Being order, without pretending other orders are known',()=>{
  assert.equal(HEXAGRAM_TITLES.length,64);assert.equal(HEXAGRAM_TITLES[5],'Conflict');
  const p={id:'example',gate:6,line:1,color:1,tone:1,base:1,leadingDimension:null};
  const m=morphologyFor(p);assert.deepEqual(m.order,['Being','Movement','Space','Design','Evolution']);
  assert.equal(m.tracks[0].expression,'I Am Conflict');assert.equal(m.identity,p.id);
  assert(m.tracks.every(t=>t.definingFactors.length>0&&t.orientation===null));
  assert.equal(morphologyFor(p,{perspective:'Movement'}).order,null);
});
test('rendered surfaces require actual closed persistent relations and do not mutate the world',()=>{
  const s=new Swarm({count:4,params:{motion:0}});s.particles.forEach(p=>{p.x=.5;p.y=.5;p.z=.5;p.gate=1;});
  assert.deepEqual(surfaceFaces(s.view()),[]);
  for(let i=0;i<50;i++)s.step();const view=s.view(),before=structuredClone(view);
  const context=new Proxy({}, {get:()=>()=>{},set:()=>true});
  renderScene(context,view,1000,700,{zoom:4});assert.deepEqual(view,before);
  const faces=surfaceFaces(view);assert(faces.length>0);
  const a=faces[0][0];view.relations=view.relations.filter(r=>r.from!==a&&r.to!==a);
  assert(!surfaceFaces(view).some(f=>f.includes(a)));
});
test('dimensions can carry different nested qualitative structures without imposing one layer per dimension',()=>{
  const s=new Swarm({count:4});
  s.action('qualitative-structure',{id:'p001',dimension:'Movement',source:'test-only structural example',roots:[
    {id:'whole',label:'Movement perspective',arrangement:'unresolved',children:[
      {id:'first',label:'First major interpretation',interprets:'Being',children:[]},
      {id:'second',label:'Second major interpretation',interprets:'Design',children:[{id:'nested',label:'Nested interpretation',interprets:'Evolution',children:[]}]}
    ]}
  ]});
  assert.equal(s.particles[0].frames.Movement.qualitative.roots[0].children.length,2);
  assert.equal(s.particles[0].frames.Being.qualitative.roots.length,0);
  assert.deepEqual(Swarm.replay(s.snapshot()).snapshot(),s.snapshot());
});

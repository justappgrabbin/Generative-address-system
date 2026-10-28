import test from 'node:test';
import assert from 'node:assert/strict';
import { Swarm } from '../src/engine.mjs';
import { GATES, gateBits, gateFromBits, changeLine, representations, FractalAddressSpace, structuralView } from '../src/semantics.mjs';
import { analogy, bits, str } from '../vendor/ato.mjs';
import { LocalModelAdapter } from '../src/model-adapter.mjs';

test('all 64 hexagrams round-trip, all 384 directed line changes are reversible',()=>{
  assert.equal(new Set(GATES.map(g=>g.binary.join(''))).size,64);
  let count=0;
  for(let gate=1;gate<=64;gate++){
    assert.equal(gateFromBits(gateBits(gate)),gate);
    for(let line=1;line<=6;line++){
      const to=changeLine(gate,line);assert.notEqual(to,gate);
      assert.equal(gateBits(gate).filter((b,i)=>b!==gateBits(to)[i]).length,1);
      assert.equal(changeLine(to,line),gate);count++;
    }
  }
  assert.equal(count,384);assert.equal(changeLine(1,1),44);
  assert.throws(()=>changeLine(2,0));assert.throws(()=>gateFromBits([2,0,0,0,0,0]));
});
test('existing Klein ATO reproduces the published analogy',()=>{
  assert.equal(str(analogy(bits('10101010'),bits('01100110'),bits('01010101'))),'10011001');
});
test('five source views retain five dimensions and recursive addresses exceed a single-level count',()=>{
  for(const name of ['being','movement','evolution','design','space'])assert.equal(new Set(structuralView(name).fields.map(f=>f.dimension)).size,5);
  const addressSpace=new FractalAddressSpace({depth:3});const address=addressSpace.at(69120n+33n);
  assert.equal(addressSpace.indexOf(address.path),69153n);
});
test('identity and six unresolved potentials survive representations, frame intervention, and directed reverse transitions',()=>{
  const s=new Swarm({count:4});const p=s.particles[0],id=p.id;
  const rep=representations(p);assert.equal(rep.identity,id);
  s.action('stimulate',{id,dimension:'Being'});
  const forward=s.action('transition',{id,line:2});s.step();
  const reverse=s.action('transition',{id,line:2});
  assert.equal(p.id,id);assert.equal(p.gate,1);assert.equal(p.leadingDimension,null);
  assert.notEqual(forward.direction,reverse.direction);assert.notEqual(forward.id,reverse.id);
  assert.notDeepEqual(forward.before,reverse.before);
  assert.equal(p.potentials.length,6);assert(p.potentials.every(p=>p.actionCapable===null&&!p.realized));
  assert.equal(p.frame.originId,id);
});
function closeSwarm(params={}){
  const s=new Swarm({count:8,params:{motion:0,...params}});
  s.particles.forEach(p=>{p.x=.5;p.y=.5;p.z=.5;p.activation=.8;});return s;
}
test('encounters create directed neural connections that strengthen and form inspectable nested formations',()=>{
  const s=closeSwarm();s.step();const initial=s.relations[0].strength;
  for(let i=0;i<45;i++)s.step();
  assert(s.relations[0].strength>initial);
  const mesh=s.formations.find(f=>f.active&&f.level===2);assert(mesh);
  assert(mesh.children.length);assert(mesh.members.every(id=>s.particles.some(p=>p.id===id)));
  assert(mesh.children.every(id=>s.formations.some(f=>f.id===id&&f.level===1)));
  assert(s.relations.some(r=>s.relations.some(reverse=>reverse.from===r.to&&reverse.to===r.from)));
});
test('trained recurrent predictor beats identical no-learning control',()=>{
  const trained=closeSwarm({learningRate:.1}),control=closeSwarm({learningRate:0});
  for(let i=0;i<100;i++){trained.step();control.step();}
  assert(trained.loss<control.loss*.3,`${trained.loss} vs ${control.loss}`);
  assert(trained.relations.some((r,i)=>r.weight!==control.relations[i].weight));
});
test('disuse weakens relations according to retention; force can dissolve a mesh without deleting its constituents',()=>{
  const s=closeSwarm({decay:.05});for(let i=0;i<30;i++)s.step();
  const relation=s.relations[0],strength=relation.strength;
  s.particles.forEach((p,i)=>{p.x=.03+i*.13;p.y=.5;});s.params.encounterRadius=.03;s.step();
  assert(relation.strength<strength);
  const sameUses=s.relations.find(r=>r.uses===relation.uses&&r.retention!==relation.retention);assert(sameUses);
  // Retention produces a different loss of strength from identical encounters.
  assert.notEqual(sameUses.strength,relation.strength);
  const before=s.particles.length;
  for(const p of s.particles)s.action('force',{id:p.id,magnitude:5});
  assert.equal(s.particles.length,before);assert(s.formations.some(f=>!f.active));
  assert(s.events.some(e=>e.type==='formation-dissolved'));
  for(let i=0;i<100;i++)s.step();assert(s.relations.some(r=>!r.active));
});
test('snapshots preserve network weights, full history, and future deterministic evolution',()=>{
  const s=new Swarm({count:24});for(let i=0;i<35;i++)s.step();
  s.action('transition',{id:'p001',line:3});s.action('compare',{a:'p001',b:'p002',c:'p003'});
  const snapshot=JSON.parse(JSON.stringify(s.snapshot())),restored=Swarm.restore(snapshot);
  assert.deepEqual(restored.snapshot(),s.snapshot());
  for(let i=0;i<12;i++){s.step();restored.step();}assert.deepEqual(restored.snapshot(),s.snapshot());
});
test('replay reproduces actions at the exact ticks, including repeated actions and parameter changes',()=>{
  const s=new Swarm({count:24});s.action('parameters',{decay:.002});
  for(let i=0;i<33;i++)s.step();
  s.action('transition',{id:'p001',line:1});s.action('stimulate',{id:'p001',dimension:'Evolution'});
  for(let i=0;i<8;i++)s.step();
  s.action('force',{id:'p001',magnitude:.4});s.action('compare',{a:'p001',b:'p002',c:'p003'});
  const replayed=Swarm.replay(s.snapshot());assert.deepEqual(replayed.snapshot(),s.snapshot());
  const comparison=s.events.at(-1);assert(comparison.witness);assert.equal(comparison.leadingDimension,null);
});
test('invalid inputs and malformed imports cannot corrupt a running engine',()=>{
  const s=new Swarm({count:4}),before=s.snapshot();
  assert.throws(()=>s.action('parameters',{decay:-1}));assert.throws(()=>s.action('transition',{id:'p001',line:9}));
  assert.throws(()=>s.action('force',{id:'p001',magnitude:NaN}));assert.deepEqual(s.snapshot(),before);
  const bad=s.snapshot();bad.particles[0].x=NaN;assert.throws(()=>Swarm.restore(bad));
  const spoof=s.snapshot();spoof.step=null;assert.equal(typeof Swarm.restore(spoof).step,'function');
  const badHistory=s.snapshot();badHistory.events[0].id='e200';assert.throws(()=>Swarm.restore(badHistory));
});
test('local model adapter needs comparison evidence and keeps proposals separate from execution',async()=>{
  const model=new LocalModelAdapter(),s=new Swarm({count:4});
  await assert.rejects(()=>model.propose([],{}),/No local/);
  const comparison=s.action('compare',{a:'p001',b:'p002'});
  model.attach({name:'test-contract-adapter',async ingestComparisons({comparisons}){return {text:'Candidate relationship',evidence:[comparisons[0].id]};}});
  const proposal=await model.propose([comparison],{}),before=s.particles.map(p=>p.gate);
  const e=s.action('proposal',proposal);assert.equal(e.status,'untested');assert.deepEqual(s.particles.map(p=>p.gate),before);
  model.attach({ingestComparisons:()=>({text:'Unsupported',evidence:['missing']})});
  await assert.rejects(()=>model.propose([comparison],{}),/cite/);
});

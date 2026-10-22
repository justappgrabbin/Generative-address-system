import test from 'node:test';
import assert from 'node:assert/strict';
import {AddressedField} from '../src/addressed-field.mjs';
import {qualificationInterval,locateQualification} from '../src/proportional-position.mjs';
test('document identity survives contextual placement, recursive entry and snapshot replay',()=>{
 const f=new AddressedField();
 for(const [id,dimension] of [['world','Being'],['person','Design'],['movement','Movement']])f.execute({operation:'defineStructure',payload:{id,dimension,source:'document:final-recap'}});
 f.execute({operation:'placeStructure',payload:{id:'person',dominatingStructure:'world',role:'Arc-second',source:'observed:1'}});
 for(const role of ['Axis','Arc-second'])f.execute({operation:'placeStructure',payload:{id:'movement',dominatingStructure:'person',role,source:'observed:2'}});
 const result=f.execute({operation:'readStructure',payload:{id:'movement'}});
 assert.equal(result.identity.role,'Axiom');assert.equal(result.history.length,2);assert.equal(result.currentPlacement.role,'Arc-second');
 assert.deepEqual(f.enterStructure({id:'world'}).readOrder,['Being','Movement','Space','Design','Evolution']);
 assert.equal(f.enterStructure({id:'person'}).contents[0].id,'movement');
 const restored=new AddressedField().restore(f.snapshot());assert.deepEqual(restored.readStructure({id:'movement'}),result);
 const before=f.snapshot();assert.throws(()=>f.placeStructure({id:'movement',dominatingStructure:'missing',role:'Axis',source:'bad'}));assert.deepEqual(f.snapshot(),before);
});
test('exact nested subdivisions resolve back to qualification without treating the span as DMS ranges',()=>{
 for(let line=1;line<=6;line++)for(let color=1;color<=6;color++)for(let tone=1;tone<=6;tone++)for(let base=1;base<=5;base++){
  const q={line,color,tone,base,arcFraction:99},interval=qualificationInterval(q);
  assert.deepEqual(locateQualification(interval.proportion.start),q);
 }
 const end=qualificationInterval({line:6,color:6,tone:6,base:5,arcFraction:99}).localDMS.end;
 assert.deepEqual([end.degree,end.minute,end.second],[5,37,30]);
});
test('a new exact address can be admitted using the supplied origin and valid DMS display ranges',()=>{
 const f=new AddressedField();
 const result=f.execute({operation:'resolveAddress',payload:{scope:{planetary:1,dimension:'Being',gate:1,zodiac:1,house:1},qualification:{line:6,color:6,tone:6,base:5,arcFraction:99},origin:{degree:29,minute:59,second:59},source:'fixture:supplied-origin',admit:true}});
 assert.equal(f.nodes.size,1);assert.equal(result.address.zodiac,2);
 assert.ok(result.address.degree<=29&&result.address.minute<=59&&result.address.second<=59);
 assert.throws(()=>f.resolveAddress({scope:{zodiac:1},qualification:{},origin:{degree:30,minute:0,second:0},source:'invalid'}));
});

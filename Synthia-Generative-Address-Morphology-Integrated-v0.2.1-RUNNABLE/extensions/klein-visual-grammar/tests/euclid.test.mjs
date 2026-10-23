import test from 'node:test';
import assert from 'node:assert/strict';
import {point,distance,circleIntersections,equilateralOnSegment,transformConstruction,rasterizeConstruction} from '../src/euclid.mjs';
test('Byrne/Euclid Book I proposition 1 constructs a proven equilateral triangle',()=>{
 const c=equilateralOnSegment(point(72,180),point(184,180));
 assert.equal(c.proof.valid,true);assert.equal(c.relations.length,3);
 assert.equal(c.address,null);assert.equal(c.addressStatus,'unassigned');
 assert.ok(Math.abs(distance(c.points.A,c.points.C)-112)<1e-7);
});
test('Euclidean similarity preserves equal sides and construction provenance',()=>{
 const c=equilateralOnSegment(point(20,100),point(120,100));
 const t=transformConstruction(c,{scale:0.8,rotate:Math.PI/3,translate:{x:70,y:20}});
 assert.equal(t.proof.valid,true);assert.deepEqual(t.entities,c.entities);assert.deepEqual(t.relations,c.relations);
});
test('circle intersection detects disjoint circles',()=>assert.deepEqual(circleIntersections(point(0,0),1,point(5,0),1),[]));
test('render gives RGBA pixels for existing Klein readImage pipeline',()=>{
 const img=rasterizeConstruction(equilateralOnSegment(point(72,180),point(184,180)));
 assert.equal(img.data.length,256*256*4);
 assert.ok(img.data.some((v,i)=>i%4===0&&v!==255));
});
test('rejects degenerate base',()=>assert.throws(()=>equilateralOnSegment(point(1,1),point(1,1)),RangeError));

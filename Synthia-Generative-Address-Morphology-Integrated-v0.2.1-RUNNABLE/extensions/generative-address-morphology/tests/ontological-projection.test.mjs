import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAddressedStructure} from '../src/projections/ontological.mjs';
const address=()=>({planetary:'Sun',dimension:'Movement',gate:25,line:4,color:4,tone:4,base:2,degree:25,minute:59,second:31.92,arcAxis:{axis:'ecliptic',arcUnit:1},zodiac:'Virgo',house:5});
test('projection ignores arbitrary storage identifiers',()=>{
  const a=projectAddressedStructure([{...address(),id:'abc'}]);
  const b=projectAddressedStructure([{...address(),id:'xyz'}]);
  assert.deepEqual(a,b);
});
test('leading dimension changes projection',()=>{
  const a=projectAddressedStructure([address()],{leadingDimension:'Movement'});
  const b=projectAddressedStructure([address()],{leadingDimension:'Space'});
  assert.notEqual(a.color.h,b.color.h);
});
test('coordinate changes alter projection',()=>{
  const a=projectAddressedStructure([address()]);
  const b=projectAddressedStructure([{...address(),gate:26}]);
  assert.notEqual(a.color.h,b.color.h);
});
test('missing coordinate is not fabricated',()=>{
  const a=address();delete a.base;
  assert.throws(()=>projectAddressedStructure([a]),/base is unresolved/);
});
test('projection never claims image reconstruction',()=>{
  const a=projectAddressedStructure([address()]);
  assert.equal(a.reconstructionClass,'procedural-projection-not-image-reconstruction');
});

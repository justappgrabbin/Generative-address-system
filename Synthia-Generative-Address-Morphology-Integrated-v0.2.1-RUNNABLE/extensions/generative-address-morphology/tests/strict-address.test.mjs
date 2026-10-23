import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStrictAddress,semanticCoordinateKey} from '../src/core/strict-address.mjs';
const sample=()=>({planetary:'Sun',dimension:'Movement',gate:25,line:4,color:4,tone:4,base:2,degree:25,minute:59,second:31.92,arcAxis:{axis:'ecliptic',arcUnit:1},zodiac:'Virgo',house:5});
test('valid canonical coordinates retain supplied provenance',()=>{
  const result=validateStrictAddress(sample());
  assert.equal(result.complete,true);
  assert.equal(result.provenance.gate.status,'supplied');
});
test('missing coordinate is never invented',()=>{
  const input=sample();delete input.base;
  assert.throws(()=>validateStrictAddress(input),/base is unresolved/);
  const partial=validateStrictAddress(input,{requireComplete:false});
  assert.equal(partial.coordinates.base,null);
  assert.equal(partial.provenance.base.status,'unresolved');
});
test('fractional discrete coordinate is rejected',()=>{
  for(const field of ['gate','line','color','tone','base','house']){
    const input=sample();input[field]+=0.5;
    assert.throws(()=>validateStrictAddress(input),new RegExp(field+' must be an integer'));
  }
});
test('invalid minute and second are rejected',()=>{
  for(const field of ['minute','second']){
    const input=sample();input[field]=60;
    assert.throws(()=>validateStrictAddress(input),new RegExp(field));
  }
});
test('storage identifiers do not alter semantic coordinate identity',()=>{
  const a={...sample(),id:'storage-a'};
  const b={...sample(),id:'storage-b'};
  assert.equal(semanticCoordinateKey(a),semanticCoordinateKey(b));
});
test('object key order does not change semantic identity',()=>{
  const a=sample(),b=sample();b.arcAxis={arcUnit:1,axis:'ecliptic'};
  assert.equal(semanticCoordinateKey(a),semanticCoordinateKey(b));
});

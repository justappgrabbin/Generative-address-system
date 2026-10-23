import assert from 'node:assert/strict';
import { and,or,xor,xnor,but,operator,BINARY_BOOLEAN_FUNCTIONS } from '../src/engine/boolean-ato.js';
import { calculateFocalSpaceWeight } from '../src/integration/focal-weight-calculator.js';

assert.deepEqual(and('1100','1010'),[1,0,0,0]);
assert.deepEqual(or('1100','1010'),[1,1,1,0]);
assert.deepEqual(xor('1100','1010'),[0,1,1,0]);
assert.deepEqual(xnor('1100','1010'),[1,0,0,1]);
assert.deepEqual(but('1100','1010'),[0,1,0,0]);
assert.notDeepEqual(but('1100','1010'),but('1010','1100'));
assert.deepEqual(operator('1100','1010','but'),[0,1,0,0]);

const result=calculateFocalSpaceWeight({knowledge:1,causal:.75,temporal:.5,dependency:.25});
assert.deepEqual(Object.keys(result.inputs),['knowledge','causal','temporal','dependency']);
assert.deepEqual(Object.keys(result.operators),BINARY_BOOLEAN_FUNCTIONS);
for(const mode of BINARY_BOOLEAN_FUNCTIONS)assert.equal(result.operators[mode].trace.length,3);
assert.equal(result.operators.a_and_not_b.directional,true);
assert.equal(result.hamming.pairs.length,6);
assert.ok(result.hamming.meanDistance>=0&&result.hamming.meanDistance<=1);
assert.ok(result.spaceWeight>=0&&result.spaceWeight<=1);
assert.equal(result.policy,'retain-all-boolean-results-plus-hamming');
console.log('focal-weight-calculator: PASS',JSON.stringify({inputs:result.inputs,operatorScores:Object.fromEntries(Object.entries(result.operators).map(([k,v])=>[k,v.score])),spaceWeight:result.spaceWeight}));

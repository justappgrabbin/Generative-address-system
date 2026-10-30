import test from 'node:test';
import assert from 'node:assert/strict';
import { DODECAHEDRON, observeDodecahedron } from '../extensions/generative-address-morphology/src/core/dodecahedron.mjs';
import { analyzeStructure } from '../extensions/generative-address-morphology/src/core/structural-space.mjs';

test('the actual dodecahedron has 12 pentagons, 30 face adjacencies and 20 vertex junctions', () => {
  assert.equal(DODECAHEDRON.faces, 12);
  assert.equal(DODECAHEDRON.edges, 30);
  assert.equal(DODECAHEDRON.vertices, 20);
  assert.equal(DODECAHEDRON.faceNeighbors.length, 12);
  for (let i = 0; i < 12; i++) {
    assert.equal(DODECAHEDRON.faceNeighbors[i].length, 5);
    for (const other of DODECAHEDRON.faceNeighbors[i])
      assert.ok(DODECAHEDRON.faceNeighbors[other - 1].includes(i + 1));
  }
  assert.equal(DODECAHEDRON.vertexFaceTriples.length, 20);
});

test('no face assignment is invented when only words or syntactic relations are known', () => {
  const r = analyzeStructure('memory shapes structure');
  assert.equal(r.geometry.status, 'no-placement-evidence');
  assert.equal(r.geometry.placedWordCount, 0);
  assert.equal(r.geometry.nestedDodecahedra, 'not-verified-by-face-closure-alone');
});

test('real sourced relations among three faces meeting at a vertex are observed as a triangle', () => {
  const faces = DODECAHEDRON.vertexFaceTriples[0];
  const placements = ['a', 'b', 'c'].map((id,i) => ({id,face:faces[i],source:'verified:example'}));
  const relations = [['a','b'],['b','c'],['c','a']].map(([from,to])=>({from,to,kind:'observed-link',source:'verified:example'}));
  const out = observeDodecahedron({placements,relations});
  assert.equal(out.observedTriangles.length,1);
  assert.equal(out.observedTriangles[0].kind,'observed-vertex-triangle');
  assert.equal(out.observedRelations.filter(r=>r.crossFace).length,3);
  assert.ok(out.observedRelations.every(r=>r.geometricallyAdjacentFaces));
  assert.equal(out.faceClosureCandidates.length,0);
});

test('closed 12-face topology can be detected without calling it a learned nested dodecahedron', () => {
  const placements=Array.from({length:12},(_,i)=>({id:`w${i+1}`,face:i+1,source:'verified:example',container:'child-1'}));
  const relations=[];
  for(let i=1;i<=12;i++)for(const n of DODECAHEDRON.faceNeighbors[i-1])
    if(i<n)relations.push({from:`w${i}`,to:`w${n}`,kind:'observed-link',source:'verified:example'});
  const out=observeDodecahedron({placements,relations});
  assert.equal(relations.length,30);
  assert.equal(out.faceClosureCandidates.length,1);
  assert.equal(out.faceClosureCandidates[0].kind,'face-adjacency-closure-candidate');
  assert.equal(out.nestedDodecahedra,'not-verified-by-face-closure-alone');
});

test('face mapping without evidence or dangling relation is rejected', () => {
  assert.throws(()=>observeDodecahedron({placements:[{id:'a',face:1}]}),/source/);
  assert.throws(()=>observeDodecahedron({placements:[{id:'a',face:13,source:'s'}]}),/face/);
  assert.throws(()=>observeDodecahedron({relations:[{from:'a',to:'b',kind:'x',source:'s'}]}),/endpoints/);
});

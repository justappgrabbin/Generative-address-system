// The 12 pentagonal faces of a regular dodecahedron have the adjacency
// topology of the 12 vertices of its dual icosahedron. Face numbering is a
// geometric reference only: it assigns NO word, gate, direction, or meaning.
const phi = (1 + Math.sqrt(5)) / 2;
const centers = [
  ...[-1, 1].flatMap(y => [-1, 1].map(z => [0, y, z * phi])),
  ...[-1, 1].flatMap(x => [-1, 1].map(y => [x, y * phi, 0])),
  ...[-1, 1].flatMap(x => [-1, 1].map(z => [x * phi, 0, z])),
];
const squaredDistance = (a, b) => a.reduce((n, v, i) => n + (v - b[i]) ** 2, 0);
const adjacent = (a, b) => Math.abs(squaredDistance(centers[a - 1], centers[b - 1]) - 4) < 1e-9;
const faceEdges = [], vertexTriples = [];
for (let a = 1; a <= 12; a++) for (let b = a + 1; b <= 12; b++)
  if (adjacent(a, b)) faceEdges.push([a, b]);
for (let a = 1; a <= 12; a++) for (let b = a + 1; b <= 12; b++)
  for (let c = b + 1; c <= 12; c++)
    if (adjacent(a, b) && adjacent(b, c) && adjacent(a, c)) vertexTriples.push([a, b, c]);
if (faceEdges.length !== 30 || vertexTriples.length !== 20 ||
    Array.from({length:12}, (_,i) => faceEdges.filter(e => e.includes(i + 1)).length).some(n => n !== 5))
  throw new Error('Dodecahedral face topology invariant failed');
const key = (a, b) => JSON.stringify([String(a), String(b)].sort());
const adjacency = new Set(faceEdges.map(([a, b]) => key(a, b)));
const junctions = new Set(vertexTriples.map(t => t.join(':')));
export const DODECAHEDRON = Object.freeze({
  faces: 12, edges: 30, vertices: 20,
  faceNeighbors: Object.freeze(Array.from({length:12}, (_,i) =>
    Object.freeze(faceEdges.filter(e => e.includes(i + 1)).map(e => e.find(n => n !== i + 1)).sort((a,b)=>a-b)))),
  vertexFaceTriples: Object.freeze(vertexTriples.map(t => Object.freeze([...t]))),
  note: 'Geometric topology only; does not assert which words or 13-field addresses belong to any face.',
});

/** Observe only provenance-backed placements and typed relations supplied
 * by the caller. Never derive word position from spelling, hash or gate name.
 * Cycles are not called circles; face closure is only a candidate formation.
 */
export function observeDodecahedron({ placements = [], relations = [] } = {}) {
  if (!Array.isArray(placements) || !Array.isArray(relations)) throw new TypeError('placements and relations must be arrays');
  const words = new Map();
  for (const p of placements) {
    if (!p || typeof p.id !== 'string' || !p.id || !Number.isInteger(p.face) ||
        p.face < 1 || p.face > 12 || typeof p.source !== 'string' || !p.source)
      throw new TypeError('each placement needs word id, face 1..12 and nonempty evidence source');
    if (words.has(p.id)) throw new Error(`duplicate word placement ${p.id}`);
    words.set(p.id, { ...p, container:p.container ?? 'root' });
  }
  const links = new Set(), observedRelations = [];
  for (const r of relations) {
    if (!words.has(r?.from) || !words.has(r?.to) || r.from === r.to ||
        typeof r.kind !== 'string' || !r.kind || typeof r.source !== 'string' || !r.source)
      throw new TypeError('each distinct-word relation needs placed endpoints, kind and source');
    const from=words.get(r.from), to=words.get(r.to);
    links.add(key(r.from, r.to));
    observedRelations.push({...r, crossFace:from.face !== to.face,
      geometricallyAdjacentFaces:adjacency.has(key(from.face, to.face))});
  }
  const entries=[...words.values()], triangles=[];
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)for(let k=j+1;k<entries.length;k++){
    const triple=[entries[i],entries[j],entries[k]];
    if(new Set(triple.map(p=>p.container)).size!==1)continue;
    const faces=triple.map(p=>p.face).sort((a,b)=>a-b);
    if(new Set(faces).size!==3 || !junctions.has(faces.join(':')))continue;
    if([[0,1],[0,2],[1,2]].every(([a,b])=>links.has(key(triple[a].id,triple[b].id))))
      triangles.push({wordIds:triple.map(p=>p.id),faces,kind:'observed-vertex-triangle',container:triple[0].container});
  }
  const containers=new Set(entries.map(p=>p.container)), closureCandidates=[];
  for(const container of containers){
    const local=entries.filter(p=>p.container===container),occupied=new Set(local.map(p=>p.face));
    if(occupied.size!==12)continue;
    const closed=faceEdges.every(([a,b])=>local.some(x=>x.face===a && local.some(y=>y.face===b && links.has(key(x.id,y.id)))));
    if(closed)closureCandidates.push({container,kind:'face-adjacency-closure-candidate',verifiedRequiredEdges:30});
  }
  return {
    status:entries.length?'observed-placements-only':'no-placement-evidence',
    topology:{faces:DODECAHEDRON.faces,edges:DODECAHEDRON.edges,vertices:DODECAHEDRON.vertices},
    placedWordCount:entries.length,
    observedRelations,
    observedTriangles:triangles,
    faceClosureCandidates:closureCandidates,
    circularForms:'not-inferred-from-graph-cycles',
    nestedDodecahedra:'not-verified-by-face-closure-alone',
    note:'A face is not a semantic address; word placements must come from a separately verified rule or observation.',
  };
}

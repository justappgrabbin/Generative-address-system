// Mathematical dodecahedron: 20 vertices, 30 edges, 12 pentagonal faces.
// A 3D geometric reference/embedding; not an identification of five semantic
// dimensions with three Cartesian axes, and not a source-derived BANTU traversal.
const phi=(1+Math.sqrt(5))/2;
const vertices=[];
for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
for(const a of [-1,1])for(const b of [-1,1]){
  vertices.push([0,a/phi,b*phi],[a/phi,b*phi,0],[a*phi,0,b/phi]);
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const planes=new Map();
for(let i=0;i<20;i++)for(let j=i+1;j<20;j++)for(let k=j+1;k<20;k++){
  let n=cross(sub(vertices[j],vertices[i]),sub(vertices[k],vertices[i]));
  const length=Math.hypot(...n);if(length<1e-8)continue;n=n.map(v=>v/length);
  let d=dot(n,vertices[i]);if(d<0){n=n.map(v=>-v);d=-d;}
  if(vertices.some(v=>dot(n,v)>d+1e-7))continue;
  const face=vertices.flatMap((v,index)=>Math.abs(dot(n,v)-d)<1e-7?[index]:[]);
  if(face.length===5)planes.set(face.join('.'),{normal:n,distance:d,vertices:face});
}
const minDistance=Math.min(...vertices.flatMap((v,i)=>vertices.slice(i+1).map(w=>Math.hypot(...sub(v,w)))));
const edges=[];for(let i=0;i<20;i++)for(let j=i+1;j<20;j++)if(Math.abs(Math.hypot(...sub(vertices[i],vertices[j]))-minDistance)<1e-7)edges.push([i,j]);
export const DODECAHEDRON=Object.freeze({vertices,edges,faces:[...planes.values()],scale:.27,
  provenance:'mathematical regular dodecahedron; user-specified totality; orientation-to-morphology mapping unresolved'});
export function containsPoint(point){const p=point.map(v=>(v-.5)/DODECAHEDRON.scale);return DODECAHEDRON.faces.every(f=>dot(f.normal,p)<=f.distance+1e-8);}
export function constrainParticle(p){
  const position=[p.x-.5,p.y-.5,p.z-.5];let velocity=[p.vx,p.vy,p.vz];
  for(const f of DODECAHEDRON.faces){
    const excess=dot(f.normal,position)-f.distance*DODECAHEDRON.scale;
    if(excess>0){for(let k=0;k<3;k++)position[k]-=f.normal[k]*(excess+1e-9);
      const speed=dot(velocity,f.normal);if(speed>0)velocity=velocity.map((v,k)=>v-1.8*speed*f.normal[k]);}
  }
  [p.x,p.y,p.z]=position.map(v=>v+.5);[p.vx,p.vy,p.vz]=velocity;
}

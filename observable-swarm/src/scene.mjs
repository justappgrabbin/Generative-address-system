/** Particle-painted surface of the SAME live substrate.
 * Faces exist only where three actual persistent relations close a triangle.
 * Fine marks tessellate those faces and existing bonds; they are render samples,
 * not extra agents. No target image, object silhouette, or separate world model.
 * Pigment and height are explicitly experimental display transforms.
 */
export function surfaceFaces(state) {
  const adjacent=new Map(state.particles.map(p=>[p.id,new Set()]));
  for(const r of state.relations)if(r.active&&r.strength>=state.params.formationThreshold){
    adjacent.get(r.from)?.add(r.to);adjacent.get(r.to)?.add(r.from);
  }
  const faces=[];
  for(const [a,neighbors] of adjacent)for(const b of neighbors)if(a<b)for(const c of neighbors)if(b<c&&adjacent.get(b).has(c))faces.push([a,b,c]);
  return faces;
}
function paint(p) {
  // A reproducible visual convention; semantic color/sound rules remain open.
  const phase=(p.gate-1)/63;
  return [Math.round(65+105*phase+65*p.activation),Math.round(100+90*(1-phase)+35*p.activation),Math.round(125+70*Math.sin(phase*Math.PI)+30*p.activation)];
}
export function renderScene(ctx,state,width,height,{selected,zoom=1,overlay=false,camera={x:.5,y:.5}}={}) {
  ctx.clearRect(0,0,width,height);
  const byId=new Map(state.particles.map(p=>[p.id,p]));
  const project=p=>({x:width/2+(p.x-camera.x)*width*zoom,y:height/2+(p.y-camera.y)*height*zoom});
  const faces=surfaceFaces(state);
  // Larger triangles paint contiguous matter. Their fine marks share interpolated state.
  for(const ids of faces){
    const points=ids.map(id=>byId.get(id)),ps=points.map(project),colors=points.map(paint);
    const color=colors[0].map((v,k)=>Math.round((v+colors[1][k]+colors[2][k])/3));
    ctx.beginPath();ctx.moveTo(ps[0].x,ps[0].y);ctx.lineTo(ps[1].x,ps[1].y);ctx.lineTo(ps[2].x,ps[2].y);ctx.closePath();
    ctx.fillStyle=`rgba(${color.join(',')},0.26)`;ctx.fill();
    // Fixed barycentric samples move continuously with their constituent particles.
    const resolution=10;
    for(let i=0;i<=resolution;i++)for(let j=0;j<=resolution-i;j++){
      const a=i/resolution,b=j/resolution,c=1-a-b;
      const x=ps[0].x*a+ps[1].x*b+ps[2].x*c,y=ps[0].y*a+ps[1].y*b+ps[2].y*c;
      const rgb=colors[0].map((v,k)=>Math.round(v*a+colors[1][k]*b+colors[2][k]*c));
      ctx.fillStyle=`rgba(${rgb.join(',')},0.5)`;ctx.fillRect(x,y,1.2*zoom,1.2*zoom);
    }
  }
  // A bond is painted as matter along its present geometry, rather than an abstract line.
  for(const r of state.relations){
    if(r.from>r.to)continue;
    const a=byId.get(r.from),b=byId.get(r.to);if(!a||!b)continue;
    const ap=project(a),bp=project(b),distance=Math.hypot(ap.x-bp.x,ap.y-bp.y),samples=Math.max(2,Math.ceil(distance/2));
    const ac=paint(a),bc=paint(b);
    for(let i=0;i<=samples;i++){
      const t=i/samples,rgb=ac.map((v,k)=>Math.round(v*(1-t)+bc[k]*t));
      const x=ap.x*(1-t)+bp.x*t,y=ap.y*(1-t)+bp.y*t;
      ctx.fillStyle=`rgba(${rgb.join(',')},${0.18+r.strength*.5})`;
      const breadth=(.5+r.strength*2)*zoom;ctx.fillRect(x-breadth/2,y-breadth/2,breadth,breadth);
    }
  }
  for(const p of [...state.particles].sort((a,b)=>a.activation-b.activation)){
    const at=project(p),color=paint(p),radius=(2+p.activation*5)*zoom;
    // Local micro-expressions are driven by the particle's current line and activation.
    for(let ring=1;ring<=3;ring++){
      const count=ring*8;
      for(let i=0;i<count;i++){
        const angle=i/count*Math.PI*2+p.line*.12;
        const dx=Math.cos(angle)*radius*ring*.55,dy=Math.sin(angle)*radius*ring*.55;
        ctx.fillStyle=`rgba(${color.join(',')},${.55/ring})`;ctx.fillRect(at.x+dx,at.y+dy,1.3*zoom,1.3*zoom);
      }
    }
    ctx.fillStyle=`rgb(${color.join(',')})`;ctx.beginPath();ctx.arc(at.x,at.y,Math.max(1.2,2.3*zoom),0,Math.PI*2);ctx.fill();
    if(overlay&&p.id===selected){ctx.strokeStyle='#b2f5df';ctx.lineWidth=1;ctx.beginPath();ctx.arc(at.x,at.y,12,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d6e6de';ctx.font='11px ui-monospace,monospace';ctx.fillText(p.id,at.x+16,at.y+3);}
  }
  return {faces:faces.length,surfaceStatus:faces.length?'persistent-relation surfaces':'forming relationships'};
}

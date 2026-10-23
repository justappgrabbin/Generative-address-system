// Experimental image grammar, combined spec II.6 §§3–5 and IV.J §§22/56.
// Its paths are image-local geometry, never claimed ontological addresses.
export const IMAGE_LIMIT = 1048576;
function checkDimensions(width,height){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>IMAGE_LIMIT)throw new RangeError(`Image must contain 1..${IMAGE_LIMIT} pixels`);}
export function checkPixels(width,height,rgba){
  checkDimensions(width,height);
  if(!(rgba instanceof Uint8Array||rgba instanceof Uint8ClampedArray)||rgba.length!==width*height*4)throw new TypeError('Exact width × height × 4 RGBA bytes required');
}
export function measurePixels(width,height,rgba){
  checkPixels(width,height,rgba);
  const n=width*height,sum=[0,0,0,0],squared=[0,0,0],quadrants=[0,0,0,0],counts=[0,0,0,0];let horizontal=0,vertical=0,hCount=0,vCount=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const k=(y*width+x)*4,q=(y<height/2?0:2)+(x<width/2?0:1);
    for(let c=0;c<4;c++){sum[c]+=rgba[k+c];if(c<3)squared[c]+=rgba[k+c]**2;}
    quadrants[q]+=(rgba[k]+rgba[k+1]+rgba[k+2])/3;counts[q]++;
    if(x){for(let c=0;c<3;c++)horizontal+=Math.abs(rgba[k+c]-rgba[k-4+c]);hCount+=3;}
    if(y){for(let c=0;c<3;c++)vertical+=Math.abs(rgba[k+c]-rgba[k-width*4+c]);vCount+=3;}
  }
  const mean=sum.map(s=>s/n/255),std=squared.map((s,c)=>Math.sqrt(Math.max(0,s/n-(sum[c]/n)**2))/255);
  const edges=[horizontal/Math.max(1,hCount)/255,vertical/Math.max(1,vCount)/255];
  const descriptor=[...mean,...std,...edges,width/(width+height),...quadrants.map((s,i)=>s/Math.max(1,counts[i])/255)];
  return {schema:'measured-rgba.v1',meanRGBA:mean,stdRGB:std,edgeDifference:edges,descriptor,featureNames:['meanR','meanG','meanB','meanA','stdR','stdG','stdB','horizontalDifference','verticalDifference','aspect','upperLeftMean','upperRightMean','lowerLeftMean','lowerRightMean'],fieldInput:[(mean[0]+mean[1]+mean[2])/3,(edges[0]+edges[1])/2]};
}
export function decomposeImage({width,height,rgba,source,tileSize=8}){
  checkPixels(width,height,rgba);
  if(!source||!Number.isInteger(tileSize)||tileSize<1||tileSize>64)throw new TypeError('Source reference and tileSize in 1..64 required');
  const nodes=[],solids=new Map();let literalBytes=0;
  const build=(x,y,w,h)=>{
    const offset=(y*width+x)*4,color=Array.from(rgba.subarray(offset,offset+4));let uniform=true;
    outer:for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)for(let c=0;c<4;c++)if(rgba[(yy*width+xx)*4+c]!==color[c]){uniform=false;break outer;}
    if(uniform){const key=`${w}:${h}:${color.join(',')}`;if(solids.has(key))return solids.get(key);const id=nodes.length;nodes.push({id,op:'solid',width:w,height:h,color});solids.set(key,id);return id;}
    if(w<=tileSize&&h<=tileSize){const pixels=[];for(let yy=y;yy<y+h;yy++)pixels.push(...rgba.subarray((yy*width+x)*4,(yy*width+x+w)*4));const id=nodes.length;literalBytes+=pixels.length;nodes.push({id,op:'raster',width:w,height:h,pixels});return id;}
    const children=[],ws=w===1?[1]:[Math.floor(w/2),w-Math.floor(w/2)],hs=h===1?[1]:[Math.floor(h/2),h-Math.floor(h/2)];let dy=0;
    for(const hh of hs){let dx=0;for(const ww of ws){children.push({node:build(x+dx,y+dy,ww,hh),x:dx,y:dy});dx+=ww;}dy+=hh;}
    const id=nodes.length;nodes.push({id,op:'split',width:w,height:h,children});return id;
  };
  const root=build(0,0,width,height);
  return {schema:'synthia.image-grammar.v1',source,width,height,root,nodes,measurements:measurePixels(width,height,rgba),metrics:{nodes:nodes.length,literalBytes,sourcePixelBytes:rgba.length},addressStatus:'Image-local geometry only; ontological correspondence unresolved'};
}
export function reconstructImage(structure,{node=structure.root}={}){
  if(structure?.schema!=='synthia.image-grammar.v1'||!Array.isArray(structure.nodes)||structure.nodes.length>IMAGE_LIMIT*2)throw new TypeError('Invalid image grammar');
  const root=structure.nodes[node];if(!root)throw new Error('Unknown image part');
  checkDimensions(root.width,root.height);
  const pixels=new Uint8ClampedArray(root.width*root.height*4);checkPixels(root.width,root.height,pixels);
  const visit=(id,x,y,ancestors)=>{
    const n=structure.nodes[id];if(!n||n.id!==id||ancestors.has(id))throw new Error('Invalid/cyclic image composition');
    if(!Number.isInteger(n.width)||!Number.isInteger(n.height)||n.width<1||n.height<1||x<0||y<0||x+n.width>root.width||y+n.height>root.height)throw new RangeError('Image part outside parent bounds');
    const lineage=new Set(ancestors);lineage.add(id);
    if(n.op==='split'){
      const occupied=new Uint8Array(n.width*n.height);
      if(!Array.isArray(n.children)||n.children.length<1||n.children.length>4)throw new TypeError('Split requires 1..4 children');
      for(const child of n.children){const c=structure.nodes[child.node];if(!c||!Number.isInteger(child.x)||!Number.isInteger(child.y)||child.x<0||child.y<0||child.x+c.width>n.width||child.y+c.height>n.height)throw new RangeError('Invalid child placement');
        for(let yy=child.y;yy<child.y+c.height;yy++)for(let xx=child.x;xx<child.x+c.width;xx++){const k=yy*n.width+xx;if(occupied[k])throw new Error('Overlapping image parts');occupied[k]=1;}
        visit(child.node,x+child.x,y+child.y,lineage);
      }
      if(occupied.some(v=>!v))throw new Error('Incomplete image composition');
    }else if(n.op==='solid'||n.op==='raster'){
      const bytes=n.op==='solid'?n.color:n.pixels,expected=n.op==='solid'?4:n.width*n.height*4;
      if(!Array.isArray(bytes)||bytes.length!==expected||!bytes.every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw new TypeError('Invalid image primitive bytes');
      for(let yy=0;yy<n.height;yy++)for(let xx=0;xx<n.width;xx++)for(let c=0;c<4;c++)pixels[((y+yy)*root.width+x+xx)*4+c]=bytes[n.op==='solid'?c:(yy*n.width+xx)*4+c];
    }else throw new Error(`Unknown image operator: ${n.op}`);
  };
  visit(node,0,0,new Set());return {width:root.width,height:root.height,rgba:pixels};
}
export function composeImage({width,height,parts,background,source},lookup){
  checkDimensions(width,height);
  if(!source||!Array.isArray(parts)||!parts.length||parts.length>256||!Array.isArray(background)||background.length!==4||!background.every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw new TypeError('Sourced composition requires 1..256 parts and explicit RGBA background');
  const rgba=new Uint8ClampedArray(width*height*4);for(let i=0;i<rgba.length;i+=4)rgba.set(background,i);
  const lineage=[];
  for(const part of parts){
    const structure=lookup(part.imageId);if(!structure)throw new Error(`Unknown source image: ${part.imageId}`);
    const frame=reconstructImage(structure,{node:part.node??structure.root}),crop=part.crop??{x:0,y:0,width:frame.width,height:frame.height};
    if(![crop.x,crop.y,crop.width,crop.height].every(Number.isInteger)||crop.width<1||crop.height<1||crop.x<0||crop.y<0||crop.x+crop.width>frame.width||crop.y+crop.height>frame.height)throw new RangeError('Crop outside source image');
    const turns=part.quarterTurns??0;if(!Number.isInteger(turns)||turns<0||turns>3)throw new RangeError('quarterTurns must be 0..3');
    for(const flag of ['flipX','flipY'])if(part[flag]!==undefined&&typeof part[flag]!=='boolean')throw new TypeError(`${flag} must be a boolean`);
    const rw=turns%2?crop.height:crop.width,rh=turns%2?crop.width:crop.height,w=part.width??rw,h=part.height??rh;
    if(![part.x,part.y,w,h].every(Number.isInteger)||w<1||h<1||part.x<0||part.y<0||part.x+w>width||part.y+h>height)throw new RangeError('Composition part outside output bounds');
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      let rx=Math.floor(x*rw/w),ry=Math.floor(y*rh/h);if(part.flipX)rx=rw-1-rx;if(part.flipY)ry=rh-1-ry;
      const [sx,sy]=turns===0?[rx,ry]:turns===1?[ry,crop.height-1-rx]:turns===2?[crop.width-1-rx,crop.height-1-ry]:[crop.width-1-ry,rx];
      const s=((sy+crop.y)*frame.width+sx+crop.x)*4,d=((y+part.y)*width+x+part.x)*4,sa=frame.rgba[s+3]/255,da=rgba[d+3]/255,a=sa+da*(1-sa);
      for(let c=0;c<3;c++)rgba[d+c]=a?(frame.rgba[s+c]*sa+rgba[d+c]*da*(1-sa))/a:0;
      rgba[d+3]=a*255;
    }
    lineage.push({...structuredClone(part),source:structure.source,node:part.node??structure.root});
  }
  return {width,height,rgba,lineage:{source,operator:'ordered-image-composition.v1',parts:lineage,background:[...background]},measurements:measurePixels(width,height,rgba)};
}

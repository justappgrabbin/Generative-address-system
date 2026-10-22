import {decomposeImage,reconstructImage,composeImage} from './image-structure.mjs';
import {sha256Hex} from '../vendor/sha256.mjs';
import {encodeBMP} from '../vendor/browser/src/merged/artifacts.js';
export class ImageMemory {
  constructor(){this.images=new Map();this.feedback=[];this.bindings=new Map();}
  store({id,width,height,rgba,source,decode=null,lineage=null}){
    if(!id||this.images.has(id))throw new Error('Image identity must be new; prior image history is preserved');
    const structure=decomposeImage({width,height,rgba,source}),reconstructed=reconstructImage(structure);
    if(!reconstructed.rgba.every((v,i)=>v===rgba[i]))throw new Error('Image primitive reconstruction failed verification');
    const pixelSha256=sha256Hex(rgba);
    const record={id,width,height,source,decode:structuredClone(decode),lineage:structuredClone(lineage),pixelSha256,structure};
    this.images.set(id,record);return this.summary(id);
  }
  summary(id){const r=this.images.get(id);if(!r)throw new Error('Unknown image');return {id:r.id,width:r.width,height:r.height,source:r.source,decode:structuredClone(r.decode),lineage:structuredClone(r.lineage),artifact:structuredClone(r.artifact??null),pixelSha256:r.pixelSha256,metrics:structuredClone(r.structure.metrics),measurements:structuredClone(r.structure.measurements),reconstruction:'exact-decoded-RGBA',sceneMeaning:'UNKNOWN'};}
  reconstruct(id){const r=this.images.get(id);if(!r)throw new Error('Unknown image');const result=reconstructImage(r.structure);if(sha256Hex(result.rgba)!==r.pixelSha256)throw new Error('Image structure failed pixel integrity verification');return result;}
  artifact(id){
    const frame=this.reconstruct(id),opaque=new Uint8ClampedArray(frame.rgba);
    // Existing 24-bit BMP encoder has no alpha. White compositing is explicit;
    // the retained grammar and RGBA reconstruction still preserve exact alpha.
    for(let i=0;i<opaque.length;i+=4){const alpha=opaque[i+3]/255;for(let c=0;c<3;c++)opaque[i+c]=Math.round(opaque[i+c]*alpha+255*(1-alpha));opaque[i+3]=255;}
    const bytes=encodeBMP(frame.width,frame.height,opaque);
    return {id,mime:'image/bmp',bytes,sha256:sha256Hex(bytes),pixelSha256:this.images.get(id).pixelSha256,width:frame.width,height:frame.height,alphaPolicy:'BMP preview composites transparency over white; stored RGBA stays exact'};
  }
  compose(recipe,id){const frame=composeImage(recipe,key=>this.images.get(key)?.structure);return this.store({id,...frame,source:recipe.source,lineage:frame.lineage});}
  teach({imageId,label,source}){
    if(!this.images.has(imageId)||typeof label!=='string'||!label.trim()||typeof source!=='string'||!source)throw new TypeError('Teaching requires a stored image, a label and an evidence source');
    const result={id:`visual-feedback:${this.feedback.length+1}`,imageId,label:label.trim(),source};this.feedback.push(result);return structuredClone(result);
  }
  recognize(id,{limit=3}={}){
    const image=this.images.get(id);if(!image)throw new Error('Unknown image');
    if(!Number.isInteger(limit)||limit<1||limit>20)throw new RangeError('Recognition limit must be 1..20');
    const latest=new Map();for(const feedback of this.feedback)latest.set(feedback.imageId,feedback);
    const candidates=[...latest.values()].filter(f=>f.imageId!==id).map(feedback=>{
      const example=this.images.get(feedback.imageId),a=image.structure.measurements.descriptor,b=example.structure.measurements.descriptor;
      const distance=Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);
      return {imageId:feedback.imageId,label:feedback.label,distance,evidence:feedback.id,source:feedback.source};
    }).sort((a,b)=>a.distance-b.distance||a.evidence.localeCompare(b.evidence)).slice(0,limit);
    const taughtLabel=structuredClone(latest.get(id)??null);
    return {status:taughtLabel?'TAUGHT_EXAMPLE':candidates.length?'CANDIDATES':'INVESTIGATE',taughtLabel,method:'measured-visual-distance.v1',candidates,calibrated:false,reason:'Similarity to user-taught examples, not independently verified object recognition'};
  }
}
